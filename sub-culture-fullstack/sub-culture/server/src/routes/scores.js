const router = require('express').Router();
const { z } = require('zod');
const db = require('../db');
const { requireRole } = require('../auth');
const { wrap, parse, HttpError } = require('../utils');
const scores = require('../services/scores');

router.get('/:sport', wrap(async (req, res) => {
  res.set('Cache-Control', 'public, max-age=15');
  res.json(await scores.getScores(req.params.sport));
}));

// Manual fixtures let editors add or correct a match when no feed covers it.
router.post('/manual', requireRole('admin', 'editor'), wrap((req, res) => {
  const d = parse(z.object({
    sport: z.enum(scores.MATCH_SPORTS), league: z.string().trim().max(80).optional().default(''),
    home: z.string().trim().min(1).max(80), away: z.string().trim().min(1).max(80),
    hs: z.union([z.string().max(30), z.number()]).optional(), as: z.union([z.string().max(30), z.number()]).optional(),
    status: z.enum(['LIVE', 'FT', 'UP']), clock: z.string().max(30).optional(), time: z.string().max(10).optional(), note: z.string().max(120).optional(),
  }), req.body);
  const { sport, ...payload } = d;
  const info = db.prepare('INSERT INTO score_overrides(sport,payload,created_by,created_at) VALUES(?,?,?,?)').run(sport, JSON.stringify(payload), req.user.id, Date.now());
  res.status(201).json({ id: info.lastInsertRowid });
}));
router.delete('/manual/:id', requireRole('admin', 'editor'), wrap((req, res) => {
  if (!db.prepare('DELETE FROM score_overrides WHERE id=?').run(req.params.id).changes) throw new HttpError(404, 'Not found');
  res.status(204).end();
}));

module.exports = router;
