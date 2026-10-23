import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewServer } from '../server.mjs';

const password = 'test-only-password';
async function fixture(options = {}) {
  const server = createPreviewServer({ password, ...options });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options = {}) => fetch(base + path, { redirect:'manual', ...options });
  const post = (path, value, cookie, origin = base) => request(path, { method:'POST', headers:{ Origin:origin, 'Content-Type':'application/x-www-form-urlencoded', ...(cookie ? {Cookie:cookie} : {}) },body:new URLSearchParams({password:value}) });
  const login = async () => { const result = await post('/login',password); assert.equal(result.status,303); return result.headers.get('set-cookie').split(';')[0]; };
  const close = () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  return {server,base,request,post,login,close};
}

test('password gate protects pages and direct product assets, while policies remain public', async t => {
  const f=await fixture(); t.after(f.close);
  const home=await f.request('/'); assert.equal(home.status,303); assert.equal(home.headers.get('location'),'/login');
  assert.equal((await f.request('/assets/images/products/retatrutide-30-640.webp')).status,401);
  const privacy=await f.request('/privacy/'); assert.equal(privacy.status,200); assert.match(await privacy.text(),/pp_preview/);
  const research=await f.request('/research-use/'); assert.equal(research.status,200); assert.match(await research.text(),/2026-10-12\.1/);
  const font=await f.request('/assets/fonts/space-grotesk-variable.woff2'); assert.equal(font.status,200); assert.equal(font.headers.get('content-type'),'font/woff2');
  assert.ok((await font.arrayBuffer()).byteLength>0);
  assert.equal((await f.request('/assets/images/brand-mark.svg')).status,200);
  assert.equal((await f.request('/assets/js/entry.js')).status,200);
  const rejected=await f.post('/login','wrong'); assert.equal(rejected.status,401); assert.match(await rejected.text(),/did not match/);
  const cookie=await f.login();
  const allowed=await f.request('/',{headers:{Cookie:cookie}}); assert.equal(allowed.status,200); assert.match(await allowed.text(),/Research Peptides &amp; Analytical Materials/); assert.equal(allowed.headers.get('cache-control'),'private, no-store');
  const image=await f.request('/assets/images/products/retatrutide-30-640.webp',{headers:{Cookie:cookie}}); assert.equal(image.status,200); assert.equal(image.headers.get('content-type'),'image/webp');
  assert.equal((await f.request('/.env.local',{headers:{Cookie:cookie}})).status,404);
  assert.equal((await f.request('/revamp.html',{headers:{Cookie:cookie}})).status,404);
  assert.equal((await f.request('/%2e%2e%2f.env.local',{headers:{Cookie:cookie}})).status,404);
});

test('tampered, expired and logged-out tokens cannot access protected content', async t => {
  let clock=Date.now(); const f=await fixture({now:()=>clock}); t.after(f.close);
  const cookie=await f.login();
  assert.equal((await f.request('/',{headers:{Cookie:cookie+'x'}})).status,303);
  assert.equal((await f.request('/',{headers:{Cookie:'pp_preview=e30.'+'é'.repeat(43)}})).status,303);
  const logout=await f.post('/logout','',cookie); assert.equal(logout.status,303); assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
  assert.equal((await f.request('/',{headers:{Cookie:cookie}})).status,303);
  const fresh=await f.login(); clock+=8*60*60*1000+1;
  assert.equal((await f.request('/',{headers:{Cookie:fresh}})).status,303);
});

test('cross-origin submission is rejected and repeated failed attempts are throttled', async t => {
  let clock=Date.now(); const f=await fixture({now:()=>clock}); t.after(f.close);
  assert.equal((await f.post('/login',password,null,'https://unrelated.invalid')).status,403);
  for(let i=0;i<8;i++) assert.equal((await f.post('/login','wrong')).status,401);
  const limited=await f.post('/login',password); assert.equal(limited.status,429); assert.ok(Number(limited.headers.get('retry-after'))>0);
  clock+=10*60*1000+1; assert.equal((await f.post('/login',password)).status,303);
});

test('deployed HTTPS mode marks cookies Secure and rejects an HTTP origin', async t => {
  const f=await fixture({secureCookies:true,publicOrigin:'https://preview.example.test'}); t.after(f.close);
  assert.equal((await f.post('/login',password)).status,403);
  const response=await f.post('/login',password,null,'https://preview.example.test');
  assert.equal(response.status,303);
  assert.match(response.headers.get('set-cookie'),/HttpOnly; SameSite=Strict; Max-Age=28800; Secure/);
});
