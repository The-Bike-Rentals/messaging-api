const mongoose = require('mongoose');

/**
 * Supports multiple SMS providers:
 *  - twilio      : accountSid + authToken
 *  - vonage      : apiKey + apiSecret
 *  - generic_http: username / password / apiKey via HTTP POST
 */
const smsConfigSchema = new mongoose.Schema(
  {
    name: { type: String, default: 'default' },
    provider: {
      type: String,
      enum: ['twilio', 'vonage', 'generic_http'],
      default: 'generic_http',
    },
    apiUrl: { type: String, default: '' },
    apiUsername: { type: String, default: '' }, // twilio: accountSid | vonage: apiKey | generic: username
    apiPassword: { type: String, default: '' }, // twilio: authToken  | vonage: apiSecret | generic: password
    apiKey: { type: String, default: '' },       // additional token if needed by provider
    from: { type: String, default: '' },         // sender ID / phone number
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SmsConfig', smsConfigSchema);
