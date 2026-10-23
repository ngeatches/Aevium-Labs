import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createPreviewServer } from '../server.mjs';
import { createCommerce } from '../scripts/commerce/service.mjs';
import { policyVersion, acknowledgments } from '../scripts/commerce/policy.mjs';
const products = [{ id:'sample-a',name:'Sample A',mg:'10 mg',price:49 },{id:'sample-b',name:'Sample B',mg:'5 mg',price:79}];
const customer = {phone:'+12025550100',zelleSender:'lab@example.test',name:'Test Lab',email:'lab@example.test',address:'123 Example Street',city:'Example City',region:'MI',postal:'00000',country:'United States'};
async function fixture(options = {}) {
  const now = options.now || (() => Date.now());
  const commerce = createCommerce({products,now,filename:options.filename || ':memory:',mailIntervalMs:0,mailTransport:options.mailTransport});
  const server = createPreviewServer({ password:'test-only-password', now, commerce });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  let clientIndex = 0;
  const client = () => {
    const phone = `+120255501${String(clientIndex++).padStart(2,'0')}`;
    const cookies = new Map();
    const request=async(url,body,extra={})=>{
      const response=await fetch(base+url,{redirect:'manual',method:body===undefined?'GET':'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),...extra},body:body===undefined?undefined:JSON.stringify(body)});
      for(const value of response.headers.getSetCookie()) {const pair=value.split(';')[0];const i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1));}
      return response;
    };
    const completeProfile=async()=>{const r=await request('/api/customer/profile',{firstName:'Test',lastName:'Researcher',birthDate:'1990-01-15',role:'Academic researcher',accepted:true});assert.equal(r.status,200,await r.clone().text());return (await r.json()).customer;};
    const signIn=async(number=phone,{profile=true}={})=>{const code=await(await request('/api/customer/auth/start',{phone:number})).json();const result=await request('/api/customer/auth/verify',{challenge:code.challenge,code:code.demoCode});assert.equal(result.status,200);const customer=(await result.json()).customer;return profile&&!customer.profileComplete?completeProfile():customer;};
    const login=async(customerLogin=true)=>{const r=await fetch(base+'/login',{method:'POST',redirect:'manual',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:'password=test-only-password'});const pair=r.headers.get('set-cookie').split(';')[0];cookies.set('pp_preview',pair.slice(11));await request('/api/shop');if(customerLogin) await signIn();};
    const admin=async()=>{const code=await(await request('/api/admin/auth/start',{phone:'+12025550199'})).json();const r=await request('/api/admin/auth/verify',{challenge:code.challenge,code:code.demoCode});assert.equal(r.status,200);};
    return {request,login,admin,cookies,signIn,phone,completeProfile};
  };
  return {server,base,client,flushMail:commerce.flushMail,close:()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();})};
}
const orderBody = (key='test-order-00000001')=>({idempotencyKey:key,customer,policyVersion,acknowledgments:Object.fromEntries(Object.keys(acknowledgments).map(key=>[key,true])),items:[{id:'sample-a',quantity:2,priceCents:1},{id:'sample-b',quantity:1}]});

test('cart orders use authoritative integer pricing, validate quantities, and deduplicate retries',async t=>{
  const f=await fixture();t.after(f.close);const c=f.client();
  assert.equal((await c.request('/api/orders')).status,401);await c.login();
  assert.equal((await c.request('/api/orders',orderBody(),{Origin:'https://other.invalid'})).status,403);
  for(const items of [[null],['sample-a'],[{id:'sample-a',quantity:-1}],[{id:'sample-a',quantity:1.5}],[{id:'unknown',quantity:1}],[{id:'sample-a',quantity:1},{id:'sample-a',quantity:1}]]) assert.equal((await c.request('/api/orders',{...orderBody(),items})).status,400);
  const r=await c.request('/api/orders',orderBody());assert.equal(r.status,201);const {order}=await r.json();assert.equal(order.totalCents,17700);assert.equal(order.status,'awaiting_payment');assert.equal(order.items[0].priceCents,4900);
  const retried=await(await c.request('/api/orders',orderBody())).json();assert.equal(retried.order.id,order.id);assert.equal((await(await c.request('/api/orders')).json()).orders.length,1);
  assert.equal((await c.request('/api/shop',undefined,{'X-Forwarded-Host':'public.example'})).status,403);
});

test('owner isolation, independent admin login, state transitions and protected shipment evidence',async t=>{
  const f=await fixture();t.after(f.close);const a=f.client(),b=f.client();await a.login();await b.login();
  const {order}=await(await a.request('/api/orders',orderBody())).json();const route='/api/orders/'+order.id;const adminRoute='/api/admin/orders/'+order.id;
  assert.equal((await b.request(route)).status,404);assert.equal((await b.request(route+'/payment',{confirmed:true})).status,404);
  assert.equal((await a.request('/api/admin/orders')).status,401);assert.equal((await a.request(adminRoute+'/approve',{confirmed:true,amountCents:17700,reference:'BANK-DEMO-001'})).status,401);
  await b.admin();assert.equal((await b.request(adminRoute+'/approve',{confirmed:true,amountCents:17700,reference:'BANK-DEMO-001'})).status,409);
  assert.equal((await a.request(route+'/payment',{confirmed:false})).status,400);
  assert.equal((await a.request(route+'/payment',{confirmed:true,reference:'DEMO-123'})).status,200);
  assert.equal((await a.request(route+'/approve',{confirmed:true})).status,403);
  assert.equal((await b.request(adminRoute+'/approve',{confirmed:false})).status,409);
  assert.equal((await b.request(adminRoute+'/reject',{note:'Please correct the reference.'})).status,200);
  assert.equal((await a.request(route+'/payment',{confirmed:true,reference:'DEMO-456'})).status,200);
  assert.equal((await b.request(adminRoute+'/approve',{confirmed:true,amountCents:17700,reference:'BANK-DEMO-001'})).status,200);
  assert.equal((await a.request(route+'/payment',{confirmed:true})).status,409);
  const shipping={carrier:'Demo carrier',tracking:'DEMO-TRACK',reference:'FULFILL-001',note:'Simulated shipment.'};
  assert.equal((await b.request(adminRoute+'/ship',{...shipping,proof:{name:'bad.html',data:Buffer.from('<script>bad</script>').toString('base64')}})).status,400);
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=','base64');
  const shipped=await(await b.request(adminRoute+'/ship',{...shipping,proof:{name:'demo.png',data:bytes.toString('base64')}})).json();assert.equal(shipped.order.status,'shipped');assert.equal(shipped.order.hasProof,true);
  const proof=await a.request(route+'/proof');assert.equal(proof.status,200);assert.match(proof.headers.get('content-disposition'),/attachment/);assert.deepEqual(Buffer.from(await proof.arrayBuffer()),bytes);
  const outsider=f.client();await outsider.login();assert.equal((await outsider.request(route+'/proof')).status,404);
  const receipt=await(await a.request(route)).json();assert.equal(receipt.order.shipping.tracking,'DEMO-TRACK');assert.equal(receipt.order.events.length,6);
  assert.equal((await b.request(adminRoute+'/ship',shipping)).status,409);
  await b.request('/api/admin/auth/logout',{});assert.equal((await b.request('/api/admin/orders')).status,401);
});

test('demo phone codes expire, are one-use and attempt limited; sessions are bound to the preview',async t=>{
  let clock=Date.now();const f=await fixture({now:()=>clock});t.after(f.close);const a=f.client(),b=f.client();await a.login();await b.login();
  assert.equal((await a.request('/api/admin/auth/start',{phone:'+12025550198'})).status,400);
  const first=await(await a.request('/api/admin/auth/start',{phone:'+12025550199'})).json();
  assert.equal((await b.request('/api/admin/auth/verify',{challenge:first.challenge,code:first.demoCode})).status,401);
  const wrongCode = first.demoCode === '000000' ? '000001' : '000000';
  for(let i=0;i<5;i++) assert.equal((await a.request('/api/admin/auth/verify',{challenge:first.challenge,code:wrongCode})).status,401);
  assert.equal((await a.request('/api/admin/auth/verify',{challenge:first.challenge,code:first.demoCode})).status,401);
  const second=await(await a.request('/api/admin/auth/start',{phone:'+12025550199'})).json();clock+=5*60_000+1;
  assert.equal((await a.request('/api/admin/auth/verify',{challenge:second.challenge,code:second.demoCode})).status,401);
  clock+=15*60_000;await a.admin();const token=a.cookies.get('pp_admin');b.cookies.set('pp_admin',token);assert.equal((await b.request('/api/admin/orders')).status,401);
  clock+=60*60_000+1;assert.equal((await a.request('/api/admin/orders')).status,401);
});

test('orders and ownership persist in private SQLite across a server restart',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'pp-order-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));const filename=path.join(dir,'orders.sqlite');
  const first=await fixture({filename});const c=first.client();await c.login();const {order}=await(await c.request('/api/orders',orderBody())).json();await first.close();
  const second=await fixture({filename});t.after(second.close);const next=second.client();await next.login();
  const persisted=await(await next.request('/api/orders/'+order.id)).json();assert.equal(persisted.order.totalCents,17700);assert.equal(persisted.order.customer.email,'lab@example.test');
});

test('customer phone sign-in recovers account orders, enforces policies and cannot grant admin access', async t => {
  const f=await fixture();t.after(f.close);const a=f.client(),b=f.client();await a.login(false);await b.login();
  assert.equal((await a.request('/api/orders',orderBody())).status,401);
  assert.equal((await a.request('/api/customer/auth/start',{phone:'+12025550199'})).status,400);
  assert.equal((await a.request('/api/customer/auth/start',{phone:'+13135551234'})).status,400);
  const code=await(await a.request('/api/customer/auth/start',{phone:a.phone})).json();
  assert.equal((await a.request('/api/admin/auth/verify',{challenge:code.challenge,code:code.demoCode})).status,401);
  assert.equal((await b.request('/api/customer/auth/verify',{challenge:code.challenge,code:code.demoCode})).status,401);
  assert.equal((await a.request('/api/customer/auth/verify',{challenge:code.challenge,code:code.demoCode})).status,200);
  assert.equal((await a.request('/api/customer/auth/verify',{challenge:code.challenge,code:code.demoCode})).status,401);
  const blocked=await a.request('/api/orders',orderBody());assert.equal(blocked.status,403,'orders wait for the sign-up profile');assert.match((await blocked.json()).error,/account details/);
  await a.completeProfile();
  assert.equal((await a.request('/api/admin/emails')).status,401);
  assert.equal((await a.request('/api/orders',{...orderBody(),policyVersion:'old'})).status,400);
  assert.equal((await a.request('/api/orders',{...orderBody(),acknowledgments:{}})).status,400);
  assert.equal((await a.request('/api/orders',{...orderBody(),customer:{...customer,phone:b.phone}})).status,400);
  const {order}=await(await a.request('/api/orders',orderBody())).json();assert.equal(order.policy.version,policyVersion);assert.equal(order.customer.phone,a.phone);
  assert.equal((await(await a.request('/api/shop')).json()).customer.name,'Test Researcher');
  assert.equal((await(await b.request('/api/shop')).json()).customer.role,'Academic researcher');
  assert.equal(order.instructions.verified,false);assert.equal(order.instructions.recipientEmail,"Orders@AeviumLabs.com");assert.match(order.instructions.notice,/Do not send money/);
  await a.request('/api/customer/auth/logout',{});assert.equal((await a.request('/api/orders/'+order.id)).status,401);
  assert.equal((await(await a.request('/api/shop')).json()).customer,null);
  assert.equal((await b.request('/api/orders/'+order.id)).status,404);
  const recovered=await b.signIn(a.phone,{profile:false});assert.equal(recovered.name,'Test Researcher');assert.equal(recovered.profileComplete,true,'returning customers are not asked again');assert.equal((await b.request('/api/orders/'+order.id)).status,200);
  await b.admin();await b.request('/api/customer/auth/logout',{});assert.equal((await b.request('/api/orders/'+order.id)).status,401);
});

test('payment approval checks exact receipt amount; shipment emails are durable, private and duplicate-safe',async t=>{
  let clock=Date.now(), failMail=false, attempts=0;
  const f=await fixture({now:()=>clock,mailTransport:async message=>{attempts++;assert.ok(message.idempotencyKey);if(failMail) throw new Error('temporary test failure');return {channel:'local-preview'};}});t.after(f.close);
  const a=f.client(),admin=f.client(),other=f.client();await a.login();await admin.login(false);await admin.admin();await other.login();
  const {order}=await(await a.request('/api/orders',orderBody())).json();const customerRoute='/api/orders/'+order.id,route='/api/admin/orders/'+order.id;
  await f.flushMail();let mail=(await(await a.request(customerRoute+'/emails')).json()).emails;assert.equal(mail.length,1);assert.equal(mail[0].status,'preview');assert.match(mail[0].text,new RegExp(order.id));assert.match(mail[0].text,/Do not send funds/);
  assert.equal((await other.request(customerRoute+'/emails')).status,404);assert.equal((await a.request('/api/admin/emails')).status,401);
  await a.request(customerRoute+'/payment',{confirmed:true,reference:'DEMO-REPORT'});
  assert.equal((await admin.request(route+'/approve',{confirmed:true,reference:'BANK-1',amountCents:1})).status,400);
  assert.equal((await admin.request(route+'/approve',{confirmed:true,reference:'',amountCents:17700})).status,400);
  assert.equal((await admin.request(route+'/approve',{confirmed:true,reference:'BANK-1',amountCents:17700})).status,200);await f.flushMail();
  const shipping={carrier:'Demo carrier',tracking:'TRACK-DEMO',reference:'SHIP-1',note:'Local sample only.'};failMail=true;
  assert.equal((await admin.request(route+'/ship',shipping)).status,200);await f.flushMail();
  let current=(await(await a.request(customerRoute)).json()).order;assert.equal(current.status,'shipped');assert.equal(current.emails.filter(m=>m.kind==='shipped').length,1);assert.equal(current.emails.find(m=>m.kind==='shipped').status,'pending');
  assert.equal((await admin.request(route+'/ship',shipping)).status,409);
  failMail=false;clock+=3000;await f.flushMail();mail=(await(await a.request(customerRoute+'/emails')).json()).emails;
  const shipped=mail.find(m=>m.kind==='shipped');assert.equal(shipped.status,'preview');assert.match(shipped.text,/TRACK-DEMO/);assert.match(shipped.text,/LOCAL DEMO/);
  const before=attempts;await f.flushMail();assert.equal(attempts,before);
  const adminMail=(await(await admin.request('/api/admin/emails')).json()).emails.find(m=>m.id===shipped.id);assert.equal(adminMail.recipient,customer.email);assert.equal(adminMail.attempts,2);
});

test('pending email previews and account ownership survive restart; exhausted retries need admin recovery',async t=>{
  let clock=Date.now();const dir=await mkdtemp(path.join(os.tmpdir(),'pp-mail-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));const filename=path.join(dir,'orders.sqlite');
  const first=await fixture({filename,now:()=>clock,mailTransport:async()=>{throw new Error('offline');}});const a=first.client();await a.login();const {order}=await(await a.request('/api/orders',orderBody())).json();
  for(let i=0;i<5;i++){await first.flushMail();clock+=65_000;}
  let mail=(await(await a.request('/api/orders/'+order.id+'/emails')).json()).emails[0];assert.equal(mail.status,'failed');await first.close();
  const next=await fixture({filename,now:()=>clock});t.after(next.close);const c=next.client();await c.login();assert.equal((await c.request('/api/orders/'+order.id)).status,200);
  assert.equal((await c.request(`/api/admin/emails/${mail.id}/retry`,{})).status,401);await c.admin();assert.equal((await c.request(`/api/admin/emails/${mail.id}/retry`,{})).status,200);await next.flushMail();
  mail=(await(await c.request('/api/orders/'+order.id+'/emails')).json()).emails[0];assert.equal(mail.status,'preview');assert.equal((await c.request(`/api/admin/emails/${mail.id}/retry`,{})).status,409);
});

test('email sign-up creates an account, then the profile (21+, role, terms) is required before ordering', async t => {
  const clock = Date.UTC(2026, 9, 23, 12); const f=await fixture({now:()=>clock});t.after(f.close);const a=f.client();await a.login(false);
  assert.equal((await a.request('/api/customer/auth/start',{email:'not-an-email'})).status,400);
  const started=await(await a.request('/api/customer/auth/start',{email:' Lab@Example.TEST '})).json();
  assert.equal(started.channel,'email');assert.match(started.demoCode,/^\d{6}$/);
  assert.equal((await a.request('/api/customer/auth/verify',{challenge:started.challenge,code:'000000'===started.demoCode?'111111':'000000'})).status,401);
  const verified=await a.request('/api/customer/auth/verify',{challenge:started.challenge,code:started.demoCode});assert.equal(verified.status,200);
  const account=(await verified.json()).customer;
  assert.equal(account.email,'lab@example.test');assert.equal(account.phone,null);assert.equal(account.profileComplete,false);
  const shop=await(await a.request('/api/shop')).json();assert.deepEqual(shop.signup.roles,['Academic researcher','Lab / institutional researcher','Clinical professional','Graduate / PhD student']);assert.equal(shop.signup.minimumAge,21);
  assert.equal((await a.request('/api/orders',orderBody('email-order-0000001'))).status,403);
  const profile=(over={})=>a.request('/api/customer/profile',{firstName:'Ada',lastName:'',birthDate:'2000-05-01',role:'Graduate / PhD student',accepted:true,...over});
  assert.equal((await profile({birthDate:'2005-10-24'})).status,403,'20 years old is refused');
  assert.equal((await profile({birthDate:'2005-10-23'})).status,200,'21st birthday today is allowed');
  for (const bad of [{birthDate:'2001-02-30'},{birthDate:'2030-01-01'},{birthDate:'1899-12-31'},{birthDate:''},{role:'Other'},{accepted:false},{firstName:'  '},{firstName:'1234'}]) assert.equal((await profile(bad)).status,400,JSON.stringify(bad));
  const saved=(await(await profile()).json()).customer;
  assert.equal(saved.name,'Ada');assert.equal(saved.role,'Graduate / PhD student');assert.equal(saved.birthDate,'2000-05-01');assert.equal(saved.profileComplete,true);
  const emailBody=(key,over={})=>({...orderBody(key),customer:{...customer,...over}});
  assert.equal((await a.request('/api/orders',emailBody('email-order-0000002',{phone:''}))).status,400,'email accounts give a shipping phone');
  assert.equal((await a.request('/api/orders',emailBody('email-order-0000003',{email:'other@example.test'}))).status,400,'order email matches the account');
  const placed=await a.request('/api/orders',emailBody('email-order-0000004',{phone:'(312) 555-0100',email:'LAB@example.test'}));assert.equal(placed.status,201);
  const {order}=await placed.json();assert.equal(order.customer.phone,'(312) 555-0100');assert.equal(order.customer.accountRole,'Graduate / PhD student');
  const b=f.client();await b.login(false);const again=await(await b.request('/api/customer/auth/start',{email:'lab@example.test'})).json();
  const back=(await(await b.request('/api/customer/auth/verify',{challenge:again.challenge,code:again.demoCode})).json()).customer;
  assert.equal(back.id,account.id,'same email signs back into the same account');assert.equal(back.profileComplete,true);
  assert.equal((await b.request('/api/admin/auth/start',{email:'lab@example.test'})).status,400,'admin sign-in stays phone-only');
});

test('order desk customer list adds a customer when their order is created, with a safe CSV download for admins only', async t => {
  const f=await fixture();t.after(f.close);const a=f.client(),b=f.client(),admin=f.client();await a.login();await b.login();await admin.login(false);await admin.admin();
  assert.equal((await a.request('/api/admin/customers')).status,401,'customers cannot see the list');
  assert.equal((await a.request('/api/admin/customers.csv')).status,401);
  assert.deepEqual((await(await admin.request('/api/admin/customers')).json()).customers,[],'signed up but no order yet: not listed');
  const {order}=await(await a.request('/api/orders',{...orderBody('cust-list-0000001'),customer:{...customer,phone:a.phone,name:'=HYPERLINK("x")'}})).json();
  const list=(await(await admin.request('/api/admin/customers')).json()).customers;
  assert.equal(list.length,1);const c=list[0];
  assert.equal(c.firstName,'Test');assert.equal(c.lastName,'Researcher');assert.equal(c.phone,a.phone);assert.equal(c.role,'Academic researcher');assert.equal(c.birthDate,'1990-01-15');
  assert.deepEqual(c.orders.map(o=>o.id),[order.id]);assert.equal(c.orderCount,1);assert.equal(c.totalOrderedCents,order.totalCents);assert.equal(c.totalPaidCents,0);
  await a.request('/api/orders',{...orderBody('cust-list-0000002'),customer:{...customer,phone:a.phone}});
  assert.equal((await(await admin.request('/api/admin/customers')).json()).customers[0].orderCount,2,'second order joins the same customer');
  const csv=await admin.request('/api/admin/customers.csv');assert.equal(csv.status,200);
  assert.match(csv.headers.get('content-type'),/text\/csv/);assert.match(csv.headers.get('content-disposition'),/attachment; filename="aevium-customers-/);
  const text=await csv.text();const [header,row]=text.replace(/^﻿/,'').trim().split('\r\n');
  assert.match(header,/^First name,Last name,Email,Phone,Role,Date of birth/);assert.match(row,new RegExp(order.id));assert.match(row,/^Test,Researcher,/);
});

test('customer CSV neutralizes values a spreadsheet would run as formulas', async t => {
  const f=await fixture();t.after(f.close);const a=f.client(),admin=f.client();await a.login(false);await a.signIn(a.phone,{profile:false});await admin.login(false);await admin.admin();
  assert.equal((await a.request('/api/customer/profile',{firstName:'=HYPERLINK("http://x")',lastName:'+Lab',birthDate:'1990-01-15',role:'Clinical professional',accepted:true})).status,200);
  assert.equal((await a.request('/api/orders',{...orderBody('csv-safety-000001'),customer:{...customer,phone:a.phone}})).status,201);
  const row=(await(await admin.request('/api/admin/customers.csv')).text()).trim().split('\r\n')[1];
  assert.ok(row.startsWith(`"'=HYPERLINK(""http://x"")",'+Lab,`),row);
});
