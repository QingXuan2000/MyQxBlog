const normalize = (value) =>
  String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase();

/** 匹配每个以空白分隔的词，标题与标签优先。 */
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

function getBasePath(doc) {
  const configured = doc.querySelector('meta[name="qx-base"]')?.content || '/';
  const parts = configured.split('/').filter(Boolean);
  return parts.length ? `/${parts.join('/')}/` : '/';
}

export function initSearch(doc = globalThis.document, win = globalThis.window) {
  if (!doc || !win) return;
  const dialog = doc.querySelector('[data-search-dialog]');
  const input = dialog?.querySelector('[data-search-input]');
  const results = dialog?.querySelector('[data-search-results]');
  const status = dialog?.querySelector('[data-search-status]');
  if (!dialog || !input || !results || !status) return;

  const openers = [...doc.querySelectorAll('[data-search-open]')];
  let indexPromise;
  let revision = 0;
  let activeIndex = -1;
  let resultLinks = [];
  let previousFocus;
  let scrollOverflow;
  let composing = false;
  let debounceTimer;
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
      indexPromise = win
        .fetch(`${getBasePath(doc)}assets/search.json`, {
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

  function render(posts, query) {
    clearResults();
    if (!query.trim()) {
      status.textContent = '输入关键词搜索文章';
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
    for (const [index, post] of matches.slice(0, 30).entries()) {
      const link = doc.createElement('a');
      link.className = 'search-result';
      link.id = `qx-search-result-${index}`;
      link.href = post.url;
      link.setAttribute('role', 'option');
      link.setAttribute('aria-selected', 'false');
      const title = doc.createElement('span');
      title.className = 'search-result-title';
      title.textContent = post.title;
      const excerpt = doc.createElement('span');
      excerpt.className = 'search-result-excerpt';
      excerpt.textContent = post.excerpt || String(post.text || '').slice(0, 140);
      const meta = doc.createElement('span');
      meta.className = 'search-result-meta';
      meta.textContent = [
        post.date?.slice(0, 10),
        ...(Array.isArray(post.labels) ? post.labels : []),
      ]
        .filter(Boolean)
        .join(' · ');
      link.append(title, excerpt, meta);
      link.addEventListener('pointermove', () => setActive(index));
      link.addEventListener('focus', () => setActive(index));
      resultLinks.push(link);
      results.append(link);
    }
    status.textContent = matches.length
      ? `找到 ${matches.length} 篇文章${matches.length > 30 ? '，显示前 30 篇' : ''}`
      : '没有找到相关文章，试试其他关键词';
  }

  async function update() {
    const requestRevision = ++revision;
    const query = input.value;
    clearResults();
    results.setAttribute('aria-busy', 'true');
    status.textContent = '正在加载搜索索引…';
    try {
      const posts = await loadIndex();
      if (!dialog.open || requestRevision !== revision) return;
      render(posts, query);
    } catch {
      if (!dialog.open || requestRevision !== revision) return;
      status.textContent = '搜索索引加载失败，请重新打开搜索或输入关键词重试';
    } finally {
      if (requestRevision === revision) results.setAttribute('aria-busy', 'false');
    }
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

  function close() {
    if (!dialog.open) return;
    if (typeof dialog.close === 'function') dialog.close();
    else {
      dialog.removeAttribute('open');
      restoreFocus();
    }
  }

  function open() {
    if (dialog.open) {
      input.focus();
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
    win.clearTimeout(debounceTimer);
    debounceTimer = win.setTimeout(() => void update(), 120);
  });
  input.addEventListener('compositionstart', () => {
    composing = true;
  });
  input.addEventListener('compositionend', () => {
    composing = false;
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
