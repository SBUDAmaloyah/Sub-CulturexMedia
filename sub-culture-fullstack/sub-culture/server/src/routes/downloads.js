const router = require('express').Router();
const path = require('path');
const { z } = require('zod');
const db = require('../db');
const cfg = require('../config');
const { requireRole, isStaff } = require('../auth');
const { wrap, parse, slugify, HttpError } = require('../utils');
const { upload, saveMedia, removeMedia, discard } = require('../services/media');

const SQL = `SELECT d.*, m.filename file, m.size, m.mime, p.filename pfile, u.name uploader
  FROM downloads d JOIN media m ON m.id=d.media_id LEFT JOIN media p ON p.id=d.preview_media_id LEFT JOIN users u ON u.id=d.uploader_id`;
const shape = (r) => ({
  id: r.id, type: r.type, title: r.title, artist: r.artist_name, status: r.status, count: r.download_count, size: r.size, mime: r.mime,
  src: `/uploads/${r.file}`, // for in-page preview/playback
  thumb: r.pfile ? `/uploads/${r.pfile}` : (r.type !== 'mix' ? `/uploads/${r.file}` : null),
  fileUrl: `/api/downloads/${r.id}/file`, // forces a download
  uploaderId: r.uploader_id, uploader: r.uploader, date: r.created_at,
});

router.get('/', wrap((req, res) => {
  const where = [], args = [];
  if (req.query.type && ['wallpaper', 'cover', 'mix'].includes(req.query.type)) { where.push('d.type=?'); args.push(req.query.type); }
  if (req.query.scope === 'mine' && req.user) { where.push('d.uploader_id=?'); args.push(req.user.id); }
  else if (req.query.scope === 'all' && isStaff(req.user)) { /* staff see everything, including pending */ }
  else where.push("d.status='approved'");
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  res.json({ items: db.prepare(`${SQL} ${w} ORDER BY d.created_at DESC, d.id DESC LIMIT 200`).all(...args).map(shape) });
}));

router.post('/', requireRole('admin', 'editor', 'artist'), upload.fields([{ name: 'file', maxCount: 1 }, { name: 'preview', maxCount: 1 }]), wrap((req, res) => {
  const all = Object.values(req.files || {}).flat();
  try {
    const d = parse(z.object({ type: z.enum(['wallpaper', 'cover', 'mix']), title: z.string().trim().min(2).max(120), artistName: z.string().trim().max(80).optional() }), req.body);
    const file = req.files && req.files.file && req.files.file[0], prev = req.files && req.files.preview && req.files.preview[0];
    if (!file) throw new HttpError(400, 'Attach the file in the "file" field');
    const fm = saveMedia(file, req.user.id, d.type === 'mix' ? 'audio' : 'image');
    let pm = null;
    try { pm = prev ? saveMedia(prev, req.user.id, 'image') : null; } catch (e) { removeMedia(fm.id); throw e; }
    const status = isStaff(req.user) ? 'approved' : 'pending'; // artist uploads wait for approval
    const info = db.prepare('INSERT INTO downloads(type,title,artist_name,media_id,preview_media_id,status,uploader_id,created_at) VALUES(?,?,?,?,?,?,?,?)')
      .run(d.type, d.title, d.artistName || (req.user.role === 'artist' ? req.user.name : ''), fm.id, pm && pm.id, status, req.user.id, Date.now());
    res.status(201).json(shape(db.prepare(`${SQL} WHERE d.id=?`).get(info.lastInsertRowid)));
  } catch (e) { discard(all); throw e; }
}));

router.patch('/:id/status', requireRole('admin', 'editor'), wrap((req, res) => {
  const { status } = parse(z.object({ status: z.enum(['approved', 'rejected', 'pending']) }), req.body);
  const info = db.prepare('UPDATE downloads SET status=? WHERE id=?').run(status, req.params.id);
  if (!info.changes) throw new HttpError(404, 'Download not found');
  res.json(shape(db.prepare(`${SQL} WHERE d.id=?`).get(req.params.id)));
}));

router.delete('/:id', requireRole('admin', 'editor', 'artist'), wrap((req, res) => {
  const d = db.prepare('SELECT * FROM downloads WHERE id=?').get(req.params.id);
  if (!d) throw new HttpError(404, 'Download not found');
  if (!isStaff(req.user) && d.uploader_id !== req.user.id) throw new HttpError(403, 'You can only delete your own uploads');
  db.prepare('DELETE FROM downloads WHERE id=?').run(d.id);
  removeMedia(d.media_id); removeMedia(d.preview_media_id);
  res.status(204).end();
}));

// Streams the file with a download header and counts it. Unapproved items are visible to staff and their owner only.
router.get('/:id/file', wrap((req, res) => {
  const r = db.prepare(SQL + ' WHERE d.id=?').get(req.params.id);
  if (!r || (r.status !== 'approved' && !(req.user && (isStaff(req.user) || r.uploader_id === req.user.id)))) throw new HttpError(404, 'Download not found');
  db.prepare('UPDATE downloads SET download_count=download_count+1 WHERE id=?').run(r.id);
  res.download(path.join(cfg.uploadDir, r.file), slugify(r.title) + path.extname(r.file));
}));

module.exports = router;
