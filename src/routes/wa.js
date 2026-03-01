/**
 * WhatsApp Messaging Routes (API-key protected)
 *
 * POST /:sessionId/messages/send
 *   Send text / mentions to a group or individual.
 *
 * POST /:sessionId/send-media/send
 *   Send media (multipart form-data) to a group or individual.
 *   Form fields:
 *     media  – the file
 *     data   – JSON string  { jid, type, message, caption }
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const multer = require('multer');

const wa = require('../services/whatsappService');
const { requireApiKeyOrAdmin } = require('../middleware/apiKey');

const { detectFileType } = require('../utils/fileType');
const logger = require('../utils/logger');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 64 * 1024 * 1024 },
});

// All routes in this file require either an admin session or a valid API key
router.use(requireApiKeyOrAdmin);

// ─── Helper: normalise JID ─────────────────────────────────────────────────
function normaliseJid(jid, type) {
  if (!jid) throw new Error('jid is required');
  if (jid.includes('@')) return jid; // already has @suffix
  const digits = jid.replace(/\D/g, '');
  if (type === 'group') return `${digits}@g.us`;
  return `${digits}@s.whatsapp.net`;
}

function delayMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /:sessionId/messages/send
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:sessionId/messages/send', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { jid, type = 'individual', message = {} } = req.body;

    if (!jid) return res.status(400).json({ success: false, message: 'jid is required' });
    if (!message.text && !message.body)
      return res.status(400).json({ success: false, message: 'message.text is required' });

    const normalised = normaliseJid(jid, type);
    const text       = message.text || message.body || '';
    const mentions   = Array.isArray(message.mentions) ? message.mentions : [];

    const result = await wa.sendText(sessionId, normalised, text, mentions.length ? { mentions } : {});

    return res.json({
      success: true,
      data: {
        messageId: result?.key?.id,
        jid: normalised,
        type,
        status: result?.status || 'PENDING',
      },
    });
  } catch (err) {
    logger.error({ err }, 'messages/send error');
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /:sessionId/messages/send/bulk
// Body: [
//   { jid, type = 'number', delay = 1000, message: { text }, options }
// ]
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:sessionId/messages/send/bulk', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const payload = Array.isArray(req.body) ? req.body : req.body?.messages;

    if (!Array.isArray(payload) || payload.length === 0) {
      return res.status(400).json({ success: false, message: 'request body must be a non-empty array of messages' });
    }

    const results = [];
    const errors = [];

    for (const [index, item] of payload.entries()) {
      const {
        jid,
        type = 'number',
        delay = 1000,
        message = {},
        options = {},
      } = item || {};

      if (!jid) {
        errors.push({ index, error: 'jid is required' });
        continue;
      }

      const text = message?.text || message?.body || '';
      if (!text) {
        errors.push({ index, error: 'message.text is required' });
        continue;
      }

      try {
        const normalised = normaliseJid(jid, type);

        let exists = false;
        if (type === 'group') {
          try {
            await wa.getGroupMetadata(sessionId, normalised);
            exists = true;
          } catch {
            exists = false;
          }
        } else {
          const check = await wa.checkNumberExists(sessionId, jid);
          exists = check?.exists ?? false;
        }

        if (!exists) {
          errors.push({ index, error: 'JID does not exists' });
          continue;
        }

        if (index > 0) await delayMs(delay);

        await wa.sendPresence(sessionId, normalised, 'available');
        const sent = await wa.sendText(sessionId, normalised, text, options || {});
        results.push({ index, result: sent });
      } catch (err) {
        logger.error({ err, index, sessionId }, 'messages/send/bulk item error');
        errors.push({ index, error: 'An error occured during message send' });
      }
    }

    return res.status(200).json({ success: true, data: { results, errors } });
  } catch (err) {
    logger.error({ err }, 'messages/send/bulk error');
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /:sessionId/send-media/send
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:sessionId/send-media/send', upload.single('media'), async (req, res) => {
  try {
    const { sessionId } = req.params;

    // "data" field can be a JSON string or parsed object (when sent as form field)
    let parsed = {};
    if (req.body.data) {
      try {
        parsed = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
      } catch {
        return res.status(400).json({ success: false, message: 'data field must be valid JSON' });
      }
    }

    const {
      jid,
      type      = 'number',
      message   = '',   // optional hint or override caption
      caption   = '',
    } = parsed;

    if (!jid)      return res.status(400).json({ success: false, message: 'data.jid is required' });
    if (!req.file) return res.status(400).json({ success: false, message: 'media file is required (field name: media)' });

    const normalised = normaliseJid(jid, type);
    const buffer     = req.file.buffer;
    const fileName   = req.file.originalname || 'file';
    const mimeHint   = req.file.mimetype     || 'application/octet-stream';
    const { messageType, mimetype } = detectFileType(fileName, mimeHint);
    const resolvedCaption = caption || (typeof message === 'string' ? message : '') || '';

    let result;

    switch (messageType) {
      case 'image':
        result = await wa.sendImage(sessionId, normalised, buffer, resolvedCaption);
        break;
      case 'video':
        result = await wa.sendVideo(sessionId, normalised, buffer, resolvedCaption);
        break;
      case 'audio':
        result = await wa.sendAudio(sessionId, normalised, buffer, mimetype);
        break;
      case 'document':
      default:
        result = await wa.sendDocument(sessionId, normalised, buffer, fileName, mimetype, resolvedCaption);
        break;
    }

    return res.json({
      success: true,
      data: {
        messageId:   result?.key?.id,
        jid:         normalised,
        type,
        messageType,
        fileName,
        mimetype,
        status: result?.status || 'PENDING',
      },
    });
  } catch (err) {
    logger.error({ err }, 'send-media/send error');
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /:sessionId/misc/exists/:jid/:type
// Check whether a JID exists on WhatsApp.
//   type = "number" → uses onWhatsApp() to verify the number is registered
//   type = "group"      → uses groupMetadata() to verify the group exists
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:sessionId/misc/exists/:jid/:type', async (req, res) => {
  try {
    const { sessionId, jid, type = 'number' } = req.params;

    const normalised = normaliseJid(jid, type);

    if (type === 'group') {
      try {
        await wa.getGroupMetadata(sessionId, normalised);
        const exists = true;
        return res.status(200).json({ exists: exists });
      } catch {
        const exists = false;
        return res.status(200).json({ exists: exists });
      }
    }

    // individual
    const result = await wa.checkNumberExists(sessionId, jid);
    const exists = result?.exists ?? false;
    return res.status(200).json({ exists: exists });
  } catch (err) {
    logger.error({ err }, 'misc/exists error');
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
