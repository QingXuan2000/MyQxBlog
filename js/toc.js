export class QxToc {
    constructor(toggleBtn) {
        this.toggleBtn = toggleBtn;
        this.sidebar = null;
        this._build();
        this._initToggle();
    }

    _build() {
        const headings = document.querySelectorAll('.qx-post-body h2, .qx-post-body h3');
        if (headings.length === 0) return;

        // Show the toggle button
        this.toggleBtn.style.display = '';

        const itemsHTML = Array.from(headings).map((h, i) => {
            const id = `qx-toc-${i}`;
            h.id = id;
            const indent = h.tagName === 'H3' ? ' qx-toc-indent' : '';
            return `<a href="#${id}" class="qx-toc-link${indent}">${h.textContent}</a>`;
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

        // Smooth scroll to heading, then close sidebar
        this.sidebar.querySelectorAll('.qx-toc-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const id = link.getAttribute('href').slice(1);
                const target = document.getElementById(id);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
                this.close();
            });
        });
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
