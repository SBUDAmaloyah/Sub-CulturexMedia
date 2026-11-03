const cfg = require('../config');
const { HttpError } = require('../utils');

// Asks Claude for extra multiple-choice questions based only on the supplied articles.
async function generateQuestions(articles, count = 8) {
  if (!cfg.anthropic.key) throw new HttpError(503, 'ANTHROPIC_API_KEY is not configured');
  const text = articles.map((a) => `# ${a.title}\n${a.body}`).join('\n\n').slice(0, 30000);
  const prompt = `Write ${count} multiple-choice trivia questions based ONLY on the articles below. Return ONLY a JSON array of objects shaped {"q": string, "options": [4 strings], "answer": index 0-3, "src": article title}. Every question must be answerable from the text.\n\n${text}`;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': cfg.anthropic.key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: cfg.anthropic.model, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!r.ok) throw new HttpError(502, `AI provider error (${r.status})`);
  const j = await r.json();
  const raw = (j.content || []).map((c) => c.text || '').join('').replace(/```json|```/g, '').trim();
  let arr;
  try { arr = JSON.parse(raw); } catch { throw new HttpError(502, 'AI returned invalid JSON'); }
  return (Array.isArray(arr) ? arr : []).filter((x) => x && typeof x.q === 'string' && Array.isArray(x.options) && x.options.length === 4
    && Number.isInteger(x.answer) && x.answer >= 0 && x.answer < 4)
    .map((x) => ({ q: x.q.slice(0, 400), options: x.options.map((o) => String(o).slice(0, 120)), answer: x.answer, src: String(x.src || '').slice(0, 200) }));
}
module.exports = { generateQuestions };
