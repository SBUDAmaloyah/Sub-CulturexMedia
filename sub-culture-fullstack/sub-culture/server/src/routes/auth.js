const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const db = require('../db');
const cfg = require('../config');
const { sign, setCookie, clearCookie, requireAuth } = require('../auth');
const { wrap, parse, HttpError } = require('../utils');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts, try again later' } });
const pub = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role });
const password = z.string().min(10, 'Password must be at least 10 characters').max(200);

router.post('/login', limiter, wrap(async (req, res) => {
  const { email, password: pw } = parse(z.object({ email: z.string().email(), password: z.string().min(1) }), req.body);
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  // compare against a dummy hash when the user is unknown so timing doesn't reveal which emails exist
  const ok = await bcrypt.compare(pw, u ? u.password_hash : '$2a$12$C6UzMDM.H6dfI/f/IKcEeO5pWbm2CZ3mH3p9hY6u8m1kqf0Gq3uZe');
  if (!u || !u.active || !ok) throw new HttpError(401, 'Invalid email or password');
  const token = sign(u);
  setCookie(res, token);
  res.json({ user: pub(u), token });
}));

router.post('/logout', (req, res) => { clearCookie(res); res.json({ ok: true }); });
router.get('/me', (req, res) => res.json({ user: req.user ? pub(req.user) : null }));

router.post('/signup', limiter, wrap(async (req, res) => {
  if (!cfg.allowArtistSignup) throw new HttpError(403, 'Artist sign-up is closed');
  const d = parse(z.object({ email: z.string().email(), name: z.string().trim().min(2).max(80), password }), req.body);
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(d.email)) throw new HttpError(409, 'That email is already registered');
  const info = db.prepare('INSERT INTO users(email,name,password_hash,role,created_at) VALUES(?,?,?,?,?)')
    .run(d.email, d.name, await bcrypt.hash(d.password, 12), 'artist', Date.now());
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
  setCookie(res, sign(u));
  res.status(201).json({ user: pub(u) });
}));

router.patch('/me/password', requireAuth, wrap(async (req, res) => {
  const d = parse(z.object({ current: z.string(), next: password }), req.body);
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!(await bcrypt.compare(d.current, u.password_hash))) throw new HttpError(403, 'Current password is incorrect');
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(await bcrypt.hash(d.next, 12), u.id);
  res.json({ ok: true });
}));

module.exports = router;
