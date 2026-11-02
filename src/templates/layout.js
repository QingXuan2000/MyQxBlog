/* 整页骨架控制器。数据准备就绪后交由 layouts/layout.html 渲染，
   各子区域（head、header、sidebar、footer 等）均为独立可定制的模板。 */
import { escapeHtml as e, absoluteUrl, localUrl, jsonLd, configMarkup } from './helpers.js';
import { renderFile } from './engine.js';

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

const defaultNavLinks = [
  { text: '首页', href: 'index.html' },
  { text: '文章', href: 'articles/index.html' },
  { text: '分类', href: 'categories/index.html' },
  { text: '标签', href: 'tags/index.html' },
  { text: '归档', href: 'archive/index.html' },
  { text: '关于', href: 'about/index.html' },
];

function splitLabel(html) {
  const match = /^\s*(<svg[\s\S]*?<\/svg>)\s*([\s\S]*)$/i.exec(String(html ?? ''));
  return match ? { icon: match[1], label: match[2] } : { icon: '', label: html };
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

  const footerItems = config.footerContent?.length
    ? config.footerContent
    : [`Copyright © ${config.site.author}. All rights reserved.`];
  const footerItemsHTML = footerItems
    .map((item) => `<p class="qx-footer-item">${configMarkup(item)}</p>`)
    .join('');

  const railTextFwd = railText(44);
  const railTextRev = railText(44);

  return renderFile('layouts/layout.html', {
    config,
    site: config.site,
    path,
    title,
    pageTitle,
    summary,
    canonical,
    active,
    type,
    post,
    body,
    avatarUrl: localUrl(config, 'img/Avatar.png'),
    avatarGeo: SIDEBAR_AVATAR_GEO,
    navLinks,
    sidebarLinksHTML,
    navMenuHTML,
    footerItems,
    footerItemsHTML,
    jsonLdMarkup: jsonLd(structured),
    railFwd: `${railTextFwd} ${railTextFwd}`,
    railRev: `${railTextRev} ${railTextRev}`,
  });
}
