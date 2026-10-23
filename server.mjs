import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createHmac, createHash, timingSafeEqual, randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { wordmark, favicon } from './scripts/brand.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.join(root, 'site');
const eightHours = 8 * 60 * 60 * 1000;
const tenMinutes = 10 * 60 * 1000;
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function loginPage(message = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#ffffff"><title>Private preview — Aevium Labs</title>${favicon}<link rel="stylesheet" href="/assets/css/styles.css"><script src="/assets/js/entry.js"></script></head><body class="gate-page"><main class="gate${message ? ' gate-ready' : ''}" aria-label="Aevium Labs private preview"><div class="gate-content"><div class="gate-identity"><img class="gate-emblem" src="/assets/images/flower-of-life-hero.webp" width="64" height="64" alt="" aria-hidden="true"><div class="gate-brand">${wordmark}</div></div><form class="gate-form" action="/login" method="post"><label class="sr-only" for="preview-password">Preview password</label><div class="gate-field"><input type="password" id="preview-password" name="password" placeholder="Password" autocomplete="current-password" required maxlength="256" ${message ? 'autofocus aria-describedby="gate-error" aria-invalid="true"' : ''}><button type="submit" aria-label="Enter the preview"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.5"/></svg></button></div>${message ? `<p class="gate-error" id="gate-error" role="alert">${escape(message)}</p>` : ''}</form></div></main></body></html>`;
}

export function createPreviewServer({ password, signingKey = randomBytes(32), secureCookies = false, now = () => Date.now(), publicOrigin = null, commerce = null, accessGate = 'password', trustProxyHops = 0, allowedHosts = null, liveRoot = null, allowIndexing = false, log = () => {} } = {}) {
  const gated = accessGate !== 'public';
  if (gated && !password) throw new Error('PREVIEW_PASSWORD is required. Set it in .env.local or the server environment.');
  // Client address for throttling. Behind N trusted proxies, the client is the Nth entry from the right of X-Forwarded-For.
  const clientIp = req => {
    if (trustProxyHops > 0) {
      const chain = String(req.headers['x-forwarded-for'] || '').split(',').map(item => item.trim()).filter(Boolean);
      if (chain.length >= trustProxyHops) return chain[chain.length - trustProxyHops];
    }
    return req.socket.remoteAddress || 'unknown';
  };
  const attempts = new Map();
  const revoked = new Map();
  const passwordDigest = createHash('sha256').update(password || randomBytes(32)).digest();
  const signature = payload => createHmac('sha256', signingKey).update(payload).digest('base64url');
  const mint = () => {
    const payload = Buffer.from(JSON.stringify({ exp: now() + eightHours, nonce: randomBytes(18).toString('base64url') })).toString('base64url');
    return `${payload}.${signature(payload)}`;
  };
  function verify(token) {
    if (typeof token !== 'string' || token.length > 512 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) || revoked.has(token)) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, mac] = parts;
    const expected = signature(payload);
    if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
    try {
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      return typeof data.exp === 'number' && data.exp > now() && data.exp <= now() + eightHours && typeof data.nonce === 'string' ? data : null;
    } catch { return null; }
  }
  function cookie(token, maxAge = eightHours / 1000) {
    return `pp_preview=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secureCookies ? '; Secure' : ''}`;
  }
  function cleanMemory() {
    for (const [key, value] of attempts) if (value.expires <= now()) attempts.delete(key);
    for (const [key, expires] of revoked) if (expires <= now()) revoked.delete(key);
  }
  const cleanup = setInterval(cleanMemory, 30_000); cleanup.unref();
  const publicPaths = new Set(['/privacy', '/privacy/', '/privacy/index.html', '/research-use', '/research-use/', '/research-use/index.html', '/assets/css/styles.css', '/assets/js/main.js', '/assets/js/entry.js', '/assets/js/commerce.js', '/assets/images/aevium-logo.webp', '/assets/images/brand-mark.svg', '/assets/images/flower-of-life.webp', '/assets/images/flower-of-life-hero.webp', '/assets/images/flower-of-life-128.webp', '/assets/images/favicon.png', '/assets/fonts/space-grotesk-variable.woff2', '/assets/fonts/OFL-Space-Grotesk.txt', '/robots.txt']);
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' };
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Vary', 'Cookie');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    if (!allowIndexing) res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'");
    if (secureCookies) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    const send = (status, body, type = 'text/html; charset=utf-8') => {
      res.statusCode = status; res.setHeader('Content-Type', type);
      res.setHeader('Content-Length', Buffer.byteLength(body));
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    try {
      let pathname;
      try { pathname = decodeURIComponent(new URL(req.url, 'http://local.invalid').pathname); } catch { send(400, 'Invalid URL'); return; }
      if (pathname.includes('\0') || pathname.includes('\\')) { send(400, 'Invalid path'); return; }
      if (pathname === '/healthz') { const ok = !commerce || commerce.healthy(); send(ok ? 200 : 503, ok ? 'ok' : 'unhealthy', 'text/plain; charset=utf-8'); return; }
      if (allowedHosts && !allowedHosts.includes(String(req.headers.host || '').toLowerCase())) { send(421, 'Unknown host', 'text/plain; charset=utf-8'); return; }
      // Signed provider callbacks are authenticated by signature, not by preview or customer sessions.
      if (pathname === '/api/webhooks/resend') {
        if (!commerce?.handleWebhook) { send(404, JSON.stringify({ error: 'Not found.' }), 'application/json'); return; }
        await commerce.handleWebhook(req, res); return;
      }
      const token = req.headers.cookie?.split(';').map(item => item.trim()).find(item => item.startsWith('pp_preview='))?.slice(11);
      const session = gated ? verify(token) : { open: true };
      const ip = clientIp(req);
      const query = new URL(req.url, 'http://local.invalid').searchParams;
      cleanMemory();
      if (!gated && (pathname === '/login' || pathname === '/logout')) { res.writeHead(303, { Location: '/' }); res.end(); return; }
      if (req.method === 'POST' && (pathname === '/login' || pathname === '/logout')) {
        const expectedOrigin = publicOrigin || `${secureCookies ? 'https' : 'http'}://${req.headers.host}`;
        if (req.headers.origin !== expectedOrigin || !['application/x-www-form-urlencoded'].includes((req.headers['content-type'] || '').split(';')[0])) { send(403, 'Request rejected'); return; }
        if (pathname === '/logout') {
          if (session) revoked.set(token, session.exp);
          res.setHeader('Set-Cookie', cookie('', 0)); res.writeHead(303, { Location: '/login' }); res.end(); return;
        }
        const attempt = attempts.get(ip);
        if (attempt && attempt.count >= 8) {
          res.setHeader('Retry-After', String(Math.max(1, Math.ceil((attempt.expires - now()) / 1000))));
          send(429, loginPage('Too many attempts. Please try again in a few minutes.')); return;
        }
        let body = '';
        for await (const chunk of req) {
          body += chunk.toString('utf8');
          if (Buffer.byteLength(body) > 2048) { send(413, 'Request too large'); return; }
        }
        const candidate = new URLSearchParams(body).get('password') || '';
        const digest = createHash('sha256').update(candidate).digest();
        if (candidate.length <= 256 && timingSafeEqual(digest, passwordDigest)) {
          attempts.delete(ip); res.setHeader('Set-Cookie', cookie(mint()));
          res.writeHead(303, { Location: '/' }); res.end(); return;
        }
        attempts.set(ip, { count: (attempt?.count || 0) + 1, expires: attempt?.expires || now() + tenMinutes });
        send(401, loginPage('That password did not match. Please try again.')); return;
      }
      if (pathname.startsWith('/api/')) {
        if (!session) { send(401, JSON.stringify({ error: 'Preview access required.' }), 'application/json'); return; }
        if (!commerce) { send(503, JSON.stringify({ error: 'The order demo is not enabled.' }), 'application/json'); return; }
        await commerce.handle(req, res, { pathname, sessionKey: gated ? token : null, clientIp: ip, query }); return;
      }
      if (!['GET','HEAD'].includes(req.method)) { res.setHeader('Allow','GET, HEAD'); send(405,'Method not allowed'); return; }
      if (pathname === '/login') {
        if (session) { res.writeHead(303,{Location:'/'}); res.end(); return; }
        send(200, loginPage()); return;
      }
      if (!publicPaths.has(pathname) && !session) {
        if (pathname === '/' || pathname === '/index.html') { res.writeHead(303, { Location: '/login' }); res.end(); }
        else send(401, 'Preview access required.', 'text/plain; charset=utf-8');
        return;
      }
      if (allowIndexing && pathname === '/robots.txt') { send(200, 'User-agent: *\nDisallow: /api/\nDisallow: /admin/\nDisallow: /orders/\n', 'text/plain; charset=utf-8'); return; }
      const relative = pathname.replace(/^\/+/, '') || 'index.html';
      // Live deployments serve HTML generated with verified configuration from site-live/; shared assets come from site/.
      if (liveRoot) {
        const candidate = path.resolve(liveRoot, relative.endsWith('/') || !path.extname(relative) ? path.join(relative, 'index.html') : relative);
        if (candidate.startsWith(liveRoot + path.sep) && candidate.endsWith('.html')) {
          try {
            let html = await readFile(candidate, 'utf8');
            if (!gated) html = html.replace('<form action="/logout" method="post"><button type="submit">Lock preview</button></form>', '');
            send(200, html, types['.html']); return;
          } catch (error) { if (error.code !== 'ENOENT') throw error; }
        }
      }
      let filename = path.resolve(siteRoot, relative);
      if (!filename.startsWith(siteRoot + path.sep)) { send(404,'Not found'); return; }
      if ((await stat(filename)).isDirectory()) filename = path.join(filename,'index.html');
      filename = await realpath(filename);
      if (!filename.startsWith(siteRoot + path.sep) || !types[path.extname(filename)]) { send(404,'Not found'); return; }
      send(200, await readFile(filename), types[path.extname(filename)]);
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(error.code)) log(error);
      if (res.headersSent) { res.end(); return; }
      send(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500, error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 'Not found' : 'Unable to serve this request.', 'text/plain; charset=utf-8');
    }
  });
  server.on('close', () => { clearInterval(cleanup); commerce?.close(); });
  server.headersTimeout = 15_000;
  server.requestTimeout = 15_000;
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { startFromEnvironment } = await import('./scripts/commerce/startup.mjs');
  await startFromEnvironment({ root, createPreviewServer });
}
