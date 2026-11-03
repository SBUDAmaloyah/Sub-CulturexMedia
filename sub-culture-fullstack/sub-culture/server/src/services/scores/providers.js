// Live-score providers. Each returns data in the platform schema:
//   match sports: [{ league, home, away, hs, as, status: 'LIVE'|'FT'|'UP', clock?, time?, note? }]
//   golf / f1:    { event, status, rows: [[...]] }
// NOTE: the third-party response mappings below were written from each vendor's public docs and have not
// been run against live accounts. Test each with your own key and adjust the mapper if a field differs.
const cfg = require('../../config');
const { HttpError } = require('../../utils');

async function getJson(url, headers = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { headers, signal: ctl.signal });
    if (!r.ok) throw new HttpError(502, `Upstream returned ${r.status}`);
    return await r.json();
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, 'Upstream request failed: ' + (e.name === 'AbortError' ? 'timeout' : e.message));
  } finally { clearTimeout(t); }
}
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: cfg.scores.tz }).format(new Date());
const hhmm = (iso) => (iso ? new Intl.DateTimeFormat('en-GB', { timeZone: cfg.scores.tz, hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : undefined);
const order = { LIVE: 0, UP: 1, FT: 2 };
const sortMatches = (a) => a.sort((x, y) => order[x.status] - order[y.status]).slice(0, 60);

function key() { if (!cfg.scores.apisportsKey) throw new HttpError(503, 'APISPORTS_KEY is not configured'); return { 'x-apisports-key': cfg.scores.apisportsKey }; }

// ---- API-Sports (soccer, rugby, basketball) ----
const LIVE = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'Q1', 'Q2', 'Q3', 'Q4', 'OT', 'PT']);
const DONE = new Set(['FT', 'AET', 'PEN', 'AOT', 'AP']);
function status(short) { return LIVE.has(short) ? 'LIVE' : DONE.has(short) ? 'FT' : 'UP'; }

async function apisports(sport) {
  const h = key();
  if (sport === 'soccer') {
    const j = await getJson(`https://v3.football.api-sports.io/fixtures?date=${today()}&timezone=${encodeURIComponent(cfg.scores.tz)}`, h);
    return sortMatches((j.response || []).map((it) => {
      const s = it.fixture.status.short, st = status(s);
      return { league: it.league.name, home: it.teams.home.name, away: it.teams.away.name, hs: it.goals.home, as: it.goals.away, status: st,
        clock: st === 'LIVE' ? (s === 'HT' ? 'HT' : `${it.fixture.status.elapsed}'`) : undefined,
        time: st === 'UP' ? hhmm(it.fixture.date) : undefined, note: st === 'UP' && s !== 'NS' ? it.fixture.status.long : undefined };
    }));
  }
  if (sport === 'rugby') {
    const j = await getJson(`https://v1.rugby.api-sports.io/games?date=${today()}&timezone=${encodeURIComponent(cfg.scores.tz)}`, h);
    return sortMatches((j.response || []).map((g) => {
      const s = g.status.short, st = status(s);
      return { league: g.league.name, home: g.teams.home.name, away: g.teams.away.name, hs: g.scores.home, as: g.scores.away, status: st,
        clock: st === 'LIVE' ? (s === 'HT' ? 'HT' : g.status.long) : undefined, time: st === 'UP' ? hhmm(g.date) : undefined };
    }));
  }
  if (sport === 'basketball') {
    const j = await getJson(`https://v1.basketball.api-sports.io/games?date=${today()}&timezone=${encodeURIComponent(cfg.scores.tz)}`, h);
    return sortMatches((j.response || []).map((g) => {
      const s = g.status.short, st = status(s);
      return { league: g.league.name, home: g.teams.home.name, away: g.teams.away.name, hs: g.scores.home.total, as: g.scores.away.total, status: st,
        clock: st === 'LIVE' ? [s, g.status.timer].filter(Boolean).join(' ') : undefined, time: st === 'UP' ? hhmm(g.date) : undefined };
    }));
  }
  throw new HttpError(400, `apisports provider does not support ${sport}`);
}

// ---- Jolpica (Ergast-compatible, free): most recent Formula 1 race classification ----
async function jolpica() {
  const j = await getJson('https://api.jolpi.ca/ergast/f1/current/last/results.json');
  const race = j.MRData && j.MRData.RaceTable && j.MRData.RaceTable.Races && j.MRData.RaceTable.Races[0];
  if (!race) throw new HttpError(502, 'No race data returned');
  return {
    event: race.raceName, status: `Final classification - round ${race.round}, ${race.season}`,
    rows: (race.Results || []).slice(0, 20).map((r) => [r.position, `${r.Driver.givenName} ${r.Driver.familyName}`, r.Constructor.name, (r.Time && r.Time.time) || r.status]),
  };
}

// ---- CricAPI (cricketdata.org): current matches ----
async function cricapi() {
  if (!cfg.scores.cricapiKey) throw new HttpError(503, 'CRICAPI_KEY is not configured');
  const j = await getJson(`https://api.cricapi.com/v1/currentMatches?apikey=${encodeURIComponent(cfg.scores.cricapiKey)}&offset=0`);
  return sortMatches((j.data || []).map((m) => {
    const [home, away] = m.teams || ['TBC', 'TBC'];
    const sc = (team) => { const s = (m.score || []).filter((x) => String(x.inning || '').startsWith(team)).pop(); return s ? `${s.r}/${s.w} (${s.o})` : undefined; };
    return { league: m.matchType ? String(m.matchType).toUpperCase() : '', home, away, hs: sc(home), as: sc(away),
      status: m.matchEnded ? 'FT' : m.matchStarted ? 'LIVE' : 'UP', clock: m.matchStarted && !m.matchEnded ? 'In play' : undefined, note: m.status };
  }));
}

// ---- Generic JSON feed (your own service or a proxy). Accepts {sport: data} or the data itself. ----
async function feed(sport) {
  const url = cfg.scores.feeds[sport];
  if (!url) throw new HttpError(503, `SCORES_${sport.toUpperCase()}_FEED is not configured`);
  const j = await getJson(url);
  return j && j[sport] !== undefined ? j[sport] : j;
}

module.exports = {
  apisports, jolpica: () => jolpica(), cricapi: () => cricapi(), feed,
};
