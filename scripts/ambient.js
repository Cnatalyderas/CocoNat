/* Polvo bioluminiscente: canvas ligero, pausado fuera del inicio. */
(() => {
    'use strict';

    const hero = document.querySelector('.hero');
    const canvas = document.querySelector('.ambient-canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    const pointer = { x: -1000, y: -1000 };
    const finePointer = window.matchMedia('(pointer: fine)');
    let width = 0;
    let height = 0;
    let particles = [];
    let frame = 0;
    let visible = true;
    let lastTime = 0;
    let elapsed = 0;

    function resize() {
        width = hero.clientWidth;
        height = hero.clientHeight;
        const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        const count = width < 640 ? 28 : 62;
        particles = Array.from({ length: count }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            size: Math.random() > .88 ? 2 : 1,
            speed: 3 + Math.random() * 10,
            phase: Math.random() * Math.PI * 2,
            alpha: .15 + Math.random() * .5,
            violet: Math.random() > .72
        }));
        draw();
    }

    function draw() {
        context.clearRect(0, 0, width, height);
        particles.forEach(particle => {
            const x = particle.x + Math.sin(elapsed * .2 + particle.phase) * 14;
            const y = ((particle.y - elapsed * particle.speed) % height + height) % height;
            const distance = Math.hypot(pointer.x - x, pointer.y - y);
            const proximity = Math.max(0, 1 - distance / 140);
            context.globalAlpha = Math.min(1, particle.alpha * (.7 + Math.sin(elapsed + particle.phase) * .3) + proximity * .6);
            context.fillStyle = particle.violet ? '#b8a6f5' : '#a3f7ed';
            context.shadowColor = particle.violet ? '#a296ff' : '#59e8da';
            context.shadowBlur = particle.size === 2 ? 10 : 3;
            context.fillRect(Math.round(x), Math.round(y), particle.size, particle.size);
            if (particle.size === 2) {
                context.globalAlpha *= .35;
                context.fillRect(Math.round(x) - 3, Math.round(y), 8, 1);
                context.fillRect(Math.round(x), Math.round(y) - 3, 1, 8);
            }
        });
        context.globalAlpha = 1;
        context.shadowBlur = 0;
    }

    function tick(time) {
        if (lastTime && time - lastTime < 1000 / 30) {
            frame = requestAnimationFrame(tick);
            return;
        }
        elapsed += lastTime ? Math.min((time - lastTime) / 1000, .08) : 0;
        lastTime = time;
        draw();
        frame = requestAnimationFrame(tick);
    }

    function syncAnimation() {
        cancelAnimationFrame(frame);
        lastTime = 0;
        if (visible && !document.hidden && document.documentElement.dataset.motion !== 'paused') {
            frame = requestAnimationFrame(tick);
        } else draw();
    }

    hero.addEventListener('pointermove', event => {
        if (!finePointer.matches || document.documentElement.dataset.motion === 'paused') return;
        const bounds = hero.getBoundingClientRect();
        pointer.x = event.clientX - bounds.left;
        pointer.y = event.clientY - bounds.top;
        hero.style.setProperty('--pointer-x', `${pointer.x}px`);
        hero.style.setProperty('--pointer-y', `${pointer.y}px`);
    }, { passive: true });
    hero.addEventListener('pointerleave', () => {
        pointer.x = pointer.y = -1000;
        hero.style.removeProperty('--pointer-x');
        hero.style.removeProperty('--pointer-y');
    });
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(entries => {
            visible = entries[0].isIntersecting;
            syncAnimation();
        }).observe(hero);
    }
    new ResizeObserver(resize).observe(hero);
    document.addEventListener('visibilitychange', syncAnimation);
    window.addEventListener('portfolio:motion', syncAnimation);
    resize();
    syncAnimation();
})();
