import test from 'node:test';
import assert from 'node:assert/strict';
import { initSearch, searchPosts } from '../src/client/search.js';
import { initClient } from '../src/client/main.js';
import { initArticle, readingProgress } from '../src/client/article.js';
import { initTheme } from '../src/client/theme.js';
import { initNavigation } from '../src/client/navigation.js';

const post = (id, fields = {}) => ({
  id,
  title: '',
  labels: [],
  excerpt: '',
  text: '',
  url: `/posts/${id}.html`,
  ...fields,
});

test('a title match ranks above a label or body match', () => {
  const body = post('body', { title: 'Notes', text: 'JavaScript '.repeat(30) });
  const label = post('label', { title: 'Resources', labels: ['JavaScript'] });
  const title = post('title', { title: 'Learning JavaScript' });
  assert.deepEqual(
    searchPosts([body, label, title], 'javascript').map((item) => item.id),
    ['title', 'label', 'body'],
  );
});

test('all query words match case-insensitively across searchable fields', () => {
  const relevant = post('relevant', {
    title: 'Native Browser',
    labels: ['JavaScript'],
    text: 'A practical guide',
  });
  const incomplete = post('incomplete', { title: 'Native Browser' });
  assert.deepEqual(searchPosts([incomplete, relevant], '  BROWSER\njavaSCRIPT  guide '), [
    relevant,
  ]);
});

test('an empty or whitespace-only query has no results', () => {
  const posts = [post('one', { title: 'First post' })];
  assert.deepEqual(searchPosts(posts, ''), []);
  assert.deepEqual(searchPosts(posts, ' \n\t '), []);
});

test('regex punctuation is matched literally', () => {
  const literal = post('literal', { title: 'Using [a-z]+ in a parser' });
  const ordinary = post('ordinary', { title: 'Using abc in a parser' });
  assert.deepEqual(searchPosts([ordinary, literal], '[a-z]+'), [literal]);
  assert.deepEqual(searchPosts([ordinary, literal], '.*'), []);
});

test('HTML-like query text remains literal text', () => {
  const literal = post('literal', { text: 'An example uses <script>alert(1)</script>.' });
  const ordinary = post('ordinary', { title: 'An example uses script alert' });
  assert.deepEqual(searchPosts([ordinary, literal], '<script>alert(1)</script>'), [literal]);
});

test('search accepts Chinese text and does not mutate the index', () => {
  const posts = [
    post('zh', { title: '保持思考', text: '原生浏览器中的搜索体验' }),
    post('en', { title: 'Other' }),
  ];
  const original = structuredClone(posts);
  assert.deepEqual(searchPosts(posts, '思考 浏览器'), [posts[0]]);
  assert.deepEqual(posts, original);
});

test('equal scores preserve the published index order', () => {
  const posts = [post('new', { title: 'Search notes' }), post('old', { title: 'Search thoughts' })];
  assert.deepEqual(searchPosts(posts, 'search'), posts);
});

test('client enhancement is safe without a browser document', () => {
  assert.doesNotThrow(() => initClient());
});

test('reading progress tracks the article rather than the surrounding page', () => {
  assert.equal(readingProgress({ top: 300, height: 2000 }, 800), 0);
  assert.equal(readingProgress({ top: 0, height: 2000 }, 800), 0);
  assert.equal(readingProgress({ top: -600, height: 2000 }, 800), 50);
  assert.equal(readingProgress({ top: -1200, height: 2000 }, 800), 100);
  assert.equal(readingProgress({ top: -1800, height: 2000 }, 800), 100);
});

test('a fully visible short article has complete reading progress', () => {
  assert.equal(readingProgress({ top: 50, height: 300 }, 800), 100);
});

test('theme follows system changes even when storage is blocked', () => {
  const root = { dataset: {}, style: {} };
  const listeners = {};
  const button = {
    setAttribute() {},
    addEventListener(type, callback) {
      listeners[type] = callback;
    },
  };
  const media = {
    matches: false,
    addEventListener(type, callback) {
      listeners.system = callback;
    },
  };
  const doc = { documentElement: root, querySelectorAll: () => [button] };
  const win = {
    matchMedia: () => media,
    get localStorage() {
      throw new Error('Storage blocked');
    },
    addEventListener() {},
  };
  initTheme(doc, win);
  assert.equal(root.dataset.theme, 'light');
  listeners.system({ matches: true });
  assert.equal(root.dataset.theme, 'dark');
  listeners.click();
  assert.equal(root.dataset.theme, 'light');
  listeners.system({ matches: true });
  assert.equal(root.dataset.theme, 'light');
});

test('a saved theme takes precedence over system appearance', () => {
  const root = { dataset: {}, style: {} };
  initTheme(
    { documentElement: root, querySelectorAll: () => [] },
    {
      localStorage: { getItem: () => 'light' },
      matchMedia: () => ({ matches: true, addEventListener() {} }),
      addEventListener() {},
    },
  );
  assert.equal(root.dataset.theme, 'light');
});

function searchFixture(fetchImpl) {
  const doc = { activeElement: null, documentElement: { style: {} } };
  class Element {
    constructor() {
      this.listeners = {};
      this.attributes = new Map();
      this.children = [];
      this.value = '';
      this.style = {};
      this.isConnected = true;
      this.tabIndex = 0;
      this.classList = { toggle() {} };
    }
    addEventListener(type, listener) {
      (this.listeners[type] ||= []).push(listener);
    }
    fire(type, event = {}) {
      event.preventDefault ||= () => {};
      event.target ||= this;
      for (const listener of this.listeners[type] || []) listener(event);
    }
    setAttribute(name, value) {
      this.attributes.set(name, value);
    }
    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    }
    removeAttribute(name) {
      this.attributes.delete(name);
    }
    replaceChildren() {
      this.children = [];
    }
    append(...elements) {
      this.children.push(...elements);
    }
    focus() {
      doc.activeElement = this;
    }
    click() {
      this.fire('click');
    }
    scrollIntoView() {}
  }
  const dialog = new Element();
  const input = new Element();
  const results = new Element();
  const status = new Element();
  const opener = new Element();
  const close = new Element();
  const nodes = {
    '[data-search-dialog]': dialog,
    '[data-search-input]': input,
    '[data-search-results]': results,
    '[data-search-status]': status,
  };
  dialog.querySelector = (selector) => nodes[selector];
  dialog.querySelectorAll = (selector) =>
    selector === '[data-search-close]' ? [close] : [close, input, ...results.children];
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
    dialog.fire('close');
  };
  doc.querySelector = (selector) =>
    selector === 'meta[name="qx-base"]' ? { content: '/QxBlog/' } : nodes[selector];
  doc.querySelectorAll = () => [opener];
  doc.createElement = () => new Element();
  doc.listeners = {};
  doc.addEventListener = Element.prototype.addEventListener;
  const win = {
    fetch: fetchImpl,
    location: { href: 'https://example.com/QxBlog/', origin: 'https://example.com' },
    setTimeout: (callback) => {
      callback();
      return 0;
    },
    clearTimeout() {},
  };
  opener.focus();
  initSearch(doc, win);
  return { doc, dialog, input, results, status, opener, close };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
const response = (posts) => ({ ok: true, json: async () => posts });

test('search lazily fetches the subdirectory index and caches successful responses', async () => {
  const requests = [];
  const fixture = searchFixture(async (url) => {
    requests.push(url);
    return response([post('one', { title: 'Search notes' })]);
  });
  assert.deepEqual(requests, []);
  fixture.opener.click();
  await tick();
  fixture.input.value = 'search';
  fixture.input.fire('input');
  await tick();
  assert.equal(fixture.results.children.length, 1);
  fixture.close.click();
  fixture.opener.click();
  await tick();
  assert.deepEqual(requests, ['/QxBlog/assets/search.json']);
});

test('only the latest query renders when the index resolves', async () => {
  let resolveFetch;
  const fixture = searchFixture(
    () =>
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
  );
  fixture.opener.click();
  fixture.input.value = 'alpha';
  fixture.input.fire('input');
  fixture.input.value = 'beta';
  fixture.input.fire('input');
  resolveFetch(response([post('a', { title: 'Alpha' }), post('b', { title: 'Beta' })]));
  await tick();
  assert.equal(fixture.results.children.length, 1);
  assert.equal(fixture.results.children[0].children[0].textContent, 'Beta');
  assert.equal(fixture.results.getAttribute('aria-busy'), 'false');
});

test('failed search loading reports an error and permits a later retry', async () => {
  let attempts = 0;
  const fixture = searchFixture(async () => {
    if (++attempts === 1) throw new Error('Offline');
    return response([post('one', { title: 'Recovered' })]);
  });
  fixture.opener.click();
  await tick();
  assert.match(fixture.status.textContent, /加载失败/);
  fixture.input.value = 'recovered';
  fixture.input.fire('input');
  await tick();
  assert.equal(attempts, 2);
  assert.equal(fixture.results.children.length, 1);
});

test('ArrowUp starts at the last result and Escape restores opener focus', async () => {
  const fixture = searchFixture(async () =>
    response([post('a', { title: 'Search A' }), post('b', { title: 'Search B' })]),
  );
  fixture.opener.click();
  fixture.input.value = 'search';
  fixture.input.fire('input');
  await tick();
  fixture.input.fire('keydown', { key: 'ArrowUp' });
  assert.equal(fixture.input.getAttribute('aria-activedescendant'), fixture.results.children[1].id);
  fixture.dialog.fire('keydown', { key: 'Escape' });
  assert.equal(fixture.dialog.open, false);
  assert.equal(fixture.doc.activeElement, fixture.opener);
});

test('result titles remain text and unsafe navigation URLs are excluded', async () => {
  const fixture = searchFixture(async () =>
    response([
      post('safe', { title: '<img src=x onerror=alert(1)>', url: '/QxBlog/posts/safe.html' }),
      post('unsafe', { title: '<img src=x onerror=alert(1)>', url: 'javascript:alert(1)' }),
    ]),
  );
  fixture.opener.click();
  fixture.input.value = '<img';
  fixture.input.fire('input');
  await tick();
  assert.equal(fixture.results.children.length, 1);
  assert.equal(fixture.results.children[0].children[0].textContent, '<img src=x onerror=alert(1)>');
  assert.equal(fixture.results.children[0].href, '/QxBlog/posts/safe.html');
});

test('client enhancement safely skips absent navigation, search and article targets', () => {
  const doc = {
    documentElement: { dataset: {}, style: {} },
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const win = { addEventListener() {} };
  assert.doesNotThrow(() => initClient(doc, win));
});

function codeFixture(writeText) {
  const code = { textContent: 'const message = "<hello>";\nconsole.log(message);' };
  const button = {
    textContent: '复制代码',
    dataset: {},
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    addEventListener(type, callback) {
      this.click = callback;
    },
  };
  const figure = { querySelector: () => button };
  const pre = { querySelector: () => code, closest: () => figure };
  const body = { querySelectorAll: () => [pre] };
  const doc = {
    querySelector: (selector) => (selector === '[data-post-body]' ? body : null),
    documentElement: {},
  };
  const win = {
    navigator: { clipboard: { writeText } },
    innerHeight: 800,
    addEventListener() {},
    clearTimeout() {},
    setTimeout() {},
  };
  initArticle(doc, win);
  return { button, code };
}

test('code copying preserves literal code text and reports success', async () => {
  let copied;
  const { button, code } = codeFixture(async (text) => {
    copied = text;
  });
  await button.click();
  assert.equal(copied, code.textContent);
  assert.equal(button.textContent, '已复制');
  assert.equal(button.dataset.state, 'success');
  assert.equal(button.disabled, false);
});

test('clipboard rejection reports failure and leaves the code available', async () => {
  const { button, code } = codeFixture(async () => {
    throw new Error('Permission denied');
  });
  const original = code.textContent;
  await button.click();
  assert.equal(button.dataset.state, 'error');
  assert.match(button.textContent, /复制失败/);
  assert.equal(button.disabled, false);
  assert.equal(code.textContent, original);
});

test('TOC enhancement keeps the build-generated Unicode heading ID', () => {
  const heading = Object.freeze({
    id: '保留的标题-2',
    getBoundingClientRect: () => ({ top: 100 }),
  });
  const attributes = {};
  const link = {
    getAttribute: () => '#%E4%BF%9D%E7%95%99%E7%9A%84%E6%A0%87%E9%A2%98-2',
    setAttribute: (name, value) => {
      attributes[name] = value;
    },
    removeAttribute: (name) => {
      delete attributes[name];
    },
    classList: { toggle() {} },
  };
  const body = { querySelectorAll: () => [], contains: (element) => element === heading };
  const toc = { querySelectorAll: () => [link] };
  const doc = {
    querySelector: (selector) => ({ '[data-post-body]': body, '[data-toc]': toc })[selector],
    getElementById: (id) => (id === heading.id ? heading : null),
    documentElement: { scrollHeight: 3000 },
  };
  initArticle(doc, {
    location: {
      href: 'https://example.com/QxBlog/posts/one.html',
      pathname: '/QxBlog/posts/one.html',
      origin: 'https://example.com',
    },
    innerHeight: 800,
    scrollY: 200,
    addEventListener() {},
  });
  assert.equal(heading.id, '保留的标题-2');
  assert.equal(attributes['aria-current'], 'true');
});

function navigationFixture() {
  const doc = { activeElement: null, listeners: {} };
  const element = () => ({
    listeners: {},
    attributes: new Map(),
    addEventListener(type, listener) {
      this.listeners[type] = listener;
    },
    setAttribute(name, value) {
      this.attributes.set(name, value);
    },
    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    },
    contains(target) {
      return target === this;
    },
    focus() {
      doc.activeElement = this;
      doc.listeners.focusin?.({ target: this });
    },
  });
  const button = element();
  const firstLink = element();
  const nav = element();
  nav.id = 'site-nav';
  nav.contains = (target) => target === nav || target === firstLink;
  nav.querySelector = () => firstLink;
  nav.classList = {
    toggle(name, open) {
      nav.open = open;
    },
  };
  doc.querySelector = (selector) => (selector === '[data-menu-toggle]' ? button : nav);
  doc.addEventListener = (type, listener) => {
    doc.listeners[type] = listener;
  };
  let mediaListener;
  let mediaThreshold;
  const win = {
    matchMedia(query) {
      mediaThreshold = Number(query.match(/min-width:\s*(\d+)px/)[1]);
      return {
        matches: false,
        addEventListener(type, listener) {
          mediaListener = listener;
        },
      };
    },
  };
  button.focus();
  initNavigation(doc, win);
  return {
    doc,
    button,
    firstLink,
    nav,
    open() {
      button.listeners.click();
    },
    resizeTo(width) {
      mediaListener({ matches: width >= mediaThreshold });
    },
  };
}

test('opening mobile navigation focuses its first link and Escape restores the toggle', () => {
  const fixture = navigationFixture();
  fixture.open();
  assert.equal(fixture.nav.open, true);
  assert.equal(fixture.doc.activeElement, fixture.firstLink);
  fixture.doc.listeners.keydown({ key: 'Escape' });
  assert.equal(fixture.nav.open, false);
  assert.equal(fixture.doc.activeElement, fixture.button);
});

test('the mobile menu closes when resizing to the 681px desktop layout', () => {
  const fixture = navigationFixture();
  fixture.open();
  fixture.resizeTo(680);
  assert.equal(fixture.nav.open, true);
  fixture.resizeTo(681);
  assert.equal(fixture.nav.open, false);
});

test('search does not intercept composing arrow keys, Enter or Escape', async () => {
  const fixture = searchFixture(async () => response([post('one', { title: '中文输入测试' })]));
  fixture.opener.click();
  fixture.input.value = '中文';
  fixture.input.fire('input');
  await tick();
  let navigationCount = 0;
  fixture.results.children[0].click = () => {
    navigationCount++;
  };
  fixture.input.fire('compositionstart');
  for (const key of ['ArrowDown', 'ArrowUp', 'Enter']) {
    let prevented = false;
    fixture.input.fire('keydown', {
      key,
      isComposing: true,
      preventDefault() {
        prevented = true;
      },
    });
    assert.equal(prevented, false, `${key} was intercepted during composition`);
  }
  fixture.input.fire('keydown', { key: 'Enter' });
  assert.equal(navigationCount, 0);
  fixture.dialog.fire('keydown', { key: 'Escape', isComposing: true });
  fixture.dialog.fire('cancel');
  assert.equal(fixture.dialog.open, true);
  assert.equal(fixture.input.getAttribute('aria-activedescendant'), null);
  fixture.input.fire('compositionend');
  fixture.input.fire('keydown', { key: 'Enter', keyCode: 229 });
  assert.equal(navigationCount, 0);
  fixture.input.fire('keydown', { key: 'Enter' });
  assert.equal(navigationCount, 1);
  fixture.dialog.fire('keydown', { key: 'Escape' });
  assert.equal(fixture.dialog.open, false);
});
