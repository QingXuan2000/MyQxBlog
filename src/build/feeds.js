/* 站点正文之外的几份附属产物，sitemap、RSS、robots 和搜索索引。
   它们都得用绝对地址，所以统一从这里取，路径分段单独 encodeURIComponent，
   保证 <loc> 里写的和页面上 canonical 的完全一致。

   XML 里不能出现裸的 & < > " '，模板字符串拼之前先过一遍 xml()，
   正文里带个 & 也不会让整份 feed 变成无效 XML。 */
const XML_ESCAPES = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' };
const xml = (value) => String(value ?? '').replace(/[<>&"']/g, (char) => XML_ESCAPES[char]);

export function absoluteURL(config, relativePath) {
  return `${config.site.url.replace(/\/$/, '')}/${relativePath.replace(/^\//, '')}`;
}

export function createSitemap(config, pages, posts) {
  // 只有文章有真实修改时间，其余页面给不出有意义的 lastmod 就干脆不写。
  const dates = new Map(posts.map((post) => [`posts/${post.id}.html`, post.updated || post.date]));
  // 逐段 encodeURIComponent，保证 <loc> 与 canonical / 站内链接一致。
  const encodePath = (value) => value.split('/').map(encodeURIComponent).join('/');
  const entries = pages
    .filter((page) => page.path !== '404.html')
    .map((page) => {
      const updated = dates.get(page.path);
      return `<url><loc>${xml(absoluteURL(config, encodePath(page.path)))}</loc>${updated ? `<lastmod>${xml(updated)}</lastmod>` : ''}</url>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
}

export function createFeed(config, posts) {
  // 只喂最近 30 篇。全文 RSS 会让订阅器每回都拖一份整站，读者也不看那么远。
  const items = posts.slice(0, 30).map((post) => {
    const url = absoluteURL(config, `posts/${encodeURIComponent(post.id)}.html`);
    return `<item><title>${xml(post.title)}</title><link>${xml(url)}</link><guid isPermaLink="true">${xml(url)}</guid><pubDate>${new Date(post.date).toUTCString()}</pubDate><description>${xml(post.excerpt)}</description>${post.labels.map((tag) => `<category>${xml(tag)}</category>`).join('')}</item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xml(config.site.title)}</title><link>${xml(config.site.url)}</link><description>${xml(config.site.description)}</description><language>zh-CN</language><atom:link href="${xml(absoluteURL(config, 'feed.xml'))}" rel="self" type="application/rss+xml"/>${items.join('\n')}</channel></rss>\n`;
}

export function createRobots(config) {
  // robots 里的路径同样要带 basePath，否则项目站点会指到根目录去。
  const robots = config.build.robots || {};
  const prefix = config.basePath.replace(/\/$/, '');
  const rule = (value) => `${prefix}/${String(value).replace(/^\//, '')}`;
  return [
    `User-agent: ${robots.userAgent || '*'}`,
    `Allow: ${rule(robots.allow || '/')}`,
    ...(robots.disallow || []).map((value) => `Disallow: ${rule(value)}`),
    ...(robots.additionalRules || []),
    `Sitemap: ${absoluteURL(config, 'sitemap.xml')}`,
    '',
  ].join('\n');
}

export function createSearchIndex(config, posts) {
  // 索引里放的是正文纯文本，前端才不用为了搜索再请求一遍页面。
  return posts.map(({ id, title, date, labels, excerpt, text }) => ({
    id,
    title,
    date,
    labels,
    excerpt,
    text,
    url: `${config.basePath}posts/${encodeURIComponent(id)}.html`,
  }));
}
