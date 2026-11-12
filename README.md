# JobPilot PK (SaaS) - Node.js

A subscription website: home page with two plans, sign up and log in, manual payment approval (screenshot), plan-based limits,
job search through **Firecrawl**, resume matching, cover letters, application tracker, and a private admin panel.
**No Python.** Backend is Node.js; the front end is plain HTML/CSS/JS with no build step.

## Try it now (demo mode, no setup)
1. Install **Node.js 22 LTS** (nodejs.org). Node 20 is not supported: it is end of life, and the database library has no ready-made download for it, so the install fails.
2. In this folder run `npm install`, then `npm start` (Windows: double-click `start.bat`). Open http://localhost:3000

With no `.env` file the app starts in **demo mode**: test accounts exist already and searches return clearly labelled sample jobs.

| Role | Email | Password |
|---|---|---|
| Admin (open /admin) | admin@jobpilot.test | Admin@12345 |
| Starter customer (local jobs) | starter@jobpilot.test | Starter@12345 |
| Pro customer (international remote jobs) | pro@jobpilot.test | Pro@12345 |

The login page also shows these with a one-click fill. The admin panel has one pending demo signup (newuser@jobpilot.test) to practise approving.
**Demo mode turns off automatically** when you set your own `ADMIN_EMAIL` or `NODE_ENV=production`. Never go live with demo mode on.

## Go live
1. Copy `.env.example` to `.env`. Set your admin email and a strong password, payment details and `FIRECRAWL_API_KEY`. Set `NODE_ENV=production` once you have HTTPS.
2. `npm start`. Admin panel: /admin.

## Plans
| | Starter - Rs. 2,500 | Pro - Rs. 5,000 |
|---|---|---|
| What you can search | **Local jobs** in Pakistan | **International remote jobs**, plus all local jobs |
| Searches per day | 5 | 25 |
| Ranked jobs per search | 10 | 25 |
| Full job-page reading (sharper match) | no | top 10 |
| Career-page links per search | 2 | 8 |
| AI cover letters per month* | template letters only | 60 (+ unlimited templates) |
| Tracker size | 100 | 2,000 |

*AI letters appear on the plans only when `ANTHROPIC_API_KEY` is set.
Edit **lib/plans.js** to change prices or limits (the home page, signup page and server all read from it).
The server enforces the scope: a Starter account asking for international remote jobs is refused, and local searches must be for Pakistan.

## How Firecrawl is used (and what it costs you)
- **Search:** one Firecrawl `/v2/search` call per new search (past month). Local searches target Pakistan; remote searches are not limited to one country.
- **Pro deep reads:** `/v2/scrape` markdown of the top 10 leads (1 credit each). **Career links:** `/v2/scrape` with JSON extraction (about 5 credits each).
- LinkedIn, Indeed, Glassdoor and social sites are never scraped. Their links may appear in results as leads the user opens themselves.
- Results are cached (searches 6 hours, pages 24 hours, shared by all users); `FIRECRAWL_DAILY_CALLS` caps total calls per day.
- The key lives only in `.env` on the server. Never put it in the front end or share it in chat.

## Customer and admin flow
Customer: choose plan, pay by JazzCash/Easypaisa, sign up with the screenshot, wait for approval, log in.
Admin (/admin): see pending payments with screenshots, approve with plan and days, reject, extend, change plan, suspend, reset password, delete.
Expired users sign up again with the same email and password to send a new payment.

## Hosting (any host that runs Node.js)
- **VPS** (Ubuntu): Node 22, `npm ci --omit=dev`, `pm2 start server.js`, Caddy or nginx in front for HTTPS (nginx needs `client_max_body_size 12m` and `proxy_set_header Host $host`).
- **Render / Railway / Fly.io**: build `npm ci --omit=dev`, start `npm start`, attach a **persistent disk** and set `DB_PATH` to a file on it.
- **Docker**: `docker build -t jobpilot . && docker run -p 3000:3000 -v jobpilot-data:/data --env-file .env jobpilot` (multi-stage build on Node 22; on Render choose Docker, mount the disk at `/data`, and add your environment variables).
- **cPanel "Setup Node.js App"** / Hostinger Business: point at server.js, set the environment variables in the panel, keep the database file outside the deployed folder.
- Run **one instance only** (SQLite). Set `NODE_ENV=production` and `TRUST_PROXY=1` behind HTTPS. Back up the database file (and its `-wal`/`-shm` files, or use `sqlite3 app.db ".backup copy.db"`) daily.

## Check Firecrawl with your real key (do this first)
```
npm run live-test
```
It runs a local search, a remote search, reads one job page, reads one careers page, and runs the app's own search end to end (and one Claude letter if `ANTHROPIC_API_KEY` is set).
It costs roughly 15-25 Firecrawl credits and uses a throwaway database. Every line says PASS, WARN or FAIL, with a plain reason. If anything fails, copy the whole output.
Set `LIVE_CAREER_URL` to a careers page you know lists jobs if the careers-page step warns. The admin page header also shows the last Firecrawl result ("Working" or the exact error, such as an invalid key or used-up credits).

## Deploy on Render
1. Put this folder in a **private** GitHub repository (`.env` and database files are already ignored).
2. In Render: **New > Blueprint**, pick the repo. Render reads `render.yaml` and asks for ADMIN_EMAIL, ADMIN_PASSWORD, PAYMENT_INFO and FIRECRAWL_API_KEY. Enter them there; they are never stored in the repo.
3. The Blueprint uses a **paid instance with a 1 GB persistent disk** mounted at `/var/data` (the database lives at `/var/data/app.db`). The Free instance has no disk and sleeps after 15 minutes, so it cannot hold your customers' data.
4. When it is live, check: `https://YOUR-SERVICE.onrender.com/healthz` says ok; log in at `/login` with your admin email; open **Shell** in the Render dashboard and run `npm run live-test`.
5. Optional: add `ANTHROPIC_API_KEY` (AI letters for Pro) in Environment, and a custom domain under Settings.
- Run **one instance** only. A service with a disk cannot be scaled to several instances.
- **Build error "No prebuilt binaries found" / "Could not find any Python installation"?** The build is using Node 20. Use Node 22: the Blueprint sets `NODE_VERSION=22`, there is a `.node-version` file, and the Dockerfile uses `node:22`. If you created the service by hand, set the environment variable `NODE_VERSION` to `22` (or choose the Docker runtime).
- **Docker runtime on Render:** add a disk with mount path `/data` (the Dockerfile stores the database at `/data/app.db`), plus the environment variables from `render.yaml`. Health check path: `/healthz`.
- **Backups:** in the Render Shell run `npm run backup` (keeps the newest 14 copies in `/var/data/backups`) and download a copy now and then. Also check the dashboard for Render's own disk snapshots and how long they are kept.
- `NODE_ENV=production` and your own ADMIN_EMAIL keep demo mode **off**. Check the login page shows no demo accounts.
- **If a key was ever pasted in a chat or message, treat it as exposed:** create a new one in the Firecrawl dashboard and put only the new key in Render.

## Porting the backend to another language
The front end only talks to the JSON API below, so you can rewrite `server.js` and `lib/` in any language and keep `public/` unchanged.
Sessions are an HttpOnly `sid` cookie. Tables: users, sessions, profiles, apps, usage, cache (see lib/db.js).

| Endpoint | Purpose |
|---|---|
| GET /api/plans | plans, benefits, payment text |
| POST /api/signup, /api/login, /api/logout | accounts |
| GET /api/me | user, plan limits, usage |
| GET/POST/DELETE /api/profile, POST/GET/DELETE /api/resume(/download) | profile and saved resume |
| POST /api/search (`scope`: local or remote) | job search (enforces plan limits and scope) |
| POST /api/letter | cover letter |
| GET/POST /api/apps, PATCH /api/apps/:id, GET /api/apps.csv | tracker |
| GET /api/admin/overview, GET /api/admin/shot/:id, POST /api/admin/{approve,status,password,delete} | admin |

## Tests
`npm test` runs the API tests, the demo-mode tests and a browser simulation of every page, against fake Firecrawl and Claude servers (no keys or credits used).
**Not tested here:** the live Firecrawl API (request format checked against its documentation). Run one real search with your key after deploying.

## Known limits
Manual approval (no payment gateway); SQLite suits dozens to a few hundred active users; the match score is keyword-based and approximate;
search results are leads from the open web, not a complete job database; pages that need a login cannot be read.
Add a privacy policy and terms before selling: you store names, emails, resumes and payment screenshots.
