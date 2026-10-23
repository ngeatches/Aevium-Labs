(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const motionButton = $('.motion-toggle');
  let motionPaused = reduceMotion.matches;
  let syncHeroPlayback = () => {};
  const activeMotion = new Map();
  let revealObserver;
  function playMotion(element, frames, options) {
    activeMotion.get(element)?.cancel();
    if (motionPaused || !element.animate) return;
    const animation = element.animate(frames, options);
    activeMotion.set(element, animation);
    animation.onfinish = animation.oncancel = () => {
      if (activeMotion.get(element) === animation) activeMotion.delete(element);
    };
  }
  function reveal(element, delay = 0) {
    revealObserver?.unobserve(element);
    if (element.contains(document.activeElement)) return;
    // Individual translate keeps the reveal separate from the card's hover transform.
    // No hidden resting state: content stays readable without JS or animation support.
    playMotion(element, [{ opacity: 0, translate: '0 16px' }, { opacity: 1, translate: '0 0' }], {
      duration: 700, delay, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards'
    });
  }
  function syncMotion() {
    document.documentElement.classList.toggle('motion-paused', motionPaused);
    if (motionPaused) {
      for (const animation of activeMotion.values()) animation.cancel();
      activeMotion.clear();
    }
    if (motionButton) {
      motionButton.setAttribute('aria-pressed', String(motionPaused));
      motionButton.setAttribute('aria-label', motionPaused ? 'Resume motion' : 'Pause motion');
      motionButton.title = motionPaused ? 'Resume motion' : 'Pause motion';
      motionButton.querySelector('span').textContent = motionPaused ? '▷' : 'Ⅱ';
    }
    syncHeroPlayback();
  }
  motionButton?.addEventListener('click', () => { motionPaused = !motionPaused; syncMotion(); });
  reduceMotion.addEventListener('change', event => { motionPaused = event.matches; syncMotion(); });
  syncMotion();

  const revealElements = $$('.catalog-heading, .product-card, .info-panel, .privacy-page > section');
  if ('IntersectionObserver' in window) {
    revealObserver = new IntersectionObserver(entries => {
      const entering = entries.filter(entry => entry.isIntersecting && !entry.target.hidden)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
      entering.forEach((entry, index) => reveal(entry.target, Math.min(index, 2) * 80));
    }, { rootMargin: '0px 0px -20px 0px', threshold: 0.06 });
    for (const element of revealElements) {
      if (element.getBoundingClientRect().top >= innerHeight) revealObserver.observe(element);
    }
  }
  document.addEventListener('focusin', event => {
    for (const element of revealElements) if (element.contains(event.target)) {
      revealObserver?.unobserve(element);
      activeMotion.get(element)?.cancel();
    }
  });

  const cards = $$('#collection .product-card');
  const search = $('#catalog-search');
  const category = $('#catalog-category');
  const categoryDialog = $('#category-dialog');
  const categoryTrigger = $('#open-categories');
  const categoryChoices = $$('[data-category-choice]');
  let activeFilter = 'all';
  const normalize = value => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9β+]/g, '');
  function filterCards() {
    const query = normalize(search?.value || '');
    let count = 0;
    const entering = [];
    for (const card of cards) {
      const text = normalize(`${card.dataset.name} ${card.dataset.amount} ${card.dataset.category} ${card.dataset.cas}`);
      const show = (activeFilter === 'all' || card.dataset.category === activeFilter) && text.includes(query);
      const wasHidden = card.hidden;
      card.hidden = !show;
      if (show) {
        count++;
        if (wasHidden) entering.push(card);
      } else {
        revealObserver?.unobserve(card);
        activeMotion.get(card)?.cancel();
      }
    }
    for (const [index, card] of entering.entries()) {
      const bounds = card.getBoundingClientRect();
      if (bounds.bottom > 0 && bounds.top < innerHeight + 40) reveal(card, Math.min(index, 2) * 80);
      else if (bounds.top >= innerHeight) revealObserver?.observe(card);
    }
    if ($('#result-count')) $('#result-count').textContent = `${count} ${count === 1 ? 'material' : 'materials'}`;
    if ($('.empty-state')) $('.empty-state').hidden = count !== 0;
    if (category) category.value = activeFilter;
    syncCategoryChoice();
  }
  function syncCategoryChoice() {
    const selected = categoryChoices.find(choice => choice.dataset.categoryChoice === activeFilter);
    if (selected && categoryTrigger) {
      $('#category-label').textContent = selected.firstElementChild.textContent;
      $('#category-count').textContent = selected.querySelector('.category-choice-meta > span').firstChild.textContent;
    }
    for (const choice of categoryChoices) choice.setAttribute('aria-pressed', String(choice.dataset.categoryChoice === activeFilter));
  }
  if (categoryDialog?.showModal && categoryTrigger) {
    $('#category-native').hidden = true;
    categoryTrigger.hidden = false;
    categoryTrigger.addEventListener('click', () => {
      syncCategoryChoice();
      categoryDialog.showModal();
      document.body.classList.add('dialog-open');
      syncHeroPlayback();
      categoryDialog.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
    });
    for (const choice of categoryChoices) choice.addEventListener('click', () => {
      activeFilter = choice.dataset.categoryChoice;
      filterCards();
      categoryDialog.close();
    });
    $('#close-categories').addEventListener('click', () => categoryDialog.close());
    categoryDialog.addEventListener('click', event => {
      if (event.target !== categoryDialog) return;
      const bounds = categoryDialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) categoryDialog.close();
    });
    categoryDialog.addEventListener('close', () => {
      if (!$('dialog[open]')) { document.body.classList.remove('dialog-open'); categoryTrigger.focus({ preventScroll: true }); }
      syncHeroPlayback();
    });
  }
  category?.addEventListener('change', () => { activeFilter = category.value; filterCards(); });
  search?.addEventListener('input', filterCards);
  $('#clear-filters')?.addEventListener('click', () => { activeFilter = 'all'; search.value = ''; filterCards(); search.focus(); });

  const dialog = $('#product-dialog');
  let previousFocus;
  let currentProduct;
  function cancelProductMotion() {
    for (const [element, animation] of activeMotion) {
      if (dialog?.contains(element)) animation.cancel();
    }
  }
  function revealProduct() {
    const elements = dialog.querySelectorAll('.dialog-topline, .dialog-subtitle, .spec-draft-note, .spec-table tr, .ruo-box');
    for (const [index, element] of [...elements].entries()) {
      // A gentle upward reveal; displayed names, prices and scientific values never count or scramble.
      playMotion(element, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }], {
        duration: 520, delay: Math.min(index * 28, 420), easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards'
      });
    }
  }
  function resetProductScroll() {
    $('.dialog-copy').scrollTop = 0;
    $('.dialog-grid').scrollTop = 0;
    dialog.scrollTop = 0;
  }
  function renderProduct(card) {
    cancelProductMotion();
    currentProduct = card;
    $('#dialog-title').textContent = card.dataset.name;
    $('#dialog-add-product').dataset.addProduct = card.dataset.id;
    $('#dialog-add-product').setAttribute('aria-label', `Add ${card.dataset.name} ${card.dataset.amount} to cart`);
    $('#dialog-amount').textContent = card.dataset.amount;
    $('#dialog-subtitle-amount').textContent = card.dataset.amount;
    $('#dialog-price').textContent = card.dataset.price;
    $('#dialog-position').textContent = `${String(card.dataset.index).padStart(2, '0')} / ${cards.length}`;
    $('#dialog-specs').replaceChildren(card.querySelector('.spec-content').cloneNode(true));
    const image = $('#dialog-image');
    image.src = `/assets/images/products/${card.dataset.id}-1024.webp`;
    image.alt = `Aevium Labs ${card.dataset.name}, ${card.dataset.amount} vial`;
    resetProductScroll();
    if (dialog.open) revealProduct();
  }
  function openProduct(card, trigger) {
    if (!dialog?.showModal) return;
    previousFocus = trigger;
    renderProduct(card);
    dialog.showModal();
    syncHeroPlayback();
    document.body.classList.add('dialog-open');
    $('.dialog-close').focus();
    resetProductScroll();
    revealProduct();
  }
  function stepProduct(direction) {
    if (!dialog?.open || !currentProduct) return;
    const index = cards.indexOf(currentProduct);
    renderProduct(cards[(index + direction + cards.length) % cards.length]);
  }
  for (const [selector, direction] of [['#previous-product', -1], ['#next-product', 1]]) {
    $(selector)?.addEventListener('click', () => stepProduct(direction));
  }
  dialog?.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    stepProduct(event.key === 'ArrowLeft' ? -1 : 1);
  });
  dialog?.addEventListener('focusin', event => {
    for (const [element, animation] of activeMotion) {
      if (dialog.contains(element) && element.contains(event.target)) animation.cancel();
    }
  });
  for (const link of $$('[data-open-product]')) link.addEventListener('click', event => {
    const card = cards.find(item => item.dataset.id === link.dataset.openProduct);
    if (card && dialog?.showModal) { event.preventDefault(); openProduct(card, link); }
  });
  for (const card of cards) {
    const summary = card.querySelector('summary');
    summary.addEventListener('click', event => {
      if (dialog?.showModal) { event.preventDefault(); openProduct(card, summary); }
    });
    if (dialog?.showModal) summary.setAttribute('aria-haspopup', 'dialog');
  }
  for (const spot of $$('.spotlight-card')) {
    const summary = spot.querySelector('summary');
    summary?.addEventListener('click', event => {
      const card = cards.find(item => item.dataset.id === spot.dataset.id);
      if (card && dialog?.showModal) { event.preventDefault(); openProduct(card, summary); }
    });
    if (dialog?.showModal) summary?.setAttribute('aria-haspopup', 'dialog');
  }
  // Top-bar search: suggests matching products as you type; Enter or "See all" filters the catalog.
  const headerSearch = $('#site-search-input'), headerResults = $('#site-search-results');
  if (headerSearch && headerResults && cards.length) {
    const searchForm = headerSearch.closest('form');
    let matches = [], active = -1;
    const haystack = card => normalize([card.dataset.name, card.dataset.amount, card.dataset.category, card.dataset.kind, card.dataset.cas].join(' '));
    const showCatalog = query => {
      closeResults();
      if (search) { search.value = query; activeFilter = 'all'; if (category) category.value = 'all'; filterCards(); }
      $('#collection')?.scrollIntoView({ behavior: motionPaused ? 'auto' : 'smooth' });
    };
    function closeResults() { headerResults.hidden = true; headerSearch.setAttribute('aria-expanded', 'false'); headerSearch.removeAttribute('aria-activedescendant'); active = -1; }
    function highlight(index) {
      const options = $$('#site-search-results [role="option"]');
      active = (index + options.length) % options.length;
      options.forEach((o, i) => o.setAttribute('aria-selected', String(i === active)));
      headerSearch.setAttribute('aria-activedescendant', options[active].id); options[active].scrollIntoView({ block: 'nearest' });
    }
    function renderResults() {
      const query = normalize(headerSearch.value);
      if (!query) { closeResults(); return; }
      const all = cards.filter(card => haystack(card).includes(query));
      matches = all.slice(0, 6);
      const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      headerResults.innerHTML = matches.length
        ? matches.map((card, i) => `<div class="site-search-option" role="option" id="site-search-option-${i}" aria-selected="false" data-index="${i}"><img src="/assets/images/products/${esc(card.dataset.id)}-640.webp" width="44" height="44" alt=""><span class="site-search-name">${esc(card.dataset.name)}<small>${esc(card.dataset.amount)}</small></span><span class="site-search-price">${esc(card.dataset.price)}</span></div>`).join('')
          + `<div class="site-search-option site-search-all" role="option" id="site-search-option-${matches.length}" aria-selected="false" data-all>See all ${all.length} result${all.length === 1 ? '' : 's'} in the catalog →</div>`
        : '<p class="site-search-empty">No products match. Try a name, blend or CAS number.</p>';
      headerResults.hidden = false; headerSearch.setAttribute('aria-expanded', String(!!matches.length)); active = -1;
    }
    function choose(option) {
      if (!option) return;
      if (option.hasAttribute('data-all')) { showCatalog(headerSearch.value.trim()); return; }
      const card = matches[Number(option.dataset.index)]; closeResults();
      if (card && dialog?.showModal) openProduct(card, headerSearch); else if (card) { card.scrollIntoView(); }
    }
    headerSearch.addEventListener('input', renderResults);
    headerSearch.addEventListener('focus', () => { if (headerSearch.value.trim()) renderResults(); });
    headerSearch.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (headerResults.hidden) renderResults();
        if (!headerResults.hidden && matches.length) { event.preventDefault(); highlight(active + (event.key === 'ArrowDown' ? 1 : -1)); }
      } else if (event.key === 'Escape' && !headerResults.hidden) { event.preventDefault(); closeResults(); }
    });
    searchForm.addEventListener('submit', event => {
      event.preventDefault();
      const options = $$('#site-search-results [role="option"]');
      if (!headerResults.hidden && active >= 0 && options[active]) choose(options[active]);
      else if (headerSearch.value.trim()) showCatalog(headerSearch.value.trim());
    });
    headerResults.addEventListener('mousedown', event => event.preventDefault()); // keep focus in the field
    headerResults.addEventListener('click', event => choose(event.target.closest('[role="option"]')));
    document.addEventListener('click', event => { if (!searchForm.contains(event.target)) closeResults(); });
    // Searches started from other pages arrive as /?q=term.
    const incoming = new URLSearchParams(location.search).get('q');
    if (incoming) { headerSearch.value = incoming; requestAnimationFrame(() => showCatalog(incoming)); }
  }
  // Spotlight carousel: shows a few cards at a time and loops through the list.
  const spotTrack = $('.spotlight-track');
  if (spotTrack && spotTrack.children.length > 1) {
    const spotSection = spotTrack.closest('.spotlight');
    const pauseButton = $('[data-spotlight="pause"]');
    let spotBusy = false, spotTimer, spotHover = false, spotUserPaused = false, spotVisible = true;
    const shift = () => spotTrack.children[0].getBoundingClientRect().width + parseFloat(getComputedStyle(spotTrack).columnGap || 0);
    async function spotStep(dir) {
      if (spotBusy) return;
      spotBusy = true;
      const animate = !motionPaused && spotTrack.animate;
      const w = shift();
      if (dir > 0) {
        if (animate) await spotTrack.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-w}px)` }], { duration: 650, easing: 'cubic-bezier(.4,0,.2,1)' }).finished.catch(() => {});
        spotTrack.append(spotTrack.children[0]);
      } else {
        spotTrack.prepend(spotTrack.lastElementChild);
        if (animate) await spotTrack.animate([{ transform: `translateX(${-w}px)` }, { transform: 'translateX(0)' }], { duration: 650, easing: 'cubic-bezier(.4,0,.2,1)' }).finished.catch(() => {});
      }
      spotBusy = false;
    }
    const spotCanRun = () => !motionPaused && !spotUserPaused && !spotHover && spotVisible && !document.hidden &&
      !spotSection.contains(document.activeElement) && !document.querySelector('dialog[open]');
    function spotSchedule() {
      clearTimeout(spotTimer);
      if (pauseButton) {
        const paused = spotUserPaused || motionPaused;
        pauseButton.setAttribute('aria-pressed', String(paused));
        pauseButton.setAttribute('aria-label', paused ? 'Play spotlight rotation' : 'Pause spotlight rotation');
        pauseButton.querySelector('span').textContent = paused ? '▷' : 'Ⅱ';
      }
      if (spotCanRun()) spotTimer = setTimeout(async () => { if (spotCanRun()) await spotStep(1); spotSchedule(); }, 3500);
    }
    $('[data-spotlight="next"]')?.addEventListener('click', async () => { await spotStep(1); spotSchedule(); });
    $('[data-spotlight="prev"]')?.addEventListener('click', async () => { await spotStep(-1); spotSchedule(); });
    pauseButton?.addEventListener('click', () => { spotUserPaused = !spotUserPaused; spotSchedule(); });
    spotTrack.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') { spotHover = true; spotSchedule(); } });
    spotTrack.addEventListener('pointerleave', () => { spotHover = false; spotSchedule(); });
    spotSection.addEventListener('focusout', () => requestAnimationFrame(spotSchedule));
    spotSection.addEventListener('focusin', spotSchedule);
    document.addEventListener('visibilitychange', spotSchedule);
    document.addEventListener('commerce:dialog', spotSchedule);
    dialog?.addEventListener('close', spotSchedule);
    if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => { spotVisible = entry.isIntersecting; spotSchedule(); }, { threshold: 0.2 }).observe(spotTrack);
    reduceMotion.addEventListener?.('change', () => setTimeout(spotSchedule));
    document.addEventListener('click', event => { if (event.target.closest('.motion-toggle')) setTimeout(spotSchedule); });
    spotSchedule();
  }
  $('.dialog-close')?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('click', event => {
    if (event.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    }
  });
  dialog?.addEventListener('close', () => {
    cancelProductMotion();
    if (!document.querySelector('dialog[open]')) { document.body.classList.remove('dialog-open'); previousFocus?.focus({ preventScroll: true }); }
    syncHeroPlayback();
  });
  dialog?.addEventListener('click', event => {
    const link = event.target.closest('a[href="#contact"]');
    if (!link) return;
    event.preventDefault();
    dialog.close();
    requestAnimationFrame(() => {
      const contact = $('#contact');
      expandAncestors(contact);
      const heading = contact.querySelector('h2');
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
      contact.scrollIntoView({ behavior: motionPaused ? 'instant' : 'smooth' });
    });
  });

  const testingDialog = $('#testing-dialog');
  const testingLink = $('#open-testing');
  if (testingDialog?.showModal && testingLink) {
    testingLink.setAttribute('aria-haspopup', 'dialog');
    testingLink.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      testingDialog.showModal();
      testingDialog.scrollTop = 0;
      document.body.classList.add('dialog-open');
      syncHeroPlayback();
      $('.testing-close').focus();
    });
    $('.testing-close').addEventListener('click', () => testingDialog.close());
    testingDialog.addEventListener('click', event => {
      if (event.target !== testingDialog) return;
      const bounds = testingDialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) testingDialog.close();
    });
    testingDialog.addEventListener('close', () => {
      if (!document.querySelector('dialog[open]')) { document.body.classList.remove('dialog-open'); testingLink.focus({ preventScroll: true }); }
      syncHeroPlayback();
    });
  }

  // Three fixed-size photographs rotate together; the link and label always follow the image.
  const showcase = $('.hero-showcase');
  const heroTiles = $$('[data-hero-tile]');
  const rotationButton = $('.hero-rotation-toggle');
  let heroRequest = 0;
  let heroTimer;
  let heroVisible = false;
  let heroHovered = false;
  let heroPausedByUser = false;
  function canRotateHero() {
    return heroTiles.length && heroVisible && !motionPaused && !heroPausedByUser && !heroHovered && !document.hidden &&
      !showcase.contains(document.activeElement) && !document.querySelector('dialog[open]') &&
      !document.documentElement.matches('.entry-pending, .entry-active');
  }
  async function rotateHero() {
    if (!canRotateHero()) return;
    const request = ++heroRequest;
    const updates = await Promise.all(heroTiles.map(async tile => {
      const index = cards.findIndex(card => card.dataset.id === tile.dataset.openProduct);
      const card = cards[(index + 3) % cards.length];
      const source = `/assets/images/products/${card.dataset.id}-640.webp`;
      const preload = new Image();
      preload.src = source;
      try { await preload.decode(); } catch { return null; }
      return { tile, card, source };
    }));
    if (request !== heroRequest || !canRotateHero()) return;
    if (updates.every(Boolean)) {
      for (const { tile, card, source } of updates) {
        const image = tile.querySelector('img');
        // Keep the previous frame during the crossfade, without an extra accessible image/link.
        const previous = image.cloneNode();
        previous.className = 'hero-tile-outgoing';
        previous.alt = '';
        previous.setAttribute('aria-hidden', 'true');
        tile.prepend(previous);
        image.src = source;
        image.alt = `Aevium Labs ${card.dataset.name}, ${card.dataset.amount} vial`;
        tile.href = `#material-${card.dataset.id}`;
        tile.dataset.openProduct = card.dataset.id;
        tile.setAttribute('aria-label', `Explore ${card.dataset.name} ${card.dataset.amount}`);
        tile.querySelector('.hero-tile-name').textContent = card.dataset.name;
        tile.querySelector('.hero-tile-amount').textContent = card.dataset.amount;
        playMotion(previous, [{ opacity: 1 }, { opacity: 0 }], { duration: 800, easing: 'ease-in-out', fill: 'forwards' });
        const fade = activeMotion.get(previous);
        if (fade) fade.finished.catch(() => {}).finally(() => previous.remove());
        else previous.remove();
      }
    }
    syncHeroPlayback();
  }
  syncHeroPlayback = () => {
    clearTimeout(heroTimer);
    heroRequest++;
    if (!rotationButton) return;
    const paused = motionPaused || heroPausedByUser;
    rotationButton.setAttribute('aria-pressed', String(paused));
    rotationButton.setAttribute('aria-label', motionPaused ? 'Product rotation paused with motion' : paused ? 'Resume product rotation' : 'Pause product rotation');
    rotationButton.querySelector('span').textContent = paused ? '▷' : 'Ⅱ';
    rotationButton.disabled = motionPaused;
    if (canRotateHero()) heroTimer = setTimeout(rotateHero, 3000);
  };
  if (showcase && rotationButton) {
    rotationButton.addEventListener('click', () => { heroPausedByUser = !heroPausedByUser; syncHeroPlayback(); });
    showcase.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') { heroHovered = true; syncHeroPlayback(); } });
    showcase.addEventListener('pointerleave', () => { heroHovered = false; syncHeroPlayback(); });
    showcase.addEventListener('focusin', syncHeroPlayback);
    showcase.addEventListener('focusout', () => requestAnimationFrame(syncHeroPlayback));
    document.addEventListener('visibilitychange', syncHeroPlayback);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; syncHeroPlayback(); }, { threshold: 0.1 }).observe(showcase);
    } else { heroVisible = true; }
    syncHeroPlayback();
  }
  document.addEventListener('commerce:dialog', () => syncHeroPlayback());
  document.addEventListener('entry:complete', () => syncHeroPlayback());
  function expandAncestors(target) {
    let expanded = false;
    for (let element = target; element; element = element.parentElement) {
      if (element.matches('details') && !element.open) { element.open = true; expanded = true; }
      activeMotion.get(element)?.cancel();
      revealObserver?.unobserve(element);
    }
    return expanded;
  }
  function revealTarget() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    const expanded = expandAncestors(target);
    if (expanded) requestAnimationFrame(() => target.scrollIntoView({ behavior: 'instant' }));
    if (target?.matches('.product-card') && target.hidden) {
      activeFilter = 'all'; if (search) search.value = ''; filterCards(); target.scrollIntoView();
    }
  }
  document.addEventListener('click', event => {
    if (event.defaultPrevented) return;
    const link = event.target.closest('a[href]');
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
    let id;
    try { id = decodeURIComponent(url.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (target) expandAncestors(target);
  });
  window.addEventListener('hashchange', revealTarget);
  revealTarget();
})();
