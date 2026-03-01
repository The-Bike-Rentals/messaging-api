/**
 * Middleware: requireApiKey
 * Reads X-API-Key header and validates against API_KEY env / config.
 *
 * Middleware: requireApiKeyOrAdmin
 * Passes the request if EITHER:
 *   - the session has an authenticated admin flag (req.session.isAdmin), OR
 *   - a valid X-API-Key header is provided.
 * This lets the Admin UI work with its session cookie while external
 * callers authenticate with their API key. The API key is never sent
 * to the client side.
 */
const config = require('../config');

function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) {
    return res.status(401).json({ success: false, message: 'Missing X-API-Key header' });
  }
  if (key !== config.apiKey) {
    return res.status(403).json({ success: false, message: 'Invalid API key' });
  }
  return next();
}

function requireApiKeyOrAdmin(req, res, next) {
  // Allow through if the request carries a valid admin session
  if (req.session && req.session.isAdmin) {
    return next();
  }

  // Otherwise fall back to API key check
  const key = req.headers['x-api-key'];
  if (!key) {
    return res.status(401).json({ success: false, message: 'Authentication required: provide a valid X-API-Key header' });
  }
  if (key !== config.apiKey) {
    return res.status(403).json({ success: false, message: 'Invalid API key' });
  }
  return next();
}

module.exports = { requireApiKey, requireApiKeyOrAdmin };
