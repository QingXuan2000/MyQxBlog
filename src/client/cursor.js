/* 自绘光标。一个实心点跟着指针走，外面一圈圆环慢半拍追上去，悬到可点的东西上时
   圆环张开并显示标签，文案由 data-cursor 指定，没有就按标签名猜一个。

   只在有精确指针的设备上启用。触屏没有悬停这回事，画个假光标只会碍事；
   开了减少动态效果也不启用，那是用户在系统里明确表达过不要这层动效。 */
const FALLBACK_LABELS = [
  ['a[href]', 'OPEN'],
  ['button', 'PRESS'],
  ['input, textarea, select', 'TYPE'],
  ['[role="button"]', 'PRESS'],
];

export function initCursor(doc = globalThis.document, win = globalThis.window) {
  if (!doc?.body || !win?.matchMedia) return;
  if (!win.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (win.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (doc.documentElement.classList.contains('qx-cursor-on')) return;

  const layer = doc.createElement('div');
  layer.className = 'qx-cursor';
  layer.setAttribute('aria-hidden', 'true');
  // [popover=manual] 进顶层，确保覆盖 dialog/popover。
  layer.setAttribute('popover', 'manual');
  layer.innerHTML =
    '<span class="qx-cursor__ring"><span class="qx-cursor__label"></span></span><span class="qx-cursor__dot"></span>';
  doc.body.appendChild(layer);
  doc.documentElement.classList.add('qx-cursor-on');

  /* dialog/popover 打开时重新提升光标层。 */
  let promoteQueued = false;
  const promote = () => {
    if (promoteQueued) return;
    promoteQueued = true;
    win.requestAnimationFrame(() => {
      promoteQueued = false;
      if (!layer.isConnected || typeof layer.showPopover !== 'function') return;
      try {
        if (layer.matches(':popover-open')) layer.hidePopover();
        layer.showPopover();
      } catch {
        /* 不支持 popover 时退回普通层。 */
      }
    });
  };
  promote();

  const observer =
    typeof win.MutationObserver === 'function'
      ? new win.MutationObserver((records) => {
          for (const record of records) {
            if (record.type === 'attributes') {
              // 只处理 dialog open 属性变化。
              if (record.target.matches?.('dialog')) promote();
              return;
            }
            for (const node of record.addedNodes) {
              if (node.nodeType !== 1) continue;
              if (node.matches?.('dialog[open]') || node.querySelector?.('dialog[open]')) {
                promote();
                return;
              }
            }
          }
        })
      : null;
  observer?.observe(doc.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['open'],
  });

  // 过滤自身触发的 toggle，避免 promote→hide→toggle 死循环。
  doc.addEventListener(
    'toggle',
    (event) => {
      if (event.target === layer) return;
      if (event.newState === 'closed') return;
      promote();
    },
    true,
  );

  const ring = layer.querySelector('.qx-cursor__ring');
  const dot = layer.querySelector('.qx-cursor__dot');
  const label = layer.querySelector('.qx-cursor__label');

  let pointerX = -120;
  let pointerY = -120;
  let ringX = -120;
  let ringY = -120;
  let raf = 0;
  let shown = false;

  const frame = () => {
    // 圆环插值 0.16（约落后 4 帧）。
    ringX += (pointerX - ringX) * 0.16;
    ringY += (pointerY - ringY) * 0.16;
    ring.style.transform = `translate3d(${ringX.toFixed(2)}px, ${ringY.toFixed(2)}px, 0) translate(-50%, -50%)`;
    if (Math.abs(pointerX - ringX) + Math.abs(pointerY - ringY) > 0.15) {
      raf = win.requestAnimationFrame(frame);
    } else {
      raf = 0;
    }
  };

  const wake = () => {
    if (!raf) raf = win.requestAnimationFrame(frame);
  };

  const onMove = (event) => {
    if (event.pointerType === 'touch') return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    dot.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0) translate(-50%, -50%)`;
    if (!shown) {
      shown = true;
      layer.classList.add('is-on');
      ringX = pointerX;
      ringY = pointerY;
    } else if (Math.abs(pointerX - ringX) + Math.abs(pointerY - ringY) > 220) {
      // 大幅跳位时直接归位（避免横穿整屏）。
      ringX = pointerX;
      ringY = pointerY;
    }
    wake();
  };

  const resolveLabel = (element) => {
    const explicit = element.closest('[data-cursor]');
    if (explicit) return explicit.getAttribute('data-cursor') || '';
    for (const [selector, text] of FALLBACK_LABELS) {
      if (element.closest(selector)) return text;
    }
    return '';
  };

  const onOver = (event) => {
    const element = event.target instanceof win.Element ? event.target : null;
    if (!element) return;
    const text = resolveLabel(element);
    if (!text) {
      layer.classList.remove('is-active');
      label.textContent = '';
      return;
    }
    label.textContent = text;
    layer.classList.add('is-active');
  };

  const onDown = () => layer.classList.add('is-down');
  const onUp = () => layer.classList.remove('is-down');
  const onLeave = () => {
    shown = false;
    layer.classList.remove('is-on', 'is-active', 'is-down');
  };

  doc.addEventListener('pointermove', onMove, { passive: true });
  doc.addEventListener('pointerover', onOver, { passive: true });
  doc.addEventListener('pointerdown', onDown, { passive: true });
  doc.addEventListener('pointerup', onUp, { passive: true });
  doc.documentElement.addEventListener('pointerleave', onLeave, { passive: true });

  // 键盘操作时把自绘光标藏起来，焦点跟随说明用户在用 Tab，还回系统光标。
  doc.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Tab') return;
      layer.classList.remove('is-on', 'is-active');
    },
    { passive: true },
  );
}
