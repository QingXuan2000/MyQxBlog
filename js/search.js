const DATA_URL = new URL('../blogData/articles.json', import.meta.url).href;
const PAGE_HREF = new URL('../articles/pages/', import.meta.url).href;

export class QxSearch {
    constructor() {
        this.form = document.querySelector('.qx-nav-search');
        this.input = document.querySelector('.qx-nav-search-input');
        this.articles = null;
        this.dropdown = null;
        this.selectedIdx = -1;
        this._createDropdown();
        this._bindEvents();
    }

    async _loadIndex() {
        if (this.articles) return;
        try {
            const res = await fetch(DATA_URL);
            const index = await res.json();
            this.articles = Object.values(index);
        } catch (_) {
            this.articles = [];
        }
    }

    _createDropdown() {
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'qx-search-results';
        this.form.appendChild(this.dropdown);
    }

    _bindEvents() {
        this.input.addEventListener('input', () => this._search());
        this.input.addEventListener('keydown', (e) => this._onKeydown(e));
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this._goToSelected();
        });
        document.addEventListener('click', (e) => {
            if (!this.form.contains(e.target)) {
                this._clear();
            }
        });
    }

    async _search() {
        const q = this.input.value.trim().toLowerCase();
        this.selectedIdx = -1;
        if (!q) {
            this._clear();
            return;
        }
        await this._loadIndex();
        const results = this.articles.filter(a =>
            a.title.toLowerCase().includes(q) ||
            (a.labels || []).some(l => l.toLowerCase().includes(q)) ||
            (a.bodyText || '').toLowerCase().includes(q)
        );
        this._renderResults(results);
    }

    _renderResults(results) {
        if (!results.length) {
            this.dropdown.innerHTML = '<div class="qx-search-empty">无结果</div>';
        } else {
            const q = this.input.value.trim();
            this.dropdown.innerHTML = results.map((a, i) => {
                const href = `${PAGE_HREF}${a.id}.html`;
                const date = this._formatDate(a.date);
                const excerpt = this._excerpt(a.bodyText || '', q);
                const excerptHTML = excerpt ? `<span class="qx-search-item-excerpt">${excerpt}</span>` : '';
                return `<a href="${href}" class="qx-search-item" data-idx="${i}">
                    <span class="qx-search-item-row">
                        <span class="qx-search-item-title">${this._highlight(a.title)}</span>
                        <span class="qx-search-item-date">${date}</span>
                    </span>
                    ${excerptHTML}
                </a>`;
            }).join('');
        }
        this.dropdown.classList.add('is-visible');
    }

    _excerpt(text, q) {
        if (!text) return '';
        const len = 60;
        const idx = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
        let snippet;
        if (idx !== -1) {
            const start = Math.max(0, idx - len);
            const end = Math.min(text.length, idx + q.length + len);
            snippet = text.slice(start, end);
            if (start > 0) snippet = '…' + snippet;
            if (end < text.length) snippet += '…';
        } else {
            snippet = text.slice(0, len * 2);
            if (text.length > len * 2) snippet += '…';
        }
        return q ? this._highlight(snippet) : snippet;
    }

    _highlight(text) {
        const q = this.input.value.trim();
        if (!q) return text;
        const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(re, '<mark>$1</mark>');
    }

    _formatDate(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}/${m}/${day}`;
    }

    _onKeydown(e) {
        const items = this.dropdown.querySelectorAll('.qx-search-item');
        if (!items.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIdx = Math.min(this.selectedIdx + 1, items.length - 1);
            this._updateSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIdx = Math.max(this.selectedIdx - 1, 0);
            this._updateSelection(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this._goToSelected(items);
        } else if (e.key === 'Escape') {
            this._clear();
        }
    }

    _updateSelection(items) {
        items.forEach((el, i) => el.classList.toggle('is-selected', i === this.selectedIdx));
    }

    _goToSelected(items) {
        if (this.selectedIdx >= 0 && items) {
            items[this.selectedIdx].click();
        }
    }

    _clear() {
        this.dropdown.classList.remove('is-visible');
        this.dropdown.innerHTML = '';
        this.selectedIdx = -1;
    }
}
