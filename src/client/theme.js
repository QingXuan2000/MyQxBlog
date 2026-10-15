export function initTheme(doc = globalThis.document, win = globalThis.window) {
  if (!doc?.documentElement || !win) return;
  const root = doc.documentElement;
  const buttons = [...doc.querySelectorAll('[data-theme-toggle]')];
  const system = win.matchMedia?.('(prefers-color-scheme: dark)');
  let preference;
  try {
    const stored = win.localStorage.getItem('qx-theme');
    if (stored === 'dark' || stored === 'light') preference = stored;
  } catch {
    /* 存储不可用时所选主题仍可工作。 */
  }

  function apply(theme) {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    buttons.forEach((button) => {
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      button.setAttribute('aria-label', theme === 'dark' ? '切换到浅色主题' : '切换到深色主题');
      button.setAttribute('title', theme === 'dark' ? '切换到浅色主题' : '切换到深色主题');
    });
  }

  apply(preference || (system?.matches ? 'dark' : 'light'));
  buttons.forEach((button) =>
    button.addEventListener('click', () => {
      preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try {
        win.localStorage.setItem('qx-theme', preference);
      } catch {
        /* 保留内存中的偏好。 */
      }
      apply(preference);
    }),
  );
  const onSystemChange = (event) => {
    if (!preference) apply(event.matches ? 'dark' : 'light');
  };
  if (system?.addEventListener) system.addEventListener('change', onSystemChange);
  else system?.addListener?.(onSystemChange);
  win.addEventListener('storage', (event) => {
    if (event.key !== 'qx-theme' && event.key !== null) return;
    preference =
      event.newValue === 'dark' || event.newValue === 'light' ? event.newValue : undefined;
    apply(preference || (system?.matches ? 'dark' : 'light'));
  });
}
