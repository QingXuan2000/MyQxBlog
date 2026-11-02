/* 解码式入场。每个字先显示一个形近字，逐级收敛，最后落到真字上。

   形近字不写死表，运行时算。汉字取同区块的邻近码位，CJK 统一表意文字按部首和笔画数
   排序，相邻码位往往同部首、笔画也接近，看上去就是一路在变像。其他字符走另一条路，
   把候选字符用当前字体画成位图，和目标字比墨量分布，取最接近的几个当阶梯。
   这样换了字重、换了字体，阶梯自动跟着变，不用维护任何映射。

   两条路都走不通时保持原样。字体缺字、没有 canvas、码位出了汉字区，都会退回原文，
   动画少一段总比标题变成乱码强。 */
const STAGES = 6;
const STAGE_MS = 64;
const STAGGER_MS = 28;

/* 码位偏移逐级收窄，64、30、16、8、4、1，最后一步归零。
   靠近区块末尾时改成往回偏移，免得越界跑到非汉字码位上去。 */
const CJK_DELTAS = [64, 30, 16, 8, 4, 1];

/* 位图比对的候选集：拉丁字母与数字足够覆盖当前会用到解码的场景。 */
const CANDIDATES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const SAMPLE_PX = 24; // 统一的采样字号，形状相似与渲染字号无关
const CELL = SAMPLE_PX + 6; // 留出字形的越界（h、y 这类上伸下延）

const atlasCache = new Map(); // fontKey → { masks, index }
const chainCache = new Map(); // fontKey|char → 阶梯字符数组
const GRID = 8; // 比较用的粗网格。只看墨量分布，笔画有一两个像素的位移也不影响判断

function fontKey(el, win) {
  try {
    const cs = win.getComputedStyle(el);
    return `${cs.fontStyle || 'normal'} ${cs.fontWeight || '400'} ${cs.fontFamily || 'sans-serif'}`;
  } catch {
    return 'normal 400 sans-serif';
  }
}

function paintFont(el, win) {
  try {
    const cs = win.getComputedStyle(el);
    return `${cs.fontStyle || 'normal'} ${cs.fontWeight || '400'} ${SAMPLE_PX}px ${cs.fontFamily || 'sans-serif'}`;
  } catch {
    return `400 ${SAMPLE_PX}px sans-serif`;
  }
}

function atlasFor(doc, el, win, key) {
  if (atlasCache.has(key)) return atlasCache.get(key);
  let atlas = null;
  try {
    const canvas = doc.createElement('canvas');
    canvas.width = CELL * CANDIDATES.length;
    canvas.height = CELL;
    const ctx = canvas.getContext?.('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.font = paintFont(el, win);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000';
      for (let i = 0; i < CANDIDATES.length; i += 1) {
        ctx.fillText(CANDIDATES[i], i * CELL + CELL / 2, CELL / 2);
      }
      const { data } = ctx.getImageData(0, 0, canvas.width, CELL);
      const masks = [];
      let index = 0;
      for (const char of CANDIDATES) {
        const mask = new Uint8Array(CELL * CELL);
        let ink = 0;
        for (let y = 0; y < CELL; y += 1) {
          for (let x = 0; x < CELL; x += 1) {
            const alpha = data[(y * canvas.width + index * CELL + x) * 4 + 3];
            if (alpha > 128) {
              mask[y * CELL + x] = 1;
              ink += 1;
            }
          }
        }
        masks.push({ char, mask, ink, profile: profileOf(mask) });
        index += 1;
      }
      atlas = { masks };
    }
  } catch {
    atlas = null;
  }
  atlasCache.set(key, atlas);
  return atlas;
}

function profileOf(mask) {
  const step = CELL / GRID;
  const profile = new Float32Array(GRID * GRID);
  for (let gy = 0; gy < GRID; gy += 1) {
    for (let gx = 0; gx < GRID; gx += 1) {
      let sum = 0;
      const y0 = Math.floor(gy * step);
      const x0 = Math.floor(gx * step);
      for (let y = y0; y < Math.min(CELL, y0 + step); y += 1) {
        for (let x = x0; x < Math.min(CELL, x0 + step); x += 1) sum += mask[y * CELL + x];
      }
      profile[gy * GRID + gx] = sum / (step * step);
    }
  }
  return profile;
}

const classOf = (char) => (/[0-9]/.test(char) ? 'd' : /[a-z]/.test(char) ? 'l' : 'u');

function similarity(target, candidate) {
  let diff = 0;
  for (let i = 0; i < target.profile.length; i += 1)
    diff += Math.abs(target.profile[i] - candidate.profile[i]);
  const base = diff / (target.ink + candidate.ink);
  return classOf(target.char) === classOf(candidate.char) ? base : base + 0.06;
}

function similarChain(doc, el, win, key, char) {
  const cacheKey = `${key}|${char}`;
  if (chainCache.has(cacheKey)) return chainCache.get(cacheKey);

  let chain = null;
  try {
    const atlas = atlasFor(doc, el, win, key);
    if (atlas) {
      const target = atlas.masks.find((item) => item.char === char);
      if (target && target.ink > 0) {
        chain = atlas.masks
          .filter(
            (item) =>
              item.char !== char &&
              item.ink > 0 &&
              item.ink >= target.ink * 0.35 &&
              item.ink <= target.ink * 2.8,
          )
          .map((item) => ({ char: item.char, score: similarity(target, item) }))
          .sort((a, b) => a.score - b.score)
          .slice(0, STAGES)
          .reverse()
          .map((item) => item.char);
      }
    }
  } catch {
    chain = null;
  }
  chainCache.set(cacheKey, chain);
  return chain;
}

const position = (stage, length) =>
  length <= 1 ? 0 : Math.round((stage / (STAGES - 1)) * (length - 1));

function lookalike(char, stage, context) {
  try {
    const chain = similarChain(context.doc, context.el, context.win, context.key, char);
    if (chain?.length) return chain[position(stage, chain.length)];

    const code = char.codePointAt(0);
    if (code >= 0x4e00 && code <= 0x9fff) {
      const delta = CJK_DELTAS[position(stage, CJK_DELTAS.length)];
      const next = code + delta > 0x9fff ? code - delta : code + delta;
      if (next >= 0x4e00 && next <= 0x9fff) return String.fromCodePoint(next);
    }
  } catch {
    // 容错返回原字符
  }
  return char;
}

function frameText(chars, stages, context, stageOf) {
  let out = '';
  for (let index = 0; index < chars.length; index += 1) {
    const stage = stageOf(index, stages[index]);
    out += stage >= STAGES ? chars[index] : lookalike(chars[index], stage, context);
  }
  return out;
}

/**
 * 针对单个元素执行安全解码动画
 * 核心保障：
 * 1. 动画触发前决不提前将 DOM 替换为乱码，确保任何异常下常态均为正常文本
 * 2. 动画过程中具备硬性超时兜底，无论是 rAF 挂起、切后台、报错，均无条件归位真实原文
 * 3. 动画执行完毕清除所有临时属性
 */
function rollElement(el, win) {
  if (!el || el.dataset.rolling === '1' || el.dataset.rolled === '1') return;
  el.dataset.rolling = '1';

  const text = el.dataset.rollText || (el.textContent || '').trim();
  if (!text) {
    delete el.dataset.rolling;
    return;
  }

  const chars = [...text];
  const context = { doc: el.ownerDocument, el, win, key: fontKey(el, win) };
  // 每个字符从随机阶梯（0~2）开始收敛
  const preset = chars.map(() => Math.floor(Math.random() * 3));
  el.setAttribute('aria-label', text);

  const start = win.performance?.now?.() ?? Date.now();
  const totalDuration = chars.length * STAGGER_MS + STAGES * STAGE_MS + 250;

  let cleaned = false;
  const finish = () => {
    if (cleaned) return;
    cleaned = true;
    win.clearTimeout(safetyTimer);
    el.textContent = text;
    el.removeAttribute('aria-label');
    el.dataset.rolled = '1';
    delete el.dataset.rolling;
  };

  // 绝对超时兜底（即使动画帧暂停或抛错，必定恢复原文）
  const safetyTimer = win.setTimeout(finish, totalDuration + 400);

  const step = (now) => {
    if (cleaned) return;
    try {
      let pending = false;
      const out = frameText(chars, preset, context, (index, base) => {
        const elapsed = now - start - index * STAGGER_MS;
        if (elapsed < 0) {
          pending = true;
          return base;
        }
        const stage = base + Math.floor(elapsed / STAGE_MS);
        if (stage < STAGES) pending = true;
        return stage;
      });
      el.textContent = out;
      if (pending) {
        win.requestAnimationFrame(step);
        return;
      }
    } catch {
      // 捕获异常，安全恢复
    }
    finish();
  };

  win.requestAnimationFrame(step);
}

export function initRoll(doc = globalThis.document, win = globalThis.window) {
  if (!doc?.querySelectorAll) return;
  if (doc.__qxRollInit) return;
  doc.__qxRollInit = true;

  if (win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const items = [...doc.querySelectorAll('[data-roll]')];
  if (!items.length) return;

  // 过滤有效元素并暂存原始文本，绝不预先篡改为乱码！
  const ready = items.filter((el) => {
    const text = (el.textContent || '').trim();
    if (!text || [...text].length > 28) return false;
    el.dataset.rollText = text;
    return true;
  });
  if (!ready.length) return;

  // 字体就绪后清理缓存，后续解码使用最新字形指标
  doc.fonts?.ready?.then?.(() => {
    atlasCache.clear();
    chainCache.clear();
  });

  let pageReleased = false;
  const pendingQueue = [];

  const release = () => {
    if (pageReleased) return;
    pageReleased = true;
    while (pendingQueue.length) {
      const el = pendingQueue.shift();
      rollElement(el, win);
    }
  };

  // 首屏就绪判定：监听 transition.js 的 siteLoaded 事件、load 事件或 readyState
  if (doc.documentElement.classList.contains('is-loaded') || doc.readyState === 'complete') {
    release();
  } else {
    win.addEventListener('siteLoaded', release, { once: true });
    win.addEventListener('load', release, { once: true });
    // 兜底 1.5s 后放行首屏解码
    win.setTimeout(release, 1500);
  }

  // 没有 IntersectionObserver 时全量放行
  if (typeof win?.IntersectionObserver !== 'function') {
    if (pageReleased) {
      for (const el of ready) rollElement(el, win);
    } else {
      for (const el of ready) pendingQueue.push(el);
    }
    return;
  }

  const hosts = new Map();
  for (const el of ready) {
    const host = el.closest('[data-reveal]') || el;
    if (!hosts.has(host)) hosts.set(host, []);
    hosts.get(host).push(el);
  }

  const observer = new win.IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const host = entry.target;
        observer.unobserve(host);
        const els = hosts.get(host) || [];
        for (const el of els) {
          if (pageReleased) {
            rollElement(el, win);
          } else {
            pendingQueue.push(el);
          }
        }
      }
    },
    // 正向扩展边距（50px），确保无论视口尺寸或滚动到页面底端时均能稳定触发
    { root: null, rootMargin: '50px 0px 50px 0px', threshold: 0.01 },
  );

  for (const host of hosts.keys()) observer.observe(host);
}
