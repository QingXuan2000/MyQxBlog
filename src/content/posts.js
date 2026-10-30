/* 扫 content/posts，逐篇解析、规范化、渲染，产出一份排好序的 Post 数组。
   只认 .md，不递归子目录，文章地址由 id 决定，目录层级进不了路由。

   出错就停。一篇坏文章不该被悄悄跳过，那样构建看着成功，站点实际上少了一页。
   排序先按日期倒序，同一天再按 id 自然序，保证每次构建的顺序完全一致。 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseFrontmatter } from './frontmatter.js';
import { normalizePost } from './metadata.js';
import { renderMarkdown } from './markdown.js';

export { normalizePost } from './metadata.js';

async function readConfig(root) {
  try {
    return JSON.parse(await readFile(path.join(root, 'config/siteConfig.json'), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error(`config/siteConfig.json: ${error.message}`, { cause: error });
  }
}

async function markdownFiles(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && /\.md$/i.test(entry.name))
      .map((entry) => path.join(directory, entry.name))
      .sort();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function loadPosts({
  root = process.cwd(),
  contentDir,
  includeDrafts = false,
  config,
} = {}) {
  config ??= await readConfig(root);
  const directory = path.resolve(root, contentDir || 'content/posts');
  const posts = [];
  const ids = new Set();
  for (const filename of await markdownFiles(directory)) {
    try {
      const source = await readFile(filename, 'utf8');
      const parsed = parseFrontmatter(source);
      const post = normalizePost(
        parsed.data,
        parsed.content,
        path.basename(filename, path.extname(filename)),
        config,
      );
      if (ids.has(post.id)) throw new Error(`duplicate post id ${post.id}`);
      ids.add(post.id);
      if (post.draft && !includeDrafts) continue;
      const rendered = await renderMarkdown(post.body);
      posts.push({ ...post, ...rendered, excerpt: post.excerpt || rendered.text.slice(0, 180) });
    } catch (error) {
      throw new Error(`${path.relative(root, filename)}: ${error.message}`, { cause: error });
    }
  }
  return posts.sort(
    (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id, 'en', { numeric: true }),
  );
}
