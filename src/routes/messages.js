/**
 * Messages History Route  –  /api/messages
 */
const express = require('express');
const router = express.Router();
const Message = require('../models/Message');

/** GET /api/messages  – paginated message history */
router.get('/', async (req, res) => {
  try {
    const { channel, sessionId, direction, jid, limit = 50, skip = 0 } = req.query;
    const filter = {};
    if (channel) filter.channel = channel;
    if (sessionId) filter.sessionId = sessionId;
    if (direction) filter.direction = direction;
    if (jid) {
      const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
      filter.$or = [{ from: normalizedJid }, { to: normalizedJid }];
    }

    const [messages, total] = await Promise.all([
      Message.find(filter).sort({ createdAt: -1 }).skip(parseInt(skip)).limit(parseInt(limit)),
      Message.countDocuments(filter),
    ]);
    res.json({ success: true, data: messages, total, skip: parseInt(skip), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/messages/:id */
router.get('/:id', async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
    res.json({ success: true, data: message });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
