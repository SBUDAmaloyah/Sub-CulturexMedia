const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const cfg = require('./config');
require('./db');
const { loadUser, csrfGuard } = require('./auth');
const { HttpError } = require('./utils');

function createApp() {
  const app = express();
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:', 'blob:'],
        'media-src': ["'self'", 'blob:'],
        'frame-src': ['https://www.youtube.com', 'https://player.vimeo.com'],
        'connect-src': ["'self'"],
        'object-src': ["'none'"],
        'upgrade-insecure-requests': cfg.isProd ? [] : null,
      },
    },
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  // ---- API ----
  const api = express.Router();
  api.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  api.use(rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } }));
  api.use(loadUser, csrfGuard);
  api.get('/health', (req, res) => res.json({ ok: true }));
  api.use('/auth', require('./routes/auth'));
  api.use('/users', require('./routes/users'));
  api.use('/articles', require('./routes/articles'));
  api.use('/downloads', require('./routes/downloads'));
  api.use('/trivia', require('./routes/trivia'));
  api.use('/scores', require('./routes/scores'));
  api.use('/', require('./routes/media')); // /media, /photos, /videos
  api.use((req, res, next) => next(new HttpError(404, 'Not found')));
  app.use('/api', api);

  // ---- Files and front end ----
  app.use('/uploads', express.static(cfg.uploadDir, {
    index: false, dotfiles: 'deny', maxAge: '7d', immutable: true,
    setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff'),
  }));
  app.use(express.static(cfg.clientDir));

  // ---- Errors ----
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    let status = err.status || 500, message = err.message;
    if (err.code === 'LIMIT_FILE_SIZE') { status = 413; message = 'File is too large'; }
    else if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') { status = 400; message = 'Unexpected or too many files'; }
    else if (err.type === 'entity.parse.failed') { status = 400; message = 'Invalid JSON'; }
    else if (err.type === 'entity.too.large') { status = 413; message = 'Request body too large'; }
    if (status >= 500) { console.error(err); if (cfg.isProd) message = 'Server error'; }
    res.status(status).json({ error: message });
  });
  return app;
}
module.exports = { createApp };
