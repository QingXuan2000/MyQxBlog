const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const ARTICLES_JSON = path.join(ROOT, 'blogData', 'articles.json');
const BUILD_CONFIG = path.join(ROOT, 'config', 'buildConfig.json');
const SITE_CONFIG = path.join(ROOT, 'config', 'siteConfig.json');
const BLOG_DATA_DIR = path.join(ROOT, 'blogData');
const ARTICLES_DIR = path.join(ROOT, 'articles');
const ARTICLES_PAGES_DIR = path.join(ARTICLES_DIR, 'pages');
const CATEGORIES_DIR = path.join(ROOT, 'categories');

const LOADER_CSS = `<style>.qx-loader{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:var(--bg-body);transition:opacity .3s,visibility .3s}.qx-loader.is-hidden{opacity:0;visibility:hidden;pointer-events:none}</style>`;
const LOADER_HTML = `<div class="qx-loader"><svg class="qx-loader-geo" viewBox="0 0 620 620" fill="none" xmlns="http://www.w3.org/2000/svg"><g class="qx-loader-orbit-wrap"><ellipse class="qx-loader-orbit" cx="310" cy="310" rx="230" ry="85" stroke-width="2.5" opacity="0.22" transform="rotate(-18, 310, 310)"/></g><g class="qx-loader-orbit-wrap"><ellipse class="qx-loader-orbit" cx="310" cy="310" rx="170" ry="120" stroke-width="2.2" opacity="0.16" transform="rotate(28, 310, 310)"/></g><line class="qx-loader-radial" x1="310" y1="310" x2="570" y2="310"/><line class="qx-loader-radial" x1="310" y1="310" x2="440" y2="535"/><line class="qx-loader-radial" x1="310" y1="310" x2="180" y2="535"/><line class="qx-loader-radial" x1="310" y1="310" x2="50" y2="310"/><line class="qx-loader-radial" x1="310" y1="310" x2="180" y2="85"/><line class="qx-loader-radial" x1="310" y1="310" x2="440" y2="85"/><polygon class="qx-loader-outer" points="570,310 440,535 180,535 50,310 180,85 440,85"/><polygon class="qx-loader-inner" points="440,385 310,460 180,385 180,235 310,160 440,235"/><circle class="qx-loader-dot" cx="570" cy="310" r="5.5" style="animation-delay:0s"/><circle class="qx-loader-dot" cx="440" cy="535" r="5.5" style="animation-delay:.5s"/><circle class="qx-loader-dot" cx="180" cy="535" r="5.5" style="animation-delay:1s"/><circle class="qx-loader-dot" cx="50" cy="310" r="5.5" style="animation-delay:1.5s"/><circle class="qx-loader-dot" cx="180" cy="85" r="5.5" style="animation-delay:2s"/><circle class="qx-loader-dot" cx="440" cy="85" r="5.5" style="animation-delay:2.5s"/><circle class="qx-loader-idot" cx="440" cy="385" r="3.2"/><circle class="qx-loader-idot" cx="310" cy="460" r="3.2"/><circle class="qx-loader-idot" cx="180" cy="385" r="3.2"/><circle class="qx-loader-idot" cx="180" cy="235" r="3.2"/><circle class="qx-loader-idot" cx="310" cy="160" r="3.2"/><circle class="qx-loader-idot" cx="440" cy="235" r="3.2"/><circle class="qx-loader-core" cx="310" cy="310" r="8"/></svg></div>`;

function readJSON(fp) {
    if (!fs.existsSync(fp)) return {};
    return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

function writeJSON(fp, data) {
    const dir = path.dirname(fp);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function slugify(title) {
    return title
        .toLowerCase()
        .replace(/[^\w一-鿿]+/g, '-')
        .replace(/^-+|-+$/g, '')
        || 'article';
}

function convertToLocal(utcStr, offset) {
    const match = offset.match(/([+-])(\d{2}):(\d{2})/);
    if (!match) return utcStr;
    const sign = match[1] === '+' ? 1 : -1;
    const hours = parseInt(match[2], 10);
    const minutes = parseInt(match[3], 10);
    const totalMs = sign * (hours * 60 + minutes) * 60 * 1000;
    const date = new Date(new Date(utcStr).getTime() + totalMs);
    return date.toISOString().replace('Z', offset);
}

function formatDate(isoStr) {
    const d = new Date(isoStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
}

function stripMarkdown(md) {
    return md
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[([^\]]*)\]\(.*?\)/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, '$2')
        .replace(/^>\s+/gm, '')
        .replace(/^[-*+]\s+/gm, '')
        .replace(/^\d+\.\s+/gm, '')
        .replace(/<[^>]+>/g, '')
        .replace(/^\s*[\r\n]/gm, '')
        .replace(/\n{2,}/g, '\n')
        .trim();
}

let siteName = 'QxBlog';

function addLazyLoading(html) {
    return html.replace(/<img(?![^>]*loading)([^>]*)>/g, '<img loading="lazy"$1>');
}

// ====== Unified Markdown Pipeline ======

let _unifiedProcessor = null;

async function getUnifiedProcessor() {
    if (_unifiedProcessor) return _unifiedProcessor;

    // 动态导入所有 ESM 模块
    const [
        unified,
        remarkParse,
        remarkGfm,
        remarkMath,
        remarkFrontmatter,
        remarkBreaks,
        remarkRehype,
        rehypeStringify,
        rehypeSlug,
        rehypeAutolinkHeadings,
        rehypeKatex,
        rehypePrettyCode,
        shiki
    ] = await Promise.all([
        import('unified'),
        import('remark-parse'),
        import('remark-gfm'),
        import('remark-math'),
        import('remark-frontmatter'),
        import('remark-breaks'),
        import('remark-rehype'),
        import('rehype-stringify'),
        import('rehype-slug'),
        import('rehype-autolink-headings'),
        import('rehype-katex'),
        import('rehype-pretty-code'),
        import('shiki')
    ]);

    // 自定义 getHighlighter
    async function customGetHighlighter(options) {
        const highlighter = await shiki.createHighlighter({
            themes: options.themes,
            langs: options.langs,
        });
        return highlighter;
    }

    _unifiedProcessor = unified.unified()
        .use(remarkParse.default)
        .use(remarkFrontmatter.default)
        .use(remarkGfm.default)
        .use(remarkBreaks.default)
        .use(remarkMath.default)
        .use(remarkRehype.default, { allowDangerousHtml: true })
        .use(rehypeSlug.default)
        .use(rehypeAutolinkHeadings.default, {
            behavior: 'wrap',
            properties: { className: ['qx-heading-anchor'] }
        })
        .use(rehypeKatex.default, {
            throwOnError: false,
            strict: false
        })
        .use(rehypePrettyCode.default, {
            theme: {
                light: 'github-light',
                dark: 'github-dark'
            },
            keepBackground: false,
            defaultLang: 'text',
            transformers: [],
            getHighlighter: customGetHighlighter,
            onVisitHighlightedLine(node) {
                // 高亮行支持（可选）
            },
            onVisitHighlightedWord(node) {
                // 高亮单词支持（可选）
            },
            filterMetaString: (meta) => meta.replace(/filename="[^"]*"/, '')
        })
        .use(rehypeStringify.default, { allowDangerousHtml: true });

    return _unifiedProcessor;
}

async function renderMarkdown(body) {
    const processor = await getUnifiedProcessor();
    const result = await processor.process(body);
    let html = String(result);
    html = addLazyLoading(html);
    return html;
}

async function genArticleHTML(article) {
    const prefix = '../../';
    let body = article.body || '';

    const bodyHTML = await renderMarkdown(body);

    const labelsHTML = (article.labels || []).map(l =>
        `<a href="${prefix}categories/${encodeURIComponent(l)}/" class="qx-article-card-label">${l}</a>`
    ).join('\n');

    return `<!DOCTYPE html>
<html lang="zh-CN">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="view-transition" content="same-origin">
    <title>${siteName} - ${article.title}</title>
    <link rel="stylesheet" href="${prefix}css/font-awesome.min.css">
    <link rel="stylesheet" href="${prefix}css/katex.min.css">
    <link rel="stylesheet" href="${prefix}css/default.css">
    ${LOADER_CSS}
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
    ${LOADER_HTML}
    <article class="qx-post">
        <header class="qx-post-header">
            <a href="javascript:history.back()" class="qx-post-back">
                <i class="fa fa-arrow-left"></i> 返回上一页
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

    return `<!DOCTYPE html>
<html lang="zh-CN">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="view-transition" content="same-origin">
    <title>${siteName} - ${label}</title>
    <link rel="stylesheet" href="${prefix}css/font-awesome.min.css">
    <link rel="stylesheet" href="${prefix}css/default.css">
    ${LOADER_CSS}
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
    ${LOADER_HTML}
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
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    });
}

function genCategoriesJSON(allLabels, articles) {
    const categories = allLabels.map(label => ({
        label,
        count: articles.filter(a => (a.labels || []).includes(label)).length,
    }));
    writeJSON(path.join(BLOG_DATA_DIR, 'categories.json'), categories);
}

function genArticlesListHTML(articles) {
    const prefix = '../';

    return `<!DOCTYPE html>
<html lang="zh-CN">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="view-transition" content="same-origin">
    <title>${siteName} - 文章</title>
    <link rel="stylesheet" href="${prefix}css/font-awesome.min.css">
    <link rel="stylesheet" href="${prefix}css/default.css">
    ${LOADER_CSS}
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
    ${LOADER_HTML}
    <section class="qx-page-hero">
        <span class="qx-page-hero-tag">&lt;Articles /&gt;</span>
        <h1 class="qx-page-hero-title">文章</h1>
        <p class="qx-page-hero-sub">共 ${articles.length} 篇文章。</p>
    </section>

    <section class="qx-articles">
        <div class="qx-articles-grid"></div>
        <div class="qx-pagination" id="qxPagination"></div>
    </section>

</body>

</html>`;
}

function genCategoriesListHTML() {
    const prefix = '../';

    return `<!DOCTYPE html>
<html lang="zh-CN">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="view-transition" content="same-origin">
    <title>${siteName} - 分类</title>
    <link rel="stylesheet" href="${prefix}css/font-awesome.min.css">
    <link rel="stylesheet" href="${prefix}css/default.css">
    ${LOADER_CSS}
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
    ${LOADER_HTML}
    <section class="qx-page-hero">
        <span class="qx-page-hero-tag">&lt;Categories /&gt;</span>
        <h1 class="qx-page-hero-title">分类</h1>
        <p class="qx-page-hero-sub">按标签浏览文章。</p>
    </section>

    <section class="qx-categories">
        <div class="qx-categories-list"></div>
    </section>

</body>

</html>`;
}

function genHomeHTML() {
    const indexPath = path.join(ROOT, 'index.html');
    let html = fs.readFileSync(indexPath, 'utf-8');

    // Ensure empty grid and pagination placeholder exist
    html = html.replace(
        /(<div class="qx-articles-grid">)[\s\S]*?(<\/div>\s*\n\s*<div class="qx-pagination")/,
        '$1</div>\n        <div class="qx-pagination"'
    );
    html = html.replace(
        /(<div class="qx-articles-grid">)[\s\S]*?(<\/div>\s*\n\s*<\/section>)/,
        '$1</div>\n        <div class="qx-pagination" id="qxPagination"></div>\n    </section>'
    );

    fs.writeFileSync(indexPath, html, 'utf-8');
}

async function main() {
    const buildCfg = readJSON(BUILD_CONFIG);
    const siteCfg = readJSON(SITE_CONFIG);
    siteName = siteCfg.site?.name || 'QxBlog';
    const timezoneOffset = buildCfg.timezoneOffset || '+08:00';
    const perPage = buildCfg.maxArticlesPerPage || 15;

    // Sync friend links from build config to site config
    const friendLinks = buildCfg.friendLinks || [];
    siteCfg.about = siteCfg.about || {};
    siteCfg.about.friendLinks = friendLinks;
    writeJSON(SITE_CONFIG, siteCfg);

    const issue = {
        title: process.env.ISSUE_TITLE || '',
        body: process.env.ISSUE_BODY || '',
        date: process.env.ISSUE_DATE || new Date().toISOString(),
        author: process.env.ISSUE_AUTHOR || buildCfg.author || 'unknown',
        labels: JSON.parse(process.env.ISSUE_LABELS || '[]'),
        id: parseInt(process.env.ISSUE_ID, 10) || 0,
        action: process.env.ISSUE_ACTION || 'opened',
    };

    const articlesIndex = readJSON(ARTICLES_JSON);

    const hasIssue = !!issue.title.trim();

    if (hasIssue && issue.author !== buildCfg.author) {
        console.log(`Skipped: issue author "${issue.author}" does not match configured author "${buildCfg.author}".`);
        return;
    }

    if (issue.action === 'deleted') {
        const old = articlesIndex[issue.id];
        if (old) {
            const articlePath = path.join(ARTICLES_PAGES_DIR, `${issue.id}.html`);
            if (fs.existsSync(articlePath)) fs.unlinkSync(articlePath);
        }
        delete articlesIndex[issue.id];
    } else if (hasIssue) {
        const slug = slugify(issue.title);
        const localDate = convertToLocal(issue.date, timezoneOffset);

        // Save original markdown with frontmatter
        const markdownDir = path.join(BLOG_DATA_DIR, 'markdown');
        ensureDir(markdownDir);
        const markdownPath = path.join(markdownDir, `${issue.id}.md`);
        const frontmatter = `---
标题：${issue.title}
发布日期：${localDate}
标签：${issue.labels.join(', ')}
作者：${siteCfg.site?.author || issue.author}
文章id：${issue.id}
---

${issue.body || ''}`;
        fs.writeFileSync(markdownPath, frontmatter, 'utf-8');
        console.log(`Saved markdown: blogData/markdown/${issue.id}.md`);

        const article = {
            id: issue.id,
            slug,
            title: issue.title,
            author: siteCfg.site?.author || issue.author,
            date: localDate,
            labels: issue.labels,
            markdownPath: `blogData/markdown/${issue.id}.md`,
        };
        articlesIndex[issue.id] = article;

        // Generate article detail page
        ensureDir(ARTICLES_PAGES_DIR);
        const articleHTML = await genArticleHTML({ ...article, body: issue.body });
        fs.writeFileSync(path.join(ARTICLES_PAGES_DIR, `${issue.id}.html`), articleHTML, 'utf-8');
        console.log(`Generated article: articles/pages/${issue.id}.html`);
    }

    // Save updated blog config
    writeJSON(ARTICLES_JSON, articlesIndex);

    // Collect all articles and labels
    const articles = Object.values(articlesIndex);
    const allLabels = [...new Set(articles.flatMap(a => a.labels || []))].sort();

    // Cleanup legacy paginated data folders from previous versions
    cleanupLegacyPaginationData();

    // Generate categories JSON
    genCategoriesJSON(allLabels, articles);

    // Generate category pages
    allLabels.forEach(label => {
        const catDir = path.join(CATEGORIES_DIR, label);
        ensureDir(catDir);
        const filtered = articles.filter(a => (a.labels || []).includes(label));
        const catHTML = genCategoryHTML(label, filtered.length);
        fs.writeFileSync(path.join(catDir, 'index.html'), catHTML, 'utf-8');
    });
    // Clean up stale category dirs
    if (fs.existsSync(CATEGORIES_DIR)) {
        fs.readdirSync(CATEGORIES_DIR).forEach(entry => {
            if (entry === 'index.html') return;
            if (!allLabels.includes(entry)) {
                const p = path.join(CATEGORIES_DIR, entry);
                if (fs.statSync(p).isDirectory()) fs.rmSync(p, { recursive: true });
            }
        });
    }
    // Generate articles list page
    const articlesListHTML = genArticlesListHTML(articles);
    fs.writeFileSync(path.join(ARTICLES_DIR, 'index.html'), articlesListHTML, 'utf-8');

    // Generate categories list page
    const catListHTML = genCategoriesListHTML();
    fs.writeFileSync(path.join(CATEGORIES_DIR, 'index.html'), catListHTML, 'utf-8');

    // Update home page article cards
    genHomeHTML();

    console.log(`Build complete. ${articles.length} articles, ${allLabels.length} categories, ~${Math.ceil(articles.length / perPage)} pages.`);
}

main();
