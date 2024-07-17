import { NextFunction, Request, Response } from "express";
import { catchAsyncError } from "../middlewares/catchAsyncErrors";
import Chat from "../models/chat.model";
import { getOtherMember } from "../lib/helpers";
import { UserType } from "../middlewares/auth";
import { ErrorHandler } from "../utils/errorHandler";
import User from "../models/user.model";
import { deleteFilesFromCloudinary, emitEvent, uploadFilesToCloudinary } from "../utils/features";
import Message from "../models/message.model";
import { ALERT, NEW_MESSAGE, NEW_MESSAGE_ALERT, REFETCH_CHATS } from "../constants/events";

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

    emitEvent(req, ALERT, allMembers, `Welcome to ${name} group`);
    emitEvent(req, REFETCH_CHATS, members);

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
        .populate({ path: "members.user", select: "username avatar bio" })
        .exec();

    const transformedChats = chats.map((chat: any) => {
        const otherMember = getOtherMember(chat.members, req.user as UserType);
        return {
            _id: chat._id,
            groupChat: chat.groupChat,
            avatar: chat.groupChat
                ? chat.members?.slice(0, 3).map(({ user }: { user: User }) => user.avatar?.url)
                : [otherMember.user.avatar?.url],
            name: chat.groupChat ? chat.name : otherMember?.user?.username,
            members: chat.members,
            creator: chat?.creator
        };
    });


    return res.status(200).json({
        success: true,
        chats: transformedChats,
    });
});

export const getMySingleChats = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const chats = await Chat.find({ "members.user": req.user, groupChat: false })
        .populate({ path: "members.user", select: "username avatar bio" })
        .exec();

    const transformedChats = chats.map((chat: any) => {
        const otherMember = getOtherMember(chat.members, req.user as UserType);
        return {
            _id: chat._id,
            groupChat: chat.groupChat,
            avatar: chat.groupChat
                ? chat.members?.slice(0, 3).map(({ user }: { user: User }) => user.avatar?.url)
                : [otherMember.user.avatar?.url],
            name: chat.groupChat ? chat.name : otherMember?.user?.username,
            members: chat.members,
            creator: chat?.creator,
        };
    });

    return res.status(200).json({
        success: true,
        chats: transformedChats,
    });
});

export const getAllNonBlockedAndArchievedChats = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const chats = await Chat.find({ "members.user": req.user, "members.isBlocked": false, "members.isArchieved": false })
        .populate({ path: "members.user", select: "username avatar bio" })
        .exec();

    const transformedChats = chats.map((chat: any) => {
        const otherMember = getOtherMember(chat.members, req.user as UserType);
        return {
            _id: chat._id,
            groupChat: chat.groupChat,
            avatar: chat.groupChat
                ? chat.members?.slice(0, 3).map(({ user }: { user: User }) => user.avatar?.url)
                : [otherMember.user.avatar?.url],
            name: chat.groupChat ? chat.name : otherMember?.user?.username,
            members: chat.members,
            creator: chat?.creator,
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
    }).populate("members.user", "username avatar bio");

    const groups = chats.map((chat: any) => ({
        _id: chat._id,
        groupChat: chat.groupChat,
        name: chat.name,
        avatar: chat.members?.slice(0, 3).map(({ user }: { user: User }) => user.avatar?.url),
        members: chat.members,
        creator: chat?.creator,
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

    const user = await User.findById(req?.user);

    if (!user) {
        return next(new ErrorHandler("Please login to do this", 400));
    }


    if (typeof chat !== "undefined" && chat.creator?.toString() !== req.user?.toString())
        return next(new ErrorHandler("Only Group Admin is allowed to add members", 403));

    const allNewMembersPromise = members.map((i: string) => User.findById(i, "username"));

    const allNewMembers = await Promise.all(allNewMembersPromise);

    const existingMember = allNewMembers.find(member => chat.members?.some(existing => existing.user?._id?.toString() === member?._id.toString()));

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

    const messageForRealTime = {
        content: `${allUsersName} has been added in the group`,
        chatId: chatId,
        message_type: "ACTION",
        sender: {
            _id: user?._id,
            username: user?.username,
            avatar: user?.avatar,
        },
        createdAt: new Date().toISOString(),
    }

    emitEvent(req, NEW_MESSAGE, chat.members, {
        chatId,
        message: messageForRealTime,
    });

    await Message.create(messageForRealTime);

    emitEvent(req, REFETCH_CHATS, chat.members);

    return res.status(200).json({
        success: true,
        message: `${allUsersName} Members added successfully`,
    });
});

export const removeMember = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const { userId, chatId } = req.body;

    const user2 = await User.findById(req.user);

    const chat = await Chat.findById(chatId);
    const userToBeRemoved = await User.findById(userId, "username");

    if (!userToBeRemoved) {
        return next(new ErrorHandler("User not found", 404));
    }

    if (!chat) return next(new ErrorHandler("Chat not found", 404));

    if (!chat.groupChat)
        return next(new ErrorHandler("This is not a group chat", 400));

    if (chat.creator?.toString() !== req.user?.toString())
        return next(new ErrorHandler("Only Group Admin are allowed to Remove members", 403));

    if (typeof chat.members !== "undefined" && chat.members.length <= 3)
        return next(new ErrorHandler("Group must have at least 3 members", 400));

    const allChatMembers = chat.members?.map((i) => i.user.toString());

    chat.members = chat.members?.filter(
        (member) => member.user.toString() !== userId.toString()
    );

    await chat.save();

    const messageForRealTime = {
        content: `${userToBeRemoved?.username} has been removed from the group`,
        chatId: chatId,
        message_type: "ACTION",
        sender: {
            _id: user2?._id,
            username: user2?.username,
            avatar: user2?.avatar,
        },
        createdAt: new Date().toISOString(),
    }

    emitEvent(req, NEW_MESSAGE, chat.members, {
        chatId,
        message: messageForRealTime,
    });

    await Message.create(messageForRealTime);

    // emitEvent(req, ALERT, chat.members, {
    //     message: `${userToBeRemoved?.username} has been removed from the group`,
    //     chatId,
    // });

    emitEvent(req, REFETCH_CHATS, allChatMembers);

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
    const messageForRealTime = {
        content: `User ${user?.username} has left the group`,
        chatId: chatId,
        message_type: "ACTION",
        sender: {
            _id: user?._id,
            username: user?.username,
            avatar: user?.avatar,
        },
        createdAt: new Date().toISOString(),
    }

    emitEvent(req, NEW_MESSAGE, chat.members, {
        chatId,
        message: messageForRealTime,
    });

    await Message.create(messageForRealTime);

    return res.status(200).json({
        success: true,
        message: "Leave Group Successfully",
    });
});

export const sendAttachments = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const { chatId, caption = "", message_type } = req.body;

    const files = req.files || [];

    console.log("body", req.body, chatId, message_type, "files", files)

    if (Number(files.length) < 1)
        return next(new ErrorHandler("Please Upload Attachments", 400));

    if (Number(files.length) > 5)
        return next(new ErrorHandler("Files Can't be more than 5", 400));

    const chat = await Chat.findById(chatId);
    const user = await User.findById(req.user, "username avatar bio");

    if (!chat) return next(new ErrorHandler("Chat not found", 404));

    if (!user) return next(new ErrorHandler("User not found", 404));

    //   Upload files here
    const attachments = await uploadFilesToCloudinary({ files: files as any, userId: user?._id, message_type });

    console.log(attachments)

    const messageForDB = {
        attachments,
        message_type,
        sender: user._id,
        chatId: chatId,
        caption: caption
    };

    const messageForRealTime = {
        ...messageForDB,
        sender: {
            _id: user._id,
            username: user.username,
            avatar: user.avatar,
        },
    };

    const message = await Message.create(messageForDB);

    emitEvent(req, NEW_MESSAGE, chat.members, {
        message: messageForRealTime,
        chatId,
    });

    emitEvent(req, NEW_MESSAGE_ALERT, chat.members, { chatId });

    return res.status(200).json({
        success: true,
        message,
        response: `${message_type} send successfully.`
    });
});

//get chat details
export const getChatDetails = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    if (req.query.populate === "true") {
        const chat = await Chat.findById(req.params.id)
            .populate("members.user", "username avatar bio")
            .lean();

        if (!chat) return next(new ErrorHandler("Chat not found", 404));

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
            new ErrorHandler("Only Group Admin are allowed to rename the group", 403)
        );

    chat.name = name;

    await chat.save();

    emitEvent(req, REFETCH_CHATS, chat.members);

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

    emitEvent(req, REFETCH_CHATS, members);

    return res.status(200).json({
        success: true,
        message: "Chat deleted successfully",
    });
});

// get messages
export const getMessages = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const chatId = req.params.id;
    const { page = 1 } = req.query;

    console.log(chatId, page);

    const resultPerPage = 100;
    const skip = (Number(page) - 1) * resultPerPage;

    const chat = await Chat.findById(chatId);

    if (!chat) return next(new ErrorHandler("Chat not found", 404));

    if (chat.members && !chat.members.some((member) => member.user.toString() === req.user?.toString()))
        return next(
            new ErrorHandler("You are not allowed to access this chat", 403)
        );

    const messages = await Message.find({ chatId: chatId })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(resultPerPage)
        .populate("sender", "username avatar _id bio")
        .lean();
    const totalMessagesCount = await Message.countDocuments({ chatId: chatId });

    const totalPages = Math.ceil(totalMessagesCount / resultPerPage) || 0;

    return res.status(200).json({
        success: true,
        messages: messages,
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
        chat.members[userIndex].isPinned = !chat.members[userIndex].isPinned;

        await chat.save();

        const pinStatus = chat.members[userIndex].isPinned ? 'pinned' : 'unpinned';

        return res.status(200).json({
            success: true,
            message: `Chat ${pinStatus} successfully`,
            isPinned: chat.members[userIndex].isPinned,
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
        chat.members[userIndex].isArchieved = !chat.members[userIndex].isArchieved;

        await chat.save();

        const archieveStatus = chat.members[userIndex].isArchieved ? 'archieved' : 'unarchieved';

        return res.status(200).json({
            success: true,
            message: `Chat ${archieveStatus} successfully`,
            isArchieved: chat.members[userIndex].isArchieved,
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
        chat.members[userIndex].isMuted = !chat.members[userIndex].isMuted;

        await chat.save();

        const mutedStatus = chat.members[userIndex].isMuted ? 'Muted' : 'Unmuted';

        return res.status(200).json({
            success: true,
            message: `Chat ${mutedStatus} successfully`,
            isMuted: chat.members[userIndex].isMuted,
        });
    } catch (error) {
        return next(new Error('Could not toggle muted status'));
    }
});

export const toggleBlockedChat = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const chatId = req.params.id;

    try {
        const chat = await Chat.findById(chatId);

        if (!chat || !chat.members) {
            return next(new ErrorHandler("Chat not found", 404));
        }

        if (chat.groupChat === true) {
            return next(new ErrorHandler("Blocking Groups are not allowed", 400));
        }

        const userIndex = chat.members.findIndex(member => member.user.toString() === req.user?.toString());

        if (userIndex === -1) {
            return next(new ErrorHandler("You are not a member of this chat", 403));
        }

        // Toggle the mute status for the user
        chat.members[userIndex].isBlocked = !chat.members[userIndex].isBlocked;

        await chat.save();

        const mutedStatus = chat.members[userIndex].isMuted ? 'Blocked' : 'UnBlocked';

        return res.status(200).json({
            success: true,
            message: `Chat ${mutedStatus} successfully`,
            isBlocked: chat.members[userIndex].isBlocked,
        });
    } catch (error: any) {
        return next(new ErrorHandler(error?.message, 500));
    }
});

// Getting Pinned Chats
export const getMyPinnedChats = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const chats = await Chat.find({
        "members.user": req.user,
        "members.isPinned": true
    })
        .populate({ path: "members.user", select: "username avatar bio" })
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
            members: chat?.members
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
        "members.isArchieved": true
    })
        .populate({ path: "members.user", select: "username avatar bio" })
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
            members: chat.members,
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
        "members.isMuted": true
    })
        .populate({ path: "members.user", select: "username avatar bio" })
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
            members: chat.members,
        };
    });


    return res.status(200).json({
        success: true,
        chats: transformedChats,
    });
});

export const getMyBlockedChats = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const chats = await Chat.find({
        "members.user": req.user,
        "members.isBlocked": true,
        "groupChat": false,
    })
        .populate({ path: "members.user", select: "username avatar bio" })
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
            members: chat.members,
        };
    });


    return res.status(200).json({
        success: true,
        chats: transformedChats,
    });
});