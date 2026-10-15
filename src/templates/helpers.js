const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
export const jsonLd = (value) =>
  JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
export const number = (value) => String(value).padStart(2, '0');

const baseCache = new WeakMap();
function siteBase(config) {
  let base = baseCache.get(config);
  if (base === undefined) {
    base = `/${String(config.basePath ?? '/').replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\//, '/');
    baseCache.set(config, base);
  }
  return base;
}

export function localUrl(config, path = 'index.html') {
  return (
    siteBase(config) +
    path
      .replace(/^\/+/, '')
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')
  );
}

export function absoluteUrl(config, path = 'index.html') {
  return new URL(localUrl(config, path), config.site.url || 'https://example.com').href;
}

export function safeHref(value, fallback = '#') {
  const href = String(value ?? '').trim();
  return /^(https?:\/\/|mailto:)/i.test(href) ? href : fallback;
}

// 站点配置仅允许一小组刻意受限的内联标记。
export function configMarkup(value) {
  return String(value ?? '')
    .split(/(<[^>]*>)/g)
    .map((part) => {
      if (/^<br\s*\/?\s*>$/i.test(part)) return '<br />';
      if (/^<\/?(?:strong|em|b|i)>$/i.test(part)) return part.toLowerCase();
      if (/^<\/a\s*>$/i.test(part)) return '</a>';
      if (/^<a\s/i.test(part)) {
        const href = part.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];
        const url = safeHref(href);
        return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">`;
      }
      return /^<[^>]*>$/.test(part) ? '' : escapeHtml(part);
    })
    .join('');
}

export function dateParts(value, config) {
  let date = String(value ?? '');
  const offset = /^(\+|-)(\d{2}):(\d{2})$/.exec(config?.build?.timezoneOffset || '+08:00');
  if (date.includes('T') && offset && Number.isFinite(Date.parse(date))) {
    const minutes = (Number(offset[2]) * 60 + Number(offset[3])) * (offset[1] === '-' ? -1 : 1);
    date = new Date(Date.parse(date) + minutes * 60_000).toISOString();
  }
  const [year = '', month = '', day = ''] = date.slice(0, 10).split('-');
  return { year, month, day, full: `${year}.${month}.${day}` };
}

export function icon(name, className = '') {
  const paths = {
    arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    diagonal: '<path d="M5 19 19 5M5 5h14v14"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    moon: '<path d="M20.2 15.3A8.5 8.5 0 0 1 8.7 3.8a8.5 8.5 0 1 0 11.5 11.5Z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    up: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
  };
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
}

const taxonomyCache = new WeakMap();
export function taxonomies(posts, type) {
  let byType = taxonomyCache.get(posts);
  if (!byType) {
    byType = new Map();
    taxonomyCache.set(posts, byType);
  }
  const cached = byType.get(type);
  if (cached) return cached;

  const groups = new Map();
  const members = new Map();
  for (const post of posts) {
    const pairs =
      type === 'tags'
        ? (post.labels || []).map((label, index) => [post.labelSlugs?.[index] || label, label])
        : post.category
          ? [[post.categorySlug || post.category, post.category]]
          : [];
    for (const [slug, name] of pairs) {
      let group = groups.get(slug);
      if (!group) {
        group = { slug, name, posts: [] };
        groups.set(slug, group);
        members.set(slug, new Set());
      }
      const seen = members.get(slug);
      if (!seen.has(post)) {
        seen.add(post);
        group.posts.push(post);
      }
    }
  }
  const result = [...groups.values()].sort(
    (a, b) => b.posts.length - a.posts.length || a.name.localeCompare(b.name, 'zh-CN'),
  );
  byType.set(type, result);
  return result;
}
