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
            const date = new Date(a.date);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            if (!map.has(year)) map.set(year, new Map());
            if (!map.get(year).has(month)) map.get(year).set(month, []);
            map.get(year).get(month).push(a);
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
        const yearParts = years.map(year => {
            const monthsMap = groups.get(year);
            const months = Array.from(monthsMap.keys()).sort((a, b) => b - a);
            const monthParts = months.map(month => {
                const items = monthsMap.get(month);
                const monthName = `${String(month).padStart(2, '0')} 月`;
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
                return `<section class="qx-archive-month">
                    <h3 class="qx-archive-month-title">${monthName} <span class="qx-archive-month-count">${items.length}</span></h3>
                    <ul class="qx-archive-items">${list}</ul>
                </section>`;
            });
            return `<section class="qx-archive-year">
                <h2 class="qx-archive-year-title">${year} <span class="qx-archive-year-count">${this._getYearCount(monthsMap)}</span></h2>
                ${monthParts.join('\n')}
            </section>`;
        });
        this.container.innerHTML = yearParts.join('\n');

        const sub = document.querySelector('.qx-page-hero-sub');
        if (sub) sub.textContent = `共 ${total} 篇文章`;
    }

    _getYearCount(monthsMap) {
        let count = 0;
        for (const items of monthsMap.values()) {
            count += items.length;
        }
        return count;
    }
}
