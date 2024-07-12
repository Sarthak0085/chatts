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
      pinned: {
        type: Boolean,
        default: false
      },
      archieved: {
        type: Boolean,
        default: false
      },
      muted: {
        type: Boolean,
        default: false,
      },
    }
  ],
  mutedUsers: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
  }],
}, {
  timestamps: true,
});

const Chat = model<ChatInterface>('Chat', chatSchema);

export default Chat;
