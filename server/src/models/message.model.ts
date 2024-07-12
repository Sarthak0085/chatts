import { Schema, model, Types } from 'mongoose';
import { MessageInterface } from '../types';

const messageSchema = new Schema<MessageInterface>({
  content: {
    type: String,
  },
  attachments: [{
    // type: {
    //   type: String,
    //   enum: ['image', 'audio', 'video', 'document', 'emoji', 'sticker'],
    //   required: true,
    // },
    public_id: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
  }],
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  chat: {
    type: Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
  },
  isDelivered: {
    type: Boolean,
    default: false,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  isEdited: {
    type: Boolean,
    default: false,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

const Message = model<MessageInterface>('Message', messageSchema);

export default Message;
