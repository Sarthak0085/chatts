import { Document, Types, Schema } from "mongoose";

export interface UserInterface extends Document {
    username: string;
    email: string;
    bio?: string;
    password: string;
    avatar: {
        public_id: string;
        url: string;
    };
    createdAt: Date;
    updatedAt: Date;
}

export interface RequestInterface extends Document {
    status: 'pending' | 'accepted' | 'rejected';
    sender: Types.ObjectId | string;
    receiver: Types.ObjectId | string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ChatInterface extends Document {
    name: string;
    groupChat?: boolean;
    creator: object;
    members?: Array<{ user: Types.ObjectId | UserInterface, pinned: boolean, archieved: boolean; muted: boolean }>;
    archived?: Array<Types.ObjectId | string>;
    mutedUsers?: Array<Types.ObjectId | string>;
}

export interface MessageInterface {
    content?: string;
    attachments?: Array<{
        type: string; // Type of attachment (e.g., 'image', 'audio', 'video', 'document', 'emoji', 'sticker')
        public_id: string;
        url: string;
    }>;
    sender: Types.ObjectId | string;
    chat: Types.ObjectId | string;
    isDelivered?: boolean;
    isRead?: boolean;
    isEdited?: boolean;
    isDeleted?: boolean;
}

export type User = {
    _id: string;
    username: string;
    email: string;
    bio: string;
    password: string;
    avatar: {
        public_id: string;
        url: string;
    }
    createdAt: Date;
    updatedAt: Date;
}