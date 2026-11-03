// Usage:  npm run seed            -> creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD
//         npm run seed -- --sample -> also adds a few sample articles (published) for trying the site
const bcrypt = require('bcryptjs');
const db = require('../src/db');
const trivia = require('../src/services/trivia');
const { slugify } = require('../src/utils');

(async () => {
  const email = process.env.ADMIN_EMAIL, pw = process.env.ADMIN_PASSWORD, name = process.env.ADMIN_NAME || 'Site Admin';
  if (!email || !pw || pw.length < 10) { console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (10+ chars) in .env first.'); process.exit(1); }
  let u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!u) {
    const info = db.prepare('INSERT INTO users(email,name,password_hash,role,created_at) VALUES(?,?,?,?,?)').run(email, name, await bcrypt.hash(pw, 12), 'admin', Date.now());
    u = db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
    console.log('Created admin', email);
  } else console.log('Admin already exists:', email);

  if (process.argv.includes('--sample')) {
    const A = [
      ['Harbour City end 14-year wait with title-clinching win', 'Soccer', 'A late header settles a nervy finale and sends Dockside Arena into raptures.',
        'Harbour City FC sealed their first league title in 14 years with a 2-1 win over Eastgate United at Dockside Arena on Saturday. Tomas Verhoeven rose to head home the winner in the 88th minute, sparking wild scenes in front of 41,000 supporters.\n\nThe result lifted Harbour City to 82 points, three clear of Rovers Athletic with one game left to play. Coach Lena Markovic said the squad had refused to panic after losing their opening fixture of the season.\n\n## A season of small margins\n\nHarbour City won 11 of their 14 games decided by a single goal. Goalkeeper Ibrahim Soto kept 19 clean sheets, a club record, and was named Player of the Season by the league.'],
      ['Capital Lions edge thriller at Royal Park', 'Rugby', 'Five tries, two lead changes and a penalty on the hooter.',
        'Capital Lions beat Royal Park Rams 27-24 after Sipho Dlamini landed a penalty from 48 metres on the final whistle. The fly-half finished with 17 points, including two conversions and three penalties.\n\nThe visitors scored five tries in total, but the Rams never recovered from losing captain Daniel Whitcombe to a yellow card in the 62nd minute. Lions coach Aiyana Brooks called it the most complete second-half performance of her three years in charge.'],
      ['Rinaldi holds off late charge to win Coastal Grand Prix', 'Formula 1', 'A one-stop strategy pays off for Veloce Racing at a sun-baked circuit.',
        'Mateo Rinaldi won the Coastal Grand Prix by 0.8 seconds after defending for the final 12 laps of the 57-lap race. The Veloce Racing driver started from pole position and led for 41 laps.\n\nTeammate Hana Ito finished third after a one-stop strategy that left her on hard tyres for 31 laps. The result gives Veloce Racing a 26-point lead in the constructors standings with five rounds remaining.'],
    ];
    const ins = db.prepare("INSERT INTO articles(slug,title,category,author_name,author_id,summary,body,status,published_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'published',?,?,?)");
    A.forEach(([t, c, s, b], i) => {
      if (db.prepare('SELECT 1 FROM articles WHERE slug=?').get(slugify(t))) return;
      const now = Date.now() - i * 864e5;
      const id = ins.run(slugify(t), t, c, 'Staff Writer', u.id, s, b, now, now, now).lastInsertRowid;
      trivia.syncArticle(id);
    });
    console.log('Sample articles added');
  }
})();
