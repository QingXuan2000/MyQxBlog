import { escapeHtml as e, absoluteUrl, localUrl, jsonLd, configMarkup, icon } from './helpers.js';

const navigation = [
  ['articles', '文章'],
  ['categories', '分类'],
  ['tags', '标签'],
  ['archive', '归档'],
  ['about', '关于'],
];

const brandMark = `<svg class="wordmark-logo" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false"><rect x="10" y="18" width="30" height="30" fill="currentColor"/><rect class="brand-node" x="24" y="12" width="30" height="30" fill="none" stroke-width="5"/></svg>`;

function searchDialog() {
  return `<dialog class="search-dialog" data-search-dialog aria-labelledby="search-title"><div class="search-dialog-heading"><h2 id="search-title">寻找一段思考</h2><button class="icon-button" type="button" data-search-close aria-label="关闭搜索">${icon('close')}</button></div><div class="search-field">${icon('search')}<label class="sr-only" for="site-search">搜索文章</label><input id="site-search" data-search-input type="search" placeholder="搜索文章、关键词…" autocomplete="off" spellcheck="false" aria-controls="search-results" aria-describedby="search-status"></div><p id="search-status" class="search-status" data-search-status aria-live="polite">输入关键词，寻找感兴趣的文章。</p><div id="search-results" class="search-results" data-search-results></div><div class="search-help"><span><kbd>↑</kbd><kbd>↓</kbd> 选择</span><span><kbd>Enter</kbd> 阅读</span><span><kbd>Esc</kbd> 关闭</span></div></dialog>`;
}

export function layout({ config, path, title, description, body, active = '', type = '', post }) {
  const pageTitle = title
    ? `${title} · ${config.site.title || config.site.name}`
    : `${config.site.title || config.site.name} · 保持专注，保持思考`;
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
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="qx-base" content="${e(config.basePath || '/')}">
<title>${e(pageTitle)}</title>
<meta name="description" content="${e(summary)}">
<meta name="author" content="${e(post?.author || config.site.author)}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#f8f8f2" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#171914" media="(prefers-color-scheme: dark)">
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
<link rel="preload" href="${localUrl(config, 'fonts/Inter/InterVariable.woff2')}" as="font" type="font/woff2" crossorigin>
<script>document.documentElement.classList.add('js');try{const t=localStorage.getItem('qx-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;else document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch{}</script>
<link rel="stylesheet" href="${localUrl(config, 'assets/styles/main.css')}">
${post ? `<link rel="stylesheet" href="${localUrl(config, 'assets/katex/katex.min.css')}">` : ''}
<script type="application/ld+json">${jsonLd(structured)}</script>
<script type="module" src="${localUrl(config, 'assets/client/main.js')}"></script>
</head>
<body class="page-${e(type || active || 'home')}">
<a class="skip-link" href="#main-content">跳转到主要内容</a>
${post ? '<div class="reading-progress" data-reading-progress role="progressbar" aria-label="阅读进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></div>' : ''}
<header class="site-header"><div class="site-header-inner"><a class="wordmark" href="${localUrl(config)}" aria-label="${e(config.site.name)} 首页">${brandMark}<span class="wordmark-text">${e(config.site.name)}</span><span class="wordmark-dot">.</span></a><nav class="site-nav" id="site-nav" data-site-nav aria-label="主导航">${navigation.map(([route, label]) => `<a href="${localUrl(config, `${route}/index.html`)}"${active === route ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav><div class="header-actions"><button class="search-open" type="button" data-search-open aria-label="搜索文章" aria-haspopup="dialog">${icon('search')}<span>搜索</span><kbd>⌘ K</kbd></button><span class="header-action-divider"></span><button class="icon-button theme-toggle" type="button" data-theme-toggle aria-label="切换深浅主题">${icon('sun', 'theme-sun')}${icon('moon', 'theme-moon')}</button><button class="icon-button menu-toggle" type="button" data-menu-toggle aria-controls="site-nav" aria-expanded="false" aria-label="打开导航菜单">${icon('menu')}</button></div></div></header>
<main id="main-content" class="site-main" tabindex="-1">${body}</main>
<footer class="site-footer"><div class="footer-top"><a class="wordmark footer-wordmark" href="${localUrl(config)}">${brandMark}<span class="wordmark-text">${e(config.site.name)}</span><span class="wordmark-dot">.</span></a><p>保持专注，保持思考。</p><a href="${localUrl(config, 'feed.xml')}" class="footer-rss">RSS ${icon('diagonal')}</a></div><div class="footer-bottom"><div>${(config.footerContent?.length ? config.footerContent : [`© ${new Date().getUTCFullYear()} ${config.site.author}`]).map((line) => `<p>${configMarkup(line)}</p>`).join('')}</div><p class="footer-signoff">一个人的数字花园 <span aria-hidden="true">↗</span></p></div></footer>
${searchDialog()}
${post ? `<button class="back-top icon-button" type="button" data-back-top aria-label="回到顶部" hidden>${icon('up')}</button>` : ''}
</body></html>`;
}
