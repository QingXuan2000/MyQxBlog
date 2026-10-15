import {
  escapeHtml as e,
  localUrl,
  icon,
  number,
  dateParts,
  taxonomies,
  configMarkup,
  safeHref,
} from './helpers.js';
import { layout } from './layout.js';
import {
  articleRow,
  emptyState,
  filterNav,
  pageHeader,
  pagination,
  sectionHeading,
  sidebar,
} from './components.js';

function home(config, posts) {
  const title = config.hero?.title || '保持专注，保持思考。';
  const parts = title.match(/^(.*?[，,])\s*(.+)$/);
  const heading = parts ? `${e(parts[1])}<br><span>${e(parts[2])}</span>` : e(title);
  return `<section class="journal-hero"><div class="hero-kicker"><p class="eyebrow"><span class="accent-dot"></span>A PERSONAL JOURNAL</p><span class="hero-edition">${e(config.hero?.tag || '<Blog />')}</span></div><div class="hero-main"><h1>${heading}</h1><div class="hero-aside"><span class="hero-note-number">01 — ∞</span><p>记录沿途的所见与所思，<br>在文字里，找到自己的方向。</p><a href="${localUrl(config, 'about/index.html')}" class="text-link">关于这片小天地 ${icon('arrow')}</a></div></div><div class="hero-baseline"><span>${e(config.site.author.toUpperCase())} / NOTES & THOUGHTS</span><span>持续记录，慢慢生长 ${icon('diagonal')}</span></div></section>
    <div class="journal-grid"><section class="journal-feed" aria-labelledby="latest-title">${sectionHeading('<span id="latest-title">最新手记</span><span class="section-count">' + number(posts.length) + '</span>', `<a class="text-link" href="${localUrl(config, 'articles/index.html')}">全部文章 ${icon('arrow')}</a>`)}${
      posts.length
        ? `<div class="post-list">${posts
            .slice(0, Math.min(config.build.maxArticlesPerPage, 6))
            .map((post, i) => articleRow(post, config, i))
            .join('')}</div>`
        : emptyState(config)
    }</section>${sidebar(config, posts)}</div>`;
}

function listing(
  config,
  posts,
  { title, eyebrow, description, prefix, active, page, pageSize, allPosts },
) {
  const offset = (page - 1) * pageSize;
  return `${pageHeader({ title, eyebrow, description, count: posts.length })}${filterNav(config, active)}<div class="journal-grid index-grid"><section class="journal-feed" aria-label="文章列表"><div class="list-toolbar"><p>${page > 1 ? `第 ${number(page)} 页` : '按时间倒序'}<span class="toolbar-dot">·</span>${posts.length} 篇文章</p><span class="eyebrow">THE JOURNAL</span></div>${
    posts.length
      ? `<div class="post-list">${posts
          .slice(offset, offset + pageSize)
          .map((post, index) => articleRow(post, config, offset + index))
          .join('')}</div>`
      : emptyState(config)
  }${pagination(config, prefix, page, Math.ceil(posts.length / pageSize))}</section>${sidebar(config, allPosts)}</div>`;
}

function taxonomyIndex(config, posts, type) {
  const tags = type === 'tags';
  const groups = taxonomies(posts, type);
  return `${pageHeader({ eyebrow: tags ? 'A MAP OF IDEAS' : 'FOLLOW A THREAD', title: tags ? '关键词' : '内容分类', description: tags ? '一个词，是通向另一段思考的入口。' : '顺着一条线索，读懂每一次关注。', count: groups.length })}${filterNav(config, type)}<section class="taxonomy-section" aria-label="${tags ? '标签' : '分类'}索引">${groups.length ? `<div class="${tags ? 'tag-index' : 'category-index'}">${groups.map((group, index) => `<a class="taxonomy-link" href="${localUrl(config, `${type}/${group.slug}/index.html`)}"><span class="taxonomy-number">${tags ? '#' : number(index + 1)}</span><h2>${e(group.name)}</h2><span class="taxonomy-count">${number(group.posts.length)}<span> 篇</span></span>${icon('diagonal')}</a>`).join('')}</div>` : emptyState(config, { kind: type })}</section>`;
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
  return `${pageHeader({ eyebrow: 'A RECORD OF TIME', title: '时间归档', description: '文字留在这里，时间继续向前。', count: posts.length })}${filterNav(config, 'archive')}<div class="archive-layout">${posts.length ? [...years].map(([year, months]) => `<section class="archive-year"><header><h2>${e(year)}<span>.</span></h2><p>${[...months.values()].reduce((count, month) => count + month.length, 0)} 篇记录</p></header><div class="archive-months">${[...months].map(([month, items]) => `<section class="archive-month"><h3>${e(month)} 月</h3><ul>${items.map((post) => `<li><time datetime="${e(post.date)}">${dateParts(post.date, config).month}.${dateParts(post.date, config).day}</time><a href="${localUrl(config, `posts/${post.id}.html`)}">${e(post.title)}${icon('diagonal')}</a></li>`).join('')}</ul></section>`).join('')}</div></section>`).join('') : emptyState(config, { kind: 'archive' })}</div>`;
}

function about(config) {
  return `${pageHeader({ eyebrow: 'BEHIND THE WORDS', title: '文字背后', description: '一个人，一些想法，一处自己的小天地。' })}<div class="about-layout"><aside class="about-identity"><img src="${localUrl(config, 'img/Avatar.png')}" alt="${e(config.site.author)} 的头像" width="112" height="112"><h2>${e(config.site.author)}</h2><p class="eyebrow">AUTHOR / EXPLORER</p><p>${e(config.sidebar?.motto || '保持专注，保持思考。')}</p><a class="text-link" href="${localUrl(config, 'feed.xml')}">订阅我的更新 ${icon('diagonal')}</a></aside><div class="about-sections">${(config.about?.sections || []).map((section, index) => `<section class="about-section"><p class="eyebrow">${number(index + 1)} / ${e(section.head)}</p><h2>${e(section.head)}</h2><div class="about-copy">${configMarkup(section.text)}</div></section>`).join('')}<section class="about-section friend-section"><p class="eyebrow">ELSEWHERE ON THE INTERNET</p><h2>远方的朋友</h2><p class="friend-intro">在互联网的另一端，也有人认真记录生活。</p>${(config.about?.friendLinks || []).length ? `<div class="friend-links">${config.about.friendLinks.map((friend) => `<a href="${e(safeHref(friend.url))}" target="_blank" rel="noopener noreferrer"><span>${e(friend.name)}</span>${icon('diagonal')}</a>`).join('')}</div>` : '<p class="muted">期待与更多有趣的文字相遇。</p>'}</section></div></div>`;
}

function postPage(config, post, posts) {
  const index = posts.indexOf(post);
  const newer = posts[index - 1];
  const older = posts[index + 1];
  const toc = post.toc || [];
  return `<nav class="article-breadcrumb" aria-label="当前位置"><a href="${localUrl(config, 'articles/index.html')}">全部文章</a><span>/</span>${post.category ? `<a href="${localUrl(config, `categories/${post.categorySlug || post.category}/index.html`)}">${e(post.category)}</a>` : '<span>阅读</span>'}</nav><div class="article-layout"><article class="article"><header class="article-header"><p class="eyebrow">NOTES & THOUGHTS</p><h1>${e(post.title)}</h1>${post.excerpt ? `<p class="article-lead">${e(post.excerpt)}</p>` : ''}<div class="article-byline"><img src="${localUrl(config, 'img/Avatar.png')}" alt="" width="36" height="36"><span>${e(post.author || config.site.author)}</span><span class="meta-separator">/</span><time datetime="${e(post.date)}">${dateParts(post.date, config).full}</time><span class="meta-separator">/</span><span>${post.readingMinutes || 1} 分钟阅读</span></div></header><div class="article-prose" data-post-body>${post.html || ''}</div><footer class="article-end"><div class="article-end-mark" aria-hidden="true">— END —</div>${(post.labels || []).length ? `<div class="post-tags">${post.labels.map((label, i) => `<a href="${localUrl(config, `tags/${post.labelSlugs?.[i] || label}/index.html`)}"># ${e(label)}</a>`).join('')}</div>` : ''}${post.updated && post.updated.slice(0, 10) !== post.date.slice(0, 10) ? `<p class="article-updated">最后更新于 <time datetime="${e(post.updated)}">${dateParts(post.updated, config).full}</time></p>` : ''}${post.discussionUrl ? `<a class="text-link" href="${e(safeHref(post.discussionUrl))}" target="_blank" rel="noopener noreferrer">在 GitHub 上继续讨论 ${icon('diagonal')}</a>` : ''}</footer><nav class="post-navigation" aria-label="相邻文章">${newer ? `<a href="${localUrl(config, `posts/${newer.id}.html`)}"><span class="eyebrow">← 较新的文章</span><span>${e(newer.title)}</span></a>` : '<span></span>'}${older ? `<a class="next-post" href="${localUrl(config, `posts/${older.id}.html`)}"><span class="eyebrow">较早的文章 →</span><span>${e(older.title)}</span></a>` : '<span></span>'}</nav></article><aside class="article-aside"><details class="table-of-contents" data-toc open><summary><span>本文目录</span>${icon('chevron')}</summary>${toc.length ? `<nav aria-label="文章目录"><ol>${toc.map((item) => `<li class="toc-depth-${Math.min(6, Math.max(1, item.depth))}"><a href="#${e(encodeURIComponent(item.id))}">${e(item.text)}</a></li>`).join('')}</ol></nav>` : '<p class="toc-empty">沿着文字，慢慢阅读。</p>'}</details><p class="article-margin-note">保持专注，<br>保持思考。</p></aside></div>`;
}

function notFound(config) {
  return `<section class="not-found"><p class="eyebrow"><span class="accent-dot"></span>A SMALL DETOUR</p><div class="not-found-number" aria-hidden="true">404<span>.</span></div><h1>这一页，走丢了。</h1><p>也许地址有误，也许这段文字已搬往别处。<br>不妨回到起点，继续寻找。</p><a class="solid-link" href="${localUrl(config)}">回到首页 ${icon('arrow')}</a></section>`;
}

export function renderSite({ config, posts }) {
  const pageSize = Number(config.build?.maxArticlesPerPage ?? config.build?.pageSize ?? 20);
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
  const addListings = ({ title, eyebrow, description, prefix, active, items }) => {
    const total = Math.max(1, Math.ceil(items.length / config.build.maxArticlesPerPage));
    for (let page = 1; page <= total; page++) {
      const path = page === 1 ? `${prefix}/index.html` : `${prefix}/page/${page}/index.html`;
      add(path, {
        title: `${title}${page > 1 ? ` · 第 ${page} 页` : ''}`,
        description,
        active,
        body: listing(config, items, {
          title,
          eyebrow,
          description,
          prefix,
          active,
          page,
          pageSize: config.build.maxArticlesPerPage,
          allPosts: posts,
        }),
      });
    }
  };
  addListings({
    title: '所有文章',
    eyebrow: 'THE JOURNAL',
    description: '关于技术、生活，以及那些值得留下的思考。',
    prefix: 'articles',
    active: 'articles',
    items: posts,
  });
  for (const type of ['categories', 'tags']) {
    add(`${type}/index.html`, {
      title: type === 'tags' ? '关键词' : '内容分类',
      active: type,
      body: taxonomyIndex(config, posts, type),
    });
    for (const group of taxonomies(posts, type))
      addListings({
        title: group.name,
        eyebrow: type === 'tags' ? 'FILED UNDER / TAG' : 'FILED UNDER / CATEGORY',
        description: `关于「${group.name}」的 ${group.posts.length} 篇记录。`,
        prefix: `${type}/${group.slug}`,
        active: type,
        items: group.posts,
      });
  }
  add('archive/index.html', { title: '时间归档', active: 'archive', body: archive(config, posts) });
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
