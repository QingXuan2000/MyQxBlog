/* 侧边栏与文章目录两个抽屉。

   两者都在右侧，同一时间只能开一个，所以互相持有对方的关闭函数。侧边栏的实现写在
   前面，先占住 closeSidebar 这个位置，目录那块调用时拿到的才是真函数。

   抽屉的关闭条件写得比打开多，点链接、点空白、焦点跑出去、按 Esc、窗口拉宽，五种都关。
   少一种就会出现关不掉的面板。 */
export function initNavigation(doc = globalThis.document, win = globalThis.window) {
  if (!doc || !win) return;
  const button = doc.querySelector('[data-menu-toggle]');
  const nav = doc.querySelector('[data-site-nav]');
  const sidebar = doc.querySelector?.('.qx-sidebar') || nav;
  const tocBtn = doc.querySelector?.('[data-toc-toggle]');
  const tocSidebar = doc.querySelector?.('.qx-toc-sidebar');
  // 由侧边栏那段逻辑赋值，供目录那边调用，实现「开一个关另一个」。
  let closeSidebar = () => {};

  if (button && nav) {
    if (nav.id) button.setAttribute('aria-controls', nav.id);

    function setOpen(open, returnFocus = false) {
      // 开侧边栏先把目录收起来，两个面板叠在一起没法用。
      if (open) tocSidebar?.classList.remove('is-open');
      if (open) tocBtn?.setAttribute('aria-expanded', 'false');
      nav.classList.toggle('is-open', open);
      if (sidebar && sidebar !== nav) sidebar.classList?.toggle?.('is-open', open);
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? '关闭侧边栏' : '打开侧边栏');
      if (open) nav.querySelector('a[href]')?.focus();
      if (returnFocus) button.focus();
    }

    setOpen(false);
    button.addEventListener('click', () =>
      setOpen(button.getAttribute('aria-expanded') !== 'true'),
    );

    nav.addEventListener?.('click', (event) => {
      if (event.target?.closest?.('a[href]')) setOpen(false);
    });

    doc.addEventListener?.('keydown', (event) => {
      if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
        setOpen(false, true);
      }
    });

    doc.addEventListener?.('click', (event) => {
      if (!nav.contains?.(event.target) && !button.contains?.(event.target)) {
        setOpen(false);
      }
    });

    doc.addEventListener?.('focusin', (event) => {
      if (!nav.contains?.(event.target) && !button.contains?.(event.target)) {
        setOpen(false);
      }
    });

    const desktop = win.matchMedia?.('(min-width: 681px)');
    const onResize = (event) => {
      if (event.matches) setOpen(false);
    };
    if (desktop?.addEventListener) desktop.addEventListener('change', onResize);
    else desktop?.addListener?.(onResize);

    closeSidebar = () => setOpen(false);
  }

  // 目录抽屉，规则和侧边栏一样，只是互斥方向反过来。
  if (tocBtn && tocSidebar) {
    const setTocOpen = (open) => {
      // 同一个位置只放一个面板，开目录之前先收侧边栏。
      if (open) closeSidebar();
      tocSidebar.classList.toggle('is-open', open);
      tocBtn.setAttribute('aria-expanded', String(open));
      tocBtn.setAttribute('aria-label', open ? '关闭文章目录' : '文章目录');
    };

    tocBtn.addEventListener('click', () => {
      setTocOpen(!tocSidebar.classList.contains('is-open'));
    });

    doc.addEventListener?.('click', (event) => {
      if (!tocSidebar.contains?.(event.target) && !tocBtn.contains?.(event.target)) {
        if (tocSidebar.classList.contains('is-open')) setTocOpen(false);
      }
    });

    doc.addEventListener?.('keydown', (event) => {
      if (event.key === 'Escape' && tocSidebar.classList.contains('is-open')) {
        setTocOpen(false);
        tocBtn.focus();
      }
    });
  }
}
