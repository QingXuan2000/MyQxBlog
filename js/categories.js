const ROOT = new URL('..', import.meta.url).href;
const CATEGORIES_URL = new URL('../blogData/categories.json', import.meta.url).href;

export class QxCategories {
    constructor(container) {
        this.container = container;
    }

    async load() {
        const res = await fetch(CATEGORIES_URL);
        if (!res.ok) return;
        const data = await res.json();
        this._render(data);
    }

    _render(categories) {
        this.container.innerHTML = categories.map(c => {
            const href = new URL(`categories/${encodeURIComponent(c.label)}/`, ROOT).pathname;
            return `<a href="${href}" class="qx-category-item">
                <span class="qx-category-name">${c.label}</span>
                <span class="qx-category-count">${c.count}</span>
            </a>`;
        }).join('\n');
    }
}
