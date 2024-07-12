import { Router } from "express";
import authRouter from "./auth.routes";
import userRouter from "./user.routes";
import chatRouter from "./chat.routes";

const router = Router();

// Authentication Routes
router.use("/auth", authRouter);

// User Routes
router.use("/user", userRouter);

// Chat Routes
router.use("/chat", chatRouter);

export default router;