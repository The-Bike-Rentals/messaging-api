/**
 * Email Service
 * Uses Nodemailer. Reads active config from DB; falls back to .env values.
 */
const nodemailer = require('nodemailer');
const EmailConfig = require('../models/EmailConfig');
const Message = require('../models/Message');
const config = require('../config');
const logger = require('../utils/logger');

let _transporter = null;

async function _getTransporter(overrides = {}) {
  // Try to load active config from DB
  const dbCfg = await EmailConfig.findOne({ isActive: true }).sort({ updatedAt: -1 });

  const cfg = {
    host: overrides.host || dbCfg?.host || config.email.host,
    port: overrides.port || dbCfg?.port || config.email.port,
    secure: overrides.secure !== undefined ? overrides.secure : (dbCfg?.secure ?? config.email.secure),
    auth: {
      user: overrides.user || dbCfg?.user || config.email.user,
      pass: overrides.pass || dbCfg?.pass || config.email.pass,
    },
  };

  return nodemailer.createTransport(cfg);
}

/**
 * Send an email.
 * @param {Object} opts - { to, subject, text, html, from, attachments }
 */
async function sendEmail(opts) {
  const { to, subject, text = '', html = '', from, attachments = [] } = opts;
  if (!to) throw new Error('Email recipient (to) is required');
  if (!subject) throw new Error('Email subject is required');
  if (!text && !html) throw new Error('Email body (text or html) is required');

  const dbCfg = await EmailConfig.findOne({ isActive: true }).sort({ updatedAt: -1 });
  const fromAddr = from || dbCfg?.from || config.email.from;

  const transporter = await _getTransporter();
  const info = await transporter.sendMail({
    from: fromAddr,
    to,
    subject,
    text,
    html,
    attachments,
  });

  // Persist message record
  await Message.create({
    channel: 'email',
    direction: 'outbound',
    from: fromAddr,
    to,
    messageType: html ? 'html' : 'text',
    subject,
    body: text || html,
    fileName: attachments.length ? attachments.map((a) => a.filename).join(', ') : '',
    status: 'sent',
  });

  logger.info({ to, subject, messageId: info.messageId }, 'Email sent');
  return info;
}

/**
 * Verify email configuration is valid.
 */
async function verifyConnection(cfgOverrides = {}) {
  const transporter = await _getTransporter(cfgOverrides);
  return transporter.verify();
}

module.exports = { sendEmail, verifyConnection };
