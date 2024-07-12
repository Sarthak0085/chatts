import { Schema, Types, model } from "mongoose";
import { RequestInterface } from "../types";

const requestSchema = new Schema<RequestInterface>(
  {
    status: {
      type: String,
      default: "pending",
      enum: ["pending", "accepted", "rejected"],
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const RequestModal = model<RequestInterface>('Request', requestSchema);

export default RequestModal;