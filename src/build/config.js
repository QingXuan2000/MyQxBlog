/* 两份配置的读取、校验与默认值合并。
   读进来只做一件事，把散在 JSON 里的值变成模板可以直接用的形状，顺便挡住会让构建
   写坏产物的取值，比如非 HTTP 的 site.url、超出 1 到 100 的分页数、写错的时区。

   basePath 的优先级是这样，命令行 --base 最高，没给就取 site.url 的路径部分。
   项目站点 https://user.github.io/QxBlog/ 会自动得到 /QxBlog/ 前缀，自定义域名得到 /。 */
import fs from 'node:fs/promises';
import path from 'node:path';

async function readJSON(file, optional = false) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (optional && error.code === 'ENOENT') return {};
    throw new Error(`Cannot read ${file}: ${error.message}`, { cause: error });
  }
}

export function normalizeBasePath(value) {
  const input = String(value || '/').replaceAll('\\', '/');
  // 带查询串或片段的前缀拼不出可用的站内地址，.. 和 . 则可能把输出写到别处。
  if (/[?#]/.test(input) || input.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error(`Invalid base path: ${input}`);
  }
  return `/${input.split('/').filter(Boolean).join('/')}${input.split('/').filter(Boolean).length ? '/' : ''}`;
}

export async function loadConfig(root, { basePath } = {}) {
  const raw = await readJSON(path.join(root, 'config/siteConfig.json'));
  const buildRaw = await readJSON(path.join(root, 'config/buildConfig.json'), true);
  if (!raw.site?.url) throw new Error('config/siteConfig.json requires site.url');
  const url = new URL(raw.site.url);
  if (!['https:', 'http:'].includes(url.protocol))
    throw new Error('site.url must be an HTTP(S) URL');
  const pageSize = Number(buildRaw.maxArticlesPerPage ?? 20);
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new Error('maxArticlesPerPage must be an integer between 1 and 100');
  }
  const timezoneOffset = buildRaw.timezoneOffset || '+08:00';
  if (!/^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(timezoneOffset))
    throw new Error('Invalid timezoneOffset');
  const prefix = normalizeBasePath(basePath ?? url.pathname);
  // 下面的键都有兜底值，站点即使只配了 url 也能构建出一套完整页面。
  return {
    ...raw,
    site: {
      name: 'QxBlog',
      title: 'QxBlog',
      author: 'QingXuanJun',
      description: '关于代码、生活与沿途的思考。',
      welcome: 'WELCOME TO QXBLOG',
      ...raw.site,
      url: `${url.origin}${prefix}`.replace(/\/$/, ''),
    },
    about: { sections: [], friendLinks: [], ...raw.about },
    sidebar: { links: [], ...raw.sidebar },
    footerContent: raw.footerContent || [],
    build: { githubStartId: 1, ...buildRaw, maxArticlesPerPage: pageSize, timezoneOffset },
    basePath: prefix,
  };
}
