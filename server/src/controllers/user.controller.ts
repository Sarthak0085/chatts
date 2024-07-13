//@ts-nocheck
import { NextFunction, Request, Response } from "express";
import { catchAsyncError } from "../middlewares/catchAsyncErrors";
import { ErrorHandler } from "../utils/errorHandler";
import User from "../models/user.model";
import { cookieOptions, sendToken } from "../utils/sendToken";
import { uploadFilesToCloudinary } from "../utils/features";
import { compare } from "bcrypt";
import { CHATTS_TOKEN } from "../constants/config";
import Chat from "../models/chat.model";
import RequestModal from "../models/request.model";
import { getOtherMember } from "../lib/helpers";

// Create a new user and save it to the database and save token in cookie
export const createUser = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  const { email, username, password, bio } = req.body;

  const file = req.file;

  if (!file) return next(new ErrorHandler("Please Upload Avatar", 400));

  console.log(username, email, password, bio, file);

  const result = await uploadFilesToCloudinary({ files: [file], isAvatar: true, username: username, email: email });

  const avatar = {
    public_id: result && result[0].public_id,
    url: result && result[0].url,
  };

  const user = await User.create({
    email,
    bio,
    username,
    password,
    avatar,
  });

  sendToken(res, user, 201, "User created Successfully");
});

// Login user and save token in cookie
export const loginUser = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;
  console.log(email, password);
  try {
    const user = await User.findOne({ email }).select("+password");

    if (!user) return next(new ErrorHandler("Invalid Email and Password", 404));

    const isMatch = await compare(password, user.password);

    if (!isMatch)
      return next(new ErrorHandler("Invalid Email and Password", 404));

    sendToken(res, user, 200, `Welcome Back, ${user.username}`);
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// get user data
export const getMyProfile = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  const user = await User.findById(req.user);

  if (!user) return next(new ErrorHandler("User not found", 404));

  res.status(200).json({
    success: true,
    user,
  });
});

export const logout = catchAsyncError(async (req: Request, res: Response) => {
  return res
    .status(200)
    .cookie(CHATTS_TOKEN, "", { ...cookieOptions, maxAge: 0 })
    .json({
      success: true,
      message: "Logged out successfully",
    });
});

export const searchUser = catchAsyncError(async (req: Request, res: Response) => {
  const { username = "" } = req.query;

  // Finding All my chats
  const myChats = await Chat.find({ groupChat: false, "members.user": req.user });

  //  extracting All Users from my chats means friends or people I have chatted with
  const allUsersFromMyChats = myChats.flatMap((chat) => chat.members.user);

  // Finding all users except me and my friends
  const allUsersExceptMeAndFriends = await User.find({
    _id: { $nin: allUsersFromMyChats },
    username: { $regex: username, $options: "i" },
  });

  // // Modifying the response
  const users = allUsersExceptMeAndFriends.map(({ _id, username, avatar }) => ({
    _id,
    username,
    avatar: avatar?.url,
  }));

  return res.status(200).json({
    success: true,
    users,
  });
});

export const sendFriendRequest = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = req.body;

  const request = await RequestModal.findOne({
    $or: [
      { sender: req.user, receiver: userId },
      { sender: userId, receiver: req.user },
    ],
  });

  // console.log(request);

  if (request) return next(new ErrorHandler("Request already sent", 400));

  await RequestModal.create({
    sender: req.user,
    receiver: userId,
  });

  // emitEvent(req, NEW_REQUEST, [userId]);

  return res.status(200).json({
    success: true,
    message: "Friend Request Sent",
  });
});

export const acceptFriendRequest = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  console.log(req.body);
  const { requestId, accept } = req.body;

  const request = await RequestModal.findById(requestId)
    .populate("sender", "username")
    .populate("receiver", "username")
    .exec();

  if (!request) return next(new ErrorHandler("Request not found", 404));

  if (request.receiver._id.toString() !== req.user?.toString())
    return next(
      new ErrorHandler("You are not authorized to accept this request", 401)
    );

  if (!accept) {
    await request.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Friend Request Rejected",
    });
  }

  const members = [{ user: request.sender._id }, { user: request.receiver._id }];

  await Promise.all([
    Chat.create({
      members,
      name: `${request.sender.username}-${request.receiver.username}`,
    }),
    request.deleteOne(),
  ]);

  // emitEvent(req, REFETCH_CHATS, members);

  return res.status(200).json({
    success: true,
    message: "Friend Request Accepted",
    senderId: request.sender._id,
  });
});

export const getMyNotifications = catchAsyncError(async (req: Request, res: Response) => {
  const requests = await RequestModal.find({ receiver: req.user }).populate(
    "sender",
    "username avatar"
  );


  const allRequests = requests.map(({ _id, sender }) => ({
    _id,
    sender: {
      _id: sender._id,
      username: sender.username,
      avatar: sender.avatar?.url,
    },
  }));

  return res.status(200).json({
    success: true,
    allRequests,
  });
});

export const getMyFriends = catchAsyncError(async (req: Request, res: Response) => {
  const chatId = req.query.chatId;

  const chats = await Chat.find({
    "members.user": req.user,
    groupChat: false,
  }).populate("members.user", "username avatar");

  const friends = chats.map(({ members }) => {
    const otherUser = getOtherMember(members, req.user);

    return {
      _id: otherUser?._id,
      username: otherUser?.username,
      avatar: otherUser?.avatar?.url,
    };
  });

  if (chatId) {
    const chat = await Chat.findById(chatId);

    const availableFriends = friends.filter(
      (friend) => !chat.members.includes({ user: friend?._id })
    );

    return res.status(200).json({
      success: true,
      friends: availableFriends,
    });
  } else {
    return res.status(200).json({
      success: true,
      friends,
    });
  }
});
