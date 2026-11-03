const jwt = require('jsonwebtoken');
const cfg = require('./config');
const db = require('./db');
const { HttpError } = require('./utils');

const COOKIE = 'sc_token';
const sign = (u) => jwt.sign({ sub: u.id, role: u.role }, cfg.jwtSecret, { expiresIn: '7d' });
const setCookie = (res, token) =>
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: cfg.isProd, maxAge: 7 * 864e5 });
const clearCookie = (res) => res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'strict', secure: cfg.isProd });

// Attaches req.user when a valid cookie or Bearer token is present. Never rejects.
function loadUser(req, res, next) {
  const bearer = (req.headers.authorization || '').match(/^Bearer (.+)$/i);
  const token = bearer ? bearer[1] : req.cookies && req.cookies[COOKIE];
  req.authVia = bearer ? 'bearer' : 'cookie';
  if (token) {
    try {
      const p = jwt.verify(token, cfg.jwtSecret);
      const u = db.prepare('SELECT id,email,name,role,active FROM users WHERE id=?').get(p.sub);
      if (u && u.active) req.user = u;
    } catch { /* invalid or expired token: treat as signed out */ }
  }
  next();
}

// CSRF defence for cookie sessions: SameSite=Strict plus a custom header on every write.
function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.authVia === 'bearer') return next();
  if (req.get('x-requested-with') !== 'sub-culture') return next(new HttpError(403, 'Missing X-Requested-With header'));
  next();
}

const requireAuth = (req, res, next) => (req.user ? next() : next(new HttpError(401, 'Sign in required')));
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(new HttpError(401, 'Sign in required'));
  if (!roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have permission to do that'));
  next();
};
const isStaff = (u) => !!u && (u.role === 'admin' || u.role === 'editor');

module.exports = { sign, setCookie, clearCookie, loadUser, csrfGuard, requireAuth, requireRole, isStaff };
