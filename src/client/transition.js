/**
 * 页面转场和首屏加载共用同一块幕布。
 *
 * 幕布是一整屏底色，上下各一条 1px 前沿线，中间是二进制跑马灯、等宽计数和进度线。
 *
 * 首屏那一次，幕布由服务端直接渲染成盖住的状态，脚本把计数从 000 推到 100，
 * 等 load 之后再向上抽走。加载动画和揭幕是同一个动作，中间不留空档。
 * 站内跳转则反过来，点下链接先自下而上盖住，盖满了才换页，新页面接着把幕布抽走。
 *
 * 跳转时会往 sessionStorage 写一个标记，新页面读到它才知道该演揭幕那一段。
 * 隐私模式下写不进去，退化成直接打开，少了动画不影响访问。
 */
const ENTER_MS = 220;
const EXIT_MS = 240;
const TICK_MS = 25;
const STEP = 5;
const BOOT_TICK_MS = 20;
const BOOT_STEP = 10;
const BOOT_MAX_MS = 1400;
const MEMO_KEY = 'qx-nav';

/* 跑马灯要用的字符。六位一组，偶尔插一段斜杠，和首页分隔条是同一套字符集。 */
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
  // 同一段文本重复两次，配合 translate3d(-50%)，循环处才接得上。
  inner.textContent = `${text} ${text}`;
  rail.appendChild(inner);
  return rail;
}

function pathOf(href, win) {
  try {
    const url = new win.URL(href, win.location.href);
    // 目录地址以 / 结尾时补 index.html（避免读到单斜杠）。
    const path = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
    return `${path}${url.search}`;
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

/* 没有服务端渲染的幕布时自己造一块，结构和行为都照着模板里的那份来。 */
function createLayer(doc) {
  const layer = doc.createElement('div');
  layer.className = 'qx-transition';
  layer.setAttribute('aria-hidden', 'true');

  const meta = doc.createElement('span');
  meta.className = 'qx-transition__meta';
  meta.innerHTML =
    '<span class="qx-transition__count">000</span><span class="qx-transition__label"></span><span class="qx-transition__bar"><i></i></span>';

  layer.appendChild(buildRail(doc, 'qx-transition__rail--fwd', 9));
  layer.appendChild(meta);
  layer.appendChild(buildRail(doc, 'qx-transition__rail--rev', 12));
  doc.body.appendChild(layer);
  return layer;
}

export function initTransition(doc = globalThis.document, win = globalThis.window) {
  if (!doc?.body || !win?.addEventListener) return;

  const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const existing = doc.querySelector('.qx-transition');
  // 降级动效下幕布不参与，服务端幕布需立即撤除（否则盖住整页）。
  if (reduced) {
    existing?.remove();
    return;
  }

  const layer = existing || createLayer(doc);
  const count = layer.querySelector('.qx-transition__count');
  const label = layer.querySelector('.qx-transition__label');
  if (!count || !label) return;

  const isBoot = layer.classList.contains('is-boot');
  let busy = false;

  const reset = () => {
    layer.style.transition = 'none';
    layer.classList.remove('is-active', 'is-out', 'is-boot');
    void layer.offsetWidth;
    layer.style.transition = '';
    count.textContent = '000';
    busy = false;
  };

  /* 幕布向上抽走，结束后复位到视口下方待命。 */
  const open = () => {
    layer.classList.add('is-out');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      layer.removeEventListener('transitionend', onEnd);
      reset();
      label.textContent = '';
    };
    // transitionend 从子元素冒泡，只认幕布自身的 transform。
    const onEnd = (event) => {
      if (event.target !== layer || event.propertyName !== 'transform') return;
      finish();
    };
    layer.addEventListener('transitionend', onEnd);
    win.setTimeout(finish, EXIT_MS + 140);
  };

  // 新页先盖住，再把遮罩向上抽走（上一次点击标记）。
  let entering = false;
  try {
    entering = win.sessionStorage.getItem(MEMO_KEY) === '1';
    if (entering) win.sessionStorage.removeItem(MEMO_KEY);
  } catch {
    entering = false;
  }

  if (entering) {
    busy = true;
    label.textContent = pathOf(win.location.pathname, win);
    count.textContent = '100';
    if (!isBoot) {
      // 自造幕布需显式盖上；服务端幕布本已盖住。
      layer.style.transition = 'none';
      layer.classList.add('is-active');
      void layer.offsetWidth;
      layer.style.transition = '';
    }
    win.requestAnimationFrame(() => win.requestAnimationFrame(open));
  } else if (isBoot) {
    // 首屏这一次要两个条件都满足才揭幕，计数到 100，并且文档 load 完成。
    busy = true;
    label.textContent = pathOf(win.location.pathname, win);

    let value = 0;
    let loaded = doc.readyState === 'complete';
    let opened = false;

    const maybeLift = () => {
      if (opened || value < 100 || !loaded) return;
      opened = true;
      win.clearInterval(timer);
      open();
    };

    const timer = win.setInterval(() => {
      value = Math.min(100, value + BOOT_STEP);
      count.textContent = String(value).padStart(3, '0');
      if (value >= 100) win.clearInterval(timer);
      maybeLift();
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

    // 页面迟迟不 load 时强制抽走（避免永久盖住）。
    win.setTimeout(() => {
      if (opened) return;
      opened = true;
      value = 100;
      count.textContent = '100';
      win.clearInterval(timer);
      open();
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

    label.textContent = pathOf(anchor.href, win);
    count.textContent = '000';
    layer.classList.add('is-active');

    let value = 0;
    const timer = win.setInterval(() => {
      value = Math.min(100, value + STEP);
      count.textContent = String(value).padStart(3, '0');
    }, TICK_MS);

    win.setTimeout(() => {
      win.clearInterval(timer);
      try {
        win.sessionStorage.setItem(MEMO_KEY, '1');
      } catch {
        /* 隐私模式无法写入（仅缺少揭幕段）。 */
      }
      win.location.assign(anchor.href);
    }, ENTER_MS);
  });

  // bfcache 回退时强制复位（正常导航的 pageshow 不打断揭幕）。
  win.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    reset();
    label.textContent = '';
  });
}
