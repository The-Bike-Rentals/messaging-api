/**
 * WhatsApp Service
 * Manages multiple Baileys client instances.
 * Auth state is kept in-memory; session metadata is persisted in MongoDB.
 */
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  generateWAMessageFromContent,
  proto,
  getAggregateVotesInPollMessage,
  downloadContentFromMessage,
  jidNormalizedUser,
  areJidsSameUser,
  Browsers,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const Session = require('../models/Session');
const Message = require('../models/Message');
const config = require('../config');
const logger = require('../utils/logger');

// In-memory map: sessionId => { socket, store, authState }
const sessions = new Map();

// Socket.io instance (injected at startup)
let _io = null;
function setIO(io) {
  _io = io;
}

// ─── Auth state directory (per session) ─────────────────────────────────────
function authDir(sessionId) {
  const dir = path.join(__dirname, '../../.sessions', sessionId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── Emit events to connected browser clients ────────────────────────────────
function emit(event, data) {
  if (_io) _io.emit(event, data);
}

// ─── Save message to MongoDB ─────────────────────────────────────────────────
async function persistMessage(sessionId, direction, rawMsg, channel = 'whatsapp') {
  try {
    const key = rawMsg.key || {};
    const msg = rawMsg.message || {};
    const msgType = Object.keys(msg)[0] || 'unknown';

    let body = '';
    let mediaUrl = '';
    let caption = '';
    let mimetype = '';
    let fileName = '';
    let messageType = 'text';

    if (msg.conversation) {
      body = msg.conversation;
      messageType = 'text';
    } else if (msg.extendedTextMessage) {
      body = msg.extendedTextMessage.text || '';
      messageType = 'text';
    } else if (msg.imageMessage) {
      caption = msg.imageMessage.caption || '';
      mimetype = msg.imageMessage.mimetype || '';
      messageType = 'image';
    } else if (msg.videoMessage) {
      caption = msg.videoMessage.caption || '';
      mimetype = msg.videoMessage.mimetype || '';
      messageType = 'video';
    } else if (msg.audioMessage) {
      mimetype = msg.audioMessage.mimetype || '';
      messageType = 'audio';
    } else if (msg.documentMessage) {
      caption = msg.documentMessage.caption || '';
      fileName = msg.documentMessage.fileName || '';
      mimetype = msg.documentMessage.mimetype || '';
      messageType = 'document';
    } else if (msg.stickerMessage) {
      messageType = 'sticker';
    } else if (msg.locationMessage) {
      body = JSON.stringify({
        lat: msg.locationMessage.degreesLatitude,
        lng: msg.locationMessage.degreesLongitude,
        name: msg.locationMessage.name || '',
      });
      messageType = 'location';
    } else if (msg.contactMessage) {
      body = msg.contactMessage.displayName || '';
      messageType = 'contact';
    } else if (msg.reactionMessage) {
      body = msg.reactionMessage.text || '';
      messageType = 'reaction';
    } else if (msg.pollCreationMessage) {
      body = msg.pollCreationMessage.name || '';
      messageType = 'poll';
    }

    const isGroup = key.remoteJid ? key.remoteJid.endsWith('@g.us') : false;

    await Message.create({
      channel,
      sessionId,
      direction,
      from: direction === 'inbound' ? key.remoteJid : key.participant || sessionId,
      to: direction === 'outbound' ? key.remoteJid : '',
      messageType,
      body,
      caption,
      mediaUrl,
      mimetype,
      fileName,
      waMessageId: key.id || '',
      isGroup,
      groupId: isGroup ? key.remoteJid : '',
      status: direction === 'outbound' ? 'sent' : 'delivered',
      rawPayload: rawMsg,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to persist WhatsApp message');
  }
}

// ─── Create a new Baileys session ────────────────────────────────────────────
async function createSession(sessionId, label = '', webhookUrl = '') {
  if (sessions.has(sessionId)) {
    throw new Error(`Session ${sessionId} already exists`);
  }

  // Upsert DB record
  let dbSession = await Session.findOneAndUpdate(
    { sessionId },
    {
      sessionId,
      label,
      webhookUrl,
      status: 'initializing',
      qrCode: '',
      retryCount: 0,
    },
    { upsert: true, new: true }
  );

  await _startSocket(sessionId, dbSession);
  return dbSession;
}

// ─── Internal: start / restart a Baileys socket ──────────────────────────────
async function _startSocket(sessionId, dbSession) {
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState(authDir(sessionId));

  // Simple in-memory store (contacts, chats, messages)
  const store = {
    contacts: {},
    chats: {},
    messages: {},   // jid → [{key, message, ...}]
  };

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: Browsers.macOS('Desktop'),
    syncFullHistory: false,
    markOnlineOnConnect: true,
    getMessage: async (key) => {
      const msgs = store.messages[key.remoteJid];
      if (!msgs) return undefined;
      const found = msgs.find((m) => m.key?.id === key.id);
      return found?.message || undefined;
    },
  });

  sessions.set(sessionId, { sock, store, state });

  // ── Creds ──
  sock.ev.on('creds.update', saveCreds);

  // ── Connection updates ──
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      const qrBase64 = await QRCode.toDataURL(qr);
      await Session.findOneAndUpdate({ sessionId }, { status: 'qr_pending', qrCode: qrBase64 });
      emit('qr', { sessionId, qrCode: qrBase64 });
      logger.info({ sessionId }, 'QR code ready');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error instanceof Boom
        ? lastDisconnect.error.output?.statusCode
        : null;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.warn({ sessionId, statusCode, shouldReconnect }, 'Connection closed');

      if (shouldReconnect) {
        const current = await Session.findOne({ sessionId });
        const retries = (current?.retryCount || 0) + 1;
        if (retries <= config.whatsapp.maxReconnectRetries) {
          await Session.findOneAndUpdate({ sessionId }, { status: 'initializing', retryCount: retries });
          emit('session_status', { sessionId, status: 'initializing', retryCount: retries });
          setTimeout(() => _startSocket(sessionId, current), config.whatsapp.reconnectIntervalMs);
        } else {
          await Session.findOneAndUpdate({ sessionId }, { status: 'disconnected' });
          emit('session_status', { sessionId, status: 'disconnected' });
          sessions.delete(sessionId);
        }
      } else {
        await Session.findOneAndUpdate({ sessionId }, { status: 'logged_out', qrCode: '' });
        emit('session_status', { sessionId, status: 'logged_out' });
        sessions.delete(sessionId);
      }
    }

    if (connection === 'open') {
      const { me } = sock;
      await Session.findOneAndUpdate(
        { sessionId },
        {
          status: 'connected',
          phoneNumber: me?.id ? me.id.split(':')[0] : '',
          pushName: me?.name || '',
          platform: sock.ws?.url || '',
          qrCode: '',
          retryCount: 0,
          lastSeen: new Date(),
        }
      );
      emit('session_status', { sessionId, status: 'connected', me });
      logger.info({ sessionId, me }, 'WhatsApp connected');
    }
  });

  // ── Populate store with contacts & chats ──
  sock.ev.on('contacts.upsert', (contacts) => {
    for (const c of contacts) store.contacts[c.id] = c;
  });
  sock.ev.on('contacts.update', (updates) => {
    for (const u of updates) {
      if (store.contacts[u.id]) Object.assign(store.contacts[u.id], u);
      else store.contacts[u.id] = u;
    }
  });
  sock.ev.on('chats.upsert', (chats) => {
    for (const c of chats) store.chats[c.id] = c;
  });
  sock.ev.on('chats.update', (updates) => {
    for (const u of updates) {
      if (store.chats[u.id]) Object.assign(store.chats[u.id], u);
      else store.chats[u.id] = u;
    }
  });

  // ── Incoming messages ──
  sock.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
    for (const msg of msgs) {
      if (!msg.message) continue;
      // Store in memory
      const jid = msg.key.remoteJid;
      if (jid) {
        if (!store.messages[jid]) store.messages[jid] = [];
        store.messages[jid].push(msg);
        if (store.messages[jid].length > 200) store.messages[jid].shift(); // cap at 200
      }
      const direction = msg.key.fromMe ? 'outbound' : 'inbound';
      await persistMessage(sessionId, direction, msg);
      emit('message', { sessionId, direction, message: msg });
    }
  });

  // ── Message updates (read receipts, status) ──
  sock.ev.on('messages.update', async (updates) => {
    for (const { key, update } of updates) {
      if (update.status !== undefined) {
        const statusMap = { 1: 'sent', 2: 'delivered', 3: 'read', 4: 'read' };
        const newStatus = statusMap[update.status] || 'sent';
        await Message.findOneAndUpdate({ waMessageId: key.id }, { status: newStatus });
      }
    }
  });

  return sock;
}

// ─── Restore all existing sessions from DB on startup ────────────────────────
async function restoreAllSessions() {
  const dbSessions = await Session.find({ status: { $in: ['connected', 'qr_pending', 'initializing', 'disconnected'] } });
  logger.info({ count: dbSessions.length }, 'Restoring WhatsApp sessions');
  for (const s of dbSessions) {
    try {
      await _startSocket(s.sessionId, s);
    } catch (err) {
      logger.error({ err, sessionId: s.sessionId }, 'Failed to restore session');
    }
  }
}

// ─── Delete a session ─────────────────────────────────────────────────────────
async function deleteSession(sessionId) {
  const entry = sessions.get(sessionId);
  if (entry) {
    try { entry.sock.end(undefined); } catch (_) {}
    sessions.delete(sessionId);
  }
  await Session.findOneAndUpdate({ sessionId }, { status: 'logged_out', qrCode: '' });
  // Remove auth files
  const dir = authDir(sessionId);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

// ─── Logout a session ─────────────────────────────────────────────────────────
async function logoutSession(sessionId) {
  const entry = sessions.get(sessionId);
  if (entry) {
    try { await entry.sock.logout(); } catch (_) {}
    sessions.delete(sessionId);
  }
  await Session.findOneAndUpdate({ sessionId }, { status: 'logged_out', qrCode: '' });
}

// ─── Get a socket (throws if not found/connected) ────────────────────────────
function getSocket(sessionId) {
  const entry = sessions.get(sessionId);
  if (!entry) throw new Error(`Session ${sessionId} not found or not connected`);
  return entry;
}

// ─── Send text message ────────────────────────────────────────────────────────
async function sendText(sessionId, jid, text, options = {}) {
  const { sock } = getSocket(sessionId);
  const msg = await sock.sendMessage(jid, { text, ...options });
  await persistMessage(sessionId, 'outbound', msg);
  return msg;
}

// ─── Send image ───────────────────────────────────────────────────────────────
async function sendImage(sessionId, jid, imageBuffer, caption = '', options = {}) {
  const { sock } = getSocket(sessionId);
  const msg = await sock.sendMessage(jid, { image: imageBuffer, caption, ...options });
  await persistMessage(sessionId, 'outbound', msg);
  return msg;
}

// ─── Send video ───────────────────────────────────────────────────────────────
async function sendVideo(sessionId, jid, videoBuffer, caption = '', options = {}) {
  const { sock } = getSocket(sessionId);
  const msg = await sock.sendMessage(jid, { video: videoBuffer, caption, ...options });
  await persistMessage(sessionId, 'outbound', msg);
  return msg;
}

// ─── Send audio ───────────────────────────────────────────────────────────────
async function sendAudio(sessionId, jid, audioBuffer, mimetype = 'audio/mp4', ptt = false) {
  const { sock } = getSocket(sessionId);
  const msg = await sock.sendMessage(jid, { audio: audioBuffer, mimetype, ptt });
  await persistMessage(sessionId, 'outbound', msg);
  return msg;
}

// ─── Send document ────────────────────────────────────────────────────────────
async function sendDocument(sessionId, jid, docBuffer, fileName, mimetype, caption = '') {
  const { sock } = getSocket(sessionId);
  const msg = await sock.sendMessage(jid, { document: docBuffer, fileName, mimetype, caption });
  await persistMessage(sessionId, 'outbound', msg);
  return msg;
}

// ─── Send sticker ─────────────────────────────────────────────────────────────
async function sendSticker(sessionId, jid, stickerBuffer) {
  const { sock } = getSocket(sessionId);
  const msg = await sock.sendMessage(jid, { sticker: stickerBuffer });
  await persistMessage(sessionId, 'outbound', msg);
  return msg;
}

// ─── Send location ────────────────────────────────────────────────────────────
async function sendLocation(sessionId, jid, lat, lng, name = '') {
  const { sock } = getSocket(sessionId);
  const msg = await sock.sendMessage(jid, {
    location: { degreesLatitude: lat, degreesLongitude: lng, name },
  });
  await persistMessage(sessionId, 'outbound', msg);
  return msg;
}

// ─── Send contact ─────────────────────────────────────────────────────────────
async function sendContact(sessionId, jid, contactName, contactPhone) {
  const { sock } = getSocket(sessionId);
  const vcard =
    `BEGIN:VCARD\nVERSION:3.0\nFN:${contactName}\nTEL;type=CELL;type=VOICE;waid=${contactPhone.replace(/\D/g, '')}:+${contactPhone.replace(/\D/g, '')}\nEND:VCARD`;
  const msg = await sock.sendMessage(jid, {
    contacts: { displayName: contactName, contacts: [{ vcard }] },
  });
  await persistMessage(sessionId, 'outbound', msg);
  return msg;
}

// ─── Send reaction ────────────────────────────────────────────────────────────
async function sendReaction(sessionId, jid, targetKey, emoji) {
  const { sock } = getSocket(sessionId);
  const msg = await sock.sendMessage(jid, { react: { text: emoji, key: targetKey } });
  return msg;
}

// ─── Send poll ────────────────────────────────────────────────────────────────
async function sendPoll(sessionId, jid, name, values, selectableCount = 1) {
  const { sock } = getSocket(sessionId);
  const msg = await sock.sendMessage(jid, {
    poll: { name, values, selectableCount },
  });
  await persistMessage(sessionId, 'outbound', msg);
  return msg;
}

// ─── Reply to a message ───────────────────────────────────────────────────────
async function replyMessage(sessionId, jid, targetKey, text) {
  const { sock } = getSocket(sessionId);
  const msg = await sock.sendMessage(jid, { text }, { quoted: { key: targetKey, message: { conversation: '' } } });
  await persistMessage(sessionId, 'outbound', msg);
  return msg;
}

// ─── Forward a message ────────────────────────────────────────────────────────
async function forwardMessage(sessionId, jid, targetMsg) {
  const { sock } = getSocket(sessionId);
  const msg = await sock.sendMessage(jid, { forward: targetMsg });
  return msg;
}

// ─── Delete a message ─────────────────────────────────────────────────────────
async function deleteMessage(sessionId, jid, msgKey, forEveryone = true) {
  const { sock } = getSocket(sessionId);
  return sock.sendMessage(jid, { delete: msgKey });
}

// ─── Edit a message ───────────────────────────────────────────────────────────
async function editMessage(sessionId, jid, msgKey, newText) {
  const { sock } = getSocket(sessionId);
  return sock.sendMessage(jid, { edit: msgKey, text: newText });
}

// ─── Mark messages read ───────────────────────────────────────────────────────
async function markRead(sessionId, jid, msgKeys) {
  const { sock } = getSocket(sessionId);
  return sock.readMessages(msgKeys);
}

// ─── Typing indicators ────────────────────────────────────────────────────────
async function sendPresence(sessionId, jid, type = 'composing') {
  const { sock } = getSocket(sessionId);
  await sock.sendPresenceUpdate(type, jid);
}

// ─── Group operations ─────────────────────────────────────────────────────────
async function createGroup(sessionId, subject, participants) {
  const { sock } = getSocket(sessionId);
  return sock.groupCreate(subject, participants);
}

async function updateGroupSubject(sessionId, groupId, subject) {
  const { sock } = getSocket(sessionId);
  return sock.groupUpdateSubject(groupId, subject);
}

async function updateGroupDescription(sessionId, groupId, desc) {
  const { sock } = getSocket(sessionId);
  return sock.groupUpdateDescription(groupId, desc);
}

async function addGroupParticipants(sessionId, groupId, participants) {
  const { sock } = getSocket(sessionId);
  return sock.groupParticipantsUpdate(groupId, participants, 'add');
}

async function removeGroupParticipants(sessionId, groupId, participants) {
  const { sock } = getSocket(sessionId);
  return sock.groupParticipantsUpdate(groupId, participants, 'remove');
}

async function promoteGroupParticipants(sessionId, groupId, participants) {
  const { sock } = getSocket(sessionId);
  return sock.groupParticipantsUpdate(groupId, participants, 'promote');
}

async function demoteGroupParticipants(sessionId, groupId, participants) {
  const { sock } = getSocket(sessionId);
  return sock.groupParticipantsUpdate(groupId, participants, 'demote');
}

async function leaveGroup(sessionId, groupId) {
  const { sock } = getSocket(sessionId);
  return sock.groupLeave(groupId);
}

async function getGroupMetadata(sessionId, groupId) {
  const { sock } = getSocket(sessionId);
  return sock.groupMetadata(groupId);
}

async function getGroupInviteCode(sessionId, groupId) {
  const { sock } = getSocket(sessionId);
  return sock.groupInviteCode(groupId);
}

async function revokeGroupInvite(sessionId, groupId) {
  const { sock } = getSocket(sessionId);
  return sock.groupRevokeInvite(groupId);
}

async function joinGroupByInvite(sessionId, inviteCode) {
  const { sock } = getSocket(sessionId);
  return sock.groupAcceptInvite(inviteCode);
}

// ─── Profile operations ───────────────────────────────────────────────────────
async function getProfilePicUrl(sessionId, jid) {
  const { sock } = getSocket(sessionId);
  return sock.profilePictureUrl(jid, 'image');
}

async function updateProfilePicture(sessionId, jid, imageBuffer) {
  const { sock } = getSocket(sessionId);
  return sock.updateProfilePicture(jid, imageBuffer);
}

async function updateProfileStatus(sessionId, status) {
  const { sock } = getSocket(sessionId);
  return sock.updateProfileStatus(status);
}

async function updateProfileName(sessionId, name) {
  const { sock } = getSocket(sessionId);
  return sock.updateProfileName(name);
}

// ─── Block / unblock ──────────────────────────────────────────────────────────
async function blockContact(sessionId, jid) {
  const { sock } = getSocket(sessionId);
  return sock.updateBlockStatus(jid, 'block');
}

async function unblockContact(sessionId, jid) {
  const { sock } = getSocket(sessionId);
  return sock.updateBlockStatus(jid, 'unblock');
}

// ─── Contacts & chats ─────────────────────────────────────────────────────────
async function getContacts(sessionId) {
  const { store } = getSocket(sessionId);
  return Object.values(store.contacts || {});
}

async function getChats(sessionId) {
  const { store } = getSocket(sessionId);
  return Object.values(store.chats || {});
}

async function getChatMessages(sessionId, jid, limit = 50) {
  const { store } = getSocket(sessionId);
  const msgs = store.messages[jid];
  if (!msgs) return [];
  return msgs.slice(-limit);
}

// ─── Status broadcast ─────────────────────────────────────────────────────────
async function sendTextStatus(sessionId, text, backgroundColor = '#7f27f0', font = 0) {
  const { sock } = getSocket(sessionId);
  return sock.sendMessage('status@broadcast', {
    text,
    backgroundArgb: backgroundColor,
    font,
  });
}

async function sendImageStatus(sessionId, imageBuffer, caption = '') {
  const { sock } = getSocket(sessionId);
  return sock.sendMessage('status@broadcast', { image: imageBuffer, caption });
}

// ─── Check WhatsApp number ────────────────────────────────────────────────────
async function checkNumberExists(sessionId, phone) {
  const { sock } = getSocket(sessionId);
  const jid = `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
  const [result] = await sock.onWhatsApp(jid);
  return result;
}

// ─── Get session info ─────────────────────────────────────────────────────────
function getSessionInfo(sessionId) {
  const entry = sessions.get(sessionId);
  if (!entry) return null;
  const { me } = entry.sock;
  return {
    sessionId,
    connected: true,
    me,
    platform: entry.sock.ws?.url || '',
  };
}

function getAllSessionIds() {
  return Array.from(sessions.keys());
}

module.exports = {
  setIO,
  createSession,
  restoreAllSessions,
  deleteSession,
  logoutSession,
  getSessionInfo,
  getAllSessionIds,
  // Messaging
  sendText,
  sendImage,
  sendVideo,
  sendAudio,
  sendDocument,
  sendSticker,
  sendLocation,
  sendContact,
  sendReaction,
  sendPoll,
  replyMessage,
  forwardMessage,
  deleteMessage,
  editMessage,
  markRead,
  sendPresence,
  // Groups
  createGroup,
  updateGroupSubject,
  updateGroupDescription,
  addGroupParticipants,
  removeGroupParticipants,
  promoteGroupParticipants,
  demoteGroupParticipants,
  leaveGroup,
  getGroupMetadata,
  getGroupInviteCode,
  revokeGroupInvite,
  joinGroupByInvite,
  // Profile
  getProfilePicUrl,
  updateProfilePicture,
  updateProfileStatus,
  updateProfileName,
  // Block
  blockContact,
  unblockContact,
  // Contacts & chats
  getContacts,
  getChats,
  getChatMessages,
  // Status
  sendTextStatus,
  sendImageStatus,
  // Utility
  checkNumberExists,
};
