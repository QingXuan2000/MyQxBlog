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
        const articles = new QxArticles(grid, pagination, label);
        await articles.load(1);
    }

    const catList = document.querySelector('.qx-categories-list');
    if (catList) {
        const categories = new QxCategories(catList);
        await categories.load();
    }

    document.querySelectorAll('.qx-post-body pre').forEach(pre => {
        const btn = document.createElement('button');
        btn.className = 'qx-code-copy';
        btn.innerHTML = '<i class="fa fa-clipboard"></i>';
        btn.title = '复制代码';
        btn.addEventListener('click', () => {
            const code = pre.querySelector('code');
            const text = code ? code.textContent : pre.textContent;
            navigator.clipboard.writeText(text).then(() => {
                btn.innerHTML = '<i class="fa fa-check"></i>';
                setTimeout(() => { btn.innerHTML = '<i class="fa fa-clipboard"></i>'; }, 1500);
            }).catch(() => {});
        });
        pre.appendChild(btn);
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

    // Back to top button
    const btt = document.createElement('button');
    btt.className = 'qx-btt';
    btt.innerHTML = '<i class="fa fa-arrow-up"></i>';
    btt.title = '返回顶部';
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