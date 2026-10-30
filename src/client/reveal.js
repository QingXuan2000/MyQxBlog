/* 入场揭示。元素进视口时向上 14px 加淡入，同一组按 DOM 顺序错峰，最多错到第 8 个。

   隐藏态由脚本加上去，这是有意的。CSS 里先藏起来的话，脚本挂掉或者被拦掉时整页内容
   都看不见了。现在这样最坏情况只是没有动画。 */
export function initReveal(doc = globalThis.document, win = globalThis.window) {
  if (!doc?.querySelectorAll) return;
  const items = [...doc.querySelectorAll('[data-reveal]')];
  if (!items.length) return;
  if (win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  if (typeof win?.IntersectionObserver !== 'function') return;

  for (const el of items) {
    el.classList.add('qx-reveal');
    const parent = el.parentElement;
    if (!parent) continue;
    const index = [...parent.children].indexOf(el);
    el.style.setProperty('--qx-reveal-delay', `${Math.max(0, Math.min(index, 8)) * 55}ms`);
  }

  const observer = new win.IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      }
    },
    { root: null, rootMargin: '0px 0px -10% 0px', threshold: 0.02 },
  );

  for (const el of items) observer.observe(el);
}
