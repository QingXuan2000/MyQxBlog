import { QxConfig } from './config.js';
import { QxNav } from './nav.js';
import { QxSearch } from './search.js';
import { QxArticles } from './articles.js';
import { QxCategories } from './categories.js';
import { QxToc } from './toc.js';

QxConfig.renderNav();

document.addEventListener('DOMContentLoaded', async () => {
    const config = new QxConfig();
    await config.load();
    let pageSize;
    const buildRes = await fetch(new URL('../config/buildConfig.json', import.meta.url));
    if (!buildRes.ok) {
        throw new Error('Failed to load config/buildConfig.json');
    }
    const buildCfg = await buildRes.json();
    const size = Number(buildCfg.maxArticlesPerPage);
    if (!Number.isFinite(size) || size <= 0) {
        throw new Error('Invalid maxArticlesPerPage in config/buildConfig.json');
    }
    pageSize = size;

    new QxNav();
    new QxSearch();

    const tocBtn = document.querySelector('.js-toc-toggle');
    if (tocBtn && document.querySelector('.qx-post-body')) {
        new QxToc(tocBtn);
    }

    const pagination = document.getElementById('qxPagination');
    if (pagination) {
        const grid = document.querySelector('.qx-articles-grid');
        const source = pagination.dataset.source;
        const label = source === 'category' ? pagination.dataset.label : null;
        const articles = new QxArticles(grid, pagination, label, pageSize);
        await articles.load(1);
    }

    const catList = document.querySelector('.qx-categories-list');
    if (catList) {
        const categories = new QxCategories(catList);
        await categories.load();
    }

    document.querySelectorAll('.qx-post-body figure[data-rehype-pretty-code-figure]').forEach(figure => {
        const pre = figure.querySelector('pre');
        const code = pre?.querySelector('code');

        const lang = pre?.dataset.language;
        const existingTitle = figure.querySelector('figcaption[data-rehype-pretty-code-title]');
        if (lang && !existingTitle) {
            const label = document.createElement('figcaption');
            label.dataset.rehypePrettyCodeTitle = '';
            label.textContent = lang;
            figure.insertBefore(label, pre);
        }

        const btn = document.createElement('button');
        btn.className = 'qx-code-copy';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Copy code');
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
        btn.title = 'Copy code';
        btn.addEventListener('click', () => {
            const text = code ? code.textContent : pre?.textContent;
            if (text) {
                navigator.clipboard.writeText(text).then(() => {
                    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                    setTimeout(() => {
                        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
                    }, 1500);
                }).catch(() => {});
            }
        });
        figure.appendChild(btn);
    });

    document.querySelectorAll('.qx-post-body table').forEach(table => {
        const wrap = document.createElement('div');
        wrap.className = 'qx-table-wrap';
        table.parentNode.insertBefore(wrap, table);
        wrap.appendChild(table);
    });

    const loader = document.querySelector('.qx-loader');
    if (loader) {
        loader.classList.add('is-hidden');
        loader.addEventListener('transitionend', () => loader.remove());
    }

    const btt = document.createElement('button');
    btt.className = 'qx-btt';
    btt.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>';
    btt.title = 'Back to top';
    btt.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(btt);

    let bttTicking = false;
    window.addEventListener('scroll', () => {
        if (!bttTicking) {
            requestAnimationFrame(() => {
                btt.classList.toggle('is-visible', window.scrollY > 300);
                bttTicking = false;
            });
            bttTicking = true;
        }
    });
});
