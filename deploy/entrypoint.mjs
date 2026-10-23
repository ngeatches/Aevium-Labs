// Container entrypoint: make the persistent disk writable by the unprivileged "node" user
// (uid/gid 1000 in the official Node image), drop root, then start the server.
import { mkdirSync, chownSync, readdirSync, statSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uid = Number(process.env.RUN_AS_UID || 1000), gid = Number(process.env.RUN_AS_GID || 1000);
function chownTree(target) {
  chownSync(target, uid, gid);
  if (statSync(target).isDirectory()) for (const name of readdirSync(target)) chownTree(path.join(target, name));
}
if (process.getuid?.() === 0) {
  if (process.env.DATA_DIR) { mkdirSync(process.env.DATA_DIR, { recursive: true }); chownTree(process.env.DATA_DIR); chmodSync(process.env.DATA_DIR, 0o700); }
  process.setgid(gid); process.setuid(uid);
}
const { createPreviewServer } = await import('../server.mjs');
const { startFromEnvironment } = await import('../scripts/commerce/startup.mjs');
await startFromEnvironment({ root, createPreviewServer });
