const router = require('express').Router();
const { z } = require('zod');
const db = require('../db');
const { requireRole } = require('../auth');
const { wrap, parse, HttpError } = require('../utils');
const trivia = require('../services/trivia');
const ai = require('../services/ai');

// ---- Public ----
// Questions only; correct answers are checked server-side so they can't be read from the page.
router.get('/daily', (req, res) => {
  const { date, rows } = trivia.dailySet();
  res.json({ date, questions: rows.map((r) => trivia.shape(r, false)) });
});

router.post('/answer', wrap((req, res) => {
  const d = parse(z.object({ id: z.number().int(), choice: z.number().int().min(0).max(3) }), req.body);
  const { rows } = trivia.dailySet();
  const q = rows.find((r) => r.id === d.id);
  if (!q) throw new HttpError(404, 'That question is not part of today\u2019s round');
  res.json({ id: q.id, correct: q.answer === d.choice, answer: q.answer });
}));

// ---- Staff ----
const staff = requireRole('admin', 'editor');
router.get('/questions', staff, (req, res) => {
  res.json({ items: db.prepare('SELECT * FROM trivia_questions ORDER BY id DESC LIMIT 500').all().map((r) => trivia.shape(r, true)) });
});
router.post('/questions', staff, wrap((req, res) => {
  const d = parse(z.object({ q: z.string().trim().min(5).max(400), options: z.array(z.string().trim().min(1).max(120)).length(4), answer: z.number().int().min(0).max(3), src: z.string().trim().max(200).optional() }), req.body);
  const info = db.prepare("INSERT INTO trivia_questions(source,source_title,question,options,answer,created_at) VALUES('custom',?,?,?,?,?)").run(d.src || '', d.q, JSON.stringify(d.options), d.answer, Date.now());
  res.status(201).json(trivia.shape(db.prepare('SELECT * FROM trivia_questions WHERE id=?').get(info.lastInsertRowid), true));
}));
router.patch('/questions/:id', staff, wrap((req, res) => {
  const { active } = parse(z.object({ active: z.boolean() }), req.body);
  if (!db.prepare('UPDATE trivia_questions SET active=? WHERE id=?').run(active ? 1 : 0, req.params.id).changes) throw new HttpError(404, 'Question not found');
  res.json({ ok: true });
}));
router.delete('/questions/:id', staff, wrap((req, res) => {
  db.prepare('DELETE FROM trivia_questions WHERE id=?').run(req.params.id);
  res.status(204).end();
}));
router.post('/regenerate', staff, wrap((req, res) => res.json({ created: trivia.rebuildAll() })));
router.post('/generate-ai', staff, wrap(async (req, res) => {
  const arts = db.prepare("SELECT title,body FROM articles WHERE status='published' ORDER BY published_at DESC LIMIT 8").all();
  if (!arts.length) throw new HttpError(400, 'Publish an article first');
  const qs = await ai.generateQuestions(arts);
  const ins = db.prepare("INSERT INTO trivia_questions(source,source_title,question,options,answer,created_at) VALUES('ai',?,?,?,?,?)");
  db.transaction(() => qs.forEach((q) => ins.run(q.src, q.q, JSON.stringify(q.options), q.answer, Date.now())))();
  res.json({ created: qs.length });
}));

module.exports = router;
