const fs = require('fs');
const path = require('path');
const featherdown = require('featherdown');

const ROOT = path.resolve(__dirname, '../..');
const ARTICLES_JSON = path.join(ROOT, 'blogData', 'articles.json');
const BUILD_CONFIG = path.join(ROOT, 'config', 'buildConfig.json');
const SITE_CONFIG = path.join(ROOT, 'config', 'siteConfig.json');
const BLOG_DATA_DIR = path.join(ROOT, 'blogData');
const ARTICLES_DIR = path.join(ROOT, 'articles');
const ARTICLES_PAGES_DIR = path.join(ARTICLES_DIR, 'pages');
const CATEGORIES_DIR = path.join(ROOT, 'categories');

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

async function genArticleHTML(article) {
    const prefix = '../../';
    const bodyHTML = (await featherdown.renderMarkdown(article.body || '')).html;
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
    <link rel="stylesheet" href="${prefix}css/default.css">
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

function genCategoryJSON(label, articles, perPage) {
    const filtered = articles
        .filter(a => (a.labels || []).includes(label))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    const totalPages = Math.ceil(filtered.length / perPage) || 1;

    const catDir = path.join(BLOG_DATA_DIR, 'categories', label);
    if (filtered.length === 0) {
        if (fs.existsSync(catDir)) fs.rmSync(catDir, { recursive: true });
        return;
    }

    for (let p = 1; p <= totalPages; p++) {
        const slice = filtered.slice((p - 1) * perPage, p * perPage);
        writeJSON(path.join(catDir, `${p}.json`), {
            label,
            page: p,
            totalPages,
            articles: slice.map(a => ({
                id: a.id,
                slug: a.slug,
                title: a.title,
                author: a.author,
                date: formatDate(a.date),
                labels: a.labels,
            })),
        });
    }
    // Clean up stale page files
    let p = totalPages + 1;
    while (fs.existsSync(path.join(catDir, `${p}.json`))) {
        fs.unlinkSync(path.join(catDir, `${p}.json`));
        p++;
    }
}

function genPaginatedJSON(articles, perPage) {
    const sorted = articles.sort((a, b) => new Date(b.date) - new Date(a.date));
    const totalPages = Math.ceil(sorted.length / perPage) || 1;

    if (sorted.length === 0) {
        // Remove all existing page files when there are no articles
        const pagesDir = path.join(BLOG_DATA_DIR, 'articles');
        if (fs.existsSync(pagesDir)) {
            fs.readdirSync(pagesDir).forEach(f => {
                if (/^\d+\.json$/.test(f)) fs.unlinkSync(path.join(pagesDir, f));
            });
        }
        return;
    }

    for (let p = 1; p <= totalPages; p++) {
        const slice = sorted.slice((p - 1) * perPage, p * perPage);
        const pageData = {
            page: p,
            totalPages,
            articles: slice.map(a => ({
                id: a.id,
                slug: a.slug,
                title: a.title,
                author: a.author,
                date: formatDate(a.date),
                labels: a.labels,
            })),
        };
        writeJSON(path.join(BLOG_DATA_DIR, 'articles', `${p}.json`), pageData);
    }
    // Clean up stale page files
    let p = totalPages + 1;
    while (fs.existsSync(path.join(BLOG_DATA_DIR, 'articles', `${p}.json`))) {
        fs.unlinkSync(path.join(BLOG_DATA_DIR, 'articles', `${p}.json`));
        p++;
    }
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
    const searchBodyLength = buildCfg.searchBodyLength ?? 0;

    // Sync friend links from build config to site config
    if (buildCfg.friendLinks) {
        siteCfg.about = siteCfg.about || {};
        siteCfg.about.friendLinks = buildCfg.friendLinks;
        writeJSON(SITE_CONFIG, siteCfg);
    }

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

        let bodyText = '';
        if (searchBodyLength !== 0) {
            bodyText = stripMarkdown(issue.body || '');
            if (searchBodyLength > 0) {
                bodyText = bodyText.slice(0, searchBodyLength);
            }
        }

        const article = {
            id: issue.id,
            slug,
            title: issue.title,
            author: siteCfg.site?.author || issue.author,
            date: localDate,
            labels: issue.labels,
            bodyText,
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

    // Generate paginated JSON files
    genPaginatedJSON(articles, perPage);

    // Generate categories JSON
    genCategoriesJSON(allLabels, articles);

    // Generate category pages
    allLabels.forEach(label => {
        const catDir = path.join(CATEGORIES_DIR, label);
        ensureDir(catDir);
        const filtered = articles.filter(a => (a.labels || []).includes(label));
        const catHTML = genCategoryHTML(label, filtered.length);
        fs.writeFileSync(path.join(catDir, 'index.html'), catHTML, 'utf-8');
        genCategoryJSON(label, articles, perPage);
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
    // Clean up stale category JSON dirs
    const catDataDir = path.join(BLOG_DATA_DIR, 'categories');
    if (fs.existsSync(catDataDir)) {
        fs.readdirSync(catDataDir).forEach(entry => {
            if (!allLabels.includes(entry)) {
                const p = path.join(catDataDir, entry);
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
