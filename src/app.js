require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const path = require('path');

const config = require('./config');
const logger = require('./utils/logger');
const { requireAdmin } = require('./middleware/auth');

// ─── Routes ───────────────────────────────────────────────────────────────────
const sendRouter      = require('./routes/send');
const whatsappRouter  = require('./routes/whatsapp');
const waRouter        = require('./routes/wa');
const configRouter    = require('./routes/config');
const adminRouter     = require('./routes/admin');
const messagesRouter  = require('./routes/messages');

function createApp() {
  const app = express();

  // ── Middleware ────────────────────────────────────────
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Session
  app.use(
    session({
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: config.mongoUri,
        collectionName: 'sessions',
        ttl: 60 * 60 * 24, // 1 day
      }),
      cookie: {
        secure: config.nodeEnv === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24,
      },
    })
  );

  // ── Admin static-file guard ───────────────────────────
  // Prevents direct .html URL access (e.g. /admin/sessions.html) from
  // bypassing the requireAdmin route middleware.
  app.use('/admin', (req, res, next) => {
    if (req.path === '/login' || req.path === '/login.html') return next();
    if (!req.session || !req.session.isAdmin) {
      return res.redirect('/admin/login');
    }
    next();
  });

  // ── Static files ──────────────────────────────────────
  app.use(express.static(path.join(__dirname, '../public')));

  // ── API Routes ────────────────────────────────────────
  app.use('/api/send',      sendRouter);
  app.use('/api/whatsapp',  whatsappRouter);
  app.use('/api',           waRouter);       // /:sessionId/messages/send  &  /:sessionId/send-media/send
  app.use('/api/config',    configRouter);
  app.use('/api/admin',     adminRouter);
  app.use('/api/messages',  messagesRouter);

  // ── Admin HTML Pages ──────────────────────────────────
  app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin/login.html'));
  });

  app.get('/admin/sessions', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin/sessions.html'));
  });

  app.get('/admin/config', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin/config.html'));
  });

  app.get('/admin/change-password', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin/change-password.html'));
  });

  // ── Public Pages ──────────────────────────────────────
  app.get('/sessions', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/sessions.html'));
  });

  // Redirect root to sessions list
  app.get('/', (req, res) => res.redirect('/sessions'));

  // ── 404 handler ───────────────────────────────────────
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ success: false, message: 'API endpoint not found' });
    }
    res.status(404).send('Not found');
  });

  // ── Error handler ─────────────────────────────────────
  app.use((err, req, res, next) => {
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  });

  return app;
}

module.exports = createApp;
