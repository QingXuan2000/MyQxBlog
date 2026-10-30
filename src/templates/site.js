/* 各页面的正文拼装。renderSite 是路由表，从这里能一眼看到站点会产出哪些地址。

   index.html，articles/index.html 加 articles/page/N/index.html，categories 与 tags
   各自的总览页和每个分组的列表页，archive、about、404，最后是每篇文章的 posts/<id>.html。
   列表页的页码从 1 开始，第一页永远是 index.html，第二页才是 page/2，这样地址不会分叉。

   页面函数只收 config 和 posts，不读全局状态，同样的输入给同样的结果。
   整页 HTML 里唯一会变的是 layout 里那条随机生成的二进制跑马灯。 */
import {
  escapeHtml as e,
  localUrl,
  dateParts,
  taxonomies,
  configMarkup,
  safeHref,
} from './helpers.js';
import { layout } from './layout.js';
import { articleRow, emptyState, pageHero, pagination } from './components.js';

function renderSeparator(strings = ['Do', 'Things', 'Your', 'Way']) {
  const binaries = strings.map((str) => {
    return str
      .split('')
      .map((char) => char.charCodeAt(0).toString(2))
      .join(' ');
  });

  return `<div class="a-separator s__separator js-separator">
  <span class="a__triangle"></span>
  <span class="a__binaries">
    ${binaries
      .map(
        (binary) => `
      <span class="a__code js-code">
        ${binary
          .split('')
          .map(
            (char) =>
              `<span class="a__char${char === ' ' ? ' a__char--blank' : ` a__char--${char}`} js-char">${char}</span>`,
          )
          .join('')}
      </span>
      <span class="a__stripes"></span>`,
      )
      .join('')}
  </span>
  <span class="a__triangle"></span>
</div>`;
}

// 等宽字体一个字符宽 0.6em，CJK 回退字形按 1em 计。累加出来的是整句的步进总和，
// 除以可用宽度就得到字号上限。
const titleAdvance = (text) =>
  [...text].reduce((sum, ch) => sum + (ch.codePointAt(0) > 0x2e80 ? 1 : 0.6), 0);

function home(config, posts) {
  // 标语大写、单行；合并多余空白，避免换行/双空格撑宽。
  const heroTitle = (config.site?.welcome || 'WELCOME TO QXBLOG')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

  // 可用宽度是视口减去两侧留白，再留 8px 余量，除以总步进就是能填满一行的字号。
  // 写成 CSS 变量而不是直接算像素，窗口一变浏览器自己重算。
  const units = Math.max(titleAdvance(heroTitle), 1);
  const heroFit = `--hero-fit: calc((100vw - 2 * var(--title-inset) - 8px) / ${units.toFixed(2)})`;

  return `<section class="s-hero" id="hero" style="${heroFit}">
    <div class="s__waves">
        <svg class="qx-waves-svg js-waves-svg" width="100%" height="100%" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"></svg>
    </div>

    <div class="s__content js-content">
        ${renderSeparator(['Qx', 'Blog', 'Ke', 'ep', 'Fo', 'cu', 's'])}

        <h1 class="s__title" id="hero-name">
            <span class="s__title__word js-word" data-roll>${e(heroTitle)}</span>
        </h1>

        ${renderSeparator(['Do', 'Things', 'Your', 'Way'])}
    </div>
</section>

<section class="qx-articles">
    <div class="qx-articles-head" data-roll>文章</div>
    <div class="qx-articles-grid post-list">
        ${
          posts.length
            ? posts
                .slice(0, Math.min(config.build.maxArticlesPerPage, 10))
                .map((post) => articleRow(post, config))
                .join('')
            : emptyState(config, { kind: 'articles' })
        }
    </div>
    ${pagination(config, 'articles', 1, Math.ceil(posts.length / config.build.maxArticlesPerPage))}
</section>`;
}

function listing(config, posts, { title, tag, sub, prefix, page, pageSize, backUrl }) {
  const offset = (page - 1) * pageSize;
  const pagePosts = posts.slice(offset, offset + pageSize);

  return `${pageHero({
    tag: tag || '<Articles />',
    title,
    sub: sub || `共 ${posts.length} 篇文章。`,
    backUrl,
  })}
<section class="qx-articles">
    <div class="qx-articles-grid post-list">
        ${
          pagePosts.length
            ? pagePosts.map((post) => articleRow(post, config)).join('')
            : emptyState(config, { kind: 'articles' })
        }
    </div>
    ${pagination(config, prefix, page, Math.ceil(posts.length / pageSize))}
</section>`;
}

function taxonomyIndex(config, posts, type) {
  const isTags = type === 'tags';
  const groups = taxonomies(posts, type);

  return `${pageHero({
    tag: isTags ? '<Tags />' : '<Categories />',
    title: isTags ? '标签' : '分类',
    sub: isTags ? `共 ${groups.length} 个标签。` : '按分类浏览文章。',
  })}
<section class="qx-tags">
    <div class="${isTags ? 'qx-tags-list' : 'qx-categories-list'}">
        ${
          groups.length
            ? groups
                .map(
                  (
                    group,
                  ) => `<a href="${localUrl(config, `${type}/${group.slug}/index.html`)}" class="qx-tag-item" data-reveal data-cursor="BROWSE">
            <span class="qx-tag-name">${e(group.name)}</span>
            <span class="qx-tag-count">${group.posts.length}</span>
        </a>`,
                )
                .join('')
            : emptyState(config, { kind: type })
        }
    </div>
</section>`;
}

function archive(config, posts) {
  const years = new Map();
  for (const post of posts) {
    const { year, month } = dateParts(post.date, config);
    if (!years.has(year)) years.set(year, new Map());
    const months = years.get(year);
    if (!months.has(month)) months.set(month, []);
    months.get(month).push(post);
  }

  const sortedYears = [...years.entries()].sort(([a], [b]) => b.localeCompare(a));

  return `${pageHero({
    tag: '<Archive />',
    title: '归档',
    sub: `共 ${posts.length} 篇文章。`,
  })}
<section class="qx-archive">
    <div class="qx-archive-list">
        ${
          posts.length
            ? sortedYears
                .map(([year, monthsMap]) => {
                  const sortedMonths = [...monthsMap.entries()].sort(([a], [b]) =>
                    b.localeCompare(a),
                  );
                  const yearCount = [...monthsMap.values()].reduce((sum, m) => sum + m.length, 0);
                  const monthSections = sortedMonths
                    .map(
                      ([month, items]) => `<section class="qx-archive-month">
                <h3 class="qx-archive-month-title">${month} 月 <span class="qx-archive-month-count">${items.length}</span></h3>
                <ul class="qx-archive-items">
                    ${items
                      .map((p) => {
                        const date = dateParts(p.date, config);
                        const categoryHTML = p.category
                          ? `<a href="${localUrl(config, `categories/${p.categorySlug || p.category}/index.html`)}" class="qx-article-card-label qx-category-label">${e(p.category)}</a>`
                          : '';
                        return `<li class="qx-archive-item" data-reveal>
                            <time class="qx-archive-date" datetime="${e(p.date)}">${date.month}.${date.day}</time>
                            <a href="${localUrl(config, `posts/${p.id}.html`)}" class="qx-archive-link" data-cursor="READ">${e(p.title)}</a>
                            <div class="qx-archive-tags">${categoryHTML}</div>
                        </li>`;
                      })
                      .join('')}
                </ul>
            </section>`,
                    )
                    .join('');

                  return `<section class="qx-archive-year">
                <h2>${year} <span class="qx-archive-year-count">${yearCount}</span></h2>
                ${monthSections}
            </section>`;
                })
                .join('')
            : emptyState(config, { kind: 'archive' })
        }
    </div>
</section>`;
}

function about(config) {
  const sections = config.about?.sections || [];
  const friendLinks = config.about?.friendLinks || [];

  return `${pageHero({
    tag: '<About />',
    title: '关于',
    sub: '关于我和这个博客。',
  })}
<section class="qx-about">
    ${sections
      .map(
        (s) => `<div class="qx-about-section">
        <h2 class="qx-about-head">${e(s.head)}</h2>
        <p class="qx-about-text">${configMarkup(s.text)}</p>
    </div>`,
      )
      .join('')}
    <div class="qx-about-section">
        <h2 class="qx-about-head">友情链接</h2>
        <div class="qx-friend-links">
            ${
              friendLinks.length
                ? friendLinks
                    .map(
                      (f) =>
                        `<a href="${e(safeHref(f.url))}" class="qx-friend-link" target="_blank" rel="noopener">${e(f.name)}</a>`,
                    )
                    .join('')
                : '<p class="muted">暂无友情链接。</p>'
            }
        </div>
    </div>
</section>`;
}

function postPage(config, post, posts) {
  const index = posts.indexOf(post);
  const newer = posts[index - 1];
  const older = posts[index + 1];
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

  return `<article class="qx-post">
    <header class="qx-post-header">
        <div class="qx-post-back-wrapper">
            <a href="javascript:history.back()" class="qx-post-back">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg> 返回上一页
            </a>
        </div>
        <h1 class="qx-post-title" data-roll>${e(post.title)}</h1>
        <div class="qx-post-meta">
            <span class="qx-post-date">发布日期：<time datetime="${e(post.date)}">${date.full}</time></span>
            <span class="qx-post-author">${e(post.author || config.site.author)}</span>
        </div>
        <div class="qx-post-labels">
            ${categoryHTML}
            ${labelsHTML}
        </div>
    </header>
    <div class="qx-post-body" data-post-body>
        ${post.html || ''}
    </div>
    <footer class="qx-post-footer">
        <p class="qx-post-updated">最后更新：${dateParts(post.updated || post.date, config).full}</p>
        ${
          newer || older
            ? `<nav class="post-navigation qx-post-navigation" aria-label="相邻文章">
            ${newer ? `<a class="qx-prev-post" href="${localUrl(config, `posts/${newer.id}.html`)}">上一篇：${e(newer.title)}</a>` : ''}
            ${older ? `<a class="qx-next-post" href="${localUrl(config, `posts/${older.id}.html`)}">下一篇：${e(older.title)}</a>` : ''}
        </nav>`
            : ''
        }
    </footer>
</article>`;
}

function notFound(config) {
  return `<div class="wrapper">
    <div class="glow"></div>
    <span class="number">404</span>
    <span class="tag">&lt;404 /&gt;</span>
    <h1 class="title">页面未找到</h1>
    <p class="desc">你访问的页面不存在，或已被移除</p>
    <a href="${localUrl(config, 'index.html')}" class="back">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        返回首页
    </a>
</div>`;
}

export function renderSite({ config, posts }) {
  const pageSize = Number(config.build?.maxArticlesPerPage ?? 20);
  const normalizedConfig = {
    ...config,
    site: { name: 'QxBlog', title: 'QxBlog', author: 'QingXuanJun', ...config.site },
    build: {
      ...config.build,
      maxArticlesPerPage: Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 20,
    },
  };
  config = normalizedConfig;
  posts = [...posts].sort(
    (a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)),
  );
  const pages = [];
  const add = (path, options) => pages.push({ path, html: layout({ config, path, ...options }) });

  add('index.html', { body: home(config, posts), type: 'home' });

  const addListings = ({ title, tag, sub, prefix, active, items, backUrl }) => {
    const total = Math.max(1, Math.ceil(items.length / config.build.maxArticlesPerPage));
    for (let page = 1; page <= total; page++) {
      const path = page === 1 ? `${prefix}/index.html` : `${prefix}/page/${page}/index.html`;
      add(path, {
        title: `${title}${page > 1 ? ` · 第 ${page} 页` : ''}`,
        description: sub,
        active,
        body: listing(config, items, {
          title,
          tag,
          sub,
          prefix,
          active,
          page,
          pageSize: config.build.maxArticlesPerPage,
          backUrl,
        }),
      });
    }
  };

  addListings({
    title: '文章',
    tag: '<Articles />',
    sub: `共 ${posts.length} 篇文章。`,
    prefix: 'articles',
    active: 'articles',
    items: posts,
  });

  for (const type of ['categories', 'tags']) {
    const isTags = type === 'tags';
    add(`${type}/index.html`, {
      title: isTags ? '标签' : '分类',
      active: type,
      body: taxonomyIndex(config, posts, type),
    });
    for (const group of taxonomies(posts, type))
      addListings({
        title: group.name,
        tag: isTags ? '<Tag />' : '<Category />',
        sub: `${group.name} ${isTags ? '标签' : '分类'}下的所有文章，共 ${group.posts.length} 篇。`,
        prefix: `${type}/${group.slug}`,
        active: type,
        items: group.posts,
        backUrl: localUrl(config, `${type}/index.html`),
      });
  }

  add('archive/index.html', { title: '归档', active: 'archive', body: archive(config, posts) });
  add('about/index.html', { title: '关于', active: 'about', body: about(config) });
  add('404.html', { title: '页面未找到', type: '404', body: notFound(config) });

  for (const post of posts)
    add(`posts/${post.id}.html`, {
      title: post.title,
      description: post.excerpt,
      active: 'articles',
      type: 'post',
      post,
      body: postPage(config, post, posts),
    });

  return pages;
}
