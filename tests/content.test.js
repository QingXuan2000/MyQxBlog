import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const engine = await import('../src/content/index.js').catch(() => ({}));

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qx-content-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'content/posts'), { recursive: true });
  return root;
}

test('normalizes legacy labels, Unicode slugs and dates without changing text metadata', () => {
  assert.equal(typeof engine.normalizePost, 'function');
  const post = engine.normalizePost(
    {
      id: 7,
      title: '<img src=x onerror=alert(1)>',
      tags: ['JavaScript', '中文 标签'],
      tagSlugs: ['JS', '中文-标签'],
      category: '随笔',
      date: '2026-01-02',
      author: 'A & B',
    },
    '# Section',
    'fallback',
    {},
  );
  assert.equal(post.id, '7');
  assert.equal(post.title, '<img src=x onerror=alert(1)>');
  assert.equal(post.author, 'A & B');
  assert.deepEqual(post.labels, ['JavaScript', '中文 标签']);
  assert.deepEqual(post.labelSlugs, ['JS', '中文-标签']);
  assert.equal(post.categorySlug, '随笔');
  assert.equal(post.date, '2026-01-02T00:00:00.000Z');
  assert.equal(post.updated, post.date);
});

test('rejects traversal, invalid metadata, invalid slugs and impossible calendar dates', () => {
  assert.equal(typeof engine.normalizePost, 'function');
  for (const value of ['../7', 'a/b', 'a\\b', '.', '%2e%2e', 'CON']) {
    assert.throws(
      () => engine.normalizePost({ id: value, title: 'Test' }, '', 'fallback', {}),
      /id/i,
    );
  }
  for (const data of [
    { title: ['bad'] },
    { title: 'Test', date: '2026-02-30' },
    { title: 'Test', tags: { bad: true } },
    { title: 'Test', categorySlug: '../bad' },
    { title: 'Test', draft: 'false' },
  ]) {
    assert.throws(() => engine.normalizePost(data, '', '7', {}));
  }
});

test('renders safe rich Markdown with stable unique headings, math, code and plain search text', async () => {
  assert.equal(typeof engine.renderMarkdown, 'function');
  const body =
    '# Section\n\n## Section\n\n## 中文标题\n\n**Searchable** text [link](https://example.com).\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n$x^2$\n\n```js\nconst answer = 42;\n```\n\n<script>alert("secret")</script>\n<img src=x onerror=alert(1)>\n<a href="javascript:alert(1)">unsafe</a>\n';
  const rendered = await engine.renderMarkdown(body);
  assert.deepEqual(rendered.toc, [
    { id: 'section', text: 'Section', depth: 1 },
    { id: 'section-1', text: 'Section', depth: 2 },
    { id: '中文标题', text: '中文标题', depth: 2 },
  ]);
  assert.match(rendered.html, /id="section"/);
  assert.match(rendered.html, /href="#section-1"/);
  assert.match(rendered.html, /<table>/);
  assert.match(rendered.html, /class="katex"/);
  assert.match(rendered.html, /data-rehype-pretty-code-figure/);
  assert.match(rendered.html, /class="code-copy"/);
  assert.doesNotMatch(rendered.html, /<script|onerror=|javascript:/);
  assert.match(rendered.text, /Searchable text link/);
  assert.match(rendered.text, /const answer = 42/);
  assert.doesNotMatch(rendered.text, /<|secret|\\math|katex/);
  assert.equal(rendered.readingMinutes, 1);
  assert.deepEqual((await engine.renderMarkdown(body)).toc, rendered.toc);
});

test('loads Markdown, rejects duplicate IDs and excludes drafts', async (t) => {
  const root = await fixture(t);
  await writeFile(
    path.join(root, 'content/posts/7.md'),
    '---\nid: 7\ntitle: New\ndate: 2026-01-01\ntags: [JavaScript]\n---\n# Section',
  );
  await writeFile(
    path.join(root, 'content/posts/8.md'),
    '---\ntitle: Second\ndate: 2026-02-01\n---\nSecond body',
  );
  await writeFile(
    path.join(root, 'content/posts/draft.md'),
    '---\ntitle: Draft\ndraft: true\n---\nDraft body',
  );
  assert.equal(typeof engine.loadPosts, 'function');
  const posts = await engine.loadPosts({ root });
  assert.deepEqual(
    posts.map(({ id, title }) => ({ id, title })),
    [
      { id: '8', title: 'Second' },
      { id: '7', title: 'New' },
    ],
  );
  assert.equal(posts[1].toc[0].id, 'section');
  assert.equal(posts[1].labels[0], 'JavaScript');
  assert.equal((await engine.loadPosts({ root, includeDrafts: true })).length, 3);
  await writeFile(path.join(root, 'content/posts/dup.md'), '---\nid: 7\ntitle: Dup\n---\nx');
  await assert.rejects(engine.loadPosts({ root }), /duplicate post id 7/);
});

test('treats empty content as normal and reports malformed files by name', async (t) => {
  const root = await fixture(t);
  assert.equal(typeof engine.loadPosts, 'function');
  assert.deepEqual(await engine.loadPosts({ root }), []);
  await writeFile(path.join(root, 'content/posts/bad.md'), '---\ntitle: [unterminated\n---\nbody');
  await assert.rejects(engine.loadPosts({ root }), /bad\.md/);
});

test('accepts empty frontmatter but rejects duplicate YAML keys and invalid timestamp days', async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'content/posts/empty.md'), '---\n---\nEmpty content');
  await assert.rejects(engine.loadPosts({ root }), /title is required/);
  await writeFile(
    path.join(root, 'content/posts/empty.md'),
    '---\ntitle: First\ntitle: Second\n---\nBody',
  );
  await assert.rejects(engine.loadPosts({ root }), /empty\.md.*invalid YAML/s);
  assert.throws(
    () => engine.normalizePost({ title: 'Test', date: '2026-02-30T09:00:00+08:00' }, '', '7'),
    /date/,
  );
});

test('drafts are excluded by default and generated Unicode slugs remain usable', async (t) => {
  const root = await fixture(t);
  await writeFile(
    path.join(root, 'content/posts/7.md'),
    '---\ntitle: Draft\ndraft: true\ntags: [中文 标签]\n---\nNew draft',
  );
  assert.deepEqual(await engine.loadPosts({ root }), []);
  const posts = await engine.loadPosts({ root, includeDrafts: true });
  assert.equal(posts[0].title, 'Draft');
  assert.deepEqual(posts[0].labelSlugs, ['中文-标签']);
});

test('keeps footnote links and author-provided safe fragment links connected after sanitizing IDs', async () => {
  const rendered = await engine.renderMarkdown(
    'Text with a note.[^1]\n\n[^1]: Footnote content.\n\n<h2 id="custom">Custom section</h2>\n\n[Jump](#custom)',
  );
  const ids = new Set([...rendered.html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  for (const match of rendered.html.matchAll(/\bhref="#([^"]+)"/g)) {
    assert.ok(ids.has(match[1]), `fragment ${match[1]} has no target`);
  }
  assert.match(rendered.html, /Footnote content/);
});

test('preserves safe article media with deferred loading while stripping executable attributes', async () => {
  const rendered = await engine.renderMarkdown(
    '![A photo](https://example.com/photo.jpg)\n\n<video src="https://example.com/movie.mp4" poster="javascript:alert(1)" autoplay onplay="alert(1)"><source src="https://example.com/movie.webm" type="video/webm"></video>',
  );
  assert.match(rendered.html, /loading="lazy"/);
  assert.match(rendered.html, /decoding="async"/);
  assert.match(rendered.html, /<video[^>]*src="https:\/\/example.com\/movie.mp4"/);
  assert.match(rendered.html, /preload="metadata"/);
  assert.match(rendered.html, /controls/);
  assert.match(rendered.html, /<source[^>]*type="video\/webm"/);
  assert.doesNotMatch(rendered.html, /javascript:|onplay|autoplay/);
});
