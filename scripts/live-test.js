#!/usr/bin/env node
// Live check of Firecrawl (and Claude, if a key is set). Run after you add your key:   npm run live-test
// Costs roughly 15-25 Firecrawl credits. It uses a throwaway database, never your real one.
require('../lib/env');
const os = require('os'), path = require('path');
process.env.DB_PATH = path.join(os.tmpdir(), 'jp-live-' + Date.now() + '.db');   // never touch the real database
process.env.FIRECRAWL_DEBUG = process.env.FIRECRAWL_DEBUG || '1';                  // print response shapes on the first live run
const D = require('../lib/db'), fc = require('../lib/firecrawl'), S = require('../lib/search'), M = require('../lib/match'), { PLANS } = require('../lib/plans');

let failed = 0;
const say = (ok, name, detail = '') => { console.log(`${ok === 'warn' ? 'WARN' : ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' - ' + detail : ''}`); if (ok === false) failed++; };
async function step(name, fn) { try { const r = await fn(); say(r && r.warn ? 'warn' : true, name, r && r.detail); return r; } catch (e) { say(false, name, e.message); return null; } }
const show = (rows) => rows.slice(0, 3).map((r) => `\n        ${String(r.title).slice(0, 70)}  ${r.url}`).join('');

(async () => {
  if (!process.env.FIRECRAWL_API_KEY) { console.log('FIRECRAWL_API_KEY is not set. Put it in .env (or the environment) and run again.'); process.exit(1); }
  console.log(`Firecrawl live test against ${process.env.FIRECRAWL_BASE || 'https://api.firecrawl.dev/v2'}\n`);
  let first;
  const local = await step('Search: local jobs (Pakistan)', async () => {
    const rows = await fc.search('data analyst jobs Lahore Pakistan', { limit: 5, country: 'PK' });
    if (!rows.length) throw new Error('no results came back');
    const good = rows.filter((r) => /^https?:/.test(r.url) && r.title);
    if (!good.length) throw new Error('no result had both a web address and a title (the response shape differs from what the app expects)');
    first = good.find((r) => !fc.blocked(r.url)); return { detail: `${good.length} usable results${show(good)}` };
  });
  await step('Search: international remote jobs', async () => {
    const rows = await fc.search('data analyst remote jobs', { limit: 5 });
    if (!rows.length) throw new Error('no results came back'); return { detail: `${rows.length} results${show(rows)}` };
  });
  await step('Read a job page (markdown)', async () => {
    if (!first) return { warn: true, detail: 'skipped: no readable page in the search results' };
    const md = await fc.scrapeMarkdown(first.url); if (md.length < 100) throw new Error(`only ${md.length} characters came back from ${first.url}`);
    return { detail: `${md.length} characters from ${first.url}` };
  });
  await step('Read a careers page (JSON extraction)', async () => {
    const url = process.env.LIVE_CAREER_URL || 'https://www.firecrawl.dev/careers', jobs = await fc.scrapeJobs(url);
    return jobs.length ? { detail: `${jobs.length} openings found on ${url}, e.g. "${jobs[0].title}"` } : { warn: true, detail: `no openings found on ${url}. Set LIVE_CAREER_URL to a page you know lists jobs` };
  });
  await step('End to end: the same search the app runs', async () => {
    const plan = { ...PLANS.pro, resultsPerSearch: 5, deepReads: 1 };
    const out = await S.runSearch({ user: { id: -1 }, plan, keywords: 'data analyst', location: 'Lahore', links: [], skills: 'sql python', minMatch: 0, scope: 'local',
      resume: 'Data analyst with five years of experience in SQL, python, pandas, dashboards and reporting at a bank in Lahore.' });
    if (!out.jobs.length) throw new Error('the app found no jobs. Notes: ' + out.notes.join(' | '));
    if (!out.jobs.every((j) => typeof j.match === 'number' && /^https?:/.test(j.url))) throw new Error('a job is missing its match score or link');
    if (out.jobs.some((j) => /linkedin|indeed|glassdoor/.test(j.source) && j.deep)) throw new Error('a blocked site was read in full');
    return { detail: `${out.jobs.length} ranked jobs, best match ${out.jobs[0].match}%${show(out.jobs)}` };
  });
  if (process.env.ANTHROPIC_API_KEY) await step('Claude cover letter', async () => {
    const t = await M.letterAI({ title: 'Data Analyst', company: 'Acme', desc: 'SQL and dashboards' }, 'Test User', 'Five years of SQL and python experience.');
    if (t.length < 10) throw new Error('the letter came back empty'); return { detail: `${t.length} characters` };
  }); else console.log('SKIP  Claude cover letter - ANTHROPIC_API_KEY is not set (optional)');

  console.log(`\nFirecrawl calls made: ${D.used(0, 'firecrawl')}`);
  console.log(failed ? `\n${failed} step(s) FAILED. Copy this whole output when asking for help.` : '\nAll required steps passed.');
  process.exit(failed ? 1 : 0);
})();
