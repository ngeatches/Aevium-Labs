import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readSource } from './read-source.mjs';
import { wordmark, favicon } from './brand.mjs';
import { commerceShell, cartLauncher, ordersPage, adminPage, makeCommerceShell, makeOrdersPage, makeAdminPage } from './commerce/markup.mjs';
import { researchPage, privacyPage, liveResearchPage, livePrivacyPage, liveOrdering, livePolicies, liveContact } from './commerce/pages.mjs';
import { readFileSync, rmSync } from 'node:fs';
import { validateBusiness, validateCatalog } from './commerce/config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const original = await readSource(path.join(root, 'revamp.html'));
const { products, prose, store, hero, pillars } = original;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const money = value => '$' + Number(value).toFixed(2);
const arrow = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.5"/></svg>';
const categories = [...new Set(products.map(p => p.cat))];
const sourceBody = key => prose[key].body
  .replace(/\$\{esc\(STORE\.legalName\)\}/g, escape(store.legalName))
  .replace(/\$\{STORE\.(\w+)\}/g, (_,key)=>escape(store[key]))
  .replace(/(<(?:span|p)[^>]*data-store="supportEmail"[^>]*>)(<\/(?:span|p)>)/g, `$1${escape(store.supportEmail)}$2`);
// Top bar on every page: logo, product search (suggests matches on the home page; elsewhere it opens the
// catalog filtered by the search) and the customer Log in / account button.
const siteHeader = `<header class="site-header"><div class="site-header-inner wrap"><a class="site-header-brand" href="/" aria-label="Aevium Labs home"><img src="/assets/images/aevium-logo.webp" width="2106" height="557" alt="Aevium Labs"></a><form class="site-search" role="search" action="/" method="get"><label class="sr-only" for="site-search-input">Search products</label><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.6"/><path d="m16 16 5 5" stroke="currentColor" stroke-width="1.6"/></svg><input id="site-search-input" name="q" type="search" placeholder="Search" autocomplete="off" role="combobox" aria-autocomplete="list" aria-controls="site-search-results" aria-expanded="false"><div class="site-search-results" id="site-search-results" role="listbox" aria-label="Matching products" hidden></div></form><button class="site-header-account" type="button" data-open-customer-login><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8.5" r="4" stroke="currentColor" stroke-width="1.6"/><path d="M4.5 20.5c1.2-3.6 4.1-5.5 7.5-5.5s6.3 1.9 7.5 5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span data-header-account>Log in</span></button></div></header>`;
const skipLink = '<a class="skip-link" href="#main">Skip to content</a>' + siteHeader;
const footer = `<footer class="site-footer wrap"><div class="footer-top"><a href="/" class="footer-brand">${wordmark}</a><nav class="footer-nav" aria-label="Footer navigation"><a href="/#institutional">Institutional &amp; Bulk Orders</a><a href="/#policies">Policies</a><a href="/#contact">Contact</a></nav></div><div class="footer-bottom"><span>© 2026 ${escape(store.legalName)}. All rights reserved.</span><div><a href="/orders/">Your orders</a><a href="/admin/">Admin</a><a href="/research-use/">Research-use policy</a><a href="/privacy/">Data &amp; privacy</a><button class="motion-toggle" type="button" aria-pressed="false" aria-label="Pause motion"><span aria-hidden="true">Ⅱ</span> Motion</button><form action="/logout" method="post"><button type="submit">Lock preview</button></form></div></div></footer>`;
const head = (title, description) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="theme-color" content="#fafafa"><meta name="robots" content="noindex,nofollow"><title>${title}</title><meta name="description" content="${description}">${favicon}<link rel="preload" href="/assets/fonts/space-grotesk-variable.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/assets/css/styles.css"><script src="/assets/js/entry.js"></script><script src="/assets/js/main.js" defer></script><script src="/assets/js/commerce.js" defer></script></head><body>`;
const pending = '<span class="pending">Confirm on lot COA</span>';
const ruo = 'For laboratory research use only. Not for human or veterinary use. Not intended for diagnostic, therapeutic or clinical applications.';
function specs(p) {
  const rows = [
    ['Material', escape(p.name)], ['Amount per vial', escape(p.mg)], ['Classification', escape(p.type)],
    p.comp ? ['Components', escape(p.comp)] : null,
    p.seq ? ['Sequence', escape(p.seq)] : null,
    ['CAS number', p.cas ? escape(p.cas) : pending], ['Molecular formula', p.formula ? escape(p.formula) : pending],
    ['Molecular weight', p.mw ? escape(p.mw) : pending], ['Form','Lyophilized powder, sealed vial'],
    ['Purity specification','≥ 98% (RP-HPLC)'], ['Testing methodology','RP-HPLC purity · ESI-MS identity'],
    ['Lot number',pending], ['Certificate of analysis','<a href="#contact">Request lot COA</a>'],
    ['Recommended laboratory storage','−20 °C, protected from light and moisture'], ['Research classification','Research Use Only (RUO)']
  ].filter(Boolean);
  return `<div class="spec-content"><table class="spec-table"><caption class="sr-only">${escape(p.name)} specifications from the original draft</caption><tbody>${rows.map(([k,v])=>`<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('')}</tbody></table><p class="ruo-box">${ruo}</p></div>`;
}
const cardHtml = (p,i,prefix='material') => `<article class="product-card${prefix==='material'?'':' spotlight-card'}" id="${prefix}-${p.id}" data-id="${p.id}" data-name="${escape(p.name)}" data-amount="${escape(p.mg)}" data-category="${escape(p.cat)}" data-kind="${escape(p.type)}" data-cas="${escape(p.cas)}" data-price="${money(p.price)}" data-index="${i+1}"><details class="product-details"><summary class="product-visual" aria-label="View ${escape(p.name)} ${escape(p.mg)} specifications"><img src="/assets/images/products/${p.id}-640.webp" srcset="/assets/images/products/${p.id}-640.webp 640w, /assets/images/products/${p.id}-1024.webp 1024w" sizes="(max-width:600px) 90vw, (max-width:850px) 45vw, 29vw" width="1024" height="1024" loading="lazy" decoding="async" alt="Aevium Labs ${escape(p.name)}, ${escape(p.mg)} vial"></summary><div class="fallback-details"><p>${escape(p.cat)}</p><p class="product-reference">${escape(p.mg)} · lyophilized · ${p.cas ? 'CAS '+escape(p.cas) : 'Blend / see COA'}</p>${specs(p)}</div></details><div class="product-copy"><div class="product-meta-row"><div class="product-identity"><h3>${escape(p.name)}</h3><p class="product-amount">${escape(p.mg)}</p></div><div class="product-price">${money(p.price)} <span>per vial</span></div></div><div class="product-actions"><button class="product-spec-button" type="button" data-open-product="${p.id}" aria-label="Specifications for ${escape(p.name)} ${escape(p.mg)}" aria-haspopup="dialog" aria-controls="product-dialog">Specifications ${arrow}</button><button class="add-to-cart" type="button" data-add-product="${p.id}" aria-label="Add ${escape(p.name)} ${escape(p.mg)} to cart">Add to cart <span aria-hidden="true">+</span></button></div></div></article>`;
const cards = products.map((p,i)=>cardHtml(p,i)).join('\n');
// Spotlight section under the hero. Edit this list to change which products are featured.
const spotlightIds = ['bpc157-10','blend-gbt','tb500-10','nad-1000','blend-gbtk','tesamorelin-10'];
const spotlightCards = spotlightIds.map(id=>products.find(p=>p.id===id)).filter(Boolean).map((p,i)=>cardHtml(p,i,'spotlight')).join('\n');
const categoryOptions = ['All',...categories].map((cat,i)=>`<option value="${i===0?'all':escape(cat)}">${escape(cat)} (${i===0?products.length:products.filter(p=>p.cat===cat).length})</option>`).join('');
const categoryChoices = ['All',...categories].map((cat,i)=>{const count=i===0?products.length:products.filter(p=>p.cat===cat).length;return `<button type="button" class="category-choice" data-category-choice="${i===0?'all':escape(cat)}" aria-pressed="${i===0}"><span>${escape(cat)}</span><span class="category-choice-meta"><span>${count}<span class="sr-only"> ${count===1?'material':'materials'}</span></span><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4 10 4 4 8-8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>`}).join('');
const policyKeys = ['shipping','refunds','ruo','terms','privacy'];
const policySections = policyKeys.map(key=>`<details id="policy-${key}"><summary>${escape(prose[key].title)}<span aria-hidden="true">+</span></summary><div class="source-prose">${sourceBody(key)}</div></details>`).join('');
const faq = sourceBody('faq').replace(/<summary>([\s\S]*?)<\/summary>/g,'<summary>$1<span aria-hidden="true">+</span></summary>');
const heroIds = ['retatrutide-40','retatrutide-30'];
const infoPanel = (id, title, body) => `<details class="info-panel" id="${id}"><summary><h2>${title}</h2><span aria-hidden="true">+</span></summary><div class="info-body">${body}</div></details>`;
const qualityOverview = `<p class="draft-label">Original claims · Pending verification</p><div class="quality-points">${pillars.map(p=>`<div><h3>${p.title}</h3><p>${p.text}</p></div>`).join('')}</div><div class="source-prose quality-prose">${sourceBody('quality')}</div>`;
const quality = `${qualityOverview}<div class="document-layout" id="documentation"><div class="document-intro"><p class="eyebrow">Documentation</p>${original.documentBlock}</div><div class="coa-sample"><p class="draft-label">Sample from original mock-up · Not a lot report</p>${original.coa}<details class="hero-specification"><summary>Example specification sheet · BPC-157 · 10 mg<span aria-hidden="true">+</span></summary><p class="mono">CAS 137525-51-0</p><dl>${hero.specification}</dl></details></div></div>`;
const institutional = `<div class="source-prose">${original.institutional}${sourceBody('institutional')}<a class="text-link" href="#contact">Request a quote ${arrow}</a></div>`;
const ordering = `<p class="draft-label">Draft only · No live orders or payments accepted</p><ol class="ordering-steps">${original.steps}</ol><details class="payment-draft"><summary>How to pay — original draft<span aria-hidden="true">+</span></summary><div class="source-prose"><p class="draft-label">Payment details below are placeholders. Do not send payment.</p><dl class="payment-details"><dt>Send to (name)</dt><dd>${escape(store.zelleName)}</dd><dt>Zelle email</dt><dd>${escape(store.zelleEmail)}</dd><dt>Zelle phone</dt><dd>${escape(store.zellePhone)}</dd></dl><ol class="steps"><li><b>Open your bank's app</b> or the Zelle app and choose Send.</li><li><b>Enter the Zelle email or phone number above.</b> Confirm the recipient shows as <b>${escape(store.zelleName)}</b> before sending.</li><li><b>Send exactly [order total].</b> Put only your order number, <b>[order number]</b>, in the memo. Do not list product names.</li><li><b>We match your payment</b> to the order, review it, and email tracking and the lot COA when it ships.</li></ol><p>Zelle payments can't be reversed once sent, so check the recipient name carefully. Unpaid orders are released after ${store.holdHours} hours. Questions: <span class="mono">${escape(store.supportEmail)}</span></p></div></details>`;
const policies = `<p class="policy-context">Original draft text below describes the proposed store. The local order demo uses sample details; no live orders or payments are accepted.</p><a class="text-link" href="/privacy/">Current preview privacy ${arrow}</a><div class="policy-list">${policySections}</div>`;
const html = `${head('Aevium Labs — Research Peptides &amp; Analytical Materials','Aevium Labs — private review of the original catalog and draft content.')}${skipLink}
<main id="main"><div class="hero-stage"><section class="hero wrap" aria-labelledby="hero-title"><div class="hero-intro"><div class="hero-heading"><div class="hero-brand"><img class="hero-brand-emblem" src="/assets/images/flower-of-life-hero.webp" width="164" height="164" alt="" aria-hidden="true">${wordmark}</div><div class="hero-message"><h1 id="hero-title">${hero.title}</h1><p class="hero-lede">${hero.description}</p></div></div></div><div class="hero-actions"><a class="hero-action hero-catalog" href="#collection"><span class="hero-action-label"><span>Browse</span> <span>The catalog</span></span>${arrow}</a><a class="hero-action hero-testing" href="#quality" id="open-testing"><span class="hero-action-label"><span>How</span> <span>we</span> <span>test</span></span>${arrow}</a></div><div class="hero-showcase" aria-label="Featured research materials">${heroIds.map((id,i)=>{const p=products.find(p=>p.id===id);return `<div class="hero-tile-wrap"><a class="hero-tile" href="#material-${p.id}" data-open-product="${p.id}" aria-label="Explore ${escape(p.name)} ${escape(p.mg)}"><img src="/assets/images/products/${p.id}-640.webp" width="640" height="640" decoding="async" ${i===0?'fetchpriority="high"':''} alt="Aevium Labs ${escape(p.name)}, ${escape(p.mg)} vial"></a><div class="hero-tile-info"><p class="hero-tile-name">${escape(p.name)}</p><p class="hero-tile-amount">${escape(p.mg)}</p><p class="hero-tile-price" data-price-for="${p.id}">${money(p.price)}</p><button class="hero-tile-add" type="button" data-add-product="${p.id}" aria-label="Add ${escape(p.name)} ${escape(p.mg)} to cart">Add to cart <span aria-hidden="true">+</span></button></div></div>`}).join('')}</div></section>${spotlightCards ? `<section class="spotlight wrap" id="spotlight" aria-labelledby="spotlight-title"><div class="spotlight-head"><div class="catalog-heading spotlight-heading"><p class="eyebrow">Featured</p><h2 id="spotlight-title">Spotlight peptides</h2></div><div class="spotlight-controls"><button class="spotlight-button" type="button" data-spotlight="prev" aria-label="Previous spotlight peptide"><span aria-hidden="true">←</span></button><button class="spotlight-button" type="button" data-spotlight="pause" aria-pressed="false" aria-label="Pause spotlight rotation"><span aria-hidden="true">Ⅱ</span></button><button class="spotlight-button" type="button" data-spotlight="next" aria-label="Next spotlight peptide"><span aria-hidden="true">→</span></button></div></div><div class="spotlight-viewport"><div class="spotlight-track">${spotlightCards}</div></div></section>` : ''}</div>
<section class="collection wrap" id="collection" aria-labelledby="collection-title"><div class="catalog-header"><div class="catalog-heading"><h2 id="collection-title">Research materials</h2><p>All materials are supplied lyophilized, for in-vitro laboratory research only.</p></div><div class="catalog-tools"><label class="search-field"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="m16 16 5 5" stroke="currentColor" stroke-width="1.5"/></svg><input type="search" id="catalog-search" aria-label="Search materials" placeholder="Search name, category or CAS" autocomplete="off"></label><div class="category-field"><label id="category-native"><span class="sr-only">Filter research materials</span><select id="catalog-category">${categoryOptions}</select></label><button class="category-trigger" id="open-categories" type="button" aria-haspopup="dialog" aria-controls="category-dialog" hidden><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14M7 3v4m6 1v4m-6 1v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg><span id="category-label">All</span><span class="category-count" id="category-count">${products.length}</span><span class="sr-only"> — choose category</span></button></div></div></div><div class="catalog-status"><span id="result-count" role="status" aria-live="polite">${products.length} materials</span><span>Prices in USD · per vial</span></div><div class="product-grid">${cards}</div><div class="empty-state" hidden><h3>No materials found.</h3><button class="button button-green" type="button" id="clear-filters">Reset filters ${arrow}</button></div></section>
<section class="information wrap" aria-label="Research information">
${infoPanel('quality',escape(prose.quality.title),quality)}
${infoPanel('institutional',escape(prose.institutional.title),institutional)}
${infoPanel('questions',escape(prose.faq.title),`<div class="faq-list">${faq}</div>`)}
${infoPanel('ordering','How ordering works',ordering)}
${infoPanel('policies','Policies',policies)}
${infoPanel('contact',escape(prose.contact.title),`<p class="draft-label">Placeholder contact · Pending verification</p><div class="source-prose">${sourceBody('contact')}</div>`)}
</section><div class="source-footer-note wrap"><p>${original.footer}</p></div></main>${footer}
<dialog id="category-dialog" class="category-dialog" aria-labelledby="category-title"><div class="category-dialog-heading"><h2 id="category-title">Categories</h2><button class="commerce-close" type="button" id="close-categories" aria-label="Close categories">×</button></div><div class="category-options">${categoryChoices}</div></dialog>

<dialog id="product-dialog" aria-labelledby="dialog-title"><button type="button" class="dialog-close" aria-label="Close product details">×</button><div class="dialog-grid"><div class="dialog-image-panel"><div class="dialog-image"><img id="dialog-image" src="/assets/images/products/bpc157-10-1024.webp" width="1024" height="1024" alt=""></div><div class="dialog-image-caption"><span class="eyebrow">Aevium Labs</span><span class="dialog-amount" id="dialog-amount"></span></div></div><div class="dialog-copy"><div class="dialog-topline"><h2 id="dialog-title" aria-live="polite" aria-atomic="true"></h2><div class="dialog-price-row"><p id="dialog-price"></p><span>per vial</span></div></div><p class="dialog-subtitle">Research Material — <span id="dialog-subtitle-amount"></span></p><p class="spec-draft-note">Draft specifications. Verify every CAS / formula / MW against your supplier's lot COA.</p><button class="add-to-cart" type="button" id="dialog-add-product" data-add-product="bpc157-10">Add to cart <span aria-hidden="true">+</span></button><div id="dialog-specs"></div></div></div><div class="dialog-footer">${cartLauncher('product')}<div class="dialog-navigation"><button type="button" id="previous-product" aria-label="Previous material" aria-keyshortcuts="ArrowLeft" title="Previous material (left arrow)">←</button><span id="dialog-position"></span><button type="button" id="next-product" aria-label="Next material" aria-keyshortcuts="ArrowRight" title="Next material (right arrow)">→</button></div></div></dialog>
<dialog class="testing-dialog" id="testing-dialog" aria-labelledby="testing-title"><button class="testing-close" type="button" aria-label="Close testing information">×</button>${cartLauncher('testing')}<div class="testing-content"><h2 id="testing-title">How we test</h2>${qualityOverview}</div></dialog>
${commerceShell}<noscript><style>.catalog-tools,.motion-toggle,.hero-rotation-toggle,.product-actions,.add-to-cart,.cart-launcher{display:none}.product-details{display:block}</style></noscript></body></html>`;
await mkdir(path.join(root,'site/privacy'), { recursive:true });
await writeFile(path.join(root,'site/index.html'),html);
const privacy = `${head('Data & privacy — Aevium Labs', 'How the local Aevium Labs account and order demonstration handles data.')}${skipLink}${privacyPage}${footer}${commerceShell}</body></html>`;
await writeFile(path.join(root,'site/privacy/index.html'),privacy);
await writeFile(path.join(root,'site/robots.txt'),'User-agent: *\nDisallow: /\n');
console.log(`Built original draft copy, ${products.length} full specifications, ${categories.length} categories, policies, customer orders and admin checkout pages.`);

for (const [route, title, content] of [['orders', 'Your orders', ordersPage], ['admin', 'Order desk', adminPage], ['research-use', 'Research-use policy', researchPage]]) {
  await mkdir(path.join(root, 'site', route), { recursive: true });
  await writeFile(path.join(root, 'site', route, 'index.html'), `${head(title + ' — Aevium Labs', 'Local order workflow demonstration.')}${skipLink}${content}${footer}${commerceShell}</body></html>`);
}

// Live variant (site-live/): only built from approved config/business.json and config/catalog.json.
// Derived from the demo pages with asserted replacements so the approved layout stays identical;
// only prices, availability, ordering/payment, policy and contact content change.
const liveRoot = path.join(root, 'site-live');
const configPath = (name, fallback) => path.resolve(root, process.env[name] || fallback);
const readConfig = file => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };
const business = readConfig(configPath('BUSINESS_CONFIG', 'config/business.json'));
const liveCatalog = readConfig(configPath('CATALOG_CONFIG', 'config/catalog.json'));
const problems = [];
if (!business || !liveCatalog) problems.push('config/business.json and config/catalog.json not found');
else { validateBusiness(business, problems); validateCatalog(liveCatalog, products, problems); }
rmSync(liveRoot, { recursive: true, force: true });
if (problems.length) {
  console.log(`Live pages not built (${problems.length} configuration item(s) missing; see docs/DEPLOYMENT.md). Demo pages are unaffected.`);
} else {
  const swap = (text, from, to, label) => {
    if (!text.includes(from)) throw new Error(`Live build: expected fragment not found (${label}). Update scripts/build.mjs to match the template.`);
    return text.split(from).join(to);
  };
  const liveMoney = cents => '$' + (cents / 100).toFixed(2);
  const lockForm = '<form action="/logout" method="post"><button type="submit">Lock preview</button></form>';
  let liveFooter = swap(footer, `© 2026 ${escape(store.legalName)}. All rights reserved.`, `© ${new Date().getFullYear()} ${escape(business.businessName)}. All rights reserved.`, 'footer legal name');
  liveFooter = swap(liveFooter, '<a href="/admin/">Admin</a>', '', 'footer admin link');
  let page = swap(html, footer, liveFooter, 'footer');
  page = swap(page, commerceShell, makeCommerceShell(true), 'cart shell');
  page = swap(page, 'Aevium Labs — private review of the original catalog and draft content.', `${escape(business.businessName)} — research peptides and analytical materials for in-vitro laboratory research.`, 'meta description');
  page = swap(page, '<span>Prices in USD · per vial</span>', '<span>Prices in USD · per vial</span>', 'catalog status');
  page = swap(page, '<span>per vial</span>', '<span>per vial</span>', 'dialog price label');
  page = swap(page, ordering, liveOrdering(business), 'ordering');
  page = swap(page, policies, livePolicies(business), 'policies');
  page = swap(page, `<p class="draft-label">Placeholder contact · Pending verification</p><div class="source-prose">${sourceBody('contact')}</div>`, liveContact(business), 'contact');
  for (const [p, prefix] of [...products.map(p=>[p,'material']), ...spotlightIds.map(id=>[products.find(p=>p.id===id),'spotlight']).filter(([p])=>p)]) {
    const entry = liveCatalog.products[p.id];
    const start = page.indexOf(`id="${prefix}-${p.id}"`), end = page.indexOf('</article>', start);
    if (start < 0 || end < 0) throw new Error(`Live build: card ${prefix}-${p.id} not found.`);
    let card = page.slice(start, end);
    if (entry?.available) {
      card = swap(card, `data-price="${money(p.price)}"`, `data-price="${liveMoney(entry.priceCents)}"`, `${p.id} data price`);
      card = swap(card, `<div class="product-price">${money(p.price)} <span>per vial</span></div>`, `<div class="product-price">${liveMoney(entry.priceCents)} <span>per vial</span></div>`, `${p.id} price`);
    } else {
      card = swap(card, `data-price="${money(p.price)}"`, 'data-price="Unavailable"', `${p.id} data price`);
      card = swap(card, `<div class="product-price">${money(p.price)} <span>per vial</span></div>`, '<div class="product-price">Unavailable</div>', `${p.id} price`);
      card = swap(card, `<button class="add-to-cart" type="button" data-add-product="${p.id}"`, `<button class="add-to-cart" type="button" disabled aria-disabled="true" data-unavailable="${p.id}"`, `${p.id} add button`);
      card = card.replace('Add to cart <span aria-hidden="true">+</span>', 'Unavailable');
    }
    page = page.slice(0, start) + card + page.slice(end);
  }
  for (const id of heroIds) {
    const p = products.find(x => x.id === id), entry = liveCatalog.products[id];
    if (!p) continue;
    page = swap(page, `data-price-for="${id}">${money(p.price)}<`, `data-price-for="${id}">${entry?.available ? liveMoney(entry.priceCents) : 'Unavailable'}<`, `${id} hero price`);
    if (!entry?.available) page = swap(page, `<button class="hero-tile-add" type="button" data-add-product="${id}"`, `<button class="hero-tile-add" type="button" disabled aria-disabled="true" data-unavailable="${id}"`, `${id} hero add button`);
  }
  const shell = makeCommerceShell(true);
  const livePage = (title, description, content) => `${head(title, description)}${skipLink}${content}${liveFooter}${shell}</body></html>`;
  const pages = {
    'index.html': page,
    'privacy/index.html': livePage(`Data & privacy — ${escape(business.businessName)}`, `How ${escape(business.businessName)} handles customer data.`, livePrivacyPage(business)),
    'research-use/index.html': livePage(`Research-use policy — ${escape(business.businessName)}`, 'Research-use requirements for orders.', liveResearchPage(business)),
    'orders/index.html': livePage(`Your orders — ${escape(business.businessName)}`, 'View and pay for your orders.', makeOrdersPage(true)),
    'admin/index.html': livePage(`Order desk — ${escape(business.businessName)}`, 'Order administration.', makeAdminPage(true))
  };
  for (const [file, content] of Object.entries(pages)) {
    if (/LOCAL DEMO|Local demo|demo order/i.test(content.replace(/class="commerce-demo"/g, ''))) throw new Error(`Live build: demo wording remains in ${file}.`);
    await mkdir(path.dirname(path.join(liveRoot, file)), { recursive: true });
    await writeFile(path.join(liveRoot, file), content);
  }
  console.log(`Built live pages in site-live/ from business config approved ${business.approved.date} (policy ${business.policyVersion}).`);
}
