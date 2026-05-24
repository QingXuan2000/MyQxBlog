import { QxConfig } from './config.js';
import { QxNav } from './nav.js';
import { QxSearch } from './search.js';
import { QxArticles } from './articles.js';
import { QxCategories } from './categories.js';
import { QxToc } from './toc.js';

QxConfig.renderLoader();
QxConfig.renderNav();

document.addEventListener('DOMContentLoaded', async () => {
    const config = new QxConfig();
    await config.load();

    new QxNav();
    new QxSearch();

    const tocBtn = document.querySelector('.js-toc-toggle');
    if (tocBtn && document.querySelector('.qx-post-body')) {
        new QxToc(tocBtn);
    }

    const pagination = document.getElementById('qxPagination');
    if (pagination) {
        const grid = document.querySelector('.qx-articles-grid');
        const source = pagination.dataset.source;
        const label = source === 'category' ? pagination.dataset.label : null;
        const articles = new QxArticles(grid, pagination, label);
        await articles.load(1);
    }

    const catList = document.querySelector('.qx-categories-list');
    if (catList) {
        const categories = new QxCategories(catList);
        await categories.load();
    }

    document.querySelectorAll('.qx-post-body pre').forEach(pre => {
        const btn = document.createElement('button');
        btn.className = 'qx-code-copy';
        btn.innerHTML = '<i class="fa fa-clipboard"></i>';
        btn.title = '复制代码';
        btn.addEventListener('click', () => {
            const code = pre.querySelector('code');
            const text = code ? code.textContent : pre.textContent;
            navigator.clipboard.writeText(text).then(() => {
                btn.innerHTML = '<i class="fa fa-check"></i>';
                setTimeout(() => { btn.innerHTML = '<i class="fa fa-clipboard"></i>'; }, 1500);
            }).catch(() => {});
        });
        pre.appendChild(btn);
    });

    document.querySelectorAll('.qx-post-body table').forEach(table => {
        const wrap = document.createElement('div');
        wrap.className = 'qx-table-wrap';
        table.parentNode.insertBefore(wrap, table);
        wrap.appendChild(table);
    });

    const lbOverlay = document.createElement('div');
    lbOverlay.className = 'qx-lightbox';
    const lbImg = document.createElement('img');
    lbImg.className = 'qx-lightbox-img';
    const lbClose = document.createElement('button');
    lbClose.className = 'qx-lightbox-close';
    lbClose.innerHTML = '<i class="fa fa-times"></i>';
    lbClose.title = '关闭';
    lbOverlay.appendChild(lbImg);
    lbOverlay.appendChild(lbClose);
    document.body.appendChild(lbOverlay);

    let dragStartX = 0;
    let dragStartY = 0;
    let imgStartX = 0;
    let imgStartY = 0;
    let isDragging = false;
    let hasDragged = false;
    let lbScale = 1;

    const lockScroll = (locked) => {
        document.documentElement.style.overflow = locked ? 'hidden' : '';
        document.body.style.overflow = locked ? 'hidden' : '';
    };

    const applyLbTransform = () => {
        lbImg.style.transform = `translate3d(${imgStartX}px, ${imgStartY}px, 0) scale(${lbScale})`;
    };

    const resetLbState = () => {
        imgStartX = 0;
        imgStartY = 0;
        lbScale = 1;
        applyLbTransform();
    };

    const openLightbox = (src) => {
        lbImg.src = src;
        resetLbState();
        lbOverlay.classList.add('is-open');
        lockScroll(true);
    };

    const closeLightbox = () => {
        lbOverlay.classList.remove('is-open');
        lockScroll(false);
        setTimeout(() => {
            lbImg.src = '';
            resetLbState();
        }, 300);
    };

    document.querySelectorAll('.qx-post-body img').forEach(img => {
        img.addEventListener('click', () => {
            openLightbox(img.src);
        });
    });

    lbImg.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDragging = true;
        hasDragged = false;
        lbOverlay.classList.add('is-dragging');
        dragStartX = e.clientX;
        dragStartY = e.clientY;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            hasDragged = true;
        }
        imgStartX += dx;
        imgStartY += dy;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        applyLbTransform();
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        lbOverlay.classList.remove('is-dragging');
    });

    lbImg.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        isDragging = true;
        hasDragged = false;
        lbOverlay.classList.add('is-dragging');
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging || e.touches.length !== 1) return;
        e.preventDefault();
        const dx = e.touches[0].clientX - dragStartX;
        const dy = e.touches[0].clientY - dragStartY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            hasDragged = true;
        }
        imgStartX += dx;
        imgStartY += dy;
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        applyLbTransform();
    }, { passive: false });

    document.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        lbOverlay.classList.remove('is-dragging');
    });

    lbImg.addEventListener('wheel', (e) => {
        if (!lbOverlay.classList.contains('is-open')) return;
        e.preventDefault();
        const oldScale = lbScale;
        const delta = -e.deltaY;
        lbScale = Math.min(10, Math.max(0.5, lbScale + delta * 0.002));
        if (lbScale === oldScale) return;
        const imgRect = lbImg.getBoundingClientRect();
        const cx = e.clientX - imgRect.left;
        const cy = e.clientY - imgRect.top;
        const ratio = lbScale / oldScale;
        imgStartX += (ratio - 1) * (imgRect.width / 2 - cx);
        imgStartY += (ratio - 1) * (imgRect.height / 2 - cy);
        applyLbTransform();
    }, { passive: false });

    lbClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeLightbox();
    });

    lbOverlay.addEventListener('click', (e) => {
        if (e.target === lbOverlay && !hasDragged) {
            closeLightbox();
        }
        hasDragged = false;
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lbOverlay.classList.contains('is-open')) {
            closeLightbox();
        }
    });

    const loader = document.querySelector('.qx-loader');
    if (loader) {
        loader.classList.add('is-hidden');
        loader.addEventListener('transitionend', () => loader.remove());
    }

    // Back to top button
    const btt = document.createElement('button');
    btt.className = 'qx-btt';
    btt.innerHTML = '<i class="fa fa-arrow-up"></i>';
    btt.title = '返回顶部';
    btt.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(btt);

    let bttTicking = false;
    window.addEventListener('scroll', () => {
        if (!bttTicking) {
            requestAnimationFrame(() => {
                btt.classList.toggle('is-visible', window.scrollY > 300);
                bttTicking = false;
            });
            bttTicking = true;
        }
    });
});
