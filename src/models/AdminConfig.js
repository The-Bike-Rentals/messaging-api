const mongoose = require('mongoose');

const adminConfigSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AdminConfig', adminConfigSchema);
