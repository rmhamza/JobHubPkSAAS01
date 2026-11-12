// Demo mode: ready-made test accounts and sample jobs, no keys needed.
const { test, before, after } = require('node:test'), assert = require('node:assert/strict'), os = require('os'), path = require('path');
for (const k of ['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'FIRECRAWL_API_KEY', 'ANTHROPIC_API_KEY', 'SEED_DEMO']) delete process.env[k];
Object.assign(process.env, { DB_PATH: path.join(os.tmpdir(), 'jp-demo-' + Date.now() + '.db'), NODE_ENV: 'test', RATE_LOGIN: '1000' });
const server = require('../server'), demo = require('../lib/demo'), A = demo.ACCOUNTS; let base, srv, jar = {};
before(async () => { await server.ready(); await new Promise((r) => { srv = server.app.listen(0, () => { base = `http://127.0.0.1:${srv.address().port}`; r(); }); }); });
after(() => { srv.closeAllConnections && srv.closeAllConnections(); srv.close(); });
async function api(who, method, p, body) {
  const r = await fetch(base + p, { method, redirect: 'manual', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(jar[who] ? { cookie: jar[who] } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc && !sc.startsWith('sid=;')) jar[who] = sc.split(';')[0];
  const ct = r.headers.get('content-type') || ''; return { status: r.status, headers: r.headers, json: ct.includes('json') ? await r.json() : null, text: ct.includes('json') ? null : Buffer.from(await r.arrayBuffer()) };
}
test('demo accounts exist and log in; the unpaid demo signup is still pending', async () => {
  for (const k of ['admin', 'starter', 'pro']) assert.equal((await api(k, 'POST', '/api/login', { email: A[k].email, password: A[k].password })).status, 200, k);
  assert.equal((await api('x', 'POST', '/api/login', { email: A.pending.email, password: A.pending.password })).status, 403);
  assert.equal((await api('admin', 'GET', '/api/me')).json.user.isAdmin, true);
  assert.equal((await api('starter', 'GET', '/api/me')).json.user.plan, 'starter'); assert.equal((await api('pro', 'GET', '/api/me')).json.user.plan, 'pro');
  assert.equal((await api('admin', 'GET', '/admin')).status, 200);
});
test('admin sees the pending demo signup with a real receipt image', async () => {
  const o = (await api('admin', 'GET', '/api/admin/overview')).json; assert.equal(o.stats.pending, 1);
  const shot = await api('admin', 'GET', '/api/admin/shot/' + o.users.find((u) => u.state === 'Pending').id); assert.equal(shot.headers.get('content-type'), 'image/png'); assert.equal(shot.text.slice(1, 4).toString(), 'PNG');
});
test('sample jobs: Starter gets local jobs, remote is Pro only', async () => {
  const s = await api('starter', 'POST', '/api/search', { keywords: 'data analyst', location: 'Lahore' }); assert.equal(s.status, 200, JSON.stringify(s.json));
  assert.ok(s.json.jobs.length >= 5); assert.ok(s.json.notes.some((n) => /Demo mode/.test(n))); assert.ok(s.json.jobs.every((j) => j.url.startsWith('https://example.com/demo/local/')));
  assert.ok(s.json.jobs[0].match >= s.json.jobs.at(-1).match); assert.match(s.json.jobs[0].title, /Data Analyst/);
  assert.equal((await api('starter', 'POST', '/api/search', { keywords: 'data analyst', scope: 'remote' })).status, 403);
  const p = await api('pro', 'POST', '/api/search', { keywords: 'data analyst', scope: 'remote' }); assert.equal(p.status, 200);
  assert.ok(p.json.jobs.length >= 5 && p.json.jobs.every((j) => j.url.includes('/demo/remote/')) && p.json.jobs.some((j) => /Remote/.test(j.location)));
  assert.equal((await api('starter', 'GET', '/api/profile')).json.profile.resume_name, 'sample_resume.txt');
});
test('login page shows demo accounts only in demo mode', async () => {
  const on = (await api('x', 'GET', '/login')).text.toString(); assert.match(on, /Demo accounts/); assert.match(on, /admin@jobpilot\.test/); assert.match(on, /Starter@12345/);
  process.env.NODE_ENV = 'production'; const off = (await api('x', 'GET', '/login')).text.toString(); process.env.NODE_ENV = 'test';
  assert.doesNotMatch(off, /Demo accounts|Admin@12345/); assert.match((await api('x', 'GET', '/')).text.toString(), /Demo mode is on/); process.env.NODE_ENV = 'production'; assert.doesNotMatch((await api('x', 'GET', '/')).text.toString(), /Demo mode is on/); process.env.NODE_ENV = 'test';
});
