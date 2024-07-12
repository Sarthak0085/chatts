import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import { catchAsyncError } from "./catchAsyncErrors.js";
import { ErrorHandler } from "../utils/errorHandler.js";
import { NextFunction, Request, Response } from "express";
import { CHATTS_TOKEN } from "../constants/config";
import { Socket } from "socket.io";
import User from "../models/user.model.js";
import { User as UserTypes } from "../types/index.js";

export interface UserType {
    _id: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: UserType;
        }
    }
}

interface CustomSocket extends Socket {
    user?: UserTypes;
    authToken?: string;
}

export const isAuthenticated = catchAsyncError((req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies[CHATTS_TOKEN];
    if (!token)
        return next(new ErrorHandler("Please login to access this route", 401));

    const decodedData = jwt.verify(token, process.env.JWT_SECRET_KEY as Secret) as JwtPayload;

    if (!decodedData)
        return next(new ErrorHandler("Please login to access this route", 401));

    console.log(decodedData);

    req.user = decodedData._id;

    next();
});

export const socketAuthenticator = async (err: any, socket: CustomSocket, next: NextFunction) => {
    try {
        if (err) return next(new ErrorHandler(err, 400));

        //@ts-ignore
        const authToken = socket.request.cookies[CHATTS_TOKEN]

        if (!authToken)
            return next(new ErrorHandler("Please login to access this route", 401));

        const decodedData = jwt.verify(authToken, process.env.JWT_SECRET_KEY as Secret) as JwtPayload;

        if (!decodedData) {
            return next(new ErrorHandler("Please login to access this route", 401));
        }

        const user = await User.findById(decodedData._id);

        if (!user)
            return next(new ErrorHandler("Please login to access this route", 401));

        socket.user = user as UserTypes;

        return next();
    } catch (error) {
        console.log(error);
        return next(new ErrorHandler("Please login to access this route", 401));
    }
};
