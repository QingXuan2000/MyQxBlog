const ROOT = new URL('..', import.meta.url).href;
const BLOG_ARTICLES = new URL('../blogData/articles.json', import.meta.url).href;

export class QxArchive {
    constructor(container) {
        this.container = container;
    }

    async load() {
        const res = await fetch(BLOG_ARTICLES);
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : Object.values(data || {});
        const sorted = list.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
        const groups = this._groupByYear(sorted);
        this._render(groups, sorted.length);
    }

    _groupByYear(articles) {
        const map = new Map();
        for (const a of articles) {
            const year = new Date(a.date).getFullYear();
            if (!map.has(year)) map.set(year, []);
            map.get(year).push(a);
        }
        return map;
    }

    _formatDisplayDate(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${m}-${day}`;
    }

    _render(groups, total) {
        const years = Array.from(groups.keys()).sort((a, b) => b - a);
        const parts = years.map(year => {
            const items = groups.get(year);
            const list = items.map(a => {
                const href = new URL(`posts/${a.id}.html`, ROOT).pathname;
                const date = this._formatDisplayDate(a.date);
                let categoryTag = '';
                if (a.category) {
                    const categorySlug = a.categorySlug || encodeURIComponent(a.category);
                    const categoryHref = new URL(`categories/${categorySlug}/`, ROOT).pathname;
                    categoryTag = `<a href="${categoryHref}" class="qx-article-card-label qx-category-label">${a.category}</a>`;
                }
                return `<li class="qx-archive-item">
                    <time class="qx-archive-date">${date}</time>
                    <a href="${href}" class="qx-archive-link">${a.title}</a>
                    <div class="qx-archive-tags">${categoryTag}</div>
                </li>`;
            }).join('\n');
            return `<section class="qx-archive-year">
                <h2 class="qx-archive-year-title">${year} <span class="qx-archive-year-count">${items.length}</span></h2>
                <ul class="qx-archive-items">${list}</ul>
            </section>`;
        });
        this.container.innerHTML = parts.join('\n');

        const sub = document.querySelector('.qx-page-hero-sub');
        if (sub) sub.textContent = `共 ${total} 篇文章`;
    }
}
