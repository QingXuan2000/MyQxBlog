/* 构建总编排。读配置、读文章、渲染页面、写产物，四步都在这里串起来。

   写盘用临时目录加整体替换。产物先落进 .qxblog-build-xxx，写全了才把旧 dist 挪走，
   新目录改名顶上，成功后删旧目录。好处是构建中途失败时线上那版还在，不会留下
   写了一半的 dist。staging 目录用 mkdtemp 生成，名字带随机后缀，同时跑两次也不会撞。

   输出位置卡得很死。只认 dist 和 .preview 两个顶层目录，路径里不许有 ..，途经的每一级
   都不许是符号链接，也不许和内容目录互相包含。这几条是为了让 npm run build 永远不会
   因为配置写错而覆盖到项目里别的东西。 */
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
  // 第一段就决定了能不能写，超出 dist 和 .preview 一律拒绝。
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
    // 逐级 lstat，符号链接会把写入引到项目外面去。
    const stat = await fs.lstat(current).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    if (stat?.isSymbolicLink()) throw new Error('Output directory must not be a symbolic link');
  }
  return target;
}

async function writeOutput(directory, filename, value) {
  const destination = path.resolve(directory, filename);
  // 模板里拼出来的路径同样要挡一下，防止 ../ 把文件写到 staging 外面。
  if (!destination.startsWith(`${directory}${path.sep}`))
    throw new Error(`Invalid output path: ${filename}`);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, value, 'utf8');
}

async function copyAssets(root, staging) {
  const publicDir = path.join(root, 'public');
  // public 原样铺到根目录，头像、logo、CNAME 都靠这一句。
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
  // KaTeX 的样式和字体直接从 node_modules 取，避免在仓库里再存一份。
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
  // 两个方向都要看。输出套内容会让下次构建把自己的产物当源码读，内容套输出则
  // 清理旧产物时可能连文章一起删掉。
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
  // 大小写不敏感地去重。Windows 和 macOS 的文件系统本来就不分大小写，
  // 两个只差大小写的路由在同一台机器上会互相覆盖。
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
    // 换名是原子的，但跨了两步。第二步失败就把旧目录挪回来，退回到构建前的状态。
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
