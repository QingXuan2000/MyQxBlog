export function initNavigation(doc = globalThis.document, win = globalThis.window) {
  if (!doc || !win) return;
  const button = doc.querySelector('[data-menu-toggle]');
  const nav = doc.querySelector('[data-site-nav]');
  if (!button || !nav) return;
  if (nav.id) button.setAttribute('aria-controls', nav.id);

  function setOpen(open, returnFocus = false) {
    nav.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
    if (open) nav.querySelector('a[href]')?.focus();
    if (returnFocus) button.focus();
  }

  setOpen(false);
  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a[href]')) setOpen(false);
  });
  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true')
      setOpen(false, true);
  });
  doc.addEventListener('click', (event) => {
    if (!nav.contains(event.target) && !button.contains(event.target)) setOpen(false);
  });
  doc.addEventListener('focusin', (event) => {
    if (!nav.contains(event.target) && !button.contains(event.target)) setOpen(false);
  });
  const desktop = win.matchMedia?.('(min-width: 681px)');
  const onResize = (event) => {
    if (event.matches) setOpen(false);
  };
  if (desktop?.addEventListener) desktop.addEventListener('change', onResize);
  else desktop?.addListener?.(onResize);
}
