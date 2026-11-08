/* One album, with native dialog focus management and an ordinary-link fallback. */
(() => {
    'use strict';
    const html = document.documentElement;
    const collection = document.getElementById('photo-collection');
    const dialog = document.getElementById('photo-gallery');
    const opener = document.querySelector('[data-gallery-open]');
    if (!collection || !dialog || !opener) return;

    const grid = collection.querySelector('.photo-gallery-grid');
    const photos = [...grid.querySelectorAll('.photo-tile')];
    if (!photos.length) return;

    if (typeof dialog.showModal !== 'function') {
        opener.addEventListener('click', () => { collection.open = true; });
        return;
    }

    const gridView = dialog.querySelector('.photo-gallery-scroll');
    const imageView = dialog.querySelector('.photo-gallery-view');
    const fullImage = dialog.querySelector('.photo-gallery-full');
    const status = dialog.querySelector('.photo-gallery-status');
    const counter = dialog.querySelector('.photo-gallery-counter');
    const back = dialog.querySelector('[data-gallery-back]');
    const close = dialog.querySelector('[data-gallery-close]');
    const previous = dialog.querySelector('[data-photo-previous]');
    const next = dialog.querySelector('[data-photo-next]');
    let activeIndex = -1;
    let lastPhoto = null;
    let backdropStart = false;
    let request = 0;

    gridView.append(grid);
    collection.hidden = true;
    opener.setAttribute('aria-haspopup', 'dialog');

    function showGrid(restoreFocus = true) {
        request++;
        activeIndex = -1;
        gridView.hidden = false;
        imageView.hidden = true;
        back.hidden = true;
        fullImage.removeAttribute('src');
        fullImage.alt = '';
        status.hidden = true;
        if (restoreFocus) (lastPhoto || close).focus({ preventScroll: true });
    }

    function showPhoto(index, moveFocus = false) {
        if (index < 0 || index >= photos.length) return;
        const photo = photos[index];
        const image = photo.querySelector('img');
        const currentRequest = ++request;
        activeIndex = index;
        lastPhoto = photo;
        gridView.hidden = true;
        imageView.hidden = false;
        back.hidden = false;
        previous.disabled = index === 0;
        next.disabled = index === photos.length - 1;
        if (!moveFocus && ((document.activeElement === previous && previous.disabled)
            || (document.activeElement === next && next.disabled))) back.focus({ preventScroll: true });
        counter.textContent = `${String(index + 1).padStart(2, '0')} / ${photos.length}`;
        status.textContent = 'Loading photograph…';
        status.hidden = false;
        fullImage.hidden = true;
        fullImage.alt = image.alt;
        const loading = new Image();
        loading.onload = () => {
            if (currentRequest !== request || !dialog.open) return;
            fullImage.src = loading.src;
            fullImage.hidden = false;
            status.hidden = true;
        };
        loading.onerror = () => {
            if (currentRequest !== request || !dialog.open) return;
            status.textContent = 'This photograph could not load. Please try again.';
        };
        loading.src = photo.href;
        if (moveFocus) back.focus({ preventScroll: true });
    }

    opener.addEventListener('click', event => {
        event.preventDefault();
        showGrid(false);
        // Load the small album images on demand; full-size files load individually.
        photos.forEach(photo => { photo.querySelector('img').loading = 'eager'; });
        dialog.showModal();
        html.classList.add('photo-gallery-open');
        close.focus({ preventScroll: true });
    });
    photos.forEach((photo, index) => photo.addEventListener('click', event => {
        // Preserve opening a photograph in another tab with a modified click.
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        showPhoto(index, true);
    }));
    back.addEventListener('click', () => showGrid());
    close.addEventListener('click', () => dialog.close());
    previous.addEventListener('click', () => showPhoto(activeIndex - 1));
    next.addEventListener('click', () => showPhoto(activeIndex + 1));
    dialog.addEventListener('keydown', event => {
        if (activeIndex < 0 || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === 'ArrowLeft') { event.preventDefault(); showPhoto(activeIndex - 1); }
        if (event.key === 'ArrowRight') { event.preventDefault(); showPhoto(activeIndex + 1); }
    });
    dialog.addEventListener('cancel', event => {
        if (activeIndex < 0) return;
        event.preventDefault();
        showGrid();
    });
    dialog.addEventListener('pointerdown', event => { backdropStart = event.target === dialog; });
    dialog.addEventListener('click', event => {
        if (backdropStart && event.target === dialog) dialog.close();
        backdropStart = false;
    });
    dialog.addEventListener('close', () => {
        showGrid(false);
        html.classList.remove('photo-gallery-open');
        opener.focus({ preventScroll: true });
    });
})();
