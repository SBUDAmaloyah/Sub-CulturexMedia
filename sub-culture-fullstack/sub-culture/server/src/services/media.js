const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const cfg = require('../config');
const db = require('../db');
const { HttpError } = require('../utils');

const TYPES = {
  'image/jpeg': ['image', '.jpg'], 'image/png': ['image', '.png'], 'image/webp': ['image', '.webp'], 'image/gif': ['image', '.gif'],
  'video/mp4': ['video', '.mp4'], 'video/webm': ['video', '.webm'], 'video/quicktime': ['video', '.mov'],
  'audio/mpeg': ['audio', '.mp3'], 'audio/wav': ['audio', '.wav'], 'audio/x-wav': ['audio', '.wav'],
  'audio/mp4': ['audio', '.m4a'], 'audio/x-m4a': ['audio', '.m4a'], 'audio/flac': ['audio', '.flac'], 'audio/ogg': ['audio', '.ogg'],
};
const MAX_MB = { image: 15, video: 250, audio: 150 };

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, f, cb) => cb(null, cfg.uploadDir),
    filename: (req, f, cb) => cb(null, crypto.randomUUID() + TYPES[f.mimetype][1]),
  }),
  limits: { fileSize: 250 * 1024 * 1024, files: 20 },
  fileFilter: (req, f, cb) => (TYPES[f.mimetype] ? cb(null, true) : cb(new HttpError(415, `Unsupported file type: ${f.mimetype}`))),
});

// Check the file's real header bytes, not just the type the browser claimed.
function sniffKind(file) {
  const fd = fs.openSync(file.path, 'r');
  const b = Buffer.alloc(16);
  fs.readSync(fd, b, 0, 16, 0);
  fs.closeSync(fd);
  const s = (o, n) => b.toString('latin1', o, o + n);
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image';
  if (s(1, 3) === 'PNG') return 'image';
  if (s(0, 4) === 'GIF8') return 'image';
  if (s(0, 4) === 'RIFF' && s(8, 4) === 'WEBP') return 'image';
  if (s(0, 4) === 'RIFF' && s(8, 4) === 'WAVE') return 'audio';
  if (s(0, 4) === 'fLaC' || s(0, 4) === 'OggS' || s(0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return 'audio';
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video'; // webm
  if (s(4, 4) === 'ftyp') return /M4A /.test(s(8, 4)) ? 'audio' : 'video'; // mp4 / mov / m4a
  return null;
}

function discard(files) {
  for (const f of [].concat(files || [])) { try { fs.unlinkSync(f.path); } catch { /* already gone */ } }
}

// Validates an uploaded file and records it in the media table.
function saveMedia(file, uploaderId, expectKind) {
  const [declared] = TYPES[file.mimetype];
  const real = sniffKind(file);
  const ok = real === declared || (real === 'video' && declared === 'audio' && file.mimetype === 'audio/mp4');
  if (!real || !ok) { discard(file); throw new HttpError(415, 'File contents do not match its type'); }
  if (expectKind && declared !== expectKind) { discard(file); throw new HttpError(415, `Expected a ${expectKind} file`); }
  if (file.size > MAX_MB[declared] * 1048576) { discard(file); throw new HttpError(413, `${declared} files must be under ${MAX_MB[declared]} MB`); }
  const info = db.prepare('INSERT INTO media(kind,filename,original_name,mime,size,uploader_id,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(declared, file.filename, String(file.originalname || '').slice(0, 200), file.mimetype, file.size, uploaderId, Date.now());
  return db.prepare('SELECT * FROM media WHERE id=?').get(info.lastInsertRowid);
}

function removeMedia(id) {
  if (!id) return;
  const m = db.prepare('SELECT * FROM media WHERE id=?').get(id);
  if (!m) return;
  try { fs.unlinkSync(path.join(cfg.uploadDir, m.filename)); } catch { /* already gone */ }
  db.prepare('DELETE FROM media WHERE id=?').run(id);
}

const getMedia = (id) => (id ? db.prepare('SELECT * FROM media WHERE id=?').get(id) : null);
const mediaUrl = (m) => (m ? `/uploads/${m.filename}` : null);

module.exports = { upload, saveMedia, removeMedia, getMedia, mediaUrl, discard };
