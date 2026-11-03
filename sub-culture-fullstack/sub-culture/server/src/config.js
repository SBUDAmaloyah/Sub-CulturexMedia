require('dotenv').config({ quiet: true });
const path = require('path');
const crypto = require('crypto');
const env = process.env;
const isProd = env.NODE_ENV === 'production';

let jwtSecret = env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  if (isProd) throw new Error('JWT_SECRET must be set to 32+ characters in production');
  jwtSecret = crypto.randomBytes(32).toString('hex');
  console.warn('[config] JWT_SECRET not set - using a random one (logins reset on every restart)');
}

const SPORTS = ['soccer', 'rugby', 'cricket', 'basketball', 'golf', 'f1'];
const providers = {}, feeds = {};
for (const s of SPORTS) {
  providers[s] = (env['SCORES_' + s.toUpperCase()] || 'demo').toLowerCase();
  feeds[s] = env['SCORES_' + s.toUpperCase() + '_FEED'] || '';
}

module.exports = {
  isProd,
  port: Number(env.PORT) || 3000,
  jwtSecret,
  dbPath: path.resolve(env.DB_PATH || './data/subculture.db'),
  uploadDir: path.resolve(env.UPLOAD_DIR || './data/uploads'),
  clientDir: path.resolve(env.CLIENT_DIR || path.join(__dirname, '../../client')),
  allowArtistSignup: env.ALLOW_ARTIST_SIGNUP === 'true',
  trivia: { tz: env.TRIVIA_TZ || 'UTC', count: Number(env.TRIVIA_COUNT) || 5 },
  anthropic: { key: env.ANTHROPIC_API_KEY || '', model: env.ANTHROPIC_MODEL || 'claude-sonnet-5-5' },
  scores: {
    sports: SPORTS, providers, feeds,
    tz: env.SCORES_TZ || 'UTC',
    cacheSeconds: Number(env.SCORES_CACHE_SECONDS) || 30,
    fallbackDemo: env.SCORES_FALLBACK_DEMO !== 'false',
    apisportsKey: env.APISPORTS_KEY || '',
    cricapiKey: env.CRICAPI_KEY || '',
  },
};
