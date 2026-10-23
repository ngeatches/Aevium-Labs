// Visual continuity only. The native form and server still decide access.
(() => {
  const key = 'pp-entry-motion';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let origin;
  try {
    const saved = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    if (saved) origin = JSON.parse(saved);
  } catch { /* Storage is optional; normal navigation remains available. */ }
  const isLanding = ['/', '/index.html'].includes(location.pathname) && !location.hash;
  const validOrigin = origin && ['x', 'y', 'width', 'viewportWidth', 'viewportHeight', 'at'].every(k => Number.isFinite(origin[k])) &&
    origin.width > 0 && origin.width < 1000 && origin.x >= 0 && origin.y >= 0 &&
    Date.now() - origin.at >= 0 && Date.now() - origin.at < 20_000;
  let finished = false;
  let veil;
  let brand;
  let failSafe;
  const animations = [];
  const cancelEvents = ['wheel', 'touchstart', 'pointerdown', 'keydown', 'focusin'];
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(failSafe);
    for (const animation of animations) animation.cancel();
    veil?.remove(); brand?.remove();
    root.classList.remove('entry-pending', 'entry-active');
    for (const name of cancelEvents) document.removeEventListener(name, finish, true);
    window.removeEventListener('resize', finish);
    window.removeEventListener('scroll', finish);
    reduced.removeEventListener('change', finish);
    document.dispatchEvent(new CustomEvent('entry:complete'));
  }
  if (isLanding && validOrigin && !reduced.matches && Element.prototype.animate) {
    root.classList.add('entry-pending');
    // Never leave content hidden if an image/font or animation fails.
    failSafe = setTimeout(finish, 4500);
    for (const name of cancelEvents) document.addEventListener(name, finish, { capture: true, passive: true });
    window.addEventListener('resize', finish, { passive: true });
    window.addEventListener('scroll', finish, { passive: true });
    reduced.addEventListener('change', finish);
  }
  async function enter() {
    if (!root.classList.contains('entry-pending') || finished) return;
    const target = document.querySelector('.hero-brand');
    if (!target) { finish(); return; }
    try {
      await Promise.all([document.fonts.ready, ...[...target.querySelectorAll('img')].map(img => img.decode().catch(() => {}))]);
      if (finished) return;
      const bounds = target.querySelector('.hero-brand-emblem').getBoundingClientRect();
      if (!bounds.width || bounds.top < 0 || scrollY > 0 || Math.abs(innerWidth - origin.viewportWidth) > 40 || Math.abs(innerHeight - origin.viewportHeight) > 100) {
        finish(); return;
      }
      veil = document.createElement('div');
      veil.className = 'entry-veil';
      veil.setAttribute('aria-hidden', 'true');
      brand = document.createElement('div');
      brand.className = 'entry-brand';
      brand.setAttribute('aria-hidden', 'true');
      brand.innerHTML = target.innerHTML;
      Object.assign(brand.style, { left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px` });
      document.body.append(veil, brand);
      const easing = 'cubic-bezier(.22,.72,.2,1)';
      const animate = (element, frames, options) => {
        const animation = element.animate(frames, { easing, fill: 'both', ...options });
        animations.push(animation);
        return animation;
      };
      animate(brand, [
        { transform: `translate(${origin.x - bounds.left}px, ${origin.y - bounds.top}px) scale(${origin.width / bounds.width})` },
        { transform: 'translate(0, 0) scale(1)' }
      ], { duration: 1450 });
      animate(brand.querySelector('.hero-brand-emblem'), [{ opacity: .25 }, { opacity: .5 }], { duration: 1450 });
      animate(brand.querySelector('.brand-logo'), [{ transform: 'scale(.95745)' }, { transform: 'scale(1)' }], { duration: 1450 });
      animate(veil, [{ opacity: 1 }, { opacity: 0 }], { duration: 1000, delay: 650 });
      const sequence = [
        ['.hero-message h1', 850], ['.hero-message .hero-lede', 1000],
        ['.hero-catalog', 1150], ['.hero-testing', 1250],
        ['.hero-tile:nth-of-type(1)', 1250], ['.hero-tile:nth-of-type(2)', 1370], ['.hero-tile:nth-of-type(3)', 1490]
      ];
      for (const [selector, delay] of sequence) {
        const element = document.querySelector(selector);
        if (element) animate(element, [{ opacity: 0, translate: '0 14px' }, { opacity: 1, translate: '0 0' }], { duration: 950, delay });
      }
      root.classList.add('entry-active');
      root.classList.remove('entry-pending');
      await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
      finish();
    } catch { finish(); }
  }
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.gate-form');
    form?.addEventListener('submit', () => {
      try {
        if (reduced.matches) { sessionStorage.removeItem(key); return; }
        const bounds = document.querySelector('.gate-identity').getBoundingClientRect();
        sessionStorage.setItem(key, JSON.stringify({ x: bounds.left, y: bounds.top, width: bounds.width, viewportWidth: innerWidth, viewportHeight: innerHeight, at: Date.now() }));
      } catch { /* No secret, password or authentication state is stored here. */ }
    });
    enter();
  }, { once: true });
  // Back/forward restoration must never restore an unfinished entrance.
  window.addEventListener('pageshow', event => { if (event.persisted) finish(); });
})();
