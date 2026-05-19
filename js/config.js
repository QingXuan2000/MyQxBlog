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
                        <svg class="qx-sidebar-avatar-geo" viewBox="0 0 620 620" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <polygon class="qx-sidebar-avatar-outer"
                                     points="570,310 440,535 180,535 50,310 180,85 440,85"/>
                            <polygon class="qx-sidebar-avatar-inner"
                                     points="440,385 310,460 180,385 180,235 310,160 440,235"/>
                            <circle cx="570" cy="310" r="4" class="qx-sidebar-avatar-dot"/>
                            <circle cx="440" cy="535" r="4" class="qx-sidebar-avatar-dot"/>
                            <circle cx="180" cy="535" r="4" class="qx-sidebar-avatar-dot"/>
                            <circle cx="50" cy="310" r="4" class="qx-sidebar-avatar-dot"/>
                            <circle cx="180" cy="85" r="4" class="qx-sidebar-avatar-dot"/>
                            <circle cx="440" cy="85" r="4" class="qx-sidebar-avatar-dot"/>
                            <circle cx="440" cy="385" r="2.5" class="qx-sidebar-avatar-idot"/>
                            <circle cx="310" cy="460" r="2.5" class="qx-sidebar-avatar-idot"/>
                            <circle cx="180" cy="385" r="2.5" class="qx-sidebar-avatar-idot"/>
                            <circle cx="180" cy="235" r="2.5" class="qx-sidebar-avatar-idot"/>
                            <circle cx="310" cy="160" r="2.5" class="qx-sidebar-avatar-idot"/>
                            <circle cx="440" cy="235" r="2.5" class="qx-sidebar-avatar-idot"/>
                        </svg>
                        <img class="qx-sidebar-avatar-img" src="${ROOT}img/Avatar.png" alt="头像">
                    </div>
                    <p class="qx-sidebar-name">${d.site.author}</p>
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
                <p class="qx-footer-text">Copyright &copy; ${year} ${d.site.author}. All Rights Reserved.</p>
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
        const dotDelays = ['0s', '.5s', '1s', '1.5s', '2s', '2.5s'];
        const outerDots = [
            [570, 310], [440, 535], [180, 535],
            [50, 310], [180, 85], [440, 85]
        ];
        const innerDots = [
            [440, 385], [310, 460], [180, 385],
            [180, 235], [310, 160], [440, 235]
        ];
        const radialLines = outerDots.map(
            ([x, y]) => `<line class="qx-loader-radial" x1="310" y1="310" x2="${x}" y2="${y}"/>`
        ).join('');
        const dotsHTML = outerDots.map(
            ([x, y], i) => `<circle class="qx-loader-dot" cx="${x}" cy="${y}" r="5.5" style="animation-delay:${dotDelays[i]}"/>`
        ).join('');
        const innerDotsHTML = innerDots.map(
            ([x, y]) => `<circle class="qx-loader-idot" cx="${x}" cy="${y}" r="3.2"/>`
        ).join('');

        const html = `
            <div class="qx-loader">
                <svg class="qx-loader-geo" viewBox="0 0 620 620" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g class="qx-loader-orbit-wrap">
                        <ellipse class="qx-loader-orbit" cx="310" cy="310" rx="230" ry="85"
                                 stroke-width="2.5" opacity="0.22"
                                 transform="rotate(-18, 310, 310)"/>
                    </g>
                    <g class="qx-loader-orbit-wrap">
                        <ellipse class="qx-loader-orbit" cx="310" cy="310" rx="170" ry="120"
                                 stroke-width="2.2" opacity="0.16"
                                 transform="rotate(28, 310, 310)"/>
                    </g>
                    ${radialLines}
                    <polygon class="qx-loader-outer"
                             points="570,310 440,535 180,535 50,310 180,85 440,85"/>
                    <polygon class="qx-loader-inner"
                             points="440,385 310,460 180,385 180,235 310,160 440,235"/>
                    ${dotsHTML}
                    ${innerDotsHTML}
                    <circle class="qx-loader-core" cx="310" cy="310" r="8"/>
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
                            <polygon points="570,310 440,535 180,535 50,310 180,85 440,85" stroke="currentColor" stroke-width="18" stroke-linejoin="round"/>
                            <polygon points="440,385 310,460 180,385 180,235 310,160 440,235" stroke="currentColor" stroke-width="8" opacity="0.4" stroke-linejoin="round"/>
                            <circle cx="310" cy="310" r="10" fill="currentColor"/>
                            <circle cx="570" cy="310" r="6" fill="currentColor" opacity="0.5"/>
                            <circle cx="440" cy="535" r="6" fill="currentColor" opacity="0.5"/>
                            <circle cx="180" cy="535" r="6" fill="currentColor" opacity="0.5"/>
                            <circle cx="50" cy="310" r="6" fill="currentColor" opacity="0.5"/>
                            <circle cx="180" cy="85" r="6" fill="currentColor" opacity="0.5"/>
                            <circle cx="440" cy="85" r="6" fill="currentColor" opacity="0.5"/>
                            <circle cx="440" cy="385" r="4" fill="currentColor" opacity="0.3"/>
                            <circle cx="310" cy="460" r="4" fill="currentColor" opacity="0.3"/>
                            <circle cx="180" cy="385" r="4" fill="currentColor" opacity="0.3"/>
                            <circle cx="180" cy="235" r="4" fill="currentColor" opacity="0.3"/>
                            <circle cx="310" cy="160" r="4" fill="currentColor" opacity="0.3"/>
                            <circle cx="440" cy="235" r="4" fill="currentColor" opacity="0.3"/>
                        </svg>
                    </a>
                    <span class="qx-nav-brand"></span>
                    <div class="qx-nav-actions">
                        <button class="qx-nav-btn js-search-toggle" title="搜索">
                            <i class="fa fa-search"></i>
                        </button>
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
                <form class="qx-nav-search" action="#" onsubmit="return false;">
                    <div class="qx-nav-search-row">
                        <input class="qx-nav-search-input" type="text" placeholder="搜索...">
                        <button class="qx-nav-search-submit" type="submit">
                            <i class="fa fa-search"></i>
                        </button>
                    </div>
                </form>
            </header>`;
        document.body.insertAdjacentHTML('afterbegin', html);
    }
}
