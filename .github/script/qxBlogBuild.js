import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { Command } from 'commander';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..', '..');
const OUTPUT_DIR = ROOT;
const CONFIG_DIR = path.join(ROOT, 'config');
const BLOG_DATA_DIR = path.join(ROOT, 'blogData');
const POSTS_DIR = path.join(ROOT, 'posts');
const MARKDOWN_DIR = path.join(BLOG_DATA_DIR, 'markdown');

const SITE_CONFIG_PATH = path.join(CONFIG_DIR, 'siteConfig.json');
const BUILD_CONFIG_PATH = path.join(CONFIG_DIR, 'buildConfig.json');
const CATEGORIES_JSON_PATH = path.join(BLOG_DATA_DIR, 'categories.json');
const ARTICLES_JSON_PATH = path.join(BLOG_DATA_DIR, 'articles.json');

const SITE_NAME = 'QxBlog';
const MAX_ARTICLES_PER_PAGE = 10;

// 日志级别颜色配置
const LOG_COLORS = {
    DEBUG: '\x1b[36m',  // 青色
    INFO: '\x1b[32m',   // 绿色
    SUCCESS: '\x1b[32m',// 绿色
    WARN: '\x1b[33m',   // 黄色
    WARNING: '\x1b[33m',// 黄色
    ERROR: '\x1b[31m',  // 红色
    RESET: '\x1b[0m',   // 重置
    BOLD: '\x1b[1m',    // 加粗
    DIM: '\x1b[2m',     // 暗淡
};

// 日志图标配置（使用英文单词）
const LOG_ICONS = {
    DEBUG: '[DEBUG]',
    INFO: '[INFO]',
    SUCCESS: '[ OK ]',
    WARN: '[WARN]',
    WARNING: '[ WARN]',
    ERROR: '[FAIL]',
    INIT: '[ INIT]',
    CONFIG: '[CONF]',
    LOAD: '[LOAD]',
    SAVE: '[SAVE]',
    PARSE: '[PARSE]',
    RENDER: '[REND]',
    GENERATE: '[HTML]',
    DELETE: '[DEL]',
    UPDATE: '[UPDT]',
    DIR: '[DIR ]',
    START: '[RUN ]',
    COMPLETE: '[DONE]',
    CANCEL: '[STOP]',
    GITHUB: '[ GH ]',
    CI: '[ CI ]',
};

// 获取当前时间字符串
function getTimestamp() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
}

// 格式化日志状态
function formatStatus(status) {
    const normalizedStatus = status.toUpperCase();
    const icon = LOG_ICONS[normalizedStatus] || LOG_ICONS.INFO;
    const color = LOG_COLORS[normalizedStatus] || LOG_COLORS.INFO;
    return { icon, color };
}

// 主日志函数
function log(status, message, data) {
    const { icon, color } = formatStatus(status);
    const timestamp = getTimestamp();
    
    // 格式化日志头部
    const logHeader = `${LOG_COLORS.DIM}[${timestamp}]${LOG_COLORS.RESET} ${color}${icon} ${LOG_COLORS.BOLD}${status.padEnd(8)}${LOG_COLORS.RESET} `;
    
    console.log(`${logHeader}${message}`);
    
    // 如果有数据，格式化输出
    if (data !== undefined) {
        const indent = ' '.repeat(28);
        const dataStr = typeof data === 'object' 
            ? JSON.stringify(data, null, 2)
                .split('\n')
                .map((line, idx) => idx === 0 ? indent + line : indent + '  ' + line)
                .join('\n')
            : `${indent}${data}`;
        console.log(`${LOG_COLORS.DIM}${dataStr}${LOG_COLORS.RESET}`);
    }
}

// 便捷日志方法
const logger = {
    debug: (msg, data) => log('DEBUG', msg, data),
    info: (msg, data) => log('INFO', msg, data),
    success: (msg, data) => log('SUCCESS', msg, data),
    warn: (msg, data) => log('WARN', msg, data),
    warning: (msg, data) => log('WARNING', msg, data),
    error: (msg, data) => log('ERROR', msg, data),
    init: (msg, data) => log('INIT', msg, data),
    config: (msg, data) => log('CONFIG', msg, data),
    load: (msg, data) => log('LOAD', msg, data),
    save: (msg, data) => log('SAVE', msg, data),
    parse: (msg, data) => log('PARSE', msg, data),
    render: (msg, data) => log('RENDER', msg, data),
    generate: (msg, data) => log('GENERATE', msg, data),
    delete: (msg, data) => log('DELETE', msg, data),
    update: (msg, data) => log('UPDATE', msg, data),
    dir: (msg, data) => log('DIR', msg, data),
    start: (msg, data) => log('START', msg, data),
    complete: (msg, data) => log('COMPLETE', msg, data),
    cancel: (msg, data) => log('CANCEL', msg, data),
    github: (msg, data) => log('GITHUB', msg, data),
    ci: (msg, data) => log('CI', msg, data),
};

const LOAD_ERR = (f) => `Failed to load \`${f}\`. Check if the file exists or is valid JSON.`;
const LOAD = (f) => {
    try { return JSON.parse(fs.readFileSync(f, 'utf-8')); }
    catch (e) { log('Error', LOAD_ERR(f), { error: e.message }); return null; }
};

log('Init', 'Loading configuration files...');
const siteCfg = LOAD(SITE_CONFIG_PATH) || {};
const buildCfg = LOAD(BUILD_CONFIG_PATH) || {};
const categoriesData = LOAD(CATEGORIES_JSON_PATH) || [];

if (!siteCfg.site) {
    log('Warning', 'siteConfig.json is empty or invalid, using defaults');
}
if (!buildCfg.author) {
    log('Warning', 'buildConfig.json is empty or invalid, using defaults');
}

const GITHUB_START_ID = Number(buildCfg.githubStartId ?? buildCfg.githubStartPageNumber ?? 1) || 1;
const ALLOWED_BUILD_AUTHOR = (buildCfg.author || '').trim();

function issueNumberToArticleId(issueNumber) {
    return issueNumber + (GITHUB_START_ID - 1);
}

function isBuildAuthorAllowed(authorLogin) {
    if (!ALLOWED_BUILD_AUTHOR) return true;
    if (!authorLogin) return true;
    return authorLogin.toLowerCase() === ALLOWED_BUILD_AUTHOR.toLowerCase();
}

log('Config', 'Configuration loaded', {
    siteName: siteCfg.site?.name || SITE_NAME,
    author: siteCfg.site?.author || buildCfg.author || 'Anonymous',
    maxArticlesPerPage: buildCfg.maxArticlesPerPage || MAX_ARTICLES_PER_PAGE,
    githubStartId: GITHUB_START_ID,
    allowedBuildAuthor: ALLOWED_BUILD_AUTHOR || '(not set)',
});

const MAX_PER_PAGE = buildCfg.maxArticlesPerPage || MAX_ARTICLES_PER_PAGE;

const SITE_URL = siteCfg.site?.url || 'https://example.com';
const SITE_DESCRIPTION = siteCfg.site?.description || '基于 Issues 驱动的静态博客，分享代码、设计与思考。';
const SITE_KEYWORDS = siteCfg.site?.keywords || '博客,技术,前端,代码,设计';
const SITE_AUTHOR = siteCfg.site?.author || 'Anonymous';
const SITE_CREATED_AT = siteCfg.site?.siteCreatedAt || new Date().toISOString();

const _tmpl = (t, d) => t.replace(/\$\{([^}]+)\}/g, (_, k) => d[k] ?? '');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function yamlEscapeDoubleQuoted(str) {
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}

function yamlUnescapeDoubleQuoted(str) {
    let out = '';
    for (let i = 0; i < str.length; i++) {
        if (str[i] === '\\' && i + 1 < str.length) {
            const next = str[++i];
            if (next === 'n') out += '\n';
            else if (next === 'r') out += '\r';
            else if (next === 't') out += '\t';
            else out += next;
        } else {
            out += str[i];
        }
    }
    return out;
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        log('Dir', `Created directory: ${dir}`);
    }
}

function loadJSON(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
    catch (_) { return null; }
}

function saveJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    log('JSON', `Saved JSON to ${file}`, { recordCount: Array.isArray(data) ? data.length : 1 });
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function genSlug(title) {
    return title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
}

async function confirm(message) {
    // 检查是否设置了 AUTO_CONFIRM 环境变量
    if (process.env.AUTO_CONFIRM) {
        console.log(`${message} (AUTO_CONFIRM: ${process.env.AUTO_CONFIRM})`);
        return process.env.AUTO_CONFIRM.toLowerCase() === 'y' || 
               process.env.AUTO_CONFIRM.toLowerCase() === 'yes' || 
               process.env.AUTO_CONFIRM === '1';
    }
    
    const readline = await import('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(`${message} (y/n): `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y');
        });
    });
}

function stripHtml(html) {
    return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function genMetaTags({ title, description, keywords, author, url, type = 'website', image, date, modifiedDate, tags = [] }) {
    const metaTags = [];
    
    metaTags.push(`<meta name="description" content="${esc(description || SITE_DESCRIPTION)}">`);
    metaTags.push(`<meta name="keywords" content="${esc(keywords || SITE_KEYWORDS)}">`);
    metaTags.push(`<meta name="author" content="${esc(author || SITE_AUTHOR)}">`);
    metaTags.push(`<meta name="robots" content="index, follow">`);
    metaTags.push(`<meta name="googlebot" content="index, follow">`);
    
    metaTags.push(`<meta property="og:title" content="${esc(title)}">`);
    metaTags.push(`<meta property="og:description" content="${esc(description || SITE_DESCRIPTION)}">`);
    metaTags.push(`<meta property="og:type" content="${type}">`);
    metaTags.push(`<meta property="og:url" content="${esc(url)}">`);
    metaTags.push(`<meta property="og:site_name" content="${esc(SITE_NAME)}">`);
    if (image) {
        metaTags.push(`<meta property="og:image" content="${esc(image)}">`);
    }
    
    metaTags.push(`<meta name="twitter:card" content="summary_large_image">`);
    metaTags.push(`<meta name="twitter:title" content="${esc(title)}">`);
    metaTags.push(`<meta name="twitter:description" content="${esc(description || SITE_DESCRIPTION)}">`);
    if (image) {
        metaTags.push(`<meta name="twitter:image" content="${esc(image)}">`);
    }
    
    if (date) {
        metaTags.push(`<meta property="article:published_time" content="${esc(new Date(date).toISOString())}">`);
    }
    if (modifiedDate) {
        metaTags.push(`<meta property="article:modified_time" content="${esc(new Date(modifiedDate).toISOString())}">`);
    }
    tags.forEach(tag => {
        metaTags.push(`<meta property="article:tag" content="${esc(tag)}">`);
    });
    
    metaTags.push(`<link rel="canonical" href="${esc(url)}">`);
    
    return metaTags.join('\n    ');
}

function genStructuredDataArticle(article, url) {
    const data = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: article.title,
        description: article.description || SITE_DESCRIPTION,
        url: url,
        datePublished: new Date(article.date).toISOString(),
        dateModified: new Date(article.date).toISOString(),
        author: {
            '@type': 'Person',
            name: article.author || SITE_AUTHOR
        },
        publisher: {
            '@type': 'Organization',
            name: SITE_NAME,
            logo: {
                '@type': 'ImageObject',
                url: `${SITE_URL}/favicon.svg`
            }
        },
        mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': url
        }
    };
    if (article.labels && article.labels.length > 0) {
        data.keywords = article.labels.join(', ');
    }
    return `<script type="application/ld+json">${JSON.stringify(data, null, 2)}</script>`;
}

function genStructuredDataWebsite() {
    const data = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        author: {
            '@type': 'Person',
            name: SITE_AUTHOR
        },
        potentialAction: {
            '@type': 'SearchAction',
            target: `${SITE_URL}/?search={search_term_string}`,
            'query-input': 'required name=search_term_string'
        }
    };
    return `<script type="application/ld+json">${JSON.stringify(data, null, 2)}</script>`;
}

function genStructuredDataBreadcrumb(items) {
    const data = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url
        }))
    };
    return `<script type="application/ld+json">${JSON.stringify(data, null, 2)}</script>`;
}

const SITE_NAME2 = siteCfg.site?.name || SITE_NAME;
const MAX_PER_PAGE2 = buildCfg.maxArticlesPerPage || MAX_ARTICLES_PER_PAGE;

const LOAD_ERR2 = (f) => `Failed to load \`${f}\`. Check if the file exists or is valid JSON.`;
const LOAD2 = (f) => {
    try { return JSON.parse(fs.readFileSync(f, 'utf-8')); }
    catch (e) { log('Error', LOAD_ERR2(f), { error: e.message }); return null; }
};

const siteCfg2 = LOAD2(SITE_CONFIG_PATH) || {};
const buildCfg2 = LOAD2(BUILD_CONFIG_PATH) || {};
const categoriesData2 = LOAD2(CATEGORIES_JSON_PATH) || [];
const MAX_PER_PAGE3 = buildCfg2.maxArticlesPerPage || MAX_ARTICLES_PER_PAGE;

const LOGO_SVG = `<polygon points="570,310 440,535 180,535 50,310 180,85 440,85" stroke="currentColor" stroke-width="18" stroke-linejoin="round"/>
<polygon points="440,385 310,460 180,385 180,235 310,160 440,235" stroke="currentColor" stroke-width="8" opacity="0.4" stroke-linejoin="round"/>
<circle cx="310" cy="310" r="10" fill="currentColor"/>
<circle cx="570" cy="310" r="6" fill="currentColor" opacity="0.5"/>
<circle cx="440" cy="535" r="6" fill="currentColor" opacity="0.5"/>
<circle cx="180" cy="535" r="6" fill="currentColor" opacity="0.5"/>
<circle cx="50" cy="310" r="6" fill="currentColor" opacity="0.5"/>
<circle cx="180" cy="85" r="6" fill="currentColor" opacity="0.5"/>
<circle cx="440" cy="85" r="6" fill="currentColor" opacity="0.5"/>
<circle cx="440" cy="385" r="4" fill="currentColor" opacity="0.3"/>
<circle cx="310" cy="460" r="4" fill="currentColor" opacity="0.3"/>
<circle cx="180" cy="385" r="4" fill="currentColor" opacity="0.3"/>
<circle cx="180" cy="235" r="4" fill="currentColor" opacity="0.3"/>
<circle cx="310" cy="160" r="4" fill="currentColor" opacity="0.3"/>
<circle cx="440" cy="235" r="4" fill="currentColor" opacity="0.3"/>`;

const SIDEBAR_AVATAR_GEO = `<polygon class="qx-sidebar-avatar-outer"
                         points="570,310 440,535 180,535 50,310 180,85 440,85"/>
<polygon class="qx-sidebar-avatar-inner"
                         points="440,385 310,460 180,385 180,235 310,160 440,235"/>
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

function addLazyLoading(html) {
    return html.replace(/<(img|video)([^>]*)>/gi, (match, tag, attrs) => {
        if (attrs.includes('loading=')) return match;
        return `<${tag} loading="lazy" ${attrs}>`;
    });
}

async function genArticleHTML(article) {
    const prefix = '../../';
    let body = article.body || '';

    const bodyHTML = await renderMarkdown(body);
    const plainText = stripHtml(bodyHTML).substring(0, 160);
    const articleUrl = `${SITE_URL}/posts/${article.id}.html`;

    const labelsHTML = (article.labels || []).map(l =>
        `<a href="${prefix}categories/${encodeURIComponent(l)}/" class="qx-article-card-label">${l}</a>`
    ).join('\n');

    const metaTags = genMetaTags({
        title: `${SITE_NAME2} - ${article.title}`,
        description: plainText || SITE_DESCRIPTION,
        keywords: article.labels?.join(', ') || SITE_KEYWORDS,
        author: article.author,
        url: articleUrl,
        type: 'article',
        date: article.date,
        tags: article.labels || []
    });

    const structuredData = genStructuredDataArticle(article, articleUrl);
    const breadcrumbData = genStructuredDataBreadcrumb([
        { name: SITE_NAME, url: SITE_URL },
        { name: article.title, url: articleUrl }
    ]);

    return `<!DOCTYPE html>
<html lang="zh-CN">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="view-transition" content="same-origin">
    ${metaTags}
    ${structuredData}
    ${breadcrumbData}
    <title>${SITE_NAME2} - ${article.title}</title>
    <link rel="stylesheet" href="${prefix}css/katex.min.css">
    <link rel="stylesheet" href="${prefix}css/default.css">
    \${LOADER_CSS}
    <script type="module" src="${prefix}js/default.js"></script>
    <script>
        (function () {
            var t = localStorage.getItem('qx-theme');
            if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', t);
        })();
    </script>
</head>

<body>
    \${LOADER_HTML}
    <article class="qx-post">
        <header class="qx-post-header">
            <a href="javascript:history.back()" class="qx-post-back">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg> 返回上一页
            </a>
            <h1 class="qx-post-title">${article.title}</h1>
            <div class="qx-post-meta">
                <span class="qx-post-date">${formatDate(article.date)}</span>
                <span class="qx-post-author">${article.author}</span>
            </div>
            <div class="qx-post-labels">${labelsHTML}</div>
        </header>
        <div class="qx-post-body">${bodyHTML}</div>
    </article>

</body>

</html>`;
}

function genCategoryHTML(label, articleCount) {
    const prefix = '../../';
    const categoryUrl = `${SITE_URL}/categories/${encodeURIComponent(label)}/`;
    const description = `${label} 分类下的所有文章，共 ${articleCount} 篇。`;

    const metaTags = genMetaTags({
        title: `${SITE_NAME2} - ${label}`,
        description,
        keywords: `${label}, ${SITE_KEYWORDS}`,
        url: categoryUrl
    });

    const breadcrumbData = genStructuredDataBreadcrumb([
        { name: SITE_NAME, url: SITE_URL },
        { name: '分类', url: `${SITE_URL}/categories/` },
        { name: label, url: categoryUrl }
    ]);

    return `<!DOCTYPE html>
<html lang="zh-CN">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="view-transition" content="same-origin">
    ${metaTags}
    ${breadcrumbData}
    <title>${SITE_NAME2} - ${label}</title>
    <link rel="stylesheet" href="${prefix}css/default.css">
    \${LOADER_CSS}
    <script type="module" src="${prefix}js/default.js"></script>
    <script>
        (function () {
            var t = localStorage.getItem('qx-theme');
            if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', t);
        })();
    </script>
</head>

<body>
    \${LOADER_HTML}
    <section class="qx-page-hero">
        <span class="qx-page-hero-tag">&lt;Category /&gt;</span>
        <h1 class="qx-page-hero-title">${label}</h1>
        <p class="qx-page-hero-sub">共 ${articleCount} 篇文章</p>
    </section>

    <section class="qx-articles">
        <div class="qx-articles-grid"></div>
        <div class="qx-pagination" id="qxPagination" data-source="category" data-label="${label}"></div>
    </section>

</body>

</html>`;
}

function cleanupLegacyPaginationData() {
    const legacyDirs = [
        path.join(BLOG_DATA_DIR, 'articles'),
        path.join(BLOG_DATA_DIR, 'categories'),
    ];
    legacyDirs.forEach(dir => {
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
            log('Cleanup', `Removed legacy directory: ${dir}`);
        }
    });
}

function genCategoriesJSON(allLabels, articles) {
    const categories = allLabels.map(label => ({
        label,
        count: articles.filter(a => (a.labels || []).includes(label)).length,
    }));
    return categories;
}

function loadConfig() {
    try {
        const data = JSON.parse(fs.readFileSync(SITE_CONFIG_PATH, 'utf-8'));
        const bData = JSON.parse(fs.readFileSync(BUILD_CONFIG_PATH, 'utf-8'));
        log('Config', 'loadConfig() loaded successfully');
        return { siteCfg: data, buildCfg: bData };
    } catch (e) {
        log('Error', 'Config load error', { message: e.message });
        return { siteCfg: {}, buildCfg: {} };
    }
}

function genHeroSection(siteName, heroConfig) {
    return `
    <section class="qx-hero">
        <div class="qx-hero-left">
            <span class="qx-hero-tag">${esc(heroConfig?.tag || '<Blog />')}</span>
            <h1 class="qx-hero-title">${esc(heroConfig?.title || 'Welcome')}</h1>
            <p class="qx-hero-sub">${esc(heroConfig?.subtitle || '')}</p>
        </div>
        <div class="qx-hero-right">
            <svg class="qx-line-art" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g class="qx-la-core" opacity="0.35">
                    <polygon points="250,105 160,170 200,380 310,390 360,160" stroke="currentColor" stroke-width="1.2" fill="none"/>
                    <line x1="160" y1="170" x2="250" y2="430" stroke="currentColor" stroke-width="0.8"/>
                    <line x1="200" y1="380" x2="250" y2="430" stroke="currentColor" stroke-width="0.8"/>
                    <line x1="310" y1="390" x2="250" y2="430" stroke="currentColor" stroke-width="0.8"/>
                    <line x1="360" y1="160" x2="250" y2="430" stroke="currentColor" stroke-width="0.8"/>
                    <line x1="250" y1="105" x2="250" y2="430" stroke="currentColor" stroke-width="0.8"/>
                </g>
            </svg>
        </div>
        <div class="qx-scroll-hint" aria-hidden="true">
            <span class="qx-scroll-line"></span>
        </div>
    </section>`;
}

function genNavHTML(siteName, links = []) {
    const navLinks = links.map(l => {
        const href = l.href || '#';
        const text = l.text || '';
        return `<a href="${href}" class="qx-nav-link">${text}</a>`;
    }).join('');
    
    return `<header class="qx-header">
        <nav class="qx-nav">
            <a href="index.html" class="qx-nav-logo">
                <svg class="qx-nav-logo-svg" width="32" height="32" viewBox="0 0 620 620" fill="none" xmlns="http://www.w3.org/2000/svg">
                    ${LOGO_SVG}
                </svg>
            </a>
            <span class="qx-nav-brand">${esc(siteName)}</span>
            <div class="qx-nav-actions">
                <button class="qx-nav-btn js-search-toggle" title="搜索">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </button>
                <button class="qx-nav-btn js-theme-toggle" title="切换主题">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                </button>
                <button class="qx-nav-btn js-sidebar-toggle" title="侧边栏">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                </button>
            </div>
        </nav>
        <form class="qx-nav-search" action="#" onsubmit="return false;">
            <div class="qx-nav-search-row">
                <input class="qx-nav-search-input" type="text" placeholder="搜索...">
            </div>
        </form>
    </header>`;
}

function genSidebarHTML(sidebarConfig, siteAuthor) {
    const links = sidebarConfig?.links || [];
    const linksHTML = links.map(l => {
        const href = l.href || '#';
        const text = l.text || '';
        return `<a href="${href}" class="qx-sidebar-link">${text}</a>`;
    }).join('');
    
    return `<aside class="qx-sidebar">
        <div class="qx-sidebar-inner">
            <div class="qx-sidebar-avatar">
                <svg class="qx-sidebar-avatar-geo" viewBox="0 0 620 620" fill="none" xmlns="http://www.w3.org/2000/svg">
                    ${SIDEBAR_AVATAR_GEO}
                </svg>
                <img class="qx-sidebar-avatar-img" src="img/Avatar.png" alt="头像">
            </div>
            <p class="qx-sidebar-name">${esc(siteAuthor || 'Author')}</p>
            <p class="qx-sidebar-motto">${esc(sidebarConfig?.motto || '')}</p>
            <nav class="qx-sidebar-nav">${linksHTML}</nav>
        </div>
    </aside>`;
}

function genFooterHTML(footerContent = []) {
    const items = footerContent.map(item => `<p class="qx-footer-item">${item}</p>`).join('');
    return `<footer class="qx-footer">${items}</footer>`;
}

const LOAD2_ERR = (f) => `Failed to load \`${f}\`.`;
const LOAD3 = (f) => {
    try { return JSON.parse(fs.readFileSync(f, 'utf-8')); }
    catch (e) { log('Error', LOAD2_ERR(f), { error: e.message }); return null; }
};

const siteCfg3 = LOAD3(SITE_CONFIG_PATH) || {};
const buildCfg3 = LOAD3(BUILD_CONFIG_PATH) || {};

const MAX_PER_PAGE4 = buildCfg3.maxArticlesPerPage || 10;

const SITE_NAME3 = siteCfg3.site?.name || 'QxBlog';
const SITE_AUTHOR2 = siteCfg3.site?.author || 'Author';

const HERO_CONFIG = siteCfg3.hero || { tag: '<Blog />', title: 'Welcome', subtitle: '' };
const SIDEBAR_CONFIG = siteCfg3.sidebar || { motto: '', links: [] };
const FOOTER_CONTENT = siteCfg3.footerContent || [];

function buildPageVars() {
    return {
        SITE_NAME: SITE_NAME3,
        MAX_PER_PAGE: MAX_PER_PAGE4,
    };
}

function genPageTemplate(content, pageType = 'home') {
    const vars = buildPageVars();
    const title = pageType === 'home' ? SITE_NAME3 : `${SITE_NAME3} - ${pageType}`;
    const pageUrl = pageType === 'home' ? SITE_URL : `${SITE_URL}/${pageType.toLowerCase()}/`;
    const description = pageType === 'home' ? SITE_DESCRIPTION : `${pageType} 页面 - ${SITE_DESCRIPTION}`;

    const metaTags = genMetaTags({
        title,
        description,
        url: pageUrl
    });

    const structuredData = pageType === 'home' ? genStructuredDataWebsite() : '';

    return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="view-transition" content="same-origin">
    ${metaTags}
    ${structuredData}
    <title>${title}</title>
    <link rel="stylesheet" href="css/default.css">
    <style>
        .qx-loader{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:var(--bg-body);transition:opacity .3s,visibility .3s}.qx-loader.is-hidden{opacity:0;visibility:hidden;pointer-events:none}
    </style>
    <script type="module" src="js/default.js"></script>
    <script>
        (function(){
            var t=localStorage.getItem('qx-theme');
            if(!t)t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
            document.documentElement.setAttribute('data-theme',t);
        })();
    </script>
</head>

<body>
    <div class="qx-loader">
        <svg class="qx-loader-geo" viewBox="0 0 620 620" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g class="qx-loader-orbit-wrap"><ellipse class="qx-loader-orbit" cx="310" cy="310" rx="230" ry="85" stroke-width="2.5" opacity="0.22" transform="rotate(-18, 310, 310)"/></g>
            <g class="qx-loader-orbit-wrap"><ellipse class="qx-loader-orbit" cx="310" cy="310" rx="170" ry="120" stroke-width="2.2" opacity="0.16" transform="rotate(28, 310, 310)"/></g>
            <line class="qx-loader-radial" x1="310" y1="310" x2="570" y2="310"/><line class="qx-loader-radial" x1="310" y1="310" x2="440" y2="535"/><line class="qx-loader-radial" x1="310" y1="310" x2="180" y2="535"/><line class="qx-loader-radial" x1="310" y1="310" x2="50" y2="310"/><line class="qx-loader-radial" x1="310" y1="310" x2="180" y2="85"/><line class="qx-loader-radial" x1="310" y1="310" x2="440" y2="85"/>
            <polygon class="qx-loader-outer" points="570,310 440,535 180,535 50,310 180,85 440,85"/>
            <polygon class="qx-loader-inner" points="440,385 310,460 180,385 180,235 310,160 440,235"/>
            <circle class="qx-loader-dot" cx="570" cy="310" r="5.5" style="animation-delay:0s"/><circle class="qx-loader-dot" cx="440" cy="535" r="5.5" style="animation-delay:.5s"/><circle class="qx-loader-dot" cx="180" cy="535" r="5.5" style="animation-delay:1s"/><circle class="qx-loader-dot" cx="50" cy="310" r="5.5" style="animation-delay:1.5s"/><circle class="qx-loader-dot" cx="180" cy="85" r="5.5" style="animation-delay:2s"/><circle class="qx-loader-dot" cx="440" cy="85" r="5.5" style="animation-delay:2.5s"/>
            <circle class="qx-loader-idot" cx="440" cy="385" r="3.2"/><circle class="qx-loader-idot" cx="310" cy="460" r="3.2"/><circle class="qx-loader-idot" cx="180" cy="385" r="3.2"/><circle class="qx-loader-idot" cx="180" cy="235" r="3.2"/><circle class="qx-loader-idot" cx="310" cy="160" r="3.2"/><circle class="qx-loader-idot" cx="440" cy="235" r="3.2"/>
            <circle class="qx-loader-core" cx="310" cy="310" r="8"/>
        </svg>
    </div>
    ${genNavHTML(SITE_NAME3)}
    ${content}
    ${genSidebarHTML(SIDEBAR_CONFIG, SITE_AUTHOR2)}
    ${genFooterHTML(FOOTER_CONTENT)}
</body>

</html>`;
}

let _unifiedProcessor = null;

async function getUnifiedProcessor() {
    if (_unifiedProcessor) return _unifiedProcessor;
    log('Markdown', 'Initializing unified processor...');
    const [
        unified, remarkParse, remarkGfm, remarkMath,
        remarkFrontmatter, remarkBreaks, remarkRehype,
        rehypeStringify, rehypeSlug, rehypeAutolinkHeadings,
        rehypeKatex, rehypePrettyCode, shiki
    ] = await Promise.all([
        import('unified'), import('remark-parse'), import('remark-gfm'),
        import('remark-math'), import('remark-frontmatter'), import('remark-breaks'),
        import('remark-rehype'), import('rehype-stringify'), import('rehype-slug'),
        import('rehype-autolink-headings'), import('rehype-katex'),
        import('rehype-pretty-code'), import('shiki')
    ]);
    
    async function customGetHighlighter(options) {
        const highlighter = await shiki.createHighlighter({
            themes: options.themes, langs: options.langs,
        });
        return highlighter;
    }
    
    _unifiedProcessor = unified.unified()
        .use(remarkParse.default).use(remarkFrontmatter.default)
        .use(remarkGfm.default).use(remarkBreaks.default)
        .use(remarkMath.default).use(remarkRehype.default, { allowDangerousHtml: true })
        .use(rehypeSlug.default).use(rehypeAutolinkHeadings.default, { behavior: 'wrap', properties: { className: ['qx-heading-anchor'] } })
        .use(rehypeKatex.default, { throwOnError: false, strict: false })
        .use(rehypePrettyCode.default, { theme: { light: 'github-light', dark: 'github-dark' }, keepBackground: false, defaultLang: 'text', getHighlighter: customGetHighlighter })
        .use(rehypeStringify.default, { allowDangerousHtml: true });
    log('Markdown', 'Unified processor initialized');
    return _unifiedProcessor;
}

async function renderMarkdown(md) {
    try {
        const processor = await getUnifiedProcessor();
        const result = await processor.process(md);
        return String(result);
    } catch (err) {
        log('Error', 'Markdown render error', { error: err.message });
        return `<p>${esc(md)}</p>`;
    }
}

function parseFrontmatter(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) return null;

    const frontmatterText = match[1];
    const body = match[2].trim();

    const data = {};
    const lines = frontmatterText.split('\n');
    for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        
        // Handle array format: ["tag1", "tag2"]
        if (value.startsWith('[') && value.endsWith(']')) {
            try {
                data[key] = JSON.parse(value);
            } catch {
                try {
                    data[key] = JSON.parse(value.replace(/'/g, '"'));
                } catch {
                    data[key] = value;
                }
            }
        } else if (value.startsWith('"') && value.endsWith('"')) {
            data[key] = yamlUnescapeDoubleQuoted(value.slice(1, -1));
        } else {
            data[key] = value;
        }
    }

    return { data, body };
}

async function buildSingleArticle(options) {
    let id, title, author, date, labels, body, markdownPath;
    
    if (typeof options === 'number' || typeof options === 'string') {
        // 从文件构建
        const fileId = options;
        const filename = `${fileId}.md`;
        const filePath = path.join(MARKDOWN_DIR, filename);

        if (!fs.existsSync(filePath)) {
            log('Error', `File not found: ${filePath}`);
            return false;
        }

        log('Read', `Reading file: ${filename}`);
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = parseFrontmatter(content);

        if (!parsed) {
            log('Error', `Failed to parse frontmatter in ${filename}`);
            return false;
        }

        const { data, body: parsedBody } = parsed;
        log('Parse', `Frontmatter parsed for ${filename}`, {
            title: data['title'],
            date: data['date'],
            tags: data['tags'],
            author: data['author'],
            id: data['id']
        });

        id = parseInt(data['id']) || parseInt(fileId) || 0;
        title = data['title'] || 'Untitled';
        date = data['date'] || new Date().toISOString();
        author = data['author'] || siteCfg.site?.author || 'Anonymous';
        labels = Array.isArray(data['tags']) ? data['tags'] : (data['tags'] ? data['tags'].split(',').map(l => l.trim()).filter(Boolean) : []);
        body = parsedBody;
        markdownPath = `blogData/markdown/${filename}`;
    } else if (typeof options === 'object') {
        // 从数据对象构建
        id = options.id;
        title = options.title || 'Untitled';
        author = options.author || siteCfg.site?.author || 'Anonymous';
        date = options.date || new Date().toISOString();
        labels = options.labels || [];
        body = options.body || '';
        markdownPath = options.markdownPath || `blogData/markdown/${id}.md`;
    } else {
        log('Error', 'Invalid options for buildSingleArticle');
        return false;
    }

    const slug = genSlug(title);

    const article = {
        id,
        slug,
        title,
        author,
        date,
        labels,
        markdownPath,
    };

    log('Data', `Article object created for #${id}`, article);

    const articleBodyHTML = await renderMarkdown(body);
    const plainText = stripHtml(articleBodyHTML).substring(0, 160);
    const articleUrl = `${SITE_URL}/posts/${id}.html`;
    const labelsHTML = labels.map(l =>
        `<a href="../categories/${encodeURIComponent(l)}/" class="qx-article-card-label">${l}</a>`
    ).join('\n');

    const metaTags = genMetaTags({
        title: `${SITE_NAME} - ${title}`,
        description: plainText || SITE_DESCRIPTION,
        keywords: labels.join(', ') || SITE_KEYWORDS,
        author,
        url: articleUrl,
        type: 'article',
        date,
        tags: labels
    });

    const structuredData = genStructuredDataArticle({ id, title, author, date, labels }, articleUrl);
    const breadcrumbData = genStructuredDataBreadcrumb([
        { name: SITE_NAME, url: SITE_URL },
        { name: title, url: articleUrl }
    ]);

    const articleHTML = `<!DOCTYPE html>
<html lang="zh-CN">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="view-transition" content="same-origin">
    ${metaTags}
    ${structuredData}
    ${breadcrumbData}
    <title>${SITE_NAME} - ${title}</title>
    <link rel="stylesheet" href="../css/katex.min.css">
    <link rel="stylesheet" href="../css/default.css">
    <style>.qx-loader{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:var(--bg-body);transition:opacity .3s,visibility .3s}.qx-loader.is-hidden{opacity:0;visibility:hidden;pointer-events:none}</style>
    <script type="module" src="../js/default.js"></script>
    <script>
        (function () {
            var t = localStorage.getItem('qx-theme');
            if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', t);
        })();
    </script>
</head>

<body>
    <div class="qx-loader">
        <svg class="qx-loader-geo" viewBox="0 0 620 620" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g class="qx-loader-orbit-wrap"><ellipse class="qx-loader-orbit" cx="310" cy="310" rx="230" ry="85" stroke-width="2.5" opacity="0.22" transform="rotate(-18, 310, 310)"/></g>
            <g class="qx-loader-orbit-wrap"><ellipse class="qx-loader-orbit" cx="310" cy="310" rx="170" ry="120" stroke-width="2.2" opacity="0.16" transform="rotate(28, 310, 310)"/></g>
            <line class="qx-loader-radial" x1="310" y1="310" x2="570" y2="310"/><line class="qx-loader-radial" x1="310" y1="310" x2="440" y2="535"/><line class="qx-loader-radial" x1="310" y1="310" x2="180" y2="535"/><line class="qx-loader-radial" x1="310" y1="310" x2="50" y2="310"/><line class="qx-loader-radial" x1="310" y1="310" x2="180" y2="85"/><line class="qx-loader-radial" x1="310" y1="310" x2="440" y2="85"/>
            <polygon class="qx-loader-outer" points="570,310 440,535 180,535 50,310 180,85 440,85"/>
            <polygon class="qx-loader-inner" points="440,385 310,460 180,385 180,235 310,160 440,235"/>
            <circle class="qx-loader-dot" cx="570" cy="310" r="5.5" style="animation-delay:0s"/><circle class="qx-loader-dot" cx="440" cy="535" r="5.5" style="animation-delay:.5s"/><circle class="qx-loader-dot" cx="180" cy="535" r="5.5" style="animation-delay:1s"/><circle class="qx-loader-dot" cx="50" cy="310" r="5.5" style="animation-delay:1.5s"/><circle class="qx-loader-dot" cx="180" cy="85" r="5.5" style="animation-delay:2s"/><circle class="qx-loader-dot" cx="440" cy="85" r="5.5" style="animation-delay:2.5s"/>
            <circle class="qx-loader-idot" cx="440" cy="385" r="3.2"/><circle class="qx-loader-idot" cx="310" cy="460" r="3.2"/><circle class="qx-loader-idot" cx="180" cy="385" r="3.2"/><circle class="qx-loader-idot" cx="180" cy="235" r="3.2"/><circle class="qx-loader-idot" cx="310" cy="160" r="3.2"/><circle class="qx-loader-idot" cx="440" cy="235" r="3.2"/>
            <circle class="qx-loader-core" cx="310" cy="310" r="8"/>
        </svg>
    </div>
    <article class="qx-post">
        <header class="qx-post-header">
            <a href="javascript:history.back()" class="qx-post-back">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg> 返回上一页
            </a>
            <h1 class="qx-post-title">${title}</h1>
            <div class="qx-post-meta">
                <span class="qx-post-date">${formatDate(date)}</span>
                <span class="qx-post-author">${author}</span>
            </div>
            <div class="qx-post-labels">${labelsHTML}</div>
        </header>
        <div class="qx-post-body">${articleBodyHTML}</div>
    </article>
</body>

</html>`;

    const postPath = path.join(POSTS_DIR, `${id}.html`);
    fs.writeFileSync(postPath, articleHTML, 'utf-8');
    log('File', `Generated HTML post: ${postPath}`);

    return article;
}

function updateArticlesJSON(newArticle) {
    let articles = [];
    if (fs.existsSync(ARTICLES_JSON_PATH)) {
        articles = loadJSON(ARTICLES_JSON_PATH) || [];
    }

    const existingIndex = articles.findIndex(a => a.id === newArticle.id);
    if (existingIndex >= 0) {
        articles[existingIndex] = newArticle;
        log('JSON', `Updated existing article #${newArticle.id} in articles.json`);
    } else {
        articles.push(newArticle);
        log('JSON', `Added new article #${newArticle.id} to articles.json`);
    }

    articles.sort((a, b) => new Date(b.date) - new Date(a.date));
    saveJSON(ARTICLES_JSON_PATH, articles);
    return articles;
}

function updateCategoriesJSON(articles) {
    const allLabels = [...new Set(articles.flatMap(a => a.labels || []))];
    const categories = allLabels.map(label => ({
        label,
        count: articles.filter(a => (a.labels || []).includes(label)).length,
    }));
    saveJSON(CATEGORIES_JSON_PATH, categories);
    return categories;
}

async function removeArticle(articleId, { keepMarkdown = false } = {}) {
    const actionLabel = keepMarkdown ? 'Closing' : 'Deleting';
    log('Start', `${actionLabel} article #${articleId}...`);

    const markdownPath = path.join(BLOG_DATA_DIR, 'markdown', `${articleId}.md`);
    if (keepMarkdown) {
        if (fs.existsSync(markdownPath)) {
            log('File', `Keeping markdown file: ${markdownPath}`);
        } else {
            log('Warning', `Markdown file not found: ${markdownPath}`);
        }
    } else if (fs.existsSync(markdownPath)) {
        fs.unlinkSync(markdownPath);
        log('File', `Deleted markdown file: ${markdownPath}`);
    } else {
        log('Warning', `Markdown file not found: ${markdownPath}`);
    }

    const htmlPath = path.join(POSTS_DIR, `${articleId}.html`);
    if (fs.existsSync(htmlPath)) {
        fs.unlinkSync(htmlPath);
        log('File', `Deleted HTML file: ${htmlPath}`);
    } else {
        log('Warning', `HTML file not found: ${htmlPath}`);
    }

    let articles = [];
    if (fs.existsSync(ARTICLES_JSON_PATH)) {
        articles = loadJSON(ARTICLES_JSON_PATH) || [];
    }
    const originalLength = articles.length;
    articles = articles.filter(a => a.id !== articleId);
    if (articles.length < originalLength) {
        saveJSON(ARTICLES_JSON_PATH, articles);
        log('JSON', `Removed article #${articleId} from articles.json`);
    } else {
        log('Warning', `Article #${articleId} not found in articles.json`);
    }

    const categories = updateCategoriesJSON(articles);
    generateSitemap(articles, categories);
    generateRobotsTxt();

    const doneLabel = keepMarkdown ? 'closed' : 'deleted';
    log('Complete', `Article #${articleId} ${doneLabel} successfully`, {
        totalArticles: articles.length,
        totalCategories: categories.length,
    });
}

async function deleteArticle(articleId) {
    return removeArticle(articleId, { keepMarkdown: false });
}

async function closeArticle(articleId) {
    return removeArticle(articleId, { keepMarkdown: true });
}

function isIssueClosed(issueId) {
    const viewOutput = execSync(`gh issue view ${issueId} --json state`, {
        encoding: 'utf-8',
        cwd: ROOT,
    });
    const { state } = JSON.parse(viewOutput);
    return state === 'CLOSED';
}

async function buildFromGitHubIssues() {
    const issueAction = process.env.ISSUE_ACTION || '';
    const issueId = process.env.ISSUE_ID ? parseInt(process.env.ISSUE_ID) : null;

    const issueAuthor = process.env.ISSUE_AUTHOR || '';
    if (!isBuildAuthorAllowed(issueAuthor)) {
        log('Cancel', 'Build cancelled: issue author is not allowed to trigger CI', {
            reason: 'AUTHOR_MISMATCH',
            issueAuthor: issueAuthor || '(empty)',
            allowedAuthor: ALLOWED_BUILD_AUTHOR,
        });
        return;
    }
    
    // 删除事件：移除 HTML、元数据及 md 文件
    if (issueAction === 'deleted' && issueId) {
        const articleId = issueNumberToArticleId(issueId);
        log('Config', `Deleting article mapped from issue #${issueId} → #${articleId}`);
        await deleteArticle(articleId);
        return;
    }

    // 关闭事件：与删除相同，但保留 md 文件
    if (issueAction === 'closed' && issueId) {
        const articleId = issueNumberToArticleId(issueId);
        log('Config', `Closing article mapped from issue #${issueId} → #${articleId}`);
        await closeArticle(articleId);
        return;
    }

    // 编辑已关闭的 Issue 时不构建（与作者不匹配时同样直接跳过）
    if (issueAction === 'edited' && issueId) {
        try {
            if (isIssueClosed(issueId)) {
                log('Cancel', 'Build cancelled: cannot process edits on a closed issue', {
                    reason: 'ISSUE_CLOSED',
                    issueId,
                    action: issueAction,
                });
                return;
            }
        } catch (err) {
            log('Warning', 'Failed to check issue state', { error: err.message });
        }
    }

    log('Start', 'QxBlog CI Build Script Starting...');
    log('Info', 'Root directory', { root: ROOT });
    
    // 构建模式判断：单文章 vs 全部
    const buildMode = issueId ? 'single' : 'all';
    log('Config', `Build mode: ${buildMode}`, { 
        mode: buildMode, 
        issueId: issueId || 'N/A' 
    });
    
    ensureDir(POSTS_DIR);
    
    const issueRE = /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?!?:/i;
    
    try {
        log('GitHub', 'Fetching issues from GitHub...');
        const output = execSync('gh issue list --state all --limit 1000 --json number,title,body,labels,createdAt,author,updatedAt,state', {
            encoding: 'utf-8',
            cwd: ROOT,
        });
        const issues = JSON.parse(output);
        
        if (!issues || issues.length === 0) {
            log('Warning', 'No issues found in repository');
            return;
        }
        
        // 根据 ISSUE_ID 过滤：如果设置了 ISSUE_ID，只处理这一个 issue
        let targetIssues = issues;
        if (issueId) {
            targetIssues = issues.filter(issue => issue.number === issueId);
            if (targetIssues.length === 0) {
                log('Error', `Issue #${issueId} not found in repository`);
                process.exit(1);
            }
            log('GitHub', `Single issue mode - Building issue #${issueId}`, { 
                issueNumber: issueId,
                issueTitle: targetIssues[0].title
            });
        } else {
            log('GitHub', `All issues mode - Found ${issues.length} total issues`, { 
                issueNumbers: issues.map(i => i.number),
                issueTitles: issues.map(i => i.title)
            });
        }
        
        // 加载已有的文章列表（如果是单文章模式）
        let articles = [];
        if (buildMode === 'single') {
            if (fs.existsSync(ARTICLES_JSON_PATH)) {
                articles = loadJSON(ARTICLES_JSON_PATH) || [];
                log('Info', `Loaded ${articles.length} existing articles from articles.json`);
            }
        }
        
        const markdownDir = path.join(BLOG_DATA_DIR, 'markdown');
        ensureDir(markdownDir);
        
        let skippedCount = 0;
        let processedCount = 0;
        
        for (const issue of targetIssues) {
            const isConventionalCommit = issueRE.test(issue.title);
            const hasArticleLabel = issue.labels?.some(l => l.name === 'article');
            const hasNoArticleLabel = issue.labels?.some(l => l.name === 'no-article');
            
            log('Filter', `Checking issue #${issue.number}: "${issue.title}"`, {
                isConventionalCommit,
                hasArticleLabel,
                hasNoArticleLabel,
                labels: issue.labels?.map(l => l.name) || []
            });
            
            // Skip only if explicitly marked as no-article
            if (hasNoArticleLabel) {
                log('Skip', `Issue #${issue.number} skipped (marked as no-article)`, { reason: 'Has no-article label' });
                skippedCount++;
                continue;
            }

            if (issueAction === 'edited' && issue.state === 'CLOSED') {
                log('Skip', `Issue #${issue.number} skipped (issue is closed)`, { reason: 'Edits to closed issues are ignored' });
                skippedCount++;
                continue;
            }

            const issueCreator = issue.author?.login || '';
            if (!isBuildAuthorAllowed(issueCreator)) {
                log('Skip', `Issue #${issue.number} skipped (author mismatch)`, {
                    issueAuthor: issueCreator,
                    allowedAuthor: ALLOWED_BUILD_AUTHOR,
                });
                skippedCount++;
                continue;
            }
            
            processedCount++;
            
            const articleId = issueNumberToArticleId(issue.number);
            const localDate = new Date(issue.createdAt).toISOString();
            const labelsArray = issue.labels?.map(l => l.name) || [];
            const author = siteCfg.site?.author || issue.author?.login || 'Anonymous';
            
            log('Process', `Processing issue #${issue.number} → article #${articleId}`, {
                title: issue.title,
                date: localDate,
                labels: labelsArray
            });
            
            // 生成 markdown 文件
            const markdownPath = path.join(markdownDir, `${articleId}.md`);
            const frontmatter = `---
title: "${yamlEscapeDoubleQuoted(issue.title)}"
date: "${yamlEscapeDoubleQuoted(localDate)}"
tags: ${JSON.stringify(labelsArray)}
author: "${yamlEscapeDoubleQuoted(author)}"
id: ${articleId}
---

${issue.body || ''}`;
            fs.writeFileSync(markdownPath, frontmatter, 'utf-8');
            log('File', `Generated markdown: ${markdownPath}`);
            
            // 使用通用的 buildSingleArticle 函数（通过数据对象方式）
            const article = await buildSingleArticle({
                id: articleId,
                title: issue.title,
                author,
                date: localDate,
                labels: labelsArray,
                body: issue.body || '',
                markdownPath: `blogData/markdown/${articleId}.md`
            });
            
            if (article) {
                // 更新或添加到文章列表
                const existingIndex = articles.findIndex(a => a.id === article.id);
                if (existingIndex >= 0) {
                    articles[existingIndex] = article;
                    log('JSON', `Updated existing article #${article.id} in articles list`);
                } else {
                    articles.push(article);
                    log('JSON', `Added new article #${article.id} to articles list`);
                }
            }
        }
        
        log('Summary', `Issue processing complete (${buildMode} mode)`, {
            mode: buildMode,
            totalIssues: targetIssues.length,
            processed: processedCount,
            skipped: skippedCount,
            articlesGenerated: articles.length
        });
        
        // 对所有文章按时间排序
        articles.sort((a, b) => new Date(b.date) - new Date(a.date));
        saveJSON(ARTICLES_JSON_PATH, articles);
        
        const allLabels = [...new Set(articles.flatMap(a => a.labels || []))];
        const categories = genCategoriesJSON(allLabels, articles);
        saveJSON(CATEGORIES_JSON_PATH, categories);
        
        log('Data', 'Categories generated', { categories });
        
        cleanupLegacyPaginationData();
        
        generateSitemap(articles, categories);
        generateRobotsTxt();
        
        log('Complete', `Build complete! (${buildMode} mode)`, {
            mode: buildMode,
            totalArticles: articles.length,
            totalCategories: categories.length,
            outputFiles: {
                articles: ARTICLES_JSON_PATH,
                categories: CATEGORIES_JSON_PATH,
                posts: POSTS_DIR,
                markdown: path.join(BLOG_DATA_DIR, 'markdown')
            }
        });
        
    } catch (err) {
        log('Error', 'Build failed', { error: err.message, stack: err.stack });
        process.exit(1);
    }
}

async function buildFromLocalMarkdown(fileId) {
    log('Start', 'QxBlog Local Build - Single Article Mode');
    log('Info', 'Root directory', { root: ROOT });

    ensureDir(POSTS_DIR);

    if (!fs.existsSync(MARKDOWN_DIR)) {
        log('Error', `Markdown directory not found: ${MARKDOWN_DIR}`);
        process.exit(1);
    }

    log('Input', `Building article with ID: ${fileId}`);

    const article = await buildSingleArticle(fileId);

    if (!article) {
        log('Error', `Failed to build article #${fileId}`);
        process.exit(1);
    }

    const articles = updateArticlesJSON(article);
    const categories = updateCategoriesJSON(articles);

    generateSitemap(articles, categories);
    generateRobotsTxt();

    log('Complete', 'Build complete!', {
        articleId: article.id,
        articleTitle: article.title,
        totalArticles: articles.length,
        totalCategories: categories.length,
        outputFiles: {
            post: path.join(POSTS_DIR, `${article.id}.html`),
            articles: ARTICLES_JSON_PATH,
            categories: CATEGORIES_JSON_PATH,
        }
    });
}

async function buildAllLocalArticles() {
    log('Start', 'QxBlog Local Build - All Articles Mode');
    log('Info', 'Root directory', { root: ROOT });
    
    ensureDir(POSTS_DIR);
    ensureDir(MARKDOWN_DIR);
    
    const files = fs.readdirSync(MARKDOWN_DIR).filter(f => f.endsWith('.md'));
    
    if (files.length === 0) {
        log('Warning', 'No markdown files found');
        return;
    }
    
    log('Info', `Found ${files.length} markdown files`, {
        files: files.sort()
    });
    
    const articles = [];
    
    for (const file of files) {
        const fileId = file.replace('.md', '');
        
        const article = await buildSingleArticle(fileId);
        
        if (article) {
            articles.push(article);
        }
    }
    
    const updatedArticles = updateArticlesJSONFromArray(articles);
    const categories = updateCategoriesJSON(updatedArticles);
    
    generateSitemap(updatedArticles, categories);
    generateRobotsTxt();
    
    log('Complete', 'Build complete!', {
        totalArticles: updatedArticles.length,
        totalCategories: categories.length,
        outputFiles: {
            posts: POSTS_DIR,
            articles: ARTICLES_JSON_PATH,
            categories: CATEGORIES_JSON_PATH,
        }
    });
}

function updateArticlesJSONFromArray(newArticles) {
    let articles = [];
    if (fs.existsSync(ARTICLES_JSON_PATH)) {
        articles = loadJSON(ARTICLES_JSON_PATH) || [];
    }
    
    for (const newArticle of newArticles) {
        const existingIndex = articles.findIndex(a => a.id === newArticle.id);
        if (existingIndex >= 0) {
            articles[existingIndex] = newArticle;
            log('JSON', `Updated existing article #${newArticle.id} in articles.json`);
        } else {
            articles.push(newArticle);
            log('JSON', `Added new article #${newArticle.id} to articles.json`);
        }
    }
    
    articles.sort((a, b) => new Date(b.date) - new Date(a.date));
    saveJSON(ARTICLES_JSON_PATH, articles);
    return articles;
}

function generateSitemap(articles, categories) {
    const sitemapPath = path.join(ROOT, 'sitemap.xml');
    const now = new Date().toISOString();
    
    let urls = [];
    
    urls.push({
        loc: SITE_URL,
        lastmod: now,
        changefreq: 'daily',
        priority: '1.0'
    });
    
    urls.push({
        loc: `${SITE_URL}/articles/`,
        lastmod: now,
        changefreq: 'daily',
        priority: '0.9'
    });
    
    urls.push({
        loc: `${SITE_URL}/categories/`,
        lastmod: now,
        changefreq: 'weekly',
        priority: '0.8'
    });
    
    urls.push({
        loc: `${SITE_URL}/about/`,
        lastmod: now,
        changefreq: 'monthly',
        priority: '0.5'
    });
    
    if (Array.isArray(articles)) {
        for (const article of articles) {
            urls.push({
                loc: `${SITE_URL}/posts/${article.id}.html`,
                lastmod: new Date(article.date).toISOString(),
                changefreq: 'weekly',
                priority: '0.8'
            });
        }
    }
    
    if (Array.isArray(categories)) {
        for (const category of categories) {
            urls.push({
                loc: `${SITE_URL}/categories/${encodeURIComponent(category.label)}/`,
                lastmod: now,
                changefreq: 'weekly',
                priority: '0.6'
            });
        }
    }
    
    const urlEntries = urls.map(u => `  <url>
    <loc>${esc(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n');
    
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
    
    fs.writeFileSync(sitemapPath, sitemap, 'utf-8');
    log('Sitemap', `Generated sitemap.xml with ${urls.length} URLs`, { path: sitemapPath });
    return sitemapPath;
}

function generateRobotsTxt() {
    const robotsPath = path.join(ROOT, 'robots.txt');
    const robotsConfig = buildCfg.robots || {};
    
    const userAgent = robotsConfig.userAgent || '*';
    const allow = robotsConfig.allow || '/';
    const disallow = robotsConfig.disallow || [];
    const additionalRules = robotsConfig.additionalRules || [];
    
    const lines = [];
    lines.push(`User-agent: ${userAgent}`);
    lines.push(`Allow: ${allow}`);
    
    disallow.forEach(path => {
        lines.push(`Disallow: ${path}`);
    });
    
    additionalRules.forEach(rule => {
        lines.push(rule);
    });
    
    lines.push('');
    lines.push(`Sitemap: ${SITE_URL}/sitemap.xml`);
    
    const content = lines.join('\n');
    fs.writeFileSync(robotsPath, content, 'utf-8');
    log('Robots', `Generated robots.txt`, { path: robotsPath });
    return robotsPath;
}

const program = new Command();

program
  .name('qxblog-build')
  .description('QxBlog 构建工具')
  .version('1.0.0');

const localCommand = program
  .command('local')
  .description('本地文章操作');

localCommand
  .command('build <id>')
  .description('从本地 Markdown 文件构建文章（ID 为文章 ID 或 all 构建所有）')
  .action(async (id) => {
    if (id.toLowerCase() === 'all') {
        await buildAllLocalArticles();
    } else {
        await buildFromLocalMarkdown(id);
    }
  });

localCommand
  .command('delete <id>')
  .description('删除指定 ID 的文章（ID 为文章 ID 或 all 删除所有）')
  .action(async (id) => {
    if (id.toLowerCase() === 'all') {
        let articles = [];
        if (fs.existsSync(ARTICLES_JSON_PATH)) {
            articles = loadJSON(ARTICLES_JSON_PATH) || [];
        }
        
        for (const article of articles) {
            await deleteArticle(article.id);
        }
        
        log('Complete', '所有文章已删除');
    } else {
        const issueId = parseInt(id);
        if (isNaN(issueId)) {
            log('Error', `Invalid article ID: ${id}`);
            process.exit(1);
        }
        await deleteArticle(issueId);
    }
  });

const ciCommand = program
  .command('ci')
  .description('CI Issues 操作');

ciCommand
  .command('build')
  .description('从 GitHub Issues 构建文章')
  .action(async () => {
    await buildFromGitHubIssues();
  });

program.parseAsync().catch(err => {
    log('Error', 'Build failed', { error: err.message, stack: err.stack });
    process.exit(1);
});
