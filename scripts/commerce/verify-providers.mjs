import { randomInt, createHash, timingSafeEqual } from 'node:crypto';

const digest = value => createHash('sha256').update(String(value)).digest('hex');
const sameDigest = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export class ProviderError extends Error {
  constructor(message, { status = 503, code = 'provider_error', terminal = false } = {}) { super(message); this.status = status; this.code = code; this.terminal = terminal; }
}

// Local demo: the code is generated here and displayed on screen. Never used in live mode.
export function createDemoVerifyProvider() {
  return {
    name: 'demo', displaysCode: true, ttlMs: 5 * 60_000, resendCooldownMs: 0,
    async start() { const code = String(randomInt(100000, 1000000)); return { secret: digest(code), demoCode: code }; },
    async check({ code, secret }) { return { approved: sameDigest(digest(typeof code === 'string' ? code : ''), secret) }; }
  };
}

// Automated-test provider: behaves like a real SMS provider (code never returned to the browser);
// tests read the most recent code from `outbox`. Never sends anything.
export function createTestVerifyProvider({ failWith = null } = {}) {
  const outbox = [];
  const provider = {
    name: 'test', displaysCode: false, ttlMs: 10 * 60_000, resendCooldownMs: 30_000, outbox, failWith,
    lastCode(phone) { return [...outbox].reverse().find(item => item.phone === phone)?.code; },
    async start({ phone }) {
      if (provider.failWith) throw provider.failWith;
      const code = String(randomInt(100000, 1000000)); outbox.push({ phone, code });
      return { secret: digest(code) };
    },
    async check({ code, secret }) {
      if (provider.failWith) throw provider.failWith;
      return { approved: sameDigest(digest(typeof code === 'string' ? code : ''), secret) };
    }
  };
  return provider;
}

// Twilio Verify (SMS channel). Twilio generates, sends and checks the code; this server never sees it
// except to forward the customer's entry for checking. Uses API key credentials (recommended over the
// account auth token) and Basic authentication. Requests time out instead of hanging a sign-in.
// References: https://www.twilio.com/docs/verify/api/verification and /verification-check
export function createTwilioVerifyProvider({ accountSid, apiKeySid, apiKeySecret, serviceSid, fetch = globalThis.fetch, timeoutMs = 8000, baseUrl = 'https://verify.twilio.com' }) {
  for (const [name, value, pattern] of [['TWILIO_ACCOUNT_SID', accountSid, /^AC[0-9a-f]{32}$/], ['TWILIO_API_KEY_SID', apiKeySid, /^SK[0-9a-f]{32}$/], ['TWILIO_VERIFY_SERVICE_SID', serviceSid, /^VA[0-9a-f]{32}$/]]) {
    if (!pattern.test(value || '')) throw new Error(`${name} is missing or not in the expected format.`);
  }
  if (!apiKeySecret) throw new Error('TWILIO_API_KEY_SECRET is missing.');
  const authorization = 'Basic ' + Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString('base64');
  async function call(resource, params) {
    let response;
    try {
      response = await fetch(`${baseUrl}/v2/Services/${serviceSid}/${resource}`, {
        method: 'POST', signal: AbortSignal.timeout(timeoutMs),
        headers: { Authorization: authorization, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams(params)
      });
    } catch (error) {
      throw new ProviderError('The verification service did not respond. Please try again shortly.', { code: error?.name === 'TimeoutError' ? 'timeout' : 'network' });
    }
    let data = {};
    try { data = await response.json(); } catch {}
    if (response.ok) return data;
    const code = Number(data.code);
    // Twilio error codes: 20404 resource not found (expired, already approved or deleted);
    // 60202 max check attempts; 60203 max send attempts; 60200 invalid parameter;
    // 60410 blocked by Fraud Guard; 60605 blocked by geo permissions; 20429 / HTTP 429 rate limited.
    if (code === 20404 || response.status === 404) throw new ProviderError('That code has expired. Request a new code.', { status: 401, code: 'expired', terminal: true });
    if (code === 60202) throw new ProviderError('Too many incorrect codes. Request a new code later.', { status: 429, code: 'max_checks', terminal: true });
    if (code === 60203) throw new ProviderError('Too many codes were requested for this number. Please wait before trying again.', { status: 429, code: 'max_sends' });
    if (code === 60200 || code === 21211 || code === 21614) throw new ProviderError('Check the phone number and try again.', { status: 400, code: 'invalid_number' });
    if (code === 60410 || code === 60605) throw new ProviderError('Text messages cannot be sent to this number.', { status: 400, code: 'blocked' });
    if (response.status === 429 || code === 20429) throw new ProviderError('The verification service is busy. Please try again shortly.', { status: 429, code: 'rate_limited' });
    if (response.status === 401 || response.status === 403) throw new ProviderError('Phone verification is temporarily unavailable.', { status: 503, code: 'provider_auth' });
    throw new ProviderError('Phone verification is temporarily unavailable.', { status: 503, code: `http_${response.status}` });
  }
  return {
    name: 'twilio', displaysCode: false, ttlMs: 10 * 60_000, resendCooldownMs: 30_000,
    async start({ phone }) {
      const data = await call('Verifications', { To: phone, Channel: 'sms' });
      if (data.status !== 'pending') throw new ProviderError('Phone verification is temporarily unavailable.', { code: 'unexpected_status' });
      return { secret: null };
    },
    async check({ phone, code }) {
      if (typeof code !== 'string' || !/^\d{4,10}$/.test(code)) return { approved: false };
      const data = await call('VerificationCheck', { To: phone, Code: code });
      return { approved: data.status === 'approved' && data.to === phone };
    }
  };
}
