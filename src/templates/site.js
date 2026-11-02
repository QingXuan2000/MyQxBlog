/* 各页面的路由与数据编排。renderSite 是路由表，从这里能一眼看到站点会产出哪些地址。
   页面正文通过 renderFile 渲染独立的 HTML 模板，保持视图与逻辑解耦。 */
import {
  escapeHtml as e,
  localUrl,
  dateParts,
  taxonomies,
  safeHref,
  configMarkup,
  absoluteUrl,
} from './helpers.js';
import { renderFile } from './engine.js';
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

const titleAdvance = (text) =>
  [...text].reduce((sum, ch) => sum + (ch.codePointAt(0) > 0x2e80 ? 1 : 0.6), 0);

function home(config, posts) {
  const heroTitle = (config.site?.welcome || 'WELCOME TO QXBLOG')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

  const units = Math.max(titleAdvance(heroTitle), 1);
  const heroFit = `--hero-fit: calc((100vw - 2 * var(--title-inset) - 8px) / ${units.toFixed(2)})`;

  const articlesGridHTML = posts.length
    ? posts
        .slice(0, Math.min(config.build.maxArticlesPerPage, 10))
        .map((post) => articleRow(post, config))
        .join('')
    : emptyState(config, { kind: 'articles' });

  const paginationHTML = pagination(
    config,
    'articles',
    1,
    Math.ceil(posts.length / config.build.maxArticlesPerPage),
  );

  return renderFile('pages/home.html', {
    heroTitle,
    heroFit,
    separator1: renderSeparator(['Qx', 'Blog', 'Ke', 'ep', 'Fo', 'cu', 's']),
    separator2: renderSeparator(['Do', 'Things', 'Your', 'Way']),
    articlesGridHTML,
    paginationHTML,
  });
}

function listing(config, posts, { title, tag, sub, prefix, page, pageSize, backUrl }) {
  const offset = (page - 1) * pageSize;
  const pagePosts = posts.slice(offset, offset + pageSize);

  const pageHeroHTML = pageHero({
    tag: tag || '<Articles />',
    title,
    sub: sub || `共 ${posts.length} 篇文章。`,
    backUrl,
  });

  const articlesGridHTML = pagePosts.length
    ? pagePosts.map((post) => articleRow(post, config)).join('')
    : emptyState(config, { kind: 'articles' });

  const paginationHTML = pagination(config, prefix, page, Math.ceil(posts.length / pageSize));

  return renderFile('pages/listing.html', {
    pageHeroHTML,
    articlesGridHTML,
    paginationHTML,
  });
}

function taxonomyIndex(config, posts, type) {
  const isTags = type === 'tags';
  const groups = taxonomies(posts, type).map((g) => ({
    name: g.name,
    slug: g.slug,
    count: g.posts.length,
    url: localUrl(config, `${type}/${g.slug}/index.html`),
  }));

  const pageHeroHTML = pageHero({
    tag: isTags ? '<Tags />' : '<Categories />',
    title: isTags ? '标签' : '分类',
    sub: isTags ? `共 ${groups.length} 个标签。` : '按分类浏览文章。',
  });

  return renderFile('pages/taxonomy-index.html', {
    pageHeroHTML,
    listClass: isTags ? 'qx-tags-list' : 'qx-categories-list',
    isTags,
    groups,
    emptyStateHTML: emptyState(config, { kind: type }),
  });
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

  const sections = sortedYears.map(([year, monthsMap]) => {
    const sortedMonths = [...monthsMap.entries()].sort(([a], [b]) => b.localeCompare(a));
    const yearCount = [...monthsMap.values()].reduce((sum, m) => sum + m.length, 0);
    const months = sortedMonths.map(([month, items]) => ({
      month,
      posts: items.map((p) => {
        const date = dateParts(p.date, config);
        const categoryHTML = p.category
          ? `<a href="${localUrl(config, `categories/${p.categorySlug || p.category}/index.html`)}" class="qx-article-card-label qx-category-label">${e(p.category)}</a>`
          : '';
        return {
          date: p.date,
          dateDisplay: `${date.month}.${date.day}`,
          title: p.title,
          url: localUrl(config, `posts/${p.id}.html`),
          categoryHTML,
        };
      }),
    }));
    return {
      year,
      total: yearCount,
      months,
    };
  });

  const pageHeroHTML = pageHero({
    tag: '<Archive />',
    title: '归档',
    sub: `全站共 ${posts.length} 篇文章。`,
  });

  return renderFile('pages/archive.html', {
    pageHeroHTML,
    sections,
    emptyStateHTML: emptyState(config, { kind: 'archive' }),
  });
}

function about(config) {
  const sections = (config.about?.sections || []).map((s) => ({
    head: s.head,
    text: configMarkup(s.text),
  }));
  const friendLinks = (config.about?.friendLinks || []).map((f) => ({
    name: f.name,
    url: safeHref(f.url),
  }));

  const pageHeroHTML = pageHero({
    tag: '<About />',
    title: '关于',
    sub: '关于我和这个博客。',
  });

  return renderFile('pages/about.html', {
    pageHeroHTML,
    sections,
    friendLinks,
  });
}

function postPage(config, post, posts) {
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
  const index = posts.findIndex((p) => p.id === post.id);
  const newerPost = index > 0 ? posts[index - 1] : null;
  const olderPost = index >= 0 && index < posts.length - 1 ? posts[index + 1] : null;

  const newer = newerPost
    ? {
        id: newerPost.id,
        title: newerPost.title,
        url: localUrl(config, `posts/${newerPost.id}.html`),
      }
    : null;

  const older = olderPost
    ? {
        id: olderPost.id,
        title: olderPost.title,
        url: localUrl(config, `posts/${olderPost.id}.html`),
      }
    : null;

  const giscusConfig = config.comment?.giscus || {};
  const globalCommentEnabled = Boolean(config.comment?.enable ?? true);
  const commentEnabled = globalCommentEnabled && post.comment !== false;

  let mapping = giscusConfig.mapping || 'number';
  let term = '';
  if (mapping === 'number') {
    const discNum = post.sourceDiscussionNumber ?? post.discussionNumber;
    if (discNum !== undefined && discNum !== null) {
      term = String(discNum);
    } else {
      mapping = 'pathname';
    }
  } else if (mapping === 'title') {
    term = post.title;
  } else if (mapping === 'specific') {
    term = post.title || String(post.id);
  }

  const resolveThemeUrl = (val, defaultRelative) => {
    if (!val) val = defaultRelative;
    if (val.startsWith('http://') || val.startsWith('https://')) return val;
    if (val.endsWith('.css') || val.startsWith('/') || val.startsWith('./')) {
      return absoluteUrl(config, val);
    }
    return val;
  };

  const themeConfig = giscusConfig.theme || {};
  const giscusThemeLight = typeof giscusConfig.theme === 'string'
    ? giscusConfig.theme
    : resolveThemeUrl(themeConfig.light, 'assets/styles/giscus-light.css');
  const giscusThemeDark = typeof giscusConfig.theme === 'string'
    ? giscusConfig.theme
    : resolveThemeUrl(themeConfig.dark, 'assets/styles/giscus-dark.css');

  return renderFile('pages/post.html', {
    config,
    post,
    backUrl: 'javascript:history.back()',
    date,
    updatedDate: dateParts(post.updated || post.date, config),
    categoryHTML,
    labelsHTML,
    newer,
    older,
    commentEnabled,
    giscusConfig,
    mapping,
    term,
    giscusThemeLight,
    giscusThemeDark,
  });
}

function notFound(config) {
  return renderFile('pages/404.html', {
    homeUrl: localUrl(config, 'index.html'),
  });
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
