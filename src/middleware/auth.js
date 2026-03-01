/**
 * Middleware: requireAdmin
 * Checks that the session has an authenticated admin flag.
 * Used to protect admin HTML pages and admin API routes.
 */
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
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
