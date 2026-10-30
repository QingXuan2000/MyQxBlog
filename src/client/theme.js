/* 深浅主题切换。

   首帧的主题由 head 里的内联脚本定好，这里接管之后的交互。主题来源有三处，
   localStorage 里的用户选择、系统的 prefers-color-scheme、以及两个浏览器标签页之间的
   storage 事件。没有用户选择时跟随系统，选了就固定住。 */
export function initTheme(doc = globalThis.document, win = globalThis.window) {
  if (!doc?.documentElement || !win) return;
  const root = doc.documentElement;
  const buttons = [...doc.querySelectorAll('[data-theme-toggle]')];
  const reduce = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const system = win.matchMedia?.('(prefers-color-scheme: dark)');
  let preference;
  let switching = false;
  try {
    const stored = win.localStorage.getItem('qx-theme');
    if (stored === 'dark' || stored === 'light') preference = stored;
  } catch {
    /* 存储不可用时仍保留所选主题。 */
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

  function commit(theme) {
    preference = theme;
    try {
      win.localStorage.setItem('qx-theme', theme);
    } catch {
      /* 保留内存中的主题偏好。 */
    }
    apply(theme);
  }

  /**
   * 换主题时浏览器给前后两帧各拍一张快照，动画里用的是两套真实页面。
   * 旧主题整页向左退场，新主题在原地等着被露出来，1s 加 expo.inOut 缓动。
   *
   * 不用纯色幕布。纯色只能变出「一块颜色滑过去」，而这里要的是旧主题的正文、标题、
   * hero 一起走，新主题从下面露出来。
   */
  function sweep(theme) {
    if (!doc.startViewTransition || reduce?.matches || switching) {
      commit(theme);
      return;
    }
    switching = true;
    let transition;
    try {
      transition = doc.startViewTransition(() => commit(theme));
    } catch {
      switching = false;
      commit(theme);
      return;
    }
    const done = () => {
      switching = false;
    };
    if (transition?.finished?.then) transition.finished.then(done, done);
    else done();
  }

  apply(preference || (system?.matches ? 'dark' : 'light'));
  buttons.forEach((button) =>
    button.addEventListener('click', () => {
      sweep(root.dataset.theme === 'dark' ? 'light' : 'dark');
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
