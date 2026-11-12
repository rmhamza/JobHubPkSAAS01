#!/usr/bin/env node
// Safe copy of the database (works while the app is running).   npm run backup
// Saves to a "backups" folder next to the database (or BACKUP_DIR) and keeps the newest 14 copies.
require('../lib/env');
const fs = require('fs'), path = require('path'), D = require('../lib/db');
const dir = process.env.BACKUP_DIR || path.join(path.dirname(process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.db')), 'backups');
fs.mkdirSync(dir, { recursive: true });
const dest = path.join(dir, `app-${D.today()}.db`), users = D.db.prepare('SELECT COUNT(*) c FROM users').get().c;
D.db.backup(dest).then(() => {
  const old = fs.readdirSync(dir).filter((f) => /^app-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().slice(0, -14); old.forEach((f) => fs.unlinkSync(path.join(dir, f)));
  console.log(`Backup saved: ${dest} (${Math.round(fs.statSync(dest).size / 1024)} KB, ${users} users)`);
}).catch((e) => { console.error('Backup failed:', e.message); process.exit(1); });
