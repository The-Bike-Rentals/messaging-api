const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    label: { type: String, default: '' },
    phoneNumber: { type: String, default: '' },
    status: {
      type: String,
      enum: ['initializing', 'qr_pending', 'connected', 'disconnected', 'logged_out'],
      default: 'initializing',
    },
    pushName: { type: String, default: '' },
    platform: { type: String, default: '' },
    qrCode: { type: String, default: '' }, // base64 QR image (transient – cleared on connect)
    lastSeen: { type: Date, default: null },
    retryCount: { type: Number, default: 0 },
    webhookUrl: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Session', sessionSchema);
