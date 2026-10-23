import { createHmac, timingSafeEqual } from 'node:crypto';

export class TransportError extends Error {
  constructor(message, { retryable = true, code = 'transport_error' } = {}) { super(message); this.retryable = retryable; this.code = code; }
}

// Local capture used by the demo and automated tests. Never contacts a provider.
export const localCaptureTransport = async () => ({ channel: 'local-preview' });

// Resend transactional email. The Idempotency-Key makes a retried request (after a crash, timeout or
// lost response) return the original message instead of sending twice, within Resend's 24-hour window.
// "Accepted" here only means Resend accepted the request; delivery is learned from signed webhooks.
// References: https://resend.com/docs/api-reference/emails/send-email and
// https://resend.com/docs/dashboard/emails/idempotency-keys
export function createResendTransport({ apiKey, from, replyTo, fetch = globalThis.fetch, timeoutMs = 10_000, baseUrl = 'https://api.resend.com' }) {
  if (!/^re_[A-Za-z0-9_]+$/.test(apiKey || '')) throw new Error('RESEND_API_KEY is missing or not in the expected format.');
  if (!from || !/@/.test(from)) throw new Error('MAIL_FROM is missing.');
  return async function send(message) {
    const payload = { from, to: [message.recipient], subject: message.subject, html: message.html, text: message.text, tags: [{ name: 'kind', value: String(message.kind).replace(/[^A-Za-z0-9_-]/g, '_') }] };
    if (replyTo) payload.reply_to = replyTo;
    let response;
    try {
      response = await fetch(`${baseUrl}/emails`, {
        method: 'POST', signal: AbortSignal.timeout(timeoutMs),
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': message.idempotencyKey },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      // The request may or may not have reached Resend; retrying with the same key is safe.
      throw new TransportError('Email provider did not respond.', { code: error?.name === 'TimeoutError' ? 'timeout' : 'network' });
    }
    let data = {};
    try { data = await response.json(); } catch {}
    if (response.ok && typeof data.id === 'string' && data.id) return { channel: 'resend', providerId: data.id };
    const name = typeof data.name === 'string' ? data.name : '';
    if (response.status === 409 && name === 'concurrent_idempotent_requests') throw new TransportError('Provider is still processing this message.', { code: name });
    if (response.status === 409) throw new TransportError('Provider rejected a reused message key with different content.', { retryable: false, code: 'idempotency_conflict' });
    if (response.status === 429 || response.status >= 500) throw new TransportError(`Email provider temporarily unavailable (${response.status}).`, { code: `http_${response.status}` });
    // 400/401/403/422: invalid key, unverified sender domain, invalid recipient, etc. Retrying will not help.
    throw new TransportError(`Email provider rejected the message (${response.status}${name ? ' ' + name : ''}).`, { retryable: false, code: name || `http_${response.status}` });
  };
}

// Resend signs webhooks with Svix: HMAC-SHA256 over `${svix-id}.${svix-timestamp}.${raw body}` using the
// base64 secret after the "whsec_" prefix. The svix-signature header holds space-separated "v1,<base64>".
// Reference: https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests
export function verifySvixSignature({ secret, headers, body, now = Date.now(), toleranceSeconds = 300 }) {
  const id = headers['svix-id'], timestamp = headers['svix-timestamp'], signatures = headers['svix-signature'];
  if (!secret || typeof id !== 'string' || typeof timestamp !== 'string' || typeof signatures !== 'string') return false;
  if (!/^\d{1,12}$/.test(timestamp) || Math.abs(Math.floor(now / 1000) - Number(timestamp)) > toleranceSeconds) return false;
  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
  if (!key.length) return false;
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.`).update(body).digest();
  return signatures.split(' ').some(entry => {
    const [version, value] = entry.split(',');
    if (version !== 'v1' || !value) return false;
    const candidate = Buffer.from(value, 'base64');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
}

// Test helper / documentation of the format.
export function signSvix({ secret, id, timestamp, body }) {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  return 'v1,' + createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
}
