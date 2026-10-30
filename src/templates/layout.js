/* 整页骨架。head 里的 meta、canonical、结构化数据和主题预置脚本都在这里，
   页面正文由 site.js 拼好传进来。

   导航只有一份数据源，config.sidebar.links。桌面的顶栏导航、侧边栏抽屉、当前页高亮
   全部从它派生，加一个菜单项只用改配置。配置为空时退回内置的六项。

   主题在 head 里用一段内联脚本先定下来，脚本本身在 body 末尾加载。这一步不能省，
   否则浅色页面会先闪一帧白底再变深色。 */
import { escapeHtml as e, absoluteUrl, localUrl, jsonLd, configMarkup } from './helpers.js';

const SIDEBAR_AVATAR_GEO = `<polygon class="qx-sidebar-avatar-outer" points="570,310 440,535 180,535 50,310 180,85 440,85"/>
<polygon class="qx-sidebar-avatar-inner" points="440,385 310,460 180,385 180,235 310,160 440,235"/>
<circle cx="570" cy="310" r="4" class="qx-sidebar-avatar-dot"/>
<circle cx="440" cy="535" r="4" class="qx-sidebar-avatar-dot"/>
<circle cx="180" cy="535" r="4" class="qx-sidebar-avatar-dot"/>
<circle cx="50" cy="310" r="4" class="qx-sidebar-avatar-dot"/>
<circle cx="180" cy="85" r="4" class="qx-sidebar-avatar-dot"/>
<circle cx="440" cy="85" r="4" class="qx-sidebar-avatar-dot"/>
<circle cx="440" cy="385" r="2.5" class="qx-sidebar-avatar-idot"/>
<circle cx="310" cy="460" r="2.5" class="qx-sidebar-avatar-idot"/>
<circle cx="180" cy="385" r="2.5" class="qx-sidebar-avatar-idot"/>
<circle cx="180" cy="235" r="2.5" class="qx-sidebar-avatar-idot"/>
<circle cx="310" cy="160" r="2.5" class="qx-sidebar-avatar-idot"/>
<circle cx="440" cy="235" r="2.5" class="qx-sidebar-avatar-idot"/>`;

/* 二进制跑马灯，六位一组，偶尔插一段斜杠。字符集和转场幕布、首页分隔条是同一套。 */
function railText(groups) {
  const chunks = [];
  for (let i = 0; i < groups; i += 1) {
    if (Math.random() < 0.22) {
      chunks.push('/'.repeat(8));
      continue;
    }
    let bits = '';
    for (let b = 0; b < 6; b += 1) bits += Math.random() < 0.5 ? '0' : '1';
    chunks.push(bits);
  }
  return chunks.join(' ');
}

function bootRail(className, seconds) {
  // 内容是同一段文本重复两次，配合 translate3d(-50%) 才接得上，循环处不会露出断口。
  const text = railText(44);
  return `<span class="qx-transition__rail ${className}"><span style="animation-duration:${seconds}s">${text} ${text}</span></span>`;
}

/* 首屏这块幕布由服务端直接渲染成盖住的状态，脚本接管之后向上抽走，
   和站内跳转用的是同一个动作。 */
function bootCurtain() {
  return `<div class="qx-transition is-boot" aria-hidden="true">
        ${bootRail('qx-transition__rail--fwd', 9)}
        <span class="qx-transition__meta"><span class="qx-transition__count">000</span><span class="qx-transition__label"></span><span class="qx-transition__bar"><i></i></span></span>
        ${bootRail('qx-transition__rail--rev', 12)}
    </div>`;
}

const defaultNavLinks = [
  { text: '首页', href: 'index.html' },
  { text: '文章', href: 'articles/index.html' },
  { text: '分类', href: 'categories/index.html' },
  { text: '标签', href: 'tags/index.html' },
  { text: '归档', href: 'archive/index.html' },
  { text: '关于', href: 'about/index.html' },
];

/* 侧栏链接的 SVG 前导图标不渲染，剥离后只传文字给 .qx-ul，下划线仅落文字。 */
function splitLabel(html) {
  const match = /^\s*(<svg[\s\S]*?<\/svg>)\s*([\s\S]*)$/i.exec(String(html ?? ''));
  return match ? { icon: match[1], label: match[2] } : { icon: '', label: html };
}

function searchDialog() {
  return `<dialog class="qx-search" data-search-dialog aria-labelledby="search-title">
  <div class="qx-search__inner">
    <div class="qx-search__bar">
      <span class="qx-search__tag">SEARCH</span>
      <span class="qx-search__rule" aria-hidden="true"></span>
      <span class="qx-search__hint">ctrl / ⌘ + K</span>
      <button class="qx-search__close" type="button" data-search-close data-cursor="ESC" aria-label="关闭搜索" title="关闭搜索（Esc）">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><line x1="5" y1="5" x2="19" y2="19"></line><line x1="19" y1="5" x2="5" y2="19"></line></svg>
      </button>
    </div>
    <div class="qx-search__form">
      <span class="qx-search__prompt" aria-hidden="true">▸</span>
      <label class="sr-only" for="site-search">搜索文章</label>
      <input id="site-search" data-search-input class="qx-search__input" type="search" placeholder="输入关键词…" autocomplete="off" spellcheck="false" aria-controls="search-results" aria-describedby="search-status">
    </div>
    <div class="qx-search__meta">
      <p id="search-status" class="qx-search__status" data-search-status aria-live="polite">输入关键词，寻找感兴趣的文章。</p>
      <span class="qx-search__count" data-search-count aria-hidden="true"></span>
    </div>
    <div id="search-results" class="qx-search__list" data-search-results></div>
    <div class="qx-search__foot">
      <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
      <span><kbd>↵</kbd> 阅读</span>
      <span><kbd>esc</kbd> 关闭</span>
    </div>
  </div>
</dialog>`;
}

export function layout({ config, path, title, description, body, active = '', type = '', post }) {
  const pageTitle = title
    ? `${title} · ${config.site.title || config.site.name}`
    : `${config.site.title || config.site.name} - 首页`;
  const summary =
    description || config.site.description || '保持专注，保持思考。记录沿途的所见和所闻。';
  const canonical = absoluteUrl(config, path);
  const structured = post
    ? {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: summary,
        datePublished: post.date,
        dateModified: post.updated || post.date,
        inLanguage: 'zh-CN',
        author: { '@type': 'Person', name: post.author || config.site.author },
        publisher: { '@type': 'Person', name: config.site.author },
        mainEntityOfPage: canonical,
        url: canonical,
        keywords: (post.labels || []).join(', '),
        articleSection: post.category || undefined,
      }
    : {
        '@context': 'https://schema.org',
        '@type': path === 'index.html' ? 'Blog' : 'WebPage',
        name: pageTitle,
        description: summary,
        url: canonical,
        inLanguage: 'zh-CN',
        author: { '@type': 'Person', name: config.site.author },
      };

  const navLinks = config.sidebar?.links?.length ? config.sidebar.links : defaultNavLinks;
  const sidebarLinksHTML = navLinks
    .map((l) => {
      const { label } = splitLabel(l.text);
      return `<a href="${localUrl(config, l.href)}" class="qx-sidebar-link"><span class="qx-ul">${label}</span></a>`;
    })
    .join('');

  /* 桌面导航和侧边栏读同一份 links，窄屏时整块收进抽屉。
   高亮靠路径前缀判断，进到文章页仍然算在「文章」这一栏下面。 */
  const currentPath = String(path || 'index.html').replace(/^\/+/, '');
  const navMenuHTML = navLinks
    .map((l) => {
      const { label } = splitLabel(l.text);
      const target = String(l.href || '').replace(/^\/+/, '');
      const on =
        target === 'index.html'
          ? currentPath === '' || currentPath === 'index.html'
          : currentPath === target || currentPath.startsWith(target.replace(/index\.html$/, ''));
      return `<a href="${localUrl(config, l.href)}" class="qx-nav-item${on ? ' is-active' : ''}"${on ? ' aria-current="page"' : ''}><span class="qx-ul">${label}</span></a>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="qx-base" content="${e(config.basePath || '/')}">
<title>${e(pageTitle)}</title>
<meta name="description" content="${e(summary)}">
<meta name="author" content="${e(post?.author || config.site.author)}">
<meta name="color-scheme" content="light dark">
${path === '404.html' ? '<meta name="robots" content="noindex">' : ''}
<link rel="canonical" href="${e(canonical)}">
<meta property="og:type" content="${post ? 'article' : 'website'}">
<meta property="og:locale" content="zh_CN">
<meta property="og:site_name" content="${e(config.site.name)}">
<meta property="og:title" content="${e(title || config.site.title || config.site.name)}">
<meta property="og:description" content="${e(summary)}">
<meta property="og:url" content="${e(canonical)}">
<meta property="og:image" content="${e(absoluteUrl(config, 'img/Avatar.png'))}">
${post ? `<meta property="article:published_time" content="${e(post.date)}"><meta property="article:modified_time" content="${e(post.updated || post.date)}">` : ''}
<meta name="twitter:card" content="summary">
<link rel="icon" type="image/svg+xml" href="${localUrl(config, 'favicon.svg')}">
<link rel="alternate" type="application/rss+xml" title="${e(config.site.name)} RSS" href="${localUrl(config, 'feed.xml')}">
<link rel="stylesheet" href="${localUrl(config, 'assets/styles/default.css')}">
${post ? `<link rel="stylesheet" href="${localUrl(config, 'assets/katex/katex.min.css')}">` : ''}
<script>
    (function () {
        var t = localStorage.getItem('qx-theme');
        if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', t);
    })();
</script>
<script type="application/ld+json">${jsonLd(structured)}</script>
<script type="module" src="${localUrl(config, 'assets/client/main.js')}"></script>
</head>
<body class="page-${e(type || active || 'home')}">
    ${bootCurtain()}

    <!-- Header Navigation -->
    <header class="qx-header">
        <nav class="qx-nav">
            <a href="${localUrl(config, 'index.html')}" class="qx-nav-logo">
                <img class="qx-nav-logo-img qx-nav-logo-light" src="${localUrl(config, 'img/logo/light.svg')}" alt="Logo">
                <img class="qx-nav-logo-img qx-nav-logo-dark" src="${localUrl(config, 'img/logo/dark.svg')}" alt="Logo">
            </a>
            <span class="qx-nav-brand">${e(config.site.name)}</span>
            <nav class="qx-nav-menu" aria-label="主导航">
                ${navMenuHTML}
            </nav>
            <div class="qx-nav-actions">
                <button class="qx-nav-btn js-search-toggle" type="button" data-cursor="SEARCH" data-search-open title="搜索" aria-label="搜索">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </button>
                <button class="qx-nav-btn js-theme-toggle" type="button" data-cursor="THEME" data-theme-toggle title="切换主题" aria-label="切换主题">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                </button>
                ${
                  post
                    ? `<button class="qx-nav-btn js-toc-toggle" type="button" data-cursor="TOC" data-toc-toggle title="文章目录" aria-label="文章目录" aria-expanded="false" aria-controls="post-toc" ${post.toc?.length ? '' : 'style="display:none;"'}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                </button>`
                    : ''
                }
                <button class="qx-nav-btn js-sidebar-toggle" type="button" data-cursor="MENU" data-menu-toggle title="侧边栏" aria-label="打开侧边栏" aria-expanded="false">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                </button>
            </div>
        </nav>
    </header>

    <!-- Sidebar -->
    <aside class="qx-sidebar" data-sidebar aria-label="侧边栏">
        <div class="qx-sidebar-inner">
            <div class="qx-sidebar-avatar">
                <svg class="qx-sidebar-avatar-geo" viewBox="0 0 620 620" fill="none" xmlns="http://www.w3.org/2000/svg">
                    ${SIDEBAR_AVATAR_GEO}
                </svg>
                <img class="qx-sidebar-avatar-img" src="${localUrl(config, 'img/Avatar.png')}" alt="头像">
            </div>
            <p class="qx-sidebar-name">${e(config.site.author)}</p>
            <p class="qx-sidebar-motto">${e(config.sidebar?.motto || '')}</p>
            <nav class="qx-sidebar-nav" data-site-nav aria-label="主导航">
                ${sidebarLinksHTML}
            </nav>
        </div>
    </aside>

    ${
      post && post.toc?.length
        ? `
    <!-- TOC Sidebar -->
    <aside class="qx-toc-sidebar" id="post-toc" data-toc aria-label="文章目录">
        <div class="qx-toc-inner">
            <h3 class="qx-toc-head">目录</h3>
            <nav class="qx-toc-nav">
                ${post.toc.map((item) => `<a href="#${e(item.id)}" class="qx-toc-link ${item.depth === 3 ? 'qx-toc-indent-2' : 'qx-toc-indent-1'}"><span class="qx-ul">${e(item.text)}</span></a>`).join('')}
            </nav>
        </div>
    </aside>`
        : ''
    }

    ${post ? '<div class="reading-progress" data-reading-progress role="progressbar" aria-label="阅读进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></div>' : ''}

    <!-- Main Content -->
    <main id="main-content" class="qx-main" tabindex="-1">
        ${body}
    </main>

    <!-- Footer -->
    <footer class="qx-footer">
        ${(config.footerContent?.length ? config.footerContent : [`Copyright © ${config.site.author}. All rights reserved.`]).map((item) => `<p class="qx-footer-item">${configMarkup(item)}</p>`).join('')}
    </footer>

    <!-- Back to Top -->
    <button class="qx-btt" data-cursor="TOP" data-back-top title="回到顶部" aria-label="回到顶部">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
    </button>

    ${searchDialog()}
</body>
</html>`;
}
