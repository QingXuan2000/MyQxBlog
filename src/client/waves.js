/* 首页那片会动的线场，外加页面上那几条二进制分隔条。

   Noise 是 2D Perlin 的实现，公式来自 Antoine Wodniack 的开源版本，见 README 的致谢。
   他自己那份用 canvas 画，这里改成 SVG path，好处是缩放不糊、颜色能跟着主题变量走，
   代价是每帧要重写一百多条 d 属性。

   成本都花在每帧那几千次三角函数上，所以有三道刹车。帧率压到 30，波浪本来就是慢动作，
   六十帧没有肉眼收益；页面切到后台、或者线场滚出视口就停 rAF；尺寸变化只用
   ResizeObserver 监听容器，window.resize 抓不到地址栏收放这类变化。 */
class Grad {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  dot2(x, y) {
    return this.x * x + this.y * y;
  }
}

class Noise {
  constructor(seed = 0) {
    this.grad3 = [
      new Grad(1, 1, 0),
      new Grad(-1, 1, 0),
      new Grad(1, -1, 0),
      new Grad(-1, -1, 0),
      new Grad(1, 0, 1),
      new Grad(-1, 0, 1),
      new Grad(1, 0, -1),
      new Grad(-1, 0, -1),
      new Grad(0, 1, 1),
      new Grad(0, -1, 1),
      new Grad(0, 1, -1),
      new Grad(0, -1, -1),
    ];

    this.p = [
      151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69,
      142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219,
      203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
      74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230,
      220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209,
      76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198,
      173, 186, 3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212,
      207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44,
      154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79,
      113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12,
      191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157,
      184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29,
      24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
    ];

    this.perm = new Array(512);
    this.gradP = new Array(512);

    this.seed(seed);
  }

  seed(seed) {
    if (seed > 0 && seed < 1) seed *= 65536;
    seed = Math.floor(seed);
    if (seed < 256) seed |= seed << 8;

    for (let i = 0; i < 256; i++) {
      let v = i & 1 ? this.p[i] ^ (seed & 255) : this.p[i] ^ ((seed >> 8) & 255);
      this.perm[i] = this.perm[i + 256] = v;
      this.gradP[i] = this.gradP[i + 256] = this.grad3[v % 12];
    }
  }

  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  lerp(a, b, t) {
    return (1 - t) * a + t * b;
  }

  perlin2(x, y) {
    let X = Math.floor(x);
    let Y = Math.floor(y);

    x -= X;
    y -= Y;

    X = X & 255;
    Y = Y & 255;

    const n00 = this.gradP[X + this.perm[Y]].dot2(x, y);
    const n01 = this.gradP[X + this.perm[Y + 1]].dot2(x, y - 1);
    const n10 = this.gradP[X + 1 + this.perm[Y]].dot2(x - 1, y);
    const n11 = this.gradP[X + 1 + this.perm[Y + 1]].dot2(x - 1, y - 1);

    const u = this.fade(x);
    return this.lerp(this.lerp(n00, n10, u), this.lerp(n01, n11, u), this.fade(y));
  }
}

export function initWaves(doc = globalThis.document, win = globalThis.window) {
  if (!doc || !win || typeof doc.querySelector !== 'function') return;

  const header = doc.querySelector('.s__waves') || doc.querySelector('.qx-site-intro-header');
  const svg = header?.querySelector('.qx-waves-svg');
  if (!header || !svg) return;

  const noise = new Noise(Math.random());

  const mouse = {
    x: -200,
    y: -200,
    lx: 0,
    ly: 0,
    sx: -200,
    sy: -200,
    v: 0,
    vs: 0,
    a: 0,
    set: false,
  };

  let lines = [];
  let paths = [];
  let bounding = { width: 0, height: 0 };
  let isPaused = false;
  let rafId = null;
  let lastFrame = 0;

  /* 每帧要重算约 4900 个点再写 160 多条 path，60fps 纯属浪费：
     波浪本身是慢速运动，30fps 与 60fps 肉眼几乎无差，CPU 直接减半。 */
  const FRAME_MS = 1000 / 30;

  const prefersReduced = win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  function updateSize() {
    bounding = {
      width: header.clientWidth,
      height: header.clientHeight,
    };
    // 一律按容器实际尺寸拉伸：默认的 xMidYMid meet 会在宽高比变化时
    // 上下留出空白带，滚动 / 移动端地址栏收放时会出现「留空」。
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('viewBox', `0 0 ${bounding.width} ${bounding.height}`);
  }

  function setLines() {
    updateSize();
    const { width, height } = bounding;
    if (width <= 0 || height <= 0) return;

    lines = [];
    paths.forEach((p) => p.remove());
    paths = [];

    const xGap = 10;
    const yGap = 32;

    const oWidth = width + 200;
    const oHeight = height + 30;

    const totalLines = Math.ceil(oWidth / xGap);
    const totalPoints = Math.ceil(oHeight / yGap);

    const xStart = (width - xGap * totalLines) / 2;
    const yStart = (height - yGap * totalPoints) / 2;

    for (let i = 0; i <= totalLines; i++) {
      const points = [];
      for (let j = 0; j <= totalPoints; j++) {
        points.push({
          x: xStart + xGap * i,
          y: yStart + yGap * j,
          wave: { x: 0, y: 0 },
          cursor: { x: 0, y: 0, vx: 0, vy: 0 },
        });
      }

      const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'qx-wave-line a__line js-line');
      svg.appendChild(path);
      paths.push(path);
      lines.push(points);
    }

    drawLines();
  }

  function movePoints(time) {
    for (let l = 0; l < lines.length; l++) {
      const points = lines[l];
      for (let pIdx = 0; pIdx < points.length; pIdx++) {
        const p = points[pIdx];

        // 2D Perlin 噪声决定每个点这一帧走到哪儿，两个方向的频率故意不同，
        // 同一处不会整块同步移动。
        const move =
          noise.perlin2((p.x + time * 0.0125) * 0.002, (p.y + time * 0.005) * 0.0015) * 12;

        p.wave.x = Math.cos(move) * 32;
        p.wave.y = Math.sin(move) * 16;

        // 光标附近的点被推开一点，指针停住时涟漪自己衰减回去。
        const dx = p.x - mouse.sx;
        const dy = p.y - mouse.sy;
        const d = Math.sqrt(dx * dx + dy * dy);
        const lRadius = Math.max(175, mouse.vs);

        if (d < lRadius) {
          const s = 1 - d / lRadius;
          const f = Math.cos(d * 0.001) * s;
          p.cursor.vx += Math.cos(mouse.a) * f * lRadius * mouse.vs * 0.00065;
          p.cursor.vy += Math.sin(mouse.a) * f * lRadius * mouse.vs * 0.00065;
        }

        // 回弹加阻尼。系数调到 0.005 和 0.925 是试出来的，再大就抖，再小拖着不回位。
        p.cursor.vx += (0 - p.cursor.x) * 0.005;
        p.cursor.vy += (0 - p.cursor.y) * 0.005;
        p.cursor.vx *= 0.925;
        p.cursor.vy *= 0.925;

        p.cursor.x += p.cursor.vx * 2;
        p.cursor.y += p.cursor.vy * 2;

        p.cursor.x = Math.min(100, Math.max(-100, p.cursor.x));
        p.cursor.y = Math.min(100, Math.max(-100, p.cursor.y));
      }
    }
  }

  function moved(point) {
    return {
      x: Math.round((point.x + point.wave.x + point.cursor.x) * 10) / 10,
      y: Math.round((point.y + point.wave.y + point.cursor.y) * 10) / 10,
    };
  }

  function drawLines() {
    for (let l = 0; l < lines.length; l++) {
      const points = lines[l];
      if (!points.length || !paths[l]) continue;

      const p1 = moved(points[0]);
      // 逐段拼字符串会产生上百次临时字符串，先收集再 join。
      const segments = [`M ${p1.x} ${p1.y}`];

      for (let i = 1; i < points.length; i++) {
        const pt = moved(points[i]);
        segments.push(`L ${pt.x} ${pt.y}`);
      }

      paths[l].setAttribute('d', segments.join(' '));
    }
  }

  function updateMouse(clientX, clientY) {
    const rect = header.getBoundingClientRect();
    mouse.x = clientX - rect.left;
    mouse.y = clientY - rect.top;

    if (!mouse.set) {
      mouse.sx = mouse.x;
      mouse.sy = mouse.y;
      mouse.lx = mouse.x;
      mouse.ly = mouse.y;
      mouse.set = true;
    }
  }

  function tick(timestamp) {
    if (isPaused) return;

    // 帧率上限：够不着间隔就只安排下一帧，不做任何计算。
    if (timestamp - lastFrame < FRAME_MS - 4) {
      rafId = requestAnimationFrame(tick);
      return;
    }
    lastFrame = timestamp;

    mouse.sx += (mouse.x - mouse.sx) * 0.1;
    mouse.sy += (mouse.y - mouse.sy) * 0.1;

    const dx = mouse.x - mouse.lx;
    const dy = mouse.y - mouse.ly;
    const dist = Math.sqrt(dx * dx + dy * dy);

    mouse.v = dist;
    mouse.vs += (dist - mouse.vs) * 0.1;
    mouse.vs = Math.min(100, mouse.vs);

    mouse.lx = mouse.x;
    mouse.ly = mouse.y;
    mouse.a = Math.atan2(dy, dx);

    header.style.setProperty('--x', `${mouse.sx}px`);
    header.style.setProperty('--y', `${mouse.sy}px`);

    movePoints(timestamp);
    drawLines();

    rafId = requestAnimationFrame(tick);
  }

  const onMouseMove = (e) => updateMouse(e.clientX, e.clientY);
  const onTouchMove = (e) => {
    if (e.touches && e.touches[0]) {
      updateMouse(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  win.addEventListener('mousemove', onMouseMove, { passive: true });
  win.addEventListener('touchmove', onTouchMove, { passive: true });

  // 容器尺寸一变就重建路径。window.resize 抓不到柔性布局（地址栏收放、
  // flex 高度变化、字体加载后回流），只有 ResizeObserver 能跟上。
  let relayoutRaf = 0;
  const scheduleRelayout = () => {
    if (relayoutRaf) return;
    relayoutRaf = requestAnimationFrame(() => {
      relayoutRaf = 0;
      setLines();
    });
  };

  if (typeof win.ResizeObserver === 'function') {
    new win.ResizeObserver(scheduleRelayout).observe(header);
  }
  win.addEventListener('resize', scheduleRelayout, { passive: true });
  win.addEventListener('orientationchange', scheduleRelayout, { passive: true });

  doc.addEventListener('visibilitychange', () => {
    if (doc.hidden) {
      isPaused = true;
      if (rafId) cancelAnimationFrame(rafId);
    } else {
      isPaused = false;
      rafId = requestAnimationFrame(tick);
    }
  });

  if (typeof win.IntersectionObserver === 'function') {
    const observer = new win.IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (isPaused) {
          isPaused = false;
          if (!prefersReduced) rafId = requestAnimationFrame(tick);
        }
      } else {
        isPaused = true;
        if (rafId) cancelAnimationFrame(rafId);
      }
    });
    observer.observe(header);
  }

  setLines();
  if (!prefersReduced && typeof requestAnimationFrame === 'function') {
    rafId = requestAnimationFrame(tick);
  }
}

export function initSeparators(doc = globalThis.document) {
  if (!doc || typeof doc.querySelectorAll !== 'function') return;
  const chars = doc.querySelectorAll('.js-char');
  if (!chars.length) return;

  // 尊重系统的「减少动态效果」设置：静默保留初始二进制串。
  if (
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return;

  // 单字符平均翻转率 = FLIP_CHANCE / TICK_MS。
  // 140ms + 8% 约 0.57 次/秒，偏慢；100ms + 12% 约 1.2 次/秒。
  const TICK_MS = 100;
  const FLIP_CHANCE = 0.12;
  let timer = 0;

  const tick = () => {
    chars.forEach((char) => {
      if (char.classList.contains('a__char--blank') || Math.random() > FLIP_CHANCE) return;
      const isOne = Math.random() > 0.5;
      char.textContent = isOne ? '1' : '0';
      if (isOne) {
        char.classList.remove('a__char--0');
        char.classList.add('a__char--1');
      } else {
        char.classList.remove('a__char--1');
        char.classList.add('a__char--0');
      }
    });
  };

  const start = () => {
    if (timer) return;
    timer = setInterval(tick, TICK_MS);
  };

  const stop = () => {
    clearInterval(timer);
    timer = 0;
  };

  start();

  if (typeof doc.addEventListener === 'function') {
    // 切走时停掉定时器省电，切回来必须重新启动，否则整条分隔条会停在原处。
    doc.addEventListener('visibilitychange', () => (doc.hidden ? stop() : start()));
  }
}
