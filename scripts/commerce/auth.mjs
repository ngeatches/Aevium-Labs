import { randomBytes, randomInt, createHash, timingSafeEqual } from 'node:crypto';
import { normalizePhone } from './phone.mjs';
import { ProviderError } from './verify-providers.mjs';

export const demoAdminPhone = '+12025550199';
export const demoCustomerPhone = '+12025550198';
const hash = value => createHash('sha256').update(String(value)).digest('hex');
const random = () => randomBytes(32).toString('base64url');
const fail = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });
const sameHash = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const isEmailIdentity = value => typeof value === 'string' && value.includes('@');
export function normalizeEmail(raw) {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/.test(email) ? email : null;
}
export const readCookie = (req, key) => req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith(key + '='))?.slice(key.length + 1);

// Fixed-window counters persisted in SQLite so throttles survive restarts on the single production instance.
export function createLimiter(db, now) {
  const read = db.prepare('SELECT count, expires FROM rate_limits WHERE key=?');
  const write = db.prepare('INSERT INTO rate_limits(key,count,expires) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count, expires=excluded.expires');
  function hit(key, max, period, message = 'Too many attempts. Please try again later.') {
    const row = read.get(key);
    const live = row && row.expires > now();
    const count = (live ? row.count : 0) + 1, expires = live ? row.expires : now() + period;
    write.run(key, count, expires);
    if (count > max) throw fail(429, message, { retryAfter: Math.max(1, Math.ceil((expires - now()) / 1000)) });
  }
  hit.peek = key => { const row = read.get(key); return row && row.expires > now() ? row.count : 0; };
  hit.cleanup = () => db.prepare('DELETE FROM rate_limits WHERE expires<=?').run(now());
  return hit;
}

/**
 * Phone authentication with separate customer/admin roles.
 * - provider: demo (code displayed), test (automated tests) or Twilio Verify (live).
 * - adminPhones: the only identities that can ever receive an admin session.
 * - Challenges and sessions are stored hashed in SQLite (survive restart, revocable).
 * - Challenges bind to an HttpOnly per-browser flow cookie and, when the password gate is on,
 *   to the preview session. Customer/admin sessions bind to the preview session when gated.
 */
export function createAuth({ db, now, limit, provider, mode = 'demo', adminPhones = [demoAdminPhone], allowSmsTo = () => true, allowEmail = () => true, sendEmailCode = null, emailDailyLimit = 500, smsDailyLimit = 500, secureCookies = false, customerSessionHours = 8, adminSessionMinutes = 60 }) {
  const live = mode === 'live';
  let lastCleanup = 0;
  function cookieHeader(res, name, value, seconds, sameSite = 'Strict') {
    const existing = res.getHeader('Set-Cookie') || [];
    res.setHeader('Set-Cookie', [...(Array.isArray(existing) ? existing : [existing]), `${name}=${value}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${seconds}${secureCookies ? '; Secure' : ''}`]);
  }
  const sessionCookie = { customer: ['pp_customer', 'Lax'], admin: ['pp_admin', 'Strict'] };
  function cleanup() {
    if (now() - lastCleanup < 30_000) return;
    lastCleanup = now();
    db.prepare('DELETE FROM auth_challenges WHERE expires<=?').run(now());
    db.prepare('DELETE FROM auth_sessions WHERE expires<=?').run(now());
    limit.cleanup?.();
  }
  const previewBinding = previewKey => previewKey ? hash('preview|' + previewKey) : null;
  const flowBinding = (flow, previewKey) => hash('flow|' + flow + '|' + (previewKey || ''));
  function isAdminPhone(phone) { return adminPhones.includes(phone); }
  function get(req, { previewKey } = {}, role) {
    const token = readCookie(req, sessionCookie[role][0]);
    if (!token || token.length > 128) return null;
    const row = db.prepare('SELECT * FROM auth_sessions WHERE token_hash=?').get(hash(token));
    if (!row || row.role !== role || row.expires <= now()) return null;
    if (row.binding !== null && row.binding !== previewBinding(previewKey)) return null;
    if (role === 'admin' && !isAdminPhone(row.phone)) return null; // removing a number from ADMIN_PHONES revokes access immediately
    if (role === 'customer') {
      // The session's identity (phone or email) must still belong to the account.
      const customer = db.prepare('SELECT phone, email FROM customers WHERE id=?').get(row.subject);
      if (!customer || (customer.phone !== row.phone && customer.email !== row.phone)) return null;
      return { id: row.subject, phone: customer.phone, email: customer.email };
    }
    return { id: row.subject, phone: row.phone };
  }
  function allowedPhone(role, raw) {
    if (!live) {
      const phone = typeof raw === 'string' ? raw.replace(/[ ()-]/g, '') : '';
      const ok = role === 'admin' ? phone === demoAdminPhone : /^\+120255501\d{2}$/.test(phone) && phone !== demoAdminPhone;
      if (!ok) throw fail(400, role === 'admin' ? 'Use the displayed demo admin number.' : 'Use a sample number from +12025550100 to +12025550198. No SMS is sent.');
      return { phone, deliverable: true };
    }
    const phone = normalizePhone(raw);
    if (!phone) throw fail(400, 'Enter a valid US or Canadian mobile number, including the area code.');
    if (role === 'admin') return { phone, deliverable: isAdminPhone(phone) };
    if (!allowSmsTo(phone)) throw fail(403, 'Sign-in is limited to approved test numbers right now.');
    return { phone, deliverable: true };
  }
  // Email sign-in codes are generated and checked here (stored hashed); live mode emails them through
  // the transactional email provider, the demo displays them on screen.
  const emailTtlMs = live ? 10 * 60_000 : 5 * 60_000, emailCooldownMs = live ? 30_000 : 0;
  async function startEmail(role, body, ctx) {
    if (role !== 'customer') throw fail(400, 'Use your phone number.');
    const email = normalizeEmail(body.email);
    if (!email) throw fail(400, 'Enter a valid email address.');
    if (live && !allowEmail(email)) throw fail(403, 'Sign-in is limited to approved test addresses right now.');
    if (emailCooldownMs) {
      const recent = db.prepare('SELECT created FROM auth_challenges WHERE phone=? AND role=? ORDER BY created DESC LIMIT 1').get(email, role);
      if (recent && now() - recent.created < emailCooldownMs) throw fail(429, 'A code was just sent. Wait a few seconds before requesting another.', { retryAfter: Math.ceil((emailCooldownMs - (now() - recent.created)) / 1000) });
    }
    if (live) {
      limit(`auth:start:email:${hash(email)}`, 5, 60 * 60_000, 'Too many codes were requested for this email. Please try again later.');
      limit(`auth:email:day:${new Date(now()).toISOString().slice(0, 10)}`, emailDailyLimit, 24 * 60 * 60_000, 'Email sign-in is temporarily paused. Please try again later.');
    }
    const code = String(randomInt(100000, 1000000));
    if (live) {
      if (!sendEmailCode) throw fail(503, 'Email sign-in is temporarily unavailable.');
      try { await sendEmailCode({ email, code, minutes: Math.round(emailTtlMs / 60_000) }); }
      catch { throw fail(503, 'Email sign-in is temporarily unavailable. Try your phone number instead.'); }
    }
    return { identity: email, secret: hash('email-code|' + code), ttl: emailTtlMs, demoCode: live ? null : code, mode: live ? 'email' : 'demo' };
  }
  async function start(req, res, role, body, ctx) {
    const ip = ctx.clientIp || 'unknown';
    limit(`auth:start:${role}:ip:${ip}`, live ? 10 : 5, live ? 60 * 60_000 : 15 * 60_000);
    if (role === 'customer' && body.email !== undefined && body.phone === undefined) {
      const sent = await startEmail(role, body, ctx);
      return issueChallenge(req, res, role, ctx, { identity: sent.identity, secret: sent.secret, deliverable: true, ttl: sent.ttl, response: { mode: sent.mode, channel: 'email', ...(sent.demoCode ? { demoCode: sent.demoCode } : {}) } });
    }
    const { phone, deliverable } = allowedPhone(role, body.phone);
    const phoneKey = hash(phone);
    const cooldown = provider.resendCooldownMs || 0;
    if (cooldown) {
      const recent = db.prepare('SELECT created FROM auth_challenges WHERE phone=? AND role=? ORDER BY created DESC LIMIT 1').get(phone, role);
      if (recent && now() - recent.created < cooldown) throw fail(429, 'A code was just sent. Wait a few seconds before requesting another.', { retryAfter: Math.ceil((cooldown - (now() - recent.created)) / 1000) });
    }
    if (live) limit(`auth:start:phone:${phoneKey}`, 5, 60 * 60_000, 'Too many codes were requested for this number. Please try again later.');
    let result = { secret: null };
    if (deliverable) {
      if (live) limit(`auth:sms:day:${new Date(now()).toISOString().slice(0, 10)}`, smsDailyLimit, 24 * 60 * 60_000, 'Phone sign-in is temporarily paused. Please try again later.');
      try { result = await provider.start({ phone, role }); }
      catch (error) { if (error instanceof ProviderError) throw fail(error.status, error.message); throw fail(503, 'Phone verification is temporarily unavailable.'); }
    }
    // Non-admin numbers on the admin form receive the same response but no SMS and a challenge that cannot verify;
    // a short randomized pause approximates provider latency so response timing does not reveal admin numbers.
    if (!deliverable && live) await new Promise(resolve => setTimeout(resolve, 250 + Math.floor(Math.random() * 400)));
    const response = { mode: provider.displaysCode ? 'demo' : 'sms', channel: 'sms' };
    if (provider.displaysCode && result.demoCode && !live) response.demoCode = result.demoCode;
    return issueChallenge(req, res, role, ctx, { identity: phone, secret: result.secret ?? null, deliverable, ttl: provider.ttlMs, response });
  }
  function issueChallenge(req, res, role, ctx, { identity, secret, deliverable, ttl, response }) {
    let flow = readCookie(req, 'pp_flow');
    if (!flow || !/^[A-Za-z0-9_-]{43}$/.test(flow)) { flow = random(); }
    const binding = flowBinding(flow, ctx.previewKey);
    const challenge = random();
    db.prepare('DELETE FROM auth_challenges WHERE binding=? AND role=?').run(binding, role);
    db.prepare('INSERT INTO auth_challenges(id_hash,role,phone,binding,secret,deliverable,tries,created,expires) VALUES (?,?,?,?,?,?,0,?,?)')
      .run(hash(challenge), role, identity, binding, secret, deliverable ? 1 : 0, now(), now() + ttl);
    cookieHeader(res, 'pp_flow', flow, Math.ceil(ttl / 1000) + 60);
    return { challenge, expiresIn: Math.round(ttl / 1000), ...response };
  }
  async function verify(req, res, role, body, ctx) {
    const ip = ctx.clientIp || 'unknown';
    limit(`auth:verify:${role}:ip:${ip}`, 12, 15 * 60_000);
    const flow = readCookie(req, 'pp_flow');
    const id = typeof body.challenge === 'string' && body.challenge.length <= 64 ? body.challenge : '';
    const row = id && flow ? db.prepare('SELECT * FROM auth_challenges WHERE id_hash=?').get(hash(id)) : null;
    if (!row || row.role !== role || row.binding !== flowBinding(flow, ctx.previewKey) || row.expires <= now() || row.tries >= 5) throw fail(401, 'Code expired or unavailable. Request a new code.');
    if (live) limit(`auth:verify:phone:${hash(row.phone)}`, 10, 60 * 60_000);
    db.prepare('UPDATE auth_challenges SET tries=tries+1 WHERE id_hash=?').run(row.id_hash);
    if (!row.deliverable) throw fail(401, 'That code did not match.');
    let outcome;
    const enteredCode = typeof body.code === 'string' ? body.code.trim() : '';
    if (isEmailIdentity(row.phone)) outcome = { approved: /^\d{6}$/.test(enteredCode) && sameHash(hash('email-code|' + enteredCode), row.secret) };
    else try { outcome = await provider.check({ phone: row.phone, code: enteredCode, secret: row.secret }); }
    catch (error) {
      if (error instanceof ProviderError) {
        if (error.terminal) db.prepare('DELETE FROM auth_challenges WHERE id_hash=?').run(row.id_hash);
        throw fail(error.status, error.message);
      }
      throw fail(503, 'Phone verification is temporarily unavailable.');
    }
    if (!outcome.approved) throw fail(401, 'That code did not match.');
    db.prepare('DELETE FROM auth_challenges WHERE id_hash=?').run(row.id_hash);
    if (role === 'admin' && !isAdminPhone(row.phone)) throw fail(401, 'That code did not match.');
    let subject = row.phone;
    if (role === 'customer') {
      const column = isEmailIdentity(row.phone) ? 'email' : 'phone';
      db.prepare(`INSERT OR IGNORE INTO customers(id,${column},created) VALUES (?,?,?)`).run('CU-' + randomBytes(12).toString('hex'), row.phone, now());
      subject = db.prepare(`SELECT id FROM customers WHERE ${column}=?`).get(row.phone).id;
    }
    const [cookieName, sameSite] = sessionCookie[role];
    const old = readCookie(req, cookieName); if (old) db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(hash(old));
    const seconds = role === 'admin' ? adminSessionMinutes * 60 : customerSessionHours * 3600, token = random();
    db.prepare('INSERT INTO auth_sessions(token_hash,role,subject,phone,binding,created,expires) VALUES (?,?,?,?,?,?,?)').run(hash(token), role, subject, row.phone, previewBinding(ctx.previewKey), now(), now() + seconds * 1000);
    cookieHeader(res, cookieName, token, seconds, sameSite);
    cookieHeader(res, 'pp_flow', '', 0);
    if (role === 'admin') return { admin: true };
    const account = db.prepare('SELECT phone, email FROM customers WHERE id=?').get(subject);
    return { customer: { id: subject, phone: account.phone, email: account.email } };
  }
  function logout(req, res, role, ctx, everywhere = false) {
    const [cookieName, sameSite] = sessionCookie[role];
    const token = readCookie(req, cookieName);
    if (token) {
      const row = db.prepare('SELECT * FROM auth_sessions WHERE token_hash=?').get(hash(token));
      if (everywhere && row) db.prepare('DELETE FROM auth_sessions WHERE role=? AND subject=?').run(role, row.subject);
      else db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(hash(token));
    }
    const flow = readCookie(req, 'pp_flow');
    if (flow) db.prepare('DELETE FROM auth_challenges WHERE binding=? AND role=?').run(flowBinding(flow, ctx.previewKey), role);
    cookieHeader(res, cookieName, '', 0, sameSite);
    return role === 'admin' ? { admin: false } : { customer: null };
  }
  async function handle(req, res, role, action, body, ctx) {
    cleanup();
    if (req.method !== 'POST') throw fail(405, 'Method not allowed.');
    if (action === 'start') return start(req, res, role, body, ctx);
    if (action === 'verify') return verify(req, res, role, body, ctx);
    if (action === 'logout') return logout(req, res, role, ctx);
    if (action === 'logout-all' && role === 'customer') return logout(req, res, role, ctx, true);
    throw fail(404, 'Not found.');
  }
  // Admin-mediated account recovery / phone change. Revokes every session of the account.
  function changeCustomerPhone({ customerId, newPhone, changedBy, note }) {
    const phone = live ? normalizePhone(newPhone) : (typeof newPhone === 'string' && /^\+120255501\d{2}$/.test(newPhone) && newPhone !== demoAdminPhone ? newPhone : null);
    if (!phone) throw fail(400, live ? 'Enter a valid +1 phone number.' : 'Use a sample number from +12025550100 to +12025550198.');
    const customer = db.prepare('SELECT * FROM customers WHERE id=?').get(customerId);
    if (!customer) throw fail(404, 'Customer not found.');
    if (customer.phone === phone) throw fail(409, 'That is already the account phone.');
    if (db.prepare('SELECT 1 FROM customers WHERE phone=?').get(phone)) throw fail(409, 'Another account already uses that phone number.');
    db.prepare('UPDATE customers SET phone=? WHERE id=?').run(phone, customerId);
    db.prepare('DELETE FROM auth_sessions WHERE role=? AND subject=?').run('customer', customerId);
    db.prepare('INSERT INTO customer_phone_changes(customer_id,old_phone,new_phone,changed_by,note,at) VALUES (?,?,?,?,?,?)').run(customerId, customer.phone, phone, changedBy, note, now());
    return { customerId, phone };
  }
  return { get, handle, cleanup, changeCustomerPhone, isAdminPhone };
}
