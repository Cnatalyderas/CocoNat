/* Medusa original en una cuadrícula de 112 × 156 píxeles.
   Cada tentáculo se dibuja por separado; nunca se suavizan los píxeles. */
(() => {
    'use strict';

    const canvas = document.querySelector('.jellyfish-canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    context.imageSmoothingEnabled = false;

    const palette = ['#e8fff3', '#b9fff1', '#84f6e1', '#4edccc', '#32babe', '#288ca7', '#3a6c9e', '#535d9f', '#7966b5'];
    const bellRows = [
        [18, 47, 65], [21, 39, 73], [24, 33, 79], [27, 28, 84],
        [30, 24, 88], [33, 21, 91], [36, 18, 94], [39, 16, 96],
        [42, 14, 98], [45, 13, 99], [48, 12, 100], [51, 12, 100],
        [54, 15, 97], [57, 20, 92], [60, 28, 84]
    ];
    const strands = [
        { x: 25, length: 65, phase: .4, width: 2, back: true },
        { x: 85, length: 70, phase: 2.1, width: 2, back: true },
        { x: 39, length: 83, phase: 1.2, width: 2, back: true },
        { x: 73, length: 85, phase: 3.8, width: 2, back: true },
        { x: 32, length: 70, phase: 1.8, width: 3 },
        { x: 47, length: 88, phase: .7, width: 3 },
        { x: 63, length: 82, phase: 3.1, width: 3 },
        { x: 80, length: 63, phase: 4.5, width: 2 }
    ];
    let elapsed = 0;
    let lastTime = 0;
    let frame = 0;
    let visible = true;

    function pixel(x, y, w, h, color) {
        context.fillStyle = color;
        context.fillRect(Math.round(x), Math.round(y), w, h);
    }

    function drawStrand(strand, pulse) {
        const start = 56 + pulse;
        for (let step = 0; step < strand.length; step += 2) {
            const progress = step / strand.length;
            const sway = Math.sin(progress * 6.5 - elapsed * 1.6 + strand.phase);
            const x = strand.x + sway * (2 + progress * 8) + Math.sin(elapsed * 1.2 + strand.phase) * progress * 3;
            const color = strand.back
                ? ['#315b87', '#397c9d', '#446fa0'][Math.floor(progress * 3) % 3]
                : ['#a9fff0', '#65e3db', '#44bdcb', '#638ccc', '#b0a3ed'][Math.min(4, Math.floor(progress * 5))];
            pixel(x, start + step, strand.width, 3, color);
            if (!strand.back && step % 8 === 0) pixel(x - 1, start + step, 1, 2, '#d0fff2');
        }
    }

    function draw() {
        context.clearRect(0, 0, 112, 156);
        const cycle = Math.sin(elapsed * 2.1);
        const pulse = Math.round(cycle * 1.5);

        // Tentáculos posteriores y brazos orales ondulantes, detrás de la campana.
        strands.forEach(strand => drawStrand(strand, pulse));
        for (let arm = 0; arm < 3; arm++) {
            for (let step = 0; step < 42; step += 3) {
                const x = 42 + arm * 12 + Math.sin(step * .21 - elapsed * 1.8 + arm * 2) * (3 + step * .09);
                pixel(x, 56 + step + pulse, 5 - (step % 2), 4, arm === 1 ? '#9ba4db' : '#5bc6cb');
                pixel(x, 56 + step + pulse, 2, 3, '#a9f4e7');
            }
        }

        // Silueta escalonada, sombreado por paleta y tramado determinista.
        bellRows.forEach(([y, left, right], row) => {
            const expansion = Math.round(cycle * Math.sin(row / 14 * Math.PI) * 1.5);
            left -= expansion;
            right += expansion;
            pixel(left, y + pulse, right - left, 3, '#32658a');
            for (let x = left + 2; x < right - 2; x += 2) {
                const light = Math.hypot((x - 39) / 65, (y - 25) / 39);
                const dither = ((x * 7 + row * 13) % 11 < 3) ? .65 : 0;
                const tone = Math.min(8, Math.max(0, Math.floor(light * 5 + dither)));
                pixel(x, y + pulse, 2, 3, palette[tone]);
            }
        });

        // Reflejos y pequeñas estructuras luminosas dentro de la campana.
        [[39,25,15,2],[33,28,8,3],[28,31,6,3],[25,35,4,5],[23,42,3,5]].forEach(([x,y,w,h]) => pixel(x,y + pulse,w,h,'#caffef'));
        [[44,41],[57,38],[66,44],[53,49]].forEach(([x,y], index) => {
            const color = index % 2 ? '#b0f9e8' : '#defaeb';
            pixel(x + 2,y + pulse,4,2,color);
            pixel(x,y + 2 + pulse,8,3,color);
            pixel(x + 2,y + 5 + pulse,4,2,'#77e4d6');
        });

        // Borde ondulado en píxeles, con una franja luminosa.
        for (let x = 17; x < 96; x += 3) {
            const y = 53 + Math.round(Math.sin((x - 17) * .21) * 2) + pulse;
            pixel(x,y,3,4,x > 72 ? '#aaa4e2' : '#bdfff0');
            pixel(x,y + 4,3,3,x > 72 ? '#7772b6' : '#45b9bc');
        }

        // Pequeñas luciérnagas cuadradas flotan alrededor del sprite.
        for (let i = 0; i < 7; i++) {
            const x = 10 + ((i * 23 + Math.sin(elapsed * .5 + i) * 5) % 94);
            const y = 24 + ((i * 19 - elapsed * (2 + i % 3)) % 112 + 112) % 112;
            context.globalAlpha = .25 + (Math.sin(elapsed * 1.1 + i) + 1) * .25;
            pixel(x,y,i % 3 === 0 ? 2 : 1,i % 3 === 0 ? 2 : 1,'#c4fff0');
        }
        context.globalAlpha = 1;
    }

    function tick(time) {
        if (lastTime && time - lastTime < 1000 / 24) {
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

    if ('IntersectionObserver' in window) {
        new IntersectionObserver(entries => {
            visible = entries[0].isIntersecting;
            syncAnimation();
        }).observe(canvas);
    }
    document.addEventListener('visibilitychange', syncAnimation);
    window.addEventListener('portfolio:motion', syncAnimation);
    draw();
    syncAnimation();
})();
