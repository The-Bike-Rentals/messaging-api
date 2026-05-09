/**
 * Middleware: requireAdmin
 * Checks that the session has an authenticated admin flag.
 * Used to protect admin HTML pages and admin API routes.
 */
const logger = require('../utils/logger');

function requireAdmin(req, res, next) {
  logger.info(
    {
      path: req.path,
      method: req.method,
      sessionID: req.sessionID,
      hasSession: !!req.session,
      isAdmin: req.session && req.session.isAdmin,
      cookieHeader: req.headers.cookie ? '[present]' : '[missing]',
      forwardedProto: req.headers['x-forwarded-proto'],
      forwardedFor: req.headers['x-forwarded-for'],
    },
    '[requireAdmin] checking session'
  );

  if (req.session && req.session.isAdmin) {
    logger.info({ sessionID: req.sessionID, path: req.path }, '[requireAdmin] PASS');
    return next();
  }

  logger.warn(
    {
      path: req.path,
      sessionID: req.sessionID,
      sessionKeys: req.session ? Object.keys(req.session) : null,
    },
    '[requireAdmin] DENIED – redirecting to login'
  );

  // For API requests return 401 JSON; for browser requests redirect to login
  const isApiRequest =
    req.path.startsWith('/api/') ||
    (req.headers.accept && req.headers.accept.includes('application/json'));

  if (isApiRequest) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  return res.redirect('/admin/login');
}

module.exports = { requireAdmin };
