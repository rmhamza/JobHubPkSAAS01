// Demo mode: ready-made test accounts and sample jobs so the app can be explored with no setup.
// ON automatically when NODE_ENV is not "production" and ADMIN_EMAIL is not set. Force with SEED_DEMO=1 / SEED_DEMO=0.
const zlib = require('zlib'), D = require('./db'), A = require('./auth');
const demoOn = () => (process.env.SEED_DEMO ? process.env.SEED_DEMO === '1' : process.env.NODE_ENV !== 'production' && !process.env.ADMIN_EMAIL);
const ACCOUNTS = {
  admin: { email: 'admin@jobpilot.test', password: 'Admin@12345', name: 'Demo Admin', label: 'Admin' },
  starter: { email: 'starter@jobpilot.test', password: 'Starter@12345', name: 'Ali Starter (Demo)', label: 'Starter (local jobs)' },
  pro: { email: 'pro@jobpilot.test', password: 'Pro@12345', name: 'Sara Pro (Demo)', label: 'Pro (international remote)' },
  pending: { email: 'newuser@jobpilot.test', password: 'Pending@12345', name: 'Hamza New User (Demo)' }
};
const RESUME = 'Data analyst with five years of experience building SQL reports, python and pandas analysis, Power BI dashboards and excel models for a bank in Lahore. Strong at data cleaning, reporting, stakeholder communication and presenting insights.';

function png() {   // a small valid PNG that looks like a payment receipt
  const w = 240, h = 320, raw = Buffer.alloc((w * 3 + 1) * h, 255);
  const px = (x, y, c) => { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; };
  const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px(x, y, c); };
  for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0;
  rect(0, 0, w, 70, [22, 167, 101]); rect(100, 24, 140, 46, [255, 255, 255]);
  [100, 125, 150, 175, 215, 240].forEach((y, i) => rect(24, y, i % 2 ? 150 : 200, y + 8, [214, 224, 238])); rect(24, 262, 216, 266, [22, 167, 101]);
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

async function seed() {
  const t = D.today(), exp = D.addDays(t, 365), db = D.db;
  const up = db.prepare(`INSERT INTO users(email,name,pw,plan,status,is_admin,created,expires) VALUES(?,?,?,?, 'approved', ?,?,?)
    ON CONFLICT(email) DO UPDATE SET pw=excluded.pw, plan=excluded.plan, status='approved', is_admin=excluded.is_admin, expires=excluded.expires, fails=0, locked_until=0`);
  const a = ACCOUNTS;
  if (!process.env.ADMIN_EMAIL) up.run(a.admin.email, a.admin.name, await A.hash(a.admin.password), 'pro', 1, t, null);
  up.run(a.starter.email, a.starter.name, await A.hash(a.starter.password), 'starter', 0, t, exp);
  up.run(a.pro.email, a.pro.name, await A.hash(a.pro.password), 'pro', 0, t, exp);
  db.prepare("INSERT OR IGNORE INTO users(email,name,pw,plan,status,shot,txid,created) VALUES(?,?,?,?, 'pending', ?, 'DEMO-TX-001', ?)")
    .run(a.pending.email, a.pending.name, await A.hash(a.pending.password), 'pro', png(), t);
  for (const k of ['starter', 'pro']) {
    const u = db.prepare('SELECT id FROM users WHERE email=?').get(a[k].email);
    if (!D.getProfile(u.id).resume_name) D.saveProfile(u.id, { full_name: a[k].name.replace(' (Demo)', ''), target_role: 'Data Analyst', skills: 'python, sql, power bi, excel',
      keywords: 'data analyst', location: k === 'starter' ? 'Lahore' : '', resume_name: 'sample_resume.txt', resume_text: RESUME, resume_blob: Buffer.from(RESUME) });
  }
}

const LOCAL = [['Data Analyst', 'Orbit Analytics', 'Lahore', 'SQL python Power BI dashboards reporting excel stakeholder communication'], ['Business Intelligence Developer', 'Indus Data Labs', 'Karachi', 'SQL Power BI Tableau data warehouse ETL reporting'],
  ['Junior Data Analyst', 'Punjab Retail Group', 'Lahore', 'excel SQL reporting dashboards data cleaning'], ['Software Engineer (Node.js)', 'Nexa Technologies', 'Islamabad', 'Node.js JavaScript REST APIs MongoDB Git testing'],
  ['Frontend Developer', 'PixelWorks Studio', 'Lahore', 'React JavaScript CSS HTML responsive design Git'], ['Digital Marketing Manager', 'Brandly Pakistan', 'Karachi', 'SEO Google Analytics social media campaigns content budgets'],
  ['Accountant', 'Sadiq and Co Chartered', 'Faisalabad', 'accounting taxation Excel reconciliation financial statements'], ['Customer Support Executive', 'Careline Services', 'Rawalpindi', 'customer support communication CRM English Urdu tickets'],
  ['Graphic Designer', 'Studio Rangoli', 'Lahore', 'Photoshop Illustrator Figma branding social media'], ['HR Officer', 'Karakoram Group', 'Islamabad', 'recruitment onboarding HR policies payroll interviews'],
  ['Sales Executive', 'Shan Traders', 'Multan', 'sales negotiation CRM targets client relationships'], ['Python Developer', 'Zeta Software', 'Lahore', 'Python Django SQL APIs testing Git Linux']];
const REMOTE = [['Remote Data Analyst', 'Northwind Analytics', 'Remote (US time zones)', 'SQL python tableau dashboards reporting stakeholders'], ['Senior Data Analyst', 'Fjord Labs', 'Remote (Europe)', 'SQL python dbt BigQuery dashboards experimentation'],
  ['Remote Frontend Engineer', 'Cloudline', 'Remote (Worldwide)', 'React TypeScript CSS testing accessibility Git'], ['Remote Customer Success Manager', 'Helio Software', 'Remote (Worldwide)', 'customer success onboarding SaaS communication CRM'],
  ['Remote Content Marketer', 'Greenleaf Media', 'Remote (Worldwide)', 'content marketing SEO writing analytics WordPress'], ['Remote Backend Developer', 'Atlas Cloud', 'Remote (EMEA)', 'Node.js PostgreSQL APIs Docker AWS testing'],
  ['Remote Virtual Assistant', 'Pacific Ops', 'Remote (Worldwide)', 'administration scheduling email communication Google Workspace'], ['Remote Product Designer', 'Lumen Apps', 'Remote (Worldwide)', 'Figma UX research prototyping design systems'],
  ['Remote Bookkeeper', 'LedgerLoop', 'Remote (US)', 'bookkeeping QuickBooks reconciliation accounting Excel'], ['Remote Python Engineer', 'Quark Systems', 'Remote (Worldwide)', 'Python Django Flask SQL APIs Docker testing'],
  ['Remote Digital Marketing Specialist', 'Boreal Brands', 'Remote (Worldwide)', 'SEO Google Analytics paid ads email campaigns'], ['Remote Technical Support Engineer', 'Beacon Cloud', 'Remote (Worldwide)', 'support troubleshooting SQL Linux APIs customers']];
const sampleRows = (scope) => (scope === 'remote' ? REMOTE : LOCAL).map(([t, c, loc, skills], i) => ({ title: `${t} - ${c} (Demo)`, location: loc, url: `https://example.com/demo/${scope}/${i + 1}`,
  description: `Apply now. ${c} is hiring a ${t}. Skills: ${skills}. This is a sample listing for demo mode.` }));

const box = () => !demoOn() ? '' : `<div class="demo"><div class="demo-h"><b>Demo accounts</b><span>Click one to fill the form</span></div><div class="demo-b">${['admin', 'starter', 'pro'].filter((k) => k !== 'admin' || !process.env.ADMIN_EMAIL).map((k) =>
  `<button type="button" class="fill" data-email="${ACCOUNTS[k].email}" data-pw="${ACCOUNTS[k].password}"><b>${ACCOUNTS[k].label}</b><span>${ACCOUNTS[k].email}</span></button>`).join('')}</div>
<p>Demo mode is on. To turn it off, set your own ADMIN_EMAIL and NODE_ENV=production.</p></div>`;
module.exports = { demoOn, seed, sampleRows, box, ACCOUNTS, png };
