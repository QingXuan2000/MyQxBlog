import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { loadConfig } from './config.js';
import { loadPosts } from '../content/index.js';
import { renderSite } from '../templates/site.js';
import { createSitemap, createFeed, createRobots, createSearchIndex } from './feeds.js';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const exists = async (file) =>
  fs.access(file).then(
    () => true,
    () => false,
  );

async function outputPath(root, outDir) {
  const absoluteRoot = path.resolve(root);
  const target = path.resolve(absoluteRoot, outDir);
  const relative = path.relative(absoluteRoot, target);
  const parts = relative.split(path.sep);
  if (
    !relative ||
    path.isAbsolute(relative) ||
    parts.includes('..') ||
    !['dist', '.preview'].includes(parts[0])
  ) {
    throw new Error('Unsafe output directory: use dist/ or .preview/ inside the project');
  }
  let current = absoluteRoot;
  for (const part of parts) {
    current = path.join(current, part);
    const stat = await fs.lstat(current).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    if (stat?.isSymbolicLink()) throw new Error('Output directory must not be a symbolic link');
  }
  return target;
}

async function writeOutput(directory, filename, value) {
  const destination = path.resolve(directory, filename);
  if (!destination.startsWith(`${directory}${path.sep}`))
    throw new Error(`Invalid output path: ${filename}`);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, value, 'utf8');
}

async function copyAssets(root, staging) {
  const publicDir = path.join(root, 'public');
  if (await exists(publicDir))
    await fs.cp(publicDir, staging, {
      recursive: true,
      filter: async (source) => {
        if ((await fs.lstat(source)).isSymbolicLink())
          throw new Error(`Public assets must not contain symbolic links: ${source}`);
        return true;
      },
    });
  await fs.cp(path.join(projectRoot, 'src/client'), path.join(staging, 'assets/client'), {
    recursive: true,
  });
  await fs.cp(path.join(projectRoot, 'src/styles'), path.join(staging, 'assets/styles'), {
    recursive: true,
  });
  const katexDir = path.join(path.dirname(require.resolve('katex/package.json')), 'dist');
  await fs.mkdir(path.join(staging, 'assets/katex'), { recursive: true });
  await fs.copyFile(
    path.join(katexDir, 'katex.min.css'),
    path.join(staging, 'assets/katex/katex.min.css'),
  );
  await fs.cp(path.join(katexDir, 'fonts'), path.join(staging, 'assets/katex/fonts'), {
    recursive: true,
  });
}

export async function buildSite({
  root = process.cwd(),
  outDir = 'dist',
  contentDir,
  basePath,
  includeDrafts = false,
} = {}) {
  root = await fs.realpath(path.resolve(root));
  const destination = await outputPath(root, outDir);
  const overlaps = (parent, child) => {
    const relative = path.relative(parent, child);
    return (
      !relative ||
      (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
    );
  };
  const requested = path.resolve(root, contentDir || 'content/posts');
  const contentPath = await fs.realpath(requested).catch((error) => {
    if (error.code === 'ENOENT') return requested;
    throw error;
  });
  if (overlaps(destination, contentPath) || overlaps(contentPath, destination)) {
    throw new Error('Output directory must not overlap the content source directory');
  }
  const config = await loadConfig(root, { basePath });
  const posts = await loadPosts({ root, contentDir, includeDrafts, config });
  const pages = renderSite({ config, posts });
  const seen = new Set();
  for (const page of pages) {
    if (seen.has(page.path.toLowerCase())) throw new Error(`Duplicate page route: ${page.path}`);
    seen.add(page.path.toLowerCase());
  }
  const staging = await fs.mkdtemp(path.join(root, '.qxblog-build-'));
  const previous = `${staging}-previous`;
  let movedPrevious = false;
  try {
    await copyAssets(root, staging);
    for (const page of pages) await writeOutput(staging, page.path, page.html);
    await writeOutput(
      staging,
      'assets/search.json',
      JSON.stringify(createSearchIndex(config, posts)),
    );
    await writeOutput(staging, 'sitemap.xml', createSitemap(config, pages, posts));
    await writeOutput(staging, 'feed.xml', createFeed(config, posts));
    await writeOutput(staging, 'robots.txt', createRobots(config));
    await writeOutput(staging, '.nojekyll', '');
    await fs.mkdir(path.dirname(destination), { recursive: true });
    if (await exists(destination)) {
      await fs.rename(destination, previous);
      movedPrevious = true;
    }
    try {
      await fs.rename(staging, destination);
    } catch (error) {
      if (movedPrevious) await fs.rename(previous, destination);
      throw error;
    }
    if (movedPrevious) await fs.rm(previous, { recursive: true, force: true });
    return { postCount: posts.length, pageCount: pages.length, outDir: destination };
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}
