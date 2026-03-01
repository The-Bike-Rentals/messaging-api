/**
 * SMS Service
 * Supports: Twilio, Vonage (Nexmo), Generic HTTP POST provider.
 * Active config is loaded from DB; falls back to .env.
 */
const axios = require('axios');
const SmsConfig = require('../models/SmsConfig');
const Message = require('../models/Message');
const config = require('../config');
const logger = require('../utils/logger');

async function _getConfig(overrides = {}) {
  const dbCfg = await SmsConfig.findOne({ isActive: true }).sort({ updatedAt: -1 });
  return {
    provider: overrides.provider || dbCfg?.provider || config.sms.provider,
    apiUrl: overrides.apiUrl || dbCfg?.apiUrl || config.sms.apiUrl,
    apiUsername: overrides.apiUsername || dbCfg?.apiUsername || config.sms.apiUsername,
    apiPassword: overrides.apiPassword || dbCfg?.apiPassword || config.sms.apiPassword,
    apiKey: overrides.apiKey || dbCfg?.apiKey || config.sms.apiKey,
    from: overrides.from || dbCfg?.from || config.sms.from,
  };
}

/**
 * Send an SMS.
 * @param {string} to   - Recipient phone number (E.164: +1234567890)
 * @param {string} text - Message body
 */
async function sendSms(to, text, overrides = {}) {
  if (!to) throw new Error('SMS recipient (to) is required');
  if (!text) throw new Error('SMS body is required');

  const cfg = await _getConfig(overrides);

  let result;

  switch (cfg.provider) {
    case 'twilio':
      result = await _sendViaTwilio(cfg, to, text);
      break;
    case 'vonage':
      result = await _sendViaVonage(cfg, to, text);
      break;
    case 'generic_http':
    default:
      result = await _sendViaGenericHttp(cfg, to, text);
      break;
  }

  await Message.create({
    channel: 'sms',
    direction: 'outbound',
    from: cfg.from,
    to,
    messageType: 'text',
    body: text,
    status: 'sent',
  });

  logger.info({ to, provider: cfg.provider }, 'SMS sent');
  return result;
}

// ─── Twilio ───────────────────────────────────────────────────────────────────
async function _sendViaTwilio(cfg, to, body) {
  const accountSid = cfg.apiUsername;
  const authToken = cfg.apiPassword;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({ To: to, From: cfg.from, Body: body });
  const resp = await axios.post(url, params.toString(), {
    auth: { username: accountSid, password: authToken },
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return resp.data;
}

// ─── Vonage (Nexmo) ───────────────────────────────────────────────────────────
async function _sendViaVonage(cfg, to, text) {
  const resp = await axios.post('https://rest.nexmo.com/sms/json', {
    api_key: cfg.apiUsername,
    api_secret: cfg.apiPassword,
    from: cfg.from,
    to: to.replace('+', ''),
    text,
  });
  if (resp.data.messages?.[0]?.status !== '0') {
    throw new Error(`Vonage error: ${resp.data.messages?.[0]?.['error-text']}`);
  }
  return resp.data;
}

// ─── Generic HTTP POST ────────────────────────────────────────────────────────
async function _sendViaGenericHttp(cfg, to, text) {
  if (!cfg.apiUrl) throw new Error('SMS API URL is not configured');
  const payload = {
    to,
    from: cfg.from,
    message: text,
    ...(cfg.apiUsername && { username: cfg.apiUsername }),
    ...(cfg.apiPassword && { password: cfg.apiPassword }),
    ...(cfg.apiKey && { api_key: cfg.apiKey }),
  };
  const resp = await axios.post(cfg.apiUrl, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  return resp.data;
}

module.exports = { sendSms };
