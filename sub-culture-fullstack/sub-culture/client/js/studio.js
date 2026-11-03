/* Studio (admin): sign-in and the role-based management panels */
let stuTab = 'articles';
const TABS = {
  admin: ['articles', 'photos', 'videos', 'downloads', 'trivia', 'scores', 'users', 'account'],
  editor: ['articles', 'photos', 'videos', 'downloads', 'trivia', 'scores', 'account'],
  writer: ['articles', 'account'],
  artist: ['downloads', 'account'],
};
const TAB_LABEL = { articles: 'Articles', photos: 'Photos', videos: 'Videos', downloads: 'Downloads', trivia: 'Trivia', scores: 'Scores', users: 'Users', account: 'Account' };
const fld = (label, inner) => `<label class="field"><span>${label}</span>${inner}</label>`;
const stuCard = (inner, mt) => `<div class="card pad" ${mt ? 'style="margin-top:16px"' : ''}>${inner}</div>`;

function vStudio() {
  if (!S.me) {
    return `<div class="q"><span class="kicker">Studio</span><h2>Sign in</h2><p class="mute small">For writers, editors, artists and admins.</p>
    ${fld('Email', '<input type="text" id="li-email" autocomplete="username">')}${fld('Password', '<input type="password" id="li-pw" autocomplete="current-password">')}
    <button class="btn" data-act="login">Sign in</button></div>`;
  }
  const tabs = TABS[S.me.role] || ['account'];
  if (!tabs.includes(stuTab)) stuTab = tabs[0];
  const panels = { articles: sArticles, photos: sPhotos, videos: sVideos, downloads: sDownloads, trivia: sTrivia, scores: sScores, users: sUsers, account: sAccount };
  return `<div class="sec-h"><h2 style="font-size:34px">Studio</h2><span class="small mute">${esc(S.me.name)} · ${esc(S.me.role)}</span></div>
  <div class="stu-tabs">${tabs.map((k) => `<button class="chip ${k === stuTab ? 'on' : ''}" data-act="stab" data-id="${k}">${TAB_LABEL[k]}</button>`).join('')}</div>${panels[stuTab]()}`;
}

function sArticles() {
  const list = S.stu.articles;
  if (!list) return loading;
  const e = S.stu.edit || {};
  const cats = ['News', 'Soccer', 'Rugby', 'Cricket', 'Basketball', 'Golf', 'Formula 1', 'Music', 'Culture', 'Opinion'];
  if (e.cat && !cats.includes(e.cat)) cats.push(e.cat);
  return stuCard(`<h3 style="font-size:22px;margin-bottom:14px">${e.id ? 'Edit article' : 'New article'}</h3>
   ${fld('Headline', `<input type="text" id="a-title" value="${esc(e.title || '')}">`)}
   <div class="two">${fld('Category', `<select id="a-cat">${cats.map((c) => `<option ${e.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select>`)}${isStaff() ? fld('Byline (optional)', `<input type="text" id="a-author" value="${esc(e.author || '')}">`) : ''}</div>
   ${fld('Summary (one line)', `<input type="text" id="a-sum" value="${esc(e.summary || '')}">`)}
   ${fld(`Cover image ${e.cover ? '(leave empty to keep the current one)' : '(optional)'}`, '<input type="file" id="a-cover" accept="image/jpeg,image/png,image/webp,image/gif">')}
   ${fld('Body — blank line between paragraphs · “## ” starts a subheading · **bold**', `<textarea id="a-body">${esc(e.body || '')}</textarea>`)}
   <label class="field" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="a-pub" ${e.id ? (e.pub ? 'checked' : '') : 'checked'}> <span style="margin:0">Published (uncheck to save as draft)</span></label>
   <div style="display:flex;gap:8px"><button class="btn" data-act="saveArticle">${e.id ? 'Update' : 'Publish'}</button>${e.id ? '<button class="btn alt" data-act="cancelEdit">Cancel</button>' : ''}</div>`)
  + stuCard(`<h3 style="font-size:20px;margin-bottom:8px">${S.me.role === 'writer' ? 'Your articles' : 'All articles'} (${list.length})</h3>${list.map((a) => `<div class="list-row"><div style="min-width:0"><div class="tt">${esc(a.title)}</div><div class="small mute">${esc(a.cat)} · ${a.pub ? 'Published' : 'Draft'} · ${esc(a.author)}</div></div><div style="display:flex;gap:6px"><button class="btn alt sm" data-act="editArticle" data-id="${a.id}">Edit</button><button class="btn danger sm" data-act="delArticle" data-id="${a.id}">Delete</button></div></div>`).join('') || '<div class="mute">None yet.</div>'}`, 1);
}
function sPhotos() {
  return stuCard(`<h3 style="font-size:22px;margin-bottom:14px">Upload photos</h3>${fld('Images (JPEG, PNG, WebP or GIF, up to 15 MB each)', '<input type="file" id="ph-files" accept="image/jpeg,image/png,image/webp,image/gif" multiple>')}${fld('Caption (applies to all selected)', '<input type="text" id="ph-cap">')}<button class="btn" data-act="addPhotos">Upload</button>`)
  + stuCard(S.photos.map((p) => `<div class="list-row"><div style="display:flex;gap:10px;align-items:center;min-width:0"><img alt="" style="width:46px;height:46px;border-radius:8px;object-fit:cover" src="${p.src}"><span class="tt">${esc(p.caption)}</span></div><button class="btn danger sm" data-act="delPhoto" data-id="${p.id}">Delete</button></div>`).join('') || '<div class="mute">No photos.</div>', 1);
}
function sVideos() {
  return stuCard(`<h3 style="font-size:22px;margin-bottom:14px">Add video</h3>${fld('Title', '<input type="text" id="v-title">')}${fld('Description', '<input type="text" id="v-desc">')}${fld('Upload a file (mp4, webm or mov, up to 250 MB)', '<input type="file" id="v-file" accept="video/mp4,video/webm,video/quicktime">')}${fld('Thumbnail (optional)', '<input type="file" id="v-thumb" accept="image/*">')}${fld('…or paste a link (YouTube, Vimeo or direct .mp4)', '<input type="url" id="v-url" placeholder="https://">')}<button class="btn" data-act="addVideo">Add video</button>`)
  + stuCard(S.videos.map((v) => `<div class="list-row"><span class="tt">${esc(v.title)}</span><button class="btn danger sm" data-act="delVideo" data-id="${v.id}">Delete</button></div>`).join('') || '<div class="mute">No videos.</div>', 1);
}
function sDownloads() {
  const list = S.stu.downloads;
  if (!list) return loading;
  const artist = S.me.role === 'artist';
  return stuCard(`<h3 style="font-size:22px;margin-bottom:6px">Add a download</h3>${artist ? '<p class="mute small">Your uploads are reviewed by the team before they appear on the site.</p>' : ''}
   <div class="two">${fld('Type', '<select id="d-type"><option value="mix">Mix (audio)</option><option value="wallpaper">Wallpaper</option><option value="cover">Cover art</option></select>')}${fld('Title', '<input type="text" id="d-title">')}</div>
   ${fld('Artist / credit (optional)', '<input type="text" id="d-artist">')}${fld('File (images up to 15 MB; audio mp3/wav/m4a/flac/ogg up to 150 MB)', '<input type="file" id="d-file" accept="image/jpeg,image/png,image/webp,audio/*">')}${fld('Preview image for mixes (optional)', '<input type="file" id="d-prev" accept="image/*">')}<button class="btn" data-act="addDownload">Upload</button>`)
  + stuCard(list.map((d) => `<div class="list-row"><div style="min-width:0"><div class="tt">${esc(d.title)}</div><div class="small mute">${d.type} · <b>${d.status}</b>${d.uploader ? ' · ' + esc(d.uploader) : ''} · ${d.count} downloads</div></div><div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${isStaff() && d.status !== 'approved' ? `<button class="btn sm" data-act="dlStatus" data-id="${d.id}" data-v="approved">Approve</button>` : ''}${isStaff() && d.status === 'approved' ? `<button class="btn alt sm" data-act="dlStatus" data-id="${d.id}" data-v="rejected">Unpublish</button>` : ''}<button class="btn danger sm" data-act="delDownload" data-id="${d.id}">Delete</button></div></div>`).join('') || '<div class="mute">Nothing yet.</div>', 1);
}
function sTrivia() {
  const qs = S.stu.questions;
  if (!qs) return loading;
  return stuCard(`<h3 style="font-size:22px;margin-bottom:6px">Daily trivia</h3><p class="mute small">Questions are generated automatically from published articles (${qs.filter((q) => q.source === 'auto').length} now). Each day shows a stable set of 5.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn alt sm" data-act="regenTrivia">Rebuild auto questions</button><button class="btn alt sm" data-act="aiTrivia">✨ Generate extra with Claude</button></div>`)
  + stuCard(`<h3 style="font-size:20px;margin-bottom:10px">Add your own question</h3>${fld('Question', '<input type="text" id="t-q">')}<div class="two">${fld('Correct answer', '<input type="text" id="t-a">')}${fld('Wrong answer 1', '<input type="text" id="t-w1">')}${fld('Wrong answer 2', '<input type="text" id="t-w2">')}${fld('Wrong answer 3', '<input type="text" id="t-w3">')}</div><button class="btn" data-act="addQ">Add question</button>`, 1)
  + stuCard(`<h3 style="font-size:20px;margin-bottom:8px">Question bank (${qs.length})</h3>${qs.slice(0, 80).map((q) => `<div class="list-row" style="align-items:flex-start"><div style="min-width:0;flex:1;${q.active ? '' : 'opacity:.5'}"><div class="small mute">${esc(q.source)} · ${esc(q.src)}</div>${esc(q.q)}<div class="small"><b>${esc(q.options[q.answer])}</b></div></div><div style="display:flex;gap:6px"><button class="btn alt sm" data-act="toggleQ" data-id="${q.id}" data-v="${q.active ? 0 : 1}">${q.active ? 'Hide' : 'Show'}</button><button class="btn danger sm" data-act="delQ" data-id="${q.id}">✕</button></div></div>`).join('') || '<div class="mute">Publish articles to generate questions.</div>'}`, 1);
}
function sScores() {
  const man = S.stu.manual || [];
  return stuCard(`<h3 style="font-size:22px;margin-bottom:6px">Manual fixtures</h3><p class="mute small">Add or correct a match when no feed covers it. Live providers are configured on the server (.env).</p>
   <div class="two">${fld('Sport', `<select id="m-sport">${SPORTS.filter((x) => !['golf', 'f1'].includes(x[0])).map((x) => `<option value="${x[0]}">${x[1]}</option>`).join('')}</select>`)}${fld('Competition', '<input type="text" id="m-lg">')}${fld('Home', '<input type="text" id="m-h">')}${fld('Away', '<input type="text" id="m-a">')}${fld('Home score', '<input type="text" id="m-hs">')}${fld('Away score', '<input type="text" id="m-as">')}${fld('Status', '<select id="m-st"><option>LIVE</option><option>FT</option><option>UP</option></select>')}${fld('Clock / kick-off', '<input type="text" id="m-clock" placeholder="67\' or 20:45">')}</div><button class="btn" data-act="addMatch">Add</button>`)
  + stuCard(man.map((m) => `<div class="list-row"><span class="tt">${esc(m.sport)} · ${esc(m.home)} v ${esc(m.away)}</span><button class="btn danger sm" data-act="delMatch" data-id="${m.id}">Delete</button></div>`).join('') || '<div class="mute">No manual fixtures.</div>', 1);
}
function sUsers() {
  const us = S.stu.users;
  if (!us) return loading;
  return stuCard(`<h3 style="font-size:22px;margin-bottom:14px">Add a user</h3><div class="two">${fld('Name', '<input type="text" id="u-name">')}${fld('Email', '<input type="text" id="u-email">')}${fld('Role', '<select id="u-role"><option value="writer">Writer / journalist</option><option value="editor">Editor</option><option value="artist">Artist</option><option value="admin">Admin</option></select>')}${fld('Temporary password (10+ chars)', '<input type="password" id="u-pw" autocomplete="new-password">')}</div><button class="btn" data-act="addUser">Create user</button>`)
  + stuCard(us.map((u) => `<div class="list-row"><div style="min-width:0"><div class="tt">${esc(u.name)}</div><div class="small mute">${esc(u.email)} · ${u.role}${u.active ? '' : ' · disabled'}</div></div><button class="btn alt sm" data-act="toggleUser" data-id="${u.id}" data-v="${u.active ? 0 : 1}">${u.active ? 'Disable' : 'Enable'}</button></div>`).join(''), 1);
}
function sAccount() {
  return stuCard(`<h3 style="font-size:22px;margin-bottom:14px">Account</h3><p class="mute small">${esc(S.me.email)}</p>${fld('Current password', '<input type="password" id="pw-cur" autocomplete="current-password">')}${fld('New password (10+ chars)', '<input type="password" id="pw-new" autocomplete="new-password">')}<div style="display:flex;gap:8px"><button class="btn" data-act="changePw">Change password</button><button class="btn alt" data-act="logout">Sign out</button></div>`);
}

// Fetches whatever the open tab needs, then redraws.
async function loadStudio() {
  if (!S.me) return render(true);
  try {
    if (stuTab === 'articles') S.stu.articles = (await api('/articles?status=all&limit=50')).items;
    if (stuTab === 'photos' || stuTab === 'videos') await loadPublic();
    if (stuTab === 'downloads') S.stu.downloads = (await api('/downloads?scope=' + (isStaff() ? 'all' : 'mine'))).items;
    if (stuTab === 'trivia') S.stu.questions = (await api('/trivia/questions')).items;
    if (stuTab === 'scores') {
      const ms = ['soccer', 'rugby', 'cricket', 'basketball'];
      await loadScores(ms);
      S.stu.manual = ms.flatMap((k) => ((S.scores[k] && S.scores[k].data) || []).filter((m) => m.manual).map((m) => ({ ...m, sport: k })));
    }
    if (stuTab === 'users') S.stu.users = (await api('/users')).items;
  } catch (e) { toast(e.message); }
  render(true);
}
