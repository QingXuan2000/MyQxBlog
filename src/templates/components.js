/* 列表页复用的三个片段，页头、文章行、分页。标签、分类、归档、关于都靠它们拼，
   改一处全站跟着变。

   分页只露出首尾页和当前页左右各一页，中间用省略号补，页数多了也不会把一行撑爆。 */
import { escapeHtml as e, localUrl, dateParts } from './helpers.js';

export function pageHero({ tag, title, sub, backUrl, backText }) {
  return `<section class="qx-page-hero">
    <div class="qx-page-hero-back-wrapper">
        <a href="${backUrl || 'javascript:history.back()'}" class="qx-page-hero-back" data-cursor="BACK">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg> ${e(backText || '返回上一页')}
        </a>
    </div>
    ${tag ? `<span class="qx-page-hero-tag">${e(tag)}</span>` : ''}
    <h1 class="qx-page-hero-title" data-roll>${e(title)}</h1>
    ${sub ? `<p class="qx-page-hero-sub">${e(sub)}</p>` : ''}
</section>`;
}

export function articleRow(post, config) {
  const date = dateParts(post.date, config);
  const categoryHTML = post.category
    ? `<a href="${localUrl(config, `categories/${post.categorySlug || post.category}/index.html`)}" class="qx-article-card-label qx-category-label">${e(post.category)}</a>`
    : '';
  const labelsHTML = (post.labels || [])
    .map(
      (l, i) =>
        `<a href="${localUrl(config, `tags/${post.labelSlugs?.[i] || l}/index.html`)}" class="qx-article-card-label">${e(l)}</a>`,
    )
    .join('');

  return `<article class="qx-article-card post-row" data-reveal>
    <a href="${localUrl(config, `posts/${post.id}.html`)}" class="qx-article-card-link" data-cursor="OPEN" aria-label="阅读文章：${e(post.title)}"></a>
    <div class="qx-article-card-date"><time datetime="${e(post.date)}">${date.full}</time></div>
    <h2 class="qx-article-card-title"><a href="${localUrl(config, `posts/${post.id}.html`)}" data-cursor="READ"><span class="qx-ul" data-roll>${e(post.title)}</span></a></h2>
    <div class="qx-article-card-labels">
        ${categoryHTML}
        ${labelsHTML}
    </div>
</article>`;
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
        previous && page - previous > 1
          ? '<span class="qx-pagination-ellipsis">&hellip;</span>'
          : '';
      previous = page;
      return `${gap}<a href="${url(page)}" class="qx-pagination-btn${page === current ? ' is-active' : ''}" aria-label="第 ${page} 页">${page}</a>`;
    })
    .join('');

  return `<div class="qx-pagination" id="qxPagination">
    <div class="qx-pagination-row">
        ${
          current > 1
            ? `<a href="${url(current - 1)}" class="qx-pagination-nav" data-cursor="PREV" aria-label="上一页"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg></a>`
            : ''
        }
        ${links}
        ${
          current < total
            ? `<a href="${url(current + 1)}" class="qx-pagination-nav" data-cursor="NEXT" aria-label="下一页"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></a>`
            : ''
        }
    </div>
</div>`;
}

export function emptyState(config, { kind = 'articles' } = {}) {
  const content =
    {
      articles: '尚未发布文章',
      categories: '尚无分类',
      tags: '尚无标签',
      archive: '尚无归档',
    }[kind] || '尚未发布文章';
  return `<div class="empty-state"><p>${content}</p></div>`;
}
