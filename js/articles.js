const ROOT = new URL('..', import.meta.url).href;
const BLOG_ARTICLES = new URL('../blogData/articles.json', import.meta.url).href;

export class QxArticles {
    constructor(container, paginationEl, label, pageSize) {
        this.container = container;
        this.paginationEl = paginationEl;
        this.label = label;
        this.currentPage = 1;
        this.totalPages = 1;
        this.totalItems = 0;
        if (!Number.isFinite(pageSize) || pageSize <= 0) {
            throw new Error('Invalid maxArticlesPerPage: please set a positive number in config/buildConfig.json');
        }
        this.pageSize = pageSize;
        this.allArticles = [];
    }

    async _loadAllArticles() {
        if (this.allArticles.length > 0) return this.allArticles;
        const res = await fetch(BLOG_ARTICLES);
        if (!res.ok) return [];
        const data = await res.json();
        const list = Array.isArray(data) ? data : Object.values(data || {});
        this.allArticles = list.sort((a, b) => new Date(b.date) - new Date(a.date));
        return this.allArticles;
    }

    _filterByLabel(articles) {
        if (!this.label) return articles;
        return articles.filter(a => Array.isArray(a.labels) && a.labels.includes(this.label));
    }

    _slicePage(articles, page) {
        const total = articles.length;
        this.totalPages = Math.max(1, Math.ceil(total / this.pageSize));
        this.currentPage = Math.min(Math.max(1, page), this.totalPages);
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        return articles.slice(start, end);
    }

    async load(page = 1) {
        const all = await this._loadAllArticles();
        const filtered = this._filterByLabel(all);
        this.totalItems = filtered.length;
        const pageArticles = this._slicePage(filtered, page);
        this._render(pageArticles);
        this._renderHeroSub();
        this._renderPagination();
    }

    _render(articles) {
        this.container.innerHTML = articles.map(a => {
            const labelsHTML = (a.labels || []).map(l => {
                const href = new URL(`categories/${encodeURIComponent(l)}/`, ROOT).pathname;
                return `<a href="${href}" class="qx-article-card-label">${l}</a>`;
            }).join('\n');
            const href = new URL(`posts/${a.id}.html`, ROOT).pathname;
            return `<a href="${href}" class="qx-article-card">
                <div class="qx-article-card-date">${a.date}</div>
                <div class="qx-article-card-title">${a.title}</div>
                <div class="qx-article-card-labels">${labelsHTML}</div>
            </a>`;
        }).join('\n');
    }

    _renderPagination() {
        if (!this.paginationEl) return;
        if (this.totalPages <= 1) {
            this.paginationEl.style.display = 'none';
            return;
        }
        this.paginationEl.style.display = '';

        const isFirst = this.currentPage === 1;
        const isLast = this.currentPage === this.totalPages;

        const prevDisabled = isFirst ? ' disabled' : '';
        let row = `<button class="qx-pagination-nav${prevDisabled}" data-page="${this.currentPage - 1}"${isFirst ? ' disabled' : ''}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg></button>`;

        const pages = this._buildPages();
        for (const p of pages) {
            if (p === -1) {
                row += '<span class="qx-pagination-ellipsis">&hellip;</span>';
            } else {
                const cls = p === this.currentPage ? ' is-active' : '';
                row += `<button class="qx-pagination-btn${cls}" data-page="${p}">${p}</button>`;
            }
        }

        const nextDisabled = isLast ? ' disabled' : '';
        row += `<button class="qx-pagination-nav${nextDisabled}" data-page="${this.currentPage + 1}"${isLast ? ' disabled' : ''}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></button>`;

        const jump = `<span class="qx-pagination-jump"><input type="number" class="qx-pagination-input" min="1" max="${this.totalPages}" placeholder="${this.currentPage}"><button class="qx-pagination-go">GO</button></span>`;

        this.paginationEl.innerHTML = `<div class="qx-pagination-row">${row}</div><div class="qx-pagination-row">${jump}</div>`;

        const go = (p) => {
            if (p >= 1 && p <= this.totalPages) {
                this.load(p);
                const articles = document.querySelector('.qx-articles');
                if (articles) {
                    articles.scrollIntoView({ behavior: 'smooth' });
                } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }
        };

        const input = this.paginationEl.querySelector('.qx-pagination-input');
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') go(parseInt(input.value, 10));
        });
        this.paginationEl.querySelector('.qx-pagination-go').addEventListener('click', () => {
            go(parseInt(input.value, 10));
        });

        this.paginationEl.querySelectorAll('.qx-pagination-btn, .qx-pagination-nav').forEach(btn => {
            btn.addEventListener('click', () => go(parseInt(btn.dataset.page, 10)));
        });
    }

    _renderHeroSub() {
        const sub = document.querySelector('.qx-page-hero-sub');
        if (!sub) return;
        sub.textContent = `共 ${this.totalItems} 篇文章`;
    }

    _buildPages() {
        const total = this.totalPages;
        const cur = this.currentPage;
        if (total <= 10) {
            return Array.from({ length: total }, (_, i) => i + 1);
        }
        const pages = [1];
        const start = Math.max(2, cur - 2);
        const end = Math.min(total - 1, cur + 2);
        if (start > 2) pages.push(-1);
        for (let p = start; p <= end; p++) pages.push(p);
        if (end < total - 1) pages.push(-1);
        pages.push(total);
        return pages;
    }
}
