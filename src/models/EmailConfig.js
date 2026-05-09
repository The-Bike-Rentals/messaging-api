const mongoose = require('mongoose');

const emailConfigSchema = new mongoose.Schema(
  {
    name: { type: String, default: 'default' },
    host: { type: String, required: true },
    port: { type: Number, default: 587 },
    secure: { type: Boolean, default: false },
    user: { type: String, default: '' },
    pass: { type: String, default: '' },
    from: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmailConfig', emailConfigSchema);
