/* A viewport-sized night sky: cached lights, pixel stars and quiet meteor showers. */
(() => {
    'use strict';

    const canvas = document.querySelector('.about-sky-canvas');
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const html = document.documentElement;
    const universe = canvas.closest('.about-universe');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hasObserver = 'IntersectionObserver' in window;
    const stages = [...document.querySelectorAll('.about-celestial-stage')];
    const stageVisibility = new Map(stages.map(stage => [stage, !hasObserver]));
    const random = (min, max) => min + Math.random() * (max - min);
    const tau = Math.PI * 2;
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
    let scrollDepth = Math.max(0, window.scrollY);
    let targetDepth = scrollDepth;
    let nextShower = 2.5;
    let starCount = 110;
    let moteCount = 22;
    let meteorCount = 3;
    let interval = 1000 / 30;

    function sprite(w, h, paint) {
        const bitmap = document.createElement('canvas');
        bitmap.width = w;
        bitmap.height = h;
        const pen = bitmap.getContext('2d');
        if (!pen) return null;
        paint(pen);
        return bitmap;
    }

    // Soft light is rasterized once; no animated blur filters or frame-time gradients.
    const glow = sprite(48, 48, pen => {
        const light = pen.createRadialGradient(24, 24, 0, 24, 24, 24);
        light.addColorStop(0, '#edfaff');
        light.addColorStop(.08, '#bdedffbd');
        light.addColorStop(.28, '#6da9f340');
        light.addColorStop(.65, '#5b8bdd0c');
        light.addColorStop(1, '#4f7ccf00');
        pen.fillStyle = light;
        pen.fillRect(0, 0, 48, 48);
    });
    const star = sprite(9, 9, pen => {
        pen.fillStyle = '#6899ca';
        pen.fillRect(4, 0, 1, 9);
        pen.fillRect(0, 4, 9, 1);
        pen.fillStyle = '#b9e2f7';
        pen.fillRect(3, 2, 3, 5);
        pen.fillRect(2, 3, 5, 3);
        pen.fillStyle = '#edfaff';
        pen.fillRect(3, 3, 3, 3);
    });
    const comet = sprite(192, 16, pen => {
        // Two-pixel steps make a tapered tail readable against a softly lit sky.
        for (let x = 0; x < 184; x += 4) {
            const strength = x / 184;
            pen.globalAlpha = strength * strength * .65;
            pen.fillStyle = '#9acdf8';
            const thickness = x > 136 ? 2 : 1;
            pen.fillRect(x, 8 - thickness / 2, 4, thickness);
        }
        pen.globalAlpha = 1;
        pen.fillStyle = '#c9efff';
        pen.fillRect(181, 6, 5, 4);
        pen.fillStyle = '#f5fcff';
        pen.fillRect(183, 4, 2, 8);
        pen.fillRect(180, 7, 8, 2);
    });
    if (!glow || !star || !comet) return;

    const stars = Array.from({ length: 110 }, (_, index) => ({
        x: index % 4 === 0 ? random(.015, .2) : index % 4 === 1 ? random(.8, .985) : Math.random(),
        y: Math.random(), phase: random(0, tau), alpha: random(.18, .6),
        bright: index % 13 === 0, depth: random(.15, .65)
    }));
    const motes = Array.from({ length: 22 }, () => ({
        x: Math.random(), y: Math.random(), speed: random(2, 7),
        phase: random(0, tau), size: random(8, 16), alpha: random(.12, .3)
    }));
    const meteors = Array.from({ length: 3 }, () => ({ active: false }));
    const constellations = [
        [[.035, .26], [.07, .17], [.13, .2], [.17, .12], [.21, .19]],
        [[.84, .69], [.9, .64], [.96, .72], [.92, .82], [.85, .85]]
    ];
    const wrap = (value, length) => ((value % length) + length) % length;

    function startShower() {
        if (elapsed < nextShower) return;
        for (let index = 0; index < meteorCount; index++) {
            Object.assign(meteors[index], {
                active: true, start: elapsed + index * .4,
                duration: random(1.5, 2.1), x: random(.03, .72), y: random(.03, .4),
                angle: random(.4, .58), distance: random(200, 340), length: random(100, 160)
            });
        }
        nextShower = elapsed + random(9, 14);
    }

    function draw() {
        if (!width || !height || destroyed) return;
        context.clearRect(0, 0, width, height);
        context.imageSmoothingEnabled = true;
        context.strokeStyle = '#98bfea14';
        context.lineWidth = .65;
        for (const points of constellations) {
            context.beginPath();
            points.forEach(([x, y], index) => {
                if (index) context.lineTo(x * width, y * height);
                else context.moveTo(x * width, y * height);
            });
            context.stroke();
            for (const [x, y] of points) {
                context.globalAlpha = .48;
                context.drawImage(glow, x * width - 7, y * height - 7, 14, 14);
            }
        }
        context.globalCompositeOperation = 'lighter';
        for (let index = 0; index < starCount; index++) {
            const point = stars[index];
            const x = Math.round(point.x * width);
            const y = Math.round(wrap(point.y * height - scrollDepth * point.depth * .045, height));
            const alpha = point.alpha * (.74 + Math.sin(elapsed * .48 + point.phase) * .24);
            context.globalAlpha = alpha;
            if (point.bright) {
                context.drawImage(glow, x - 16, y - 16, 32, 32);
                context.imageSmoothingEnabled = false;
                context.drawImage(star, x - 4, y - 4, 9, 9);
                context.imageSmoothingEnabled = true;
            } else {
                context.fillStyle = index % 5 ? '#b8d8f2' : '#b6b9ed';
                context.fillRect(x, y, index % 7 ? 1 : 2, 1);
            }
        }
        for (let index = 0; index < moteCount; index++) {
            const point = motes[index];
            const x = point.x * width + Math.sin(elapsed * .18 + point.phase) * 18;
            const y = wrap(point.y * height - elapsed * point.speed, height + 40) - 20;
            context.globalAlpha = point.alpha * (.7 + Math.sin(elapsed * .65 + point.phase) * .25);
            context.drawImage(glow, x - point.size, y - point.size, point.size * 2, point.size * 2);
        }
        // Reduced-motion and paused views keep stars, without a frozen meteor crossing text.
        if (running) for (const meteor of meteors) {
            if (!meteor.active) continue;
            const progress = (elapsed - meteor.start) / meteor.duration;
            if (progress < 0) continue;
            if (progress >= 1) { meteor.active = false; continue; }
            const travel = progress * meteor.distance;
            const x = meteor.x * width + Math.cos(meteor.angle) * travel;
            const y = meteor.y * height + Math.sin(meteor.angle) * travel;
            context.globalAlpha = Math.sin(progress * Math.PI) * .64;
            context.save();
            context.translate(x, y);
            context.rotate(meteor.angle);
            context.imageSmoothingEnabled = false;
            context.drawImage(comet, -meteor.length, -meteor.length / 24,
                meteor.length * 192 / 184, meteor.length * 16 / 184);
            context.imageSmoothingEnabled = true;
            context.drawImage(glow, -10, -10, 20, 20);
            context.restore();
        }
        context.globalAlpha = 1;
        context.globalCompositeOperation = 'source-over';
    }

    function resize() {
        if (destroyed) return;
        const nextWidth = Math.max(1, canvas.clientWidth || window.innerWidth);
        const nextHeight = Math.max(1, canvas.clientHeight || window.innerHeight);
        const nextRatio = Math.min(window.devicePixelRatio || 1, 1.25,
            Math.sqrt(1600000 / (nextWidth * nextHeight)));
        const mobile = nextWidth <= 720;
        starCount = mobile ? 62 : 110;
        moteCount = mobile ? 10 : 22;
        meteorCount = mobile ? 2 : 3;
        interval = 1000 / (mobile ? 24 : 30);
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
                Math.floor((now - nextDraw + .5) / interval) + 1) * interval : now + interval;
            scrollDepth += (targetDepth - scrollDepth) * .08;
            startShower();
            draw();
        }
        frame = requestAnimationFrame(tick);
    }

    function syncMotion() {
        const awake = !destroyed && pageActive && !document.hidden && !reducedMotion.matches
            && html.dataset.motion !== 'paused' && !html.classList.contains('project-dialog-open')
            && !html.classList.contains('certificate-dialog-open') && !html.classList.contains('photo-gallery-open');
        stages.forEach(stage => stage.classList.toggle('is-dreaming', awake && stageVisibility.get(stage)));
        universe?.classList.toggle('is-dreaming', awake);
        if (awake === running) return;
        running = awake;
        cancelAnimationFrame(frame);
        frame = 0; lastDraw = null; nextDraw = 0;
        if (awake) frame = requestAnimationFrame(tick);
        else if (!document.hidden) draw();
    }

    function onScroll() { targetDepth = Math.max(0, window.scrollY); }
    const stageObserver = hasObserver ? new IntersectionObserver(entries => {
        entries.forEach(entry => stageVisibility.set(entry.target, entry.isIntersecting));
        syncMotion();
    }, { rootMargin: '40px 0px', threshold: .01 }) : null;
    const sizeObserver = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
    const stateObserver = 'MutationObserver' in window ? new MutationObserver(syncMotion) : null;
    stages.forEach(stage => stageObserver?.observe(stage));
    sizeObserver?.observe(canvas);
    stateObserver?.observe(html, { attributes: true, attributeFilter: ['data-motion', 'class'] });

    function pageHide(event) {
        pageActive = false;
        syncMotion();
        if (event.persisted) return;
        destroyed = true;
        stageObserver?.disconnect(); sizeObserver?.disconnect(); stateObserver?.disconnect();
        reducedMotion.removeEventListener('change', syncMotion);
        document.removeEventListener('visibilitychange', syncMotion);
        window.removeEventListener('portfolio:motion', syncMotion);
        window.removeEventListener('resize', resize);
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('pageshow', pageShow);
        window.removeEventListener('pagehide', pageHide);
    }
    function pageShow(event) {
        if (!event.persisted || destroyed) return;
        pageActive = true;
        onScroll();
        scrollDepth = targetDepth;
        resize();
        syncMotion();
    }

    reducedMotion.addEventListener('change', syncMotion);
    document.addEventListener('visibilitychange', syncMotion);
    window.addEventListener('portfolio:motion', syncMotion);
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', pageHide);
    window.addEventListener('pageshow', pageShow);
    resize();
    syncMotion();
})();
