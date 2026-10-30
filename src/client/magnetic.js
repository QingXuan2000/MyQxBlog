/* 磁吸：指针靠近时元素向指针轻推（上限 6px），离开回正。用于小按钮与链接。 */
export function initMagnetic(doc = globalThis.document, win = globalThis.window) {
  if (!doc?.querySelectorAll || !win?.matchMedia) return;
  if (!win.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (win.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  for (const el of doc.querySelectorAll('[data-magnetic]')) {
    const raw = el.getAttribute('data-magnetic');
    const strength = Number(raw) > 0 ? Number(raw) : 6;
    el.classList.add('qx-magnetic');

    el.addEventListener(
      'pointermove',
      (event) => {
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const dx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
        const dy = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
        el.style.setProperty('--qx-mx', `${(dx * strength).toFixed(2)}px`);
        el.style.setProperty('--qx-my', `${(dy * strength).toFixed(2)}px`);
      },
      { passive: true },
    );

    el.addEventListener(
      'pointerleave',
      () => {
        el.style.setProperty('--qx-mx', '0px');
        el.style.setProperty('--qx-my', '0px');
      },
      { passive: true },
    );
  }
}
