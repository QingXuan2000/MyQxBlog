/* 量一遍导航和页脚的实际高度，写进 --qx-nav-h 和 --qx-footer-h。
   主体区域的 min-height 和底部留白要用这两个值算。

   不写死是因为页脚会随 footerContent 的条数变高，导航也会因为字体缩放、系统字号
   设置而变。ResizeObserver 盯着这两个元素，字体加载完再补量一次，行高那时才定。 */
export function initFooterHeight(doc = globalThis.document, win = globalThis.window) {
  if (!doc || !win || !doc.documentElement) return;

  const footer = doc.querySelector('.qx-footer');
  const nav = doc.querySelector('.qx-nav') || doc.querySelector('header');
  const root = doc.documentElement;

  let raf = 0;

  const apply = () => {
    raf = 0;
    if (footer) {
      // offsetHeight 取整像素，避免 calc() 累积 0.3px 级缝隙。
      root.style.setProperty('--qx-footer-h', `${footer.offsetHeight}px`);
    }
    if (nav) {
      root.style.setProperty('--qx-nav-h', `${nav.offsetHeight}px`);
    }
  };

  const schedule = () => {
    if (raf) return;
    raf = win.requestAnimationFrame ? win.requestAnimationFrame(apply) : (apply(), 0);
  };

  apply();

  if (typeof win.ResizeObserver === 'function') {
    const ro = new win.ResizeObserver(schedule);
    if (footer) ro.observe(footer);
    if (nav) ro.observe(nav);
  }

  win.addEventListener('resize', schedule, { passive: true });
  win.addEventListener('orientationchange', schedule, { passive: true });

  // 字体加载后行高变化，需重新测量。
  if (doc.fonts && typeof doc.fonts.ready === 'object') {
    doc.fonts.ready.then(schedule).catch(() => {});
  }
}
