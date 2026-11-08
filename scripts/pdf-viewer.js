/* Mobile document reader: local page previews, paging and zoom without a PDF plug-in. */
(() => {
    'use strict';

    const compact = window.matchMedia('(max-width: 900px), (any-pointer: coarse)');
    const readers = new WeakMap();

    function release(frame) {
        readers.get(frame)?.destroy();
        readers.delete(frame);
        frame.removeAttribute('src');
    }

    function prepare(frame, source, title) {
        const url = new URL(source, document.baseURI);
        const existing = readers.get(frame);
        if (existing?.source === url.href) return existing;
        release(frame);
        const stage = frame.parentElement;
        // A progressively enhanced source may have been cloned into a dialog.
        stage.querySelectorAll(':scope > .pdf-preview').forEach(element => element.remove());
        const filename = decodeURIComponent(url.pathname.split('/').pop());
        const pages = window.portfolioPdfPages?.[filename]?.pages;
        const preview = document.createElement('div');
        preview.className = 'pdf-preview';
        preview.hidden = true;
        preview.innerHTML = '<div class="pdf-preview-tools">'
            + '<div class="pdf-preview-pages" role="group" aria-label="Document pages">'
            + '<button type="button" data-pdf-previous aria-label="Previous page">‹</button>'
            + '<span class="pdf-preview-counter" aria-live="polite"></span>'
            + '<button type="button" data-pdf-next aria-label="Next page">›</button></div>'
            + '<div class="pdf-preview-zoom" role="group" aria-label="Document zoom">'
            + '<button type="button" data-pdf-smaller aria-label="Zoom out">−</button>'
            + '<button type="button" data-pdf-fit aria-label="Fit page to width">100%</button>'
            + '<button type="button" data-pdf-larger aria-label="Zoom in">+</button></div></div>'
            + '<div class="pdf-preview-viewport" tabindex="0" role="region" aria-label="Document page">'
            + '<div class="pdf-preview-page"><img class="pdf-preview-image" alt="" decoding="async"></div>'
            + '<p class="pdf-preview-status" role="status" hidden></p></div>';
        stage.insertBefore(preview, frame);

        const image = preview.querySelector('img');
        const viewport = preview.querySelector('.pdf-preview-viewport');
        const pageWidth = preview.querySelector('.pdf-preview-page');
        const counter = preview.querySelector('.pdf-preview-counter');
        const previous = preview.querySelector('[data-pdf-previous]');
        const next = preview.querySelector('[data-pdf-next]');
        const smaller = preview.querySelector('[data-pdf-smaller]');
        const larger = preview.querySelector('[data-pdf-larger]');
        const fit = preview.querySelector('[data-pdf-fit]');
        const status = preview.querySelector('.pdf-preview-status');
        let page = 0;
        let zoom = 1;
        let loaded = false;
        let destroyed = false;
        let renderedPage = -1;

        function updateZoom(value) {
            zoom = Math.max(1, Math.min(3, value));
            pageWidth.style.width = `${zoom * 100}%`;
            fit.textContent = `${zoom * 100}%`;
            smaller.disabled = zoom === 1;
            larger.disabled = zoom === 3;
            if (zoom === 1) viewport.scrollLeft = 0;
        }

        function renderPage() {
            if (!pages?.length || renderedPage === page) return;
            renderedPage = page;
            const entry = pages[page];
            counter.textContent = `${page + 1} / ${pages.length}`;
            previous.disabled = page === 0;
            next.disabled = page === pages.length - 1;
            image.width = entry.width;
            image.height = entry.height;
            image.alt = `${title}, page ${page + 1} of ${pages.length}`;
            image.hidden = false;
            status.textContent = 'Loading page…';
            status.hidden = false;
            image.src = new URL(entry.src, document.baseURI).href;
            viewport.scrollTop = viewport.scrollLeft = 0;
        }

        image.addEventListener('load', () => { status.hidden = true; });
        image.addEventListener('error', () => {
            image.hidden = true;
            status.textContent = 'This page could not be displayed. Use Open PDF below.';
            status.hidden = false;
        });
        previous.addEventListener('click', () => {
            if (page > 0) { page--; renderPage(); }
        });
        next.addEventListener('click', () => {
            if (page < pages.length - 1) { page++; renderPage(); }
        });
        smaller.addEventListener('click', () => updateZoom(zoom - .5));
        larger.addEventListener('click', () => updateZoom(zoom + .5));
        fit.addEventListener('click', () => updateZoom(1));

        function syncMode() {
            if (destroyed) return;
            const usePages = Boolean(pages?.length)
                && (compact.matches || navigator.pdfViewerEnabled === false);
            stage.dataset.pdfView = usePages ? 'pages' : 'native';
            preview.hidden = !usePages;
            frame.hidden = usePages;
            if (usePages) {
                frame.removeAttribute('src');
                if (loaded) renderPage();
            } else if (loaded && !frame.hasAttribute('src')) {
                const nativeURL = new URL(url);
                nativeURL.hash = 'page=1&view=FitH';
                frame.src = nativeURL.href;
            }
        }

        const reader = {
            source: url.href,
            load() { loaded = true; syncMode(); },
            destroy() {
                destroyed = true;
                compact.removeEventListener('change', syncMode);
                image.removeAttribute('src');
                preview.remove();
                delete stage.dataset.pdfView;
            }
        };
        readers.set(frame, reader);
        compact.addEventListener('change', syncMode);
        updateZoom(1);
        syncMode();
        return reader;
    }

    window.portfolioPdfViewer = { prepare, release };
})();
