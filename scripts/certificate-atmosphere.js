/* An observatory sky: silver-blue constellations and occasional falling stars. */
(() => {
    'use strict';

    const section = document.querySelector('.certifications-section');
    const canvas = section?.querySelector('.certificate-sky-canvas');
    const context = canvas?.getContext('2d');
    if (!section || !canvas || !context) return;

    const html = document.documentElement;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hasVisibilityObserver = 'IntersectionObserver' in window;
    const random = (min, max) => min + Math.random() * (max - min);
    const tau = Math.PI * 2;
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
    let nextMeteorAt = 1.8;
    let starCount = 80;
    let meteorCount = 3;
    let frameInterval = 1000 / 30;

    function sprite(w, h, painter) {
        const bitmap = document.createElement('canvas');
        bitmap.width = w; bitmap.height = h;
        const pen = bitmap.getContext('2d');
        if (!pen) return null;
        painter(pen);
        return bitmap;
    }

    // The luminous gradients are rasterized once; the frame loop only composites sprites.
    const pinlight = sprite(48, 48, pen => {
        const light = pen.createRadialGradient(24, 24, 0, 24, 24, 24);
        light.addColorStop(0, '#f2faff');
        light.addColorStop(.08, '#d6eaff');
        light.addColorStop(.2, '#b4ccff73');
        light.addColorStop(.55, '#8daaff18');
        light.addColorStop(1, '#7b99ff00');
        pen.fillStyle = light;
        pen.fillRect(0, 0, 48, 48);
    });
    const shimmer = sprite(80, 80, pen => {
        const light = pen.createRadialGradient(40, 40, 0, 40, 40, 38);
        light.addColorStop(0, '#e0edff91');
        light.addColorStop(.35, '#a9c6ff26');
        light.addColorStop(1, '#7c99ff00');
        pen.fillStyle = light;
        pen.fillRect(0, 0, 80, 80);
        pen.fillStyle = '#e0efff';
        pen.beginPath();
        pen.moveTo(40, 13); pen.quadraticCurveTo(42, 37, 65, 40);
        pen.quadraticCurveTo(42, 43, 40, 67); pen.quadraticCurveTo(38, 43, 15, 40);
        pen.quadraticCurveTo(38, 37, 40, 13); pen.fill();
    });
    const streak = sprite(256, 32, pen => {
        const tail = pen.createLinearGradient(0, 16, 240, 16);
        tail.addColorStop(0, '#849bff00');
        tail.addColorStop(.35, '#9dbeff0d');
        tail.addColorStop(.8, '#b6d9ff80');
        tail.addColorStop(1, '#edf9ff');
        pen.fillStyle = tail;
        pen.beginPath(); pen.moveTo(0, 16); pen.lineTo(240, 14.7);
        pen.lineTo(240, 17.3); pen.closePath(); pen.fill();
        const head = pen.createRadialGradient(240, 16, 0, 240, 16, 16);
        head.addColorStop(0, '#ffffff');
        head.addColorStop(.12, '#dff4ff');
        head.addColorStop(.3, '#b3dcff66');
        head.addColorStop(1, '#8bb7ff00');
        pen.fillStyle = head; pen.fillRect(224, 0, 32, 32);
    });
    if (!pinlight || !shimmer || !streak) return;

    const stars = Array.from({ length: 80 }, (_, index) => ({
        x: index % 3 ? random(.02, .98) : (index % 2 ? random(.8, .98) : random(.02, .2)),
        y: Math.random(), radius: random(5, 13), alpha: random(.22, .7),
        phase: random(0, tau), bright: index % 11 === 0
    }));
    const constellations = [
        [[.055, .21], [.1, .13], [.17, .18], [.14, .3], [.2, .36]],
        [[.85, .55], [.92, .48], [.96, .59], [.9, .68], [.95, .76]]
    ];
    const meteors = Array.from({ length: 3 }, () => ({ active: false }));

    function advanceMeteors() {
        if (elapsed < nextMeteorAt) return;
        // Brief staggered showers, followed by a quiet interval, keep the sky unhurried.
        for (let index = 0; index < meteorCount; index++) {
            const meteor = meteors[index];
            meteor.active = true;
            meteor.start = elapsed + index * .35;
            meteor.duration = random(1.25, 1.85);
            meteor.x = random(.02, .65);
            meteor.y = random(.03, .58);
            meteor.length = random(90, 140);
            meteor.distance = random(220, 340);
            meteor.angle = random(.46, .67);
            meteor.cos = Math.cos(meteor.angle);
            meteor.sin = Math.sin(meteor.angle);
        }
        nextMeteorAt = elapsed + random(6.5, 10.5);
    }

    function draw() {
        if (!width || !height || destroyed) return;
        context.clearRect(0, 0, width, height);
        context.strokeStyle = '#a1bdff14';
        context.lineWidth = .7;
        for (const points of constellations) {
            context.beginPath();
            points.forEach((point, index) => {
                if (index) context.lineTo(point[0] * width, point[1] * height);
                else context.moveTo(point[0] * width, point[1] * height);
            });
            context.stroke();
            for (const point of points) {
                context.globalAlpha = .6;
                context.drawImage(pinlight, point[0] * width - 7, point[1] * height - 7, 14, 14);
            }
        }
        context.globalCompositeOperation = 'lighter';
        for (let index = 0; index < starCount; index++) {
            const star = stars[index];
            const size = star.bright ? star.radius * 2 : star.radius;
            context.globalAlpha = star.alpha * (.68 + Math.sin(elapsed * .45 + star.phase) * .25);
            context.drawImage(star.bright ? shimmer : pinlight,
                star.x * width - size / 2, star.y * height - size / 2, size, size);
        }
        // Paused and reduced-motion views retain their star map, with no frozen meteor trails.
        if (running) for (const meteor of meteors) {
            if (!meteor.active) continue;
            const progress = (elapsed - meteor.start) / meteor.duration;
            if (progress < 0) continue;
            if (progress >= 1) { meteor.active = false; continue; }
            const travel = progress * meteor.distance;
            const x = meteor.x * width + travel * meteor.cos;
            const y = meteor.y * height + travel * meteor.sin;
            context.globalAlpha = Math.sin(progress * Math.PI) * .7;
            context.save(); context.translate(x, y); context.rotate(meteor.angle);
            context.drawImage(streak, -meteor.length, -meteor.length / 16,
                meteor.length * 256 / 240, meteor.length * 32 / 240);
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
        starCount = mobile ? 48 : 80;
        meteorCount = mobile ? 2 : 3;
        frameInterval = 1000 / (mobile ? 24 : 30);
        if (nextWidth === width && nextHeight === height && nextRatio === ratio) return;
        width = nextWidth; height = nextHeight; ratio = nextRatio;
        canvas.width = Math.max(1, Math.floor(width * ratio));
        canvas.height = Math.max(1, Math.floor(height * ratio));
        context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
        draw();
    }

    function tick(now) {
        frame = 0;
        if (!running || destroyed) return;
        if (lastDraw === null || now >= nextDraw - .5) {
            if (lastDraw !== null) elapsed += Math.min((now - lastDraw) / 1000, .08);
            lastDraw = now;
            nextDraw = nextDraw ? nextDraw + Math.max(1,
                Math.floor((now - nextDraw + .5) / frameInterval) + 1) * frameInterval : now + frameInterval;
            advanceMeteors();
            draw();
        }
        frame = requestAnimationFrame(tick);
    }

    function syncAnimation() {
        const awake = !destroyed && pageActive && visible && !document.hidden && !reducedMotion.matches
            && html.dataset.motion !== 'paused' && !html.classList.contains('project-dialog-open')
            && !html.classList.contains('certificate-dialog-open');
        section.classList.toggle('sky-awake', awake);
        if (awake === running) return;
        running = awake;
        cancelAnimationFrame(frame);
        frame = 0; lastDraw = null; nextDraw = 0;
        if (awake) frame = requestAnimationFrame(tick);
        else if (visible && !document.hidden) draw();
    }

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
        reducedMotion.removeEventListener('change', syncAnimation);
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

    reducedMotion.addEventListener('change', syncAnimation);
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', syncAnimation);
    window.addEventListener('portfolio:motion', syncAnimation);
    window.addEventListener('pagehide', pageHide);
    window.addEventListener('pageshow', pageShow);
    resize();
    syncAnimation();
})();
