/**
 * Config API Routes  –  /api/config
 * Requires admin authentication.
 */
const express = require('express');
const router = express.Router();
const EmailConfig = require('../models/EmailConfig');
const SmsConfig = require('../models/SmsConfig');
const emailSvc = require('../services/emailService');
const { requireAdmin } = require('../middleware/auth');

// ─── Email config ─────────────────────────────────────────────────────────────

router.get('/email', requireAdmin, async (req, res) => {
  try {
    const configs = await EmailConfig.find({}).sort({ updatedAt: -1 });
    res.json({ success: true, data: configs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/email', requireAdmin, async (req, res) => {
  try {
    const { name, host, port, secure, user, pass, from } = req.body;
    if (!host) return res.status(400).json({ success: false, message: 'host is required' });
    // Deactivate others if this is the first / set active
    if (req.body.isActive) await EmailConfig.updateMany({}, { isActive: false });
    const cfg = await EmailConfig.create({ name, host, port, secure, user, pass, from, isActive: req.body.isActive !== false });
    res.json({ success: true, data: cfg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/email/:id', requireAdmin, async (req, res) => {
  try {
    const { name, host, port, secure, user, pass, from, isActive } = req.body;
    if (isActive) await EmailConfig.updateMany({ _id: { $ne: req.params.id } }, { isActive: false });
    const cfg = await EmailConfig.findByIdAndUpdate(
      req.params.id,
      { name, host, port, secure, user, pass, from, isActive },
      { new: true }
    );
    if (!cfg) return res.status(404).json({ success: false, message: 'Config not found' });
    res.json({ success: true, data: cfg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/email/:id', requireAdmin, async (req, res) => {
  try {
    await EmailConfig.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Email config deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/email/test', requireAdmin, async (req, res) => {
  try {
    await emailSvc.verifyConnection(req.body);
    res.json({ success: true, message: 'Email connection verified' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── SMS config ───────────────────────────────────────────────────────────────

router.get('/sms', requireAdmin, async (req, res) => {
  try {
    const configs = await SmsConfig.find({}).sort({ updatedAt: -1 });
    res.json({ success: true, data: configs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/sms', requireAdmin, async (req, res) => {
  try {
    const { name, provider, apiUrl, apiUsername, apiPassword, apiKey, from } = req.body;
    if (req.body.isActive) await SmsConfig.updateMany({}, { isActive: false });
    const cfg = await SmsConfig.create({ name, provider, apiUrl, apiUsername, apiPassword, apiKey, from, isActive: req.body.isActive !== false });
    res.json({ success: true, data: cfg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/sms/:id', requireAdmin, async (req, res) => {
  try {
    const { name, provider, apiUrl, apiUsername, apiPassword, apiKey, from, isActive } = req.body;
    if (isActive) await SmsConfig.updateMany({ _id: { $ne: req.params.id } }, { isActive: false });
    const cfg = await SmsConfig.findByIdAndUpdate(
      req.params.id,
      { name, provider, apiUrl, apiUsername, apiPassword, apiKey, from, isActive },
      { new: true }
    );
    if (!cfg) return res.status(404).json({ success: false, message: 'Config not found' });
    res.json({ success: true, data: cfg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/sms/:id', requireAdmin, async (req, res) => {
  try {
    await SmsConfig.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'SMS config deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
