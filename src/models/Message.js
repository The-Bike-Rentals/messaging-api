const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    // Which channel this message was sent/received via
    channel: {
      type: String,
      enum: ['whatsapp', 'email', 'sms'],
      required: true,
    },
    sessionId: { type: String, default: null }, // WhatsApp sessionId
    direction: { type: String, enum: ['outbound', 'inbound'], required: true },

    // Sender / recipient
    from: { type: String, default: '' },
    to: { type: String, default: '' }, // phone/email address

    // Content
    messageType: {
      type: String,
      enum: [
        'text', 'image', 'video', 'audio', 'document', 'sticker',
        'location', 'contact', 'reaction', 'poll', 'html', 'template',
      ],
      default: 'text',
    },
    body: { type: String, default: '' },
    caption: { type: String, default: '' },
    subject: { type: String, default: '' }, // email subject
    mediaUrl: { type: String, default: '' }, // for media messages
    mimetype: { type: String, default: '' },
    fileName: { type: String, default: '' },

    // WhatsApp-specific
    waMessageId: { type: String, default: '' },
    quotedMessageId: { type: String, default: '' },
    isGroup: { type: Boolean, default: false },
    groupId: { type: String, default: '' },
    mentions: [{ type: String }],

    // Status tracking
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
      default: 'pending',
    },
    errorMessage: { type: String, default: '' },

    // Raw Baileys message object (for inbound)
    rawPayload: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

messageSchema.index({ channel: 1, sessionId: 1 });
messageSchema.index({ waMessageId: 1 });
messageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
