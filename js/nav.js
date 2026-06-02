export class QxNav {
    constructor() {
        this.sidebar = document.querySelector('.qx-sidebar');
        this.sidebarBtn = document.querySelector('.js-sidebar-toggle');
        this.themeBtn = document.querySelector('.js-theme-toggle');
        this.searchBtn = document.querySelector('.js-search-toggle');
        this.searchForm = document.querySelector('.qx-nav-search');
        this.searchInput = document.querySelector('.qx-nav-search-input');
        this.html = document.documentElement;
        this._sidebarCloseTimer = null;
        this._searchCloseTimer = null;

        this._detectTheme();
        this._initSidebarToggle();
        this._initThemeToggle();
        this._initSearchToggle();
    }

    _detectTheme() {
        const saved = localStorage.getItem('qx-theme');
        this._applyTheme(saved || this.html.getAttribute('data-theme') || 'light');
    }

    _applyTheme(theme) {
        this.html.setAttribute('data-theme', theme);
        if (this.themeBtn) {
            const svg = this.themeBtn.querySelector('svg');
            if (svg) {
                svg.outerHTML = theme === 'dark' 
                    ? '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>'
                    : '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
            }
        }
    }

    _initSidebarToggle() {
        if (this.sidebarBtn && this.sidebar) {
            this.sidebarBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSidebar();
            });
            document.addEventListener('click', (e) => {
                if (!this.sidebar.classList.contains('is-open')) return;
                if (!this.sidebar.contains(e.target) && !this.sidebarBtn.contains(e.target)) {
                    this.closeSidebar();
                }
            });
        }
    }

    _initThemeToggle() {
        if (this.themeBtn) {
            this.themeBtn.addEventListener('click', () => this.toggleTheme());
        }
    }

    _initSearchToggle() {
        if (this.searchBtn && this.searchForm) {
            this.searchBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSearch();
            });
            document.addEventListener('click', (e) => {
                if (!this.searchForm.classList.contains('is-open')) return;
                if (!this.searchForm.contains(e.target) && !this.searchBtn.contains(e.target)) {
                    this.closeSearch();
                }
            });
        }
    }

    toggleSidebar() {
        if (!this.sidebar || !this.sidebarBtn) return;

        const isOpen = !this.sidebar.classList.contains('is-open');
        if (isOpen) {
            clearTimeout(this._sidebarCloseTimer);
            this.sidebar.classList.remove('is-opening');
            this.sidebar.classList.remove('is-closing');
            this.sidebar.classList.add('is-opening');
            requestAnimationFrame(() => {
                this.sidebar.classList.add('is-open');
                this.sidebar.classList.remove('is-opening');
            });
        } else {
            this.closeSidebar();
        }
        const svg = this.sidebarBtn.querySelector('svg');
        if (svg) {
            svg.outerHTML = isOpen 
                ? '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
                : '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>';
        }
    }

    closeSidebar() {
        if (!this.sidebar || !this.sidebarBtn) return;

        if (!this.sidebar.classList.contains('is-open')) return;
        this.sidebar.classList.remove('is-open');
        this.sidebar.classList.add('is-closing');
        clearTimeout(this._sidebarCloseTimer);
        this._sidebarCloseTimer = setTimeout(() => {
            this.sidebar.classList.remove('is-closing');
        }, 320);

        const svg = this.sidebarBtn.querySelector('svg');
        if (svg) {
            svg.outerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>';
        }
    }

    toggleSearch() {
        if (!this.searchForm || !this.searchBtn) return;

        const isOpen = !this.searchForm.classList.contains('is-open');
        if (isOpen) {
            clearTimeout(this._searchCloseTimer);
            this.searchForm.classList.remove('is-opening');
            this.searchForm.classList.remove('is-closing');
            this.searchForm.classList.add('is-opening');
            requestAnimationFrame(() => {
                this.searchForm.classList.add('is-open');
                this.searchForm.classList.remove('is-opening');
            });
        } else {
            this.closeSearch();
        }
        const svg = this.searchBtn.querySelector('svg');
        if (svg) {
            svg.outerHTML = isOpen 
                ? '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
                : '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
        }
        if (isOpen && this.searchInput) this.searchInput.focus();
    }

    closeSearch() {
        if (!this.searchForm || !this.searchBtn) return;

        if (!this.searchForm.classList.contains('is-open')) return;
        this.searchForm.classList.remove('is-open');
        this.searchForm.classList.add('is-closing');
        clearTimeout(this._searchCloseTimer);
        this._searchCloseTimer = setTimeout(() => {
            this.searchForm.classList.remove('is-closing');
        }, 320);

        const svg = this.searchBtn.querySelector('svg');
        if (svg) {
            svg.outerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
        }
    }

    toggleTheme() {
        const current = this.html.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        localStorage.setItem('qx-theme', next);
        this._applyTheme(next);
    }
}
