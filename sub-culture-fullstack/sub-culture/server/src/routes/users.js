const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('../db');
const { requireRole } = require('../auth');
const { wrap, parse, HttpError } = require('../utils');

router.use(requireRole('admin'));
const roles = z.enum(['admin', 'editor', 'writer', 'artist']);
const shape = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, active: !!u.active, createdAt: u.created_at });
const adminCount = () => db.prepare("SELECT COUNT(*) c FROM users WHERE role='admin' AND active=1").get().c;

router.get('/', (req, res) => res.json({ items: db.prepare('SELECT * FROM users ORDER BY id').all().map(shape) }));

router.post('/', wrap(async (req, res) => {
  const d = parse(z.object({ email: z.string().email(), name: z.string().trim().min(2).max(80), role: roles, password: z.string().min(10).max(200) }), req.body);
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(d.email)) throw new HttpError(409, 'That email is already registered');
  const info = db.prepare('INSERT INTO users(email,name,password_hash,role,created_at) VALUES(?,?,?,?,?)')
    .run(d.email, d.name, await bcrypt.hash(d.password, 12), d.role, Date.now());
  res.status(201).json(shape(db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid)));
}));

router.patch('/:id', wrap(async (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!u) throw new HttpError(404, 'User not found');
  const d = parse(z.object({ name: z.string().trim().min(2).max(80), role: roles, active: z.boolean(), password: z.string().min(10).max(200) }).partial(), req.body);
  const demoting = u.role === 'admin' && u.active && ((d.role && d.role !== 'admin') || d.active === false);
  if (demoting && adminCount() <= 1) throw new HttpError(400, 'You cannot remove the last active admin');
  db.prepare('UPDATE users SET name=?,role=?,active=?,password_hash=? WHERE id=?').run(
    d.name ?? u.name, d.role ?? u.role, d.active === undefined ? u.active : d.active ? 1 : 0,
    d.password ? await bcrypt.hash(d.password, 12) : u.password_hash, u.id);
  res.json(shape(db.prepare('SELECT * FROM users WHERE id=?').get(u.id)));
}));

module.exports = router;
