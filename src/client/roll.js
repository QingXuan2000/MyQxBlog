/* 解码式入场。每个字先显示一个形近字，逐级收敛，最后落到真字上。

   形近字不写死表，运行时算。汉字取同区块的邻近码位，CJK 统一表意文字按部首和笔画数
   排序，相邻码位往往同部首、笔画也接近，看上去就是一路在变像。其他字符走另一条路，
   把候选字符用当前字体画成位图，和目标字比墨量分布，取最接近的几个当阶梯。
   这样换了字重、换了字体，阶梯自动跟着变，不用维护任何映射。

   两条路都走不通时保持原样。字体缺字、没有 canvas、码位出了汉字区，都会退回原文，
   动画少一段总比标题变成乱码强。 */
const STAGES = 6;
const STAGE_MS = 82;
const STAGGER_MS = 32;

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

/* 只按字族、字重、斜体分桶。字号不改变字形，页面用了几个字号也只算一次。 */
function fontKey(el, win) {
  const cs = win.getComputedStyle(el);
  return `${cs.fontStyle} ${cs.fontWeight} ${cs.fontFamily}`;
}

function paintFont(el, win) {
  const cs = win.getComputedStyle(el);
  return `${cs.fontStyle} ${cs.fontWeight} ${SAMPLE_PX}px ${cs.fontFamily}`;
}

/* 一次性把候选字符画进一张长条画布，只取一次 ImageData，
   再切成每格的二值蒙版（有墨 / 无墨）。 */
function atlasFor(doc, el, win, key) {
  if (atlasCache.has(key)) return atlasCache.get(key);
  let atlas = null;
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
  atlasCache.set(key, atlas);
  return atlas;
}

/* 把二值掩膜压成 GRID×GRID 的墨量分布：单像素差异会被平均掉，
   剩下的差异代表整体字形结构，比逐像素 XOR 更接近人眼判断。 */
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

/* 差异按两字的墨量归一化：绝对值会让「窄字配宽字」也算接近
   （l 和 B 的 XOR 只差在横笔），归一化后更偏向体量相当的形近字。 */
function similarity(target, candidate) {
  let diff = 0;
  for (let i = 0; i < target.profile.length; i += 1)
    diff += Math.abs(target.profile[i] - candidate.profile[i]);
  const base = diff / (target.ink + candidate.ink);
  // 大小写、数字与字母混用会让台阶看起来太跳，轻微降权。
  return classOf(target.char) === classOf(candidate.char) ? base : base + 0.06;
}

/* 取「最像的 STAGES 个」，再从最不像排到最像：
   逐级收敛，最后一步回到真字。 */
function similarChain(doc, el, win, key, char) {
  const cacheKey = `${key}|${char}`;
  if (chainCache.has(cacheKey)) return chainCache.get(cacheKey);

  const atlas = atlasFor(doc, el, win, key);
  let chain = null;
  if (atlas) {
    const target = atlas.masks.find((item) => item.char === char);
    if (target && target.ink > 0) {
      chain = atlas.masks
        .filter(
          (item) =>
            item.char !== char &&
            item.ink > 0 &&
            // 笔画量差一个数量级的字形不参与比较，否则会挑出胖瘦迥异的字
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
  chainCache.set(cacheKey, chain);
  return chain;
}

// 阶段 → 链上位置：链比阶段短时按比例取，避免后半段完全静止。
const position = (stage, length) =>
  length <= 1 ? 0 : Math.round((stage / (STAGES - 1)) * (length - 1));

function lookalike(char, stage, { doc, el, win, key }) {
  const chain = similarChain(doc, el, win, key, char);
  if (chain?.length) return chain[position(stage, chain.length)];

  const code = char.codePointAt(0);
  if (code >= 0x4e00 && code <= 0x9fff) {
    const delta = CJK_DELTAS[position(stage, CJK_DELTAS.length)];
    const next = code + delta > 0x9fff ? code - delta : code + delta;
    if (next >= 0x4e00 && next <= 0x9fff) return String.fromCodePoint(next);
  }
  return char;
}

/* 把整句按给定阶梯拼成当前帧的字符串。
   始终只有一个文本节点：排版交给浏览器对整行正常处理，
   不拆成逐字盒子，也就不需要事后「重组」回正常句子。 */
function frameText(chars, stages, context, stageOf) {
  let out = '';
  for (let index = 0; index < chars.length; index += 1) {
    const stage = stageOf(index, stages[index]);
    out += stage >= STAGES ? chars[index] : lookalike(chars[index], stage, context);
  }
  return out;
}

function build(el, doc, win) {
  const text = (el.textContent || '').trim();
  if (!text || el.dataset.rollReady === '1') return false;
  el.dataset.rollReady = '1';

  const chars = [...text];
  const context = { doc, el, win, key: fontKey(el, win) };
  // 每个字随机落在前三个阶梯上：加载阶段看到的已经是乱码，
  // 解码时从这个阶梯继续往前推，不会往回跳。
  const stages = chars.map(() => Math.floor(Math.random() * 3));

  el.dataset.rollText = text;
  el.dataset.rollStages = stages.join(',');
  // 动画期间文字是乱的，把原文挂到 aria-label，读屏拿到的仍是真标题；
  // 结束后移除，DOM 里只剩一行正常文本。
  el.setAttribute('aria-label', text);
  el.textContent = frameText(chars, stages, context, (index) => stages[index]);
  return true;
}

function animate(el, win) {
  const text = el.dataset.rollText;
  if (text == null || typeof win?.requestAnimationFrame !== 'function') return;

  const chars = [...text];
  const preset = (el.dataset.rollStages || '').split(',').map((value) => Number(value) || 0);
  const context = { doc: el.ownerDocument, el, win, key: fontKey(el, win) };
  const start = win.performance?.now?.() ?? Date.now();

  const step = (now) => {
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
    // 收尾：仍写同一个文本节点，只是内容变回原文（此时 aria-label 已无必要）。
    el.textContent = text;
    el.removeAttribute('aria-label');
    delete el.dataset.rollText;
    delete el.dataset.rollStages;
  };

  win.requestAnimationFrame(step);
}

export function initRoll(doc = globalThis.document, win = globalThis.window) {
  if (!doc?.querySelectorAll) return;
  if (win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const items = [...doc.querySelectorAll('[data-roll]')];
  if (!items.length) return;

  // 超过 28 字的长标题保持静态（避免首帧构建过多字符节点）。
  const ready = items.filter((el) => {
    const text = (el.textContent || '').trim();
    return text && [...text].length <= 28 && build(el, doc, win);
  });
  if (!ready.length) return;

  // 字体晚到会让字形蒙版算错（形状取自当时的字体），就绪后丢缓存重算。
  // 这里不再需要重钉字宽 —— 文字始终是整行一个文本节点，宽度本来就由浏览器排版。
  doc.fonts?.ready?.then?.(() => {
    atlasCache.clear();
    chainCache.clear();
  });

  if (typeof win?.IntersectionObserver !== 'function') {
    for (const el of ready) animate(el, win);
    return;
  }

  /* 解码从「加载完成」开始，不等幕布升上去：
     load 代表文档与关键资源就绪，此时开播最贴合用户对「页面好了」的感知；
     幕布还在时开播，用户会在幕布抽走的过程中看到标题逐渐成形。 */
  const queue = [];
  let released = false;

  const release = () => {
    if (released) return;
    released = true;
    for (const el of queue.splice(0)) animate(el, win);
  };

  if (doc.readyState === 'complete') {
    release();
  } else {
    win.addEventListener('load', release, { once: true });
    // 资源卡住时 load 可能很晚，兜底避免标题一直停在乱码上。
    win.setTimeout(release, 2600);
  }

  const run = (el) => (released ? animate(el, win) : queue.push(el));

  /* 观察对象是「宿主」：列表卡片的标题挂在 [data-reveal] 里，
     卡片进入视口时 reveal 会给卡片加 .is-in 做淡入，这里同时启动解码，
     两者同拍，标题不会提前播完。 */
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
        for (const el of hosts.get(entry.target) || []) run(el);
        observer.unobserve(entry.target);
      }
    },
    { root: null, rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
  );

  for (const host of hosts.keys()) observer.observe(host);
}
