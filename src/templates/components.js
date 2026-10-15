import { escapeHtml as e, localUrl, icon, number, dateParts, taxonomies } from './helpers.js';

export function sectionHeading(label, aside = '') {
  return `<div class="section-heading"><h2>${label}</h2>${aside}</div>`;
}

export function pageHeader({ eyebrow, title, description = '', count }) {
  return `<header class="page-heading"><p class="eyebrow"><span class="accent-dot"></span>${e(eyebrow)}</p><div class="page-heading-title"><h1>${e(title)}</h1>${count !== undefined ? `<span class="heading-count">${number(count)}</span>` : ''}</div>${description ? `<p class="page-description">${e(description)}</p>` : ''}</header>`;
}

export function articleRow(post, config, index) {
  const date = dateParts(post.date, config);
  return `<article class="post-row">
    <div class="post-row-number" aria-hidden="true">${number(index + 1)}</div>
    <div class="post-row-content"><div class="post-meta"><time datetime="${e(post.date)}">${date.full}</time><span class="meta-separator">/</span>${post.category ? `<a href="${localUrl(config, `categories/${post.categorySlug || post.category}/index.html`)}">${e(post.category)}</a><span class="meta-separator">/</span>` : ''}<span>${post.readingMinutes || 1} 分钟阅读</span></div>
    <h2><a href="${localUrl(config, `posts/${post.id}.html`)}">${e(post.title)}</a></h2><p class="post-excerpt">${e(post.excerpt)}</p>
    ${
      (post.labels || []).length
        ? `<div class="post-tags">${post.labels
            .slice(0, 3)
            .map(
              (label, i) =>
                `<a href="${localUrl(config, `tags/${post.labelSlugs?.[i] || label}/index.html`)}"># ${e(label)}</a>`,
            )
            .join('')}</div>`
        : ''
    }</div>
    <a class="post-row-arrow" href="${localUrl(config, `posts/${post.id}.html`)}" aria-label="阅读：${e(post.title)}">${icon('diagonal')}</a>
  </article>`;
}

export function emptyState(config, { kind = 'articles', compact = false } = {}) {
  const content = {
    articles: [
      '尚未发布文章',
      '故事，正在酝酿。',
      '留一点空白给下一次思考。新的文字，会在这里慢慢生长。',
    ],
    categories: ['尚无分类', '让思考，自成脉络。', '文章发布后，每一种关注都会在这里找到归属。'],
    tags: ['尚无标签', '从一个词，遇见更多。', '未来的文章会带着各自的关键词，在这里相遇。'],
    archive: ['尚无归档', '把时间，留在文字里。', '第一篇文章发布后，这里会留下它的时间坐标。'],
  }[kind];
  return `<div class="empty-state${compact ? ' empty-state-compact' : ''}"><div class="empty-mark" aria-hidden="true"><span>待</span><span>续</span><i></i></div><div class="empty-copy"><p class="eyebrow">${content[0]}</p><h2>${content[1]}</h2><p>${content[2]}</p>${kind === 'articles' ? `<a class="text-link" href="${localUrl(config, 'about/index.html')}">先认识一下我 ${icon('arrow')}</a>` : `<a class="text-link" href="${localUrl(config, 'articles/index.html')}">浏览文章 ${icon('arrow')}</a>`}</div></div>`;
}

export function pagination(config, prefix, current, total) {
  if (total <= 1) return '';
  const url = (page) =>
    localUrl(config, page === 1 ? `${prefix}/index.html` : `${prefix}/page/${page}/index.html`);
  const visible = new Set(
    [1, total, current - 1, current, current + 1].filter((page) => page >= 1 && page <= total),
  );
  let previous = 0;
  const links = [...visible]
    .sort((a, b) => a - b)
    .map((page) => {
      const gap =
        previous && page - previous > 1 ? '<span class="pagination-ellipsis">…</span>' : '';
      previous = page;
      return `${gap}<a href="${url(page)}"${page === current ? ' aria-current="page"' : ''} aria-label="第 ${page} 页">${number(page)}</a>`;
    })
    .join('');
  return `<nav class="pagination" aria-label="分页">${current > 1 ? `<a class="pagination-prev" rel="prev" href="${url(current - 1)}">${icon('arrow')}<span>上一页</span></a>` : '<span></span>'}<div class="pagination-pages">${links}</div>${current < total ? `<a class="pagination-next" rel="next" href="${url(current + 1)}"><span>下一页</span>${icon('arrow')}</a>` : '<span></span>'}</nav>`;
}

export function sidebar(config, posts) {
  const categories = taxonomies(posts, 'categories');
  const tags = taxonomies(posts, 'tags');
  return `<aside class="journal-sidebar" aria-label="博客信息">
    <section class="author-note"><p class="eyebrow">BEHIND THE WORDS</p><a href="${localUrl(config, 'about/index.html')}" class="author-profile"><img src="${localUrl(config, 'img/Avatar.png')}" alt="" width="48" height="48"><div><span class="author-name">${e(config.site.author)}</span><span class="author-label">写代码，也写生活。</span></div>${icon('diagonal')}</a><p class="author-motto">${e(config.sidebar?.motto || '保持专注，保持思考。')}</p><p class="author-description">在这偌大互联网中，<br>留下一个小小的地标。</p><a href="${localUrl(config, 'about/index.html')}" class="text-link">关于我 ${icon('arrow')}</a></section>
    <section class="sidebar-index"><p class="eyebrow">EXPLORE THE JOURNAL</p><a href="${localUrl(config, 'articles/index.html')}"><span>全部文章</span><span class="index-count">${number(posts.length)}</span>${icon('arrow')}</a><a href="${localUrl(config, 'categories/index.html')}"><span>内容分类</span><span class="index-count">${number(categories.length)}</span>${icon('arrow')}</a><a href="${localUrl(config, 'tags/index.html')}"><span>关键词</span><span class="index-count">${number(tags.length)}</span>${icon('arrow')}</a><a href="${localUrl(config, 'archive/index.html')}"><span>时间归档</span><span class="index-count">${number(new Set(posts.map((post) => dateParts(post.date, config).year)).size)}</span>${icon('arrow')}</a></section>
    <a class="rss-link" href="${localUrl(config, 'feed.xml')}"><span class="accent-dot"></span>通过 RSS 订阅更新 ${icon('diagonal')}</a>
  </aside>`;
}

export function filterNav(config, current) {
  return `<nav class="filter-nav" aria-label="文章浏览方式">${[
    ['articles', '全部文章'],
    ['categories', '按分类'],
    ['tags', '按标签'],
    ['archive', '时间归档'],
  ]
    .map(
      ([route, label]) =>
        `<a href="${localUrl(config, `${route}/index.html`)}"${route === current ? ' aria-current="page"' : ''}>${label}</a>`,
    )
    .join('')}</nav>`;
}
