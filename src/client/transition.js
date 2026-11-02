/**
 * 页面转场和首屏加载幕布。
 * 纯粹、无光晕、无圆角的精准几何终端 HUD 风格。
 *
 * 实时显示正在加载的目标页面路径（中文 URL 自动解码），并展示自检加载过程阶段状态机。
 * 参考 https://wodniack.dev/ 的生命周期控制：
 * - 只有当页面与核心资源真实加载完成（document.readyState === "complete" 且 document.fonts.ready）时，
 *   才会将进度推进至 100% 并收回加载幕布。
 * - 期间使用 html.is-scroll-blocked 严格锁定页面滚动，并拦截穿透点击。
 * - 加载就绪后向 documentElement 注入 is-loaded，并向全局派发 siteLoaded 事件。
 */
const ENTER_MS = 220;
const EXIT_MS = 380;
const BOOT_TICK_MS = 16;
const BOOT_STEP = 2.4;
const MEMO_KEY = 'qx-nav';
const MEMO_TARGET = 'qx-nav-target';

const BOOT_STAGES = [
  { max: 24, text: '[01/05] SYS.INIT // LOADING CORE MATRIX...' },
  { max: 54, text: '[02/05] VECTORS // COMPILING SHADER NODES...' },
  { max: 78, text: '[03/05] NOISE // CALIBRATING WAVE FIELD...' },
  { max: 99, text: '[04/05] SYSTEM // MOUNTING DOMAIN MODULES...' },
  { max: 100, text: '[05/05] [ READY ] ACCESS GRANTED' },
];

const NAV_STAGES = [
  { max: 40, text: 'ROUTING // PREPARING PAYLOAD...' },
  { max: 80, text: 'TRANSMIT // SWITCHING VIEWPORT...' },
  { max: 100, text: '[ OK ] DESTINATION REACHED' },
];

function railText(groups) {
  const chunks = [];
  for (let i = 0; i < groups; i += 1) {
    if (Math.random() < 0.22) {
      chunks.push('/'.repeat(8));
      continue;
    }
    let bits = '';
    for (let b = 0; b < 6; b += 1) bits += Math.random() < 0.5 ? '0' : '1';
    chunks.push(bits);
  }
  return chunks.join(' ');
}

function buildRail(doc, className, seconds) {
  const rail = doc.createElement('span');
  rail.className = `qx-transition__rail ${className}`;
  const inner = doc.createElement('span');
  inner.style.animationDuration = `${seconds}s`;
  const text = railText(44);
  inner.textContent = `${text} ${text}`;
  rail.appendChild(inner);
  return rail;
}

function pathOf(href, win) {
  try {
    const url = new win.URL(href, win.location.href);
    let path = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
    let full = `${path}${url.search}`;
    try {
      full = decodeURIComponent(full);
    } catch {
      // 容错：遇到畸变百分比编码时退回原路径
    }
    return full.replace(/^\/+/, '');
  } catch {
    return '';
  }
}

function isInternal(anchor, win) {
  const href = anchor.getAttribute('href');
  if (!href) return false;
  if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
  let url;
  try {
    url = new win.URL(anchor.href, win.location.href);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.origin !== win.location.origin) return false;
  if (url.pathname === win.location.pathname && url.search === win.location.search) return false;
  return true;
}

function createLayer(doc) {
  const layer = doc.createElement('div');
  layer.className = 'qx-transition';
  layer.setAttribute('aria-hidden', 'true');

  layer.innerHTML = `
    <div class="qx-transition__grid"></div>
    <div class="qx-transition__header">
      <span class="qx-transition__sys">SYS.BOOT // QXBLOG</span>
      <span class="qx-transition__badge">CORE_INIT [OK]</span>
    </div>
  `;

  layer.appendChild(buildRail(doc, 'qx-transition__rail--fwd', 9));

  const hud = doc.createElement('div');
  hud.className = 'qx-transition__hud';
  hud.innerHTML = `
    <div class="qx-transition__corners">
      <span class="qx-corner qx-corner--tl"></span>
      <span class="qx-corner qx-corner--tr"></span>
      <span class="qx-corner qx-corner--bl"></span>
      <span class="qx-corner qx-corner--br"></span>
    </div>
    <div class="qx-transition__meta">
      <div class="qx-transition__target">
        <span class="qx-transition__target-icon">LOADING &gt;&gt;</span>
        <span class="qx-transition__target-path"></span>
      </div>
      <div class="qx-transition__count-wrap">
        <span class="qx-transition__count">000</span>
        <span class="qx-transition__unit">%</span>
      </div>
      <div class="qx-transition__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100">
        <i class="qx-transition__bar-fill"></i>
      </div>
      <div class="qx-transition__status">
        <span class="qx-transition__prompt">&gt;</span>
        <span class="qx-transition__label">INITIALIZING SYSTEM...</span>
      </div>
    </div>
  `;
  layer.appendChild(hud);

  layer.appendChild(buildRail(doc, 'qx-transition__rail--rev', 12));

  const footer = doc.createElement('div');
  footer.className = 'qx-transition__footer';
  footer.innerHTML = `
    <span class="qx-transition__tag">PROTOCOL: HTTP/3 · SECURE LINK</span>
    <span class="qx-transition__hex">0x00</span>
  `;
  layer.appendChild(footer);

  doc.body.appendChild(layer);
  return layer;
}

/**
 * 等待整页所有关键资源真实加载完成
 * 参考 wodniack.dev: document.readyState === 'complete' || window load
 */
function whenPageReady(doc, win) {
  const domLoaded = new Promise((resolve) => {
    if (doc.readyState === 'complete') {
      resolve();
      return;
    }
    const handler = () => {
      win.removeEventListener('load', handler);
      resolve();
    };
    win.addEventListener('load', handler, { once: true });
  });

  const fontsLoaded =
    doc?.fonts?.ready && typeof doc.fonts.ready.then === 'function'
      ? doc.fonts.ready.catch(() => {})
      : Promise.resolve();

  return Promise.all([domLoaded, fontsLoaded]);
}

export function initTransition(doc = globalThis.document, win = globalThis.window) {
  if (!doc?.body || !win?.addEventListener) return;
  if (doc.__qxTransitionInit) return;
  doc.__qxTransitionInit = true;

  const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const existing = doc.querySelector('.qx-transition');
  if (reduced) {
    existing?.remove();
    doc.documentElement.classList.remove('is-scroll-blocked');
    doc.documentElement.classList.add('is-loaded');
    return;
  }

  const layer = existing || createLayer(doc);
  // 脚本接管后取消纯 CSS 逃逸动画
  layer.style.animation = 'none';

  const count = layer.querySelector('.qx-transition__count');
  const label = layer.querySelector('.qx-transition__label');
  const targetPathEl = layer.querySelector('.qx-transition__target-path');
  const barFill = layer.querySelector('.qx-transition__bar-fill, .qx-transition__bar i');
  const hexEl = layer.querySelector('.qx-transition__hex');

  const updateProgress = (val, pathText, customStageText) => {
    const rounded = Math.round(val);
    if (count) count.textContent = String(rounded).padStart(3, '0');
    if (hexEl) hexEl.textContent = '0x' + rounded.toString(16).toUpperCase().padStart(2, '0');
    if (barFill) barFill.style.transform = `scaleX(${rounded / 100})`;

    if (pathText !== undefined && targetPathEl) {
      targetPathEl.textContent = pathText;
    }

    if (label) {
      if (customStageText) {
        label.textContent = customStageText;
      } else {
        const stage = BOOT_STAGES.find((s) => rounded <= s.max);
        if (stage) label.textContent = stage.text;
      }
    }
  };

  const isBoot = layer.classList.contains('is-boot');
  let busy = false;

  const reset = () => {
    layer.style.transition = 'none';
    if (barFill) barFill.style.transition = 'none';
    layer.classList.remove('is-active', 'is-out', 'is-boot');
    void layer.offsetWidth;
    layer.style.transition = '';
    if (barFill) barFill.style.transition = '';
    updateProgress(0, '', 'STANDBY');
    doc.documentElement.classList.remove('is-scroll-blocked');
    busy = false;
  };

  const open = () => {
    layer.classList.add('is-out');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      layer.removeEventListener('transitionend', onEnd);
      // 关键修复：划出屏幕后立即 display = 'none' 隐藏，防止二次重绘或误触动画
      layer.style.display = 'none';
      reset();
    };
    const onEnd = (event) => {
      if (event.target !== layer || event.propertyName !== 'transform') return;
      finish();
    };
    layer.addEventListener('transitionend', onEnd);
    win.setTimeout(finish, EXIT_MS + 100);
  };

  let entering = false;
  let targetPath = '';
  try {
    entering = win.sessionStorage.getItem(MEMO_KEY) === '1';
    targetPath = win.sessionStorage.getItem(MEMO_TARGET) || '';
    if (entering) {
      win.sessionStorage.removeItem(MEMO_KEY);
      win.sessionStorage.removeItem(MEMO_TARGET);
    }
  } catch {
    entering = false;
  }

  if (entering) {
    busy = true;
    doc.documentElement.classList.add('is-scroll-blocked');
    const currentName = targetPath || pathOf(win.location.pathname, win) || 'index.html';

    layer.style.display = 'flex';
    layer.style.transition = 'none';
    layer.classList.add('is-active');
    layer.classList.remove('is-boot');
    void layer.offsetWidth;
    layer.style.transition = '';

    let progress = 25;
    updateProgress(progress, currentName, 'TRANSMIT // SWITCHING VIEWPORT...');

    let pageReady = false;
    let finished = false;

    // 只有真实加载成功后才放行
    whenPageReady(doc, win).then(() => {
      pageReady = true;
    });

    const finishNav = () => {
      if (finished) return;
      finished = true;
      win.clearInterval(timer);
      updateProgress(100, currentName, '[ OK ] DESTINATION REACHED');
      doc.documentElement.classList.add('is-loaded');
      win.dispatchEvent?.(new CustomEvent('siteLoaded'));
      win.setTimeout(open, 100);
    };

    const timer = win.setInterval(() => {
      if (!pageReady) {
        // 未加载完成前最多平滑递增至 92% 并悬停等待，不提前收回
        if (progress < 92) {
          progress = Math.min(92, progress + 3);
          const stage = NAV_STAGES.find((s) => Math.round(progress) <= s.max);
          updateProgress(progress, currentName, stage ? stage.text : 'ROUTING...');
        }
      } else {
        // 资源完全就绪后迅速推满至 100% 并收回
        progress = Math.min(100, progress + 8);
        if (progress >= 100) {
          finishNav();
        } else {
          updateProgress(progress, currentName, 'TRANSMIT // FINALIZING...');
        }
      }
    }, 18);

    // 极限制兜底（10秒），防止外部资源彻底死锁
    win.setTimeout(() => {
      pageReady = true;
    }, 10000);
  } else if (isBoot) {
    busy = true;
    doc.documentElement.classList.add('is-scroll-blocked');
    const currentName = pathOf(win.location.pathname, win) || 'index.html';
    layer.style.display = 'flex';
    updateProgress(0, currentName);

    let progress = 0;
    let pageReady = false;
    let finished = false;

    // 监听真实加载完成状态
    whenPageReady(doc, win).then(() => {
      pageReady = true;
    });

    const finishBoot = () => {
      if (finished) return;
      finished = true;
      win.clearInterval(timer);
      updateProgress(100, currentName, '[05/05] [ READY ] ACCESS GRANTED');
      doc.documentElement.classList.add('is-loaded');
      win.dispatchEvent?.(new CustomEvent('siteLoaded'));
      win.setTimeout(open, 120);
    };

    const timer = win.setInterval(() => {
      if (!pageReady) {
        // 未加载完成前，平滑走过阶段，并在 92% 处等待，不提前收回
        if (progress < 92) {
          progress = Math.min(92, progress + BOOT_STEP);
          updateProgress(progress, currentName);
        }
      } else {
        // 资源真实加载成功，迅速平滑收尾推至 100%
        progress = Math.min(100, progress + 6);
        updateProgress(progress, currentName);
        if (progress >= 100) {
          finishBoot();
        }
      }
    }, BOOT_TICK_MS);

    // 极限制兜底（10秒），防止外链资源死锁
    win.setTimeout(() => {
      pageReady = true;
    }, 10000);
  }

  doc.addEventListener('click', (event) => {
    if (busy || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = event.target instanceof win.Element ? event.target.closest('a[href]') : null;
    if (!anchor) return;
    if (anchor.hasAttribute('download')) return;
    const targetAttr = anchor.getAttribute('target');
    if (targetAttr && targetAttr !== '_self') return;
    if (!isInternal(anchor, win)) return;

    busy = true;
    event.preventDefault();
    doc.documentElement.classList.add('is-scroll-blocked');

    const dest = pathOf(anchor.href, win);
    // 单次平滑切场：显示幕布并进场覆盖
    layer.style.display = 'flex';
    layer.style.transition = 'none';
    layer.classList.remove('is-out');
    void layer.offsetWidth;
    layer.style.transition = '';

    updateProgress(20, dest, 'ROUTING // PREPARING PAYLOAD...');
    layer.classList.add('is-active');

    win.setTimeout(() => {
      try {
        win.sessionStorage.setItem(MEMO_KEY, '1');
        win.sessionStorage.setItem(MEMO_TARGET, dest);
      } catch {}
      win.location.assign(anchor.href);
    }, ENTER_MS);

    // 路由跳转超时保护（6秒未离开当前页则解除阻断）
    win.setTimeout(() => {
      if (busy && doc.visibilityState === 'visible') {
        reset();
      }
    }, 6000);
  });

  // 关键修复：必须检查 event.persisted，正常页面初始加载时绝对不能执行 reset()
  win.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    reset();
  });
}
