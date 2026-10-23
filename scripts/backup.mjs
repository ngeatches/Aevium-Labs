// Consistent online SQLite backup (safe while the server runs), verified with PRAGMA integrity_check.
//   node scripts/backup.mjs                       → backs up the configured database into BACKUP_DIR
//   node scripts/backup.mjs <source.sqlite> <target.sqlite>
// Restore: see docs/DEPLOYMENT.md ("Restore from a backup").
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, rmSync } from 'node:fs';
import { backupDatabase } from './commerce/db.mjs';
import { readEnvFile } from './commerce/config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function backupWithRotation({ source, dir, prefix = 'backup', keep = 14, now = new Date() }) {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const target = path.join(dir, `${prefix}-${stamp}.sqlite`);
  const info = await backupDatabase(source, target);
  const old = readdirSync(dir).filter(name => name.startsWith(prefix + '-') && name.endsWith('.sqlite')).sort().reverse().slice(keep);
  for (const name of old) for (const suffix of ['', '-wal', '-shm']) rmSync(path.join(dir, name + suffix), { force: true });
  return { target, ...info, removed: old.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let [source, target] = process.argv.slice(2);
  if (source && target) {
    const info = await backupDatabase(path.resolve(source), path.resolve(target));
    console.log(`Backup written and verified: ${target} (schema ${info.schema}, ${info.orders} orders)`);
  } else {
    const env = { ...readEnvFile(path.join(root, '.env.local')), ...process.env };
    const live = env.COMMERCE_MODE === 'live';
    source = live ? path.join(env.DATA_DIR || '', `principium-${env.DEPLOY_ENV}.sqlite`) : path.join(root, '.data', 'demo-orders.sqlite');
    const dir = env.BACKUP_DIR || (live ? path.join(env.DATA_DIR, 'backups') : path.join(root, '.data', 'backups'));
    const result = await backupWithRotation({ source, dir, prefix: 'manual', keep: 30 });
    console.log(`Backup written and verified: ${result.target} (schema ${result.schema}, ${result.orders} orders; ${result.removed} old manual backups pruned)`);
  }
}
