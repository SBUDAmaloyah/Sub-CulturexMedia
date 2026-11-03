/* Hash router, render loop and per-route data loading */
const VIEWS = { home: vHome, news: (id) => (id ? vArticle(id) : vNews()), photos: vPhotos, videos: vVideos, downloads: vDownloads, trivia: vTrivia, scores: vScores, studio: vStudio };
const MATCH_SPORTS = ['soccer', 'rugby', 'cricket', 'basketball'];
let lastRoute = '';

async function render(keep) {
  const [r, id] = parse();
  if (r === 'news' && id && !S.detail[id]) {
    try { S.detail[id] = await api('/articles/' + encodeURIComponent(id)); } catch { S.detail[id] = { missing: 1 }; }
  }
  const y = window.scrollY;
  $('#nav').innerHTML = NAV.map(([k, l]) => `<a href="#/${k}" class="${k === r ? 'on' : ''}">${l}</a>`).join('');
  document.title = 'Sub Culture — News, Photos, Video, Downloads, Trivia & Live Scores';
  $('#app').innerHTML = (VIEWS[r] || vHome)(id);
  if (!keep && lastRoute !== location.hash) window.scrollTo(0, 0); else window.scrollTo(0, y);
  lastRoute = location.hash;
  after(r, !keep);
}

// fresh = true when the user just arrived on the route (load its data); false for in-place redraws.
function after(r, fresh) {
  clearInterval(scoresTimer);
  if (r === 'scores') scoresTimer = setInterval(async () => { await loadScores([sport]); if (parse()[0] === 'scores') render(true); }, 30000);
  if (!fresh) return;
  const again = (name) => () => { if (parse()[0] === name) render(true); };
  if (r === 'home') loadScores(MATCH_SPORTS).then(again('home'));
  if (r === 'scores') loadScores([sport]).then(again('scores'));
  if (r === 'trivia') loadTrivia().then(again('trivia')).catch((e) => toast(e.message));
  if (r === 'studio') loadStudio();
}
window.addEventListener('hashchange', () => render());
