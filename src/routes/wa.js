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
const { requireApiKey } = require('../middleware/apiKey');
const { detectFileType } = require('../utils/fileType');
const logger = require('../utils/logger');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 64 * 1024 * 1024 },
});

// All routes in this file require the API key
router.use(requireApiKey);

// ─── Helper: normalise JID ─────────────────────────────────────────────────
function normaliseJid(jid, type) {
  if (!jid) throw new Error('jid is required');
  if (jid.includes('@')) return jid; // already has @suffix
  const digits = jid.replace(/\D/g, '');
  if (type === 'group') return `${digits}@g.us`;
  return `${digits}@s.whatsapp.net`;
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
      type      = 'individual',
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

module.exports = router;
