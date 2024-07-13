import { Schema, model, Types } from 'mongoose';
import { ChatInterface } from '../types';

const chatSchema = new Schema<ChatInterface>({
  name: {
    type: String,
    required: true,
  },
  groupChat: {
    type: Boolean,
    default: false,
  },
  creator: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  members: [
    {
      user: {
        type: Types.ObjectId,
        ref: "User",
      },
      isPinned: {
        type: Boolean,
        default: false
      },
      isArchieved: {
        type: Boolean,
        default: false
      },
      isMuted: {
        type: Boolean,
        default: false,
      },
      isBlocked: {
        type: Boolean,
        default: false,
      }
    }
  ],
}, {
  timestamps: true,
});

const Chat = model<ChatInterface>('Chat', chatSchema);

export default Chat;
