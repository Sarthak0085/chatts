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
    members?: Array<{ user: Types.ObjectId | UserInterface, isPinned: boolean, isArchieved: boolean; isMuted: boolean; isBlocked: boolean }>;
}

export interface MessageInterface {
    content?: string;
    attachments?: Array<{
        type: string; // Type of attachment (e.g., 'image', 'audio', 'video', 'document', 'emoji', 'sticker')
        public_id: string;
        url: string;
    }>;
    sender: Types.ObjectId | string;
    chatId: Types.ObjectId | string;
    isDelivered?: boolean;
    isRead?: boolean;
    isEdited?: boolean;
    isDeleted?: boolean;
    reactions?: string;
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