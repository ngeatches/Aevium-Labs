// Local rehearsal of LIVE mode with fake providers — for reviewing the live wording, checkout totals,
// admin desk and email templates before any account exists. Nothing leaves this computer:
// sign-in codes and email summaries are printed to this terminal. Loopback only.
//
//   BUSINESS_CONFIG=... CATALOG_CONFIG=... npm run build   # builds site-live/
//   BUSINESS_CONFIG=... CATALOG_CONFIG=... node scripts/rehearse-live.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { createPreviewServer } from '../server.mjs';
import { createCommerce } from './commerce/service.mjs';
import { createTestVerifyProvider } from './commerce/verify-providers.mjs';
import { validateBusiness, validateCatalog } from './commerce/config.mjs';
import { readSource } from './read-source.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.REHEARSAL_PORT || 4174);
const origin = `http://127.0.0.1:${port}`;
const business = JSON.parse(readFileSync(path.resolve(root, process.env.BUSINESS_CONFIG || 'config/business.json'), 'utf8'));
const catalog = JSON.parse(readFileSync(path.resolve(root, process.env.CATALOG_CONFIG || 'config/catalog.json'), 'utf8'));
const { products } = await readSource(path.join(root, 'revamp.html'));
const problems = []; validateBusiness(business, problems); validateCatalog(catalog, products, problems);
if (problems.length) { console.error('Rehearsal config incomplete:\n - ' + problems.join('\n - ')); process.exit(1); }
if (!existsSync(path.join(root, 'site-live', 'index.html'))) { console.error('Run npm run build with the same BUSINESS_CONFIG/CATALOG_CONFIG first.'); process.exit(1); }
const adminPhone = process.env.REHEARSAL_ADMIN_PHONE || '+13125550101';
const provider = createTestVerifyProvider();
const start = provider.start;
provider.start = async args => { const result = await start(args); console.log(`[rehearsal] sign-in code for ${args.role} ${args.phone}: ${provider.lastCode(args.phone)}`); return result; };
let n = 0;
const commerce = createCommerce({
  products, mode: 'live', filename: path.join(root, '.data', 'rehearsal-orders.sqlite'), business, catalog, publicOrigin: origin,
  secureCookies: false, webhookSecret: 'whsec_' + Buffer.from('rehearsal-only').toString('base64'), keyPrefix: 'principium-rehearsal',
  verifyProvider: provider, adminPhones: [adminPhone], allowSmsTo: () => true, allowEmail: () => true,
  mailTransport: async message => { console.log(`[rehearsal] email "${message.subject}" → ${message.recipient} (key ${message.idempotencyKey})`); return { channel: 'resend', providerId: `rehearsal_${++n}` }; },
  onError: error => console.error('[rehearsal]', error.message)
});
const server = createPreviewServer({ commerce, accessGate: 'public', publicOrigin: origin, liveRoot: path.join(root, 'site-live') });
server.listen(port, '127.0.0.1', () => console.log(`Live-mode rehearsal (fake providers, nothing sent): ${origin}\nAdmin phone: ${adminPhone}. Customer: any valid +1 number. Codes print here.`));
