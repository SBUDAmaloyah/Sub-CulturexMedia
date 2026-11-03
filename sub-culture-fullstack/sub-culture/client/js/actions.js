/* Click and change handlers (data-act actions) and uploads. Every handler may throw; errors show as a toast. */
function videoModal(v) {
  const u = v.url || '';
  const yt = u.match(/(?:youtu\.be\/|v=)([\w-]{11})/), vm = u.match(/vimeo\.com\/(\d+)/);
  let h;
  if (v.src) h = `<video controls autoplay playsinline src="${esc(v.src)}"></video>`;
  else if (yt) h = `<iframe style="width:100%;aspect-ratio:16/9;border:0" allowfullscreen src="https://www.youtube.com/embed/${yt[1]}"></iframe>`;
  else if (vm) h = `<iframe style="width:100%;aspect-ratio:16/9;border:0" allowfullscreen src="https://player.vimeo.com/video/${vm[1]}"></iframe>`;
  else h = `<video controls autoplay playsinline src="${esc(u)}"></video>`;
  openModal(h + `<div class="pad"><h3 style="font-size:20px">${esc(v.title)}</h3><p class="mute small">${esc(v.desc || '')}</p>${u ? `<a class="small" target="_blank" rel="noopener" href="${esc(u)}">Open original ↗</a>` : ''}</div>`);
}
const val = (id) => $('#' + id).value.trim();
const files = (id) => [...$('#' + id).files];
async function refresh() { await loadPublic(); await loadStudio(); }

const A = {
  theme() { const r = document.documentElement; const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme:dark)').matches; r.dataset.theme = dark ? 'light' : 'dark'; },
  closeModal,
  copylink() { navigator.clipboard?.writeText(location.href).then(() => toast('Link copied')).catch(() => toast('Copy not available')); },
  newsfilter(el) { vNews.f = el.dataset.id; render(true); },
  dlfilter(el) { vDownloads.f = el.dataset.id; render(true); },
  photo(el) { const p = S.photos.find((x) => x.id == el.dataset.id); if (p) openModal(`<img alt="${esc(p.caption)}" src="${p.src}"><div class="pad">${esc(p.caption)}</div>`); },
  video(el) { const v = S.videos.find((x) => x.id == el.dataset.id); if (v) videoModal(v); },
  async sport(el) { sport = el.dataset.id; render(true); await loadScores([sport]); if (parse()[0] === 'scores') render(true); },

  // ---- trivia ----
  async answer(el) {
    const P = readProg(); if (P.pending) return;
    const q = S.trivia.questions[(P.answers || []).length], choice = +el.dataset.id;
    const r = await api('/trivia/answer', { method: 'POST', body: { id: q.id, choice } });
    P.pending = { choice, answer: r.answer, correct: r.correct }; writeProg(P); render(true);
  },
  nextq() {
    const P = readProg(); P.answers.push(P.pending); delete P.pending;
    if (P.answers.length >= S.trivia.questions.length) {
      const y = new Date(Date.parse(S.trivia.date + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10);
      P.streak = P.last === y ? (P.streak || 0) + 1 : 1; P.last = S.trivia.date;
    }
    writeProg(P); render();
  },
  shareTrivia() {
    const P = readProg(), set = S.trivia.questions, sc = P.answers.filter((a) => a.correct).length;
    const t = `Sub Culture Daily Trivia ${S.trivia.date}: ${sc}/${set.length}\n` + P.answers.map((a) => (a.correct ? '🟩' : '🟥')).join('');
    if (navigator.share) navigator.share({ text: t }).catch(() => {}); else navigator.clipboard?.writeText(t).then(() => toast('Score copied'));
  },

  // ---- studio: session ----
  async login() {
    const r = await api('/auth/login', { method: 'POST', body: { email: val('li-email'), password: $('#li-pw').value } });
    S.me = r.user; S.stu = {}; stuTab = (TABS[S.me.role] || ['account'])[0]; await loadStudio();
  },
  async logout() { await api('/auth/logout', { method: 'POST', body: {} }); S.me = null; S.stu = {}; render(true); },
  async stab(el) { stuTab = el.dataset.id; S.stu.edit = null; render(true); await loadStudio(); },
  async changePw() { await api('/auth/me/password', { method: 'PATCH', body: { current: $('#pw-cur').value, next: $('#pw-new').value } }); toast('Password changed'); $('#pw-cur').value = $('#pw-new').value = ''; },

  // ---- studio: articles ----
  async editArticle(el) { S.stu.edit = await api('/articles/' + el.dataset.id); render(true); window.scrollTo(0, 0); },
  cancelEdit() { S.stu.edit = null; render(true); },
  async delArticle(el) { if (!confirm('Delete this article?')) return; await api('/articles/' + el.dataset.id, { method: 'DELETE' }); S.detail = {}; await refresh(); },
  async saveArticle() {
    const e = S.stu.edit, title = val('a-title'), body = val('a-body');
    if (!title || !body) return toast('Headline and body are required');
    const data = { title, body, category: $('#a-cat').value, summary: val('a-sum'), status: $('#a-pub').checked ? 'published' : 'draft' };
    if ($('#a-author')) data.authorName = val('a-author');
    const f = files('a-cover')[0];
    if (f) { const fd = new FormData(); fd.append('file', f); data.coverMediaId = (await api('/media', { method: 'POST', form: fd })).id; }
    if (e && e.id) await api('/articles/' + e.id, { method: 'PUT', body: data }); else await api('/articles', { method: 'POST', body: data });
    S.stu.edit = null; S.detail = {}; toast(data.status === 'published' ? 'Published' : 'Saved as draft'); await refresh();
  },

  // ---- studio: media ----
  async addPhotos() {
    const fs = files('ph-files'); if (!fs.length) return toast('Choose images first');
    const fd = new FormData(); fs.forEach((f) => fd.append('files', f)); fd.append('caption', val('ph-cap'));
    await api('/photos', { method: 'POST', form: fd }); toast('Uploaded'); await refresh();
  },
  async delPhoto(el) { await api('/photos/' + el.dataset.id, { method: 'DELETE' }); await refresh(); },
  async addVideo() {
    const title = val('v-title'), url = val('v-url'), f = files('v-file')[0], t = files('v-thumb')[0];
    if (!title || (!url && !f)) return toast('Add a title and a file or link');
    const fd = new FormData(); fd.append('title', title); fd.append('description', val('v-desc'));
    if (f) fd.append('file', f); else fd.append('url', url);
    if (t) fd.append('thumb', t);
    await api('/videos', { method: 'POST', form: fd }); toast('Video added'); await refresh();
  },
  async delVideo(el) { await api('/videos/' + el.dataset.id, { method: 'DELETE' }); await refresh(); },
  async addDownload() {
    const f = files('d-file')[0], title = val('d-title'); if (!f || !title) return toast('Add a title and file');
    const fd = new FormData(); fd.append('type', $('#d-type').value); fd.append('title', title); fd.append('artistName', val('d-artist')); fd.append('file', f);
    const p = files('d-prev')[0]; if (p) fd.append('preview', p);
    await api('/downloads', { method: 'POST', form: fd }); toast(isStaff() ? 'Published' : 'Uploaded — waiting for approval'); await refresh();
  },
  async dlStatus(el) { await api(`/downloads/${el.dataset.id}/status`, { method: 'PATCH', body: { status: el.dataset.v } }); await refresh(); },
  async delDownload(el) { if (!confirm('Delete this upload?')) return; await api('/downloads/' + el.dataset.id, { method: 'DELETE' }); await refresh(); },

  // ---- studio: trivia / scores / users ----
  async addQ() {
    const a = val('t-a'), w = ['t-w1', 't-w2', 't-w3'].map(val), q = val('t-q');
    if (!q || !a || w.some((x) => !x)) return toast('Fill every field');
    const options = shuffle([a, ...w], q + Date.now());
    await api('/trivia/questions', { method: 'POST', body: { q, options, answer: options.indexOf(a) } }); toast('Question added'); await loadStudio();
  },
  async delQ(el) { await api('/trivia/questions/' + el.dataset.id, { method: 'DELETE' }); await loadStudio(); },
  async toggleQ(el) { await api('/trivia/questions/' + el.dataset.id, { method: 'PATCH', body: { active: el.dataset.v === '1' } }); await loadStudio(); },
  async regenTrivia() { const r = await api('/trivia/regenerate', { method: 'POST', body: {} }); toast(`Rebuilt — ${r.created} questions`); await loadStudio(); },
  async aiTrivia() { toast('Asking Claude…'); const r = await api('/trivia/generate-ai', { method: 'POST', body: {} }); toast(`Added ${r.created} questions`); await loadStudio(); },
  async addMatch() {
    if (!val('m-h') || !val('m-a')) return toast('Enter both teams');
    const st = $('#m-st').value, c = val('m-clock'), body = { sport: $('#m-sport').value, league: val('m-lg'), home: val('m-h'), away: val('m-a'), status: st };
    if (val('m-hs') !== '') body.hs = val('m-hs'); if (val('m-as') !== '') body.as = val('m-as');
    if (st === 'UP') { if (c) body.time = c; } else if (c) body.clock = c;
    await api('/scores/manual', { method: 'POST', body }); toast('Match added'); await loadStudio();
  },
  async delMatch(el) { await api('/scores/manual/' + el.dataset.id, { method: 'DELETE' }); await loadStudio(); },
  async addUser() {
    await api('/users', { method: 'POST', body: { name: val('u-name'), email: val('u-email'), role: $('#u-role').value, password: $('#u-pw').value } });
    toast('User created'); await loadStudio();
  },
  async toggleUser(el) { await api('/users/' + el.dataset.id, { method: 'PATCH', body: { active: el.dataset.v === '1' } }); await loadStudio(); },
};

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (el && A[el.dataset.act]) {
    try { await A[el.dataset.act](el); } catch (err) { toast(err.message || 'Something went wrong'); }
  } else if (e.target.id === 'modal') closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'Enter' && (e.target.id === 'li-pw' || e.target.id === 'li-email')) A.login().catch((err) => toast(err.message));
});
