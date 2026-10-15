import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSite } from '../src/templates/site.js';

const config = {
  site: {
    name: 'QxBlog',
    title: 'QxBlog',
    author: 'QingXuanJun',
    url: 'https://example.com/QxBlog/',
    description: '沿途的所见与所思。',
  },
  hero: { tag: '<Blog />', title: '保持专注，保持思考' },
  about: {
    sections: [{ head: '关于我', text: '我是 QingXuanJun。<br /><strong>保持思考。</strong>' }],
    friendLinks: [{ name: '小原Blog', url: 'https://blog.meowhead.cn' }],
  },
  sidebar: { motto: '保持专注，保持思考。' },
  footerContent: ['Copyright © QingXuanJun.'],
  build: { maxArticlesPerPage: 2 },
  basePath: '/QxBlog/',
};

function post(id, date, overrides = {}) {
  return {
    id,
    title: `Article ${id}`,
    author: 'QingXuanJun',
    date,
    updated: date,
    labels: ['JavaScript'],
    labelSlugs: ['javascript'],
    category: '技术',
    categorySlug: '技术',
    body: '## A stable heading\n\nReadable body.',
    html: '<h2 id="original-anchor">A stable heading</h2><p>Readable body.</p>',
    text: 'A stable heading Readable body.',
    excerpt: `Excerpt ${id}`,
    readingMinutes: 2,
    toc: [{ id: 'original-anchor', text: 'A stable heading', depth: 2 }],
    draft: false,
    ...overrides,
  };
}
const posts = [post('3', '2026-10-15'), post('2', '2026-09-02'), post('1', '2025-08-01')];
const page = (pages, path) => {
  const found = pages.find((p) => p.path === path);
  assert.ok(found, `Missing ${path}`);
  return found.html;
};
const rows = (html) =>
  [...html.matchAll(/<article\b[^>]*class="[^"]*post-row[^\"]*"[^>]*>[\s\S]*?<\/article>/g)].map(
    (match) => match[0],
  );

test('article and taxonomy pagination count posts, retaining every published article', () => {
  const pages = renderSite({ config, posts });
  for (const prefix of ['articles', 'tags/javascript', 'categories/技术']) {
    const first = rows(page(pages, `${prefix}/index.html`));
    const second = rows(page(pages, `${prefix}/page/2/index.html`));
    assert.equal(first.length, 2);
    assert.equal(second.length, 1);
    assert.match(first.join(''), /Article 3/);
    assert.match(first.join(''), /Article 2/);
    assert.match(second[0], /Article 1/);
    assert.doesNotMatch(first.join(''), /Article 1/);
  }
  assert.equal(new Set(pages.map((p) => p.path)).size, pages.length);
});

test('subdirectory links, assets and canonical URLs remain within the configured site', () => {
  const pages = renderSite({ config, posts });
  const html = page(pages, 'posts/3.html');
  assert.match(page(pages, 'articles/index.html'), /href="\/QxBlog\/posts\/3\.html"/);
  assert.match(html, /href="\/QxBlog\/assets\/styles\/main\.css"/);
  assert.match(html, /src="\/QxBlog\/assets\/client\/main\.js"/);
  assert.match(html, /<meta name="qx-base" content="\/QxBlog\/">/);
  assert.match(html, /rel="canonical" href="https:\/\/example\.com\/QxBlog\/posts\/3\.html"/);
  assert.doesNotMatch(html, /\/QxBlog\/QxBlog\//);
});

test('article HTML and stable heading targets are available without JavaScript', () => {
  const html = page(renderSite({ config, posts }), 'posts/3.html');
  assert.match(html, /<h2 id="original-anchor">A stable heading<\/h2>/);
  assert.match(html, /href="#original-anchor"/);
  assert.match(html, /data-post-body/);
  assert.match(html, /data-toc/);
  assert.match(html, /Readable body\./);
  assert.match(html, /href="\/QxBlog\/posts\/2\.html"/);
});

test('metadata is escaped in HTML and cannot terminate structured data', () => {
  const title = '<img src=x onerror=alert(1)> </script> "Quoted"';
  const html = page(
    renderSite({ config, posts: [post('safe', '2026-10-15', { title })] }),
    'posts/safe.html',
  );
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x/);
  const structured = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(structured);
  const data = JSON.parse(structured[1]);
  assert.equal(data.headline, title);
  assert.equal(data['@type'], 'BlogPosting');
});

test('empty sites retain all core pages, search accessibility and configured about content', () => {
  const pages = renderSite({ config, posts: [] });
  for (const route of [
    'index.html',
    'articles/index.html',
    'categories/index.html',
    'tags/index.html',
    'archive/index.html',
    'about/index.html',
    '404.html',
  ]) {
    const html = page(pages, route);
    assert.match(html, /<main\b/);
    assert.match(html, /<dialog\b[^>]*data-search-dialog/);
    assert.match(html, /data-search-status[^>]*aria-live="polite"/);
    assert.equal(rows(html).length, 0);
  }
  assert.equal(pages.length, 7);
  assert.match(page(pages, 'index.html'), /尚未发布文章/);
  assert.match(
    page(pages, 'about/index.html'),
    /我是 QingXuanJun。<br \/><strong>保持思考。<\/strong>/,
  );
  assert.match(page(pages, 'about/index.html'), /https:\/\/blog\.meowhead\.cn/);
  assert.match(page(pages, '404.html'), /href="\/QxBlog\/index\.html"/);
});

test('archive groups supplied posts by year and month', () => {
  const pages = renderSite({ config, posts });
  const archive = page(pages, 'archive/index.html');
  assert.match(archive, /2026/);
  assert.match(archive, /2025/);
  assert.match(archive, /10 月/);
  assert.match(archive, /09 月/);
});

test('explicitly supplied drafts can be rendered for local preview', () => {
  const pages = renderSite({
    config,
    posts: [post('draft', '2026-10-16', { draft: true, title: 'Private draft' })],
  });
  assert.match(page(pages, 'posts/draft.html'), /Private draft/);
});

test('displayed dates and archive boundaries respect the configured timezone', () => {
  const pages = renderSite({
    config: { ...config, build: { ...config.build, timezoneOffset: '+08:00' } },
    posts: [post('new-year', '2026-12-31T20:30:00.000Z')],
  });
  assert.match(page(pages, 'posts/new-year.html'), />2027\.01\.01<\/time>/);
  assert.match(page(pages, 'archive/index.html'), /<h2>2027/);
  assert.match(page(pages, 'archive/index.html'), /01 月/);
});
