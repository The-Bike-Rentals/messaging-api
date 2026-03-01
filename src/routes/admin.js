/**
 * Admin API Routes  –  /api/admin
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const AdminConfig = require('../models/AdminConfig');
const config = require('../config');
const { requireAdmin } = require('../middleware/auth');

/** POST /api/admin/login */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ success: false, message: 'username and password required' });

    // Look up in DB first, fallback to env
    let valid = false;
    const dbAdmin = await AdminConfig.findOne({ username });
    if (dbAdmin) {
      valid = await bcrypt.compare(password, dbAdmin.passwordHash);
    } else {
      // Fallback: env hash
      const envHash = config.admin.passwordHash;
      const envUser = config.admin.username;
      if (username === envUser && envHash) {
        valid = await bcrypt.compare(password, envHash);
      }
    }

    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    req.session.isAdmin = true;
    req.session.adminUsername = username;
    return res.json({ success: true, message: 'Logged in' });
  } catch (err) {
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
