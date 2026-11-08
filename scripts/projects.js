/* Project gallery: progressive detail views, restrained motion and project PDFs. */
(() => {
    'use strict';

    const html = document.documentElement;
    const cards = [...document.querySelectorAll('.project-card[data-project]')];
    const sources = new Map([...document.querySelectorAll('[data-project-source]')]
        .map(source => [source.dataset.projectSource, source]));
    const links = [...document.querySelectorAll('[data-project-open]')];
    const dialog = document.getElementById('project-dialog');
    if (!cards.length || !sources.size) return;

    function randomizeDecorations() {
        const slots = [...document.querySelectorAll('.projects-gallery .project-decoration')];
        if (!slots.length) return;
        const artwork = [...slots.map(image => ({
            src: image.getAttribute('src'),
            width: image.getAttribute('width'),
            height: image.getAttribute('height')
        })),
        { src: 'assets/Decoration/Gerbera.png', width: 1254, height: 1254 },
        { src: 'assets/Decoration/Palm.png', width: 1024, height: 1024 }];
        if (artwork.length < 2) return;

        const storageKey = 'portfolio:project-decoration-order';
        const signature = () => JSON.stringify(artwork.slice(0, slots.length).map(image => image.src));
        let previousOrder = signature();
        try { previousOrder = sessionStorage.getItem(storageKey) || previousOrder; } catch { /* Storage is optional. */ }

        // Choose from the full collection without adding slots over the card content.
        for (let index = artwork.length - 1; index > 0; index--) {
            const other = Math.floor(Math.random() * (index + 1));
            [artwork[index], artwork[other]] = [artwork[other], artwork[index]];
        }
        // Avoid showing the exact same arrangement on consecutive reloads.
        if (signature() === previousOrder) artwork.push(artwork.shift());
        slots.forEach((image, index) => {
            const asset = artwork[index];
            image.setAttribute('src', asset.src);
            image.setAttribute('width', asset.width);
            image.setAttribute('height', asset.height);
        });
        try { sessionStorage.setItem(storageKey, signature()); } catch { /* Works without storage too. */ }
    }

    randomizeDecorations();

    function sourceFromHash() {
        return [...sources.values()].find(source => `#${source.id}` === window.location.hash);
    }

    // Ordinary anchors and <details> keep all original information usable without a dialog.
    if (!dialog || typeof dialog.showModal !== 'function') {
        links.forEach(link => link.addEventListener('click', () => {
            const source = sources.get(link.dataset.projectOpen);
            if (source) source.open = true;
        }));
        const expandHash = () => {
            const source = sourceFromHash();
            if (source) source.open = true;
        };
        window.addEventListener('hashchange', expandHash);
        expandHash();
        return;
    }

    const shell = dialog.querySelector('.project-dialog-shell');
    const content = dialog.querySelector('#project-detail-content');
    const grid = dialog.querySelector('.project-dialog-grid');
    const closeButton = dialog.querySelector('[data-project-close]');
    const previousButton = dialog.querySelector('[data-project-previous]');
    const nextButton = dialog.querySelector('[data-project-next]');
    const frame = dialog.querySelector('.project-pdf-frame');
    const emptyDocument = dialog.querySelector('.project-pdf-empty');
    const pdfLink = dialog.querySelector('[data-pdf-open]');
    if (!shell || !content || !grid || !closeButton || !frame || !emptyDocument) return;

    const projectIds = cards.map(card => card.dataset.project)
        .filter(id => sources.get(id)?.querySelector('.project-source-content'));
    if (!projectIds.length) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const animations = new Set();
    const pointerFrames = new Map();
    let activeId = null;
    let opener = null;
    let state = 'closed';
    let operation = 0;
    let backdropPointerDown = false;

    const canAnimate = () => !reducedMotion.matches && html.dataset.motion !== 'paused'
        && typeof shell.animate === 'function';
    const titleFor = id => sources.get(id)?.querySelector('.project-detail-heading h2, .project-detail-heading')
        ?.textContent.trim().replace(/\s+/g, ' ') || id;
    const pad = value => String(value).padStart(2, '0');

    function cancelAnimations() {
        animations.forEach(animation => animation.cancel());
        animations.clear();
    }

    async function animate(element, keyframes, options) {
        if (!canAnimate()) return;
        const animation = element.animate(keyframes, { ...options, fill: 'both' });
        animations.add(animation);
        try { await animation.finished; } catch { /* Superseded by another interaction. */ }
        animations.delete(animation);
        animation.cancel();
    }

    function resetCard(card) {
        cancelAnimationFrame(pointerFrames.get(card));
        pointerFrames.delete(card);
        ['--card-rotate-x', '--card-rotate-y', '--card-light-x', '--card-light-y']
            .forEach(property => card.style.removeProperty(property));
    }

    function currentPdf() {
        const supplied = sources.get(activeId)?.dataset.pdfUrl;
        if (!supplied) return null;
        try {
            const url = new URL(supplied, document.baseURI);
            if (!['http:', 'https:', 'file:'].includes(url.protocol)) return null;
            return url.href;
        } catch { return null; }
    }

    function loadPdf() {
        const pdf = currentPdf();
        if (!pdf) return;
        if (window.portfolioPdfViewer) window.portfolioPdfViewer.prepare(frame, pdf, frame.title).load();
        else if (!frame.getAttribute('src')) frame.src = pdf;
    }

    function releasePdf() {
        if (window.portfolioPdfViewer) window.portfolioPdfViewer.release(frame);
        else frame.removeAttribute('src');
    }

    function updatePdf() {
        const pdf = currentPdf();
        // Release the previous document before changing projects.
        releasePdf();
        frame.hidden = !pdf;
        emptyDocument.hidden = Boolean(pdf);
        frame.title = `${titleFor(activeId)} — project PDF`;
        if (pdfLink) {
            pdfLink.hidden = !pdf;
            if (pdf) pdfLink.href = pdf;
            else pdfLink.removeAttribute('href');
        }
        if (pdf) {
            window.portfolioPdfViewer?.prepare(frame, pdf, frame.title);
            // Let the panel settle before starting a potentially expensive PDF render.
            if (state === 'open') loadPdf();
        }
    }

    function renderProject(id) {
        activeId = id;
        dialog.dataset.project = id;
        const clone = sources.get(id).querySelector('.project-source-content').cloneNode(true);
        clone.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
        clone.querySelector('.project-detail-heading h2, .project-detail-heading').id = 'project-dialog-title';
        content.replaceChildren(clone);
        shell.scrollTop = 0;
        const index = projectIds.indexOf(id);
        const count = projectIds.length;
        const counter = dialog.querySelector('[data-project-counter]');
        const position = dialog.querySelector('[data-project-position]');
        if (counter) counter.textContent = `PROJECT ${pad(index + 1)} / ${pad(count)}`;
        if (position) position.textContent = `${pad(index + 1)} / ${pad(count)}`;
        if (previousButton) previousButton.setAttribute('aria-label', `Previous project: ${titleFor(projectIds[(index - 1 + count) % count])}`);
        if (nextButton) nextButton.setAttribute('aria-label', `Next project: ${titleFor(projectIds[(index + 1) % count])}`);
        updatePdf();
    }

    async function openProject(id, trigger) {
        if (!projectIds.includes(id) || state === 'closing') return;
        if (state !== 'closed') {
            if (id !== activeId) await switchProject(projectIds.indexOf(id) - projectIds.indexOf(activeId));
            return;
        }
        const ticket = ++operation;
        cards.forEach(resetCard);
        opener = trigger || links.find(link => link.dataset.projectOpen === id);
        state = 'opening';
        renderProject(id);
        dialog.classList.add('is-opening');
        html.classList.add('project-dialog-open');
        try {
            dialog.showModal();
        } catch {
            state = 'closed';
            html.classList.remove('project-dialog-open', 'projects-ready');
            dialog.classList.remove('is-opening');
            sources.get(id).open = true;
            sources.get(id).scrollIntoView({ block: 'start' });
            return;
        }
        closeButton.focus({ preventScroll: true });
        // A short, centered entrance keeps text sharp and avoids resizing the PDF layer.
        await animate(shell, [
            { transform: 'translateY(14px) scale(.985)', opacity: 0 },
            { transform: 'none', opacity: 1 }
        ], { duration: 320, easing: 'cubic-bezier(.16, 1, .3, 1)' });
        if (ticket !== operation) return;
        dialog.classList.remove('is-opening');
        state = 'open';
        loadPdf();
    }

    async function closeProject() {
        if (state === 'closed' || state === 'closing') return;
        const ticket = ++operation;
        // Capture the current values so closing mid-entrance never jumps to its end.
        const { transform, opacity } = getComputedStyle(shell);
        cancelAnimations();
        dialog.classList.remove('is-opening', 'is-switching');
        dialog.classList.add('is-closing');
        state = 'closing';
        await animate(shell, [
            { transform, opacity },
            { transform: 'translateY(8px) scale(.99)', opacity: 0 }
        ], { duration: 180, easing: 'cubic-bezier(.4, 0, 1, 1)' });
        if (ticket !== operation) return;
        releasePdf();
        dialog.close();
        dialog.classList.remove('is-closing');
        html.classList.remove('project-dialog-open');
        state = 'closed';
        opener?.focus({ preventScroll: true });
        // Deep links return to the gallery after their dialog is dismissed.
        if (sourceFromHash()) history.replaceState(history.state, '', '#projects');
    }

    async function switchProject(step) {
        if (state === 'closed' || state === 'closing' || !step) return;
        const ticket = ++operation;
        const index = projectIds.indexOf(activeId);
        const nextIndex = ((index + step) % projectIds.length + projectIds.length) % projectIds.length;
        const direction = Math.sign(step);
        cancelAnimations();
        dialog.classList.remove('is-opening');
        dialog.classList.add('is-switching');
        dialog.dataset.direction = direction > 0 ? 'next' : 'previous';
        state = 'switching';
        await animate(grid, [
            { opacity: 1, transform: 'none' },
            { opacity: 0, transform: `translateX(${-direction * 18}px)` }
        ], { duration: 140, easing: 'ease-in' });
        if (ticket !== operation) return;
        renderProject(projectIds[nextIndex]);
        const heading = content.querySelector('#project-dialog-title');
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
        await animate(grid, [
            { opacity: 0, transform: `translateX(${direction * 24}px)` },
            { opacity: 1, transform: 'none' }
        ], { duration: 360, easing: 'cubic-bezier(.16, 1, .3, 1)' });
        if (ticket !== operation) return;
        dialog.classList.remove('is-switching');
        state = 'open';
        loadPdf();
    }

    links.forEach(link => link.addEventListener('click', event => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey
            || event.shiftKey || event.altKey || !projectIds.includes(link.dataset.projectOpen)) return;
        event.preventDefault();
        openProject(link.dataset.projectOpen, link);
    }));
    closeButton.addEventListener('click', closeProject);
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeProject(); });
    previousButton?.addEventListener('click', () => switchProject(-1));
    nextButton?.addEventListener('click', () => switchProject(1));

    function outsideShell(event) {
        const bounds = shell.getBoundingClientRect();
        return event.clientX < bounds.left || event.clientX > bounds.right
            || event.clientY < bounds.top || event.clientY > bounds.bottom;
    }
    dialog.addEventListener('pointerdown', event => {
        backdropPointerDown = event.target === dialog && outsideShell(event);
    });
    dialog.addEventListener('click', event => {
        if (backdropPointerDown && event.target === dialog && outsideShell(event)) closeProject();
        backdropPointerDown = false;
    });

    cards.forEach(card => {
        card.addEventListener('pointermove', event => {
            if (!finePointer.matches || !canAnimate() || state !== 'closed') return;
            const bounds = card.getBoundingClientRect();
            const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
            const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
            cancelAnimationFrame(pointerFrames.get(card));
            pointerFrames.set(card, requestAnimationFrame(() => {
                card.style.setProperty('--card-rotate-x', `${(.5 - y) * 2.4}deg`);
                card.style.setProperty('--card-rotate-y', `${(x - .5) * 3}deg`);
                card.style.setProperty('--card-light-x', `${x * 100}%`);
                card.style.setProperty('--card-light-y', `${y * 100}%`);
            }));
        }, { passive: true });
        card.addEventListener('pointerleave', () => resetCard(card));
    });

    let revealObserver;
    if ('IntersectionObserver' in window && !reducedMotion.matches && html.dataset.motion !== 'paused') {
        revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-in-view');
            revealObserver.unobserve(entry.target);
        }), { threshold: .08 });
        cards.forEach(card => revealObserver.observe(card));
    } else cards.forEach(card => card.classList.add('is-in-view'));

    // The decorative creature only moves while its own small scene is on screen.
    const tideScene = document.querySelector('.projects-tide-scene');
    if (tideScene && 'IntersectionObserver' in window) {
        new IntersectionObserver(entries => {
            tideScene.classList.toggle('is-visible', entries[0].isIntersecting);
        }).observe(tideScene);
    } else tideScene?.classList.add('is-visible');

    function syncMotion() {
        cards.forEach(resetCard);
        if (!canAnimate()) {
            cancelAnimations();
            revealObserver?.disconnect();
            cards.forEach(card => card.classList.add('is-in-view'));
        }
    }
    reducedMotion.addEventListener('change', syncMotion);
    finePointer.addEventListener('change', () => cards.forEach(resetCard));
    window.addEventListener('portfolio:motion', syncMotion);
    window.addEventListener('resize', () => {
        // Settle an in-flight transform before its geometry becomes stale.
        cancelAnimations();
        cards.forEach(resetCard);
    }, { passive: true });

    function openFromHash() {
        const source = sourceFromHash();
        if (source) openProject(source.dataset.projectSource);
    }
    window.addEventListener('hashchange', openFromHash);
    window.addEventListener('pagehide', event => {
        cancelAnimations();
        cards.forEach(resetCard);
        if (event.persisted) return;
        releasePdf();
    });
    window.addEventListener('pageshow', event => {
        if (event.persisted && dialog.open && activeId) updatePdf();
    });
    html.classList.add('projects-ready');
    openFromHash();
})();
