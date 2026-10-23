import path from 'node:path';
import { existsSync, renameSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { readSource } from '../read-source.mjs';
import { loadConfig, assertConfig } from './config.mjs';
import { createCommerce } from './service.mjs';
import { createTwilioVerifyProvider } from './verify-providers.mjs';
import { createResendTransport } from './email-providers.mjs';
import { backupWithRotation } from '../backup.mjs';

// Never log secrets, codes, message bodies or customer details; only the error class/message.
const log = error => console.error(`[${new Date().toISOString()}] ${error?.name || 'Error'}: ${String(error?.message || error).slice(0, 300)}`);

export async function startFromEnvironment({ root, createPreviewServer, env = process.env }) {
  const { products } = await readSource(path.join(root, 'revamp.html'));
  const config = assertConfig(loadConfig({ root, env, products }));
  let commerce = null;
  if (config.mode === 'demo') {
    commerce = createCommerce({ products, filename: config.dataFile, onError: log });
  }
  if (config.mode === 'live') {
    const liveRoot = path.join(root, 'site-live');
    if (!existsSync(path.join(liveRoot, 'index.html'))) throw new Error('site-live/ is missing. Run `npm run build` with the approved config/business.json and config/catalog.json before starting live mode.');
    // Operator restore: place a backup at <database>.restore and restart. It is integrity-checked and
    // swapped in only at boot (never under a running process); the replaced database is kept as a backup.
    const restoreFile = config.dataFile + '.restore';
    if (existsSync(restoreFile)) {
      const check = new DatabaseSync(restoreFile, { readOnly: true });
      const verdict = Object.values(check.prepare('PRAGMA integrity_check').get())[0]; check.close();
      if (verdict !== 'ok') throw new Error('Restore file failed its integrity check; startup stopped. Remove or replace ' + path.basename(restoreFile) + '.');
      if (existsSync(config.dataFile)) await backupWithRotation({ source: config.dataFile, dir: config.backupDir, prefix: 'replaced-by-restore', keep: 10 });
      for (const suffix of ['-wal', '-shm']) rmSync(config.dataFile + suffix, { force: true });
      renameSync(restoreFile, config.dataFile);
      console.log('Restored database from ' + path.basename(restoreFile) + '; the previous database was backed up first.');
    }
    // Verified backup before any migration runs, so a release can be rolled back with its matching data.
    if (existsSync(config.dataFile)) {
      const result = await backupWithRotation({ source: config.dataFile, dir: config.backupDir, prefix: 'pre-start', keep: 10 });
      console.log(`Pre-start backup verified: ${path.basename(result.target)} (schema ${result.schema}, ${result.orders} orders)`);
    }
    const daily = setInterval(() => backupWithRotation({ source: config.dataFile, dir: config.backupDir, prefix: 'daily', keep: 14 }).then(r => console.log(`Daily backup verified: ${path.basename(r.target)}`)).catch(log), 24 * 60 * 60_000);
    daily.unref();
    const testPhones = new Set(config.testPhones), testEmails = new Set(config.testEmails);
    const open = config.deliveryMode === 'open';
    commerce = createCommerce({
      products, mode: 'live', filename: config.dataFile, onError: log,
      business: config.business, catalog: config.catalog, publicOrigin: config.publicOrigin, secureCookies: true,
      verifyProvider: createTwilioVerifyProvider(config.twilio),
      mailTransport: createResendTransport({ apiKey: config.resend.apiKey, from: config.resend.from, replyTo: config.resend.replyTo }),
      webhookSecret: config.resend.webhookSecret, keyPrefix: `principium-${config.deployEnv}`,
      adminPhones: config.adminPhones, smsDailyLimit: config.smsDailyLimit,
      allowSmsTo: phone => open || testPhones.has(phone),
      allowEmail: email => open || testEmails.has(String(email).toLowerCase())
    });
    config.liveRoot = liveRoot;
  }
  const server = createPreviewServer({
    commerce, password: config.previewPassword, accessGate: config.accessGate,
    secureCookies: config.secureCookies, publicOrigin: config.publicOrigin, trustProxyHops: config.trustProxyHops,
    allowedHosts: config.mode === 'live' ? [new URL(config.publicOrigin).host.toLowerCase()] : null,
    liveRoot: config.liveRoot || null, allowIndexing: config.mode === 'live' && config.accessGate === 'public' && env.ALLOW_INDEXING === 'yes', log
  });
  server.listen(config.port, config.host, () => {
    const summary = config.mode === 'live' ? `live/${config.deployEnv} · delivery ${config.deliveryMode} · gate ${config.accessGate}` : config.mode;
    console.log(`Aevium Labs ready: ${config.publicOrigin || `http://${config.host}:${config.port}`} (${summary})`);
  });
  const shutdown = signal => {
    console.log(`${signal} received; closing.`);
    server.close(() => process.exit(0));
    server.closeIdleConnections?.();
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
  return { server, config };
}
