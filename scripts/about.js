/* Small, motion-aware interactions specific to the About page. */
(() => {
    'use strict';
    const html = document.documentElement;
    const photo = document.querySelector('.about-photo');
    const journey = document.querySelector('.experience-journey');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    let pointerFrame = 0;
    let progressFrame = 0;

    function resetPortrait() {
        cancelAnimationFrame(pointerFrame);
        photo.style.removeProperty('--portrait-rotate-x');
        photo.style.removeProperty('--portrait-rotate-y');
        photo.style.removeProperty('--portrait-light-x');
        photo.style.removeProperty('--portrait-light-y');
    }

    photo.addEventListener('pointermove', event => {
        if (!finePointer.matches || html.dataset.motion === 'paused') return;
        cancelAnimationFrame(pointerFrame);
        const bounds = photo.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
        const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
        pointerFrame = requestAnimationFrame(() => {
            photo.style.setProperty('--portrait-rotate-x', `${(0.5 - y) * 5}deg`);
            photo.style.setProperty('--portrait-rotate-y', `${(x - 0.5) * 5}deg`);
            photo.style.setProperty('--portrait-light-x', `${x * 100}%`);
            photo.style.setProperty('--portrait-light-y', `${y * 100}%`);
        });
    }, { passive: true });
    photo.addEventListener('pointerleave', resetPortrait);
    finePointer.addEventListener('change', resetPortrait);
    window.addEventListener('portfolio:motion', resetPortrait);

    document.querySelectorAll('.skill-entry').forEach(entry => {
        entry.addEventListener('pointermove', event => {
            if (!finePointer.matches || html.dataset.motion === 'paused') return;
            const bounds = entry.getBoundingClientRect();
            entry.style.setProperty('--card-x', `${event.clientX - bounds.left}px`);
            entry.style.setProperty('--card-y', `${event.clientY - bounds.top}px`);
        }, { passive: true });
    });

    function updateJourney() {
        const bounds = journey.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, (window.innerHeight * .7 - bounds.top) / bounds.height));
        journey.style.setProperty('--journey-progress', progress);
        progressFrame = 0;
    }
    function scheduleJourney() {
        if (!progressFrame) progressFrame = requestAnimationFrame(updateJourney);
    }
    window.addEventListener('scroll', scheduleJourney, { passive: true });
    window.addEventListener('resize', scheduleJourney, { passive: true });
    window.addEventListener('load', scheduleJourney);
    if (document.fonts) document.fonts.ready.then(scheduleJourney);
    updateJourney();
})();
