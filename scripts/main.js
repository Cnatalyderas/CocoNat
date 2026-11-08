/* Navegación, accesibilidad y preferencias de movimiento. */
(() => {
    'use strict';

    const html = document.documentElement;
    const navbar = document.querySelector('.navbar');
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = [...document.querySelectorAll('.nav-links a')];
    const navigationLinks = [...document.querySelectorAll('.nav-pages a, .nav-links a')];
    const sections = navLinks.map(link => {
        const target = new URL(link.href, window.location.href);
        if (target.pathname !== window.location.pathname || !target.hash) return null;
        return document.getElementById(target.hash.slice(1));
    }).filter(Boolean);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hoverPointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    let previousScroll = Math.max(0, window.scrollY);
    let scrollDirection = 0;
    let directionTravel = 0;

    html.classList.add('js');

    function setMotion(paused) {
        html.dataset.motion = paused ? 'paused' : 'running';
        window.dispatchEvent(new CustomEvent('portfolio:motion', { detail: { paused } }));
    }

    setMotion(reducedMotion.matches);
    reducedMotion.addEventListener('change', event => setMotion(event.matches));

    function setMenu(open, restoreFocus = false) {
        menuToggle.setAttribute('aria-expanded', String(open));
        menuToggle.setAttribute('aria-label', open ? 'Close section menu' : 'Open section menu');
        navbar.classList.toggle('menu-open', open);
        if (open) showNavbar();
        if (restoreFocus) menuToggle.focus();
    }

    menuToggle.addEventListener('click', () => {
        setMenu(menuToggle.getAttribute('aria-expanded') !== 'true');
    });
    navigationLinks.forEach(link => link.addEventListener('click', () => setMenu(false)));
    document.querySelector('.logo').addEventListener('click', () => setMenu(false));
    document.addEventListener('keydown', event => {
        if (event.key === 'Tab') showNavbar();
        if (event.key === 'Escape' && navbar.classList.contains('menu-open')) setMenu(false, true);
    });
    document.addEventListener('pointerdown', event => {
        if (!navbar.contains(event.target)) setMenu(false);
    });
    window.matchMedia('(min-width: 901px)').addEventListener('change', () => setMenu(false));
    navbar.addEventListener('focusin', showNavbar);
    navbar.addEventListener('focusout', event => {
        if (!navbar.contains(event.relatedTarget)) setMenu(false);
    });

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
            || (hoverPointer.matches && navbar.matches(':hover'))
            || html.classList.contains('project-dialog-open')
            || html.classList.contains('certificate-dialog-open');

        if (scrollY <= 96 || interacting) {
            showNavbar();
            return;
        }
        if (Math.abs(delta) < .5) return;

        const direction = Math.sign(delta);
        if (direction !== scrollDirection) directionTravel = 0;
        scrollDirection = direction;
        directionTravel += Math.abs(delta);

        // Umbrales distintos: sale con intención y vuelve con un gesto pequeño.
        if (direction > 0 && directionTravel >= 28) navbar.classList.add('is-hidden');
        else if (direction < 0 && directionTravel >= 8) navbar.classList.remove('is-hidden');
    }

    // Un cálculo por fotograma para scroll, progreso y sección activa.
    let scrollPending = false;
    function updateNavigation() {
        const maxScroll = Math.max(0, html.scrollHeight - window.innerHeight);
        const scrollY = Math.max(0, Math.min(window.scrollY, maxScroll));
        navbar.style.setProperty('--scroll-progress', maxScroll > 0 ? scrollY / maxScroll : 0);
        navbar.classList.toggle('is-scrolled', scrollY > 24);
        updateNavbarVisibility(scrollY);
        let current;
        const activationLine = parseFloat(getComputedStyle(html).scrollPaddingTop) + 24;
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
    window.addEventListener('resize', () => {
        previousScroll = Math.max(0, window.scrollY);
        showNavbar();
        scheduleNavigation();
    }, { passive: true });
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
