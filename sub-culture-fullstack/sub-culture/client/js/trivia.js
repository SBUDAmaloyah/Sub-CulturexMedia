/* Daily trivia (client side). Questions and answer checking come from the server; progress lives in localStorage. */
const TKEY = 'sc_trivia';
function readProg() { try { return JSON.parse(localStorage.getItem(TKEY)) || {}; } catch { return {}; } }
function writeProg(p) { try { localStorage.setItem(TKEY, JSON.stringify(p)); } catch { /* storage unavailable */ } }

async function loadTrivia() {
  S.trivia = await api('/trivia/daily');
  const P = readProg();
  if (P.date !== S.trivia.date) writeProg({ date: S.trivia.date, answers: [], streak: P.streak || 0, last: P.last });
}
