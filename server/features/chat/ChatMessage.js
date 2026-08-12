const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', required: true, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  content: { type: String, required: true },
  isRecalled: { type: Boolean, default: false },
  fileUrl: { type: String },
  fileName: { type: String },
  fileSize: { type: Number },
  fileType: { type: String },
  replyTo: {
    messageId: { type: String },
    senderName: { type: String },
    content: { type: String }
  }
}, { timestamps: true });

mongoose.model('ChatMessage', chatMessageSchema);
