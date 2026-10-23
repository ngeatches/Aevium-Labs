import { randomBytes } from 'node:crypto';
import { TransportError } from './email-providers.mjs';
const money = cents => '$' + (cents / 100).toFixed(2);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const headings = { created: 'Order received — payment instructions', approved: 'Payment review complete', shipped: 'Your shipment details', returned: 'Payment report needs attention' };

function demoMessage(order, kind) {
  const c = order.customer, s = order.shipping;
  const lines = ['LOCAL DEMO — this email is captured locally, not sent.', '', `Hello ${c.name},`, '', headings[kind], `Order number: ${order.id}`, '', ...order.items.map(p => `${p.name} · ${p.amount} × ${p.quantity}: ${money(p.priceCents * p.quantity)}`), `Total: ${money(order.totalCents)}`, ''];
  if (kind === 'created') lines.push('How to pay — demonstration only', `Send: ${money(order.totalCents)} to ${order.instructions.recipientEmail} (sample, do not send funds)`, `Zelle Name: ${order.instructions.recipientName}`, `Payment Reference / Order Number: ${order.id}`, '1. In the Zelle memo, enter only your order number. Do not add product names or any other notes.', `2. Send exactly ${money(order.totalCents)}.`, '3. Do not send funds. This is a demo.', '4. In Your orders, choose the payment-report button to simulate reporting payment.', '5. An administrator must separately verify receipt before approval.');
  if (kind === 'approved') lines.push('An administrator has completed the simulated payment review. The order is ready for fulfillment. You will receive shipping details after fulfillment is recorded.');
  if (kind === 'returned') lines.push('Please review the note and submit a corrected payment report:', order.payment.note);
  if (kind === 'shipped') lines.push(`Carrier: ${s.carrier}`, `Tracking number: ${s.tracking}`, `Fulfillment reference: ${s.reference}`, '', `Ship to: ${c.name}`, c.address, `${c.city}, ${c.region} ${c.postal}`, c.country, '', s.note || '', 'Sign in with your phone number in Your orders to view order confirmation and any attached proof. No real parcel has been dispatched by this demo.');
  lines.push('', 'Sign in at /orders/ with the same demo phone number to view this order.', 'For laboratory research only; not for human or veterinary use.');
  const text = lines.join('\n');
  return { recipient: c.email, subject: `[DEMO] ${headings[kind]} · ${order.id}`, text, html: `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escape(headings[kind])}</title><body style="font:16px/1.7 system-ui;color:#202124;max-width:680px;margin:40px auto;padding:24px"><p style="color:#a16e22">Aevium Labs · Local email preview</p><h1 style="font-size:28px">${escape(headings[kind])}</h1><div style="white-space:pre-wrap">${escape(text)}</div></body></html>` };
}

// Live transactional template. Uses only verified business configuration and absolute links.
function liveMessage(order, kind, { business, origin }) {
  const c = order.customer, s = order.shipping, z = order.instructions;
  const link = `${origin}/orders/#${order.id}`;
  const items = order.items.map(p => `${p.name} · ${p.amount} × ${p.quantity}: ${money(p.priceCents * p.quantity)}`);
  const totals = order.shippingCents ? [`Subtotal: ${money(order.totalCents - order.shippingCents)}`, `Shipping: ${money(order.shippingCents)}`, `Total: ${money(order.totalCents)}`] : [`Total: ${money(order.totalCents)}`];
  const body = [];
  if (kind === 'created') body.push('Zelle payment instructions', `Send: ${money(order.totalCents)} to ${z.recipientHandle}`, `Zelle Name: ${z.recipientName}`, `Zelle Email / Phone: ${z.recipientHandle}`, `Payment Reference / Order Number: ${order.id}`, '', '1. Open Zelle in your banking app (or the Zelle app).', `2. Send exactly ${money(order.totalCents)} to the Zelle name and email above.`, `3. In the memo, enter only your order number (${order.id}). Do not add product names or any other notes.`, `4. Then open your order and tap “I’ve sent payment”: ${link}`, 'Once your payment arrives and we confirm it, we’ll ship your order and email you the tracking details.');
  if (kind === 'approved') body.push('We confirmed your payment. Your order is being prepared, and we will email tracking details when it ships.');
  if (kind === 'returned') body.push('We could not match your payment report yet. Please review this note, then report the payment again from your order page:', order.payment.note, link);
  if (kind === 'shipped') body.push(`Carrier: ${s.carrier}`, `Tracking number: ${s.tracking}`, `Reference: ${s.reference}`, '', 'Shipping to:', c.name, c.address, `${c.city}, ${c.region} ${c.postal}`, c.country, ...(s.note ? ['', s.note] : []), '', `Sign in with your phone number to view your order confirmation: ${link}`);
  const support = [business.supportEmail, business.supportPhone].filter(Boolean).join(' · ');
  const lines = [`Hello ${c.name},`, '', headings[kind], `Order number: ${order.id}`, '', ...items, ...totals, '', ...body, '', `Questions? Reply to this email or contact ${support}.`, '', `${business.businessName} · For laboratory research use only. Not for human or veterinary use.`, 'You are receiving this transactional message because you placed an order. No marketing emails are sent.'];
  const text = lines.join('\n');
  const paragraphs = text.split('\n').map(line => line ? `<p style="margin:0 0 6px">${escape(line).replace(escape(link), `<a href="${escape(link)}" style="color:#a16e22">${escape(link)}</a>`)}</p>` : '<div style="height:12px"></div>').join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(headings[kind])}</title></head><body style="margin:0;background:#fafafa"><div style="font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#202124;max-width:620px;margin:0 auto;padding:32px 24px"><p style="color:#a16e22;letter-spacing:.08em;text-transform:uppercase;font-size:12px;font-weight:700;margin:0 0 20px">${escape(business.businessName)}</p><h1 style="font-size:22px;text-transform:uppercase;margin:0 0 20px">${escape(headings[kind])}</h1>${paragraphs}</div></body></html>`;
  return { recipient: c.email, subject: `${headings[kind]} · ${order.id}`, text, html };
}

export function messageFor(order, kind, context = { mode: 'demo' }) {
  return context.mode === 'live' ? liveMessage(order, kind, context) : demoMessage(order, kind);
}

// Delivery states:
//   pending → sending (leased claim) → preview (demo capture) | accepted (provider took it)
//   accepted → sent → delayed → delivered, or bounced / complained / failed / suppressed via webhooks
//   suppressed: blocked locally (test allowlist or prior bounce/complaint) — never sent
//   needs_review: outcome uncertain beyond the provider's idempotency window, or a key conflict
const rank = { pending: 0, sending: 0, accepted: 1, sent: 2, delayed: 3, delivered: 4, failed: 5, bounced: 5, suppressed: 5, complained: 6 };
const eventStatus = { 'email.sent': 'sent', 'email.delivered': 'delivered', 'email.delivery_delayed': 'delayed', 'email.bounced': 'bounced', 'email.complained': 'complained', 'email.failed': 'failed', 'email.suppressed': 'suppressed' };
export const retryableStatuses = ['failed', 'needs_review'];

export function createOutbox(db, now, transport, intervalMs = 1000, options = {}) {
  const { mode = 'demo', allowEmail = () => true, leaseMs = 120_000, keyPrefix = 'local', context = { mode: 'demo' }, onError = () => {} } = options;
  const live = mode === 'live';
  transport ||= async () => ({ channel: 'local-preview' });
  const maxAttempts = live ? 8 : 5;
  const backoff = attempt => live ? Math.min(15 * 60_000, 30_000 * 2 ** (attempt - 1)) : Math.min(60_000, 1000 * 2 ** attempt);
  let running = false, closed = false;
  function enqueue(order, kind, eventKey = `${order.id}:${kind}`) {
    const m = messageFor(order, kind, context);
    db.prepare('INSERT OR IGNORE INTO email_outbox(id,event_key,order_id,kind,recipient,subject,text,html,created,available) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run('EM-' + randomBytes(12).toString('hex'), eventKey, order.id, kind, m.recipient, m.subject, m.text, m.html, now(), now());
  }
  const set = (id, fields) => {
    const keys = Object.keys(fields);
    db.prepare(`UPDATE email_outbox SET ${keys.map(k => `${k}=?`).join(',')}, lease_until=NULL WHERE id=?`).run(...keys.map(k => fields[k]), id);
  };
  async function flush() {
    if (running || closed) return;
    running = true;
    try {
      const rows = db.prepare("SELECT * FROM email_outbox WHERE (status='pending' AND available<=?) OR (status='sending' AND lease_until<=?) ORDER BY created LIMIT 25").all(now(), now());
      for (const candidate of rows) {
        if (closed) break;
        const claim = db.prepare("UPDATE email_outbox SET status='sending', lease_until=?, attempts=attempts+1, first_attempt=COALESCE(first_attempt,?) WHERE id=? AND ((status='pending' AND available<=?) OR (status='sending' AND lease_until<=?))").run(now() + leaseMs, now(), candidate.id, now(), now());
        if (!claim.changes) continue;
        const row = db.prepare('SELECT * FROM email_outbox WHERE id=?').get(candidate.id);
        if (live) {
          if (!allowEmail(row.recipient)) { set(row.id, { status: 'suppressed', processed: now(), error: 'Not on the approved test recipient list. Not sent.' }); continue; }
          const suppressed = db.prepare('SELECT reason FROM email_suppressions WHERE recipient=?').get(row.recipient.toLowerCase());
          if (suppressed) { set(row.id, { status: 'suppressed', processed: now(), error: `Recipient suppressed after ${suppressed.reason}. Not sent.` }); continue; }
          if (row.attempts > 1 && now() - row.first_attempt > 23 * 60 * 60_000) { set(row.id, { status: 'needs_review', error: 'Outcome uncertain beyond the provider’s 24-hour duplicate protection. Check the provider log, then retry only if it was not sent.' }); continue; }
        }
        const idempotencyKey = `${keyPrefix}:${row.event_key}${row.idem_round ? `:r${row.idem_round}` : ''}`;
        try {
          const result = await transport({ ...row, idempotencyKey });
          if (closed) break;
          if (result?.channel === 'local-preview' && !live) { set(row.id, { status: 'preview', processed: now(), error: null }); continue; }
          if (!live || result?.channel === 'local-preview' || !result?.providerId) throw new TransportError(live ? 'Provider returned no message id.' : 'Only local email capture is enabled.');
          db.exec('BEGIN IMMEDIATE');
          try {
            set(row.id, { status: 'accepted', provider: result.channel, provider_id: result.providerId, processed: now(), error: null });
            reconcile(result.channel, result.providerId);
            db.exec('COMMIT');
          } catch (error) { db.exec('ROLLBACK'); throw error; }
        } catch (error) {
          if (closed) break;
          onError(error, row);
          const attempt = row.attempts;
          if (error?.code === 'idempotency_conflict') set(row.id, { status: 'needs_review', error: 'Provider rejected a reused message key. Review before retrying.' });
          else if (error?.retryable === false) set(row.id, { status: 'failed', rejected: 1, error: live ? String(error.message).slice(0, 300) : 'Email preview could not be prepared. Retry is available.' });
          else set(row.id, { status: attempt >= maxAttempts ? 'failed' : 'pending', available: now() + backoff(attempt), error: live ? `Attempt ${attempt} failed: ${String(error?.message || 'error').slice(0, 200)}` : 'Email preview could not be prepared. Retry is available.' });
        }
      }
    } finally { running = false; }
  }
  // Apply provider events in rank order so late or duplicated events never move a message backwards.
  function applyStatus(row, status, eventType, occurred) {
    const current = rank[row.status] ?? 0, next = rank[status] ?? 0;
    const updates = { last_event: eventType, last_event_at: occurred };
    if (next > current) { updates.status = status; if (status === 'delivered') updates.delivered_at = occurred; }
    const keys = Object.keys(updates);
    db.prepare(`UPDATE email_outbox SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`).run(...keys.map(k => updates[k]), row.id);
  }
  function suppress(recipient, reason, eventId) {
    db.prepare('INSERT OR IGNORE INTO email_suppressions(recipient,reason,at,source_event) VALUES (?,?,?,?)').run(recipient.toLowerCase(), reason, now(), eventId);
  }
  function applyEvent(provider, event, row) {
    const status = eventStatus[event.type];
    if (!status) return;
    applyStatus(row, status, event.type, event.occurred);
    if (status === 'complained') suppress(row.recipient, 'a spam complaint', event.id);
    if (status === 'bounced' && event.bounceType !== 'Transient') suppress(row.recipient, 'a permanent bounce', event.id);
  }
  function reconcile(provider, providerId) {
    const row = db.prepare('SELECT * FROM email_outbox WHERE provider=? AND provider_id=?').get(provider, providerId);
    if (!row) return;
    for (const event of db.prepare('SELECT * FROM webhook_events WHERE provider=? AND provider_message_id=? AND applied=0 ORDER BY occurred').all(provider, providerId)) {
      applyEvent(provider, { id: event.id, type: event.type, occurred: event.occurred, bounceType: event.bounce_type }, db.prepare('SELECT * FROM email_outbox WHERE id=?').get(row.id));
      db.prepare('UPDATE webhook_events SET applied=1 WHERE id=?').run(event.id);
    }
  }
  // Record a verified provider event exactly once; apply it now or when the send result is stored.
  function recordEvent(provider, { id, type, messageId, occurred, bounceType }) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const inserted = db.prepare('INSERT OR IGNORE INTO webhook_events(id,provider,type,provider_message_id,occurred,received) VALUES (?,?,?,?,?,?)').run(id, provider, type, messageId || null, occurred || now(), now());
      if (!inserted.changes) { db.exec('COMMIT'); return { duplicate: true }; }
      if (bounceType) db.prepare('UPDATE webhook_events SET bounce_type=? WHERE id=?').run(bounceType, id);
      const row = messageId ? db.prepare('SELECT * FROM email_outbox WHERE provider=? AND provider_id=?').get(provider, messageId) : null;
      if (row) { applyEvent(provider, { id, type, occurred: occurred || now(), bounceType }, row); db.prepare('UPDATE webhook_events SET applied=1 WHERE id=?').run(id); }
      db.exec('COMMIT');
      return { duplicate: false, matched: !!row };
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function retry(id) {
    const row = db.prepare('SELECT * FROM email_outbox WHERE id=?').get(id);
    if (!row) return { error: 404 };
    if (!retryableStatuses.includes(row.status)) return { error: 409 };
    // A needs_review retry means the operator confirmed it was not sent: use a fresh provider key.
    // A definite provider rejection also gets a fresh key; an exhausted timeout retry keeps its key (dedupe).
    db.prepare("UPDATE email_outbox SET status='pending', attempts=0, available=?, error=NULL, lease_until=NULL, first_attempt=NULL, rejected=0, idem_round=idem_round+? WHERE id=?").run(now(), row.status === 'needs_review' || row.rejected ? 1 : 0, id);
    return { queued: true };
  }
  const timer = intervalMs ? setInterval(() => { flush().catch(error => onError(error)); }, intervalMs) : null;
  timer?.unref();
  return { enqueue, flush, recordEvent, retry, close() { closed = true; clearInterval(timer); } };
}
