import dotenv from "dotenv";
import { Schema, model } from "mongoose";
import bcrypt from 'bcrypt';
import { UserInterface } from "../types";

dotenv.config();

const userSchema = new Schema<UserInterface>({
    username: {
        type: String,
        required: [true, "Please enter your username"],
        trim: true,
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        trim: true,
        lowercase: true,
    },
    bio: {
        type: String,
        default: "I am using chat-app 🦾🐱‍🚀",
    },
    password: {
        type: String,
        trim: true,
        required: [true, "Password is required"],
        minLength: [8, "Password must be of 8 length"],
        match: [
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$!%*?&])[A-Za-z\d@#$!%*?&]{8,}$/,
            "Password must contain atleast one uppercase, lowercase character, digit and special character",
        ],
        select: false,
    },
    avatar: {
        public_id: {
            type: String,
            required: true
        },
        url: {
            type: String,
            required: true
        },
    },
}, {
    timestamps: true,
})

//hash password before saving
userSchema.pre<UserInterface>('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }
    this.password = await bcrypt.hash(this.password, 15);
    next();
});

const User = model<UserInterface>("User", userSchema);

export default User;