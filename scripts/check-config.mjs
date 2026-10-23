// Validates configuration without starting the server or contacting any provider.
// Prints setting NAMES that are missing or invalid — never their values.
//   COMMERCE_MODE=live DEPLOY_ENV=staging ... node scripts/check-config.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './commerce/config.mjs';
import { readSource } from './read-source.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { products } = await readSource(path.join(root, 'revamp.html'));
const config = loadConfig({ root, products });
if (config.problems.length) {
  console.log(`Not ready (${config.mode} mode). Fix these ${config.problems.length} item(s):\n  - ${config.problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(`Configuration complete for ${config.mode}${config.mode === 'live' ? `/${config.deployEnv} (delivery ${config.deliveryMode}, gate ${config.accessGate}, ${config.adminPhones.length} admin number(s))` : ''}.`);
