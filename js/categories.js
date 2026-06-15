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
        this.container.innerHTML = categories.map(cat => {
            const slug = cat.slug || encodeURIComponent(cat.name);
            const href = new URL(`categories/${slug}/`, ROOT).pathname;
            return `<a href="${href}" class="qx-tag-item">
                <span class="qx-tag-name">${cat.name}</span>
                <span class="qx-tag-count">${cat.count}</span>
            </a>`;
        }).join('\n');
    }
}
