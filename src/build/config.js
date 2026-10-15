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
  return {
    ...raw,
    site: {
      name: 'QxBlog',
      title: 'QxBlog',
      author: 'QingXuanJun',
      description: '关于代码、生活与沿途的思考。',
      ...raw.site,
      url: `${url.origin}${prefix}`.replace(/\/$/, ''),
    },
    hero: { title: '保持专注，保持思考。', ...raw.hero },
    about: { sections: [], friendLinks: [], ...raw.about },
    sidebar: { links: [], ...raw.sidebar },
    footerContent: raw.footerContent || [],
    build: { githubStartId: 1, ...buildRaw, maxArticlesPerPage: pageSize, timezoneOffset },
    basePath: prefix,
  };
}
