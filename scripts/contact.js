/* CSS swims only while the illustration is visible and the page is active. */
(() => {
    'use strict';
    const world = document.querySelector('.contact-world');
    if (!world) return;
    const html = document.documentElement;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = !('IntersectionObserver' in window);
    let pageActive = true;

    function syncMotion() {
        world.classList.toggle('is-swimming', pageActive && visible && !document.hidden
            && !reducedMotion.matches && html.dataset.motion !== 'paused'
            && !html.classList.contains('project-dialog-open')
            && !html.classList.contains('certificate-dialog-open'));
    }
    const visibilityObserver = 'IntersectionObserver' in window
        ? new IntersectionObserver(entries => {
            visible = entries[0].isIntersecting;
            syncMotion();
        }) : null;
    const stateObserver = 'MutationObserver' in window ? new MutationObserver(syncMotion) : null;
    visibilityObserver?.observe(world);
    stateObserver?.observe(html, { attributes: true, attributeFilter: ['class', 'data-motion'] });
    reducedMotion.addEventListener('change', syncMotion);
    document.addEventListener('visibilitychange', syncMotion);
    window.addEventListener('portfolio:motion', syncMotion);

    function pageHide(event) {
        pageActive = false;
        syncMotion();
        if (event.persisted) return;
        visibilityObserver?.disconnect();
        stateObserver?.disconnect();
        reducedMotion.removeEventListener('change', syncMotion);
        document.removeEventListener('visibilitychange', syncMotion);
        window.removeEventListener('portfolio:motion', syncMotion);
        window.removeEventListener('pageshow', pageShow);
        window.removeEventListener('pagehide', pageHide);
    }
    function pageShow(event) {
        if (!event.persisted) return;
        pageActive = true;
        syncMotion();
    }
    window.addEventListener('pagehide', pageHide);
    window.addEventListener('pageshow', pageShow);
    syncMotion();
})();
