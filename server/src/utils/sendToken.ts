import { Response } from "express";
import jwt from "jsonwebtoken";
import { CookieOptions } from "express";

// interface CookieOptions {
//   maxAge: number; // milliseconds
//   signed?: boolean;
//   expires?: Date | string | number;
//   httpOnly?: boolean;
//   path?: string;
//   domain?: string;
//   secure?: boolean | 'auto';
//   sameSite?: boolean | 'lax' | 'strict' | 'none';
// }

export const cookieOptions: CookieOptions = {
  maxAge: 15 * 24 * 60 * 60 * 1000,
  sameSite: "none",
  httpOnly: true,
  secure: true,
};

type User = {
  _id: string;
  username: string;
  email: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const sendToken = (res: Response, user: User, code: number, message: string) => {
  const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET_KEY as string);

  return res.status(code).cookie("chat-token", token, cookieOptions).json({
    success: true,
    user,
    message,
  });
};