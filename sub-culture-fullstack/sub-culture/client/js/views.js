/* Public page views: home, news, article, photos, videos, downloads, trivia, scores */
const NAV = [['home', 'Home'], ['news', 'News'], ['photos', 'Photos'], ['videos', 'Videos'], ['downloads', 'Downloads'], ['trivia', 'Daily Trivia'], ['scores', 'Live Scores'], ['studio', 'Studio 🔒']];
const parse = () => { const h = location.hash.replace(/^#\/?/, '').split('/'); return [h[0] || 'home', h[1]]; };
const pubArticles = () => S.articles.filter((a) => a.pub);
const postCard = (a) => `<a class="card post" href="#/news/${esc(a.slug)}"><div class="im"><img loading="lazy" alt="" src="${imgSrc(a.cover, a.slug)}"></div><div class="pad"><span class="kicker">${esc(a.cat)}</span><h3>${esc(a.title)}</h3><p>${esc(a.summary || '')}</p></div></a>`;
const empty = (t, s) => `<div class="empty"><b>${t}</b><div class="small" style="margin-top:6px">${s || ''}</div></div>`;
const loading = '<div class="empty">Loading…</div>';

function vHome() {
  const arts = pubArticles(), h = arts[0];
  const live = ['soccer', 'rugby', 'cricket', 'basketball'].flatMap((k) => ((S.scores[k] && S.scores[k].data) || []).filter((m) => m.status === 'LIVE'));
  return `${h ? `<a class="card post hero" href="#/news/${esc(h.slug)}"><div class="im"><img alt="" src="${imgSrc(h.cover, h.slug, 1200, 750)}"></div><div class="pad"><span class="kicker">${esc(h.cat)} · ${fmtDate(h.date)}</span><h1>${esc(h.title)}</h1><p style="font-size:17px">${esc(h.summary || '')}</p></div></a>` : empty('No articles yet', 'Open Studio to publish your first story.')}
  ${live.length ? `<div class="sec"><div class="sec-h"><h2>Live now <span class="mute small">· ${live.length}</span></h2><a href="#/scores">All scores →</a></div><div class="ticker">${live.slice(0, 8).map(matchRow).join('')}</div></div>` : ''}
  ${arts.length > 1 ? `<div class="sec"><div class="sec-h"><h2>Latest</h2><a href="#/news">All news →</a></div><div class="grid">${arts.slice(1, 7).map(postCard).join('')}</div></div>` : ''}
  <div class="sec card pad" style="display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><span class="kicker">Daily trivia</span><h2 style="font-size:24px;margin-top:4px">Five questions from this week’s stories</h2><div class="mute small">A fresh set every day</div></div><a class="btn" href="#/trivia">Play today’s round</a></div>
  ${S.photos.length ? `<div class="sec"><div class="sec-h"><h2>Photos</h2><a href="#/photos">Gallery →</a></div><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${S.photos.slice(0, 6).map((p) => `<div class="card" style="cursor:pointer" data-act="photo" data-id="${p.id}"><img loading="lazy" alt="${esc(p.caption)}" style="aspect-ratio:1;object-fit:cover;width:100%" src="${p.src}"></div>`).join('')}</div></div>` : ''}
  ${S.downloads.length ? `<div class="sec"><div class="sec-h"><h2>Fresh downloads</h2><a href="#/downloads">Browse all →</a></div><div class="grid">${S.downloads.slice(0, 3).map(dlCard).join('')}</div></div>` : ''}`;
}

function vNews() {
  const cats = ['All', ...new Set(pubArticles().map((a) => a.cat))], f = vNews.f || 'All';
  const list = pubArticles().filter((a) => f === 'All' || a.cat === f);
  return `<div class="sec-h"><h2 style="font-size:34px">News & Features</h2></div><div class="chips" style="margin-bottom:16px">${cats.map((c) => `<button class="chip ${c === f ? 'on' : ''}" data-act="newsfilter" data-id="${esc(c)}">${esc(c)}</button>`).join('')}</div>
  <div class="grid">${list.map(postCard).join('') || empty('Nothing here yet')}</div>`;
}

function renderBody(t) {
  return t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => p.startsWith('## ') ? `<h3>${esc(p.slice(3))}</h3>` : `<p>${esc(p).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')}</p>`).join('');
}
function vArticle(slug) {
  const a = S.detail[slug];
  if (!a || a.missing) return empty('Article not found', '<a href="#/news">Back to news</a>');
  const rel = pubArticles().filter((x) => x.slug !== slug && x.cat === a.cat).slice(0, 3);
  return `<article class="article"><a class="small mute" href="#/news">← All news</a><div class="kicker" style="margin-top:14px">${esc(a.cat)}</div><h1>${esc(a.title)}</h1><div class="mute small">By ${esc(a.author || 'Staff')} · ${fmtDate(a.date)}</div>
  <div class="cover"><img alt="" src="${imgSrc(a.cover, a.slug, 1200, 675)}"></div><div class="body">${renderBody(a.body || '')}</div>
  <div style="display:flex;gap:8px;margin:24px 0"><button class="btn alt sm" data-act="copylink">Copy link</button><a class="btn sm" href="#/trivia">Test yourself: Daily trivia</a></div>
  ${rel.length ? `<h2 style="font-size:22px;margin:30px 0 12px">More ${esc(a.cat)}</h2><div class="grid">${rel.map(postCard).join('')}</div>` : ''}</article>`;
}

function vPhotos() {
  return `<div class="sec-h"><h2 style="font-size:34px">Photos</h2></div>${S.photos.length ? `<div class="masonry">${S.photos.map((p) => `<figure data-act="photo" data-id="${p.id}"><img loading="lazy" alt="${esc(p.caption)}" style="width:100%" src="${p.src}"><figcaption>${esc(p.caption)}</figcaption></figure>`).join('')}</div>` : empty('No photos yet', 'Upload images from Studio → Photos.')}`;
}
function vVideos() {
  return `<div class="sec-h"><h2 style="font-size:34px">Videos</h2></div>${S.videos.length ? `<div class="grid">${S.videos.map((v) => `<div class="card post vid" data-act="video" data-id="${v.id}"><div class="im"><img alt="" src="${imgSrc(v.thumb, 'v' + v.id, 800, 450)}"></div><div class="pad"><h3 style="font-size:18px">${esc(v.title)}</h3><p>${esc(v.desc || '')}</p></div></div>`).join('')}</div>` : empty('No videos yet', 'Upload a file or paste a video link in Studio → Videos.')}`;
}

function dlCard(d) {
  const label = d.type === 'cover' ? 'Cover art' : d.type === 'mix' ? 'Mix' : 'Wallpaper';
  const cls = d.type === 'wallpaper' ? '' : 'sq';
  return `<div class="card dl"><div class="im ${cls}"><img loading="lazy" alt="" src="${imgSrc(d.thumb, 'd' + d.id, 600, 600)}"></div><div class="pad"><span class="tag">${label}</span><h3 style="font-size:18px;margin:8px 0 0">${esc(d.title)}</h3>${d.artist ? `<div class="small mute">${esc(d.artist)}</div>` : ''}${d.type === 'mix' ? `<audio controls preload="none" src="${d.src}"></audio>` : ''}<div class="row"><a class="btn sm" href="${d.fileUrl}" download>Download</a>${d.count ? `<span class="small mute" style="align-self:center">${d.count} downloads</span>` : ''}</div></div></div>`;
}
function vDownloads() {
  const f = vDownloads.f || 'all', T = [['all', 'All'], ['wallpaper', 'Wallpapers'], ['cover', 'Cover art'], ['mix', 'Mixes']];
  const list = S.downloads.filter((d) => f === 'all' || d.type === f);
  return `<div class="sec-h"><h2 style="font-size:34px">Downloads</h2></div><div class="chips" style="margin-bottom:16px">${T.map(([k, l]) => `<button class="chip ${k === f ? 'on' : ''}" data-act="dlfilter" data-id="${k}">${l}</button>`).join('')}</div>
  <div class="grid">${list.map(dlCard).join('') || empty('Nothing in this category yet')}</div>`;
}

function vTrivia() {
  if (!S.trivia) return loading;
  const set = S.trivia.questions;
  if (!set.length) return empty('Trivia needs articles', 'Publish a few articles and questions are generated automatically.');
  const P = readProg(), answers = P.answers || [], n = answers.length, pend = P.pending;
  const bar = `<div class="prog">${set.map((_, i) => `<span class="${i < n ? 'd' : ''}"></span>`).join('')}</div>`;
  if (n >= set.length) {
    const sc = answers.filter((a) => a.correct).length;
    return `<div class="q" style="text-align:center"><span class="kicker">Today’s round complete</span><div class="score" style="margin:14px 0">${sc}/${set.length}</div><p class="mute">${sc === set.length ? 'Perfect round!' : sc >= 3 ? 'Nice work.' : 'Read the stories and try again tomorrow.'}${P.streak > 1 ? ` · 🔥 ${P.streak}-day streak` : ''}</p>
    <div style="text-align:left;margin:20px 0">${set.map((s, i) => `<div class="list-row" style="align-items:flex-start"><span>${answers[i].correct ? '✅' : '❌'}</span><div style="flex:1"><div class="small mute">${esc(s.src)}</div>${esc(s.q.replace('_____', s.options[answers[i].answer]))}<div class="small"><b>${esc(s.options[answers[i].answer])}</b></div></div></div>`).join('')}</div>
    <button class="btn" data-act="shareTrivia">Share my score</button><p class="mute small">New questions arrive tomorrow.</p></div>`;
  }
  const q = set[n];
  return `<div class="q">${bar}<div class="mute small">Question ${n + 1} of ${set.length} · from “${esc(q.src)}”</div><h2>${esc(q.q)}</h2>
  ${q.options.map((o, i) => `<button class="opt ${pend ? (i === pend.answer ? 'ok' : i === pend.choice ? 'no' : '') : ''}" ${pend ? 'disabled' : ''} data-act="answer" data-id="${i}">${esc(o)}</button>`).join('')}
  ${pend ? `<button class="btn" data-act="nextq" style="margin-top:6px">${n + 1 === set.length ? 'See results' : 'Next question'}</button>` : ''}</div>`;
}

function vScores() {
  const d = S.scores[sport];
  let body;
  if (!d) body = loading;
  else if (d.error) body = empty('Scores are unavailable right now', esc(d.error));
  else if (sport === 'golf' || sport === 'f1') {
    const x = d.data;
    body = !x || !x.rows ? empty('No data') : `<div class="card"><div class="pad" style="border-bottom:1px solid var(--line)"><b>${esc(x.event)}</b><div class="small mute">${esc(x.status)}</div></div><div style="overflow-x:auto"><table class="lb"><thead><tr>${sport === 'golf' ? '<th>Pos</th><th>Player</th><th>To par</th><th>Thru</th>' : '<th>Pos</th><th>Driver</th><th>Team</th><th>Gap</th>'}</tr></thead><tbody>${x.rows.map((r) => `<tr>${r.map((c, i) => `<td ${i === 1 ? 'style="font-weight:600"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  } else body = d.data.length ? `<div class="card">${d.data.map(matchRow).join('')}</div>` : empty('No fixtures right now');
  const banner = !d || d.error ? '' : `<div class="banner">${d.source === 'live' ? 'Live data' : 'Demo data (fictional teams) — connect a provider on the server'} · updated ${new Date(d.updatedAt).toLocaleTimeString()}${d.stale ? ' · provider unreachable, showing last known scores' : ''}</div>`;
  return `<div class="sec-h"><h2 style="font-size:34px">Live Scores</h2></div><div class="chips">${SPORTS.map(([k, l, e]) => `<button class="chip ${k === sport ? 'on' : ''}" data-act="sport" data-id="${k}">${e} ${l}</button>`).join('')}</div>${banner}${body}`;
}
