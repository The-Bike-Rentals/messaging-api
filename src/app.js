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

  // Trust the nginx ingress / reverse proxy so that req.protocol,
  // req.hostname and req.ip reflect the real client-facing values.
  // Without this, res.redirect() builds wrong absolute URLs behind a proxy.
  app.set('trust proxy', 1);

  // ── View engine (EJS) ────────────────────────────────
  // Server-side rendering ensures auth is enforced before any HTML is sent,
  // eliminating client-side redirect races for the admin portal.
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../views'));

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
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24,
      },
    })
  );

  // ── Static files ──────────────────────────────────────
  app.use(express.static(path.join(__dirname, '../public')));

  // ── API Routes ────────────────────────────────────────
  app.use('/api/send',      sendRouter);
  app.use('/api/whatsapp',  whatsappRouter);
  app.use('/api',           waRouter);       // /:sessionId/messages/send  &  /:sessionId/send-media/send
  app.use('/api/config',    configRouter);
  app.use('/api/admin',     adminRouter);
  app.use('/api/messages',  messagesRouter);

  // ── Admin Pages (EJS, server-side auth) ──────────────
  app.get('/admin/login', (req, res) => {
    if (req.session && req.session.isAdmin) return res.redirect('/admin/sessions');
    res.render('admin/login');
  });

  app.get('/admin/sessions', requireAdmin, (req, res) => {
    res.render('admin/sessions', { adminUsername: req.session.adminUsername });
  });

  app.get('/admin/config', requireAdmin, (req, res) => {
    res.render('admin/config', { adminUsername: req.session.adminUsername });
  });

  app.get('/admin/change-password', requireAdmin, (req, res) => {
    res.render('admin/change-password', { adminUsername: req.session.adminUsername });
  });

  // ── Public Pages ──────────────────────────────────────
  app.get('/sessions', (req, res) => {
    res.render('sessions');
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
