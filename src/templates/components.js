/* 列表页常用的片段：页头、单篇行、分页、空状态。
   统一全站视觉节奏。 */
import { renderFile } from './engine.js';
import { escapeHtml as e, localUrl, dateParts } from './helpers.js';

export function pageHero({ tag, title, sub, backUrl, backText }) {
  return renderFile('components/page-hero.html', {
    tag,
    title,
    sub,
    backUrl,
    backText,
  });
}

export function articleRow(post, config) {
  const date = dateParts(post.date, config);
  const categoryUrl = post.category
    ? localUrl(config, `categories/${post.categorySlug || post.category}/index.html`)
    : '';
  const categoryHTML = post.category
    ? `<a href="${categoryUrl}" class="qx-article-card-label qx-category-label">${e(post.category)}</a>`
    : '';
  const labelItems = (post.labels || []).map((l, i) => ({
    name: l,
    url: localUrl(config, `tags/${post.labelSlugs?.[i] || l}/index.html`),
  }));
  const labelsHTML = labelItems
    .map((item) => `<a href="${item.url}" class="qx-article-card-label">${e(item.name)}</a>`)
    .join('');

  return renderFile('components/article-card.html', {
    post,
    date,
    postUrl: localUrl(config, `posts/${post.id}.html`),
    categoryName: post.category || '',
    categoryUrl,
    categoryHTML,
    labelItems,
    labelsHTML,
  });
}

export function pagination(config, prefix, current, total) {
  if (total <= 1) return '';
  const url = (page) =>
    localUrl(config, page === 1 ? `${prefix}/index.html` : `${prefix}/page/${page}/index.html`);
  const visible = new Set(
    [1, total, current - 1, current, current + 1].filter((page) => page >= 1 && page <= total),
  );
  let previous = 0;
  const linksHTML = [...visible]
    .sort((a, b) => a - b)
    .map((page) => {
      const gap =
        previous && page - previous > 1
          ? '<span class="qx-pagination-ellipsis">&hellip;</span>'
          : '';
      previous = page;
      return `${gap}<a href="${url(page)}" class="qx-pagination-btn${page === current ? ' is-active' : ''}" aria-label="第 ${page} 页">${page}</a>`;
    })
    .join('');

  return renderFile('components/pagination.html', {
    total,
    current,
    prevUrl: current > 1 ? url(current - 1) : null,
    nextUrl: current < total ? url(current + 1) : null,
    linksHTML,
  });
}

export function emptyState(config, { kind = 'articles' } = {}) {
  const message =
    {
      articles: '暂无文章',
      categories: '暂无分类',
      tags: '暂无标签',
      archive: '暂无归档',
    }[kind] || '暂无内容';
  return renderFile('components/empty-state.html', { message, kind });
}
