import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { parse } from 'yaml';
import { loadPosts } from '../src/content/index.js';

const engine = await import('../src/content/github.js').catch(() => ({}));
const env = { GH_TOKEN: 'secret-test-token', GITHUB_REPOSITORY: 'owner/blog' };

async function fixture(t, build = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qx-github-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'content/posts'), { recursive: true });
  await mkdir(path.join(root, 'config'), { recursive: true });
  await writeFile(
    path.join(root, 'config/buildConfig.json'),
    JSON.stringify({ author: 'Owner', ...build }),
  );
  await writeFile(
    path.join(root, 'config/siteConfig.json'),
    JSON.stringify({ site: { author: 'Site Author' } }),
  );
  return root;
}

function discussion(number, overrides = {}) {
  return {
    number,
    title: `Article ${number}`,
    body: `# Heading ${number}\n\nBody ${number}`,
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-03T00:00:00Z',
    author: { login: 'Owner' },
    category: { name: 'Notes', slug: 'notes' },
    labels: { nodes: [{ name: 'JavaScript' }], pageInfo: { hasNextPage: false } },
    isAnswered: false,
    isClosed: false,
    url: `https://github.com/owner/blog/discussions/${number}`,
    ...overrides,
  };
}

function response(nodes, hasNextPage = false, endCursor = null) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data: { repository: { discussions: { nodes, pageInfo: { hasNextPage, endCursor } } } },
    }),
  };
}

function synced(number, repository = 'owner/blog') {
  return `---\nid: ${number}\ntitle: Previous\nsource: github-discussion\nsourceRepository: ${repository}\nsourceDiscussionNumber: ${number}\n---\nOld body`;
}

test('reads all GitHub cursor pages and removes unpublished sources while keeping original posts', async (t) => {
  const root = await fixture(t);
  await writeFile(
    path.join(root, 'content/posts/local.md'),
    '---\ntitle: Local only\n---\nOriginal content',
  );
  await writeFile(path.join(root, 'content/posts/9.md'), synced(9));
  await writeFile(path.join(root, 'content/posts/other.md'), synced(77, 'other/blog'));
  const cursors = [];
  const fetchImpl = async (url, options) => {
    assert.equal(url, 'https://api.github.com/graphql');
    assert.equal(options.headers.Authorization, 'Bearer secret-test-token');
    const request = JSON.parse(options.body);
    assert.match(request.query, /isClosed:\s*closed/);
    cursors.push(request.variables.after);
    if (request.variables.after === null)
      return response(
        [
          discussion(1),
          discussion(3, { isAnswered: true }),
          discussion(4, { labels: { nodes: [{ name: 'no-article' }] } }),
        ],
        true,
        'cursor-1',
      );
    assert.equal(request.variables.after, 'cursor-1');
    return response([
      discussion(2),
      discussion(5, { author: { login: 'Other' } }),
      discussion(6, { isClosed: true }),
    ]);
  };
  assert.equal(typeof engine.syncDiscussions, 'function');
  const result = await engine.syncDiscussions({ root, env, fetchImpl });
  assert.deepEqual(cursors, [null, 'cursor-1']);
  assert.deepEqual((await readdir(path.join(root, 'content/posts'))).sort(), [
    '1.md',
    '2.md',
    'local.md',
    'other.md',
  ]);
  const source = parse(
    (await readFile(path.join(root, 'content/posts/2.md'), 'utf8')).split('---')[1],
  );
  assert.equal(source.source, 'github-discussion');
  assert.equal(source.sourceDiscussionNumber, 2);
  assert.equal(source.sourceRepository, 'owner/blog');
  assert.equal(result.synced, 2);
  assert.equal(result.deleted, 1);
});

test('a failed later page preserves every old file and writes no partial new articles', async (t) => {
  const root = await fixture(t);
  const original = synced(9);
  await writeFile(path.join(root, 'content/posts/9.md'), original);
  let calls = 0;
  const fetchImpl = async () =>
    ++calls === 1 ? response([discussion(1)], true, 'next') : { ok: false, status: 503 };
  assert.equal(typeof engine.syncDiscussions, 'function');
  await assert.rejects(engine.syncDiscussions({ root, env, fetchImpl }), /503/);
  assert.deepEqual(await readdir(path.join(root, 'content/posts')), ['9.md']);
  assert.equal(await readFile(path.join(root, 'content/posts/9.md'), 'utf8'), original);
});

test('rejects malformed remote snapshots before replacing or deleting source files', async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'content/posts/9.md'), synced(9));
  assert.equal(typeof engine.syncDiscussions, 'function');
  for (const fetchImpl of [
    async () => ({ ok: true, json: async () => ({ data: { repository: null } }) }),
    async () => response([discussion(1, { title: '' })]),
    async () => response([discussion(1, { createdAt: undefined })]),
    async () => response([discussion(1)], true, null),
  ]) {
    await assert.rejects(engine.syncDiscussions({ root, env, fetchImpl }));
    assert.deepEqual(await readdir(path.join(root, 'content/posts')), ['9.md']);
  }
});

test('publishes discussions from non-answerable categories where isAnswered is null', async (t) => {
  const root = await fixture(t);
  const result = await engine.syncDiscussions({
    root,
    env,
    fetchImpl: async () => response([discussion(3, { isAnswered: null })]),
  });
  assert.deepEqual(await readdir(path.join(root, 'content/posts')), ['3.md']);
  assert.equal(result.synced, 1);
});

test('delete events force their marked source out of the reconciled snapshot and keep originals', async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'content/posts/1.md'), synced(1));
  await writeFile(path.join(root, 'content/posts/2.md'), synced(2));
  await writeFile(
    path.join(root, 'content/posts/local.md'),
    '---\nid: 1\ntitle: Local duplicate\n---\nOriginal',
  );
  const eventPath = path.join(root, 'event.json');
  await writeFile(
    eventPath,
    JSON.stringify({
      action: 'deleted',
      repository: { full_name: 'owner/blog' },
      discussion: { number: 1 },
    }),
  );
  assert.equal(typeof engine.syncDiscussions, 'function');
  const result = await engine.syncDiscussions({
    root,
    env: { ...env, GITHUB_EVENT_PATH: eventPath },
    fetchImpl: async () => response([discussion(1), discussion(2)]),
  });
  assert.deepEqual((await readdir(path.join(root, 'content/posts'))).sort(), ['2.md', 'local.md']);
  assert.equal(result.deleted, 1);
});

test('a later deletion reconciles earlier omitted events while excluding its stale API object', async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'content/posts/1.md'), synced(1));
  await writeFile(path.join(root, 'content/posts/2.md'), synced(2));
  await writeFile(
    path.join(root, 'content/posts/local.md'),
    '---\ntitle: Local original\n---\nKeep my words',
  );
  const eventPath = path.join(root, 'event.json');
  await writeFile(eventPath, JSON.stringify({ action: 'deleted', discussion: { number: 2 } }));
  const result = await engine.syncDiscussions({
    root,
    env: { ...env, GITHUB_EVENT_PATH: eventPath },
    fetchImpl: async () => response([discussion(2)]),
  });
  assert.deepEqual(await readdir(path.join(root, 'content/posts')), ['local.md']);
  assert.equal(result.deleted, 2);
  assert.match(await readFile(path.join(root, 'content/posts/local.md'), 'utf8'), /Keep my words/);
});

test('unpublish events preserve all old sources if full reconciliation cannot fetch its snapshot', async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'content/posts/1.md'), synced(1));
  await writeFile(path.join(root, 'content/posts/2.md'), synced(2));
  const eventPath = path.join(root, 'event.json');
  await writeFile(eventPath, JSON.stringify({ action: 'deleted', discussion: { number: 2 } }));
  await assert.rejects(
    engine.syncDiscussions({
      root,
      env: { ...env, GITHUB_EVENT_PATH: eventPath },
      fetchImpl: async () => {
        throw new Error('Offline');
      },
    }),
    /GitHub/,
  );
  assert.deepEqual((await readdir(path.join(root, 'content/posts'))).sort(), ['1.md', '2.md']);
  assert.equal(await readFile(path.join(root, 'content/posts/1.md'), 'utf8'), synced(1));
  assert.equal(await readFile(path.join(root, 'content/posts/2.md'), 'utf8'), synced(2));
});

test('answered, closed and no-article events unpublish their source even before the API catches up', async (t) => {
  const root = await fixture(t);
  const eventPath = path.join(root, 'event.json');
  assert.equal(typeof engine.syncDiscussions, 'function');
  for (const [action, extra] of [
    ['answered', {}],
    ['closed', {}],
    ['labeled', { labels: [{ name: 'no-article' }] }],
  ]) {
    await writeFile(path.join(root, 'content/posts/1.md'), synced(1));
    await writeFile(eventPath, JSON.stringify({ action, discussion: { number: 1, ...extra } }));
    await engine.syncDiscussions({
      root,
      env: { ...env, GITHUB_EVENT_PATH: eventPath },
      fetchImpl: async () => response([discussion(1)]),
    });
    assert.deepEqual(await readdir(path.join(root, 'content/posts')), []);
  }
});

test('keeps local originals on ID collisions', async (t) => {
  const root = await fixture(t);
  const original = '---\nid: 1\ntitle: My own article\n---\nOriginal';
  await writeFile(path.join(root, 'content/posts/original.md'), original);
  assert.equal(typeof engine.syncDiscussions, 'function');
  const result = await engine.syncDiscussions({
    root,
    env,
    fetchImpl: async () => response([discussion(1), discussion(2)]),
  });
  assert.equal(await readFile(path.join(root, 'content/posts/original.md'), 'utf8'), original);
  assert.deepEqual((await readdir(path.join(root, 'content/posts'))).sort(), [
    '2.md',
    'original.md',
  ]);
  assert.equal(result.skipped, 1);
});

test('preserves configured article offsets and serializes quotes, newlines and HTML as data', async (t) => {
  const root = await fixture(t, { githubStartId: 101 });
  const title = 'Quoted "title": value\n<script>untrusted</script>';
  assert.equal(typeof engine.syncDiscussions, 'function');
  await engine.syncDiscussions({
    root,
    env,
    fetchImpl: async () => response([discussion(2, { title })]),
  });
  assert.deepEqual(await readdir(path.join(root, 'content/posts')), ['102.md']);
  const posts = await loadPosts({ root });
  assert.equal(posts[0].id, '102');
  assert.equal(posts[0].title, title);
  assert.equal(posts[0].author, 'Site Author');
  assert.equal(posts[0].discussionUrl, 'https://github.com/owner/blog/discussions/2');
});

test('reports missing configuration and network errors without exposing tokens', async (t) => {
  const root = await fixture(t);
  assert.equal(typeof engine.syncDiscussions, 'function');
  await assert.rejects(engine.syncDiscussions({ root, env: {} }), /GITHUB_REPOSITORY/);
  await assert.rejects(
    engine.syncDiscussions({
      root,
      env,
      fetchImpl: async () => {
        throw new Error(env.GH_TOKEN);
      },
    }),
    (error) => /GitHub/.test(error.message) && !error.message.includes(env.GH_TOKEN),
  );
});
