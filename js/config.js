const ROOT = new URL('..', import.meta.url).href;

export class QxConfig {
    constructor() {
        this.data = null;
    }

    async load() {
        const url = new URL('../config/siteConfig.json', import.meta.url);
        const res = await fetch(url);
        this.data = await res.json();
        this._apply();
        return this.data;
    }

    _apply() {
        const d = this.data;

        if (document.querySelector('.qx-hero')) {
            document.title = `${d.site.title} - 首页`;
            const tag = document.querySelector('.qx-hero-tag');
            if (tag) tag.textContent = d.hero.tag;
            const title = document.querySelector('.qx-hero-title');
            if (title) title.textContent = d.hero.title;
            const sub = document.querySelector('.qx-hero-sub');
            if (sub) sub.textContent = d.hero.subtitle;
        }

        const brand = document.querySelector('.qx-nav-brand');
        if (brand) brand.textContent = d.site.name;

        this._renderSidebar(d);
        this._renderFooter(d);
        this._renderAbout(d);
    }

    _resolve(href) {
        return new URL(href, ROOT).href;
    }

    _renderSidebar(d) {
        const linksHTML = d.sidebar.links.map(l =>
            `<a href="${this._resolve(l.href)}" class="qx-sidebar-link">${l.text}</a>`
        ).join('');

        const html = `
            <aside class="qx-sidebar">
                <div class="qx-sidebar-inner">
                    <div class="qx-sidebar-avatar">
                        <svg class="qx-sidebar-avatar-rings" viewBox="0 0 620 620" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="310" cy="310" r="250" class="qx-sidebar-avatar-ring"/>
                            <circle cx="310" cy="310" r="300" class="qx-sidebar-avatar-ring"/>
                        </svg>
                        <img class="qx-sidebar-avatar-img" src="${ROOT}img/Avatar.png" alt="头像">
                    </div>
                    <p class="qx-sidebar-name">${d.sidebar.name}</p>
                    <p class="qx-sidebar-motto">${d.sidebar.motto}</p>
                    <nav class="qx-sidebar-nav">${linksHTML}</nav>
                </div>
            </aside>`;
        document.body.insertAdjacentHTML('beforeend', html);
    }

    _renderFooter(d) {
        const start = new Date(d.site.siteCreatedAt).getFullYear();
        const now = new Date().getFullYear();
        const year = start === now ? `${start}` : `${start}-${now}`;
        const html = `
            <footer class="qx-footer">
                <p class="qx-footer-text">Copyright &copy; ${year} ${d.footer.copyright}. All Rights Reserved.</p>
            </footer>`;
        document.body.insertAdjacentHTML('beforeend', html);
    }

    _renderAbout(d) {
        const container = document.querySelector('.qx-about');
        if (!container) return;

        const sectionsHTML = d.about.sections.map(s =>
            `<div class="qx-about-section">
                <h2 class="qx-about-head">${s.head}</h2>
                <p class="qx-about-text">${s.text}</p>
            </div>`
        ).join('');

        const friendsHTML = d.about.friendLinks.map(f =>
            `<a href="${f.url}" class="qx-friend-link" target="_blank" rel="noopener">${f.name}</a>`
        ).join('');

        container.innerHTML = sectionsHTML + `
            <div class="qx-about-section">
                <h2 class="qx-about-head">友情链接</h2>
                <div class="qx-friend-links">${friendsHTML}</div>
            </div>`;
    }

    static renderLoader() {
        const html = `
            <div class="qx-loader">
                <svg class="qx-loader-rings" viewBox="0 0 620 620" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="310" cy="310" r="250" class="qx-loader-ring"/>
                    <circle cx="310" cy="310" r="300" class="qx-loader-ring"/>
                </svg>
            </div>`;
        document.body.insertAdjacentHTML('afterbegin', html);
    }

    static renderNav() {
        const logoHref = new URL('index.html', ROOT).href;
        const html = `
            <header class="qx-header">
                <nav class="qx-nav">
                    <a href="${logoHref}" class="qx-nav-logo">
                        <svg class="qx-nav-logo-svg" width="32" height="32" viewBox="0 0 620 620" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="310" cy="310" r="250" stroke="currentColor" stroke-width="20" stroke-linejoin="round" stroke-linecap="round"/>
                            <circle cx="310" cy="310" r="300" stroke="currentColor" stroke-width="20" stroke-linejoin="round" stroke-linecap="round"/>
                            <path d="M315 70L315 550" stroke="currentColor" stroke-width="20" stroke-linejoin="round" stroke-linecap="round"/>
                            <line x1="124" y1="213" x2="264" y2="213" stroke="currentColor" stroke-width="20" stroke-linejoin="round" stroke-linecap="round"/>
                            <line x1="104" y1="310" x2="284" y2="310" stroke="currentColor" stroke-width="20" stroke-linejoin="round" stroke-linecap="round"/>
                            <line x1="124" y1="407" x2="264" y2="407" stroke="currentColor" stroke-width="20" stroke-linejoin="round" stroke-linecap="round"/>
                            <line x1="365" y1="115" x2="365" y2="245" stroke="currentColor" stroke-width="20" stroke-linejoin="round" stroke-linecap="round"/>
                            <line x1="365" y1="286" x2="365" y2="386" stroke="currentColor" stroke-width="20" stroke-linejoin="round" stroke-linecap="round"/>
                            <line x1="365" y1="427" x2="365" y2="507" stroke="currentColor" stroke-width="20" stroke-linejoin="round" stroke-linecap="round"/>
                            <line x1="423" y1="490" x2="423" y2="380" stroke="currentColor" stroke-width="20" stroke-linejoin="round" stroke-linecap="round"/>
                            <line x1="474" y1="440" x2="474" y2="330" stroke="currentColor" stroke-width="20" stroke-linejoin="round" stroke-linecap="round"/>
                            <line x1="423" y1="345" x2="423" y2="255" stroke="currentColor" stroke-width="20" stroke-linejoin="round" stroke-linecap="round"/>
                            <line x1="423" y1="220" x2="423" y2="140" stroke="currentColor" stroke-width="20" stroke-linejoin="round" stroke-linecap="round"/>
                            <line x1="474" y1="285" x2="474" y2="205" stroke="currentColor" stroke-width="20" stroke-linejoin="round" stroke-linecap="round"/>
                        </svg>
                    </a>
                    <span class="qx-nav-brand"></span>
                    <div class="qx-nav-actions">
                        <button class="qx-nav-btn js-theme-toggle" title="切换主题">
                            <i class="fa fa-sun-o"></i>
                        </button>
                        <button class="qx-nav-btn js-toc-toggle" title="文章目录" style="display:none">
                            <i class="fa fa-list-ul"></i>
                        </button>
                        <button class="qx-nav-btn js-sidebar-toggle" title="侧边栏">
                            <i class="fa fa-bars"></i>
                        </button>
                    </div>
                </nav>
            </header>`;
        document.body.insertAdjacentHTML('afterbegin', html);
    }
}
