import { Types } from "mongoose";
import { UserType } from "../middlewares/auth";
import { userSocketIDs } from "..";
import { User } from "../types";

interface Member {
    user: Types.ObjectId | string;
}

export const getOtherMember = (members: any, userId: UserType) =>
    members.find((member: any) => member.user?._id.toString() !== userId.toString());


export const getSockets = (users = []): (string | undefined)[] => {
    const sockets = users?.map((u: { user: User }) => userSocketIDs.get(u?.user?._id?.toString()));

    return sockets;
};

export const getBase64 = (file: { mimetype: string; buffer: Buffer }): string =>
    `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;