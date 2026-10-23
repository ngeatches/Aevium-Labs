import { randomBytes } from 'node:crypto';
import { createAuth, createLimiter, demoAdminPhone, demoCustomerPhone } from './auth.mjs';
import { createOutbox } from './mail.mjs';
import { openDatabase } from './db.mjs';
import { createDemoVerifyProvider } from './verify-providers.mjs';
import { normalizePhone } from './phone.mjs';
import { verifySvixSignature } from './email-providers.mjs';
import { policyVersion as demoPolicyVersion, acknowledgments, paymentInstructions as demoPaymentInstructions } from './policy.mjs';

const httpError = (status, message) => Object.assign(new Error(message), { status });
const clean = (value, label, max = 180, required = true) => {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f]/.test(value)) throw httpError(400, `Check ${label}.`);
  const result = value.trim();
  if (required && !result) throw httpError(400, `${label} is required.`);
  return result;
};
const encodeCursor = row => Buffer.from(`${row.created}:${row.id}`).toString('base64url');
function decodeCursor(value) {
  if (!value) return null;
  const match = /^(\d{1,15}):(\d{4,6}|(?:AV|PP|EM)-[A-Za-z0-9]{12,24})$/.exec(Buffer.from(String(value), 'base64url').toString());
  if (!match) throw httpError(400, 'Invalid page cursor.');
  return { created: Number(match[1]), id: match[2] };
}
const pageLimit = (value, fallback, max) => { const n = Number(value || fallback); if (!Number.isInteger(n) || n < 1) throw httpError(400, 'Invalid page size.'); return Math.min(n, max); };
const loopbackAddresses = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
const orderStatuses = ['awaiting_payment', 'payment_reported', 'approved', 'shipped'];
// Sign-up profile asked once, after the phone or email is verified and before the first order.
export const customerRoles = ['Academic researcher', 'Lab / institutional researcher', 'Clinical professional', 'Graduate / PhD student'];
export const minimumAge = 21;
function ageOn(birthDate, today) {
  const [y, m, d] = birthDate.split('-').map(Number);
  let age = today.getUTCFullYear() - y;
  if (today.getUTCMonth() + 1 < m || (today.getUTCMonth() + 1 === m && today.getUTCDate() < d)) age--;
  return age;
}
function readBirthDate(value, now) {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw httpError(400, 'Enter your date of birth.');
  const [y, m, d] = match.slice(1).map(Number), date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d || y < 1900 || date.getTime() > now) throw httpError(400, 'Check your date of birth.');
  if (ageOn(value, new Date(now)) < minimumAge) throw httpError(403, `You must be ${minimumAge} or older to create an account.`);
  return value;
}

/**
 * Order service. mode=demo keeps the loopback-only simulation (on-screen codes, captured emails,
 * draft prices). mode=live uses verified configuration and injected providers; the server's
 * startup configuration must already have passed loadConfig/assertConfig.
 */
export function createCommerce({
  products, filename = ':memory:', now = () => Date.now(), mailTransport, mailIntervalMs = 1000,
  mode = 'demo', verifyProvider, adminPhones, allowSmsTo, allowEmail, smsDailyLimit,
  business = null, catalog: liveCatalog = null, publicOrigin = null, secureCookies = false,
  webhookSecret = null, keyPrefix = 'local', onError = () => {}
}) {
  const live = mode === 'live';
  if (live && (!business || !liveCatalog || !publicOrigin || !verifyProvider || !mailTransport || !webhookSecret || !adminPhones?.length)) throw new Error('Live commerce requires verified business/catalog configuration, providers, admin phones and a public origin.');
  const db = openDatabase(filename, { now });
  const policyVersion = live ? business.policyVersion : demoPolicyVersion;
  const paymentInstructions = live
    ? { method: 'Zelle', mode: 'live', recipientName: business.zelle.recipientName, recipientHandle: business.zelle.recipientHandle, verified: true, notice: 'Send the exact total by Zelle and include your order number in the memo. We confirm receipt in our bank account before preparing your order.' }
    : demoPaymentInstructions;
  const shippingFee = live ? business.shipping.flatFeeCents : 0;
  const countries = live ? business.shipping.countries.map(c => c.trim()) : null;
  const outbox = createOutbox(db, now, mailTransport, mailIntervalMs, { mode, allowEmail, keyPrefix, onError, context: live ? { mode: 'live', business, origin: publicOrigin } : { mode: 'demo' } });
  // Demo prices come from the unverified source reference; live prices only from approved catalog config.
  const catalog = products.map(p => {
    const configured = live ? liveCatalog.products[p.id] : null;
    return { id: p.id, name: p.name, amount: p.mg, priceCents: live ? configured?.priceCents ?? null : Math.round(p.price * 100), available: live ? configured?.available === true : true };
  });
  const limit = createLimiter(db, now);
  // Live email sign-in codes go straight to the email provider (not the order outbox); one attempt, no retry.
  const sendEmailCode = live ? async ({ email, code, minutes }) => {
    const name = business.businessName;
    const text = `Your ${name} sign-in code is ${code}.\n\nIt expires in ${minutes} minutes. If you didn't request it, you can ignore this email.`;
    const html = `<p>Your ${name} sign-in code is</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>It expires in ${minutes} minutes. If you didn't request it, you can ignore this email.</p>`;
    const result = await mailTransport({ kind: 'sign_in_code', recipient: email, subject: `${code} is your ${name} sign-in code`, text, html, idempotencyKey: `${keyPrefix}:signin:${randomBytes(12).toString('hex')}` });
    if (!result?.providerId) throw new Error('Email provider returned no message id.');
  } : null;
  const auth = createAuth({ db, now, limit, mode, provider: verifyProvider || createDemoVerifyProvider(), adminPhones: live ? adminPhones : [demoAdminPhone], allowSmsTo, allowEmail: allowEmail || (() => true), sendEmailCode, smsDailyLimit, secureCookies });

  function customerProfile(session) {
    if (!session) return null;
    const account = db.prepare('SELECT phone, email, first_name, last_name, birth_date, role, profile_completed FROM customers WHERE id=?').get(session.id) || {};
    const latest = db.prepare('SELECT customer FROM orders WHERE owner=? ORDER BY created DESC, rowid DESC LIMIT 1').get(session.id);
    const fullName = [account.first_name, account.last_name].filter(Boolean).join(' ');
    return { id: session.id, phone: account.phone ?? session.phone ?? null, email: account.email ?? session.email ?? null,
      firstName: account.first_name || null, lastName: account.last_name || null, birthDate: account.birth_date || null, role: account.role || null,
      profileComplete: !!account.profile_completed, name: fullName || (latest ? JSON.parse(latest.customer).name : null) };
  }
  // Customer list for the order desk: everyone who has placed at least one order, built from the
  // accounts and orders tables so a new order shows up immediately.
  function customerList() {
    const paid = new Set(['approved', 'shipped']);
    const rows = db.prepare('SELECT id, owner, created, status, customer, total FROM orders ORDER BY created ASC, id ASC').all();
    const byOwner = new Map();
    for (const row of rows) { if (!byOwner.has(row.owner)) byOwner.set(row.owner, []); byOwner.get(row.owner).push(row); }
    const account = db.prepare('SELECT id, phone, email, created, first_name, last_name, birth_date, role FROM customers WHERE id=?');
    const list = [];
    for (const [owner, placed] of byOwner) {
      const a = account.get(owner) || {};
      const latest = JSON.parse(placed.at(-1).customer || '{}');
      const [orderFirst, ...orderRest] = String(latest.name || '').trim().split(/\s+/);
      list.push({
        id: owner, firstName: a.first_name || orderFirst || null, lastName: a.last_name || (a.first_name ? null : orderRest.join(' ') || null),
        email: a.email || latest.email || null, phone: a.phone || latest.phone || null, role: a.role || latest.accountRole || null, birthDate: a.birth_date || null,
        signedUp: a.created || placed[0].created, orderCount: placed.length,
        orders: placed.map(o => ({ id: o.id, created: o.created, status: o.status, totalCents: o.total })).reverse(),
        totalOrderedCents: placed.reduce((n, o) => n + o.total, 0), totalPaidCents: placed.filter(o => paid.has(o.status)).reduce((n, o) => n + o.total, 0),
        firstOrder: placed[0].created, lastOrder: placed.at(-1).created,
        shipTo: [latest.city, latest.region, latest.country].filter(Boolean).join(', ') || null
      });
    }
    return list.sort((x, y) => y.lastOrder - x.lastOrder);
  }
  function transaction(work) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = work(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function output(row) {
    return { id: row.id, created: row.created, updated: row.updated, status: row.status,
      items: JSON.parse(row.items), customer: JSON.parse(row.customer), totalCents: row.total, shippingCents: row.shipping_fee || 0,
      payment: row.payment ? JSON.parse(row.payment) : null, shipping: row.shipping ? JSON.parse(row.shipping) : null,
      policy: row.policy ? JSON.parse(row.policy) : null, instructions: row.instructions ? JSON.parse(row.instructions) : demoPaymentInstructions,
      emails: db.prepare('SELECT id,kind,status,created,processed,delivered_at AS deliveredAt FROM email_outbox WHERE order_id=? ORDER BY created').all(row.id),
      events: JSON.parse(row.events), hasProof: !!db.prepare('SELECT 1 FROM proofs WHERE order_id=?').get(row.id), demo: !live };
  }
  const reload = id => output(db.prepare('SELECT * FROM orders WHERE id=?').get(id));
  // Customers never see who verified a payment (an admin's phone) or the internal bank reference.
  function forCustomer(order) {
    if (!order.payment) return order;
    const { verifiedBy, bankReference, ...payment } = order.payment;
    return { ...order, payment };
  }
  function rowFor(id, owner, isAdmin) {
    const row = db.prepare('SELECT * FROM orders WHERE id=?').get(id);
    if (!row || (!isAdmin && row.owner !== owner)) throw httpError(404, 'Order not found.');
    return row;
  }
  function transition(row, status, description, updates = {}) {
    const events = [...JSON.parse(row.events), { at: now(), status, description }];
    db.prepare('UPDATE orders SET status=?, updated=?, payment=?, shipping=?, events=? WHERE id=?').run(status, now(), updates.payment ? JSON.stringify(updates.payment) : row.payment, updates.shipping ? JSON.stringify(updates.shipping) : row.shipping, JSON.stringify(events), row.id);
    return reload(row.id);
  }
  function listOrders({ owner = null, status = null, cursor = null, limit: size }) {
    const where = [], params = [];
    if (owner) { where.push('owner=?'); params.push(owner); }
    if (status) { where.push('status=?'); params.push(status); }
    if (cursor) { where.push('(created<? OR (created=? AND id<?))'); params.push(cursor.created, cursor.created, cursor.id); }
    const rows = db.prepare(`SELECT * FROM orders ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created DESC, id DESC LIMIT ?`).all(...params, size + 1);
    const more = rows.length > size; if (more) rows.pop();
    return { orders: rows.map(output), nextCursor: more ? encodeCursor(rows.at(-1)) : null };
  }
  async function readBody(req, max) {
    const parts = []; let size = 0;
    for await (const part of req) { size += part.length; if (size > max) throw httpError(413, 'File or request is too large.'); parts.push(part); }
    return Buffer.concat(parts);
  }
  async function readJson(req) {
    if ((req.headers['content-type'] || '').split(';')[0] !== 'application/json') throw httpError(415, 'Use JSON.');
    const raw = await readBody(req, 5_700_000);
    try { const body = JSON.parse(raw.toString()); if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error(); return body; } catch { throw httpError(400, 'Invalid request.'); }
  }
  function readProof(proof) {
    if (!proof) return null;
    const name = clean(proof.name, 'file name', 120).replace(/[^a-zA-Z0-9._ -]/g, '_');
    if (typeof proof.data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(proof.data)) throw httpError(400, 'Invalid proof file.');
    const bytes = Buffer.from(proof.data, 'base64');
    if (!bytes.length || bytes.length > 4_000_000) throw httpError(400, 'Proof must be at most 4 MB.');
    const type = bytes.subarray(0, 5).toString() === '%PDF-' ? 'application/pdf' : bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' : null;
    if (!type) throw httpError(400, 'Use a PDF, PNG or JPEG proof file.');
    return { name, bytes, type };
  }
  const json = (res, status, value) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(value)); };

  // Signed Resend delivery events. Public route: authenticity comes only from the Svix signature.
  async function handleWebhook(req, res) {
    try {
      if (!live) throw httpError(404, 'Not found.');
      if (req.method !== 'POST') throw httpError(405, 'Method not allowed.');
      const raw = await readBody(req, 256_000);
      if (!verifySvixSignature({ secret: webhookSecret, headers: req.headers, body: raw, now: now() })) throw httpError(401, 'Invalid signature.');
      let event;
      try { event = JSON.parse(raw.toString()); } catch { throw httpError(400, 'Invalid payload.'); }
      const occurred = Date.parse(event?.created_at || '') || now();
      const result = outbox.recordEvent('resend', { id: String(req.headers['svix-id']).slice(0, 100), type: String(event?.type || 'unknown').slice(0, 60), messageId: typeof event?.data?.email_id === 'string' ? event.data.email_id : null, occurred, bounceType: event?.data?.bounce?.type || null });
      json(res, 200, { received: true, duplicate: result.duplicate });
    } catch (error) { if (!error.status) onError(error); json(res, error.status || 500, { error: error.status ? error.message : 'Unable to process event.' }); }
  }

  async function handle(req, res, { pathname, sessionKey = null, clientIp = null, query = new URLSearchParams() }) {
    try {
      if (!live) {
        const remote = req.socket.remoteAddress;
        const host = new URL(`http://${req.headers.host}`).hostname;
        if (!loopbackAddresses.includes(remote) || !['localhost','127.0.0.1','[::1]'].includes(host) || req.headers['x-forwarded-host']) throw httpError(403, 'The order demo is available on localhost only.');
      }
      if (!['GET','POST'].includes(req.method)) throw httpError(405, 'Method not allowed.');
      const expectedOrigin = live ? publicOrigin : `http://${req.headers.host}`;
      if (req.method === 'POST' && req.headers.origin !== expectedOrigin) throw httpError(403, 'Request rejected.');
      const ctx = { previewKey: sessionKey, clientIp: clientIp || req.socket.remoteAddress };
      const customerSession = auth.get(req, ctx, 'customer');
      const owner = customerSession?.id;
      const admin = auth.get(req, ctx, 'admin');
      const isAdminRoute = pathname.startsWith('/api/admin/') && !pathname.startsWith('/api/admin/auth/');
      if (isAdminRoute && !admin) throw httpError(401, 'Administrator sign-in required.');
      const body = req.method === 'POST' ? await readJson(req) : {};
      if (pathname === '/api/shop' && req.method === 'GET') {
        const shop = { mode: live ? 'live' : 'demo', products: catalog, admin: !!admin, customer: customerProfile(customerSession), signup: { roles: customerRoles, minimumAge }, currency: 'USD', policyVersion, acknowledgments, paymentInstructions, shipping: { flatFeeCents: shippingFee, countries } };
        if (live) shop.business = { name: business.businessName, supportEmail: business.supportEmail, taxStatement: business.tax.statement };
        else Object.assign(shop, { demoPhone: demoAdminPhone, demoCustomerPhone });
        return json(res, 200, shop);
      }
      const authRoute = pathname.match(/^\/api\/(admin|customer)\/auth\/(start|verify|logout|logout-all)$/);
      if (authRoute) {
        const result = await auth.handle(req, res, authRoute[1], authRoute[2], body, ctx);
        if (result.customer) result.customer = customerProfile(result.customer);
        return json(res, 200, result);
      }
      if (pathname === '/api/customer/profile' && req.method === 'POST') {
        if (!customerSession) throw httpError(401, 'Sign in first.');
        limit(`profile:${customerSession.id}`, 20, 60 * 60_000);
        const firstName = clean(body.firstName, 'first name', 60);
        const lastName = clean(body.lastName ?? '', 'last name', 60, false);
        if (!/\p{L}/u.test(firstName)) throw httpError(400, 'Check first name.');
        const birthDate = readBirthDate(body.birthDate, now());
        if (!customerRoles.includes(body.role)) throw httpError(400, 'Choose the role that best describes you.');
        if (body.accepted !== true) throw httpError(400, `Confirm you are ${minimumAge} or older and agree to the terms.`);
        db.prepare('UPDATE customers SET first_name=?, last_name=?, birth_date=?, role=?, profile_completed=COALESCE(profile_completed, ?), terms_version=? WHERE id=?').run(firstName, lastName || null, birthDate, body.role, now(), policyVersion, customerSession.id);
        return json(res, 200, { customer: customerProfile(customerSession) });
      }
      if (pathname.startsWith('/api/orders') && !customerSession) throw httpError(401, 'Sign in with your phone number or email to view or place orders.');
      if ((pathname === '/api/admin/customers' || pathname === '/api/admin/customers.csv') && req.method === 'GET') {
        const list = customerList();
        if (pathname.endsWith('.csv')) {
          // Spreadsheet download. Cells that a spreadsheet could treat as a formula are prefixed with '.
          const cell = value => { let text = value == null ? '' : String(value); if (/^[=+\-@\t\r]/.test(text)) text = "'" + text; return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
          const columns = [['First name','firstName'],['Last name','lastName'],['Email','email'],['Phone','phone'],['Role','role'],['Date of birth','birthDate'],['Signed up','signedUp'],['Orders','orderCount'],['Order numbers','orderNumbers'],['Total ordered (USD)','totalOrdered'],['Paid (USD)','totalPaid'],['First order','firstOrder'],['Last order','lastOrder'],['Ship to','shipTo'],['Account ID','id']];
          const day = ms => ms ? new Date(ms).toISOString().slice(0, 10) : '';
          const rows = list.map(c => ({ ...c, signedUp: day(c.signedUp), firstOrder: day(c.firstOrder), lastOrder: day(c.lastOrder), orderNumbers: c.orders.map(o => o.id).join(' '), totalOrdered: (c.totalOrderedCents / 100).toFixed(2), totalPaid: (c.totalPaidCents / 100).toFixed(2) }));
          const csv = '﻿' + [columns.map(([label]) => cell(label)).join(','), ...rows.map(row => columns.map(([, key]) => cell(row[key])).join(','))].join('\r\n') + '\r\n';
          res.statusCode = 200; res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
          res.setHeader('Content-Disposition', `attachment; filename="aevium-customers-${new Date(now()).toISOString().slice(0, 10)}.csv"`);
          return res.end(csv);
        }
        res.setHeader('Cache-Control', 'no-store');
        return json(res, 200, { customers: list, mode: live ? 'live' : 'demo' });
      }
      if (pathname === '/api/admin/emails' && req.method === 'GET') {
        const cursor = decodeCursor(query.get('cursor')), size = pageLimit(query.get('limit'), 100, 200);
        const rows = db.prepare(`SELECT id,order_id,kind,recipient,subject,text,status,attempts,created,processed,error,provider,provider_id AS providerId,last_event AS lastEvent,last_event_at AS lastEventAt,delivered_at AS deliveredAt FROM email_outbox ${cursor ? 'WHERE (created<? OR (created=? AND id<?))' : ''} ORDER BY created DESC, id DESC LIMIT ?`).all(...(cursor ? [cursor.created, cursor.created, cursor.id] : []), size + 1);
        const more = rows.length > size; if (more) rows.pop();
        return json(res, 200, { emails: rows, nextCursor: more ? encodeCursor(rows.at(-1)) : null, mode: live ? 'live' : 'demo' });
      }
      const retry = pathname.match(/^\/api\/admin\/emails\/(EM-[a-f0-9]{24})\/retry$/);
      if (retry && req.method === 'POST') {
        const result = outbox.retry(retry[1]);
        if (result.error === 404) throw httpError(404, 'Email not found.');
        if (result.error === 409) throw httpError(409, live ? 'Only failed or needs-review emails can be retried.' : 'Only failed email previews need a retry.');
        return json(res, 200, { queued: true });
      }
      if (pathname === '/api/orders' && req.method === 'GET') { const page = listOrders({ owner, cursor: decodeCursor(query.get('cursor')), limit: pageLimit(query.get('limit'), 50, 100) }); return json(res, 200, { ...page, orders: page.orders.map(forCustomer) }); }
      if (pathname === '/api/admin/orders' && req.method === 'GET') {
        const status = query.get('status') && query.get('status') !== 'all' ? query.get('status') : null;
        if (status && !orderStatuses.includes(status)) throw httpError(400, 'Unknown status filter.');
        const counts = Object.fromEntries(db.prepare('SELECT status, COUNT(*) AS n FROM orders GROUP BY status').all().map(r => [r.status, r.n]));
        return json(res, 200, { ...listOrders({ status, cursor: decodeCursor(query.get('cursor')), limit: pageLimit(query.get('limit'), 50, 200) }), counts });
      }
      if (pathname === '/api/admin/customers/phone' && req.method === 'POST') {
        const orderId = clean(body.orderId, 'order number', 20);
        const order = db.prepare('SELECT owner FROM orders WHERE id=?').get(orderId);
        if (!order) throw httpError(404, 'Order not found.');
        if (!order.owner.startsWith('CU-')) throw httpError(409, 'This legacy order is not linked to a phone account.');
        if (body.confirmed !== true) throw httpError(400, 'Confirm that you verified the customer’s identity.');
        const result = auth.changeCustomerPhone({ customerId: order.owner, newPhone: body.newPhone, changedBy: admin.phone, note: clean(body.note, 'verification note', 500) });
        return json(res, 200, { changed: true, phone: result.phone });
      }
      if (pathname === '/api/orders' && req.method === 'POST') {
        const idem = clean(body.idempotencyKey, 'order key', 80);
        if (!/^[a-zA-Z0-9_-]{16,80}$/.test(idem)) throw httpError(400, 'Invalid order key.');
        const existing = db.prepare('SELECT * FROM orders WHERE owner=? AND idem=?').get(owner, idem);
        if (existing) return json(res, 200, { order: forCustomer(output(existing)) });
        const profile = customerProfile(customerSession);
        if (!profile.profileComplete) throw httpError(403, 'Finish your account details before placing an order.');
        limit(`orders:${owner}`, 20, 60 * 60_000);
        if (!Array.isArray(body.items) || !body.items.length || body.items.length > 60) throw httpError(400, 'Choose at least one material.');
        const seen = new Set();
        const items = body.items.map(item => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) throw httpError(400, 'Check the material quantities.');
          const product = catalog.find(p => p.id === item.id);
          if (!product || seen.has(item.id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) throw httpError(400, 'Check the material quantities.');
          if (!product.available) throw httpError(409, `${product.name} ${product.amount} is currently unavailable.`);
          seen.add(item.id); const { available, ...line } = product; return { ...line, quantity: item.quantity };
        });
        if (items.reduce((n, i) => n + i.quantity, 0) > 500) throw httpError(400, live ? 'Contact us for orders over 500 vials.' : 'Limit this demo order to 500 vials.');
        const c = body.customer || {};
        // Phone accounts keep their verified number; email accounts give a contact number for shipping.
        let phone = profile.phone;
        if (phone) { if (c.phone !== phone) throw httpError(400, 'Use the phone number from your signed-in account.'); }
        else {
          phone = live ? normalizePhone(c.phone) : (typeof c.phone === 'string' && /^\+?[\d\s().-]{10,20}$/.test(c.phone.trim()) ? c.phone.trim() : null);
          if (!phone) throw httpError(400, 'Enter a valid phone number for shipping updates.');
        }
        if (profile.email && typeof c.email === 'string' && c.email.trim().toLowerCase() !== profile.email) throw httpError(400, 'Use the email from your signed-in account.');
        if (body.policyVersion !== policyVersion || !body.acknowledgments || Object.keys(acknowledgments).some(key => body.acknowledgments[key] !== true)) throw httpError(400, 'Read and acknowledge the current research-use and data policies.');
        const policy = { version: policyVersion, acceptedAt: now(), customerId: owner, statements: acknowledgments };
        const customer = { phone, name: clean(c.name, 'name', 100), email: clean(c.email, 'email', 180), address: clean(c.address, 'street address'), city: clean(c.city, 'city', 90), region: clean(c.region, 'state or region', 80), postal: clean(c.postal, 'postal code', 20), country: clean(c.country, 'country', 80), zelleSender: clean(c.zelleSender, 'Zelle email or phone number', 120), accountRole: profile.role };
        if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(customer.email)) throw httpError(400, 'Check the email address.');
        if (countries) {
          const match = countries.find(country => country.toLowerCase() === customer.country.toLowerCase());
          if (!match) throw httpError(400, `We currently ship to: ${countries.join(', ')}.`);
          customer.country = match;
        }
        // Short, easy-to-type order numbers: 4 digits, growing to 5-6 only if the 4-digit space fills up.
        const taken = db.prepare('SELECT 1 FROM orders WHERE id=?');
        let id = null;
        for (let attempt = 0; attempt < 200 && !id; attempt++) {
          const digits = attempt < 80 ? 4 : attempt < 160 ? 5 : 6;
          const candidate = String(10 ** (digits - 1) + (randomBytes(4).readUInt32BE(0) % (9 * 10 ** (digits - 1))));
          if (!taken.get(candidate)) id = candidate;
        }
        if (!id) throw httpError(503, 'Could not assign an order number. Please try again.');
        const total = items.reduce((n, p) => n + p.priceCents * p.quantity, 0) + shippingFee;
        const events = [{ at: now(), status: 'awaiting_payment', description: live ? 'Order created.' : 'Demo order created.' }];
        const order = transaction(() => {
          db.prepare('INSERT INTO orders (id,owner,idem,created,updated,status,items,customer,total,shipping_fee,events,policy,instructions) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id, owner, idem, now(), now(), 'awaiting_payment', JSON.stringify(items), JSON.stringify(customer), total, shippingFee, JSON.stringify(events), JSON.stringify(policy), JSON.stringify(paymentInstructions));
          outbox.enqueue(reload(id), 'created');
          return reload(id);
        });
        return json(res, 201, { order: forCustomer(order) });
      }
      const match = pathname.match(/^\/api\/(admin\/)?orders\/(\d{4,6}|(?:AV|PP)-[A-F0-9]{12})(?:\/(payment|approve|reject|ship|proof|emails))?$/);
      if (match) {
        const [, adminPath, id, action] = match;
        const row = rowFor(id, owner, !!(adminPath && admin));
        if (!action && req.method === 'GET') return json(res, 200, { order: adminPath ? output(row) : forCustomer(output(row)) });
        if (action === 'emails' && req.method === 'GET') return json(res, 200, { emails: db.prepare('SELECT id,kind,subject,text,status,created,processed,delivered_at AS deliveredAt FROM email_outbox WHERE order_id=? ORDER BY created').all(id) });
        if (action === 'proof' && req.method === 'GET') {
          const proof = db.prepare('SELECT * FROM proofs WHERE order_id=?').get(id);
          if (!proof) throw httpError(404, 'No proof file has been added.');
          res.statusCode = 200; res.setHeader('Content-Type', proof.type); res.setHeader('Content-Disposition', `attachment; filename="${proof.name.replace(/"/g, '_')}"`); res.end(Buffer.from(proof.bytes)); return;
        }
        if (req.method !== 'POST') throw httpError(405, 'Method not allowed.');
        if (action === 'payment' && !adminPath) {
          if (body.confirmed !== true) throw httpError(400, 'Confirm the payment report.');
          if (row.status === 'payment_reported') return json(res, 200, { order: forCustomer(output(row)) });
          if (row.status !== 'awaiting_payment') throw httpError(409, 'This order is not awaiting a payment report.');
          const reference = clean(body.reference || '', 'payment reference', 120, false);
          return json(res, 200, { order: forCustomer(transition(row, 'payment_reported', live ? 'Customer reported a Zelle payment; awaiting bank verification.' : 'Customer reported a simulated Zelle payment; admin review required.', { payment: { reportedAt: now(), reference } })) });
        }
        if (!adminPath || !admin) throw httpError(403, 'Administrator access required.');
        if (action === 'approve') {
          if (row.status !== 'payment_reported' || body.confirmed !== true) throw httpError(409, 'Review the reported payment before approving.');
          const reference = clean(body.reference, 'bank verification reference', 120);
          if (!Number.isSafeInteger(body.amountCents) || body.amountCents !== row.total) throw httpError(400, 'The verified amount must match the order total.');
          const order = transaction(() => {
            const next = transition(row, 'approved', 'Administrator recorded matching payment receipt and approved fulfillment.', { payment: { ...JSON.parse(row.payment), verifiedAt: now(), verifiedBy: admin.phone, verifiedAmountCents: body.amountCents, bankReference: reference } });
            outbox.enqueue(next, 'approved'); return reload(id);
          });
          return json(res, 200, { order });
        }
        if (action === 'reject') {
          if (row.status !== 'payment_reported') throw httpError(409, 'Only a reported payment can be returned for correction.');
          const note = clean(body.note, 'reason', 500);
          const order = transaction(() => {
            const next = transition(row, 'awaiting_payment', `Payment report returned: ${note}`, { payment: { returnedAt: now(), note } });
            outbox.enqueue(next, 'returned', `${id}:returned:${next.events.length}`); return reload(id);
          });
          return json(res, 200, { order });
        }
        if (action === 'ship') {
          if (row.status !== 'approved') throw httpError(409, 'Approve the order before adding shipment details.');
          const shipping = { carrier: clean(body.carrier, 'carrier', 60), tracking: clean(body.tracking, 'tracking number', 120), reference: clean(body.reference, 'fulfillment reference', 120), note: clean(body.note || '', 'shipping note', 1000, false), shippedAt: now() };
          const proof = readProof(body.proof);
          const order = transaction(() => {
            if (proof) db.prepare('INSERT INTO proofs(order_id,name,type,bytes) VALUES (?,?,?,?)').run(id, proof.name, proof.type, proof.bytes);
            const next = transition(row, 'shipped', live ? 'Administrator recorded the shipment.' : 'Administrator added shipment details and an order confirmation.', { shipping });
            outbox.enqueue(next, 'shipped'); return reload(id);
          });
          return json(res, 200, { order });
        }
      }
      throw httpError(404, 'Not found.');
    } catch (error) {
      if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
      if (!error.status) onError(error);
      json(res, error.status || 500, { error: error.status ? error.message : 'Unable to complete this request. Please try again.' });
    }
  }
  return { handle, handleWebhook, flushMail: outbox.flush, db, healthy: () => db.prepare('SELECT 1 AS ok').get().ok === 1, close: () => { outbox.close(); if (db.isOpen) db.close(); } };
}
