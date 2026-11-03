/* API client and shared app state. All data now comes from the Express server under /api. */
let S = { articles: [], photos: [], videos: [], downloads: [], me: null, detail: {}, scores: {}, trivia: null, stu: {} };

async function api(path, { method = 'GET', body, form } = {}) {
  const opts = { method, credentials: 'same-origin', headers: { 'X-Requested-With': 'sub-culture' } };
  if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  if (form) opts.body = form;
  const r = await fetch('/api' + path, opts);
  let data = null;
  if (r.status !== 204) { try { data = await r.json(); } catch { /* empty body */ } }
  if (!r.ok) throw Object.assign(new Error((data && data.error) || r.statusText || 'Request failed'), { status: r.status });
  return data;
}

const imgSrc = (src, seed = 'x', w = 800, h = 500) => src || artURL(seed, w, h);
const isStaff = () => !!S.me && ['admin', 'editor'].includes(S.me.role);

async function loadPublic() {
  const get = (p) => api(p).catch(() => null);
  const [a, p, v, d] = await Promise.all([get('/articles?limit=50'), get('/photos'), get('/videos'), get('/downloads')]);
  if (a) S.articles = a.items;
  if (p) S.photos = p.items;
  if (v) S.videos = v.items;
  if (d) S.downloads = d.items;
}
async function loadMe() { try { S.me = (await api('/auth/me')).user; } catch { S.me = null; } }
