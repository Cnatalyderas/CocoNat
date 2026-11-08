/* Certificate documents: image lightboxes and a separate single-page PDF space. */
(() => {
    'use strict';

    const html = document.documentElement;
    const links = [...document.querySelectorAll('[data-certificate-open]')];
    const sources = new Map([...document.querySelectorAll('[data-certificate-source]')]
        .filter(source => source.querySelector('.certificate-source-title')
            && source.querySelector('.certificate-image-stage'))
        .map(source => [source.dataset.certificateSource, source]));
    if (!links.length || !sources.size) return;

    const sourceFromHash = () => [...sources.values()]
        .find(source => `#${source.id}` === window.location.hash);

    function preparePDF(stage, name) {
        const supplied = stage.dataset.pdfUrl?.trim();
        if (!supplied || stage.querySelector('iframe')) return;
        const empty = stage.querySelector('.certificate-image-empty');
        let url;
        try {
            url = new URL(supplied, document.baseURI);
            if (!['http:', 'https:', 'file:'].includes(url.protocol)) throw new Error('Unsupported document URL');
        } catch {
            if (empty) empty.textContent = 'The certificate PDF could not be opened.';
            return;
        }
        const frame = document.createElement('iframe');
        frame.className = 'certificate-pdf-frame';
        frame.title = `${name} certificate PDF`;
        frame.dataset.pdfSource = url.href;
        const directLink = document.createElement('a');
        directLink.className = 'certificate-pdf-direct';
        directLink.href = url.href;
        directLink.target = '_blank';
        directLink.rel = 'noopener noreferrer';
        const arrow = document.createElement('img');
        arrow.className = 'site-arrow site-arrow--ne';
        arrow.src = new URL('assets/arrow.png', document.baseURI).href;
        arrow.alt = '';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.width = arrow.height = 36;
        directLink.append('Open PDF ', arrow);
        if (empty) empty.hidden = true;
        stage.append(frame, directLink);
    }

    function loadPDF(host) {
        host.querySelectorAll('iframe[data-pdf-source]').forEach(frame => {
            if (frame.hasAttribute('src')) return;
            const url = new URL(frame.dataset.pdfSource);
            url.hash = 'page=1&view=FitH&toolbar=0&navpanes=0';
            frame.src = url.href;
        });
    }

    function expandSource(source) {
        if (!source) return;
        source.open = true;
        if (source.dataset.certificateFormat === 'pdf') {
            preparePDF(source.querySelector('.certificate-image-stage'),
                source.querySelector('.certificate-source-title').textContent.trim());
            loadPDF(source);
        }
    }

    function installFallback() {
        links.forEach(link => link.addEventListener('click', () => {
            const source = sources.get(link.dataset.certificateOpen);
            expandSource(source);
        }));
        const expandHash = () => {
            const source = sourceFromHash();
            expandSource(source);
        };
        window.addEventListener('hashchange', expandHash);
        expandHash();
    }

    const dialog = document.getElementById('certificate-dialog');
    const shell = dialog?.querySelector('.certificate-dialog-shell');
    const title = dialog?.querySelector('#certificate-dialog-title');
    const imageHost = dialog?.querySelector('#certificate-dialog-document');
    const closeButton = dialog?.querySelector('[data-certificate-close]');
    if (!dialog || typeof dialog.showModal !== 'function' || !shell || !title || !imageHost || !closeButton) {
        installFallback();
        return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const animations = new Set();
    let state = 'closed';
    let activeId = null;
    let opener = null;
    let operation = 0;
    let backdropPointerDown = false;

    const canAnimate = () => !reducedMotion.matches && html.dataset.motion !== 'paused'
        && typeof shell.animate === 'function';
    const announceOverlay = open => window.dispatchEvent(new CustomEvent('portfolio:overlay', {
        detail: { open, kind: 'certificate' }
    }));

    function cancelAnimations() {
        animations.forEach(animation => animation.cancel());
        animations.clear();
    }

    async function animate(keyframes, options) {
        if (!canAnimate()) return;
        const animation = shell.animate(keyframes, { ...options, fill: 'both' });
        animations.add(animation);
        try { await animation.finished; } catch { /* A new interaction settled this animation. */ }
        animations.delete(animation);
        animation.cancel();
    }

    function renderCertificate(id) {
        const source = sources.get(id);
        const name = source.querySelector('.certificate-source-title').textContent.trim();
        const gallery = source.querySelector('.certificate-document-set');
        const stage = (gallery || source.querySelector('.certificate-image-stage')).cloneNode(true);
        stage.removeAttribute('id');
        stage.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
        title.textContent = name;
        dialog.dataset.certificate = id;
        const pdf = source.dataset.certificateFormat === 'pdf';
        dialog.dataset.format = pdf ? 'pdf' : gallery ? 'gallery' : 'image';
        if (pdf) {
            preparePDF(stage, name);
            imageHost.replaceChildren(stage);
            shell.scrollTop = 0;
            return;
        }
        const stages = gallery ? [...stage.querySelectorAll('.certificate-image-stage')] : [stage];
        stages.forEach(imageStage => prepareImage(imageStage, name));
        imageHost.replaceChildren(stage);
        shell.scrollTop = 0;
    }

    function prepareImage(stage, name) {
        const image = stage.querySelector('img');
        let empty = stage.querySelector('.certificate-image-empty');
        if (!empty) {
            empty = document.createElement('p');
            empty.className = 'certificate-image-empty';
            empty.textContent = 'No certificate image has been added yet.';
            stage.append(empty);
        }
        if (image && image.getAttribute('src')) {
            empty.textContent = 'Loading certificate…';
            if (!image.alt.trim()) image.alt = `${name} certificate`;
            image.loading = 'eager';
            image.decoding = 'async';
            const loaded = async () => {
                try { await image.decode(); } catch { failed(); return; }
                image.hidden = false;
                empty.hidden = true;
            };
            const failed = () => {
                image.hidden = true;
                empty.hidden = false;
                empty.textContent = 'The certificate image could not be loaded.';
            };
            image.addEventListener('load', loaded, { once: true });
            image.addEventListener('error', failed, { once: true });
            image.hidden = true;
            empty.hidden = false;
            if (image.complete) {
                if (image.naturalWidth > 0) loaded();
                else failed();
            }
        } else {
            if (image) image.hidden = true;
            empty.hidden = false;
        }
    }

    async function openCertificate(id, trigger) {
        if (!sources.has(id) || state === 'closing' || (id === activeId && state !== 'closed')) return;
        const ticket = ++operation;
        cancelAnimations();
        activeId = id;
        opener = trigger || links.find(link => link.dataset.certificateOpen === id);
        renderCertificate(id);
        state = 'opening';
        dialog.classList.remove('is-closing');
        dialog.classList.add('is-opening');
        html.classList.add('certificate-dialog-open');
        try {
            if (!dialog.open) dialog.showModal();
        } catch {
            state = 'closed';
            activeId = null;
            html.classList.remove('certificate-dialog-open', 'certificates-ready');
            dialog.classList.remove('is-opening');
            expandSource(sources.get(id));
            sources.get(id).scrollIntoView({ block: 'start' });
            return;
        }
        announceOverlay(true);
        closeButton.focus({ preventScroll: true });
        await animate([
            { opacity: 0, transform: 'translateY(12px) scale(.987)' },
            { opacity: 1, transform: 'none' }
        ], { duration: 300, easing: 'cubic-bezier(.16, 1, .3, 1)' });
        if (ticket !== operation) return;
        dialog.classList.remove('is-opening');
        state = 'open';
        loadPDF(imageHost);
    }

    function finishClose() {
        dialog.classList.remove('is-opening', 'is-closing');
        html.classList.remove('certificate-dialog-open');
        state = 'closed';
        activeId = null;
        backdropPointerDown = false;
        imageHost.replaceChildren();
        announceOverlay(false);
        opener?.focus({ preventScroll: true });
        if (sourceFromHash()) history.replaceState(history.state, '', '#certifications');
    }

    async function closeCertificate() {
        if (state === 'closed' || state === 'closing') return;
        const ticket = ++operation;
        const { opacity, transform } = getComputedStyle(shell);
        cancelAnimations();
        dialog.classList.remove('is-opening');
        dialog.classList.add('is-closing');
        state = 'closing';
        await animate([
            { opacity, transform },
            { opacity: 0, transform: 'translateY(7px) scale(.992)' }
        ], { duration: 180, easing: 'cubic-bezier(.4, 0, 1, 1)' });
        if (ticket !== operation) return;
        dialog.close();
        finishClose();
    }

    links.forEach(link => link.addEventListener('click', event => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey
            || event.shiftKey || event.altKey || !sources.has(link.dataset.certificateOpen)) return;
        event.preventDefault();
        openCertificate(link.dataset.certificateOpen, link);
    }));
    closeButton.addEventListener('click', closeCertificate);
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeCertificate(); });
    dialog.addEventListener('close', () => {
        if (state === 'closed') return;
        ++operation;
        cancelAnimations();
        finishClose();
    });

    function outsideShell(event) {
        const box = shell.getBoundingClientRect();
        return event.clientX < box.left || event.clientX > box.right
            || event.clientY < box.top || event.clientY > box.bottom;
    }
    dialog.addEventListener('pointerdown', event => {
        backdropPointerDown = event.target === dialog && outsideShell(event);
    });
    dialog.addEventListener('pointercancel', () => { backdropPointerDown = false; });
    dialog.addEventListener('click', event => {
        if (backdropPointerDown && event.target === dialog && outsideShell(event)) closeCertificate();
        backdropPointerDown = false;
    });

    function syncMotion() {
        if (!canAnimate()) cancelAnimations();
    }
    reducedMotion.addEventListener('change', syncMotion);
    window.addEventListener('portfolio:motion', syncMotion);
    function openFromHash() {
        const source = sourceFromHash();
        if (source) openCertificate(source.dataset.certificateSource);
        else if (dialog.open) closeCertificate();
    }
    window.addEventListener('hashchange', openFromHash);
    window.addEventListener('pagehide', event => {
        ++operation;
        cancelAnimations();
        dialog.classList.remove('is-opening', 'is-closing');
        state = dialog.open ? 'open' : 'closed';
        if (event.persisted) return;
        html.classList.remove('certificate-dialog-open');
    });
    html.classList.add('certificates-ready');
    openFromHash();
})();
