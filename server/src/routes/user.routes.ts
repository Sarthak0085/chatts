import { Router } from "express";
import { isAuthenticated } from "../middlewares/auth";
import { acceptFriendRequest, getMyFriends, getMyNotifications, getMyProfile, logout, searchUser, sendFriendRequest } from "../controllers/user.controller";
import { acceptRequestValidator, sendRequestValidator, validateHandler } from "../lib/validators";

const userRouter = Router();


userRouter.use(isAuthenticated);

userRouter.get("/me", getMyProfile);

userRouter.get("/logout", logout);

userRouter.get("/search", searchUser);

userRouter.put(
  "/sendrequest",
  sendRequestValidator(),
  validateHandler,
  sendFriendRequest
);

userRouter.put(
  "/acceptrequest",
  acceptRequestValidator(),
  validateHandler,
  acceptFriendRequest
);

userRouter.get("/notifications", getMyNotifications);

userRouter.get("/friends", getMyFriends);

export default userRouter;