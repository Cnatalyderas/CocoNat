/* Navegación, accesibilidad y preferencias de movimiento. */
(() => {
    'use strict';

    const html = document.documentElement;
    const navbar = document.querySelector('.navbar');
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = [...document.querySelectorAll('.nav-links a')];
    const sections = [...document.querySelectorAll('main > section[id]')];
    const motionToggle = document.querySelector('.motion-toggle');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hoverPointer = window.matchMedia('(hover: hover)');
    let previousScroll = Math.max(0, window.scrollY);
    let scrollDirection = 0;
    let directionTravel = 0;

    html.classList.add('js');

    function setMotion(paused) {
        html.dataset.motion = paused ? 'paused' : 'running';
        if (motionToggle) {
            motionToggle.setAttribute('aria-pressed', String(paused));
            motionToggle.querySelector('.motion-label').textContent = paused
                ? 'Enable animation' : 'Pause animation';
        }
        window.dispatchEvent(new CustomEvent('portfolio:motion', { detail: { paused } }));
    }

    setMotion(reducedMotion.matches);
    motionToggle?.addEventListener('click', () => setMotion(html.dataset.motion !== 'paused'));
    reducedMotion.addEventListener('change', event => setMotion(event.matches));

    function setMenu(open, restoreFocus = false) {
        menuToggle.setAttribute('aria-expanded', String(open));
        menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        navbar.classList.toggle('menu-open', open);
        if (open) showNavbar();
        if (restoreFocus) menuToggle.focus();
    }

    menuToggle.addEventListener('click', () => {
        setMenu(menuToggle.getAttribute('aria-expanded') !== 'true');
    });
    navLinks.forEach(link => link.addEventListener('click', () => setMenu(false)));
    document.querySelector('.logo').addEventListener('click', () => setMenu(false));
    document.addEventListener('keydown', event => {
        if (event.key === 'Tab') showNavbar();
        if (event.key === 'Escape' && navbar.classList.contains('menu-open')) setMenu(false, true);
    });
    document.addEventListener('pointerdown', event => {
        if (!navbar.contains(event.target)) setMenu(false);
    });
    window.matchMedia('(min-width: 1061px)').addEventListener('change', () => setMenu(false));
    navbar.addEventListener('focusin', showNavbar);

    function showNavbar() {
        navbar.classList.remove('is-hidden');
        scrollDirection = 0;
        directionTravel = 0;
    }

    function updateNavbarVisibility(scrollY) {
        const delta = scrollY - previousScroll;
        previousScroll = scrollY;
        const focused = document.activeElement;
        const keyboardFocus = navbar.contains(focused) && focused.matches(':focus-visible');
        const interacting = navbar.classList.contains('menu-open') || keyboardFocus
            || (hoverPointer.matches && navbar.matches(':hover'));

        // Cerca del inicio y durante la interacción, la navegación permanece accesible.
        if (scrollY <= Math.max(140, navbar.offsetHeight + 48) || interacting) {
            showNavbar();
            return;
        }
        if (!delta) return;

        const direction = Math.sign(delta);
        if (direction !== scrollDirection) directionTravel = 0;
        scrollDirection = direction;
        directionTravel += Math.abs(delta);

        // La distancia acumulada evita parpadeos por pequeños cambios del trackpad.
        if (direction === 1 && directionTravel >= 18) navbar.classList.add('is-hidden');
        else if (direction === -1 && directionTravel >= 8) navbar.classList.remove('is-hidden');
    }

    // Un solo cálculo por fotograma para visibilidad, progreso y sección actual.
    let scrollPending = false;
    function updateNavigation() {
        const maxScroll = Math.max(0, html.scrollHeight - window.innerHeight);
        const scrollY = Math.max(0, Math.min(window.scrollY, maxScroll));
        navbar.style.setProperty('--scroll-progress', maxScroll > 0 ? scrollY / maxScroll : 0);
        navbar.classList.toggle('is-scrolled', scrollY > 24);
        updateNavbarVisibility(scrollY);
        let current = sections[0]?.id;
        const activationLine = Math.max(160, window.innerHeight * .3);
        sections.forEach(section => {
            if (section.getBoundingClientRect().top <= activationLine) current = section.id;
        });
        if (maxScroll > 0 && scrollY >= maxScroll - 8) current = sections.at(-1)?.id;
        navLinks.forEach(link => {
            const target = new URL(link.href, window.location.href);
            const samePage = target.origin === window.location.origin && target.pathname === window.location.pathname;
            if (samePage && link.hash === `#${current}`) link.setAttribute('aria-current', 'location');
            else link.removeAttribute('aria-current');
        });
        scrollPending = false;
    }
    function scheduleNavigation() {
        if (!scrollPending) {
            scrollPending = true;
            requestAnimationFrame(updateNavigation);
        }
    }
    window.addEventListener('scroll', scheduleNavigation, { passive: true });
    window.addEventListener('resize', scheduleNavigation, { passive: true });
    window.addEventListener('load', scheduleNavigation);
    updateNavigation();

    // El contenido permanece visible cuando no hay JavaScript o no hay observador.
    if ('IntersectionObserver' in window && !reducedMotion.matches) {
        const revealObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                revealObserver.unobserve(entry.target);
            });
        }, { threshold: .08 });
        document.querySelectorAll('.section-header, .about-grid, .project, .skill-card, .credential-card, .diploma-card, .contact-panel, [data-reveal]')
            .forEach(element => {
                element.classList.add('reveal');
                revealObserver.observe(element);
            });
    }
})();
