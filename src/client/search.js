/* 前端全文搜索。索引是构建时生成的 assets/search.json，打开面板才去取。

   几个地方是为真实输入场景写的。中文输入法在拼字过程中会不停触发 input，
   那时搜出来的是拼音串，所以要等 compositionend；索引地址有三种猜测方式，
   自定义域名、项目站点、相对路径各能覆盖一类；关闭动画得等关键帧跑完再撤 dialog，
   不然整块面板会瞬间消失。 */
const normalize = (value) =>
  String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase();

/* 命中规则很朴素。按空白切词，每个词都得落在某个字段里，全中才算命中。
   分数按字段给权重，标题 8、标签 4、摘要 2、正文 1，所以标题里有的排前面。 */
export function searchPosts(posts, query) {
  const words = [...new Set(normalize(query).trim().split(/\s+/).filter(Boolean))];
  if (!words.length || !Array.isArray(posts)) return [];

  return posts
    .map((post, order) => {
      const fields = [
        [normalize(post.title), 8],
        [normalize(Array.isArray(post.labels) ? post.labels.join(' ') : ''), 4],
        [normalize(post.excerpt), 2],
        [normalize(post.text), 1],
      ];
      let score = 0;
      for (const word of words) {
        const match = fields.find(([text]) => text.includes(word));
        if (!match) return null;
        score += match[1];
      }
      return { post, score, order };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((item) => item.post);
}

/* 索引地址靠三次尝试定下来。先读 meta 里的 qx-base，再顺着 stylesheet 的 href
   反推前缀，最后退回当前文档的相对路径。三种都失败就还是 404，面板会提示重试。 */
function basePathOf(doc) {
  const configured = doc.querySelector('meta[name="qx-base"]')?.content;
  if (configured) {
    const parts = String(configured).split('/').filter(Boolean);
    return parts.length ? `/${parts.join('/')}/` : '/';
  }
  const link = doc.querySelector('link[rel="stylesheet"][href*="assets/"]')?.getAttribute?.('href');
  const match = typeof link === 'string' ? /^(.*?)assets\//.exec(link) : null;
  if (match) return match[1] || '/';
  return '/';
}

function indexPathCandidates(doc) {
  const base = basePathOf(doc);
  const candidates = [`${base}assets/search.json`.replace(/(?<!:)\/{2,}/g, '/')];
  for (const extra of ['assets/search.json', '../assets/search.json']) {
    const url = new URL(extra, globalThis.location?.href || 'http://localhost/').pathname;
    if (!candidates.includes(url)) candidates.push(url);
  }
  return candidates;
}

const MAX_RESULTS = 30;
const RECENT_RESULTS = 8;

export function initSearch(doc = globalThis.document, win = globalThis.window) {
  if (!doc || !win) return;
  const dialog = doc.querySelector('[data-search-dialog]');
  const input = dialog?.querySelector('[data-search-input]');
  const results = dialog?.querySelector('[data-search-results]');
  const status = dialog?.querySelector('[data-search-status]');
  if (!dialog || !input || !results || !status) return;
  const counter = dialog.querySelector('[data-search-count]');

  const openers = [...doc.querySelectorAll('[data-search-open]')];
  const candidates = indexPathCandidates(doc);
  let indexAttempt = 0;
  let indexPromise;
  let revision = 0;
  let activeIndex = -1;
  let resultLinks = [];
  let previousFocus;
  let scrollOverflow;
  let composing = false;
  let debounceTimer;
  let renderedQuery = null;
  const compositionKey = (event) => composing || event.isComposing || event.keyCode === 229;

  if (!results.id) results.id = 'qx-search-results';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', results.id);
  input.setAttribute('aria-expanded', 'false');
  results.setAttribute('role', 'listbox');
  results.setAttribute('aria-label', '搜索结果');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');

  function setCount(text) {
    if (counter) counter.textContent = text;
  }

  function setActive(next) {
    activeIndex = next;
    resultLinks.forEach((link, index) => {
      const active = index === activeIndex;
      link.setAttribute('aria-selected', String(active));
      link.classList.toggle('is-active', active);
    });
    const active = resultLinks[activeIndex];
    if (active) {
      input.setAttribute('aria-activedescendant', active.id);
      active.scrollIntoView?.({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function clearResults() {
    resultLinks = [];
    setActive(-1);
    results.replaceChildren();
  }

  function loadIndex() {
    if (!indexPromise) {
      const url = candidates[Math.min(indexAttempt, candidates.length - 1)];
      indexAttempt += 1;
      indexPromise = win
        .fetch(url, {
          credentials: 'same-origin',
          cache: 'force-cache',
        })
        .then((response) => {
          if (!response.ok) throw new Error('Search index request failed');
          return response.json();
        })
        .then((posts) => {
          if (!Array.isArray(posts)) throw new Error('Invalid search index');
          return posts.filter(
            (post) => post && typeof post.title === 'string' && typeof post.url === 'string',
          );
        })
        .catch((error) => {
          indexPromise = undefined;
          throw error;
        });
    }
    return indexPromise;
  }

  function appendResult(post, index) {
    const link = doc.createElement('a');
    link.className = 'search-result';
    link.id = `qx-search-result-${index}`;
    link.href = post.url;
    link.setAttribute('role', 'option');
    link.setAttribute('aria-selected', 'false');
    const title = doc.createElement('span');
    title.className = 'search-result-title qx-ul';
    title.textContent = post.title;
    const excerpt = doc.createElement('span');
    excerpt.className = 'search-result-excerpt';
    excerpt.textContent = post.excerpt || String(post.text || '').slice(0, 140);
    const meta = doc.createElement('span');
    meta.className = 'search-result-meta';
    meta.textContent = [post.date?.slice(0, 10), ...(Array.isArray(post.labels) ? post.labels : [])]
      .filter(Boolean)
      .join(' · ');
    link.append(title, excerpt, meta);
    link.addEventListener('pointermove', () => setActive(index));
    link.addEventListener('focus', () => setActive(index));
    resultLinks.push(link);
    results.append(link);
  }

  function render(posts, query) {
    renderedQuery = query;
    clearResults();
    const trimmed = query.trim();
    results.setAttribute('aria-busy', 'false');

    if (!trimmed) {
      const recent = posts.slice(0, RECENT_RESULTS);
      recent.forEach((post, index) => appendResult(post, index));
      status.textContent = posts.length
        ? `输入关键词开始搜索，下面是最近更新的 ${recent.length} 篇`
        : '还没有可搜索的文章，先写一篇吧';
      setCount(posts.length ? `${posts.length} 篇可搜索` : '0 篇');
      return;
    }

    const matches = searchPosts(posts, query).filter((post) => {
      try {
        const url = new URL(post.url, win.location.href);
        return ['http:', 'https:'].includes(url.protocol) && url.origin === win.location.origin;
      } catch {
        return false;
      }
    });

    const shown = matches.slice(0, MAX_RESULTS);
    shown.forEach((post, index) => appendResult(post, index));
    status.textContent = matches.length
      ? `找到 ${matches.length} 篇文章${matches.length > MAX_RESULTS ? `，显示前 ${MAX_RESULTS} 篇` : ''}`
      : '没有找到相关文章，换个关键词试试';
    setCount(matches.length ? `${shown.length} / ${matches.length}` : '0');
  }

  async function update() {
    const requestRevision = ++revision;
    const query = input.value;
    clearResults();
    setCount('');
    results.setAttribute('aria-busy', 'true');
    status.textContent = '正在加载搜索索引…';
    try {
      const posts = await loadIndex();
      if (!dialog.open || requestRevision !== revision) return;
      render(posts, query);
    } catch {
      if (!dialog.open || requestRevision !== revision) return;
      results.setAttribute('aria-busy', 'false');
      status.textContent = '搜索索引加载失败，再输入一次或重新打开搜索即可重试';
    } finally {
      if (requestRevision === revision) results.setAttribute('aria-busy', 'false');
    }
  }

  function scheduleUpdate() {
    win.clearTimeout(debounceTimer);
    debounceTimer = win.setTimeout(() => void update(), 120);
  }

  function restoreFocus() {
    ++revision;
    win.clearTimeout(debounceTimer);
    composing = false;
    input.setAttribute('aria-expanded', 'false');
    results.setAttribute('aria-busy', 'false');
    doc.documentElement.style.overflow = scrollOverflow ?? '';
    if (previousFocus?.isConnected) previousFocus.focus();
  }

  // 退场交给 .is-closing 的关键帧。dialog.close() 会立刻把面板撤出 top layer，
  // 所以必须等动画跑完再关，否则用户看不到那一下收起。
  const EXIT_MS = 520;
  let closing = false;
  let exitTimer = 0;
  let exitHandler = null;

  function cancelExit() {
    if (exitTimer) {
      win.clearTimeout?.(exitTimer);
      exitTimer = 0;
    }
    if (exitHandler) {
      dialog.removeEventListener?.('animationend', exitHandler);
      exitHandler = null;
    }
    if (closing) {
      closing = false;
      dialog.classList?.remove?.('is-closing');
    }
  }

  function close() {
    if (!dialog.open || closing) return;

    const finish = () => {
      cancelExit();
      if (typeof dialog.close === 'function') dialog.close();
      else {
        dialog.removeAttribute('open');
        restoreFocus();
      }
    };

    // 宿主不支持 classList 或 rAF 时直接关，别在动画上卡住。
    if (typeof win.requestAnimationFrame !== 'function' || !dialog.classList) {
      finish();
      return;
    }

    closing = true;
    dialog.classList.add('is-closing');
    let done = false;
    const once = () => {
      if (done) return;
      done = true;
      finish();
    };
    exitHandler = (event) => {
      if (event.target === dialog) once();
    };
    dialog.addEventListener('animationend', exitHandler);
    exitTimer = win.setTimeout(once, EXIT_MS);
  }

  function open() {
    cancelExit();
    if (dialog.open) {
      input.focus();
      input.select?.();
      return;
    }
    previousFocus = doc.activeElement;
    scrollOverflow = doc.documentElement.style.overflow;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    doc.documentElement.style.overflow = 'hidden';
    input.setAttribute('aria-expanded', 'true');
    input.focus();
    void update();
  }

  openers.forEach((button) => button.addEventListener('click', open));
  dialog
    .querySelectorAll('[data-search-close]')
    .forEach((button) => button.addEventListener('click', close));
  dialog.addEventListener('close', restoreFocus);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (!composing) close();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      close();
  });
  input.addEventListener('input', () => {
    if (composing) return;
    scheduleUpdate();
  });
  input.addEventListener('compositionstart', () => {
    composing = true;
  });
  input.addEventListener('compositionend', () => {
    composing = false;
    // 输入法刚结束，内容没变就别重搜，否则会把紧跟着的 Enter 选中打断。
    if (input.value !== renderedQuery) scheduleUpdate();
  });
  input.addEventListener('keydown', (event) => {
    if (compositionKey(event)) return;
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && resultLinks.length) {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActive(
        activeIndex < 0
          ? direction === 1
            ? 0
            : resultLinks.length - 1
          : (activeIndex + direction + resultLinks.length) % resultLinks.length,
      );
    } else if ((event.key === 'Home' || event.key === 'End') && resultLinks.length) {
      event.preventDefault();
      setActive(event.key === 'Home' ? 0 : resultLinks.length - 1);
    } else if (event.key === 'Enter' && resultLinks.length && !event.isComposing) {
      event.preventDefault();
      resultLinks[activeIndex < 0 ? 0 : activeIndex].click();
    }
  });
  dialog.addEventListener('keydown', (event) => {
    if (compositionKey(event)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button, input, a[href], [tabindex]')].filter(
      (element) => !element.disabled && element.tabIndex >= 0 && !element.hidden,
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && doc.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && doc.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  doc.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !event.altKey) {
      event.preventDefault();
      if (dialog.open) close();
      else open();
    }
  });
}
