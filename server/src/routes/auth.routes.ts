import { Router } from "express";
import { singleAvatar } from "../middlewares/multer";
import { loginValidator, registerValidator, validateHandler } from "../lib/validators";
import { createUser, loginUser } from "../controllers/user.controller";

const authRouter = Router();

authRouter.post("/register", singleAvatar, registerValidator(), validateHandler, createUser);
authRouter.post("/login", loginValidator(), validateHandler, loginUser);

export default authRouter;