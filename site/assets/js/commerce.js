(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  const date = value => new Date(value).toLocaleString();
  const statuses = { awaiting_payment: 'Awaiting payment report', payment_reported: 'Payment reported · Needs review', approved: 'Approved · Preparing shipment', shipped: 'Shipped' };
  const storage = { get(key) { try { return localStorage.getItem(key); } catch { return null; } }, set(key, value) { try { localStorage.setItem(key, value); } catch {} }, remove(key) { try { localStorage.removeItem(key); } catch {} } };
  let config, catalog = [], cart = {}, checkoutOpen = false, lastCartFocus, challenge, orders = [];
  let loadingOrders = false, orderRequest = 0;
  const cartDialog = $('#cart-dialog');
  const customerDialog = $('#customer-login-dialog');
  let lastCustomerFocus, customerDialogRequest = 0;
  let activeDock, showAccountAfterLogin = false;
  const isAdminPage = !!$('#admin-login');
  // Demo mode keeps its explicit simulation wording; live mode (verified configuration) uses plain store wording.
  const isLive = () => config?.mode === 'live';
  const L = (demo, live) => isLive() ? live : demo;
  const maskPhone = phone => phone ? phone.slice(0, 2) + ' ••• ••• ' + phone.slice(-4) : '';
  let nextCursor = null, loadingMore = false;
  function readCart() {
    try { const data = JSON.parse(storage.get('pp-cart') || '{}'); cart = data && typeof data === 'object' && !Array.isArray(data) ? Object.fromEntries(Object.entries(data).filter(([id, q]) => /^[a-z0-9-]+$/.test(id) && Number.isInteger(q) && q > 0 && q <= 99)) : {}; } catch { cart = {}; }
    if (catalog.length) cart = Object.fromEntries(Object.entries(cart).filter(([id]) => catalog.some(p => p.id === id)));
  }
  async function api(url, body) {
    const response = await fetch(url, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || 'Unable to complete the request.'), { status: response.status });
    return data;
  }
  const lines = () => catalog.filter(p => cart[p.id]).map(p => ({ ...p, quantity: cart[p.id] }));
  const total = () => lines().reduce((n, p) => n + p.priceCents * p.quantity, 0);
  function count() { return Object.values(cart).reduce((n, q) => n + q, 0); }
  function syncCounters() {
    const n = count();
    $$('[data-cart-count]').forEach(e => e.textContent = n);
    $$('[data-cart-total]').forEach(e => e.textContent = money(total()));
    $$('[data-open-cart]').forEach(e => e.setAttribute('aria-label', `Open cart, ${n} ${n === 1 ? 'item' : 'items'}`));
    $$('.cart-summary').forEach(e => e.hidden = n === 0);
    $$('[data-menu-cart-count]').forEach(e => e.textContent = n ? `${n} ${n === 1 ? 'item' : 'items'}` : 'Your cart is empty');
    $$('[data-menu-cart-total]').forEach(e => e.hidden = n === 0);
    syncAccountMenus();
  }
  function syncAccountMenus() {
    const signedIn = !!config?.customer;
    $$('[data-account-profile], [data-account-links]').forEach(e => e.hidden = !signedIn);
    $$('.account-menu [data-open-customer-login]').forEach(e => e.hidden = signedIn);
    $$('[data-account-name]').forEach(e => e.textContent = config?.customer?.name || 'Your account');
    $$('[data-header-account]').forEach(e => { e.textContent = signedIn ? (config.customer.firstName || 'Account') : 'Log in'; e.closest('button')?.setAttribute('aria-label', signedIn ? 'Your account' : 'Log in or create an account'); });
    $$('[data-menu-cart]').forEach(e => e.hidden = !signedIn && count() === 0);
  }
  function launcherFocus(trigger) {
    const dock = trigger?.closest('.cart-launcher');
    if (dock && (!dock.closest('dialog') || dock.closest('dialog').open)) return dock.querySelector('[data-toggle-account]');
    return $('.cart-launcher:not(.cart-launcher-inline) [data-toggle-account]');
  }
  function closeAccountMenus(restoreFocus = false) {
    const previous = activeDock;
    $$('.account-menu').forEach(menu => menu.hidden = true);
    $$('[data-toggle-account]').forEach(button => button.setAttribute('aria-expanded', 'false'));
    activeDock = null;
    if (restoreFocus) previous?.querySelector('[data-toggle-account]').focus({ preventScroll: true });
  }
  function openAccountMenu(trigger) {
    const dock = trigger.closest('.cart-launcher');
    const wasOpen = activeDock === dock;
    closeAccountMenus();
    if (wasOpen || !dock) return;
    syncAccountMenus(); activeDock = dock;
    dock.querySelector('.account-menu').hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    dock.querySelector('.account-menu button:not([hidden])')?.focus({ preventScroll: true });
  }
  document.addEventListener('pointerdown', event => {
    if (activeDock && !activeDock.contains(event.target)) closeAccountMenus();
  });
  document.addEventListener('focusin', event => {
    if (activeDock && !activeDock.contains(event.target)) closeAccountMenus();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && activeDock) { event.preventDefault(); event.stopPropagation(); closeAccountMenus(true); }
  }, true);
  document.addEventListener('close', event => { if (activeDock && event.target.contains(activeDock)) closeAccountMenus(); }, true);
  function saveCart() { storage.set('pp-cart', JSON.stringify(cart)); storage.remove('pp-order-key'); syncCounters(); if (cartDialog?.open) renderCart(); }
  function announce(text) { if ($('#cart-announcement')) $('#cart-announcement').textContent = text; }
  function orderLines(items) {
    return `<ul class="order-lines">${items.map(p => `<li><div><strong>${escape(p.name)}</strong><span>${escape(p.amount)} · ${p.quantity} ${p.quantity === 1 ? 'vial' : 'vials'}</span></div><span>${money(p.priceCents * p.quantity)}</span></li>`).join('')}</ul>`;
  }
  const accountLabel = customer => customer?.email || customer?.phone || '';
  function customerLogin(showHeading = true) {
    const demo = !isLive();
    return `<section class="customer-login" data-method="phone">${showHeading ? '<h3>Sign in or create an account</h3>' : ''}<p class="commerce-note">${L('Use your phone number or email. This local demo shows the code on screen; nothing is sent.', 'Use your phone number or email. We’ll send you a 6-digit code.')}</p><div class="signin-method" role="group" aria-label="Sign in with"><button type="button" data-signin-method="phone" aria-pressed="true">Phone</button><button type="button" data-signin-method="email" aria-pressed="false">Email</button></div><form data-customer-phone><label>Phone number<input name="phone" type="tel" autocomplete="tel" value="${escape(L(config?.demoCustomerPhone || '+12025550198', ''))}" ${L('', 'placeholder="(555) 555-0123"')} required></label><button class="commerce-primary" type="submit">Send code</button>${L('', '<p class="commerce-fineprint">Message and data rates may apply.</p>')}</form><form data-customer-email hidden><label>Email address<input name="email" type="email" autocomplete="email" maxlength="254" ${demo ? 'value="researcher@example.test"' : 'placeholder="you@example.com"'} required></label><button class="commerce-primary" type="submit">Send code</button></form><form data-customer-code hidden><label>Verification code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label><p class="commerce-demo" data-customer-demo-code></p><button class="commerce-primary" type="submit">Verify & continue</button><button class="commerce-text" type="button" data-change-customer-phone>Use a different phone or email</button></form><p class="commerce-error" role="alert"></p></section>`;
  }
  // Asked once, right after the phone or email is verified, before the account can order.
  function latestBirthDate() {
    const d = new Date(); d.setFullYear(d.getFullYear() - (config?.signup?.minimumAge || 21));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function profileForm(showHeading = true) {
    const c = config.customer, age = config?.signup?.minimumAge || 21, roles = config?.signup?.roles || [];
    return `<section class="customer-login customer-profile">${showHeading ? '<h3>Welcome — one more step</h3>' : ''}<p class="commerce-note">Creating your account as <strong>${escape(accountLabel(c))}</strong></p><form data-customer-profile><div class="form-columns profile-names"><label>First name<input name="firstName" autocomplete="given-name" maxlength="60" value="${escape(c.firstName || '')}" required></label><label><span>Last name <span class="label-hint">(optional)</span></span><input name="lastName" autocomplete="family-name" maxlength="60" value="${escape(c.lastName || '')}"></label></div><label><span>Date of birth <span class="label-hint">(${age}+ required)</span></span><input name="birthDate" type="date" autocomplete="bday" min="1900-01-01" max="${latestBirthDate()}" value="${escape(c.birthDate || '')}" required></label><label>What best describes your role?<select name="role" required><option value="" ${c.role ? '' : 'selected'} disabled>Select your role…</option>${roles.map(r => `<option ${c.role === r ? 'selected' : ''}>${escape(r)}</option>`).join('')}</select></label><button class="commerce-primary profile-continue" type="submit" disabled>Continue</button><p class="commerce-fineprint">By continuing you confirm you are ${age} or older and agree to our <a href="/#policy-terms" target="_blank" rel="noopener">Terms</a>, <a href="/privacy/" target="_blank" rel="noopener">Privacy policy</a> and <a href="/research-use/" target="_blank" rel="noopener">Research-use policy</a>.</p></form><p class="commerce-error" role="alert"></p></section>`;
  }
  const needsProfile = () => !!config?.customer && !config.customer.profileComplete;
  function renderCustomerDialog() {
    if (!customerDialog?.open) return;
    $('#customer-login-title').textContent = needsProfile() ? 'Create your account' : config?.customer ? 'Your account' : 'Log in';
    $('#customer-login-body').innerHTML = needsProfile() ? profileForm(false) : config?.customer
      ? `<div class="customer-account"><p class="commerce-note">Signed in with <strong>${escape(accountLabel(config.customer))}</strong></p><div class="customer-account-actions"><a class="commerce-primary" href="/orders/">View your orders</a><button class="commerce-text" type="button" data-customer-logout>Sign out of customer account</button></div></div>`
      : customerLogin(false);
  }
  function syncCustomer() {
    syncAccountMenus();
    renderCustomerDialog();
    const host = $('#customer-account');
    if (host) host.innerHTML = needsProfile() ? profileForm() : config?.customer ? `<div class="customer-account"><span>Signed in as <strong>${escape(accountLabel(config.customer))}</strong></span><button type="button" class="commerce-text" data-customer-logout>Sign out of customer account</button></div>` : customerLogin();
    if (!config?.customer && $('#customer-orders')) { orders = []; $('#customer-orders').replaceChildren(); }
  }
  async function openCustomerDialog(trigger) {
    if (!customerDialog?.showModal) { location.assign('/orders/'); return; }
    if (!customerDialog.open) {
      lastCustomerFocus = launcherFocus(trigger);
      closeAccountMenus();
      $$('dialog[open]').forEach(d => d.close());
      customerDialog.showModal();
      document.body.classList.add('dialog-open');
      document.dispatchEvent(new Event('commerce:dialog'));
    }
    const request = ++customerDialogRequest;
    $('#customer-login-title').textContent = 'Log in';
    $('#customer-login-body').innerHTML = '<p class="commerce-note" role="status">Loading your account…</p>';
    $('[data-close-customer-login]').focus();
    try {
      const data = await api('/api/shop');
      if (request !== customerDialogRequest || !customerDialog.open) return;
      config = data; catalog = data.products; syncCustomer(); syncCounters();
      $('#customer-login-body input, #customer-login-body a')?.focus();
    } catch (error) {
      if (request !== customerDialogRequest || !customerDialog.open) return;
      $('#customer-login-body').innerHTML = `<p class="commerce-error" role="alert">${escape(error.message)}</p><button type="button" class="commerce-secondary" data-open-customer-login>Try again</button>`;
    }
  }
  if (customerDialog?.showModal) $$('[data-open-customer-login]').forEach(trigger => { trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-controls', customerDialog.id); });
  $('[data-close-customer-login]')?.addEventListener('click', () => customerDialog.close());
  customerDialog?.addEventListener('close', () => {
    customerDialogRequest++;
    $('#customer-login-body').replaceChildren();
    if (!$('dialog[open]')) {
      document.body.classList.remove('dialog-open');
      const trigger = launcherFocus(lastCustomerFocus);
      trigger?.focus({ preventScroll: true });
      if (showAccountAfterLogin && trigger) openAccountMenu(trigger);
    }
    showAccountAfterLogin = false;
    document.dispatchEvent(new Event('commerce:dialog'));
  });
  customerDialog?.addEventListener('click', event => {
    if (event.target !== customerDialog) return;
    const b = customerDialog.getBoundingClientRect();
    if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) customerDialog.close();
  });
  function emailStatus(status) {
    return ({ preview: 'Captured locally · Not sent', pending: L('Preparing preview', 'Queued'), sending: 'Sending', accepted: 'Accepted by email provider', sent: 'Sent', delayed: 'Delivery delayed', delivered: 'Delivered', bounced: 'Bounced', complained: 'Marked as spam', failed: 'Needs retry', suppressed: 'Not sent · suppressed', needs_review: 'Needs review' })[status] || status;
  }
  function emailPreviews(emails, admin = false) {
    return emails.length ? emails.map(m => `<details class="email-preview"><summary><span>${escape(m.subject)}</span><small>${emailStatus(m.status)}</small></summary><div class="email-preview-body">${admin ? `<p><b>To:</b> ${escape(m.recipient)} · Attempt ${m.attempts}${m.providerId ? ` · Provider ID ${escape(m.providerId)}` : ''}${m.lastEvent ? ` · Last event ${escape(m.lastEvent)} ${escape(date(m.lastEventAt))}` : ''}</p>${m.error ? `<p class="commerce-error">${escape(m.error)}</p>` : ''}` : ''}<pre>${escape(m.text)}</pre>${admin && ['failed', 'needs_review'].includes(m.status) ? `<button type="button" class="commerce-secondary" data-retry-email="${m.id}">${L('Retry email preview', m.status === 'needs_review' ? 'Retry — confirmed not sent' : 'Retry email')}</button>` : ''}</div></details>`).join('') : `<p class="commerce-note">${L('No email previews yet.', 'No emails yet.')}</p>`;
  }
  async function loadAdminEmails(force = false) {
    if (!isAdminPage || !config?.admin || !$('#admin-emails')) return;
    if (!force && $('#admin-emails').querySelector('details[open]')) return;
    try { const result = await api('/api/admin/emails'); if (config?.admin) $('#admin-emails').innerHTML = emailPreviews(result.emails, true); }
    catch (error) { if (config?.admin) $('#admin-emails').textContent = error.message; }
  }
  function renderCart() {
    if (!$('#cart-body')) return;
    if (!config) { $('#cart-body').innerHTML = '<p>Enter the private preview to use the cart.</p><a class="commerce-primary" href="/login">Enter preview</a>'; return; }
    const items = lines();
    if (!items.length) { checkoutOpen = false; $('#cart-body').innerHTML = `<div class="cart-empty"><h3>Your cart is empty.</h3><p>Add a material to begin.</p><a href="/#collection" class="commerce-primary" data-cart-catalog>Browse the catalog</a></div><a class="text-link" href="/orders/">${L('View your demo orders', 'View your orders')}</a>`; return; }
    if (checkoutOpen) {
      if (!config.customer) { $('#cart-body').innerHTML = '<button class="commerce-text" type="button" data-back-cart>← Back to cart</button>' + customerLogin(); return; }
      if (needsProfile()) { $('#cart-body').innerHTML = '<button class="commerce-text" type="button" data-back-cart>← Back to cart</button>' + profileForm(); return; }
      $('#cart-body').innerHTML = `<button type="button" class="commerce-text" data-back-cart>← Back to cart</button>${orderLines(items)}${L(`<div class="cart-total"><span>Demo total</span><strong>${money(total())}</strong></div><p class="commerce-note">Draft product total. No shipping, taxes or payment are charged in this demo.</p>`, `${config.shipping?.flatFeeCents ? `<div class="cart-total"><span>Shipping</span><strong>${money(config.shipping.flatFeeCents)}</strong></div>` : ''}<div class="cart-total"><span>Total</span><strong>${money(total() + (config.shipping?.flatFeeCents || 0))}</strong></div><p class="commerce-note">${escape(config.business?.taxStatement || '')}</p>`)}<form id="order-form"><div class="form-heading"><h3>Shipping details</h3>${L('<button type="button" class="commerce-text" data-demo-details>Use sample details</button>', '')}</div><label>Full name<input name="name" autocomplete="name" maxlength="100" value="${escape(config.customer.name || '')}" required></label>${config.customer.phone ? `<label>Phone number<input name="phone" type="tel" value="${escape(config.customer.phone)}" readonly autocomplete="tel" required></label>` : `<label><span>Phone number <span class="label-hint">(for shipping updates)</span></span><input name="phone" type="tel" autocomplete="tel" maxlength="20" placeholder="(555) 555-0123" required></label>`}<label>Email<input name="email" type="email" autocomplete="email" maxlength="180" ${config.customer.email ? `value="${escape(config.customer.email)}" readonly` : ''} required></label><label>Street address<input name="address" autocomplete="street-address" maxlength="180" required></label><div class="form-columns"><label>City<input name="city" autocomplete="address-level2" maxlength="90" required></label><label>State / region<input name="region" autocomplete="address-level1" maxlength="80" required></label><label>Postal code<input name="postal" autocomplete="postal-code" maxlength="20" required></label><label>Country<input name="country" autocomplete="country-name" maxlength="80" required${isLive() && config.shipping?.countries?.length === 1 ? ` value="${escape(config.shipping.countries[0])}"` : ''}></label></div><fieldset class="checkout-zelle"><legend>Payment: Checkout with Zelle</legend><ol class="zelle-steps"><li>Enter the Zelle email or phone number you’ll pay from (below).</li><li>Check the research-use boxes and tap <strong>Place order</strong>. Your order is placed and <strong>pending payment</strong>.</li><li>Your <strong>order number</strong> and our Zelle details appear on the next screen, and a copy is emailed to you.</li><li>Send the exact total by Zelle with <strong>only your order number</strong> in the memo. Do not add product names or other notes.</li></ol><label>Your Zelle email or phone number (used to confirm your payment)<input name="zelleSender" maxlength="120" required placeholder="email@example.com or 555-123-4567" autocomplete="off"></label></fieldset><fieldset class="checkout-policies"><legend>Research-use acknowledgments</legend><p class="commerce-note">${L('Local demo only. Review the', 'Review the')} <a href="/research-use/" target="_blank" rel="noopener">research-use policy</a> and <a href="/privacy/" target="_blank" rel="noopener">data policy</a>.</p>${Object.entries(config.acknowledgments).map(([key,text])=>`<label class="check-label"><input type="checkbox" name="ack_${key}" required><span>${escape(text)}</span></label>`).join('')}</fieldset><p class="commerce-note">We use your email for order and shipment updates. No marketing signup.</p><button class="commerce-primary" type="submit">${L('Place demo order', 'Place order')} <span>→</span></button><p class="commerce-note">${L('Next: simulate a Zelle payment report for administrator review.', 'Next: you’ll see Zelle payment instructions, and we’ll email them to you.')}</p></form>`;
      return;
    }
    $('#cart-body').innerHTML = `<ul class="cart-lines">${items.map(p => `<li><img src="/assets/images/products/${p.id}-640.webp" width="88" height="88" alt=""><div class="cart-line-copy"><h3>${escape(p.name)}</h3><p>${escape(p.amount)}</p><div class="quantity-control"><button type="button" data-quantity="-1" data-product="${p.id}" aria-label="Remove one ${escape(p.name)} ${escape(p.amount)}">−</button><span aria-label="${p.quantity} vials">${p.quantity}</span><button type="button" data-quantity="1" data-product="${p.id}" aria-label="Add one ${escape(p.name)} ${escape(p.amount)}" ${p.quantity >= 99 ? 'disabled' : ''}>+</button></div></div><div class="cart-line-price"><strong>${money(p.priceCents * p.quantity)}</strong><button type="button" class="commerce-text" data-remove-product="${p.id}">Remove</button></div></li>`).join('')}</ul><div class="cart-total"><span>${L('Demo total', 'Subtotal')}</span><strong>${money(total())}</strong></div><button type="button" class="commerce-primary" data-checkout>Order <span>→</span></button><div class="cart-footer-links"><button type="button" class="commerce-text" data-clear-cart>Clear cart</button><a class="text-link" href="/orders/">${L('Your demo orders', 'Your orders')}</a></div>`;
  }
  async function openCart(trigger) {
    lastCartFocus = launcherFocus(trigger);
    closeAccountMenus();
    $$('dialog[open]').forEach(d => d.close());
    renderCart(); cartDialog.showModal(); document.body.classList.add('dialog-open');
    document.dispatchEvent(new Event('commerce:dialog')); $('[data-close-cart]').focus();
  }
  $('[data-close-cart]')?.addEventListener('click', () => cartDialog.close());
  cartDialog?.addEventListener('close', () => {
    if (!$('dialog[open]')) document.body.classList.remove('dialog-open');
    const target = launcherFocus(lastCartFocus);
    target?.focus({ preventScroll: true }); document.dispatchEvent(new Event('commerce:dialog'));
  });
  cartDialog?.addEventListener('click', e => {
    if (e.target !== cartDialog) return;
    const b = cartDialog.getBoundingClientRect();
    if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) cartDialog.close();
  });
  document.addEventListener('click', async event => {
    const target = event.target.closest('button,a'); if (!target) return;
    if (target.matches('[data-toggle-account]')) { openAccountMenu(target); return; }
    if (target.matches('[data-open-customer-login]')) { event.preventDefault(); openCustomerDialog(target); return; }
    if (target.matches('[data-signin-method]')) {
      const host = target.closest('.customer-login'), method = target.dataset.signinMethod;
      host.dataset.method = method; delete host.dataset.challenge;
      host.querySelectorAll('[data-signin-method]').forEach(b => b.setAttribute('aria-pressed', String(b === target)));
      host.querySelector('[data-customer-phone]').hidden = method !== 'phone';
      host.querySelector('[data-customer-email]').hidden = method !== 'email';
      host.querySelector('[data-customer-code]').hidden = true;
      host.querySelector('.commerce-error').textContent = '';
      host.querySelector(method === 'phone' ? '[name="phone"]' : '[name="email"]').focus(); return;
    }
    if (target.matches('[data-change-customer-phone]')) {
      const host = target.closest('.customer-login');
      delete host.dataset.challenge;
      host.querySelector('[data-customer-code]').hidden = true;
      host.querySelector('.signin-method').hidden = false;
      host.querySelector(host.dataset.method === 'email' ? '[data-customer-email]' : '[data-customer-phone]').hidden = false;
      host.querySelector('.commerce-error').textContent = '';
      host.querySelector(host.dataset.method === 'email' ? '[name="email"]' : '[name="phone"]').focus(); return;
    }
    if (target.matches('[data-open-cart]')) { openCart(target); return; }
    if (target.matches('[data-add-product]')) {
      const product = catalog.find(p => p.id === target.dataset.addProduct);
      if (!product) { announce('The cart is unavailable. Enter the preview or refresh the page.'); return; }
      if ((cart[product.id] || 0) >= 99) { announce('The demo limit is 99 vials per product.'); return; }
      cart[product.id] = (cart[product.id] || 0) + 1; saveCart(); announce(`${product.name}, ${product.amount} added. ${count()} items in your cart.`);
      target.classList.add('is-added'); const original = target.innerHTML; target.textContent = 'Added ✓'; target.disabled = true;
      setTimeout(() => { target.innerHTML = original; target.disabled = false; target.classList.remove('is-added'); }, 800); return;
    }
    if (target.matches('[data-quantity]')) {
      const id = target.dataset.product; const amount = Number(target.dataset.quantity); cart[id] = Math.max(0, Math.min(99, (cart[id] || 0) + amount)); if (!cart[id]) delete cart[id]; saveCart();
      const replacement = $(`[data-product="${id}"][data-quantity="${amount}"]`); (replacement || $('#cart-title')).focus(); return;
    }
    if (target.matches('[data-remove-product]')) { delete cart[target.dataset.removeProduct]; saveCart(); return; }
    if (target.matches('[data-clear-cart]')) { cart = {}; saveCart(); return; }
    if (target.matches('[data-checkout]')) { checkoutOpen = true; renderCart(); $('#cart-body input')?.focus(); return; }
    if (target.matches('[data-back-cart]')) { checkoutOpen = false; renderCart(); return; }
    if (target.matches('[data-cart-catalog]')) { cartDialog.close(); return; }
    if (target.matches('[data-demo-details]')) {
      const sample = { name: 'Demo Research Lab', email: 'demo@example.test', zelleSender: 'demo@example.test', address: '123 Example Street', city: 'Example City', region: 'MI', postal: '00000', country: 'United States' };
      if (!$('#order-form').elements.namedItem('phone').readOnly) sample.phone = '(202) 555-0100';
      for (const [name, value] of Object.entries(sample)) { const field = $('#order-form').elements.namedItem(name); if (!field.readOnly) field.value = value; }
      return;
    }
    if (target.matches('[data-refresh-customers]')) { target.disabled = true; await loadAdminCustomers(); target.disabled = false; return; }
    if (target.matches('[data-refresh-orders]')) { target.disabled = true; await loadOrders(true); target.disabled = false; return; }
    if (target.matches('[data-customer-logout]')) {
      try { await api('/api/customer/auth/logout', {}); config.customer = null; storage.remove('pp-order-key'); storage.set('pp-account-update', String(Date.now())); syncCustomer(); if (activeDock) activeDock.querySelector('[data-open-customer-login]').focus(); if (customerDialog?.open) $('#customer-login-body input')?.focus(); if (cartDialog?.open) renderCart(); }
      catch (error) { announce(error.message); } return;
    }
    if (target.matches('[data-load-emails]')) {
      target.disabled = true;
      const host = target.closest('.order-email-section').querySelector('.order-email-content');
      try { const result = await api(`/api/${isAdminPage ? 'admin/' : ''}orders/${target.dataset.loadEmails}/emails`); host.innerHTML = emailPreviews(result.emails); }
      catch (error) { host.textContent = error.message; } finally { target.disabled = false; } return;
    }
    if (target.matches('[data-retry-email]')) {
      target.disabled = true;
      try { await api(`/api/admin/emails/${target.dataset.retryEmail}/retry`, {}); await loadAdminEmails(true); }
      catch (error) { announce(error.message); target.disabled = false; } return;
    }
    if (target.matches('[data-refresh-emails]')) { await loadAdminEmails(true); return; }
    if (target.matches('[data-load-more-orders]')) { await loadMoreOrders(target); return; }
    if (target.matches('[data-receipt]')) { downloadReceipt(orders.find(o => o.id === target.dataset.receipt)); return; }
  });
  document.addEventListener('input', event => { const form = event.target.closest('form'); if (form) form.dataset.dirty = 'true'; });
  // Continue stays disabled until every required profile answer is valid (date in range, role chosen).
  document.addEventListener('input', event => { const form = event.target.closest('[data-customer-profile]'); if (form) form.querySelector('.profile-continue').disabled = !form.checkValidity(); });
  document.addEventListener('change', event => { const form = event.target.closest('[data-customer-profile]'); if (form) form.querySelector('.profile-continue').disabled = !form.checkValidity(); });
  function afterAccountReady() {
    syncCustomer(); syncAccountMenus();
    if (cartDialog?.open) { renderCart(); $('#cart-body input:not([readonly])')?.focus(); }
    if (customerDialog?.open) { showAccountAfterLogin = true; customerDialog.close(); announce('Signed in. Your account is ready.'); }
  }
  document.addEventListener('submit', async event => {
    const form = event.target;
    if (!form.matches('[data-customer-phone],[data-customer-email],[data-customer-code],[data-customer-profile]')) return;
    event.preventDefault(); const host = form.closest('.customer-login'), error = host.querySelector('.commerce-error'), button = form.querySelector('button[type="submit"]');
    button.disabled = true; error.textContent = '';
    try {
      if (form.matches('[data-customer-phone],[data-customer-email]')) {
        const byEmail = form.matches('[data-customer-email]');
        const value = byEmail ? form.elements.email.value.trim() : form.elements.phone.value;
        const result = await api('/api/customer/auth/start', byEmail ? { email: value } : { phone: value });
        host.dataset.challenge = result.challenge;
        const codeForm = host.querySelector('[data-customer-code]'); codeForm.hidden = false; codeForm.reset();
        form.hidden = true; host.querySelector('.signin-method').hidden = true;
        const minutes = Math.round(result.expiresIn / 60);
        host.querySelector('[data-customer-demo-code]').textContent = result.demoCode
          ? `Demo code: ${result.demoCode} · expires in ${minutes} minutes. Nothing was sent.`
          : byEmail ? `We emailed a code to ${value}. It expires in ${minutes} minutes. Check your spam folder if you don’t see it.` : `We texted a code to ${maskPhone(value.replace(/[^\d+]/g, ''))}. It expires in ${minutes} minutes.`;
        codeForm.elements.code.focus();
      } else if (form.matches('[data-customer-code]')) {
        const result = await api('/api/customer/auth/verify', { challenge: host.dataset.challenge, code: form.elements.code.value });
        config.customer = result.customer; storage.remove('pp-order-key'); storage.set('pp-account-update', String(Date.now()));
        if (needsProfile()) {
          host.outerHTML = profileForm(!customerDialog?.contains(host));
          if (customerDialog?.open) $('#customer-login-title').textContent = 'Create your account';
          $('[data-customer-profile] input')?.focus();
          await loadOrders(true); return;
        }
        afterAccountReady(); await loadOrders(true);
      } else {
        const data = Object.fromEntries(new FormData(form));
        const result = await api('/api/customer/profile', { firstName: data.firstName, lastName: data.lastName, birthDate: data.birthDate, role: data.role, accepted: true });
        config.customer = result.customer; storage.set('pp-account-update', String(Date.now()));
        afterAccountReady();
      }
    } catch (e) { error.textContent = e.message; } finally { if (form.isConnected) button.disabled = form.matches('[data-customer-profile]') ? !form.checkValidity() : false; }
  });
  document.addEventListener('submit', async event => {
    const form = event.target;
    if (form.id !== 'order-form' && !form.matches('[data-payment-form],[data-approve-form],[data-reject-form],[data-ship-form],[data-phone-change-form]')) return;
    event.preventDefault(); const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
    const errorNode = form.id === 'order-form' ? $('#cart-error') : form.querySelector('.commerce-error'); errorNode.textContent = '';
    const data = Object.fromEntries(new FormData(form));
    try {
      if (form.id === 'order-form') {
        let idempotencyKey = storage.get('pp-order-key'); if (!idempotencyKey) { idempotencyKey = crypto.randomUUID(); storage.set('pp-order-key', idempotencyKey); }
        const result = await api('/api/orders', { items: lines().map(p => ({ id: p.id, quantity: p.quantity })), customer: data, idempotencyKey, policyVersion: config.policyVersion, acknowledgments: Object.fromEntries(Object.keys(config.acknowledgments).map(key => [key, data['ack_' + key] === 'on'])) });
        cart = {}; saveCart(); location.assign('/orders/#' + result.order.id); return;
      }
      const id = form.dataset.order;
      if (form.matches('[data-payment-form]')) await api(`/api/orders/${id}/payment`, { confirmed: data.confirmed === 'on', reference: data.reference });
      if (form.matches('[data-approve-form]')) await api(`/api/admin/orders/${id}/approve`, { confirmed: data.confirmed === 'on', reference: data.bankReference, amountCents: Math.round(Number(data.amount) * 100) });
      if (form.matches('[data-reject-form]')) await api(`/api/admin/orders/${id}/reject`, { note: data.note });
      if (form.matches('[data-phone-change-form]')) { const result = await api('/api/admin/customers/phone', { orderId: id, newPhone: data.newPhone, note: data.note, confirmed: data.confirmed === 'on' }); announce(`Account phone changed to ${maskPhone(result.phone)}.`); }
      if (form.matches('[data-ship-form]')) {
        const file = form.elements.namedItem('proof').files[0]; let proof;
        if (file) {
          if (file.size > 4_000_000) throw new Error('Proof must be at most 4 MB.');
          const encoded = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result.split(',')[1]); r.onerror = () => reject(new Error('Could not read the file.')); r.readAsDataURL(file); });
          proof = { name: file.name, data: encoded };
        }
        await api(`/api/admin/orders/${id}/ship`, { carrier: data.carrier, tracking: data.tracking, reference: data.reference, note: data.note, proof });
      }
      storage.set('pp-order-update', String(Date.now())); await loadOrders(true);
    } catch (error) {
      errorNode.textContent = error.message;
      if (error.status === 401 && form.id === 'order-form') { config.customer = null; renderCart(); }
      if (error.status === 403 && form.id === 'order-form' && config.customer) { config.customer.profileComplete = false; renderCart(); }
    } finally { if (submit.isConnected) submit.disabled = false; }
  });
  // Zelle payment notice: steps, warnings and one-tap copy fields.
  function copyField(label, value, display) {
    return `<div class="zelle-field"><span class="zelle-label">${escape(label)}</span><div class="zelle-copy-row"><output class="zelle-value">${escape(display ?? value)}</output><button type="button" class="zelle-copy" data-copy="${escape(value)}" aria-label="Copy ${escape(label)}">Copy</button></div></div>`;
  }
  function zelleNotice(order, live) {
    const id = escape(order.id), z = order.instructions, total = money(order.totalCents);
    const handle = z.recipientHandle || z.recipientEmail || '';
    const demo = live ? '' : `<p class="commerce-demo">Demo only: this sample recipient cannot receive money. Do not send funds.</p>`;
    return `<section class="payment-step zelle-notice"><h3>Zelle Notice</h3>${demo}
<p class="zelle-intro"><strong>Note:</strong> If you don’t have Zelle yet, it’s built into most US banking apps. You can also <a href="https://www.zellepay.com/" target="_blank" rel="noopener">download the Zelle app</a>. Then follow these steps:</p>
<ol class="zelle-steps"><li>Copy the <strong>Payment Reference / Order Number</strong> below.</li><li>Open Zelle and send <strong>exactly ${total}</strong> to the Zelle name and email below.</li><li>In the memo, enter <strong>only your order number</strong>. Do not add product names or any other notes.</li><li>Come back here and tap <strong>“I’ve sent payment.”</strong></li></ol>
<p class="zelle-after">Once your payment arrives, we receive a notification. After we confirm it, we’ll ship your order and email you the tracking details. Thank you for your order!</p>
<p class="zelle-send">Send: <strong>${total}</strong> to <strong>${escape(handle)}</strong>${order.customer?.zelleSender ? ` from your Zelle account <strong>${escape(order.customer.zelleSender)}</strong>` : ''}</p>
<div class="zelle-fields">${copyField('Zelle Name', z.recipientName)}${copyField(live ? 'Zelle Email / Phone' : 'Zelle Email', handle)}${copyField('Payment Reference / Order Number', order.id)}${copyField('Amount', (order.totalCents / 100).toFixed(2), total)}</div>
${order.payment?.note ? `<p class="commerce-error">Review note: ${escape(order.payment.note)}</p>` : ''}<form data-payment-form data-order="${id}"><label>Zelle confirmation number (optional)<input name="reference" maxlength="120"></label><label class="check-label"><input type="checkbox" name="confirmed" required><span>${live ? 'I sent the exact total by Zelle with my order number as the memo. I understand my order ships after payment is confirmed.' : 'I understand this is a simulated payment report, subject to admin verification.'}</span></label><button class="commerce-primary" type="submit">${live ? 'I’ve sent payment' : 'I’ve sent payment — demo'}</button><p class="commerce-error" role="alert"></p></form></section>`;
  }
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-copy]'); if (!button) return;
    const value = button.getAttribute('data-copy'), done = () => { button.textContent = 'Copied'; button.classList.add('copied'); setTimeout(() => { button.textContent = 'Copy'; button.classList.remove('copied'); }, 1600); };
    try { await navigator.clipboard.writeText(value); done(); }
    catch { const out = button.parentElement.querySelector('.zelle-value'); const r = document.createRange(); r.selectNodeContents(out); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); try { document.execCommand('copy'); done(); } catch {} }
  });
  function orderCard(order, admin) {
    const id = escape(order.id), c = order.customer, s = order.shipping;
    let action = '';
    if (!admin && order.status === 'awaiting_payment') action = zelleNotice(order, isLive());
    if (!admin && order.status === 'payment_reported') action = `<p class="order-status-note">${L('Your payment report is awaiting administrator review. It is not a bank confirmation.', 'Thanks — we’ll confirm your order once the payment appears in our bank account.')}</p>`;
    if (!admin && order.status === 'approved') action = `<p class="order-status-note">${L('The administrator approved this demo order. Shipping details and an email preview will appear here after fulfillment.', 'Payment confirmed. We’re preparing your order and will email tracking details when it ships.')}</p>`;
    if (admin && order.status === 'payment_reported') action = `<section class="payment-step"><h3>Payment review</h3><p>Customer’s Zelle: <strong>${escape(order.customer?.zelleSender || 'Not provided')}</strong> · Expected: <strong>${money(order.totalCents)}</strong> with memo <strong>${id}</strong></p><p>Customer-reported reference: <strong>${escape(order.payment?.reference || 'No reference provided')}</strong></p><form data-approve-form data-order="${id}"><div class="form-columns"><label>Amount received (USD)<input type="number" name="amount" min="0.01" step="0.01" required placeholder="${(order.totalCents / 100).toFixed(2)}"></label><label>Bank verification reference<input name="bankReference" maxlength="120" required placeholder="${L('Demo receipt reference', 'Bank transaction reference')}"></label></div><label class="check-label"><input type="checkbox" name="confirmed" required><span>${L('I independently verified the simulated recipient, amount and reference, and approve fulfillment.', 'I confirmed this exact amount arrived in the business bank account and approve fulfillment.')}</span></label><button class="commerce-primary" type="submit">Approve order</button><p class="commerce-error" role="alert"></p></form><details class="return-payment"><summary>Return for correction</summary><form data-reject-form data-order="${id}"><label>Reason<input name="note" maxlength="500" required></label><button class="commerce-secondary" type="submit">Return payment report</button><p class="commerce-error" role="alert"></p></form></details></section>`;
    if (admin && order.status === 'approved') action = `<form class="shipping-form" data-ship-form data-order="${id}"><h3>Shipping & proof of order</h3><div class="form-columns"><label>Carrier<input name="carrier" maxlength="60" required></label><label>Tracking number<input name="tracking" maxlength="120" required></label></div><label>Fulfillment reference<input name="reference" maxlength="120" required></label><label>Note to customer<textarea name="note" maxlength="1000" rows="3"></textarea></label><label>Proof file (optional, PDF / PNG / JPEG, up to 4 MB)<input name="proof" type="file" accept="application/pdf,image/png,image/jpeg"></label><button class="commerce-primary" type="submit">Confirm shipment & queue email</button><p class="commerce-error" role="alert"></p></form>`;
    const progressIndex = ['awaiting_payment','payment_reported','approved','shipped'].indexOf(order.status);
    const progress = `<ol class="order-progress" aria-label="Order progress">${['Order received','Payment reported','Payment verified','Shipment recorded'].map((text,i)=>`<li class="${i <= progressIndex ? 'is-complete' : ''}" ${i === progressIndex ? 'aria-current="step"' : ''}><span>${i+1}</span>${text}</li>`).join('')}</ol>`;
    const phoneChange = admin && c.phone ? `<details class="return-payment"><summary>Change account phone</summary><p class="commerce-note">Use only after verifying the customer’s identity outside the site, for example by order number, email and shipping address. Their current sign-ins end immediately.</p><form data-phone-change-form data-order="${id}"><label>New phone number<input name="newPhone" type="tel" autocomplete="off" required></label><label>How you verified the customer<input name="note" maxlength="500" required></label><label class="check-label"><input type="checkbox" name="confirmed" required><span>I verified this customer’s identity and approve moving the account to the new number.</span></label><button class="commerce-secondary" type="submit">Change account phone</button><p class="commerce-error" role="alert"></p></form></details>` : '';
    const research = admin ? `<details class="order-history"><summary>Research-use acknowledgment</summary>${order.policy ? `<p>Version ${escape(order.policy.version)} · ${escape(date(order.policy.acceptedAt))}</p><ul>${Object.values(order.policy.statements).map(text=>`<li>${escape(text)}</li>`).join('')}</ul>` : '<p>Legacy demo record created before account/policy capture.</p>'}</details>` : '';
    const emails = `<section class="order-email-section"><div class="form-heading"><h3>Email updates</h3><button type="button" class="commerce-text" data-load-emails="${id}">${L('View email previews', 'View emails')}</button></div><p class="commerce-note">${order.emails?.length || 0} update(s) ${L('queued automatically. Local capture only; no email is sent.', `sent automatically to ${escape(c.email)}.`)}</p><div class="order-email-content"></div></section>`;
    const shipping = s ? `<section class="shipping-summary"><h3>Shipping details</h3><dl><dt>Carrier</dt><dd>${escape(s.carrier)}</dd><dt>Tracking number</dt><dd>${escape(s.tracking)}</dd><dt>Fulfillment reference</dt><dd>${escape(s.reference)}</dd><dt>Added</dt><dd>${escape(date(s.shippedAt))}</dd></dl>${s.note ? `<p>${escape(s.note)}</p>` : ''}<div class="order-links"><button class="commerce-secondary" type="button" data-receipt="${id}">Download order confirmation</button>${order.hasProof ? `<a class="commerce-secondary" href="/api/${admin ? 'admin/' : ''}orders/${id}/proof" download>Download proof file</a>` : ''}</div></section>` : '';
    return `<article class="order-card" id="${id}"><div class="order-card-heading"><div><p class="eyebrow">${L('Demo order', 'Order')} · ${escape(date(order.created))}</p><h2>${id}</h2></div><span class="order-badge status-${order.status}">${statuses[order.status]}</span></div>${progress}${orderLines(order.items)}${order.shippingCents ? `<div class="cart-total"><span>Shipping</span><strong>${money(order.shippingCents)}</strong></div>` : ''}<div class="cart-total"><span>${L('Demo total', 'Total')}</span><strong>${money(order.totalCents)}</strong></div><details class="order-address"><summary>Shipping address</summary><address>${escape(c.name)}<br>${escape(c.address)}<br>${escape(c.city)}, ${escape(c.region)} ${escape(c.postal)}<br>${escape(c.country)}<br>${escape(c.email)}<br>${escape(c.phone || 'Legacy demo · no phone recorded')}</address></details>${research}${phoneChange}${action}${shipping}${emails}<details class="order-history"><summary>Order timeline</summary><ol>${order.events.map(e => `<li><time>${escape(date(e.at))}</time><span>${escape(e.description)}</span></li>`).join('')}</ol></details></article>`;
  }
  function renderOrderList(host) {
    host.innerHTML = orders.length ? orders.map(o => orderCard(o, isAdminPage)).join('') + (nextCursor ? '<div class="order-links"><button type="button" class="commerce-secondary" data-load-more-orders>Load more orders</button></div>' : '') : '<div class="orders-empty"><h2>No orders here yet.</h2><p>Orders will appear after one is placed from the catalog.</p><a class="text-link" href="/">Browse the catalog</a></div>';
  }
  async function loadMoreOrders(button) {
    const host = isAdminPage ? $('#admin-orders') : $('#customer-orders'); if (!host || !nextCursor || loadingMore) return;
    loadingMore = true; button.disabled = true;
    try {
      const filter = $('#admin-order-filter')?.value || 'all';
      const result = await api(isAdminPage ? `/api/admin/orders?status=${encodeURIComponent(filter)}&limit=50&cursor=${nextCursor}` : `/api/orders?limit=50&cursor=${nextCursor}`);
      const known = new Set(orders.map(o => o.id)); orders = [...orders, ...result.orders.filter(o => !known.has(o.id))]; nextCursor = result.nextCursor;
      renderOrderList(host);
    } catch (error) { announce(error.message); button.disabled = false; } finally { loadingMore = false; }
  }
  async function loadOrders(force = false) {
    const host = isAdminPage ? $('#admin-orders') : $('#customer-orders'); if (!host || (loadingOrders && !force) || (isAdminPage && !config?.admin) || (!isAdminPage && !config?.customer)) return;
    if (!force && host.querySelector('form[data-dirty], form:focus-within, details[open]')) return;
    loadingOrders = true;
    const request = ++orderRequest, account = config?.customer?.id;
    try {
      // Server-side filter and cursor pagination; a refresh reloads as many rows as are currently shown (up to 200).
      const filter = $('#admin-order-filter')?.value || 'all';
      const size = Math.min(200, Math.max(50, orders.length));
      const result = await api(isAdminPage ? `/api/admin/orders?status=${encodeURIComponent(filter)}&limit=${size}` : `/api/orders?limit=${Math.min(100, size)}`);
      if (request !== orderRequest || (isAdminPage ? !config?.admin : config?.customer?.id !== account)) return;
      orders = result.orders; nextCursor = result.nextCursor;
      if ($('#admin-order-summary')) $('#admin-order-summary').innerHTML = [['payment_reported','To review'],['approved','To fulfill'],['shipped','Shipped']].map(([state,label])=>`<div><strong>${result.counts?.[state] || 0}</strong><span>${label}</span></div>`).join('');
      renderOrderList(host);
    } catch (error) {
      host.innerHTML = `<p class="commerce-error" role="alert">${escape(error.message)}</p>`;
      if (isAdminPage && error.status === 401) { config.admin = false; syncAdmin(); }
      if (!isAdminPage && error.status === 401) { config.customer = null; syncCustomer(); }
    } finally { if (request === orderRequest) loadingOrders = false; }
    if (isAdminPage) { await loadAdminCustomers(); await loadAdminEmails(); }
  }
  async function loadAdminCustomers() {
    const host = $('#admin-customers'); if (!isAdminPage || !config?.admin || !host) return;
    try {
      const { customers } = await api('/api/admin/customers'); if (!config?.admin) return;
      const day = ms => new Date(ms).toLocaleDateString();
      host.innerHTML = customers.length ? `<p class="commerce-note">${customers.length} customer${customers.length === 1 ? '' : 's'}</p><div class="admin-table-wrap"><table class="admin-customer-table"><thead><tr><th scope="col">Customer</th><th scope="col">Contact</th><th scope="col">Orders</th><th scope="col">Total</th><th scope="col">Last order</th></tr></thead><tbody>${customers.map(c => `<tr><th scope="row"><strong>${escape([c.firstName, c.lastName].filter(Boolean).join(' ') || 'No name yet')}</strong>${c.role ? `<span>${escape(c.role)}</span>` : ''}${c.birthDate ? `<span>Born ${escape(c.birthDate)}</span>` : ''}</th><td>${c.email ? `<a href="mailto:${escape(c.email)}">${escape(c.email)}</a>` : ''}${c.phone ? `<span>${escape(c.phone)}</span>` : ''}${c.shipTo ? `<span>${escape(c.shipTo)}</span>` : ''}</td><td><div class="admin-order-chips">${c.orders.map(o => `<span class="admin-order-chip" title="${escape(statuses[o.status] || o.status)}">#${escape(o.id)}</span>`).join('')}</div></td><td><strong>${money(c.totalOrderedCents)}</strong><span>${money(c.totalPaidCents)} paid</span></td><td>${day(c.lastOrder)}<span>Since ${day(c.signedUp)}</span></td></tr>`).join('')}</tbody></table></div>` : '<p class="commerce-note">No customers yet. They appear here as soon as someone places an order.</p>';
    } catch (error) { host.textContent = error.message; }
  }
  function syncAdmin() {
    if (!isAdminPage) return;
    $('#admin-login').hidden = !!config?.admin; $('#admin-orders-section').hidden = !config?.admin; $('#admin-logout').hidden = !config?.admin;
  }
  $('#admin-phone-form')?.addEventListener('submit', async event => {
    event.preventDefault(); const form = event.target, button = form.querySelector('button'); button.disabled = true; $('#admin-login-error').textContent = '';
    try {
      const data = await api('/api/admin/auth/start', { phone: form.elements.phone.value }); challenge = data.challenge;
      $('#admin-code-form').hidden = false; $('#demo-code').textContent = data.demoCode ? `Simulated code: ${data.demoCode} · expires in 5 minutes. No SMS was sent.` : 'If this number is authorized, a code was texted to it.';
      $('#admin-code-form input').value = ''; $('#admin-code-form input').focus();
    } catch (error) { $('#admin-login-error').textContent = error.message; } finally { button.disabled = false; }
  });
  $('#admin-code-form')?.addEventListener('submit', async event => {
    event.preventDefault(); const button = event.target.querySelector('button'); button.disabled = true; $('#admin-login-error').textContent = '';
    try { await api('/api/admin/auth/verify', { challenge, code: event.target.elements.code.value }); config.admin = true; $('#demo-code').textContent = ''; $('#admin-code-form').reset(); syncAdmin(); await loadOrders(true); } catch (error) { $('#admin-login-error').textContent = error.message; } finally { button.disabled = false; }
  });
  $('#admin-logout')?.addEventListener('click', async () => { try { await api('/api/admin/auth/logout', {}); config.admin = false; orders = []; $('#admin-orders').replaceChildren(); $('#admin-emails').replaceChildren(); $('#admin-code-form').hidden = true; syncAdmin(); } catch (error) { announce(error.message); } });
  $('#admin-order-filter')?.addEventListener('change', () => { orders = []; loadOrders(true); });
  $('.admin-mail-panel')?.addEventListener('toggle', event => { if (event.target.open) loadAdminEmails(); });
  function downloadReceipt(order) {
    if (!order?.shipping) return;
    const s = order.shipping;
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${L('Demo order', 'Order')} ${escape(order.id)}</title><style>body{font:16px/1.6 system-ui;color:#111;max-width:760px;margin:50px auto;padding:24px}h1{font-size:30px}small{color:#777}li{display:flex;justify-content:space-between;gap:30px;padding:14px 0;border-bottom:1px solid #ddd}ul{padding:0}li div span{display:block}strong{font-weight:600}dt{margin-top:12px;font-weight:600}dd{margin:0}</style><small>${L('LOCAL DEMO · NO PAYMENT OR SHIPMENT VERIFIED', 'ORDER CONFIRMATION')}</small><h1>${escape(config?.business?.name || 'Aevium Labs')}</h1><h2>Order confirmation ${escape(order.id)}</h2><p>${escape(date(order.created))}</p>${orderLines(order.items)}<h2>${L('Demo total', 'Total')} ${money(order.totalCents)}</h2><p>Prepared for ${escape(order.customer.name)}</p><dl><dt>Carrier</dt><dd>${escape(s.carrier)}</dd><dt>Tracking number</dt><dd>${escape(s.tracking)}</dd><dt>Fulfillment reference</dt><dd>${escape(s.reference)}</dd><dt>Shipping note</dt><dd>${escape(s.note)}</dd></dl><p>${L('This confirms the recorded demo order, not receipt of real bank funds or dispatch of physical goods.', 'Payment for this order was confirmed and its shipment was recorded with the carrier details above.')}</p></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' })); const a = document.createElement('a'); a.href = url; a.download = `${L('DEMO-', '')}${order.id}.html`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  window.addEventListener('storage', event => { if (event.key === 'pp-cart') { readCart(); syncCounters(); if (cartDialog?.open) renderCart(); } if (event.key === 'pp-order-update') loadOrders(); if (event.key === 'pp-account-update') refreshSession(); });
  async function refreshSession() {
    try { const data = await api('/api/shop'); const changed = config?.customer?.id !== data.customer?.id || config?.customer?.name !== data.customer?.name || config?.admin !== data.admin; config = data; if (changed) { syncCustomer(); syncAdmin(); if (cartDialog?.open) renderCart(); } await loadOrders(); } catch {}
  }
  window.addEventListener('focus', () => { readCart(); syncCounters(); refreshSession(); });
  setInterval(() => { if (!document.hidden && (isAdminPage || $('#customer-orders'))) refreshSession(); }, 15000);
  readCart(); syncCounters();
  api('/api/shop').then(data => { config = data; catalog = data.products; readCart(); syncCounters(); syncAdmin(); syncCustomer(); loadOrders(); }).catch(error => { if (isAdminPage) $('#admin-login-error').textContent = error.message; if ($('#customer-orders')) $('#customer-orders').innerHTML = `<p class="commerce-error">${escape(error.message)}</p>`; });
})();
