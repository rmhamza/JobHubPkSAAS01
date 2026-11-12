// Firecrawl client. The API key lives ONLY in the server environment, never in the browser.
const D = require('./db');
const BLOCK = /(^|\.)(linkedin\.com|indeed\.[a-z.]+|glassdoor\.[a-z.]+|facebook\.com|instagram\.com|twitter\.com|x\.com|tiktok\.com|youtube\.com)$/i;
const blocked = (u) => { try { return BLOCK.test(new URL(u).hostname); } catch { return true; } };

let active = 0; const waiters = [];  // concurrency limiter (free plan allows only 2 at a time)
const slot = async () => { if (active < (+process.env.FIRECRAWL_CONCURRENCY || 2)) { active++; return; } await new Promise((r) => waiters.push(r)); };
const release = () => { const w = waiters.shift(); if (w) w(); else active--; };

// Plain-language reasons, shown to the admin (customers only ever see a generic "temporarily unavailable").
const explain = (status, msg) => status === 401 || status === 403 ? 'Firecrawl rejected the API key. Check FIRECRAWL_API_KEY.'
  : status === 402 ? 'Firecrawl credits are used up. Check your Firecrawl plan.'
  : status === 429 ? 'Firecrawl rate limit reached (too many requests at once).'
  : status >= 500 ? `Firecrawl is having problems (HTTP ${status}).` : `Firecrawl error ${status}: ${String(msg).slice(0, 160)}`;
const fail = (m) => { try { D.cacheSet('fc:lasterror', { at: Date.now(), message: m }); } catch { /* ignore */ } return new Error(m); };
const status = () => ({ today: D.used(0, 'firecrawl'), lastOk: (D.cacheGet('fc:lastok', 1e15) || {}).at || null, lastError: D.cacheGet('fc:lasterror', 1e15) });

async function call(path, body, timeout) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw fail('FIRECRAWL_API_KEY is not set on the server.');
  if (D.bump(0, 'firecrawl') > (+process.env.FIRECRAWL_DAILY_CALLS || 1500)) throw fail('Daily Firecrawl call cap reached (FIRECRAWL_DAILY_CALLS).');
  await slot();
  try {
    let r;
    try {
      r = await fetch((process.env.FIRECRAWL_BASE || 'https://api.firecrawl.dev/v2') + path, { method: 'POST', signal: AbortSignal.timeout(timeout),
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch { throw fail('Could not reach Firecrawl (network problem or timeout).'); }
    const j = await r.json().catch(() => ({}));
    if (process.env.FIRECRAWL_DEBUG) console.log('[firecrawl]', path, r.status, 'keys:', Object.keys(j), 'data:', j.data && typeof j.data === 'object' ? Object.keys(j.data) : typeof j.data, 'credits:', j.creditsUsed ?? '-');
    if (!r.ok || j.success === false) throw fail(explain(r.status, j.error || j.message || 'request failed'));
    D.cacheSet('fc:lastok', { at: Date.now() }); return j;
  } finally { release(); }
}
const pick = (x) => ({ url: x.url || (x.metadata && (x.metadata.sourceURL || x.metadata.url)) || '', title: x.title || (x.metadata && x.metadata.title) || '', description: x.description || (x.metadata && x.metadata.description) || '' });
async function search(query, { limit, country, tbs }) {
  const body = { query, limit, tbs: tbs || 'qdr:m' }; if (country) body.country = country;
  const d = (await call('/search', body, 60000)).data;   // v2: {web:[...]}; older shapes: a plain array or {results:[...]}
  return (Array.isArray(d) ? d : (d && (d.web || d.results)) || []).filter(Boolean).map(pick).filter((x) => x.url);
}
async function scrapeMarkdown(url) {
  const j = await call('/scrape', { url, formats: ['markdown'], onlyMainContent: true }, 60000);
  return (j.data && j.data.markdown) || '';
}
const SCHEMA = { type: 'object', properties: { jobs: { type: 'array', items: { type: 'object', properties: {
  title: { type: 'string' }, company: { type: 'string' }, location: { type: 'string' }, url: { type: 'string' }, description: { type: 'string' } }, required: ['title'] } } } };
async function scrapeJobs(url) {
  const j = await call('/scrape', { url, formats: [{ type: 'json', schema: SCHEMA, prompt: 'List every job opening on this page with its title, location, apply link and a short description.' }] }, 120000);
  const out = (j.data && (j.data.json || j.data.extract)) || {}, jobs = Array.isArray(out) ? out : out.jobs;
  return Array.isArray(jobs) ? jobs.slice(0, 100) : [];
}
module.exports = { blocked, search, scrapeMarkdown, scrapeJobs, status, explain };
