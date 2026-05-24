export class QxNav {
    constructor() {
        this.sidebar = document.querySelector('.qx-sidebar');
        this.sidebarBtn = document.querySelector('.js-sidebar-toggle');
        this.sidebarIcon = this.sidebarBtn.querySelector('i');
        this.themeBtn = document.querySelector('.js-theme-toggle');
        this.themeIcon = this.themeBtn.querySelector('i');
        this.searchBtn = document.querySelector('.js-search-toggle');
        this.searchIcon = this.searchBtn.querySelector('i');
        this.searchForm = document.querySelector('.qx-nav-search');
        this.searchInput = document.querySelector('.qx-nav-search-input');
        this.html = document.documentElement;

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
        this.themeIcon.classList.toggle('fa-moon-o', theme === 'dark');
        this.themeIcon.classList.toggle('fa-sun-o', theme === 'light');
    }

    _initSidebarToggle() {
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

    _initThemeToggle() {
        this.themeBtn.addEventListener('click', () => this.toggleTheme());
    }

    _initSearchToggle() {
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

    toggleSidebar() {
        const isOpen = this.sidebar.classList.toggle('is-open');
        this.sidebarIcon.classList.toggle('fa-bars', !isOpen);
        this.sidebarIcon.classList.toggle('fa-times', isOpen);
    }

    closeSidebar() {
        this.sidebar.classList.remove('is-open');
        this.sidebarIcon.classList.add('fa-bars');
        this.sidebarIcon.classList.remove('fa-times');
    }

    toggleSearch() {
        const isOpen = this.searchForm.classList.toggle('is-open');
        this.searchIcon.classList.toggle('fa-search', !isOpen);
        this.searchIcon.classList.toggle('fa-times', isOpen);
        if (isOpen) this.searchInput.focus();
    }

    closeSearch() {
        this.searchForm.classList.remove('is-open');
        this.searchIcon.classList.add('fa-search');
        this.searchIcon.classList.remove('fa-times');
    }

    toggleTheme() {
        const current = this.html.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        localStorage.setItem('qx-theme', next);
        this._applyTheme(next);
    }
}
