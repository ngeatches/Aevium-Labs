import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parsePhoneList } from './phone.mjs';

// Reads `KEY=value` lines from an ignored .env.local. Real environment variables take precedence.
export function readEnvFile(filename) {
  let text;
  try { text = readFileSync(filename, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
  return Object.fromEntries(text.split(/\r?\n/).filter(line => /^[A-Z0-9_]+=/.test(line)).map(line => {
    const i = line.indexOf('=');
    let value = line.slice(i + 1).trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    return [line.slice(0, i), value];
  }));
}

const readJson = (filename, label, problems) => {
  try { return JSON.parse(readFileSync(filename, 'utf8')); }
  catch (error) { problems.push(error.code === 'ENOENT' ? `${label} not found at ${filename}` : error.code ? `${label} could not be read (${error.code})` : `${label} is not valid JSON`); return null; }
};
const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const list = value => (value || '').split(',').map(item => item.trim()).filter(Boolean);

/** Validates verified business content. Returns problems (strings) without echoing values. */
export function validateBusiness(business, problems) {
  if (!business) return;
  const need = (ok, message) => { if (!ok) problems.push(`business config: ${message}`); };
  need(business.approved?.by && /^\d{4}-\d{2}-\d{2}$/.test(business.approved?.date || ''), 'approved.by and approved.date (YYYY-MM-DD) are required — record who approved this content');
  need(typeof business.businessName === 'string' && business.businessName.trim(), 'businessName is required');
  need(emailPattern.test(business.supportEmail || ''), 'supportEmail must be a valid address');
  need(business.zelle?.verified === true, 'zelle.verified must be true after the owner confirms the recipient');
  need(typeof business.zelle?.recipientName === 'string' && business.zelle.recipientName.trim(), 'zelle.recipientName is required');
  need(typeof business.zelle?.recipientHandle === 'string' && business.zelle.recipientHandle.trim(), 'zelle.recipientHandle (enrolled email or phone) is required');
  need(Array.isArray(business.shipping?.countries) && business.shipping.countries.length && business.shipping.countries.every(c => typeof c === 'string' && c.trim()), 'shipping.countries must list at least one served country');
  need(Number.isSafeInteger(business.shipping?.flatFeeCents) && business.shipping.flatFeeCents >= 0, 'shipping.flatFeeCents must be a whole number of cents (0 allowed)');
  need(business.tax?.mode === 'not_collected' && typeof business.tax?.statement === 'string' && business.tax.statement.trim(), 'tax.mode must be "not_collected" with an approved tax.statement (automatic tax calculation is not implemented)');
  need(/^\d{4}-\d{2}-\d{2}\.\d+$/.test(business.policyVersion || ''), 'policyVersion (e.g. 2026-11-01.1) is required');
  need(business.policiesApproved === true, 'policiesApproved must be true after the owner (and counsel, if used) approves the live policies');
  for (const key of ['shipping', 'refunds', 'terms']) need(typeof business.policies?.[key] === 'string' && business.policies[key].trim().length >= 40, `policies.${key} needs the approved policy text`);
  need(typeof business.retention === 'string' && business.retention.trim(), 'retention (how long order records and backups are kept) is required');
}

/** Validates verified prices/availability against the catalog extracted from the source reference. */
export function validateCatalog(catalog, products, problems) {
  if (!catalog) return;
  const need = (ok, message) => { if (!ok) problems.push(`catalog config: ${message}`); };
  need(catalog.approved?.by && /^\d{4}-\d{2}-\d{2}$/.test(catalog.approved?.date || ''), 'approved.by and approved.date are required');
  need(catalog.currency === 'USD', 'currency must be "USD"');
  const entries = catalog.products && typeof catalog.products === 'object' ? catalog.products : {};
  const known = new Set(products.map(p => p.id));
  for (const [id, entry] of Object.entries(entries)) {
    need(known.has(id), `unknown product id "${id}"`);
    need(Number.isSafeInteger(entry?.priceCents) && entry.priceCents > 0, `${id}.priceCents must be a positive whole number of cents`);
    need(typeof entry?.available === 'boolean', `${id}.available must be true or false`);
  }
  need(Object.values(entries).some(entry => entry?.available === true), 'at least one product must be available');
}

/**
 * Builds runtime configuration. Modes:
 *   demo — local simulation on loopback only (default). Codes on screen, emails captured locally.
 *   off  — order API disabled.
 *   live — real Twilio Verify + Resend. Requires DEPLOY_ENV (staging|production), HTTPS origin,
 *          persistent DATA_DIR, provider credentials, admin allowlist and approved business/catalog
 *          configuration. Any missing item stops startup (fail closed).
 */
export function loadConfig({ root, env = process.env, products = [] }) {
  const file = readEnvFile(path.join(root, '.env.local'));
  const get = key => env[key] ?? file[key] ?? '';
  const mode = get('COMMERCE_MODE') || 'demo';
  const problems = [];
  if (!['demo', 'off', 'live'].includes(mode)) problems.push('COMMERCE_MODE must be demo, off or live');
  const config = {
    mode, root,
    host: get('HOST') || '127.0.0.1',
    port: Number(get('PORT') || 4173),
    publicOrigin: get('PUBLIC_ORIGIN') || null,
    trustProxyHops: Number(get('TRUST_PROXY_HOPS') || 0),
    previewPassword: get('PREVIEW_PASSWORD'),
    deployEnv: get('DEPLOY_ENV') || (mode === 'live' ? '' : 'local'),
    accessGate: get('ACCESS_GATE') || 'password'
  };
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) problems.push('PORT must be a valid port');
  if (!Number.isInteger(config.trustProxyHops) || config.trustProxyHops < 0 || config.trustProxyHops > 3) problems.push('TRUST_PROXY_HOPS must be 0–3');
  if (!['password', 'public'].includes(config.accessGate)) problems.push('ACCESS_GATE must be password or public');
  if (config.accessGate === 'password' && !config.previewPassword) problems.push('PREVIEW_PASSWORD is required while ACCESS_GATE=password');
  if (config.publicOrigin && !/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(config.publicOrigin)) problems.push('PUBLIC_ORIGIN must be an https:// origin without a path');
  const loopback = ['127.0.0.1', '::1'].includes(config.host);
  if (!loopback && !config.publicOrigin) problems.push('Binding to a non-loopback HOST requires an https PUBLIC_ORIGIN behind a TLS-terminating proxy');

  if (mode === 'demo') {
    if (config.publicOrigin || !loopback) problems.push('The order demo must run on loopback without PUBLIC_ORIGIN. Use COMMERCE_MODE=live for staging/production');
    if (config.accessGate !== 'password') problems.push('The demo keeps the password gate (ACCESS_GATE=password)');
    config.dataFile = path.join(root, '.data', 'demo-orders.sqlite');
  }
  if (mode === 'live') {
    if (!['staging', 'production'].includes(config.deployEnv)) problems.push('DEPLOY_ENV must be staging or production in live mode');
    if (!config.publicOrigin) problems.push('PUBLIC_ORIGIN (https) is required in live mode');
    if (config.accessGate === 'public' && config.deployEnv !== 'production') problems.push('ACCESS_GATE=public is only allowed with DEPLOY_ENV=production; keep staging behind the password');
    const dataDir = get('DATA_DIR');
    if (!dataDir || !path.isAbsolute(dataDir)) problems.push('DATA_DIR must be an absolute path on a persistent disk');
    else if (path.resolve(dataDir).startsWith(path.join(root, 'site'))) problems.push('DATA_DIR must be outside the public site folder');
    config.dataFile = dataDir ? path.join(dataDir, `principium-${config.deployEnv || 'live'}.sqlite`) : null;
    config.backupDir = get('BACKUP_DIR') || (dataDir ? path.join(dataDir, 'backups') : null);

    config.twilio = { accountSid: get('TWILIO_ACCOUNT_SID'), apiKeySid: get('TWILIO_API_KEY_SID'), apiKeySecret: get('TWILIO_API_KEY_SECRET'), serviceSid: get('TWILIO_VERIFY_SERVICE_SID') };
    for (const [key, value] of Object.entries({ TWILIO_ACCOUNT_SID: config.twilio.accountSid, TWILIO_API_KEY_SID: config.twilio.apiKeySid, TWILIO_API_KEY_SECRET: config.twilio.apiKeySecret, TWILIO_VERIFY_SERVICE_SID: config.twilio.serviceSid })) if (!value) problems.push(`${key} is required`);
    config.smsDailyLimit = Number(get('SMS_DAILY_LIMIT') || 300);
    if (!Number.isInteger(config.smsDailyLimit) || config.smsDailyLimit < 1) problems.push('SMS_DAILY_LIMIT must be a positive whole number');
    try { config.adminPhones = parsePhoneList(get('ADMIN_PHONES')); } catch (error) { problems.push('ADMIN_PHONES: ' + error.message); config.adminPhones = []; }
    if (!config.adminPhones.length) problems.push('ADMIN_PHONES must list at least one owner-approved +1 number');

    config.resend = { apiKey: get('RESEND_API_KEY'), webhookSecret: get('RESEND_WEBHOOK_SECRET'), from: get('MAIL_FROM'), replyTo: get('MAIL_REPLY_TO') || null };
    for (const [key, value] of Object.entries({ RESEND_API_KEY: config.resend.apiKey, RESEND_WEBHOOK_SECRET: config.resend.webhookSecret, MAIL_FROM: config.resend.from })) if (!value) problems.push(`${key} is required`);
    if (config.resend.webhookSecret && !config.resend.webhookSecret.startsWith('whsec_')) problems.push('RESEND_WEBHOOK_SECRET should be the whsec_… signing secret from the Resend webhook page');

    config.deliveryMode = get('DELIVERY_MODE') || 'test';
    if (!['test', 'open'].includes(config.deliveryMode)) problems.push('DELIVERY_MODE must be test or open');
    if (config.deliveryMode === 'open' && config.deployEnv !== 'production') problems.push('DELIVERY_MODE=open is only allowed with DEPLOY_ENV=production');
    if (config.deliveryMode === 'open' && get('LAUNCH_APPROVED') !== 'yes') problems.push('DELIVERY_MODE=open requires LAUNCH_APPROVED=yes (the owner’s explicit launch decision)');
    try { config.testPhones = parsePhoneList(get('TEST_PHONE_ALLOWLIST')); } catch (error) { problems.push('TEST_PHONE_ALLOWLIST: ' + error.message); config.testPhones = []; }
    config.testEmails = list(get('TEST_EMAIL_ALLOWLIST')).map(email => email.toLowerCase());
    if (config.testEmails.some(email => !emailPattern.test(email))) problems.push('TEST_EMAIL_ALLOWLIST contains an invalid address');
    if (config.deliveryMode === 'test') {
      if (!config.testPhones.length) problems.push('TEST_PHONE_ALLOWLIST is required in DELIVERY_MODE=test');
      if (!config.testEmails.length) problems.push('TEST_EMAIL_ALLOWLIST is required in DELIVERY_MODE=test');
      const missingAdmins = config.adminPhones.filter(phone => !config.testPhones.includes(phone));
      if (missingAdmins.length) problems.push('Every ADMIN_PHONES number must also be in TEST_PHONE_ALLOWLIST while DELIVERY_MODE=test');
    }

    const businessFile = path.resolve(root, get('BUSINESS_CONFIG') || 'config/business.json');
    const catalogFile = path.resolve(root, get('CATALOG_CONFIG') || 'config/catalog.json');
    config.business = readJson(businessFile, 'BUSINESS_CONFIG', problems);
    config.catalog = readJson(catalogFile, 'CATALOG_CONFIG', problems);
    validateBusiness(config.business, problems);
    validateCatalog(config.catalog, products, problems);
  }
  config.problems = problems;
  config.secureCookies = !!config.publicOrigin;
  return config;
}

export function assertConfig(config) {
  if (config.problems.length) {
    const error = new Error(`Configuration incomplete — refusing to start (${config.mode} mode):\n  - ${config.problems.join('\n  - ')}`);
    error.problems = config.problems;
    throw error;
  }
  return config;
}
