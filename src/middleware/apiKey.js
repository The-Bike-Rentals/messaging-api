/**
 * Middleware: requireApiKey
 * Reads X-API-Key header and validates against API_KEY env / config.
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

module.exports = { requireApiKey };
