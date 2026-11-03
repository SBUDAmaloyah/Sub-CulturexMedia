const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-test-'));
Object.assign(process.env, {
  NODE_ENV: 'test', DB_PATH: path.join(tmp, 'test.db'), UPLOAD_DIR: path.join(tmp, 'uploads'),
  CLIENT_DIR: path.join(__dirname, '../../client'), JWT_SECRET: 'x'.repeat(48), ALLOW_ARTIST_SIGNUP: 'true',
  SCORES_SOCCER: 'demo', SCORES_F1: 'demo',
});
const bcrypt = require('bcryptjs');
const db = require('../src/db');
const { createApp } = require('../src/app');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
let server, base;

async function call(method, url, { body, form, cookie, headers = {} } = {}) {
  const h = { 'x-requested-with': 'sub-culture', ...headers };
  if (cookie) h.cookie = cookie;
  let payload;
  if (body) { h['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  if (form) payload = form;
  const res = await fetch(base + url, { method, headers: h, body: payload, redirect: 'manual' });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : null;
  return { status: res.status, data, res };
}
async function login(email, password) {
  const r = await call('POST', '/api/auth/login', { body: { email, password } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.res.headers.getSetCookie()[0].split(';')[0];
}
const file = (buf, type, name) => { const f = new FormData(); f.append('file', new Blob([buf], { type }), name); return f; };

before(async () => {
  db.prepare('INSERT INTO users(email,name,password_hash,role,created_at) VALUES(?,?,?,?,?)')
    .run('admin@test.dev', 'Admin', bcrypt.hashSync('correct-horse-battery', 4), 'admin', Date.now());
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); db.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

let admin;
test('login rejects bad password and accepts good one', async () => {
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'admin@test.dev', password: 'nope' } })).status, 401);
  admin = await login('admin@test.dev', 'correct-horse-battery');
  const me = await call('GET', '/api/auth/me', { cookie: admin });
  assert.equal(me.data.user.role, 'admin');
});

test('cookie sessions need the CSRF header on writes', async () => {
  const r = await call('POST', '/api/articles', { cookie: admin, headers: { 'x-requested-with': '' }, body: { title: 'abc', category: 'News', body: 'x' } });
  assert.equal(r.status, 403);
});

test('articles: drafts hidden, published visible, trivia generated', async () => {
  const mk = (title, cat, body, status) => call('POST', '/api/articles', { cookie: admin, body: { title, category: cat, body, summary: 's', status } });
  const draft = await mk('Secret draft story', 'News', 'Nothing public here yet at all, just a draft sentence of some length.', 'draft');
  assert.equal(draft.status, 201);
  await mk('Lions win thriller', 'Rugby', 'Capital Lions beat Royal Park Rams 27-24 after Sipho Dlamini landed a penalty from 48 metres on the final whistle. Coach Aiyana Brooks praised the squad after 80 minutes of rugby.', 'published');
  await mk('Harbour City crowned', 'Soccer', 'Harbour City FC sealed their first league title in 14 years at Dockside Arena. Tomas Verhoeven scored in the 88th minute in front of 41,000 supporters.', 'published');
  const list = await call('GET', '/api/articles');
  assert.equal(list.data.total, 2);
  assert.ok(!list.data.items.some((a) => a.title === 'Secret draft story'));
  assert.equal((await call('GET', '/api/articles/' + draft.data.slug)).status, 404);
  assert.equal((await call('GET', '/api/articles/' + draft.data.slug, { cookie: admin })).status, 200);
  const all = await call('GET', '/api/articles?status=all', { cookie: admin });
  assert.equal(all.data.total, 3);
  const detail = await call('GET', '/api/articles/harbour-city-crowned');
  assert.match(detail.data.body, /Dockside/);
  const qs = await call('GET', '/api/trivia/questions', { cookie: admin });
  assert.ok(qs.data.items.length >= 2, 'auto questions created');
});

test('daily trivia hides answers and checks them server-side', async () => {
  const d = await call('GET', '/api/trivia/daily');
  assert.ok(d.data.questions.length > 0);
  assert.ok(!('answer' in d.data.questions[0]));
  const q = d.data.questions[0];
  const results = await Promise.all([0, 1, 2, 3].map((c) => call('POST', '/api/trivia/answer', { body: { id: q.id, choice: c } })));
  assert.equal(results.filter((r) => r.data.correct).length, 1);
  assert.equal((await call('POST', '/api/trivia/answer', { body: { id: 999999, choice: 0 } })).status, 404);
});

test('photos: upload requires staff and real image bytes', async () => {
  const f = file(PNG, 'image/png', 'dot.png'); f.delete('file'); f.append('files', new Blob([PNG], { type: 'image/png' }), 'dot.png'); f.append('caption', 'Floodlights');
  assert.equal((await call('POST', '/api/photos', { form: f })).status, 401);
  const ok = await call('POST', '/api/photos', { cookie: admin, form: f });
  assert.equal(ok.status, 201);
  const src = ok.data.items[0].src;
  const served = await fetch(base + src);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('x-content-type-options'), 'nosniff');
  const fake = new FormData(); fake.append('files', new Blob(['<script>alert(1)</script>'], { type: 'image/png' }), 'x.png');
  assert.equal((await call('POST', '/api/photos', { cookie: admin, form: fake })).status, 415);
  const svg = new FormData(); svg.append('files', new Blob(['<svg/>'], { type: 'image/svg+xml' }), 'x.svg');
  assert.equal((await call('POST', '/api/photos', { cookie: admin, form: svg })).status, 415);
  assert.equal((await call('GET', '/api/photos')).data.items.length, 1);
});

test('artist uploads wait for approval, then download and count', async () => {
  const s = await call('POST', '/api/auth/signup', { body: { email: 'dj@test.dev', name: 'DJ Test', password: 'a-long-password-1' } });
  assert.equal(s.status, 201);
  const artist = s.res.headers.getSetCookie()[0].split(';')[0];
  assert.equal((await call('POST', '/api/articles', { cookie: artist, body: { title: 'Nope nope', category: 'News', body: 'x' } })).status, 403);
  const form = new FormData(); form.append('type', 'wallpaper'); form.append('title', 'Neon Tide');
  form.append('file', new Blob([PNG], { type: 'image/png' }), 'neon.png');
  const up = await call('POST', '/api/downloads', { cookie: artist, form });
  assert.equal(up.status, 201);
  assert.equal(up.data.status, 'pending');
  assert.equal((await call('GET', '/api/downloads')).data.items.length, 0);
  assert.equal((await call('GET', '/api/downloads/' + up.data.id + '/file')).status, 404);
  assert.equal((await call('PATCH', `/api/downloads/${up.data.id}/status`, { cookie: artist, body: { status: 'approved' } })).status, 403);
  assert.equal((await call('PATCH', `/api/downloads/${up.data.id}/status`, { cookie: admin, body: { status: 'approved' } })).status, 200);
  assert.equal((await call('GET', '/api/downloads')).data.items.length, 1);
  const dl = await fetch(base + `/api/downloads/${up.data.id}/file`);
  assert.equal(dl.status, 200);
  assert.match(dl.headers.get('content-disposition'), /attachment; filename="neon-tide\.png"/);
  assert.equal((await call('GET', '/api/downloads')).data.items[0].count, 1);
  const mixBad = new FormData(); mixBad.append('type', 'mix'); mixBad.append('title', 'Bad mix'); mixBad.append('file', new Blob([PNG], { type: 'image/png' }), 'm.png');
  assert.equal((await call('POST', '/api/downloads', { cookie: artist, form: mixBad })).status, 415);
});

test('writers can only edit their own articles', async () => {
  await call('POST', '/api/users', { cookie: admin, body: { email: 'w@test.dev', name: 'Wendy Writer', role: 'writer', password: 'writer-password-1' } });
  const w = await login('w@test.dev', 'writer-password-1');
  const mine = await call('POST', '/api/articles', { cookie: w, body: { title: 'My first piece', category: 'Culture', body: 'Hello world body text.', status: 'published' } });
  assert.equal(mine.status, 201);
  assert.equal(mine.data.author, 'Wendy Writer');
  const other = (await call('GET', '/api/articles/harbour-city-crowned')).data;
  assert.equal((await call('PUT', '/api/articles/' + other.id, { cookie: w, body: { title: 'Hijacked' } })).status, 403);
  assert.equal((await call('PUT', '/api/articles/' + mine.data.id, { cookie: w, body: { title: 'My edited piece' } })).status, 200);
  assert.equal((await call('GET', '/api/users', { cookie: w })).status, 403);
});

test('scores: demo data, manual fixtures, unknown sport', async () => {
  const s = await call('GET', '/api/scores/soccer');
  assert.equal(s.data.source, 'demo');
  assert.ok(s.data.data.length > 0);
  const g = await call('GET', '/api/scores/f1');
  assert.ok(g.data.data.rows.length > 0);
  assert.equal((await call('GET', '/api/scores/curling')).status, 404);
  const m = await call('POST', '/api/scores/manual', { cookie: admin, body: { sport: 'soccer', home: 'A FC', away: 'B FC', hs: 1, as: 0, status: 'LIVE', clock: "12'" } });
  assert.equal(m.status, 201);
  assert.equal((await call('GET', '/api/scores/soccer')).data.data[0].home, 'A FC');
});

test('front end is served; last admin cannot be removed', async () => {
  const home = await fetch(base + '/');
  assert.equal(home.status, 200);
  const me = (await call('GET', '/api/auth/me', { cookie: admin })).data.user;
  assert.equal((await call('PATCH', '/api/users/' + me.id, { cookie: admin, body: { active: false } })).status, 400);
});

test('trivia generator keeps decimals inside sentences', () => {
  const { questionsFor } = require('../src/services/trivia');
  const qs = questionsFor({ body: 'Mateo Rinaldi won the Coastal Grand Prix by 0.8 seconds after defending for 12 laps. Teammate Hana Ito finished third at the circuit.' }, ['Mateo Rinaldi', 'Hana Ito', 'Coastal Grand', 'Veloce Racing']);
  assert.ok(qs.length >= 1);
  assert.ok(qs.every((q) => !/by 0\._/.test(q.question) && !q.question.endsWith('by 0.')));
  assert.ok(qs.some((q) => q.options.includes('0.8') || q.question.includes('0.8')));
});
