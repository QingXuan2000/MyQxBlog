/* 模板共用的小工具，四类东西。转义、站内地址、日期格式化、按分类和标签聚合。

   站内地址一律走 localUrl，它同时处理 basePath 前缀和分段编码。模板里手写 "/posts/x.html"
   在项目站点上一定会 404，这是最容易犯也最难发现的一类错。

   分类和标签的聚合结果挂在 posts 数组的弱引用上缓存。一次构建里首页、列表、侧栏
   会问很多遍同一件事，重算的量不小。 */
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
export const jsonLd = (value) =>
  JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
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

// 站点配置只放行一小撮内联标记。配置由站点作者自己写，白名单该守还是要守，
// 一次误粘贴就可能变成 XSS。
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
