/**
 * Unified Send API  – POST /api/send
 *
 * Supports both JSON body and multipart/form-data (for file attachments).
 *
 * Fields:
 *   channel       whatsapp | email | sms
 *   to            phone number or email address
 *   sessionId     WhatsApp session ID (required for whatsapp)
 *   messageType   text | image | video | audio | document | location | contact | sticker
 *                 (auto-detected from uploaded file if omitted)
 *   text          Message body / caption
 *   caption       Alias for text when sending media
 *   subject       Email subject
 *   html          Email HTML body
 *   mediaBase64   Base64-encoded file content (alternative to file upload)
 *   mediaUrl      Remote URL to fetch file from (alternative to file upload)
 *   mimetype      Override detected MIME type
 *   fileName      Override detected file name
 *   lat/lng/locationName  Location fields
 *   contactName/contactPhone  Contact card fields
 *
 * Multipart: attach file as field name "file"
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const wa = require('../services/whatsappService');
const emailSvc = require('../services/emailService');
const smsSvc = require('../services/smsService');
const { detectFileType } = require('../utils/fileType');
const logger = require('../utils/logger');
const { requireApiKeyOrAdmin } = require('../middleware/apiKey');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 64 * 1024 * 1024 }, // 64 MB max
});

router.post('/', requireApiKeyOrAdmin, upload.single('file'), async (req, res) => {
  try {
    const {
      channel,
      to,
      text = '',
      sessionId,
      mediaBase64,
      mediaUrl,
      subject,
      html,
      // WhatsApp extras
      lat, lng, locationName,
      contactName, contactPhone,
    } = req.body;

    if (!channel) return res.status(400).json({ success: false, message: 'channel is required' });
    if (!to)      return res.status(400).json({ success: false, message: 'to is required' });

    // ── Resolve media buffer from: uploaded file > base64 > remote URL ──────
    let buffer = null;
    let resolvedFileName = req.body.fileName || 'file';
    let resolvedMimetype = req.body.mimetype || 'application/octet-stream';

    if (req.file) {
      buffer            = req.file.buffer;
      resolvedFileName  = req.body.fileName || req.file.originalname || 'file';
      resolvedMimetype  = req.body.mimetype  || req.file.mimetype     || 'application/octet-stream';
    } else if (mediaBase64) {
      buffer = Buffer.from(mediaBase64, 'base64');
    } else if (mediaUrl) {
      const resp = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
      buffer           = Buffer.from(resp.data);
      resolvedFileName = req.body.fileName || path.basename(mediaUrl.split('?')[0]) || 'file';
      // try to get content-type header
      resolvedMimetype = req.body.mimetype || resp.headers['content-type'] || 'application/octet-stream';
    }

    // ── Auto-detect messageType & mimetype from file name / mimetype header ─
    const detected      = detectFileType(resolvedFileName, resolvedMimetype);
    const messageType   = req.body.messageType || (buffer ? detected.messageType : 'text');
    const mimetype      = resolvedMimetype !== 'application/octet-stream' ? resolvedMimetype : detected.mimetype;
    const fileName      = resolvedFileName;

    // Caption: accept either "caption" or "text" field for media messages
    const caption = req.body.caption || (messageType !== 'text' ? text : '') || '';

    let result;

    switch (channel) {
      case 'whatsapp': {
        if (!sessionId) return res.status(400).json({ success: false, message: 'sessionId is required for whatsapp' });
        const jid = to.includes('@') ? to : `${to.replace(/\D/g, '')}@s.whatsapp.net`;

        switch (messageType) {
          case 'text':
            result = await wa.sendText(sessionId, jid, text);
            break;
          case 'image':
            if (!buffer) return res.status(400).json({ success: false, message: 'file, mediaBase64 or mediaUrl required for image' });
            result = await wa.sendImage(sessionId, jid, buffer, caption);
            break;
          case 'video':
            if (!buffer) return res.status(400).json({ success: false, message: 'file, mediaBase64 or mediaUrl required for video' });
            result = await wa.sendVideo(sessionId, jid, buffer, caption);
            break;
          case 'audio':
            if (!buffer) return res.status(400).json({ success: false, message: 'file, mediaBase64 or mediaUrl required for audio' });
            result = await wa.sendAudio(sessionId, jid, buffer, mimetype);
            break;
          case 'document':
            if (!buffer) return res.status(400).json({ success: false, message: 'file, mediaBase64 or mediaUrl required for document' });
            result = await wa.sendDocument(sessionId, jid, buffer, fileName, mimetype, caption);
            break;
          case 'sticker':
            if (!buffer) return res.status(400).json({ success: false, message: 'file, mediaBase64 or mediaUrl required for sticker' });
            result = await wa.sendSticker(sessionId, jid, buffer);
            break;
          case 'location':
            result = await wa.sendLocation(sessionId, jid, parseFloat(lat), parseFloat(lng), locationName);
            break;
          case 'contact':
            result = await wa.sendContact(sessionId, jid, contactName, contactPhone);
            break;
          default:
            return res.status(400).json({ success: false, message: `Unknown messageType: ${messageType}` });
        }
        break;
      }

      case 'email': {
        // Build attachments array: uploaded file, base64, or URL
        const attachments = [];
        if (buffer && fileName) {
          attachments.push({
            filename: fileName,
            content: buffer,
            contentType: mimetype,
          });
        }
        // Additional attachments array from JSON body
        if (Array.isArray(req.body.attachments)) {
          for (const att of req.body.attachments) {
            if (att.base64 && att.fileName) {
              attachments.push({
                filename: att.fileName,
                content: Buffer.from(att.base64, 'base64'),
                contentType: att.mimetype || detectFileType(att.fileName).mimetype,
              });
            } else if (att.url && att.fileName) {
              const r = await axios.get(att.url, { responseType: 'arraybuffer' });
              attachments.push({
                filename: att.fileName,
                content: Buffer.from(r.data),
                contentType: att.mimetype || r.headers['content-type'] || 'application/octet-stream',
              });
            }
          }
        }
        result = await emailSvc.sendEmail({
          to,
          subject: subject || '(No subject)',
          text: html ? '' : text,
          html: html || '',
          attachments,
        });
        break;
      }

      case 'sms': {
        result = await smsSvc.sendSms(to, text);
        break;
      }

      default:
        return res.status(400).json({ success: false, message: `Unknown channel: ${channel}` });
    }

    return res.json({ success: true, result });
  } catch (err) {
    logger.error({ err }, 'Unified send error');
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
