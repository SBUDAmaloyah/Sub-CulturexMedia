# Sub Culture — media platform

Plain HTML/CSS/JS front end (`client/`) plus a Node.js + Express + SQLite back end (`server/`). The server also serves the front end, so one process runs the whole site.

```
client/                 front end (no build step)
  index.html, css/styles.css, assets/ (logos)
  js/  helpers · artwork · api · trivia · scores · views · studio · router · actions · main
server/
  src/
    index.js            starts the server
    app.js              Express setup: security headers, rate limits, routes, static files, error handling
    config.js           reads .env
    db.js               SQLite schema (auto-created)
    auth.js             JWT cookie/Bearer auth, roles, CSRF guard
    routes/             auth · users · articles · media (photos, videos, uploads) · downloads · trivia · scores
    services/           media (upload validation) · trivia (generator) · ai (optional Claude) · scores/ (providers + cache)
  scripts/seed.js       creates the first admin (and optional sample articles)
  test/api.test.js      automated API tests
  .env.example
```

## Run it

```bash
cd server
npm install
cp .env.example .env        # then edit: set JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm run seed                # first admin   (add  -- --sample  for demo articles)
npm start                   # http://localhost:3000
npm test                    # 10 API tests
```

Open the site, go to **Studio**, sign in with the admin you seeded.

## Roles

| Role | Can do |
|---|---|
| **admin** | everything, including users |
| **editor** | all content: articles, photos, videos, downloads (and approve artist uploads), trivia, scores |
| **writer** | write/publish/edit/delete **their own** articles |
| **artist** | upload mixes/cover art/wallpapers; uploads stay *pending* until an editor approves. Self-signup via `ALLOW_ARTIST_SIGNUP=true` |

## API summary (all under `/api`)

Public: `GET /articles` `/articles/:slug` `/articles/categories` · `/photos` · `/videos` · `/downloads` · `GET /downloads/:id/file` · `GET /trivia/daily` · `POST /trivia/answer` · `GET /scores/:sport` (soccer, rugby, cricket, basketball, golf, f1)
Auth: `POST /auth/login` `/auth/logout` `/auth/signup` · `GET /auth/me` · `PATCH /auth/me/password`
Staff/writer/artist (by role): `POST/PUT/DELETE /articles` · `POST /media` · `POST/DELETE /photos` `/videos` · `POST/PATCH/DELETE /downloads` · `GET/POST/PATCH/DELETE /trivia/questions`, `POST /trivia/regenerate`, `POST /trivia/generate-ai` · `POST/DELETE /scores/manual` · `GET/POST/PATCH /users` (admin)

Cookie sessions (httpOnly, SameSite=Strict) need an `X-Requested-With: sub-culture` header on writes. Scripts and mobile apps can use `Authorization: Bearer <token>` (the login response includes the token).

## Live scores

Set a provider per sport in `.env` (`SCORES_SOCCER=apisports`, etc.). Results are cached (`SCORES_CACHE_SECONDS`) so visitors don't burn your API quota; if a provider fails, the last good copy is served (marked stale), then demo data if `SCORES_FALLBACK_DEMO=true`.

| Provider | Sports | Needs |
|---|---|---|
| `demo` | all (fictional teams) | nothing |
| `apisports` | soccer, rugby, basketball | `APISPORTS_KEY` |
| `cricapi` | cricket | `CRICAPI_KEY` |
| `jolpica` | f1 (latest race result) | nothing |
| `feed` | any (golf has no built-in provider) | `SCORES_<SPORT>_FEED=<url>` returning the platform JSON shape |

> The third-party mappings in `server/src/services/scores/providers.js` were written from each vendor's public docs and **have not been run against live accounts**. Test each with your key and adjust the mapper if a field differs.

Feed shape — matches: `[{ "league", "home", "away", "hs", "as", "status": "LIVE|FT|UP", "clock", "time", "note" }]`; golf: `{ "event", "status", "rows": [[pos, player, toPar, thru]] }`; F1: `{ "event", "status", "rows": [[pos, driver, team, gap]] }`.

## Trivia

When an article is published or edited, questions are generated from its text and stored. `GET /trivia/daily` picks 5 using a date-seeded shuffle and freezes that set for the day; correct answers are never sent to the browser (`POST /trivia/answer` checks them). Editors can add custom questions or, with `ANTHROPIC_API_KEY` set, generate extra ones with Claude.

## Uploads

Stored in `UPLOAD_DIR` (default `server/data/uploads`). The server checks the file's real header bytes, not just the declared type; SVG is rejected; limits are 15 MB images, 250 MB video, 150 MB audio. Back up `server/data/` (database + uploads).

## Before you go live

- Set a strong `JWT_SECRET` and `NODE_ENV=production`, and serve over HTTPS (cookies become `Secure`). If you're behind a proxy (Nginx, Render, Fly…), set `TRUST_PROXY=1` so rate limiting sees real IPs.
- SQLite + local disk suit a single server. For multiple servers or ephemeral hosts (Heroku-style), move uploads to object storage (S3/R2) and the DB to Postgres. The data access is isolated in `routes/` and `services/`, so that swap is contained.
- Not included yet: email password reset, image resizing/thumbnails, search beyond title/summary, comments.
