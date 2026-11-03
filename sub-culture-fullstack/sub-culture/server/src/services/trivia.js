const db = require('../db');
const cfg = require('../config');
const { shuffle } = require('../utils');

const NOUN = /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)+\b/g;
const bodyText = (b) => b.replace(/^## .*$/gm, ' ').replace(/\s+/g, ' ');

function dateKey(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: cfg.trivia.tz }).format(d); // YYYY-MM-DD
}

// Builds fill-in-the-blank questions from an article's sentences. Distractors come from other
// proper nouns across published articles (or nearby numbers).
function questionsFor(article, pool) {
  const out = [];
  // split after . ! ? only when a new sentence follows, so decimals like 0.8 stay intact
  const sents = bodyText(article.body).split(/(?<=[.!?])\s+(?=[A-Z"'\u201C])/).map((s) => s.trim()).filter((s) => s.length > 45 && s.length < 220);
  let made = 0;
  for (const s of sents) {
    if (made >= 3) break;
    const nouns = (s.match(NOUN) || []).filter((n) => n.length > 5);
    const nums = [];
    const re = /\d[\d,]*(?:\.\d+)?/g;
    let m;
    while ((m = re.exec(s))) {
      const before = s[m.index - 1] || '', after = s[m.index + m[0].length] || '';
      if (/[-\u2013]/.test(before) || /[-\u2013]/.test(after)) continue; // skip scores like 2-1
      nums.push(m[0]);
    }
    let ans, opts;
    if (nouns.length && pool.length >= 4 && made % 2 === 0) {
      ans = nouns[0];
      opts = shuffle(pool.filter((p) => !p.includes(ans) && !ans.includes(p)), s).slice(0, 3);
    } else if (nums.length) {
      ans = nums[0];
      const v = parseFloat(ans.replace(/,/g, '')), dec = (ans.split('.')[1] || '').length, comma = ans.includes(',');
      const step = Math.max(1, Math.round(v * 0.12));
      const cand = [v + step, v - step > 0 ? v - step : v + step * 3, v + step * 2, v + step * 3 + 1].filter((x, i, a) => x !== v && a.indexOf(x) === i);
      opts = cand.slice(0, 3).map((x) => { const t = x.toFixed(dec); return comma ? Number(t).toLocaleString('en-US') : t; });
    } else continue;
    if (!opts || opts.length < 3) continue;
    const all = shuffle([ans, ...opts], 'o' + s);
    out.push({ question: s.replace(ans, '_____'), options: all, answer: all.indexOf(ans) });
    made++;
  }
  return out;
}

const publishedPool = () => {
  const pool = new Set();
  for (const a of db.prepare("SELECT body FROM articles WHERE status='published'").all()) (bodyText(a.body).match(NOUN) || []).forEach((n) => pool.add(n));
  return [...pool];
};

// Re-generate the auto questions for one article (call after create/update/publish/unpublish).
function syncArticle(articleId) {
  const a = db.prepare('SELECT * FROM articles WHERE id=?').get(articleId);
  db.prepare("DELETE FROM trivia_questions WHERE article_id=? AND source='auto'").run(articleId);
  if (!a || a.status !== 'published') return 0;
  const qs = questionsFor(a, publishedPool());
  const ins = db.prepare("INSERT INTO trivia_questions(source,article_id,source_title,question,options,answer,created_at) VALUES('auto',?,?,?,?,?,?)");
  db.transaction(() => qs.forEach((q) => ins.run(a.id, a.title, q.question, JSON.stringify(q.options), q.answer, Date.now())))();
  return qs.length;
}
function rebuildAll() {
  let n = 0;
  for (const a of db.prepare("SELECT id FROM articles WHERE status='published'").all()) n += syncArticle(a.id);
  return n;
}

const shape = (r, withAnswer) => ({
  id: r.id, q: r.question, options: JSON.parse(r.options), src: r.source_title || 'Editor pick', source: r.source, active: !!r.active,
  ...(withAnswer ? { answer: r.answer } : {}),
});

// The day's questions are chosen once (seeded shuffle) and stored, so adding questions mid-day doesn't reshuffle.
function dailySet(date = dateKey()) {
  const cached = db.prepare('SELECT question_ids FROM trivia_daily WHERE date=?').get(date);
  let rows;
  if (cached) {
    const ids = JSON.parse(cached.question_ids);
    rows = ids.map((id) => db.prepare('SELECT * FROM trivia_questions WHERE id=?').get(id)).filter(Boolean);
  } else {
    const all = db.prepare('SELECT * FROM trivia_questions WHERE active=1 ORDER BY id').all();
    rows = shuffle(all, date).slice(0, cfg.trivia.count);
    if (rows.length) db.prepare('INSERT OR REPLACE INTO trivia_daily(date,question_ids) VALUES(?,?)').run(date, JSON.stringify(rows.map((r) => r.id)));
  }
  return { date, rows };
}

module.exports = { questionsFor, syncArticle, rebuildAll, dailySet, dateKey, shape };
