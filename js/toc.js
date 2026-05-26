export class QxToc {
    constructor(toggleBtn) {
        this.toggleBtn = toggleBtn;
        this.sidebar = null;
        this.links = [];
        this.headings = [];
        this.activeLink = null;
        this.scrollRaf = 0;
        this.headingOffset = 72;
        this._build();
        this._initToggle();
        this._initScrollSpy();
    }

    _build() {
        this.headings = Array.from(document.querySelectorAll('.qx-post-body h2, .qx-post-body h3'));
        if (this.headings.length === 0) return;

        const firstHeading = this.headings[0];
        const parsedOffset = parseFloat(getComputedStyle(firstHeading).scrollMarginTop);
        if (Number.isFinite(parsedOffset)) {
            this.headingOffset = parsedOffset;
        }

        this.toggleBtn.style.display = '';

        const itemsHTML = this.headings.map((heading, i) => {
            const id = `qx-toc-${i}`;
            heading.id = id;
            const indent = heading.tagName === 'H3' ? ' qx-toc-indent-2' : ' qx-toc-indent-1';
            return `<a href="#${id}" class="qx-toc-link${indent}">${heading.textContent}</a>`;
        }).join('');

        const html = `
            <aside class="qx-toc-sidebar">
                <div class="qx-toc-inner">
                    <h3 class="qx-toc-head">目录</h3>
                    <nav class="qx-toc-nav">${itemsHTML}</nav>
                </div>
            </aside>`;
        document.body.insertAdjacentHTML('beforeend', html);
        this.sidebar = document.querySelector('.qx-toc-sidebar');
        this.links = Array.from(this.sidebar.querySelectorAll('.qx-toc-link'));

        this.links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const id = link.getAttribute('href').slice(1);
                const target = document.getElementById(id);
                if (target) {
                    const top = window.scrollY + target.getBoundingClientRect().top - this.headingOffset;
                    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
                }
                this._updateActiveLink(link);
            });
        });

        this._updateActiveLink(this.links[0]);
    }

    _initToggle() {
        this.toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });
        document.addEventListener('click', (e) => {
            if (!this.sidebar || !this.sidebar.classList.contains('is-open')) return;
            if (!this.sidebar.contains(e.target) && !this.toggleBtn.contains(e.target)) {
                this.close();
            }
        });
    }

    _initScrollSpy() {
        if (!this.headings.length || !this.links.length) return;

        const onScroll = () => {
            if (this.scrollRaf) return;
            this.scrollRaf = window.requestAnimationFrame(() => {
                this.scrollRaf = 0;
                this._syncActiveFromScroll();
            });
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        this._syncActiveFromScroll();
    }

    _syncActiveFromScroll() {
        const offset = this.headingOffset;
        let current = this.headings[0];

        for (const heading of this.headings) {
            if (heading.getBoundingClientRect().top <= offset) {
                current = heading;
            } else {
                break;
            }
        }

        this._updateActiveLink(this._linkForHeading(current));
    }

    _linkForHeading(heading) {
        if (!heading) return null;
        return this.links.find(link => link.getAttribute('href') === `#${heading.id}`) || null;
    }

    _updateActiveLink(nextLink) {
        if (!nextLink || this.activeLink === nextLink) return;
        if (this.activeLink) this.activeLink.classList.remove('is-active');
        nextLink.classList.add('is-active');
        this.activeLink = nextLink;
    }

    toggle() {
        if (!this.sidebar) return;
        const isOpen = this.sidebar.classList.toggle('is-open');
        const icon = this.toggleBtn.querySelector('i');
        icon.classList.toggle('fa-list-ul', !isOpen);
        icon.classList.toggle('fa-times', isOpen);
    }

    close() {
        if (!this.sidebar) return;
        this.sidebar.classList.remove('is-open');
        const icon = this.toggleBtn.querySelector('i');
        icon.classList.add('fa-list-ul');
        icon.classList.remove('fa-times');
    }
}
