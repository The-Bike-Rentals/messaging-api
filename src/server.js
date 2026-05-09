require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const config = require('./config');
const logger = require('./utils/logger');
const createApp = require('./app');
const wa = require('./services/whatsappService');

async function start() {
  // ── MongoDB ───────────────────────────────────────────
  logger.info('Connecting to MongoDB…');
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });
  logger.info('MongoDB connected');

  // ── Express app ───────────────────────────────────────
  const app = createApp();
  const server = http.createServer(app);

  // ── Socket.IO ─────────────────────────────────────────
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    logger.debug({ id: socket.id }, 'Socket connected');
    socket.on('disconnect', () => {
      logger.debug({ id: socket.id }, 'Socket disconnected');
    });
  });

  // Inject io into WhatsApp service for real-time events
  wa.setIO(io);

  // ── Restore WhatsApp sessions ─────────────────────────
  try {
    await wa.restoreAllSessions();
  } catch (err) {
    logger.error({ err }, 'Failed to restore WhatsApp sessions on startup');
  }

  // ── Start server ──────────────────────────────────────
  server.listen(config.port, () => {
    logger.info(`
  ┌────────────────────────────────────────────┐
  │          Message API is running            │
  │  http://localhost:${config.port}                   │
  │  Admin:  http://localhost:${config.port}/admin     │
  └────────────────────────────────────────────┘
`);
  });

  // ── Graceful shutdown ─────────────────────────────────
  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down…');
    server.close(async () => {
      await mongoose.disconnect();
      logger.info('Server stopped');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('Startup error:', err);
  process.exit(1);
});
