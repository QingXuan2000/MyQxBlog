const ROOT = new URL('..', import.meta.url).href;
const TAGS_URL = new URL('../blogData/tags.json', import.meta.url).href;

export class QxTags {
    constructor(container) {
        this.container = container;
    }

    async load() {
        const res = await fetch(TAGS_URL);
        if (!res.ok) return;
        const data = await res.json();
        this._render(data);
    }

    _render(tags) {
        this.container.innerHTML = tags.map(tag => {
            const slug = tag.slug || encodeURIComponent(tag.label);
            const href = new URL(`tags/${slug}/`, ROOT).pathname;
            return `<a href="${href}" class="qx-tag-item">
                <span class="qx-tag-name">${tag.label}</span>
                <span class="qx-tag-count">${tag.count}</span>
            </a>`;
        }).join('\n');
    }
}
