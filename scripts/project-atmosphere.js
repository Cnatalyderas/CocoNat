/* Blue bioluminescence: cached sprites, a bounded canvas and a shared motion clock. */
(() => {
    'use strict';

    const section = document.querySelector('.projects-section');
    const canvas = section?.querySelector('.projects-magic-canvas');
    const context = canvas?.getContext('2d');
    if (!section || !canvas || !context) return;
    context.imageSmoothingEnabled = false;

    const html = document.documentElement;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const hasVisibilityObserver = 'IntersectionObserver' in window;
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    let visible = !hasVisibilityObserver;
    let pageActive = true;
    let destroyed = false;
    let running = false;
    let width = 0;
    let height = 0;
    let ratio = 0;
    let frame = 0;
    let lastDraw = null;
    let nextDraw = 0;
    let elapsed = 0;
    let particleCount = 96;
    let butterflyCount = 5;
    let frameInterval = 1000 / 30;

    function sprite(size, painter) {
        const bitmap = document.createElement('canvas');
        bitmap.width = bitmap.height = size;
        const pen = bitmap.getContext('2d');
        if (!pen) return null;
        painter(pen, size);
        return bitmap;
    }

    // All soft light and wing geometry is rasterized once, never inside the frame loop.
    const glow = sprite(64, (pen, size) => {
        const halo = pen.createRadialGradient(32, 32, 0, 32, 32, 32);
        halo.addColorStop(0, '#e8fbff');
        halo.addColorStop(.07, '#c2efff');
        halo.addColorStop(.2, '#87d4ff80');
        halo.addColorStop(.52, '#619fff25');
        halo.addColorStop(1, '#478cff00');
        pen.fillStyle = halo;
        pen.fillRect(0, 0, size, size);
    });
    const star = sprite(96, pen => {
        const halo = pen.createRadialGradient(48, 48, 0, 48, 48, 46);
        halo.addColorStop(0, '#d5f5ff80');
        halo.addColorStop(.3, '#83c8ff20');
        halo.addColorStop(1, '#6aabff00');
        pen.fillStyle = halo;
        pen.fillRect(0, 0, 96, 96);
        pen.fillStyle = '#d5f5ff';
        pen.beginPath();
        pen.moveTo(48, 18); pen.quadraticCurveTo(51, 44, 76, 48);
        pen.quadraticCurveTo(51, 51, 48, 78); pen.quadraticCurveTo(45, 51, 20, 48);
        pen.quadraticCurveTo(45, 44, 48, 18); pen.fill();
        pen.fillStyle = '#ffffff';
        pen.beginPath(); pen.arc(48, 48, 1.5, 0, Math.PI * 2); pen.fill();
    });
    const wings = sprite(32, pen => {
        // One hand-drawn wing, mirrored around the body: real stepped pixels,
        // not a smooth silhouette sampled at a lower resolution.
        const palette = {
            O: '#304778', B: '#5885c6', C: '#7abaf2',
            W: '#e7fbff', L: '#aaedff', V: '#aaa1df'
        };
        const rows = [
            '................', '................', '..OOO...........',
            '.OBBBOO.........', 'OBCCCBBO........', 'OBWWWCCBO.......',
            'OBWLLWCCBO......', 'OBWLLLWCCBO.....', '.OBWLLLWCCBO....',
            '.OBBWLLLWCCBO...', '..OBBWLLLWCCBO..', '...OBBWLLLWCCBO.',
            '....OBBWLLWCCBOO', '.....OBBBCWCCBOO', '......OOOBCCBOOO',
            '.........OBCBOOO', '......OOOBCBBOOO', '....OOBCCCBBBOOO',
            '...OBCCWCCBBBOOO', '..OBCLWWCBBBOOO.', '..OBCVWCBBBOOO..',
            '..OBCVCCBBOOO...', '...OBCVCBBOO....', '...OBVVCBOO.....',
            '....OBVCBO......', '.....OBBO.......', '......OO........',
            '................', '................', '................',
            '................', '................'
        ];
        rows.forEach((row, y) => [...row].forEach((color, x) => {
            if (!palette[color]) return;
            pen.fillStyle = palette[color];
            pen.fillRect(x, y, 1, 1);
            pen.fillRect(31 - x, y, 1, 1);
        }));
        pen.fillStyle = '#d4f4ff';
        pen.fillRect(15, 14, 2, 7);
        pen.fillRect(14, 12, 1, 2);
        pen.fillRect(17, 12, 1, 2);
    });
    if (!glow || !star || !wings) return;

    const tau = Math.PI * 2;
    const random = (min, max) => min + Math.random() * (max - min);
    const edgeX = () => Math.random() < .6
        ? (Math.random() < .5 ? random(.015, .17) : random(.83, .985)) : random(.1, .9);
    const particles = Array.from({ length: 96 }, () => ({
        x: edgeX(), y: Math.random(), phase: random(0, tau), speed: random(3, 11),
        radius: random(5, 15), alpha: random(.18, .53), depth: random(.35, 1)
    }));
    const stars = Array.from({ length: 8 }, (_, index) => ({
        x: index % 2 ? random(.83, .97) : random(.025, .18),
        y: (index + .4) / 8, size: random(16, 28), phase: random(0, tau)
    }));
    const butterflies = Array.from({ length: 5 }, (_, index) => ({
        x: index % 2 ? random(.78, .93) : random(.04, .22),
        y: (index + .3) / 5, size: random(28, 46), phase: random(0, tau), speed: random(5, 10)
    }));
    const wrap = (value, length) => ((value % length) + length) % length;

    function draw() {
        if (!width || !height || destroyed) return;
        context.clearRect(0, 0, width, height);
        context.globalCompositeOperation = 'lighter';
        const parallaxX = pointer.x * 14;
        const parallaxY = pointer.y * 8;
        for (let index = 0; index < particleCount; index++) {
            const point = particles[index];
            const x = point.x * width + Math.sin(elapsed * .22 + point.phase) * 18 + parallaxX * point.depth;
            const y = wrap(point.y * height - elapsed * point.speed, height + 36) - 18 + parallaxY * point.depth;
            const size = point.radius * (1 + Math.sin(elapsed * .6 + point.phase) * .12);
            context.globalAlpha = point.alpha * (.67 + Math.sin(elapsed * .7 + point.phase) * .23);
            context.drawImage(glow, x - size, y - size, size * 2, size * 2);
        }
        for (const point of stars) {
            const size = point.size;
            const x = point.x * width + parallaxX * .3;
            const y = point.y * height + parallaxY * .3;
            context.globalAlpha = .2 + Math.pow(Math.sin(elapsed * .38 + point.phase), 2) * .55;
            context.drawImage(star, x - size / 2, y - size / 2, size, size);
        }
        for (let index = 0; index < butterflyCount; index++) {
            const butterfly = butterflies[index];
            const x = butterfly.x * width + Math.sin(elapsed * .26 + butterfly.phase) * 35 + parallaxX * .7;
            const y = wrap(butterfly.y * height - elapsed * butterfly.speed, height + 110) - 55
                + Math.sin(elapsed * .5 + butterfly.phase) * 14;
            const size = butterfly.size;
            context.globalAlpha = .23;
            context.drawImage(glow, x - size, y - size, size * 2, size * 2);
            context.save();
            context.translate(x, y);
            context.rotate(Math.sin(elapsed * .28 + butterfly.phase) * .24 - .12);
            context.scale(.35 + Math.abs(Math.sin(elapsed * 2.4 + butterfly.phase)) * .65, 1);
            context.globalAlpha = .58;
            context.drawImage(wings, -size / 2, -size / 2, size, size);
            context.restore();
        }
        context.globalAlpha = 1;
        context.globalCompositeOperation = 'source-over';
    }

    function resize() {
        if (destroyed) return;
        const nextWidth = Math.max(1, canvas.clientWidth || section.clientWidth);
        const nextHeight = Math.max(1, canvas.clientHeight || section.clientHeight);
        const nextRatio = Math.min(window.devicePixelRatio || 1, 1.25,
            Math.sqrt(2000000 / (nextWidth * nextHeight)));
        const mobile = window.innerWidth <= 720;
        particleCount = mobile ? 56 : 96;
        butterflyCount = mobile ? 3 : 5;
        frameInterval = 1000 / (mobile ? 24 : 30);
        if (nextWidth === width && nextHeight === height && nextRatio === ratio) return;
        width = nextWidth; height = nextHeight; ratio = nextRatio;
        canvas.width = Math.max(1, Math.floor(width * ratio));
        canvas.height = Math.max(1, Math.floor(height * ratio));
        context.imageSmoothingEnabled = false;
        context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
        draw();
    }

    function tick(now) {
        frame = 0;
        if (!running || destroyed) return;
        if (lastDraw === null || now >= nextDraw - .5) {
            if (lastDraw !== null) elapsed += Math.min((now - lastDraw) / 1000, .08);
            lastDraw = now;
            // Keep a stable deadline: 24 fps can alternate 2/3 display frames at 60 Hz.
            nextDraw = nextDraw ? nextDraw + Math.max(1,
                Math.floor((now - nextDraw + .5) / frameInterval) + 1) * frameInterval : now + frameInterval;
            pointer.x += (pointer.targetX - pointer.x) * .07;
            pointer.y += (pointer.targetY - pointer.y) * .07;
            draw();
        }
        frame = requestAnimationFrame(tick);
    }

    function syncAnimation() {
        const awake = !destroyed && pageActive && visible && !document.hidden && !reducedMotion.matches
            && html.dataset.motion !== 'paused' && !html.classList.contains('project-dialog-open')
            && !html.classList.contains('certificate-dialog-open');
        section.classList.toggle('is-awake', awake);
        if (awake === running) return;
        running = awake;
        cancelAnimationFrame(frame);
        frame = 0;
        lastDraw = null;
        nextDraw = 0;
        if (awake) frame = requestAnimationFrame(tick);
        else if (visible && !document.hidden) draw();
    }

    function movePointer(event) {
        if (!running || !finePointer.matches) return;
        const bounds = canvas.getBoundingClientRect();
        pointer.targetX = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
        pointer.targetY = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    }
    function resetPointer() { pointer.targetX = pointer.targetY = 0; }

    const visibilityObserver = hasVisibilityObserver ? new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        syncAnimation();
    }) : null;
    const sizeObserver = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
    const stateObserver = 'MutationObserver' in window ? new MutationObserver(syncAnimation) : null;
    visibilityObserver?.observe(section);
    sizeObserver?.observe(canvas.parentElement || section);
    stateObserver?.observe(html, { attributes: true, attributeFilter: ['class', 'data-motion'] });

    function pageHide(event) {
        pageActive = false;
        syncAnimation();
        if (event.persisted) return;
        destroyed = true;
        visibilityObserver?.disconnect(); sizeObserver?.disconnect(); stateObserver?.disconnect();
        section.removeEventListener('pointermove', movePointer);
        section.removeEventListener('pointerleave', resetPointer);
        reducedMotion.removeEventListener('change', syncAnimation);
        finePointer.removeEventListener('change', resetPointer);
        window.removeEventListener('resize', resize);
        document.removeEventListener('visibilitychange', syncAnimation);
        window.removeEventListener('portfolio:motion', syncAnimation);
        window.removeEventListener('pageshow', pageShow);
        window.removeEventListener('pagehide', pageHide);
    }
    function pageShow(event) {
        if (!event.persisted || destroyed) return;
        pageActive = true;
        resize();
        syncAnimation();
    }

    section.addEventListener('pointermove', movePointer, { passive: true });
    section.addEventListener('pointerleave', resetPointer);
    reducedMotion.addEventListener('change', syncAnimation);
    finePointer.addEventListener('change', resetPointer);
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', syncAnimation);
    window.addEventListener('portfolio:motion', syncAnimation);
    window.addEventListener('pagehide', pageHide);
    window.addEventListener('pageshow', pageShow);
    resize();
    syncAnimation();
})();
