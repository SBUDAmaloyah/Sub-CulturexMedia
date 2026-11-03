const cfg = require('../../config');
const db = require('../../db');
const demo = require('./demo');
const providers = require('./providers');
const { HttpError } = require('../../utils');

const MATCH_SPORTS = ['soccer', 'rugby', 'cricket', 'basketball'];
const cache = new Map(); // sport -> { at, data, provider }

async function fromProvider(sport) {
  const p = cfg.scores.providers[sport];
  if (p === 'demo') return { data: demo(sport), source: 'demo' };
  const fn = providers[p];
  if (!fn) throw new HttpError(500, `Unknown provider "${p}" for ${sport}`);
  return { data: await fn(sport), source: 'live' };
}

function overrides(sport) {
  return db.prepare('SELECT id,payload FROM score_overrides WHERE sport=? ORDER BY id DESC').all(sport)
    .map((r) => ({ ...JSON.parse(r.payload), id: r.id, manual: true }));
}

// Cached for SCORES_CACHE_SECONDS so many visitors cost one upstream call. If the provider fails we serve the last good
// copy (marked stale) and, failing that, demo data when SCORES_FALLBACK_DEMO is on.
async function getScores(sport) {
  if (!cfg.scores.sports.includes(sport)) throw new HttpError(404, 'Unknown sport');
  let entry = cache.get(sport), stale = false, error;
  if (!entry || Date.now() - entry.at > cfg.scores.cacheSeconds * 1000) {
    try { entry = { ...(await fromProvider(sport)), at: Date.now() }; cache.set(sport, entry); }
    catch (e) {
      error = e.message; stale = !!entry;
      if (!entry) {
        if (!cfg.scores.fallbackDemo) throw e;
        entry = { data: demo(sport), source: 'demo', at: Date.now() };
      }
    }
  }
  let data = entry.data;
  if (MATCH_SPORTS.includes(sport)) data = [...overrides(sport), ...data];
  return { sport, source: entry.source, provider: cfg.scores.providers[sport], updatedAt: entry.at, stale, ...(error ? { error } : {}), data };
}

module.exports = { getScores, overrides, MATCH_SPORTS };
