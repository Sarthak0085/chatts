import { NextFunction, Request, Response } from "express";
import { catchAsyncError } from "../middlewares/catchAsyncErrors";
import Chat from "../models/chat.model";
import { getOtherMember } from "../lib/helpers";
import { UserType } from "../middlewares/auth";
import { ErrorHandler } from "../utils/errorHandler";
import User from "../models/user.model";
import { deleteFilesFromCloudinary, uploadFilesToCloudinary } from "../utils/features";
import Message from "../models/message.model";

export const newGroupChat = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const { name, members } = req.body;

    const transformedMembers = members.map((member: string) => ({ user: member }));

    const allMembers = [...transformedMembers, { user: req.user }];

    await Chat.create({
        name,
        groupChat: true,
        creator: req.user,
        members: allMembers,
    });

    // emitEvent(req, ALERT, allMembers, `Welcome to ${name} group`);
    // emitEvent(req, REFETCH_CHATS, members);

    return res.status(201).json({
        success: true,
        message: "Group Created",
    });
});

interface User {
    username: string;
    avatar: {
        public_id: string;
        url: string;
    }
}

export const getMyChats = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const chats = await Chat.find({ "members.user": req.user })
        .populate({ path: "members.user", select: "username avatar" })
        .exec();

    console.log("Before Populate : ", chats);

    // const populatedChats = await Chat.populate(chats, )

    console.log("After Populate: ", chats[0].members);

    const transformedChats = chats.map((chat: any) => {
        // console.log("chat:", chat);
        const otherMember = getOtherMember(chat.members, req.user as UserType);
        console.log("member", otherMember);
        console.log("Returning Data: ", chat._id, chat.groupChat, chat.name, otherMember?.username)

        return {
            _id: chat._id,
            groupChat: chat.groupChat,
            avatar: chat.groupChat
                ? chat.members?.slice(0, 3).map(({ user }: { user: User }) => user.avatar?.url)
                : [otherMember?.avatar?.url],
            name: chat.groupChat ? chat.name : otherMember?.user?.username,
            members: chat.members?.reduce((prev: any[], curr: any) => {
                if (curr.user && curr.user?._id?.toString() !== req.user) {
                    prev.push(curr.user?._id);
                }
                return prev;
            }, []),
        };
    });


    return res.status(200).json({
        success: true,
        chats: transformedChats,
    });
});


export const getMyGroups = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const chats = await Chat.find({
        "members.user": req.user,
        groupChat: true,
        creator: req.user,
    }).populate("members.user", "username avatar");

    const groups = chats.map((chat: any) => ({
        _id: chat._id,
        groupChat: chat.groupChat,
        name: chat.name,
        avatar: chat.members?.slice(0, 3).map(({ user }: { user: User }) => user.avatar?.url),
    }));

    return res.status(200).json({
        success: true,
        groups,
    });
});

export const addMembers = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const { chatId, members } = req.body;

    const chat = await Chat.findById(chatId);

    if (!chat) return next(new ErrorHandler("Chat not found", 404));

    if (!chat.groupChat)
        return next(new ErrorHandler("This is not a group chat", 400));

    if (!req.user) {
        return next(new ErrorHandler("Please login to do this", 400));
    }


    if (typeof chat !== "undefined" && chat.creator?.toString() !== req.user?.toString())
        return next(new ErrorHandler("You are not allowed to add members", 403));

    const allNewMembersPromise = members.map((i: string) => User.findById(i, "username"));

    const allNewMembers = await Promise.all(allNewMembersPromise);

    const existingMember = allNewMembers.find(member => chat.members?.some(existing => existing.user.toString() === member._id.toString()));

    console.log(allNewMembers);

    if (existingMember) {
        throw new Error(`Member '${existingMember.username}' is already present in the chat.`);
    }

    const transformedMembers = allNewMembers.map((member: { _id: string }) => ({ user: member?._id }));

    chat.members?.push(...transformedMembers as any);

    if (chat.members !== undefined && chat.members.length > 100)
        return next(new ErrorHandler("Group members limit reached", 400));

    await chat.save();

    const allUsersName = allNewMembers.map((i) => i.username).join(", ");

    // // emitEvent(
    // //     req,
    // //     ALERT,
    // //     chat.members,
    // //     `${allUsersName} has been added in the group`
    // // );

    // // emitEvent(req, REFETCH_CHATS, chat.members);

    return res.status(200).json({
        success: true,
        message: "Members added successfully",
    });
});

export const removeMember = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const { userId, chatId } = req.body;

    // const [chat, userThatWillBeRemoved] = await Promise.all([
    //     Chat.findById(chatId),
    //     User.findById(userId, "name"),
    // ]);
    const chat = await Chat.findById(chatId);
    const userToBeRemoved = await User.findById(userId, "username");

    if (!userToBeRemoved) {
        return next(new ErrorHandler("User not found", 404));
    }

    if (!chat) return next(new ErrorHandler("Chat not found", 404));

    if (!chat.groupChat)
        return next(new ErrorHandler("This is not a group chat", 400));

    if (chat.creator?.toString() !== req.user?.toString())
        return next(new ErrorHandler("You are not allowed to add members", 403));

    if (typeof chat.members !== "undefined" && chat.members.length <= 3)
        return next(new ErrorHandler("Group must have at least 3 members", 400));

    const allChatMembers = chat.members?.map((i) => i.user.toString());

    chat.members = chat.members?.filter(
        (member) => member.user.toString() !== userId.toString()
    );


    await chat.save();

    // emitEvent(req, ALERT, chat.members, {
    //     message: `${userToBeRemoved?.username} has been removed from the group`,
    //     chatId,
    // });

    // emitEvent(req, REFETCH_CHATS, allChatMembers);

    return res.status(200).json({
        success: true,
        message: `Member removed successfully`,
    });
});

export const leaveGroup = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const chatId = req.params.id;

    const chat = await Chat.findById(chatId);

    if (!chat) return next(new ErrorHandler("Chat not found", 404));

    if (!chat.groupChat)
        return next(new ErrorHandler("This is not a group chat", 400));

    const remainingMembers = chat.members?.filter(
        (member) => member.user.toString() !== req.user?.toString()
    );

    if (typeof remainingMembers !== "undefined" && remainingMembers.length < 3)
        return next(new ErrorHandler("Group must have at least 3 members", 400));

    if (typeof chat.creator !== "undefined" && chat.creator?.toString() === req.user?.toString()) {
        const randomElement = Math.floor(Math.random() * (typeof remainingMembers !== "undefined" ? remainingMembers.length : 0));
        const newCreator = remainingMembers !== undefined && remainingMembers[randomElement];
        // @ts-ignore
        chat.creator = newCreator;
    }

    chat.members = remainingMembers;

    const user = await User.findById(req.user, "username");
    await chat.save();

    // const [user] = await Promise.all([
    //     User.findById(req.user, "name"),
    //     chat.save(),
    // ]);

    // emitEvent(req, ALERT, chat.members, {
    //     chatId,
    //     message: `User ${user.username} has left the group`,
    // });

    return res.status(200).json({
        success: true,
        message: "Leave Group Successfully",
    });
});

export const sendAttachments = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const { chatId } = req.body;

    const files = req.files || [];

    if (Number(files.length) < 1)
        return next(new ErrorHandler("Please Upload Attachments", 400));

    if (Number(files.length) > 5)
        return next(new ErrorHandler("Files Can't be more than 5", 400));

    // const [chat, me] = await Promise.all([
    //     Chat.findById(chatId),
    //     User.findById(req.user, "name"),
    // ]);

    const chat = await Chat.findById(chatId);
    const user = await User.findById(req.user, "username");

    if (!chat) return next(new ErrorHandler("Chat not found", 404));

    if (!user) return next(new ErrorHandler("User not found", 404));

    //   Upload files here
    const attachments = await uploadFilesToCloudinary({ files: files as any, userId: user?._id });

    const messageForDB = {
        content: "",
        attachments,
        sender: user._id,
        chat: chatId,
    };

    const messageForRealTime = {
        ...messageForDB,
        sender: {
            _id: user._id,
            username: user.username,
        },
    };

    const message = await Message.create(messageForDB);

    // emitEvent(req, NEW_MESSAGE, chat.members, {
    //     message: messageForRealTime,
    //     chatId,
    // });

    // emitEvent(req, NEW_MESSAGE_ALERT, chat.members, { chatId });

    return res.status(200).json({
        success: true,
        message,
    });
});

//get chat details
export const getChatDetails = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    if (req.query.populate === "true") {
        const chat = await Chat.findById(req.params.id)
            .populate("members.user", "username avatar")
            .lean();

        if (!chat) return next(new ErrorHandler("Chat not found", 404));

        if (typeof chat.members !== "undefined" && chat.members) {
            //@ts-ignore
            chat.members = chat.members.map((m: any) => ({
                _id: m.user._id,
                username: m.user?.username,
                avatar: m.user.avatar?.url,
                ...m
            }));
        }

        return res.status(200).json({
            success: true,
            chat,
        });
    } else {
        const chat = await Chat.findById(req.params.id);
        if (!chat) return next(new ErrorHandler("Chat not found", 404));

        return res.status(200).json({
            success: true,
            chat,
        });
    }
});

// Rename Group
export const renameGroup = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const chatId = req.params.id;
    const { name } = req.body;

    const chat = await Chat.findById(chatId);

    if (!chat) return next(new ErrorHandler("Chat not found", 404));

    if (!chat.groupChat)
        return next(new ErrorHandler("This is not a group chat", 400));

    if (chat.creator.toString() !== req.user?.toString())
        return next(
            new ErrorHandler("You are not allowed to rename the group", 403)
        );

    chat.name = name;

    await chat.save();

    // emitEvent(req, REFETCH_CHATS, chat.members);

    return res.status(200).json({
        success: true,
        message: "Group renamed successfully",
    });
});

export const deleteChat = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const chatId = req.params.id;

    const chat = await Chat.findById(chatId);

    if (!chat) return next(new ErrorHandler("Chat not found", 404));

    const members = chat.members;

    if (!req.user?._id) {
        return next(new ErrorHandler("Please login to access this", 400));
    }

    if (chat.groupChat && chat.creator.toString() !== req.user?._id.toString())
        return next(
            new ErrorHandler("You are not allowed to delete the group", 403)
        );

    if (!chat.groupChat && chat.members && !chat.members.some((member) => member.user.toString() === req.user?.toString())) {
        return next(
            new ErrorHandler("You are not allowed to delete the chat", 403)
        );
    }

    const messagesWithAttachments = await Message.find({
        chat: chatId,
        attachments: { $exists: true, $ne: [] },
    });

    const public_ids: string[] = [];

    messagesWithAttachments.forEach(({ attachments }) =>
        attachments?.forEach(({ public_id }) => public_ids.push(public_id))
    );

    await Promise.all([
        deleteFilesFromCloudinary(public_ids),
        chat.deleteOne(),
        Message.deleteMany({ chat: chatId }),
    ]);

    // emitEvent(req, REFETCH_CHATS, members);

    return res.status(200).json({
        success: true,
        message: "Chat deleted successfully",
    });
});

// get messages
export const getMessages = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const chatId = req.params.id;
    const { page = 1 } = req.query;

    const resultPerPage = 20;
    const skip = (Number(page) - 1) * resultPerPage;

    const chat = await Chat.findById(chatId);

    if (!chat) return next(new ErrorHandler("Chat not found", 404));

    if (chat.members && !chat.members.some((member) => member.user.toString() === req.user?.toString()))
        return next(
            new ErrorHandler("You are not allowed to access this chat", 403)
        );

    // const [messages, totalMessagesCount] = await Promise.all([
    //     Message.find({ chat: chatId })
    //         .sort({ createdAt: -1 })
    //         .skip(skip)
    //         .limit(resultPerPage)
    //         .populate("sender", "name")
    //         .lean(),
    //     Message.countDocuments({ chat: chatId }),
    // ]);

    const messages = await Message.find({ chat: chatId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(resultPerPage)
        .populate("sender", "name")
        .lean();
    const totalMessagesCount = await Message.countDocuments({ chat: chatId });

    const totalPages = Math.ceil(totalMessagesCount / resultPerPage) || 0;

    return res.status(200).json({
        success: true,
        messages: messages.reverse(),
        totalPages,
    });
});

export const togglePinChat = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const chatId = req.params.id;

    try {
        const chat = await Chat.findById(chatId);

        if (!chat || !chat.members) {
            return next(new ErrorHandler("Chat not found", 404));
        }

        const userIndex = chat.members.findIndex(member => member.user.toString() === req.user?.toString());

        if (userIndex === -1) {
            return next(new ErrorHandler("You are not a member of this chat", 403));
        }

        // Toggle the pinned status for the user
        chat.members[userIndex].pinned = !chat.members[userIndex].pinned;

        await chat.save();

        const pinStatus = chat.members[userIndex].pinned ? 'pinned' : 'unpinned';

        return res.status(200).json({
            success: true,
            message: `Chat ${pinStatus} successfully`,
            pinned: chat.members[userIndex].pinned,
        });
    } catch (error) {
        return next(new Error('Could not toggle pin status'));
    }
});

export const toggleArchiveChat = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const chatId = req.params.id;

    try {
        const chat = await Chat.findById(chatId);

        if (!chat || !chat.members) {
            return next(new ErrorHandler("Chat not found", 404));
        }

        const userIndex = chat.members.findIndex(member => member.user.toString() === req.user?.toString());

        if (userIndex === -1) {
            return next(new ErrorHandler("You are not a member of this chat", 403));
        }

        // Toggle the archieve status for the user
        chat.members[userIndex].archieved = !chat.members[userIndex].archieved;

        await chat.save();

        const archieveStatus = chat.members[userIndex].archieved ? 'archieved' : 'unarchieved';

        return res.status(200).json({
            success: true,
            message: `Chat ${archieveStatus} successfully`,
            archieved: chat.members[userIndex].archieved,
        });
    } catch (error) {
        return next(new Error('Could not toggle archieved status'));
    }
});

export const toggleMutedChat = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const chatId = req.params.id;

    try {
        const chat = await Chat.findById(chatId);

        if (!chat || !chat.members) {
            return next(new ErrorHandler("Chat not found", 404));
        }

        const userIndex = chat.members.findIndex(member => member.user.toString() === req.user?.toString());

        if (userIndex === -1) {
            return next(new ErrorHandler("You are not a member of this chat", 403));
        }

        // Toggle the mute status for the user
        chat.members[userIndex].muted = !chat.members[userIndex].muted;

        await chat.save();

        const mutedStatus = chat.members[userIndex].muted ? 'Muted' : 'Unmuted';

        return res.status(200).json({
            success: true,
            message: `Chat ${mutedStatus} successfully`,
            archieved: chat.members[userIndex].muted,
        });
    } catch (error) {
        return next(new Error('Could not toggle muted status'));
    }
});

// Getting Pinned Chats
export const getMyPinnedChats = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const chats = await Chat.find({
        "members.user": req.user,
        "members.pinned": true
    })
        .populate({ path: "members.user", select: "username avatar" })
        .exec();


    if (chats.length < 1) {
        return next(new ErrorHandler("You haven't Pinned Any Chat Yet.", 400));
    }

    const transformedChats = chats.map((chat: any) => {
        const otherMember = getOtherMember(chat?.members, req.user as UserType);
        console.log("member", otherMember);
        console.log("Returning Data: ", chat?._id, chat?.groupChat, chat?.name, otherMember?.username)

        return {
            _id: chat?._id,
            groupChat: chat?.groupChat,
            avatar: chat?.groupChat
                ? chat.members?.slice(0, 3).map(({ user }: { user: User }) => user.avatar?.url)
                : [otherMember?.avatar?.url],
            name: chat.groupChat ? chat.name : otherMember?.user?.username,
            members: chat.members?.reduce((prev: any[], curr: any) => {
                if (curr.user && curr.user?._id?.toString() !== req.user) {
                    prev.push(curr.user?._id);
                }
                return prev;
            }, []),
        };
    });

    return res.status(200).json({
        success: true,
        chats: transformedChats,
    });
});

export const getMyArchievedChats = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const chats = await Chat.find({
        "members.user": req.user,
        "members.archieved": true
    })
        .populate({ path: "members.user", select: "username avatar" })
        .exec();


    if (chats.length < 1) {
        return next(new ErrorHandler("You haven't Archieved any Chat Yet.", 400));
    }


    const transformedChats = chats.map((chat: any) => {
        const otherMember = getOtherMember(chat?.members, req.user as UserType);

        return {
            _id: chat?._id,
            groupChat: chat?.groupChat,
            avatar: chat?.groupChat
                ? chat.members?.slice(0, 3).map(({ user }: { user: User }) => user.avatar?.url)
                : [otherMember?.avatar?.url],
            name: chat.groupChat ? chat.name : otherMember?.user?.username,
            members: chat.members?.reduce((prev: any[], curr: any) => {
                if (curr.user && curr.user?._id?.toString() !== req.user) {
                    prev.push(curr.user?._id);
                }
                return prev;
            }, []),
        };
    });


    return res.status(200).json({
        success: true,
        chats: transformedChats,
    });
});

export const getMyMutedChats = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const chats = await Chat.find({
        "members.user": req.user,
        "members.muted": true
    })
        .populate({ path: "members.user", select: "username avatar" })
        .exec();


    if (chats.length < 1) {
        return next(new ErrorHandler("You haven't Muted any Chat Yet.", 400));
    }


    const transformedChats = chats.map((chat: any) => {
        const otherMember = getOtherMember(chat?.members, req.user as UserType);

        return {
            _id: chat?._id,
            groupChat: chat?.groupChat,
            avatar: chat?.groupChat
                ? chat.members?.slice(0, 3).map(({ user }: { user: User }) => user.avatar?.url)
                : [otherMember?.avatar?.url],
            name: chat.groupChat ? chat.name : otherMember?.user?.username,
            members: chat.members?.reduce((prev: any[], curr: any) => {
                if (curr.user && curr.user?._id?.toString() !== req.user) {
                    prev.push(curr.user?._id);
                }
                return prev;
            }, []),
        };
    });


    return res.status(200).json({
        success: true,
        chats: transformedChats,
    });
});