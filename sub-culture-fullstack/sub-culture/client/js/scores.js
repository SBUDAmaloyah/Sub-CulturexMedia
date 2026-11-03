/* Live scores (client side). The server aggregates providers and caches; the page just polls it. */
const SPORTS = [['soccer', 'Soccer', '⚽'], ['rugby', 'Rugby', '🏉'], ['cricket', 'Cricket', '🏏'], ['basketball', 'Basketball', '🏀'], ['golf', 'Golf', '⛳'], ['f1', 'Formula 1', '🏎️']];
let sport = 'soccer', scoresTimer = null;

async function loadScores(list) {
  await Promise.all(list.map(async (k) => {
    try { S.scores[k] = await api('/scores/' + k); } catch (e) { S.scores[k] = { error: e.message }; }
  }));
}
const statusCell = (m) => m.status === 'LIVE' ? `<div class="st live">${esc(m.clock || 'LIVE')}</div>` : m.status === 'FT' ? '<div class="st">FT</div>' : `<div class="st">${esc(m.time || 'TBD')}</div>`;
const matchRow = (m) => `<div class="match"><div class="lg">${esc(m.league || '')}${m.manual ? ' · editor update' : ''}</div><div><div class="t"><span>${esc(m.home)}</span><b>${esc(m.hs ?? '–')}</b></div><div class="t"><span>${esc(m.away)}</span><b>${esc(m.as ?? '–')}</b></div></div>${statusCell(m)}${m.note ? `<div class="note">${esc(m.note)}</div>` : ''}</div>`;
