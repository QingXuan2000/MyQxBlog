import path from 'node:path';
import { normalizePost, slugify } from './metadata.js';
import { serializeFrontmatter } from './frontmatter.js';
import { fetchDiscussions } from './github-api.js';
import { jsonFile, readExistingSources, applySourceChanges } from './github-storage.js';

const marker = 'github-discussion';

function labelNames(labels) {
  const nodes = Array.isArray(labels) ? labels : labels?.nodes;
  if (!Array.isArray(nodes)) throw new Error('GitHub discussion labels are incomplete');
  if (labels?.pageInfo?.hasNextPage)
    throw new Error(
      'A discussion has more than 100 labels; refusing an incomplete publication decision',
    );
  return nodes.map((label) => {
    const name = typeof label === 'string' ? label : label?.name;
    if (typeof name !== 'string' || !name.trim())
      throw new Error('GitHub discussion label is invalid');
    return name;
  });
}

function eventRemoval(event, allowedAuthor) {
  if (!event?.discussion) return false;
  const discussion = event.discussion;
  if (['deleted', 'answered', 'closed'].includes(event.action)) return true;
  if (
    discussion.is_answered === true ||
    discussion.isAnswered === true ||
    discussion.closed === true ||
    discussion.isClosed === true ||
    discussion.state === 'closed'
  )
    return true;
  if (discussion.author?.login || discussion.user?.login) {
    const login = discussion.author?.login || discussion.user?.login;
    if (login.toLowerCase() !== allowedAuthor.toLowerCase()) return true;
  }
  return (
    discussion.labels !== undefined &&
    labelNames(discussion.labels).some((label) => label.toLowerCase() === 'no-article')
  );
}

function sourceFor(discussion, config, startId, repository, allowedAuthor) {
  const labels = labelNames(discussion.labels);
  // 非问答类分类的 Discussion，isAnswered 为 null；此时视为“未采纳”，仅强校验 isClosed。
  if (
    typeof discussion.isClosed !== 'boolean' ||
    (discussion.isAnswered != null && typeof discussion.isAnswered !== 'boolean')
  )
    throw new Error(`GitHub discussion #${discussion.number} has no publication state`);
  if (
    discussion.isAnswered === true ||
    discussion.isClosed ||
    labels.some((label) => label.toLowerCase() === 'no-article') ||
    discussion.author?.login?.toLowerCase() !== allowedAuthor.toLowerCase()
  )
    return null;
  if (typeof discussion.body !== 'string')
    throw new Error(`GitHub discussion #${discussion.number} body is not text`);
  if (
    typeof discussion.createdAt !== 'string' ||
    !discussion.createdAt ||
    typeof discussion.updatedAt !== 'string' ||
    !discussion.updatedAt
  )
    throw new Error(`GitHub discussion #${discussion.number} timestamps are incomplete`);
  const id = discussion.number + startId - 1;
  if (!Number.isSafeInteger(id) || id < 1)
    throw new Error('githubStartId produces an invalid article ID');
  const post = normalizePost(
    {
      id,
      title: discussion.title,
      author: config.site?.author || discussion.author.login,
      date: discussion.createdAt,
      updated: discussion.updatedAt,
      labels,
      labelSlugs: labels.map(slugify),
      category: discussion.category?.name || '',
      categorySlug: discussion.category?.slug || undefined,
      discussionUrl:
        discussion.url || `https://github.com/${repository}/discussions/${discussion.number}`,
    },
    discussion.body,
    String(id),
    config,
  );
  const data = {
    id: post.id,
    title: post.title,
    author: post.author,
    date: post.date,
    updated: post.updated,
    tags: post.labels,
    tagSlugs: post.labelSlugs,
    category: post.category,
    categorySlug: post.categorySlug,
    discussionUrl: post.discussionUrl,
    source: marker,
    sourceRepository: repository,
    sourceDiscussionNumber: discussion.number,
  };
  return { id: post.id, next: serializeFrontmatter(data, post.body) };
}

export async function syncDiscussions({
  root = process.cwd(),
  fetchImpl = globalThis.fetch,
  env = process.env,
} = {}) {
  root = path.resolve(root);
  const repository = env.GITHUB_REPOSITORY;
  if (typeof repository !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repository))
    throw new Error('GITHUB_REPOSITORY must be owner/repository');
  const token = env.GH_TOKEN || env.GITHUB_TOKEN;
  if (!token) throw new Error('GH_TOKEN or GITHUB_TOKEN is required to sync Discussions');
  const config = await jsonFile(path.join(root, 'config/siteConfig.json'), {});
  const build = await jsonFile(path.join(root, 'config/buildConfig.json'), {});
  const allowedAuthor = build.author || config.site?.author;
  if (typeof allowedAuthor !== 'string' || !allowedAuthor.trim())
    throw new Error('A configured author is required for GitHub Discussions sync');
  const startId = Number(build.githubStartId ?? 1);
  if (!Number.isSafeInteger(startId) || startId < 1)
    throw new Error('githubStartId must be a positive integer');
  const event = env.GITHUB_EVENT_PATH ? await jsonFile(env.GITHUB_EVENT_PATH) : null;
  if (
    event?.repository?.full_name &&
    event.repository.full_name.toLowerCase() !== repository.toLowerCase()
  )
    throw new Error('GitHub event repository does not match GITHUB_REPOSITORY');
  const existing = await readExistingSources(root, repository);
  let forcedRemoval;
  if (eventRemoval(event, allowedAuthor.trim())) {
    forcedRemoval = event.discussion.number;
    if (!Number.isSafeInteger(forcedRemoval) || forcedRemoval < 1)
      throw new Error('GitHub event discussion number is invalid');
  }

  // 每次事件都对完整快照做一次对账，补回被合并掉的工作流事件。
  // 当前 webhook 的下架判定也会覆盖过期的 API 对象。
  const discussions = await fetchDiscussions({ repository, token, fetchImpl });
  const localIds = new Set(existing.filter((entry) => !entry.managed).map((entry) => entry.id));
  const candidates = new Map();
  let skipped = 0;
  for (const discussion of discussions) {
    if (discussion.number === forcedRemoval) {
      skipped++;
      continue;
    }
    const source = sourceFor(discussion, config, startId, repository, allowedAuthor.trim());
    if (!source || localIds.has(source.id)) {
      skipped++;
      continue;
    }
    const filename = path.join(root, 'content/posts', `${source.id}.md`);
    const target = existing.find((entry) => entry.filename === filename);
    if (target && !target.managed) {
      skipped++;
      continue;
    }
    candidates.set(filename, { filename, previous: target?.previous, next: source.next });
  }
  const removals = existing
    .filter((entry) => entry.managed && !candidates.has(entry.filename))
    .map((entry) => ({ ...entry, next: null }));
  await applySourceChanges(root, [...candidates.values(), ...removals]);
  return { synced: candidates.size, deleted: removals.length, skipped };
}
