require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/message-api',
  sessionSecret: process.env.SESSION_SECRET || 'change-this-secret',
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    passwordHash: process.env.ADMIN_PASSWORD_HASH || '',
  },
  apiKey: process.env.API_KEY || '',
  whatsapp: {
    maxReconnectRetries: parseInt(process.env.WA_MAX_RECONNECT_RETRIES || '5', 10),
    reconnectIntervalMs: parseInt(process.env.WA_RECONNECT_INTERVAL_MS || '5000', 10),
  },
  email: {
    host: process.env.EMAIL_HOST || '',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
    from: process.env.EMAIL_FROM || '',
  },
  sms: {
    provider: process.env.SMS_PROVIDER || 'generic_http',
    apiUrl: process.env.SMS_API_URL || '',
    apiUsername: process.env.SMS_API_USERNAME || '',
    apiPassword: process.env.SMS_API_PASSWORD || '',
    apiKey: process.env.SMS_API_KEY || '',
    from: process.env.SMS_FROM || '',
  },
};
