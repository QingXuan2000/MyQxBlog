import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../src/build/config.js';
import { buildSite } from '../src/build/site.js';

async function fixture(t, { url = 'https://example.com/QxBlog/', posts = true } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qxblog-build-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'config'), { recursive: true });
  await fs.mkdir(path.join(root, 'content/posts'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'config/siteConfig.json'),
    JSON.stringify({
      site: { name: 'QxBlog', title: 'QxBlog', author: 'Author', url },
      hero: { title: '保持专注，保持思考' },
      about: { sections: [], friendLinks: [] },
    }),
  );
  await fs.writeFile(
    path.join(root, 'config/buildConfig.json'),
    JSON.stringify({ maxArticlesPerPage: 2, timezoneOffset: '+08:00' }),
  );
  if (posts)
    await fs.writeFile(
      path.join(root, 'content/posts/7.md'),
      '---\nid: 7\ntitle: "A < B"\ndate: "2026-10-01T00:00:00Z"\ntags: [JavaScript]\ncategory: 开发\n---\n## Read this\n\nA searchable sentence.\n',
    );
  return root;
}

test('configuration derives the deployment prefix and rejects invalid pagination', async (t) => {
  const root = await fixture(t);
  const config = await loadConfig(root);
  assert.equal(config.basePath, '/QxBlog/');
  assert.equal(config.build.maxArticlesPerPage, 2);
  await fs.writeFile(path.join(root, 'config/buildConfig.json'), '{"maxArticlesPerPage":0}');
  await assert.rejects(() => loadConfig(root), /maxArticlesPerPage/);
});

test('complete build produces real article HTML, search content and prefixed SEO URLs', async (t) => {
  const root = await fixture(t);
  const result = await buildSite({ root });
  assert.equal(result.postCount, 1);
  const output = (file) => fs.readFile(path.join(root, 'dist', file), 'utf8');
  const post = await output('posts/7.html');
  assert.match(post, /A &lt; B/);
  assert.match(post, /A searchable sentence/);
  assert.match(post, /https:\/\/example\.com\/QxBlog\/posts\/7\.html/);
  assert.match(post, /\/QxBlog\/assets\/client\/main\.js/);
  const index = JSON.parse(await output('assets/search.json'));
  assert.equal(index[0].url, '/QxBlog/posts/7.html');
  assert.match(index[0].text, /searchable sentence/);
  assert.match(await output('sitemap.xml'), /https:\/\/example\.com\/QxBlog\/posts\/7\.html/);
  assert.match(await output('feed.xml'), /A &lt; B/);
  assert.match(await output('robots.txt'), /Sitemap: https:\/\/example\.com\/QxBlog\/sitemap\.xml/);
  await fs.access(path.join(root, 'dist/assets/client/main.js'));
  await fs.access(path.join(root, 'dist/assets/styles/main.css'));
});

test('empty sites build all main routes without publishing fabricated content', async (t) => {
  const root = await fixture(t, { url: 'https://example.com', posts: false });
  const result = await buildSite({ root });
  assert.equal(result.postCount, 0);
  for (const file of [
    'index.html',
    'articles/index.html',
    'categories/index.html',
    'tags/index.html',
    'archive/index.html',
    'about/index.html',
    '404.html',
  ]) {
    await fs.access(path.join(root, 'dist', file));
  }
  assert.deepEqual(
    JSON.parse(await fs.readFile(path.join(root, 'dist/assets/search.json'), 'utf8')),
    [],
  );
});

test('rebuild clears stale output while keeping content intact', async (t) => {
  const root = await fixture(t);
  await buildSite({ root });
  await fs.rm(path.join(root, 'content/posts/7.md'));
  await buildSite({ root });
  await assert.rejects(() => fs.access(path.join(root, 'dist/posts/7.html')));
  await fs.access(path.join(root, 'content/posts'));
});

test('build refuses to use a source directory or outside directory as output', async (t) => {
  const root = await fixture(t);
  for (const outDir of [
    '.',
    'content',
    'config',
    'src',
    'public',
    'content/posts',
    '..',
    '../outside',
  ]) {
    await assert.rejects(() => buildSite({ root, outDir }), /output|输出/i);
  }
  assert.match(await fs.readFile(path.join(root, 'content/posts/7.md'), 'utf8'), /Read this/);
});

test('bad content fails before replacing a previously valid build', async (t) => {
  const root = await fixture(t);
  await buildSite({ root });
  const original = await fs.readFile(path.join(root, 'dist/index.html'), 'utf8');
  await fs.writeFile(
    path.join(root, 'content/posts/7.md'),
    '---\nid: "../7"\ntitle: Invalid\n---\nBody',
  );
  await assert.rejects(() => buildSite({ root }));
  assert.equal(await fs.readFile(path.join(root, 'dist/index.html'), 'utf8'), original);
});

test('custom content nested inside output cannot be removed by a rebuild', async (t) => {
  const root = await fixture(t);
  await fs.mkdir(path.join(root, '.preview/source'), { recursive: true });
  await fs.copyFile(path.join(root, 'content/posts/7.md'), path.join(root, '.preview/source/7.md'));
  await assert.rejects(
    () => buildSite({ root, contentDir: '.preview/source', outDir: '.preview' }),
    /content|source|内容/i,
  );
  assert.match(await fs.readFile(path.join(root, '.preview/source/7.md'), 'utf8'), /Read this/);
});

test('public directory links cannot redirect generated output into source files', async (t) => {
  const root = await fixture(t);
  await fs.mkdir(path.join(root, 'public'), { recursive: true });
  await fs.symlink(
    path.join(root, 'config'),
    path.join(root, 'public/assets'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await assert.rejects(() => buildSite({ root }), /symbolic|symlink|link/i);
  await assert.rejects(() => fs.access(path.join(root, 'config/search.json')));
});

test('a content directory alias cannot hide that its real files are inside output', async (t) => {
  const root = await fixture(t);
  await fs.mkdir(path.join(root, 'dist/source'), { recursive: true });
  await fs.copyFile(path.join(root, 'content/posts/7.md'), path.join(root, 'dist/source/7.md'));
  await fs.symlink(
    path.join(root, 'dist/source'),
    path.join(root, 'alias'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await assert.rejects(() => buildSite({ root, contentDir: 'alias' }), /content|source|内容/i);
  assert.match(await fs.readFile(path.join(root, 'dist/source/7.md'), 'utf8'), /Read this/);
});
