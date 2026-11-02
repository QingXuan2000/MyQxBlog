/**
 * 页面转场和首屏加载幕布。
 * 纯粹、无光晕、无圆角的精准几何终端风格。
 * 实时显示正在加载的目标页面路径（中文 URL 自动解码），并展示自检加载过程阶段状态机。
 */
const ENTER_MS = 220;
const EXIT_MS = 380;
const BOOT_TICK_MS = 16;
const BOOT_STEP = 3;
const BOOT_MAX_MS = 950;
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

export function initTransition(doc = globalThis.document, win = globalThis.window) {
  if (!doc?.body || !win?.addEventListener) return;

  const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const existing = doc.querySelector('.qx-transition');
  if (reduced) {
    existing?.remove();
    return;
  }

  const layer = existing || createLayer(doc);
  const count = layer.querySelector('.qx-transition__count');
  const label = layer.querySelector('.qx-transition__label');
  const targetPathEl = layer.querySelector('.qx-transition__target-path');
  const barFill = layer.querySelector('.qx-transition__bar-fill') || layer.querySelector('.qx-transition__bar i');
  const hexEl = layer.querySelector('.qx-transition__hex');

  const updateProgress = (val, pathText, customStageText) => {
    if (count) count.textContent = String(val).padStart(3, '0');
    if (hexEl) hexEl.textContent = '0x' + val.toString(16).toUpperCase().padStart(2, '0');
    if (barFill) barFill.style.transform = `scaleX(${val / 100})`;

    if (pathText !== undefined && targetPathEl) {
      targetPathEl.textContent = pathText;
    }

    if (label) {
      if (customStageText) {
        label.textContent = customStageText;
      } else {
        const stage = BOOT_STAGES.find((s) => val <= s.max);
        if (stage) label.textContent = stage.text;
      }
    }
  };

  const isBoot = layer.classList.contains('is-boot');
  let busy = false;

  const reset = () => {
    layer.style.transition = 'none';
    layer.classList.remove('is-active', 'is-out', 'is-boot');
    void layer.offsetWidth;
    layer.style.transition = '';
    updateProgress(0, '', 'STANDBY');
    busy = false;
  };

  const open = () => {
    layer.classList.add('is-out');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      layer.removeEventListener('transitionend', onEnd);
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
    const currentName = targetPath || pathOf(win.location.pathname, win);
    updateProgress(100, currentName, '[ OK ] DESTINATION REACHED');

    if (!isBoot) {
      layer.style.transition = 'none';
      layer.classList.add('is-active');
      void layer.offsetWidth;
      layer.style.transition = '';
    }
    win.requestAnimationFrame(() => win.requestAnimationFrame(open));
  } else if (isBoot) {
    busy = true;
    const currentName = pathOf(win.location.pathname, win);
    updateProgress(0, currentName);

    let value = 0;
    let loaded = doc.readyState === 'complete';
    let opened = false;

    const maybeLift = () => {
      if (opened || value < 100 || !loaded) return;
      opened = true;
      win.clearInterval(timer);
      updateProgress(100, currentName, '[05/05] [ READY ] ACCESS GRANTED');
      win.setTimeout(open, 80);
    };

    const timer = win.setInterval(() => {
      value = Math.min(100, value + BOOT_STEP);
      updateProgress(value, currentName);
      if (value >= 100) {
        win.clearInterval(timer);
        maybeLift();
      }
    }, BOOT_TICK_MS);

    if (!loaded) {
      win.addEventListener(
        'load',
        () => {
          loaded = true;
          maybeLift();
        },
        { once: true },
      );
    }

    win.setTimeout(() => {
      if (opened) return;
      opened = true;
      updateProgress(100, currentName, '[05/05] [ READY ] ACCESS GRANTED');
      win.clearInterval(timer);
      win.setTimeout(open, 50);
    }, BOOT_MAX_MS);
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

    const dest = pathOf(anchor.href, win);
    updateProgress(0, dest, 'ROUTING // PREPARING PAYLOAD...');
    layer.classList.add('is-active');

    let value = 0;
    const timer = win.setInterval(() => {
      value = Math.min(100, value + 14);
      const stage = NAV_STAGES.find((s) => value <= s.max);
      updateProgress(value, dest, stage ? stage.text : 'ROUTING...');
    }, 20);

    win.setTimeout(() => {
      win.clearInterval(timer);
      try {
        win.sessionStorage.setItem(MEMO_KEY, '1');
        win.sessionStorage.setItem(MEMO_TARGET, dest);
      } catch {}
      win.location.assign(anchor.href);
    }, ENTER_MS);
  });

  win.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    reset();
  });
}
