import { Schema, model, Types } from 'mongoose';
import { MessageInterface } from '../types';

const messageSchema = new Schema<MessageInterface>({
  content: {
    type: String,
  },
  message_type: {
    type: String,
    enum: ['IMAGE', 'VIDEO', 'DOCUMENT', 'EMOJI', 'STICKER', 'TEXT', 'UNKNOWN', 'ACTION'],
    default: 'TEXT'
  },
  attachments: [{
    public_id: {
      type: String,
    },
    url: {
      type: String,
    },
    caption: {
      type: String,
    }
  }],
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  chatId: {
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
  reactions: {
    type: String,
  }
}, {
  timestamps: true,
});

const Message = model<MessageInterface>('Message', messageSchema);

export default Message;
