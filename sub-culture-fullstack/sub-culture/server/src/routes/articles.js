const router = require('express').Router();
const { z } = require('zod');
const db = require('../db');
const { requireRole, isStaff } = require('../auth');
const { wrap, parse, slugify, HttpError } = require('../utils');
const { getMedia, removeMedia } = require('../services/media');
const trivia = require('../services/trivia');

const base = z.object({
  title: z.string().trim().min(3).max(200),
  category: z.string().trim().min(2).max(40),
  summary: z.string().trim().max(300),
  body: z.string().trim().min(1).max(100000),
  coverMediaId: z.number().int().nullable(),
  status: z.enum(['draft', 'published']),
  authorName: z.string().trim().max(80),
});
const createSchema = base.partial().required({ title: true, category: true, body: true });
const updateSchema = base.partial();

const SELECT = 'SELECT a.*, m.filename AS cover_file FROM articles a LEFT JOIN media m ON m.id = a.cover_media_id';
const shape = (a, withBody) => ({
  id: a.id, slug: a.slug, title: a.title, cat: a.category, author: a.author_name, authorId: a.author_id, summary: a.summary,
  cover: a.cover_file ? `/uploads/${a.cover_file}` : null, coverMediaId: a.cover_media_id, pub: a.status === 'published' ? 1 : 0,
  date: a.published_at || a.created_at, updated: a.updated_at, ...(withBody ? { body: a.body } : {}),
});
const canEdit = (u, a) => isStaff(u) || (u.role === 'writer' && a.author_id === u.id);
function uniqueSlug(title) {
  const s = slugify(title);
  let slug = s, n = 2;
  while (db.prepare('SELECT 1 FROM articles WHERE slug=?').get(slug)) slug = `${s}-${n++}`;
  return slug;
}
function checkCover(id) {
  if (id == null) return;
  const m = getMedia(id);
  if (!m || m.kind !== 'image') throw new HttpError(400, 'coverMediaId must be an uploaded image');
}

router.get('/', wrap((req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1), limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
  const where = [], args = [];
  const all = req.query.status === 'all' && req.user && ['admin', 'editor', 'writer'].includes(req.user.role);
  if (!all) where.push("a.status='published'");
  else if (req.user.role === 'writer') { where.push('a.author_id=?'); args.push(req.user.id); }
  if (req.query.category) { where.push('a.category=? COLLATE NOCASE'); args.push(String(req.query.category)); }
  if (req.query.q) { where.push('(a.title LIKE ? OR a.summary LIKE ?)'); const q = `%${String(req.query.q).slice(0, 80)}%`; args.push(q, q); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) c FROM articles a ${w}`).get(...args).c;
  const rows = db.prepare(`${SELECT} ${w} ORDER BY COALESCE(a.published_at,a.created_at) DESC LIMIT ? OFFSET ?`).all(...args, limit, (page - 1) * limit);
  res.json({ items: rows.map((r) => shape(r)), total, page, limit });
}));

router.get('/categories', (req, res) => {
  res.json({ items: db.prepare("SELECT category c, COUNT(*) n FROM articles WHERE status='published' GROUP BY category ORDER BY n DESC").all().map((r) => ({ name: r.c, count: r.n })) });
});

router.get('/:ref', wrap((req, res) => {
  const ref = req.params.ref;
  const a = db.prepare(`${SELECT} WHERE ${/^\d+$/.test(ref) ? 'a.id' : 'a.slug'}=?`).get(ref);
  if (!a || (a.status !== 'published' && !(req.user && canEdit(req.user, a)))) throw new HttpError(404, 'Article not found');
  res.json(shape(a, true));
}));

router.post('/', requireRole('admin', 'editor', 'writer'), wrap((req, res) => {
  const d = parse(createSchema, req.body);
  checkCover(d.coverMediaId);
  const now = Date.now(), status = d.status || 'draft';
  const author = (isStaff(req.user) && d.authorName) || req.user.name;
  const info = db.prepare(`INSERT INTO articles(slug,title,category,author_name,author_id,summary,body,cover_media_id,status,published_at,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(uniqueSlug(d.title), d.title, d.category, author, req.user.id, d.summary || '', d.body,
    d.coverMediaId ?? null, status, status === 'published' ? now : null, now, now);
  trivia.syncArticle(info.lastInsertRowid);
  res.status(201).json(shape(db.prepare(`${SELECT} WHERE a.id=?`).get(info.lastInsertRowid), true));
}));

router.put('/:id', requireRole('admin', 'editor', 'writer'), wrap((req, res) => {
  const a = db.prepare('SELECT * FROM articles WHERE id=?').get(req.params.id);
  if (!a) throw new HttpError(404, 'Article not found');
  if (!canEdit(req.user, a)) throw new HttpError(403, 'You can only edit your own articles');
  const d = parse(updateSchema, req.body);
  if (d.coverMediaId !== undefined) checkCover(d.coverMediaId);
  const status = d.status ?? a.status, now = Date.now();
  const cover = d.coverMediaId === undefined ? a.cover_media_id : d.coverMediaId;
  db.prepare(`UPDATE articles SET title=?,category=?,summary=?,body=?,cover_media_id=?,status=?,published_at=?,author_name=?,updated_at=? WHERE id=?`).run(
    d.title ?? a.title, d.category ?? a.category, d.summary ?? a.summary, d.body ?? a.body, cover, status,
    status === 'published' ? (a.published_at || now) : a.published_at,
    (isStaff(req.user) && d.authorName) || a.author_name, now, a.id);
  if (a.cover_media_id && a.cover_media_id !== cover) removeMedia(a.cover_media_id);
  trivia.syncArticle(a.id);
  res.json(shape(db.prepare(`${SELECT} WHERE a.id=?`).get(a.id), true));
}));

router.delete('/:id', requireRole('admin', 'editor', 'writer'), wrap((req, res) => {
  const a = db.prepare('SELECT * FROM articles WHERE id=?').get(req.params.id);
  if (!a) throw new HttpError(404, 'Article not found');
  if (!canEdit(req.user, a)) throw new HttpError(403, 'You can only delete your own articles');
  db.prepare('DELETE FROM articles WHERE id=?').run(a.id);
  removeMedia(a.cover_media_id);
  res.status(204).end();
}));

module.exports = router;
