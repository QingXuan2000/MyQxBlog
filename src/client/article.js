/* 文章页的三件事，阅读进度条、目录跟随滚动、代码复制。

   进度和目录都挂在滚动事件上，回调里只置一个标记，真正计算放到 requestAnimationFrame。
   滚动一秒钟能触发几十次，每次都量一遍 getBoundingClientRect 会让长文明显掉帧。

   backTop 的显隐走 class，不要加 hidden 属性。CSS 那边用 visibility 控制，
   两套机制混着用，会出现按钮永远不出现的情况。 */

/* 进度算法。文章比视口短时，只要整篇进过视口就算 100%，
   否则按可滚动的距离算，顶部为 0，底部为 100。 */
export function readingProgress({ top, height }, viewportHeight) {
  if (height <= 0) return 0;
  if (height <= viewportHeight) return top + height <= viewportHeight ? 100 : 0;
  return Math.round(Math.min(1, Math.max(0, -top / (height - viewportHeight))) * 100);
}

async function copyText(text, doc, win) {
  if (win.navigator.clipboard?.writeText) {
    await win.navigator.clipboard.writeText(text);
    return;
  }
  const previousFocus = doc.activeElement;
  const selection = win.getSelection?.();
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) =>
        selection.getRangeAt(index).cloneRange(),
      )
    : [];
  const textarea = doc.createElement('textarea');
  textarea.value = text;
  textarea.readOnly = true;
  textarea.setAttribute('aria-label', '待复制的代码');
  textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  doc.body.append(textarea);
  try {
    textarea.select();
    if (!doc.execCommand?.('copy')) throw new Error('Clipboard unavailable');
  } finally {
    textarea.remove();
    previousFocus?.focus({ preventScroll: true });
    if (selection && ranges.length) {
      selection.removeAllRanges();
      ranges.forEach((range) => selection.addRange(range));
    }
  }
}

function initCodeCopy(body, doc, win) {
  if (body) {
    body.querySelectorAll?.('figure[data-rehype-pretty-code-figure]')?.forEach?.((figure) => {
      const pre = figure.querySelector?.('pre');
      const lang = pre?.dataset?.language;
      const existingTitle = figure.querySelector?.('figcaption[data-rehype-pretty-code-title]');
      if (lang && !existingTitle && doc.createElement && figure.insertBefore) {
        const label = doc.createElement('figcaption');
        if (label.dataset) label.dataset.rehypePrettyCodeTitle = '';
        else label.setAttribute?.('data-rehype-pretty-code-title', '');
        label.textContent = lang;
        figure.insertBefore(label, pre);
      }
    });
  }
  body.querySelectorAll('pre').forEach((pre) => {
    const code = pre.querySelector('code');
    if (!code) return;
    const figure = pre.closest('figure');
    let button = figure?.querySelector('.code-copy') || pre.querySelector('.code-copy');
    if (!button) {
      button = doc.createElement('button');
      button.className = 'code-copy';
      button.textContent = '复制代码';
      (figure || pre).append(button);
    }
    button.type = 'button';
    button.setAttribute('aria-label', '复制代码');
    button.setAttribute('aria-live', 'polite');
    const defaultLabel = button.textContent || '复制代码';
    let resetTimer;
    button.addEventListener('click', async () => {
      win.clearTimeout(resetTimer);
      button.disabled = true;
      try {
        await copyText(code.textContent, doc, win);
        button.dataset.state = 'success';
        button.textContent = '已复制';
        button.setAttribute('aria-label', '代码已复制');
      } catch {
        button.dataset.state = 'error';
        button.textContent = '复制失败，请手动选择';
        button.setAttribute('aria-label', '复制失败，请手动选择代码');
      } finally {
        button.disabled = false;
        resetTimer = win.setTimeout(
          () => {
            delete button.dataset.state;
            button.textContent = defaultLabel;
            button.setAttribute('aria-label', '复制代码');
          },
          button.dataset.state === 'error' ? 4500 : 2200,
        );
      }
    });
  });
}

export function initArticle(doc = globalThis.document, win = globalThis.window) {
  if (!doc || !win) return;
  const body = doc.querySelector('[data-post-body]');
  const progress = doc.querySelector('[data-reading-progress]');
  const backTop = doc.querySelector('[data-back-top]');
  const toc = doc.querySelector('[data-toc]');
  if (body) initCodeCopy(body, doc, win);
  if (!body && !backTop) return;

  const headings = [];
  if (body && toc) {
    toc.querySelectorAll('a[href*="#"]').forEach((link) => {
      try {
        const url = new URL(link.getAttribute('href'), win.location.href);
        if (
          url.pathname !== win.location.pathname ||
          url.origin !== win.location.origin ||
          !url.hash
        )
          return;
        const heading = doc.getElementById(decodeURIComponent(url.hash.slice(1)));
        if (heading && body.contains(heading)) headings.push({ heading, link });
      } catch {
        /* 锚点格式异常不影响文章其余功能。 */
      }
    });
  }
  let currentHeading;
  let scheduled = false;

  function update() {
    scheduled = false;
    const viewportHeight = win.innerHeight || doc.documentElement.clientHeight;
    if (body && progress) {
      const value = readingProgress(body.getBoundingClientRect(), viewportHeight);
      progress.style.width = `${value}%`;
      progress.setAttribute('aria-valuemin', '0');
      progress.setAttribute('aria-valuemax', '100');
      progress.setAttribute('aria-valuenow', String(value));
      if (!progress.hasAttribute('aria-label')) progress.setAttribute('aria-label', '文章阅读进度');
      if (!progress.hasAttribute('role')) progress.setAttribute('role', 'progressbar');
      if (progress.tagName === 'PROGRESS') {
        progress.max = 100;
        progress.value = value;
      }
    }
    if (backTop) {
      const visible = win.scrollY > Math.max(300, viewportHeight * 0.6);
      if (!visible && doc.activeElement === backTop) {
        const target = doc.querySelector('main');
        if (target) {
          if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        }
      }
      // 显隐交给 CSS 的 .is-visible，别在这里补 hidden 属性。
      backTop.classList.toggle('is-visible', visible);
    }
    if (headings.length) {
      let active = headings[0];
      for (const entry of headings) {
        if (entry.heading.getBoundingClientRect().top <= 120) active = entry;
        else break;
      }
      if (win.scrollY + viewportHeight >= doc.documentElement.scrollHeight - 2)
        active = headings.at(-1);
      if (currentHeading !== active) {
        headings.forEach(({ link }) => {
          const selected = link === active.link;
          if (selected) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
          link.classList.toggle('is-active', selected);
        });
        currentHeading = active;
      }
    }
  }

  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    win.requestAnimationFrame(update);
  }

  if (backTop)
    backTop.addEventListener('click', (event) => {
      event.preventDefault();
      const reducedMotion = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      win.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    });
  win.addEventListener('scroll', scheduleUpdate, { passive: true });
  win.addEventListener('resize', scheduleUpdate, { passive: true });
  win.addEventListener('hashchange', scheduleUpdate);
  win.addEventListener('load', scheduleUpdate, { once: true });
  if (body && typeof win.ResizeObserver === 'function')
    new win.ResizeObserver(scheduleUpdate).observe(body);
  doc.fonts?.ready.then(scheduleUpdate).catch(() => {});
  update();
}
