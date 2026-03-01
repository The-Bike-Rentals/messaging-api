/**
 * WhatsApp Routes  –  /api/whatsapp/*
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const wa = require('../services/whatsappService');
const Session = require('../models/Session');
const Message = require('../models/Message');
const logger = require('../utils/logger');
const { requireApiKeyOrAdmin } = require('../middleware/apiKey');

// All routes require either an admin session or a valid API key
router.use(requireApiKeyOrAdmin);

const upload = multer({ storage: multer.memoryStorage() });

// ─── Sessions ─────────────────────────────────────────────────────────────────

/** List all sessions */
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await Session.find({}).sort({ createdAt: -1 });
    const liveIds = wa.getAllSessionIds();
    const data = sessions.map((s) => ({
      ...s.toObject(),
      isLive: liveIds.includes(s.sessionId),
    }));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Create / connect a new session */
router.post('/sessions', async (req, res) => {
  try {
    const { sessionId, label, webhookUrl } = req.body;
    if (!sessionId) return res.status(400).json({ success: false, message: 'sessionId is required' });
    const session = await wa.createSession(sessionId, label, webhookUrl);
    res.json({ success: true, data: session });
  } catch (err) {
    logger.error({ err }, 'Create session error');
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Get a single session */
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const session = await Session.findOne({ sessionId: req.params.sessionId });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    const liveInfo = wa.getSessionInfo(req.params.sessionId);
    res.json({ success: true, data: { ...session.toObject(), liveInfo } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Logout and delete session */
router.delete('/sessions/:sessionId', async (req, res) => {
  try {
    await wa.deleteSession(req.params.sessionId);
    res.json({ success: true, message: 'Session deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Logout a session (keep DB record) */
router.post('/sessions/:sessionId/logout', async (req, res) => {
  try {
    await wa.logoutSession(req.params.sessionId);
    res.json({ success: true, message: 'Session logged out' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Reconnect / restart a session */
router.post('/sessions/:sessionId/reconnect', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findOne({ sessionId });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    await wa.createSession(sessionId, session.label, session.webhookUrl);
    res.json({ success: true, message: 'Session reconnecting' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Messaging ────────────────────────────────────────────────────────────────

/** Send text */
router.post('/sessions/:sessionId/messages/text', async (req, res) => {
  try {
    const { jid, text, mentionedJids } = req.body;
    if (!jid || !text) return res.status(400).json({ success: false, message: 'jid and text required' });
    const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
    const msg = await wa.sendText(req.params.sessionId, normalizedJid, text, mentionedJids ? { mentions: mentionedJids } : {});
    res.json({ success: true, data: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Send image */
router.post('/sessions/:sessionId/messages/image', upload.single('file'), async (req, res) => {
  try {
    const { jid, caption } = req.body;
    if (!jid) return res.status(400).json({ success: false, message: 'jid required' });
    let buffer;
    if (req.file) buffer = req.file.buffer;
    else if (req.body.base64) buffer = Buffer.from(req.body.base64, 'base64');
    else return res.status(400).json({ success: false, message: 'file or base64 required' });
    const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
    const msg = await wa.sendImage(req.params.sessionId, normalizedJid, buffer, caption || '');
    res.json({ success: true, data: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Send video */
router.post('/sessions/:sessionId/messages/video', upload.single('file'), async (req, res) => {
  try {
    const { jid, caption } = req.body;
    if (!jid) return res.status(400).json({ success: false, message: 'jid required' });
    let buffer;
    if (req.file) buffer = req.file.buffer;
    else if (req.body.base64) buffer = Buffer.from(req.body.base64, 'base64');
    else return res.status(400).json({ success: false, message: 'file or base64 required' });
    const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
    const msg = await wa.sendVideo(req.params.sessionId, normalizedJid, buffer, caption || '');
    res.json({ success: true, data: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Send audio */
router.post('/sessions/:sessionId/messages/audio', upload.single('file'), async (req, res) => {
  try {
    const { jid, ptt = false, mimetype = 'audio/mp4' } = req.body;
    if (!jid) return res.status(400).json({ success: false, message: 'jid required' });
    let buffer;
    if (req.file) buffer = req.file.buffer;
    else if (req.body.base64) buffer = Buffer.from(req.body.base64, 'base64');
    else return res.status(400).json({ success: false, message: 'file or base64 required' });
    const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
    const msg = await wa.sendAudio(req.params.sessionId, normalizedJid, buffer, mimetype, ptt === 'true' || ptt === true);
    res.json({ success: true, data: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Send document */
router.post('/sessions/:sessionId/messages/document', upload.single('file'), async (req, res) => {
  try {
    const { jid, fileName = 'file', mimetype = 'application/octet-stream', caption = '' } = req.body;
    if (!jid) return res.status(400).json({ success: false, message: 'jid required' });
    let buffer;
    if (req.file) buffer = req.file.buffer;
    else if (req.body.base64) buffer = Buffer.from(req.body.base64, 'base64');
    else return res.status(400).json({ success: false, message: 'file or base64 required' });
    const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
    const msg = await wa.sendDocument(req.params.sessionId, normalizedJid, buffer, fileName, mimetype, caption);
    res.json({ success: true, data: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Send sticker */
router.post('/sessions/:sessionId/messages/sticker', upload.single('file'), async (req, res) => {
  try {
    const { jid } = req.body;
    if (!jid) return res.status(400).json({ success: false, message: 'jid required' });
    let buffer;
    if (req.file) buffer = req.file.buffer;
    else if (req.body.base64) buffer = Buffer.from(req.body.base64, 'base64');
    else return res.status(400).json({ success: false, message: 'file or base64 required' });
    const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
    const msg = await wa.sendSticker(req.params.sessionId, normalizedJid, buffer);
    res.json({ success: true, data: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Send location */
router.post('/sessions/:sessionId/messages/location', async (req, res) => {
  try {
    const { jid, lat, lng, name = '' } = req.body;
    if (!jid || lat === undefined || lng === undefined)
      return res.status(400).json({ success: false, message: 'jid, lat, lng required' });
    const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
    const msg = await wa.sendLocation(req.params.sessionId, normalizedJid, parseFloat(lat), parseFloat(lng), name);
    res.json({ success: true, data: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Send contact */
router.post('/sessions/:sessionId/messages/contact', async (req, res) => {
  try {
    const { jid, contactName, contactPhone } = req.body;
    if (!jid || !contactName || !contactPhone)
      return res.status(400).json({ success: false, message: 'jid, contactName, contactPhone required' });
    const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
    const msg = await wa.sendContact(req.params.sessionId, normalizedJid, contactName, contactPhone);
    res.json({ success: true, data: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Send reaction */
router.post('/sessions/:sessionId/messages/reaction', async (req, res) => {
  try {
    const { jid, messageId, remoteJid, fromMe, emoji } = req.body;
    if (!jid || !messageId || !emoji)
      return res.status(400).json({ success: false, message: 'jid, messageId, emoji required' });
    const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
    const msg = await wa.sendReaction(req.params.sessionId, normalizedJid, { id: messageId, remoteJid: remoteJid || normalizedJid, fromMe: fromMe === true }, emoji);
    res.json({ success: true, data: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Send poll */
router.post('/sessions/:sessionId/messages/poll', async (req, res) => {
  try {
    const { jid, name, values, selectableCount = 1 } = req.body;
    if (!jid || !name || !Array.isArray(values) || values.length < 2)
      return res.status(400).json({ success: false, message: 'jid, name, values (>=2) required' });
    const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
    const msg = await wa.sendPoll(req.params.sessionId, normalizedJid, name, values, selectableCount);
    res.json({ success: true, data: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Reply to message */
router.post('/sessions/:sessionId/messages/reply', async (req, res) => {
  try {
    const { jid, messageId, remoteJid, fromMe, text } = req.body;
    if (!jid || !messageId || !text)
      return res.status(400).json({ success: false, message: 'jid, messageId, text required' });
    const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
    const msg = await wa.replyMessage(req.params.sessionId, normalizedJid, { id: messageId, remoteJid: remoteJid || normalizedJid, fromMe }, text);
    res.json({ success: true, data: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Delete message */
router.delete('/sessions/:sessionId/messages/:messageId', async (req, res) => {
  try {
    const { jid, remoteJid, fromMe } = req.body;
    if (!jid) return res.status(400).json({ success: false, message: 'jid required' });
    const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
    await wa.deleteMessage(req.params.sessionId, normalizedJid, { id: req.params.messageId, remoteJid: remoteJid || normalizedJid, fromMe });
    res.json({ success: true, message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Edit message */
router.put('/sessions/:sessionId/messages/:messageId', async (req, res) => {
  try {
    const { jid, remoteJid, fromMe, text } = req.body;
    if (!jid || !text) return res.status(400).json({ success: false, message: 'jid and text required' });
    const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
    const msg = await wa.editMessage(req.params.sessionId, normalizedJid, { id: req.params.messageId, remoteJid: remoteJid || normalizedJid, fromMe }, text);
    res.json({ success: true, data: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Mark messages as read */
router.post('/sessions/:sessionId/messages/read', async (req, res) => {
  try {
    const { keys } = req.body; // array of {id, remoteJid, fromMe}
    if (!Array.isArray(keys)) return res.status(400).json({ success: false, message: 'keys array required' });
    await wa.markRead(req.params.sessionId, null, keys);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Presence update */
router.post('/sessions/:sessionId/presence', async (req, res) => {
  try {
    const { jid, type = 'composing' } = req.body;
    if (!jid) return res.status(400).json({ success: false, message: 'jid required' });
    const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
    await wa.sendPresence(req.params.sessionId, normalizedJid, type);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Message history ──────────────────────────────────────────────────────────

/** Get stored messages (from MongoDB) */
router.get('/sessions/:sessionId/messages', async (req, res) => {
  try {
    const { jid, limit = 50, skip = 0, direction } = req.query;
    const filter = { channel: 'whatsapp', sessionId: req.params.sessionId };
    if (jid) {
      const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
      filter.$or = [{ from: normalizedJid }, { to: normalizedJid }];
    }
    if (direction) filter.direction = direction;
    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));
    const total = await Message.countDocuments(filter);
    res.json({ success: true, data: messages, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Get in-memory chat messages */
router.get('/sessions/:sessionId/chats/:jid/messages', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const msgs = await wa.getChatMessages(req.params.sessionId, req.params.jid, parseInt(limit));
    res.json({ success: true, data: msgs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Contacts ─────────────────────────────────────────────────────────────────

router.get('/sessions/:sessionId/contacts', async (req, res) => {
  try {
    const contacts = await wa.getContacts(req.params.sessionId);
    res.json({ success: true, data: contacts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/sessions/:sessionId/contacts/check', async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ success: false, message: 'phone required' });
    const result = await wa.checkNumberExists(req.params.sessionId, phone);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Block contact */
router.post('/sessions/:sessionId/contacts/block', async (req, res) => {
  try {
    const { jid } = req.body;
    const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
    await wa.blockContact(req.params.sessionId, normalizedJid);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Unblock contact */
router.post('/sessions/:sessionId/contacts/unblock', async (req, res) => {
  try {
    const { jid } = req.body;
    const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
    await wa.unblockContact(req.params.sessionId, normalizedJid);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Chats ────────────────────────────────────────────────────────────────────

router.get('/sessions/:sessionId/chats', async (req, res) => {
  try {
    const chats = await wa.getChats(req.params.sessionId);
    res.json({ success: true, data: chats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Profile ──────────────────────────────────────────────────────────────────

router.get('/sessions/:sessionId/profile/picture', async (req, res) => {
  try {
    const { jid } = req.query;
    if (!jid) return res.status(400).json({ success: false, message: 'jid required' });
    const url = await wa.getProfilePicUrl(req.params.sessionId, jid);
    res.json({ success: true, data: { url } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/sessions/:sessionId/profile/picture', upload.single('file'), async (req, res) => {
  try {
    const { jid } = req.body;
    if (!jid || !req.file) return res.status(400).json({ success: false, message: 'jid and file required' });
    const normalizedJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
    await wa.updateProfilePicture(req.params.sessionId, normalizedJid, req.file.buffer);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/sessions/:sessionId/profile/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'status required' });
    await wa.updateProfileStatus(req.params.sessionId, status);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/sessions/:sessionId/profile/name', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name required' });
    await wa.updateProfileName(req.params.sessionId, name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Groups ───────────────────────────────────────────────────────────────────

router.post('/sessions/:sessionId/groups', async (req, res) => {
  try {
    const { subject, participants } = req.body;
    if (!subject || !Array.isArray(participants))
      return res.status(400).json({ success: false, message: 'subject and participants[] required' });
    const group = await wa.createGroup(req.params.sessionId, subject, participants);
    res.json({ success: true, data: group });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/sessions/:sessionId/groups/:groupId', async (req, res) => {
  try {
    const meta = await wa.getGroupMetadata(req.params.sessionId, req.params.groupId);
    res.json({ success: true, data: meta });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/sessions/:sessionId/groups/:groupId/subject', async (req, res) => {
  try {
    const { subject } = req.body;
    await wa.updateGroupSubject(req.params.sessionId, req.params.groupId, subject);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/sessions/:sessionId/groups/:groupId/description', async (req, res) => {
  try {
    const { description } = req.body;
    await wa.updateGroupDescription(req.params.sessionId, req.params.groupId, description);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/sessions/:sessionId/groups/:groupId/participants/add', async (req, res) => {
  try {
    const { participants } = req.body;
    const result = await wa.addGroupParticipants(req.params.sessionId, req.params.groupId, participants);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/sessions/:sessionId/groups/:groupId/participants/remove', async (req, res) => {
  try {
    const { participants } = req.body;
    const result = await wa.removeGroupParticipants(req.params.sessionId, req.params.groupId, participants);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/sessions/:sessionId/groups/:groupId/participants/promote', async (req, res) => {
  try {
    const { participants } = req.body;
    const result = await wa.promoteGroupParticipants(req.params.sessionId, req.params.groupId, participants);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/sessions/:sessionId/groups/:groupId/participants/demote', async (req, res) => {
  try {
    const { participants } = req.body;
    const result = await wa.demoteGroupParticipants(req.params.sessionId, req.params.groupId, participants);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/sessions/:sessionId/groups/:groupId/invite-code', async (req, res) => {
  try {
    const code = await wa.getGroupInviteCode(req.params.sessionId, req.params.groupId);
    res.json({ success: true, data: { code } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/sessions/:sessionId/groups/:groupId/revoke-invite', async (req, res) => {
  try {
    const code = await wa.revokeGroupInvite(req.params.sessionId, req.params.groupId);
    res.json({ success: true, data: { code } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/sessions/:sessionId/groups/join', async (req, res) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) return res.status(400).json({ success: false, message: 'inviteCode required' });
    const result = await wa.joinGroupByInvite(req.params.sessionId, inviteCode);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/sessions/:sessionId/groups/:groupId/leave', async (req, res) => {
  try {
    await wa.leaveGroup(req.params.sessionId, req.params.groupId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Status broadcast ─────────────────────────────────────────────────────────

router.post('/sessions/:sessionId/status/text', async (req, res) => {
  try {
    const { text, backgroundColor, font } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'text required' });
    const msg = await wa.sendTextStatus(req.params.sessionId, text, backgroundColor, font);
    res.json({ success: true, data: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/sessions/:sessionId/status/image', upload.single('file'), async (req, res) => {
  try {
    const { caption = '' } = req.body;
    let buffer;
    if (req.file) buffer = req.file.buffer;
    else if (req.body.base64) buffer = Buffer.from(req.body.base64, 'base64');
    else return res.status(400).json({ success: false, message: 'file or base64 required' });
    const msg = await wa.sendImageStatus(req.params.sessionId, buffer, caption);
    res.json({ success: true, data: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
