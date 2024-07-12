import { config } from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import app from "./app";
import connectToDB from "./lib/connectToDB";
import { createServer } from "http";
import { createUser } from "./seeders/user.seeder";
import { createSingleChats } from "./seeders/chat.seeder";
import { Server, Socket } from "socket.io";
import { corsOptions } from "./constants/config";
import cookieParser from "cookie-parser";
import { CorsOptions } from "cors";
import { User } from "./types";
import { CHAT_JOINED, CHAT_LEAVED, NEW_MESSAGE, NEW_MESSAGE_ALERT, ONLINE_USERS, START_TYPING, STOP_TYPING } from "./constants/events";
import { v4 as uuid } from "uuid";
import Message from "./models/message.model";
import { getSockets } from "./lib/helpers";
import { socketAuthenticator } from "./middlewares/auth";
import { NextFunction } from "express";

interface CustomSocket extends Socket {
    user?: User;
    authToken?: string;
}

config({
    path: "../.env"
});

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_SECRET_KEY,
});

const port = Number(process.env.PORT) || 4000;
export const userSocketIDs: Map<string, string> = new Map();
const onlineUsers: Set<string> = new Set();

// createUser(10);

// createSingleChats(10);

const server = createServer(app);
const io = new Server(server, {}
    //     {
    //     cors: corsOptions as CorsOptions,
    // }
);

// app.set("io", io);


//@ts-ignore
// io.use((socket: any, next: NextFunction) => {
//     cookieParser()(socket.request as any, socket.request.res, async (err) => {
//         if (err) {
//             console.error('Error parsing cookies:', err);
//             return next(err);
//         }
//         await socketAuthenticator(err, socket, next);
//     });
// });

io.on("connection", (socket: CustomSocket) => {
    console.log("connected");
    const user = socket.user as User;
    // const user = { _id: "7shdjksh", username: "sarthak" }
    userSocketIDs.set(user._id.toString(), socket.id);

    socket.on(NEW_MESSAGE, async ({ chatId, members, message }) => {
        const messageForRealTime = {
            content: message,
            _id: uuid(),
            sender: {
                _id: user._id,
                username: user.username,
            },
            chat: chatId,
            createdAt: new Date().toISOString(),
        };

        const messageForDB = {
            content: message,
            sender: user._id,
            chat: chatId,
        };

        console.log(messageForRealTime, messageForDB);

        // const membersSocket = getSockets(members);
        // io.to(membersSocket as unknown as string).emit(NEW_MESSAGE, {
        //     chatId,
        //     message: messageForRealTime,
        // });
        // io.to(membersSocket as unknown as string).emit(NEW_MESSAGE_ALERT, { chatId });

        // try {
        //     await Message.create(messageForDB);
        // } catch (error: any) {
        //     throw new Error(error.message);
        // }
    });

    socket.on(START_TYPING, ({ members, chatId }) => {
        const membersSockets = getSockets(members);
        socket.to(membersSockets as unknown as string).emit(START_TYPING, { chatId });
    });

    socket.on(STOP_TYPING, ({ members, chatId }) => {
        const membersSockets = getSockets(members);
        socket.to(membersSockets as unknown as string).emit(STOP_TYPING, { chatId });
    });

    socket.on(CHAT_JOINED, ({ userId, members }) => {
        onlineUsers.add(userId.toString());

        const membersSocket = getSockets(members);
        io.to(membersSocket as unknown as string).emit(ONLINE_USERS, Array.from(onlineUsers));
    });

    socket.on(CHAT_LEAVED, ({ userId, members }) => {
        onlineUsers.delete(userId.toString());

        const membersSocket = getSockets(members);
        io.to(membersSocket as unknown as string).emit(ONLINE_USERS, Array.from(onlineUsers));
    });

    socket.on("disconnect", () => {
        userSocketIDs.delete(user._id.toString());
        onlineUsers.delete(user._id.toString());
        socket.broadcast.emit(ONLINE_USERS, Array.from(onlineUsers));
    });
});

server.listen(port, () => {
    console.log(`The server is running on the port :http://localhost:${port}`);
    connectToDB();
})