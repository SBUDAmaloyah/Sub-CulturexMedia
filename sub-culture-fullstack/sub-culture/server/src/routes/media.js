const router = require('express').Router();
const { z } = require('zod');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { wrap, parse, HttpError } = require('../utils');
const { upload, saveMedia, removeMedia, getMedia, mediaUrl, discard } = require('../services/media');

// Generic upload (e.g. an article cover). Returns the media record so it can be attached elsewhere.
router.post('/media', requireAuth, upload.single('file'), wrap((req, res) => {
  if (!req.file) throw new HttpError(400, 'Attach a file in the "file" field');
  const m = saveMedia(req.file, req.user.id);
  res.status(201).json({ id: m.id, kind: m.kind, url: mediaUrl(m), size: m.size });
}));

// ---- Photos ----
const photo = (r) => ({ id: r.id, caption: r.caption, src: `/uploads/${r.filename}`, date: r.created_at });
const PHOTO_SQL = 'SELECT p.*, m.filename FROM photos p JOIN media m ON m.id=p.media_id';
router.get('/photos', (req, res) => res.json({ items: db.prepare(`${PHOTO_SQL} ORDER BY p.created_at DESC, p.id DESC LIMIT 200`).all().map(photo) }));
router.post('/photos', requireRole('admin', 'editor'), upload.array('files', 20), wrap((req, res) => {
  if (!req.files || !req.files.length) throw new HttpError(400, 'Attach images in the "files" field');
  const caption = String(req.body.caption || '').trim().slice(0, 200);
  const out = [];
  try {
    for (const f of req.files) {
      const m = saveMedia(f, req.user.id, 'image');
      const info = db.prepare('INSERT INTO photos(media_id,caption,created_by,created_at) VALUES(?,?,?,?)').run(m.id, caption || String(f.originalname).replace(/\.[^.]+$/, ''), req.user.id, Date.now());
      out.push(photo(db.prepare(`${PHOTO_SQL} WHERE p.id=?`).get(info.lastInsertRowid)));
    }
  } catch (e) { discard(req.files.slice(out.length)); throw e; } // files already saved stay saved
  res.status(201).json({ items: out });
}));
router.delete('/photos/:id', requireRole('admin', 'editor'), wrap((req, res) => {
  const p = db.prepare('SELECT * FROM photos WHERE id=?').get(req.params.id);
  if (!p) throw new HttpError(404, 'Photo not found');
  db.prepare('DELETE FROM photos WHERE id=?').run(p.id);
  removeMedia(p.media_id);
  res.status(204).end();
}));

// ---- Videos (uploaded file or an external link) ----
const VIDEO_SQL = `SELECT v.*, m.filename vfile, t.filename tfile FROM videos v LEFT JOIN media m ON m.id=v.media_id LEFT JOIN media t ON t.id=v.thumb_media_id`;
const video = (r) => ({ id: r.id, title: r.title, desc: r.description, src: r.vfile ? `/uploads/${r.vfile}` : null, url: r.external_url, thumb: r.tfile ? `/uploads/${r.tfile}` : null, date: r.created_at });
router.get('/videos', (req, res) => res.json({ items: db.prepare(`${VIDEO_SQL} ORDER BY v.created_at DESC, v.id DESC LIMIT 100`).all().map(video) }));
router.post('/videos', requireRole('admin', 'editor'), upload.fields([{ name: 'file', maxCount: 1 }, { name: 'thumb', maxCount: 1 }]), wrap((req, res) => {
  const all = Object.values(req.files || {}).flat();
  try {
    const d = parse(z.object({ title: z.string().trim().min(2).max(160), description: z.string().trim().max(500).optional(), url: z.string().url().max(500).optional() }), req.body);
    if (!/^https?:\/\//i.test(d.url || 'https://')) throw new HttpError(400, 'url must be http(s)');
    const file = req.files && req.files.file && req.files.file[0], thumb = req.files && req.files.thumb && req.files.thumb[0];
    if (!file && !d.url) throw new HttpError(400, 'Provide a video file or a url');
    const vm = file ? saveMedia(file, req.user.id, 'video') : null;
    let tm = null;
    try { tm = thumb ? saveMedia(thumb, req.user.id, 'image') : null; } catch (e) { if (vm) removeMedia(vm.id); throw e; }
    const info = db.prepare('INSERT INTO videos(title,description,media_id,external_url,thumb_media_id,created_by,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(d.title, d.description || '', vm && vm.id, vm ? null : d.url, tm && tm.id, req.user.id, Date.now());
    res.status(201).json(video(db.prepare(`${VIDEO_SQL} WHERE v.id=?`).get(info.lastInsertRowid)));
  } catch (e) { discard(all); throw e; }
}));
router.delete('/videos/:id', requireRole('admin', 'editor'), wrap((req, res) => {
  const v = db.prepare('SELECT * FROM videos WHERE id=?').get(req.params.id);
  if (!v) throw new HttpError(404, 'Video not found');
  db.prepare('DELETE FROM videos WHERE id=?').run(v.id);
  removeMedia(v.media_id); removeMedia(v.thumb_media_id);
  res.status(204).end();
}));

module.exports = router;
