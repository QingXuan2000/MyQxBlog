const ROOT = new URL('..', import.meta.url).href;

const LOGO_SVG = `<polygon points="570,310 440,535 180,535 50,310 180,85 440,85" stroke="currentColor" stroke-width="18" stroke-linejoin="round"/>
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
<circle cx="440" cy="235" r="4" fill="currentColor" opacity="0.3"/>`;

const SIDEBAR_AVATAR_GEO = `<polygon class="qx-sidebar-avatar-outer"
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
<circle cx="440" cy="235" r="2.5" class="qx-sidebar-avatar-idot"/>`;

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
                            ${SIDEBAR_AVATAR_GEO}
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
        const footerContent = d.footerContent || [];
        
        if (footerContent.length === 0) {
            return;
        }
        
        const itemsHTML = footerContent.map(item => `<p class="qx-footer-item">${item}</p>`).join('');
        
        const html = `
            <footer class="qx-footer">
                ${itemsHTML}
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

    static renderNav() {
        const logoHref = new URL('index.html', ROOT).href;
        const logoLightSrc = `${ROOT}img/logo/light.svg`;
        const logoDarkSrc = `${ROOT}img/logo/dark.svg`;
        const html = `
            <header class="qx-header">
                <nav class="qx-nav">
                    <a href="${logoHref}" class="qx-nav-logo">
                        <img class="qx-nav-logo-img qx-nav-logo-light" src="${logoLightSrc}" alt="Logo">
                        <img class="qx-nav-logo-img qx-nav-logo-dark" src="${logoDarkSrc}" alt="Logo">
                    </a>
                    <span class="qx-nav-brand"></span>
                    <div class="qx-nav-actions">
                        <button class="qx-nav-btn js-search-toggle" title="搜索">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </button>
                        <button class="qx-nav-btn js-theme-toggle" title="切换主题">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                        </button>
                        <button class="qx-nav-btn js-toc-toggle" title="文章目录" style="display:none">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                        </button>
                        <button class="qx-nav-btn js-sidebar-toggle" title="侧边栏">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                        </button>
                    </div>
                </nav>
                <form class="qx-nav-search" action="#" onsubmit="return false;">
                    <div class="qx-nav-search-row">
                        <input class="qx-nav-search-input" type="text" placeholder="搜索...">
                    </div>
                </form>
            </header>`;
        document.body.insertAdjacentHTML('afterbegin', html);
    }
}
