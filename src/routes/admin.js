/**
 * Admin API Routes  –  /api/admin
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const AdminConfig = require('../models/AdminConfig');
const config = require('../config');
const logger = require('../utils/logger');
const { requireAdmin } = require('../middleware/auth');

/** POST /api/admin/login */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    logger.info({ username, ip: req.ip, proto: req.protocol, host: req.hostname }, '[login] attempt');

    if (!username || !password)
      return res.status(400).json({ success: false, message: 'username and password required' });

    // Look up in DB first, fallback to env
    let valid = false;
    const dbAdmin = await AdminConfig.findOne({ username });
    if (dbAdmin) {
      logger.info({ username }, '[login] found in DB, comparing hash');
      valid = await bcrypt.compare(password, dbAdmin.passwordHash);
    } else {
      // Fallback: env hash
      const envHash = config.admin.passwordHash;
      const envUser = config.admin.username;
      logger.info({ username, envUser, hasEnvHash: !!envHash }, '[login] not in DB, falling back to env');
      if (username === envUser && envHash) {
        valid = await bcrypt.compare(password, envHash);
      }
    }

    logger.info({ username, valid }, '[login] password check result');

    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    req.session.isAdmin = true;
    req.session.adminUsername = username;

    logger.info({ sessionID: req.sessionID, username }, '[login] saving session to store');

    // Explicitly save the session to MongoDB before responding.
    // Without save(), the async MongoStore write may not complete before the
    // browser follows the redirect, causing requireAdmin to see no session.
    req.session.save((err) => {
      if (err) {
        logger.error({ err, sessionID: req.sessionID }, '[login] session save FAILED');
        return res.status(500).json({ success: false, message: 'Session save failed' });
      }
      logger.info(
        {
          sessionID: req.sessionID,
          username,
          cookie: {
            secure: req.session.cookie.secure,
            sameSite: req.session.cookie.sameSite,
            httpOnly: req.session.cookie.httpOnly,
          },
          forwardedProto: req.headers['x-forwarded-proto'],
          forwardedFor: req.headers['x-forwarded-for'],
        },
        '[login] session saved OK – responding with success'
      );
      return res.json({ success: true, message: 'Logged in' });
    });
  } catch (err) {
    logger.error({ err }, '[login] unexpected error');
    return res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /api/admin/logout */
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: 'Logged out' });
  });
});

/** GET /api/admin/me */
router.get('/me', requireAdmin, (req, res) => {
  res.json({ success: true, data: { username: req.session.adminUsername } });
});

/** POST /api/admin/change-password */
router.post('/change-password', requireAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: 'currentPassword and newPassword required' });

    const username = req.session.adminUsername;
    const dbAdmin = await AdminConfig.findOne({ username });
    let valid = false;

    if (dbAdmin) {
      valid = await bcrypt.compare(currentPassword, dbAdmin.passwordHash);
    } else {
      const envHash = config.admin.passwordHash;
      if (envHash) valid = await bcrypt.compare(currentPassword, envHash);
    }

    if (!valid) return res.status(401).json({ success: false, message: 'Current password incorrect' });

    const newHash = await bcrypt.hash(newPassword, 12);
    await AdminConfig.findOneAndUpdate(
      { username },
      { username, passwordHash: newHash },
      { upsert: true }
    );
    return res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
