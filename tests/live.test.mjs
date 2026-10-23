// Live-mode integration tests. Every provider is a fake: no SMS, email or network request leaves this process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';
import { createPreviewServer } from '../server.mjs';
import { createCommerce } from '../scripts/commerce/service.mjs';
import { createTestVerifyProvider, createTwilioVerifyProvider, ProviderError } from '../scripts/commerce/verify-providers.mjs';
import { createResendTransport, signSvix, verifySvixSignature, TransportError } from '../scripts/commerce/email-providers.mjs';
import { loadConfig } from '../scripts/commerce/config.mjs';
import { openDatabase, backupDatabase } from '../scripts/commerce/db.mjs';
import { normalizePhone } from '../scripts/commerce/phone.mjs';
import { acknowledgments } from '../scripts/commerce/policy.mjs';

const origin = 'https://shop.example.test';
const products = [{ id: 'sample-a', name: 'Sample A', mg: '10 mg', price: 49 }, { id: 'sample-b', name: 'Sample B', mg: '5 mg', price: 79 }, { id: 'sample-c', name: 'Sample C', mg: '2 mg', price: 30 }];
const business = {
  approved: { by: 'Test Owner', date: '2026-10-13' }, businessName: 'Example Research Supply', supportEmail: 'support@example.test',
  zelle: { recipientName: 'Example Research Supply LLC', recipientHandle: 'pay@example.test', verified: true },
  shipping: { countries: ['United States'], flatFeeCents: 1500 }, tax: { mode: 'not_collected', statement: 'Sales tax is not collected on these orders in the test configuration.' },
  policyVersion: '2026-10-13.1', policiesApproved: true, retention: 'Test retention statement.',
  policies: { shipping: 'Test shipping policy text that is long enough to be meaningful.', refunds: 'Test refund policy text that is long enough to be meaningful.', terms: 'Test terms text that is long enough to be meaningful for validation.' }
};
const catalog = { approved: { by: 'Test Owner', date: '2026-10-13' }, currency: 'USD', products: { 'sample-a': { priceCents: 5000, available: true }, 'sample-b': { priceCents: 8000, available: true }, 'sample-c': { priceCents: 3000, available: false } } };
const webhookSecret = 'whsec_' + Buffer.from('test-webhook-signing-secret-32by').toString('base64');
const admins = ['+13125550101'];
const testPhones = new Set(['+13125550101', '+13125550102', '+13125550103', '+13125550104', '+13125550105']);
const testEmails = new Set(['lab@example.test', 'other@example.test']);
const customer = { zelleSender: 'lab@example.test', name: 'Test Lab', email: 'lab@example.test', address: '1 Example Way', city: 'Chicago', region: 'IL', postal: '60601', country: 'united states' };
const orderBody = (phone, key = 'live-order-0000000001', items = [{ id: 'sample-a', quantity: 2, priceCents: 1 }, { id: 'sample-b', quantity: 1 }]) => ({ idempotencyKey: key, customer: { ...customer, phone }, policyVersion: business.policyVersion, acknowledgments: Object.fromEntries(Object.keys(acknowledgments).map(k => [k, true])), items });

function fakeResend({ ids = [] } = {}) {
  const calls = []; let mode = 'ok', counter = 0;
  const transport = async message => {
    calls.push({ key: message.idempotencyKey, to: message.recipient, subject: message.subject, text: message.text });
    if (mode === 'timeout') throw new TransportError('Email provider did not respond.', { code: 'timeout' });
    if (mode === 'reject') throw new TransportError('Email provider rejected the message (422).', { retryable: false, code: 'validation_error' });
    if (mode === 'hang') return new Promise(() => {});
    return { channel: 'resend', providerId: ids.shift() || `em_${++counter}` };
  };
  return { transport, calls, set: value => { mode = value; } };
}

async function fixture({ filename = ':memory:', now = () => Date.now(), gate = 'public', provider = createTestVerifyProvider(), mail = fakeResend(), adminPhones = admins } = {}) {
  const commerce = createCommerce({ products, mode: 'live', filename, now, mailIntervalMs: 0, business, catalog, publicOrigin: origin, secureCookies: true, webhookSecret, keyPrefix: 'principium-test', verifyProvider: provider, mailTransport: mail.transport, adminPhones, allowSmsTo: p => testPhones.has(p), allowEmail: e => testEmails.has(e) });
  const server = createPreviewServer({ commerce, accessGate: gate, password: gate === 'password' ? 'staging-password' : undefined, secureCookies: true, publicOrigin: origin, now });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const client = () => {
    const cookies = new Map();
    const request = async (url, body, extra = {}) => {
      const response = await fetch(base + url, { redirect: 'manual', method: body === undefined ? 'GET' : 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '), ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
      for (const value of response.headers.getSetCookie()) { const pair = value.split(';')[0]; const i = pair.indexOf('='); const v = pair.slice(i + 1); if (v) cookies.set(pair.slice(0, i), v); else cookies.delete(pair.slice(0, i)); }
      return response;
    };
    const start = async (phone, role = 'customer') => request(`/api/${role}/auth/start`, { phone });
    const signIn = async (phone, role = 'customer') => {
      const started = await start(phone, role); assert.equal(started.status, 200, await started.clone().text());
      const { challenge, demoCode } = await started.json(); assert.equal(demoCode, undefined);
      const verified = await request(`/api/${role}/auth/verify`, { challenge, code: provider.lastCode(phone) });
      assert.equal(verified.status, 200); const result = await verified.json();
      if (role === 'customer' && !result.customer.profileComplete) {
        const saved = await request('/api/customer/profile', { firstName: 'Test', lastName: 'Researcher', birthDate: '1990-01-15', role: 'Lab / institutional researcher', accepted: true });
        assert.equal(saved.status, 200, await saved.clone().text()); result.customer = (await saved.json()).customer;
      }
      return result;
    };
    return { request, start, signIn, cookies };
  };
  const webhook = async (payload, { id = 'msg_' + Math.random().toString(36).slice(2), timestamp = Math.floor(now() / 1000), secret = webhookSecret } = {}) => {
    const body = JSON.stringify(payload);
    return fetch(base + '/api/webhooks/resend', { method: 'POST', headers: { 'Content-Type': 'application/json', 'svix-id': id, 'svix-timestamp': String(timestamp), 'svix-signature': signSvix({ secret, id, timestamp, body }) }, body });
  };
  return { server, base, client, commerce, provider, mail, webhook, close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}

test('phone normalization accepts +1 subscriber numbers only', () => {
  assert.equal(normalizePhone('(312) 555-0101'), '+13125550101');
  assert.equal(normalizePhone('+1 312 555 0101'), '+13125550101');
  for (const bad of ['+44 20 7946 0958', '+11125550101', '+13121110101', '911', 'abc', '+1312555010', '+1 911 555 0101']) assert.equal(normalizePhone(bad), null, bad);
});

test('live OTP: SMS code never returned, single use, expires, attempt-limited, bound to the browser and throttled', async t => {
  let clock = Date.now(); const f = await fixture({ now: () => clock }); t.after(f.close);
  const a = f.client(), b = f.client();
  assert.equal((await a.start('+447700900123')).status, 400);
  assert.equal((await a.start('+13125550199')).status, 403, 'non-allowlisted number blocked in test delivery mode');
  const started = await (await a.start('(312) 555-0102')).json();
  assert.equal(started.demoCode, undefined); assert.equal(started.mode, 'sms'); assert.equal(f.provider.outbox.length, 1);
  assert.equal((await a.start('+13125550102')).status, 429, 'resend cooldown');
  const code = f.provider.lastCode('+13125550102');
  assert.equal((await b.request('/api/customer/auth/verify', { challenge: started.challenge, code })).status, 401, 'other browser cannot use the challenge');
  assert.equal((await a.request('/api/admin/auth/verify', { challenge: started.challenge, code })).status, 401, 'customer challenge cannot create admin session');
  assert.equal((await a.request('/api/customer/auth/verify', { challenge: started.challenge, code })).status, 200);
  assert.equal((await a.request('/api/customer/auth/verify', { challenge: started.challenge, code })).status, 401, 'single use');
  clock += 31_000;
  const second = await (await a.start('+13125550102')).json(); clock += 10 * 60_000 + 1;
  assert.equal((await a.request('/api/customer/auth/verify', { challenge: second.challenge, code: f.provider.lastCode('+13125550102') })).status, 401, 'expired');
  clock += 31_000;
  const third = await (await a.start('+13125550102')).json(); const wrong = f.provider.lastCode('+13125550102') === '000000' ? '000001' : '000000';
  for (let i = 0; i < 5; i++) assert.equal((await a.request('/api/customer/auth/verify', { challenge: third.challenge, code: wrong })).status, 401);
  assert.equal((await a.request('/api/customer/auth/verify', { challenge: third.challenge, code: f.provider.lastCode('+13125550102') })).status, 401, 'locked after five attempts');
  // Per-number hourly send limit (5 within the hour, counting the three above).
  for (let i = 0; i < 2; i++) { clock += 31_000; assert.equal((await a.start('+13125550102')).status, 200); }
  clock += 31_000; const limited = await a.start('+13125550102'); assert.equal(limited.status, 429); assert.ok(Number(limited.headers.get('retry-after')) > 0);
});

test('provider outage and timeouts fail without issuing a session', async t => {
  const provider = createTestVerifyProvider(); const f = await fixture({ provider }); t.after(f.close); const a = f.client();
  provider.failWith = new ProviderError('The verification service did not respond. Please try again shortly.', { code: 'timeout' });
  const r = await a.start('+13125550102'); assert.equal(r.status, 503); assert.match((await r.json()).error, /did not respond/);
  provider.failWith = null; const { challenge } = await (await a.start('+13125550102')).json();
  provider.failWith = new ProviderError('That code has expired. Request a new code.', { status: 401, terminal: true });
  assert.equal((await a.request('/api/customer/auth/verify', { challenge, code: provider.lastCode('+13125550102') })).status, 401);
  provider.failWith = null;
  assert.equal((await a.request('/api/customer/auth/verify', { challenge, code: provider.lastCode('+13125550102') })).status, 401, 'terminal provider error discards challenge');
  assert.equal((await a.request('/api/orders')).status, 401);
});

test('admin access only for allowlisted numbers; non-admin numbers get no SMS and no session', async t => {
  const adminPhones = [...admins]; const f = await fixture({ adminPhones }); t.after(f.close);
  const c = f.client(), admin = f.client();
  await c.signIn('+13125550102');
  const sends = f.provider.outbox.length;
  const r = await c.start('+13125550103', 'admin'); assert.equal(r.status, 200, 'same response shape to avoid enumeration');
  const { challenge } = await r.json(); assert.equal(f.provider.outbox.length, sends, 'no SMS for non-admin number');
  assert.equal((await c.request('/api/admin/auth/verify', { challenge, code: '123456' })).status, 401);
  assert.equal((await c.request('/api/admin/orders')).status, 401, 'verified customer is not an admin');
  await admin.signIn('+13125550101', 'admin');
  assert.equal((await admin.request('/api/admin/orders')).status, 200);
  adminPhones.splice(0); // owner removes the number from ADMIN_PHONES
  assert.equal((await admin.request('/api/admin/orders')).status, 401, 'removal revokes existing admin session');
});

test('live orders: verified prices only, tampering ignored, availability, shipping fee, countries and duplicates', async t => {
  const f = await fixture(); t.after(f.close); const c = f.client(); const phone = '+13125550102'; await c.signIn(phone);
  const shop = await (await c.request('/api/shop')).json();
  assert.equal(shop.mode, 'live'); assert.equal(shop.demoCustomerPhone, undefined); assert.equal(shop.products.find(p => p.id === 'sample-a').priceCents, 5000); assert.equal(shop.paymentInstructions.recipientHandle, 'pay@example.test');
  assert.equal((await c.request('/api/orders', orderBody(phone, 'live-order-unavailable', [{ id: 'sample-c', quantity: 1 }]))).status, 409);
  assert.equal((await c.request('/api/orders', { ...orderBody(phone), customer: { ...customer, phone, country: 'Canada' } })).status, 400);
  assert.equal((await c.request('/api/orders', { ...orderBody(phone), policyVersion: '2026-10-12.1' })).status, 400, 'demo policy version rejected in live');
  assert.equal((await c.request('/api/orders', orderBody(phone), { Origin: 'http://127.0.0.1' })).status, 403);
  const r = await c.request('/api/orders', orderBody(phone)); assert.equal(r.status, 201);
  const { order } = await r.json();
  assert.equal(order.totalCents, 2 * 5000 + 8000 + 1500); assert.equal(order.shippingCents, 1500); assert.equal(order.items[0].priceCents, 5000); assert.equal(order.customer.country, 'United States'); assert.equal(order.demo, false);
  assert.equal((await (await c.request('/api/orders', orderBody(phone))).json()).order.id, order.id, 'retry returns the same order');
  assert.equal((await (await c.request('/api/orders')).json()).orders.length, 1);
});

test('transactional email: provider ids, idempotency keys, test allowlist, crash recovery and retry reconciliation', async t => {
  let clock = Date.now(); const dir = await mkdtemp(path.join(os.tmpdir(), 'pp-live-mail-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const filename = path.join(dir, 'live.sqlite'); const mail = fakeResend();
  const f = await fixture({ filename, now: () => clock, mail }); const c = f.client(), d = f.client(); await c.signIn('+13125550102'); await d.signIn('+13125550103');
  const { order } = await (await c.request('/api/orders', orderBody('+13125550102'))).json();
  await f.commerce.flushMail();
  assert.equal(mail.calls.length, 1); assert.equal(mail.calls[0].key, `principium-test:${order.id}:created`); assert.equal(mail.calls[0].to, 'lab@example.test');
  assert.match(mail.calls[0].text, /pay@example\.test/); assert.match(mail.calls[0].text, /https:\/\/shop\.example\.test\/orders\/#\d{4}/); assert.doesNotMatch(mail.calls[0].text, /DEMO/);
  let emails = (await (await c.request(`/api/orders/${order.id}/emails`)).json()).emails; assert.equal(emails[0].status, 'accepted', 'accepted is not delivered');
  // Non-allowlisted recipient is suppressed without contacting the provider.
  const blocked = await (await d.request('/api/orders', { ...orderBody('+13125550103', 'live-order-blocked-001'), customer: { ...customer, phone: '+13125550103', email: 'stranger@example.test' } })).json();
  await f.commerce.flushMail(); assert.equal(mail.calls.length, 1);
  assert.equal((await (await d.request(`/api/orders/${blocked.order.id}/emails`)).json()).emails[0].status, 'suppressed');
  // Timeout → retry with the same key.
  const second = await (await c.request('/api/orders', orderBody('+13125550102', 'live-order-second-0001'))).json();
  mail.set('timeout'); await f.commerce.flushMail(); mail.set('ok'); clock += 31_000; await f.commerce.flushMail();
  const secondCalls = mail.calls.filter(m => m.key.includes(second.order.id)); assert.equal(secondCalls.length, 2); assert.equal(secondCalls[0].key, secondCalls[1].key);
  // Crash while the provider call is in flight: the lease expires and the restarted worker resends with the same key.
  const third = await (await c.request('/api/orders', orderBody('+13125550102', 'live-order-third-00001'))).json();
  mail.set('hang'); f.commerce.flushMail(); await new Promise(r => setTimeout(r, 20)); await f.close(); f.commerce.close();
  mail.set('ok'); clock += 121_000;
  const g = await fixture({ filename, now: () => clock, mail }); t.after(g.close); await g.commerce.flushMail();
  const thirdCalls = mail.calls.filter(m => m.key.includes(third.order.id)); assert.equal(thirdCalls.length, 2); assert.equal(thirdCalls[0].key, thirdCalls[1].key);
  const admin = g.client(); await admin.signIn('+13125550101', 'admin');
  const list = (await (await admin.request('/api/admin/emails')).json()).emails;
  assert.ok(list.filter(m => m.order_id !== blocked.order.id).every(m => m.status === 'accepted' && m.providerId));
  // Permanent rejection → failed; admin retry uses a fresh key round.
  const c2 = g.client(); await c2.signIn('+13125550102');
  const fourth = await (await c2.request('/api/orders', orderBody('+13125550102', 'live-order-fourth-0001'))).json();
  mail.set('reject'); await g.commerce.flushMail(); mail.set('ok');
  const failed = (await (await admin.request('/api/admin/emails')).json()).emails.find(m => m.order_id === fourth.order.id); assert.equal(failed.status, 'failed');
  assert.equal((await admin.request(`/api/admin/emails/${failed.id}/retry`, {})).status, 200); await g.commerce.flushMail();
  const fourthCalls = mail.calls.filter(m => m.key.includes(fourth.order.id)); assert.equal(fourthCalls.at(-1).key, `principium-test:${fourth.order.id}:created:r1`);
  assert.equal((await admin.request(`/api/admin/emails/${failed.id}/retry`, {})).status, 409, 'accepted messages are not retried');
});

test('delivery webhooks: signature, timestamp, deduplication, ordering, early events and bounce suppression', async t => {
  const mail = fakeResend({ ids: ['em_first', 'em_early', 'em_bounce'] }); const f = await fixture({ mail }); t.after(f.close);
  const c = f.client(); await c.signIn('+13125550102'); const admin = f.client(); await admin.signIn('+13125550101', 'admin');
  const { order } = await (await c.request('/api/orders', orderBody('+13125550102'))).json(); await f.commerce.flushMail();
  const event = (type, emailId, extra = {}) => ({ type, created_at: new Date().toISOString(), data: { email_id: emailId, to: ['lab@example.test'], ...extra } });
  const raw = JSON.stringify(event('email.delivered', 'em_first'));
  assert.equal((await fetch(f.base + '/api/webhooks/resend', { method: 'POST', headers: { 'svix-id': 'x', 'svix-timestamp': String(Math.floor(Date.now() / 1000)), 'svix-signature': 'v1,AAAA' }, body: raw })).status, 401);
  assert.equal((await f.webhook(event('email.delivered', 'em_first'), { secret: 'whsec_' + Buffer.from('wrong-secret').toString('base64') })).status, 401);
  assert.equal((await f.webhook(event('email.delivered', 'em_first'), { timestamp: Math.floor(Date.now() / 1000) - 600 })).status, 401, 'stale timestamp');
  const ok = await f.webhook(event('email.delivered', 'em_first'), { id: 'msg_delivered_1' }); assert.equal(ok.status, 200); assert.equal((await ok.json()).duplicate, false);
  assert.equal((await (await f.webhook(event('email.delivered', 'em_first'), { id: 'msg_delivered_1' })).json()).duplicate, true);
  await f.webhook(event('email.sent', 'em_first'), { id: 'msg_late_sent' });
  let mailRow = (await (await c.request(`/api/orders/${order.id}/emails`)).json()).emails[0]; assert.equal(mailRow.status, 'delivered', 'late sent event does not downgrade'); assert.ok(mailRow.deliveredAt);
  // Event arrives before the send result is stored: kept, then applied when the provider id is recorded.
  await f.webhook(event('email.delivered', 'em_early'), { id: 'msg_early' });
  await admin.request(`/api/admin/orders/${order.id}/reject`, { note: 'x' }); // not reported yet → 409, no email
  await c.request(`/api/orders/${order.id}/payment`, { confirmed: true, reference: 'ZELLE-1' });
  await admin.request(`/api/admin/orders/${order.id}/approve`, { confirmed: true, amountCents: order.totalCents, reference: 'BANK-REF-1' });
  await f.commerce.flushMail();
  mailRow = (await (await c.request(`/api/orders/${order.id}/emails`)).json()).emails.find(m => m.kind === 'approved'); assert.equal(mailRow.status, 'delivered');
  const customerView = (await (await c.request(`/api/orders/${order.id}`)).json()).order; assert.equal(customerView.payment.verifiedBy, undefined); assert.equal(customerView.payment.bankReference, undefined);
  const adminView = (await (await admin.request(`/api/admin/orders/${order.id}`)).json()).order; assert.equal(adminView.payment.verifiedBy, '+13125550101'); assert.equal(adminView.payment.bankReference, 'BANK-REF-1');
  // Permanent bounce suppresses later messages to that address.
  await admin.request(`/api/admin/orders/${order.id}/ship`, { carrier: 'UPS', tracking: '1Z-TEST', reference: 'F-1' }); await f.commerce.flushMail();
  await f.webhook(event('email.bounced', 'em_bounce', { bounce: { type: 'Permanent' } }), { id: 'msg_bounce' });
  const all = (await (await admin.request('/api/admin/emails')).json()).emails; assert.equal(all.find(m => m.providerId === 'em_bounce').status, 'bounced');
  const before = mail.calls.length;
  await c.request('/api/orders', orderBody('+13125550102', 'live-order-after-bounce')); await f.commerce.flushMail();
  assert.equal(mail.calls.length, before, 'suppressed recipient not contacted');
  assert.equal((await f.webhook(event('email.delivered', 'em_unknown'), { id: 'msg_unknown' })).status, 200, 'unknown message ids are accepted and stored');
});

test('sessions persist across restart; logout and sign-out-everywhere revoke; admin-mediated phone change', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'pp-live-session-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const filename = path.join(dir, 'live.sqlite'); const provider = createTestVerifyProvider();
  const f = await fixture({ filename, provider }); const a = f.client(); await a.signIn('+13125550102');
  const { order } = await (await a.request('/api/orders', orderBody('+13125550102'))).json(); await f.close(); f.commerce.close();
  const g = await fixture({ filename, provider }); t.after(g.close);
  const restored = g.client(); for (const [k, v] of a.cookies) restored.cookies.set(k, v);
  assert.equal((await restored.request('/api/orders/' + order.id)).status, 200, 'session survives restart');
  const second = g.client(); provider.resendCooldownMs = 0; await second.signIn('+13125550102');
  assert.equal((await second.request('/api/customer/auth/logout-all', {})).status, 200);
  assert.equal((await restored.request('/api/orders')).status, 401, 'sign out everywhere revokes other sessions');
  const c = g.client(); await c.signIn('+13125550102'); const admin = g.client(); await admin.signIn('+13125550101', 'admin');
  assert.equal((await admin.request('/api/admin/customers/phone', { orderId: order.id, newPhone: '+13125550104', note: 'Verified order number and shipping address by email.' })).status, 400, 'explicit identity confirmation required');
  assert.equal((await admin.request('/api/admin/customers/phone', { orderId: order.id, newPhone: '+13125550104', note: 'Verified order number and shipping address by email.', confirmed: true })).status, 200);
  assert.equal((await c.request('/api/orders')).status, 401, 'phone change revokes sessions');
  const moved = g.client(); await moved.signIn('+13125550104'); assert.equal((await moved.request('/api/orders/' + order.id)).status, 200);
  const old = g.client(); await old.signIn('+13125550102'); assert.equal((await (await old.request('/api/orders')).json()).orders.length, 0);
  assert.equal((await c.request('/api/admin/customers/phone', { orderId: order.id, newPhone: '+13125550105', note: 'x', confirmed: true })).status, 401);
});

test('pagination covers every order once with status filters and counts', async t => {
  let clock = Date.now(); const f = await fixture({ now: () => clock }); t.after(f.close);
  const admin = f.client(); await admin.signIn('+13125550101', 'admin'); const ids = [];
  for (const phone of ['+13125550102', '+13125550103']) {
    const c = f.client(); await c.signIn(phone); clock += 31_000;
    for (let i = 0; i < 13; i++) { clock += 1; const { order } = await (await c.request('/api/orders', orderBody(phone, `page-order-${phone.slice(-4)}-${String(i).padStart(4, '0')}`))).json(); ids.push(order.id); if (i % 3 === 0) await c.request(`/api/orders/${order.id}/payment`, { confirmed: true }); }
  }
  const seen = []; let cursor = null;
  do { const page = await (await admin.request(`/api/admin/orders?limit=10${cursor ? '&cursor=' + cursor : ''}`)).json(); assert.ok(page.orders.length <= 10); seen.push(...page.orders.map(o => o.id)); cursor = page.nextCursor; } while (cursor);
  assert.equal(seen.length, 26); assert.equal(new Set(seen).size, 26); assert.deepEqual(new Set(seen), new Set(ids));
  const reported = await (await admin.request('/api/admin/orders?status=payment_reported&limit=50')).json();
  assert.equal(reported.orders.length, 10); assert.ok(reported.orders.every(o => o.status === 'payment_reported')); assert.equal(reported.counts.payment_reported, 10); assert.equal(reported.counts.awaiting_payment, 16);
  assert.equal((await admin.request('/api/admin/orders?status=bogus')).status, 400);
  assert.equal((await admin.request('/api/admin/orders?cursor=not-valid')).status, 400);
});

test('staging keeps the password gate in front of live commerce; production host allowlist rejects other hosts', async t => {
  const f = await fixture({ gate: 'password' }); t.after(f.close); const c = f.client();
  assert.equal((await c.request('/api/shop')).status, 401);
  assert.equal((await fetch(f.base + '/', { redirect: 'manual' })).status, 303);
  assert.equal((await fetch(f.base + '/healthz')).status, 200);
  const signed = await fetch(f.base + '/api/webhooks/resend', { method: 'POST', body: '{}' }); assert.equal(signed.status, 401, 'webhook reachable through the gate but requires a signature');
  const p = await fixture(); t.after(p.close);
  const server = createPreviewServer({ commerce: null, accessGate: 'public', publicOrigin: origin, secureCookies: true, allowedHosts: ['shop.example.test'] });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); t.after(() => new Promise(r => { server.close(r); server.closeAllConnections(); }));
  const status = host => new Promise((resolve, reject) => http.get({ host: '127.0.0.1', port: server.address().port, path: '/privacy/', headers: { Host: host } }, res => { res.resume(); resolve(res.statusCode); }).on('error', reject));
  assert.equal(await status('evil.example'), 421); assert.equal(await status('shop.example.test'), 200);
});

test('configuration fails closed and names missing settings without echoing secrets', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'pp-config-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, 'config')); await mkdir(path.join(dir, 'site'));
  const empty = loadConfig({ root: dir, env: { COMMERCE_MODE: 'live' }, products });
  for (const name of ['DEPLOY_ENV', 'PUBLIC_ORIGIN', 'DATA_DIR', 'TWILIO_ACCOUNT_SID', 'TWILIO_VERIFY_SERVICE_SID', 'ADMIN_PHONES', 'RESEND_API_KEY', 'RESEND_WEBHOOK_SECRET', 'MAIL_FROM', 'TEST_PHONE_ALLOWLIST', 'BUSINESS_CONFIG', 'CATALOG_CONFIG', 'PREVIEW_PASSWORD']) assert.ok(empty.problems.some(p => p.includes(name)), name);
  await writeFile(path.join(dir, 'config/business.json'), JSON.stringify(business)); await writeFile(path.join(dir, 'config/catalog.json'), JSON.stringify(catalog));
  const env = { COMMERCE_MODE: 'live', DEPLOY_ENV: 'staging', PUBLIC_ORIGIN: origin, HOST: '0.0.0.0', DATA_DIR: path.join(dir, 'data'), PREVIEW_PASSWORD: 'secret-value-123', TWILIO_ACCOUNT_SID: 'AC' + 'a'.repeat(32), TWILIO_API_KEY_SID: 'SK' + 'b'.repeat(32), TWILIO_API_KEY_SECRET: 'super-secret-value', TWILIO_VERIFY_SERVICE_SID: 'VA' + 'c'.repeat(32), ADMIN_PHONES: '+13125550101', RESEND_API_KEY: 're_testkey', RESEND_WEBHOOK_SECRET: webhookSecret, MAIL_FROM: 'Orders <orders@example.test>', TEST_PHONE_ALLOWLIST: '+13125550101', TEST_EMAIL_ALLOWLIST: 'lab@example.test' };
  const good = loadConfig({ root: dir, env, products }); assert.deepEqual(good.problems, []);
  assert.ok(!JSON.stringify(loadConfig({ root: dir, env: { ...env, TWILIO_API_KEY_SID: '' }, products }).problems).includes('super-secret-value'));
  assert.ok(loadConfig({ root: dir, env: { ...env, ACCESS_GATE: 'public' }, products }).problems.some(p => p.includes('ACCESS_GATE=public')));
  assert.ok(loadConfig({ root: dir, env: { ...env, DEPLOY_ENV: 'production', DELIVERY_MODE: 'open' }, products }).problems.some(p => p.includes('LAUNCH_APPROVED')));
  assert.deepEqual(loadConfig({ root: dir, env: { ...env, DEPLOY_ENV: 'production', DELIVERY_MODE: 'open', LAUNCH_APPROVED: 'yes', ACCESS_GATE: 'public' }, products }).problems, []);
  assert.ok(loadConfig({ root: dir, env: { ...env, ADMIN_PHONES: '+13125550109' }, products }).problems.some(p => p.includes('TEST_PHONE_ALLOWLIST')));
  await writeFile(path.join(dir, 'config/catalog.json'), JSON.stringify({ ...catalog, approved: {} , products: { unknown: { priceCents: 0 } } }));
  assert.ok(loadConfig({ root: dir, env, products }).problems.filter(p => p.startsWith('catalog config')).length >= 3);
  await writeFile(path.join(dir, 'config/business.json'), JSON.stringify({ ...business, zelle: { ...business.zelle, verified: false }, policiesApproved: false }));
  assert.ok(loadConfig({ root: dir, env, products }).problems.some(p => p.includes('zelle.verified')));
  assert.ok(loadConfig({ root: dir, env: { COMMERCE_MODE: 'demo', PUBLIC_ORIGIN: origin, PREVIEW_PASSWORD: 'x' }, products }).problems.some(p => p.includes('loopback')));
});

test('provider adapters speak the documented HTTP contracts (fake fetch, no network)', async () => {
  const requests = []; let reply = { status: 201, body: { status: 'pending', to: '+13125550102' } };
  const fetch = async (url, init) => { requests.push({ url, init }); if (reply === 'timeout') { const e = new Error('t'); e.name = 'TimeoutError'; throw e; } return new Response(JSON.stringify(reply.body), { status: reply.status }); };
  const twilio = createTwilioVerifyProvider({ accountSid: 'AC' + '1'.repeat(32), apiKeySid: 'SK' + '2'.repeat(32), apiKeySecret: 'secret', serviceSid: 'VA' + '3'.repeat(32), fetch });
  await twilio.start({ phone: '+13125550102' });
  assert.equal(requests[0].url, `https://verify.twilio.com/v2/Services/VA${'3'.repeat(32)}/Verifications`);
  assert.equal(requests[0].init.body.toString(), 'To=%2B13125550102&Channel=sms');
  assert.equal(requests[0].init.headers.Authorization, 'Basic ' + Buffer.from(`SK${'2'.repeat(32)}:secret`).toString('base64'));
  reply = { status: 200, body: { status: 'approved', to: '+13125550102' } }; assert.equal((await twilio.check({ phone: '+13125550102', code: '123456' })).approved, true);
  assert.match(requests[1].url, /VerificationCheck$/); assert.equal(requests[1].init.body.toString(), 'To=%2B13125550102&Code=123456');
  reply = { status: 200, body: { status: 'pending', to: '+13125550102' } }; assert.equal((await twilio.check({ phone: '+13125550102', code: '123456' })).approved, false);
  reply = { status: 404, body: { code: 20404 } }; await assert.rejects(twilio.check({ phone: '+13125550102', code: '123456' }), e => e.terminal && e.status === 401);
  reply = { status: 429, body: { code: 60203 } }; await assert.rejects(twilio.start({ phone: '+13125550102' }), e => e.status === 429);
  reply = 'timeout'; await assert.rejects(twilio.start({ phone: '+13125550102' }), e => e.code === 'timeout');
  assert.throws(() => createTwilioVerifyProvider({ accountSid: 'bad', apiKeySid: '', apiKeySecret: '', serviceSid: '' }));

  const sent = []; let mailReply = { status: 200, body: { id: 'em_123' } };
  const mailFetch = async (url, init) => { sent.push({ url, init }); return new Response(JSON.stringify(mailReply.body), { status: mailReply.status }); };
  const resend = createResendTransport({ apiKey: 're_test', from: 'Orders <orders@example.test>', replyTo: 'support@example.test', fetch: mailFetch });
  const message = { recipient: 'lab@example.test', subject: 'S', text: 'T', html: '<p>T</p>', kind: 'created', idempotencyKey: 'principium-test:PP-1:created' };
  assert.deepEqual(await resend(message), { channel: 'resend', providerId: 'em_123' });
  assert.equal(sent[0].url, 'https://api.resend.com/emails'); assert.equal(sent[0].init.headers['Idempotency-Key'], message.idempotencyKey); assert.equal(sent[0].init.headers.Authorization, 'Bearer re_test');
  const payload = JSON.parse(sent[0].init.body); assert.deepEqual(payload.to, ['lab@example.test']); assert.equal(payload.reply_to, 'support@example.test');
  mailReply = { status: 409, body: { name: 'concurrent_idempotent_requests' } }; await assert.rejects(resend(message), e => e.retryable === true);
  mailReply = { status: 409, body: { name: 'invalid_idempotent_request' } }; await assert.rejects(resend(message), e => e.code === 'idempotency_conflict');
  mailReply = { status: 422, body: { name: 'validation_error' } }; await assert.rejects(resend(message), e => e.retryable === false);
  mailReply = { status: 503, body: {} }; await assert.rejects(resend(message), e => e.retryable === true);
  const body = '{"type":"email.delivered"}', ts = String(Math.floor(Date.now() / 1000));
  const headers = { 'svix-id': 'msg_1', 'svix-timestamp': ts, 'svix-signature': 'v1,bogus ' + signSvix({ secret: webhookSecret, id: 'msg_1', timestamp: ts, body }) };
  assert.equal(verifySvixSignature({ secret: webhookSecret, headers, body: Buffer.from(body) }), true);
  assert.equal(verifySvixSignature({ secret: webhookSecret, headers, body: Buffer.from(body + ' ') }), false);
});

test('migrations adopt a handoff-era database, refuse newer schemas, and backups verify', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'pp-migrate-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const legacy = path.join(dir, 'demo-orders.sqlite'); const old = new DatabaseSync(legacy);
  old.exec(`CREATE TABLE orders (id TEXT PRIMARY KEY, owner TEXT NOT NULL, idem TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL, status TEXT NOT NULL, items TEXT NOT NULL, customer TEXT NOT NULL, total INTEGER NOT NULL, payment TEXT, shipping TEXT, events TEXT NOT NULL, UNIQUE(owner, idem));
    CREATE TABLE proofs (order_id TEXT PRIMARY KEY REFERENCES orders(id), name TEXT NOT NULL, type TEXT NOT NULL, bytes BLOB NOT NULL);
    ALTER TABLE orders ADD COLUMN policy TEXT; ALTER TABLE orders ADD COLUMN instructions TEXT;
    CREATE TABLE customers (id TEXT PRIMARY KEY, phone TEXT NOT NULL UNIQUE, created INTEGER NOT NULL);
    CREATE TABLE email_outbox (id TEXT PRIMARY KEY, event_key TEXT NOT NULL UNIQUE, order_id TEXT NOT NULL REFERENCES orders(id), kind TEXT NOT NULL, recipient TEXT NOT NULL, subject TEXT NOT NULL, text TEXT NOT NULL, html TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, available INTEGER NOT NULL, processed INTEGER, error TEXT);`);
  old.prepare("INSERT INTO orders (id,owner,idem,created,updated,status,items,customer,total,events) VALUES ('PP-AAAAAAAAAAAA','browser-x','k',1,1,'shipped','[]','{\"name\":\"Legacy\"}',100,'[]')").run();
  old.prepare("INSERT INTO email_outbox (id,event_key,order_id,kind,recipient,subject,text,html,status,created,available) VALUES ('EM-1','k1','PP-AAAAAAAAAAAA','created','a@b.test','s','t','h','preview',1,1)").run(); old.close();
  const db = openDatabase(legacy);
  assert.deepEqual(db.prepare('SELECT id FROM schema_migrations ORDER BY id').all().map(r => r.id), [1, 2, 3, 4, 5]);
  const row = db.prepare("SELECT * FROM orders WHERE id='PP-AAAAAAAAAAAA'").get(); assert.equal(row.shipping_fee, 0); assert.equal(row.total, 100);
  assert.equal(db.prepare("SELECT status, idem_round FROM email_outbox WHERE id='EM-1'").get().status, 'preview');
  const info = await backupDatabase(legacy, path.join(dir, 'backups', 'copy.sqlite')); assert.equal(info.orders, 1); assert.equal(info.schema, 5);
  db.prepare("INSERT INTO schema_migrations(id,name,checksum,applied) VALUES (99,'future','x',1)").run(); db.close();
  assert.throws(() => openDatabase(legacy), /newer than this application/);
});

test('live email sign-in sends the code through the email provider, never to the browser, and only to allowed addresses', async t => {
  const mail = fakeResend(); const f = await fixture({ mail }); t.after(f.close); const c = f.client();
  assert.equal((await c.request('/api/customer/auth/start', { email: 'stranger@example.test' })).status, 403);
  const started = await c.request('/api/customer/auth/start', { email: 'lab@example.test' }); assert.equal(started.status, 200);
  const body = await started.json(); assert.equal(body.demoCode, undefined); assert.equal(body.channel, 'email');
  const sent = mail.calls.at(-1); assert.equal(sent.to, 'lab@example.test'); const code = sent.text.match(/\b(\d{6})\b/)[1]; assert.match(sent.subject, new RegExp(code));
  assert.equal((await c.request('/api/customer/auth/start', { email: 'lab@example.test' })).status, 429, 'resend cooldown');
  const verified = await c.request('/api/customer/auth/verify', { challenge: body.challenge, code }); assert.equal(verified.status, 200);
  const account = (await verified.json()).customer; assert.equal(account.email, 'lab@example.test'); assert.equal(account.profileComplete, false);
  assert.equal((await c.request('/api/orders', orderBody('+13125550102'))).status, 403);
  mail.set('reject'); const d = f.client();
  assert.equal((await d.request('/api/customer/auth/start', { email: 'other@example.test' })).status, 503, 'provider failure is reported, not hidden');
});
