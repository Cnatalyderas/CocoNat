/* A small, focus-scoped sprite playground; no keys are captured elsewhere on the page. */
(() => {
    'use strict';

    // Facts already published in About Me, project details and certifications.
    const facts = [
        'Nataly is a third-year scholarship student in Programa Empresarial Supérate.',
        'She worked as a waitress at El Mesías for one month.',
        'The MechNow hackathon project started with an idea she helped develop. She also helped design its proposal.',
        'For Plant Bud, she contributed ideas, visual design and the organization of the plant catalog.',
        'She represents her institution in external activities and helps with school events and teacher support.',
        'She earned 727 points in her Microsoft Office Specialist Excel Expert certification.'
    ];

    document.querySelectorAll('.contact-playground').forEach(installCharacter);

    function installCharacter(root) {
        const canvas = root.querySelector('.contact-character-canvas');
        const context = canvas?.getContext('2d');
        const stage = root.querySelector('.contact-character-stage');
        if (!canvas || !context || !stage) return;
        const { luckyBlock, factPanel, factText } = createWorld(stage);
        const catButton = document.createElement('button');
        catButton.type = 'button';
        catButton.className = 'character-cat';
        catButton.hidden = true;
        catButton.setAttribute('aria-label', 'Sleeping cat. Move closer to pet it.');
        catButton.setAttribute('aria-disabled', 'true');
        catButton.innerHTML = '<span class="character-cat-prompt" aria-hidden="true">Pet cat <kbd>E</kbd></span>';
        const doorButton = document.createElement('button');
        doorButton.type = 'button';
        doorButton.className = 'character-door';
        doorButton.setAttribute('aria-label', "Enter Renderos' Home");
        doorButton.innerHTML = '<span class="character-door-prompt" aria-hidden="true">Enter <kbd>E</kbd></span>';
        doorButton.hidden = true;
        const exitButton = document.createElement('button');
        exitButton.type = 'button';
        exitButton.className = 'character-exit';
        exitButton.innerHTML = '<span aria-hidden="true">←</span> Outside <kbd>E</kbd>';
        exitButton.hidden = true;
        const exitHint = document.createElement('p');
        exitHint.className = 'character-exit-hint';
        exitHint.innerHTML = '<span aria-hidden="true">←</span> Walk left to go outside';
        exitHint.hidden = true;
        const photoLink = document.createElement('a');
        photoLink.className = 'character-photo';
        photoLink.href = 'assets/Sprites/important.png';
        photoLink.setAttribute('aria-label', 'Enlarge the photograph');
        photoLink.title = 'View photo';
        photoLink.hidden = true;
        stage.append(catButton, doorButton, exitButton, exitHint, photoLink);
        const html = document.documentElement;
        const buttons = [...root.querySelectorAll('[data-character-control]')];
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const keys = new Set();
        const pointers = new Map();
        const buttonKeys = new Set();
        const actions = new Map([
            ['ArrowLeft', 'left'], ['KeyA', 'left'], ['ArrowRight', 'right'], ['KeyD', 'right'],
            ['ArrowUp', 'jump'], ['KeyW', 'jump'], ['Space', 'jump'],
            ['ArrowDown', 'down'], ['KeyS', 'down'], ['KeyE', 'interact']
        ]);
        const step = 1 / 120;
        let manifest;
        let atlas;
        let companion;
        let companionAtlas;
        let roomBackground;
        let scene = 'outside';
        let viewportWidth = 0;
        let sceneOffsetX = 0;
        let sceneOffsetY = 0;
        let sceneScale = 1;
        let cameraX = 0;
        let houseCenter = 0;
        let houseLeft = 0;
        let signCenter = 0;
        let signLeft = 0;
        let doorRect;
        let travel = null;
        let catX = 0;
        let catClock = 0;
        let catFloor = 0;
        let bedLeft = 0;
        let bedRight = 0;
        let bedCenter = 0;
        let bedRise = 0;
        let tableX = 0;
        let petting = null;
        let lastPaint = 0;
        let loaded = false;
        let destroyed = false;
        let pageActive = true;
        let visible = !('IntersectionObserver' in window);
        let frame = 0;
        let lastTime = null;
        let accumulator = 0;
        let width = 0;
        let height = 0;
        let floor = 0;
        let scale = 1;
        let characterWidth = 0;
        let characterHeight = 0;
        let positioned = false;
        let x = 0;
        let y = 0;
        let vx = 0;
        let vy = 0;
        let facing = 1;
        let grounded = true;
        let coyote = .1;
        let jumpBuffer = 0;
        let preparing = false;
        let prepareTime = 0;
        let walkTime = 0;
        let animation = 'idle';
        let frameIndex = 0;
        let luckyPosition = null;
        let luckyRise = 24;
        let luckyRect;
        let luckyCooldown = 0;
        let luckyHits = 0;
        let factBag = [];
        let lastFact = -1;
        let photoOpen = false;
        let presentation = null;
        root.dataset.scene = scene;

        const pressed = action => [...keys].some(key => actions.get(key) === action)
            || [...pointers.values()].includes(action) || buttonKeys.has(action);
        const gameUnavailable = () => destroyed || !loaded || (!visible && !presentation?.active) || !pageActive || document.hidden
            || Boolean(presentation?.required && (!presentation.active || !presentation.landscape))
            || html.classList.contains('project-dialog-open') || html.classList.contains('certificate-dialog-open')
            || html.classList.contains('photo-gallery-open');
        const blocked = () => gameUnavailable() || photoOpen;
        const approach = (value, target, amount) => value + Math.sign(target - value) * Math.min(Math.abs(target - value), amount);
        const ambientMotion = () => document.hasFocus() && !reducedMotion.matches && html.dataset.motion !== 'paused';
        const supportAt = position => scene === 'inside' && companion && position >= bedLeft + 10 * scale && position <= bedRight - 10 * scale ? bedRise : 0;
        const petTarget = () => catX + companion.characterOffset * scale;
        const canPet = () => scene === 'inside' && companion && !blocked() && !petting && grounded && !preparing
            && Math.abs(x - catX) <= characterWidth / 2 + companion.width * scale / 2 + 28 * sceneScale;
        const canExit = () => scene === 'inside' && grounded && !preparing && x <= Math.min(115, width * .16);
        const nearDoor = () => scene === 'outside' && doorRect && grounded && !preparing
            && Math.abs(x - (doorRect.left + doorRect.width / 2)) < 105;
        const gameAudio = createGameAudio(root, () => !gameUnavailable() && document.hasFocus()
            && root.contains(document.activeElement));

        function changeScene(next) {
            if (blocked() || !companion || next === scene) return;
            clearInput();
            scene = next;
            root.dataset.scene = scene;
            factPanel.hidden = true;
            grounded = true; preparing = false; y = 0; vy = 0; coyote = .1;
            animation = 'idle'; frameIndex = manifest.animations.idle[0];
            resize();
            x = scene === 'inside' ? Math.max(characterWidth / 2, catX - 230 * sceneScale)
                : Math.max(characterWidth / 2, doorRect.left - 42);
            y = supportAt(x);
            facing = 1;
            if (scene === 'outside') { luckyCooldown = 0; spawnLucky(); }
            const keyboardHelp = root.querySelector('.character-keyboard-help');
            const touchHelp = root.querySelector('.character-touch-help');
            if (keyboardHelp) keyboardHelp.innerHTML = scene === 'inside'
                ? '<kbd>A</kbd> / <kbd>D</kbd> to move · <kbd>W</kbd> / <kbd>Space</kbd> to jump · Click the nearby cat or press <kbd>E</kbd> to pet it · Click the photo · Walk left to go outside'
                : '<kbd>A</kbd> / <kbd>D</kbd> to move · <kbd>W</kbd> / <kbd>Space</kbd> to jump · Click the door or press <kbd>E</kbd> nearby to enter · Hit ? for a fact';
            if (touchHelp) touchHelp.textContent = scene === 'inside'
                ? 'Get close and tap the cat to pet it · Tap the photo · Walk left to go outside.'
                : 'Move and jump · Tap the door to enter the house · Hit ? for a fact.';
            root.setAttribute('aria-label', scene === 'inside' ? 'Playable room with a sleeping cat' : 'Playable garden with a house');
            root.focus({ preventScroll: true });
            draw();
            canvas.getAnimations().forEach(effect => effect.cancel());
            if (ambientMotion()) canvas.animate([{ opacity: .25 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
            queueMicrotask(sync);
        }

        function interact() {
            if (blocked() || !companion) return;
            if (scene === 'inside') {
                if (canExit()) changeScene('outside');
                else startPetting();
            } else if (nearDoor()) changeScene('inside');
        }

        function positionHouse() {
            if (!companion) return;
            const scenery = companion.scenery;
            houseCenter = width - scenery.house.drawW * scale / 2 - 28;
            houseLeft = houseCenter - scenery.house.drawW * scale / 2;
            signCenter = houseLeft - 24 * scale - scenery.sign.drawW * scale / 2;
            signLeft = signCenter - scenery.sign.drawW * scale / 2;
            doorRect = { left: houseCenter + scenery.door.left * scale, top: floor + scenery.door.top * scale,
                width: scenery.door.width * scale, height: scenery.door.height * scale };
        }

        function placeControl(element, left, top, controlWidth, controlHeight) {
            const values = { left: sceneOffsetX + left, top: sceneOffsetY + top, width: controlWidth, height: controlHeight };
            for (const [property, value] of Object.entries(values)) {
                if (!Number.isFinite(value)) continue;
                const cssValue = `${Math.round(value)}px`;
                if (element.style[property] !== cssValue) element.style[property] = cssValue;
            }
        }

        function updateView() {
            cameraX = scene === 'inside' ? 0 : Math.max(0, Math.min(width - viewportWidth, x - viewportWidth * .42));
            if (luckyRect) {
                placeControl(luckyBlock, luckyRect.left - cameraX, luckyRect.top);
                luckyBlock.hidden = scene !== 'outside' || luckyRect.right < cameraX || luckyRect.left > cameraX + viewportWidth;
            }
            if (!companion) return;
            const offscreen = (left, size) => left + size < cameraX || left > cameraX + viewportWidth;
            const touchScale = presentation?.active ? 1 / presentation.scale : 1;
            const hitWidth = Math.max(48 * touchScale, companion.width * scale + 10);
            const hitHeight = Math.max(48 * touchScale, companion.height * scale + 8);
            placeControl(catButton, catX - hitWidth / 2 - cameraX, catFloor - hitHeight, hitWidth, hitHeight);
            catButton.hidden = scene !== 'inside' || offscreen(catX - hitWidth / 2, hitWidth);
            const photo = companion.props.photo;
            const photoWidth = Math.max(44 * touchScale, photo.drawW * scale);
            const photoHeight = Math.max(44 * touchScale, photo.drawH * scale);
            placeControl(photoLink, tableX - photoWidth / 2 - cameraX,
                floor - companion.props.tableSurface * scale - photoHeight, photoWidth, photoHeight);
            photoLink.hidden = scene !== 'inside' || offscreen(tableX - photoWidth / 2, photoWidth);
            const doorWidth = Math.max(44 * touchScale, doorRect.width);
            const doorHeight = Math.max(48 * touchScale, doorRect.height);
            placeControl(doorButton, doorRect.left - (doorWidth - doorRect.width) / 2 - cameraX,
                doorRect.top - (doorHeight - doorRect.height) / 2, doorWidth, doorHeight);
            doorButton.hidden = scene !== 'outside' || offscreen(doorRect.left, doorRect.width);
            doorButton.classList.toggle('is-near', Boolean(nearDoor()));
            exitButton.hidden = !canExit();
            exitHint.hidden = scene !== 'inside';
            placeControl(exitButton, 14, floor - characterHeight - 65 * sceneScale);
            placeControl(exitHint, 14, sceneOffsetY >= 48 ? -42 : 14);
            root.dataset.cameraX = cameraX.toFixed(2);
            root.dataset.worldWidth = width.toFixed(2);
            root.dataset.sceneWidth = viewportWidth.toFixed(2);
            root.dataset.sceneHeight = height.toFixed(2);
            root.dataset.sceneOffsetX = sceneOffsetX.toFixed(2);
            root.dataset.sceneOffsetY = sceneOffsetY.toFixed(2);
            root.dataset.sceneScale = sceneScale.toFixed(4);
            root.dataset.houseLeft = houseLeft.toFixed(2);
            root.dataset.signLeft = signLeft.toFixed(2);
            root.dataset.doorX = (doorRect.left + doorRect.width / 2).toFixed(2);
        }

        function cancelPetting() {
            if (!petting) return;
            petting = null;
            vx = 0;
            walkTime = 0;
            if (loaded) { animation = 'idle'; frameIndex = manifest.animations.idle[0]; }
        }

        function startPetting() {
            if (blocked() || !companion || scene !== 'inside') return;
            root.focus({ preventScroll: true });
            if (petting) return;
            if (!canPet()) return;
            clearInput();
            petting = { phase: 'approach', elapsed: 0 };
            root.focus({ preventScroll: true });
            wake();
        }

        function updateCatButton() {
            if (!companion) return;
            const near = Boolean(canPet());
            catButton.classList.toggle('is-near', near);
            catButton.classList.toggle('is-petting', Boolean(petting));
            const disabled = String(!near);
            if (catButton.getAttribute('aria-disabled') !== disabled) catButton.setAttribute('aria-disabled', disabled);
            const label = petting ? 'Sleeping cat' : near ? 'Pet the sleeping cat.' : 'Sleeping cat. Move closer to pet it.';
            if (catButton.getAttribute('aria-label') !== label) catButton.setAttribute('aria-label', label);
        }

        function positionCompanion() {
            if (!companion) return;
            const props = companion.props;
            const offset = 32 * scale;
            const gap = 16 * scale;
            const rightSpace = props.bed.drawW * scale / 2 - offset + gap + props.table.drawW * scale;
            const leftSpace = props.bed.drawW * scale / 2 + offset;
            const rightLimit = width - rightSpace - 28 * sceneScale;
            catX = Math.max(leftSpace + 12 * sceneScale,
                scene === 'inside' ? Math.min(rightLimit, width * .7) : rightLimit);
            bedCenter = catX - offset;
            bedLeft = bedCenter - props.bed.drawW * scale / 2;
            bedRight = bedCenter + props.bed.drawW * scale / 2;
            bedRise = props.bedRise * scale;
            catFloor = floor - bedRise;
            tableX = bedRight + gap + props.table.drawW * scale / 2;
        }

        function stopFrame() {
            cancelAnimationFrame(frame);
            frame = 0;
            lastTime = null;
            accumulator = 0;
            lastPaint = 0;
        }

        function updateButtons() {
            buttons.forEach(button => {
                const held = pressed(button.dataset.characterControl);
                button.classList.toggle('is-pressed', held);
                button.setAttribute('aria-pressed', String(held));
            });
        }

        function clearInput() {
            cancelPetting();
            travel = null;
            keys.clear();
            const capturedPointers = [...pointers.keys()];
            pointers.clear();
            capturedPointers.forEach(pointer => buttons.forEach(button => {
                try {
                    if (button.hasPointerCapture(pointer)) button.releasePointerCapture(pointer);
                } catch { /* The browser may already have cancelled this touch during rotation. */ }
            }));
            buttonKeys.clear();
            jumpBuffer = 0;
            vx = 0;
            if (preparing) { preparing = false; prepareTime = 0; }
            if (loaded && grounded) { animation = 'idle'; frameIndex = manifest.animations.idle[0]; }
            updateButtons();
        }

        function wake() {
            if (blocked() || frame) return;
            lastTime = null;
            frame = requestAnimationFrame(tick);
        }

        function sync() {
            if (blocked()) {
                clearInput();
                stopFrame();
                draw();
            } else wake();
            root.classList.toggle('is-awake', !blocked() && document.hasFocus()
                && !reducedMotion.matches && html.dataset.motion !== 'paused');
            root.classList.toggle('is-playing', !blocked() && (preparing || !grounded || Math.abs(vx) > 1));
            updateCatButton();
            gameAudio.sync();
        }

        function positionLucky() {
            const size = parseFloat(getComputedStyle(luckyBlock).width) || 36;
            const margin = size / 2 + 12;
            const lastCenter = companion ? signLeft - size / 2 - 20 : width - margin;
            const center = margin + Math.max(0, lastCenter - margin) * luckyPosition;
            const top = Math.round(floor - characterHeight - luckyRise - size);
            const left = Math.round(center - size / 2);
            luckyRect = { left, right: left + size, top, bottom: top + size };
            luckyBlock.dataset.luckyX = String(left);
            luckyBlock.dataset.luckyY = String(top);
        }

        function spawnLucky() {
            if (scene !== 'outside') return;
            const size = parseFloat(getComputedStyle(luckyBlock).width) || 36;
            const margin = size / 2 + 12;
            const positions = [.04, .19, .34, .5, .66, .81, .96];
            const lastCenter = companion ? signLeft - size / 2 - 20 : width - margin;
            const span = Math.max(0, lastCenter - margin);
            let choices = positions.filter(position =>
                (luckyPosition === null || Math.abs(position - luckyPosition) >= .28)
                && Math.abs(margin + span * position - x) > characterWidth * .75);
            if (!choices.length) choices = positions.filter(position => position !== luckyPosition);
            luckyPosition = choices[Math.floor(Math.random() * choices.length)];
            luckyRise = 24 + Math.floor(Math.random() * 4) * 2;
            positionLucky();
            luckyBlock.classList.remove('is-spent');
            luckyBlock.setAttribute('aria-disabled', 'false');
            luckyBlock.dataset.luckyState = 'ready';
        }

        function revealFact() {
            if (blocked() || scene !== 'outside' || luckyCooldown > 0) return;
            gameAudio.effect('collect');
            if (!factBag.length) {
                factBag = facts.map((_, index) => index);
                for (let index = factBag.length - 1; index > 0; index--) {
                    const other = Math.floor(Math.random() * (index + 1));
                    [factBag[index], factBag[other]] = [factBag[other], factBag[index]];
                }
                // A new shuffled set cannot immediately repeat the previous fact.
                const end = factBag.length - 1;
                if (factBag[end] === lastFact) [factBag[0], factBag[end]] = [factBag[end], factBag[0]];
            }
            lastFact = factBag.pop();
            factPanel.hidden = false;
            factText.textContent = facts[lastFact];
            if (!reducedMotion.matches && html.dataset.motion !== 'paused') {
                factPanel.getAnimations().forEach(animation => animation.cancel());
                factPanel.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }],
                    { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
            }
            luckyCooldown = 1.6;
            luckyBlock.classList.add('is-spent');
            luckyBlock.setAttribute('aria-disabled', 'true');
            luckyBlock.dataset.luckyState = 'spent';
            root.dataset.luckyHits = String(++luckyHits);
            root.dataset.luckyFact = String(lastFact);
        }

        function queueJump() {
            if (blocked()) return;
            cancelPetting();
            travel = null;
            jumpBuffer = .13;
            wake();
        }

        function update(dt) {
            if (companion && ambientMotion()) catClock += dt;
            if (scene === 'outside' && luckyCooldown > 0) {
                luckyCooldown = Math.max(0, luckyCooldown - dt);
                if (luckyCooldown === 0) spawnLucky();
            }
            if (travel) {
                const target = doorRect.left + doorRect.width / 2;
                const previous = x;
                x = approach(x, target, 200 * dt);
                vx = (x - previous) / dt;
                if (Math.abs(vx) > 1) facing = Math.sign(vx);
                y = 0; vy = 0; grounded = true;
                walkTime += dt;
                animation = 'walk';
                frameIndex = manifest.animations.walk[Math.floor(walkTime / .115) % manifest.animations.walk.length];
                if (Math.abs(x - target) < .2) changeScene('inside');
                return;
            }
            if (petting) {
                const target = petTarget();
                if (petting.phase === 'approach') {
                    const previous = x;
                    x = approach(x, target, 145 * sceneScale * dt);
                    y = approach(y, bedRise, 160 * sceneScale * dt);
                    vx = (x - previous) / dt;
                    if (Math.abs(vx) > 1) facing = Math.sign(vx);
                    walkTime += dt;
                    animation = 'walk';
                    frameIndex = manifest.animations.walk[Math.floor(walkTime / .115) % manifest.animations.walk.length];
                    if (Math.abs(x - target) < .1 && Math.abs(y - bedRise) < .1) {
                        x = target; y = bedRise; vx = 0; facing = 1;
                        petting.phase = 'petting';
                        animation = 'petting';
                    }
                } else {
                    petting.elapsed += dt;
                    animation = 'petting';
                    x = target; y = bedRise; vx = 0;
                    const duration = companion.pettingDelays.reduce((total, delay) => total + delay, 0);
                    if (petting.elapsed >= duration * 2) cancelPetting();
                }
                return;
            }
            const previousX = x;
            const previousY = y;
            const direction = Number(pressed('right')) - Number(pressed('left'));
            const speed = (scene === 'inside' ? 200 : width <= 600 ? 170 : 200) * sceneScale;
            vx = approach(vx, direction * speed, (direction ? 1800 : 2200) * sceneScale * dt);
            if (direction) facing = direction;
            x += vx * dt;
            const half = characterWidth / 2;
            const bounded = Math.max(half, Math.min(width - half, x));
            if (bounded !== x) vx = 0;
            x = bounded;
            const support = supportAt(x);
            if (grounded && y < support) y = support;
            else if (grounded && y > support + .1) { grounded = false; vy = 0; }
            jumpBuffer = Math.max(0, jumpBuffer - dt);
            coyote = grounded ? .1 : Math.max(0, coyote - dt);

            if (!preparing && jumpBuffer > 0 && coyote > 0) {
                preparing = true;
                prepareTime = 0;
                jumpBuffer = 0;
            }
            if (preparing) {
                prepareTime += dt;
                if (prepareTime >= .1) {
                    gameAudio.effect('jump');
                    preparing = false;
                    grounded = false;
                    coyote = 0;
                    const available = Math.max(8 * sceneScale, floor - characterHeight - 5 * sceneScale);
                    const jumpHeight = Math.min(95 * sceneScale, available * .9);
                    vy = Math.sqrt(2 * 1450 * sceneScale * jumpHeight) * (pressed('jump') ? 1 : .72);
                }
            }
            if (!grounded) {
                const gravity = 1450 * sceneScale * (pressed('down') && vy < 0 ? 1.9 : 1);
                vy -= gravity * dt;
                y += vy * dt;
                const ceiling = Math.max(0, floor - characterHeight - 3 * sceneScale);
                if (y > ceiling) { y = ceiling; vy = Math.min(0, vy); }
                if ((vy <= 0 && previousY >= support && y <= support) || y <= 0) {
                    y = Math.max(0, support); vy = 0; grounded = true;
                }
            }

            // The ascending head crosses the block's underside. Idle glow never moves its hitbox.
            if (scene === 'outside' && luckyRect && luckyCooldown === 0 && !grounded) {
                const headHeight = characterHeight * .9;
                const headHalfWidth = characterWidth * .28;
                const previousHead = floor - previousY - headHeight;
                const head = floor - y - headHeight;
                const overlapsX = x + headHalfWidth > luckyRect.left && x - headHalfWidth < luckyRect.right;
                if (vy > 0 && previousHead >= luckyRect.bottom && head <= luckyRect.bottom && overlapsX) {
                    y = floor - luckyRect.bottom - headHeight;
                    vy = -85;
                    revealFact();
                } else if (head < luckyRect.bottom && floor - y > luckyRect.top) {
                    if (previousX + headHalfWidth <= luckyRect.left && x + headHalfWidth > luckyRect.left) {
                        x = luckyRect.left - headHalfWidth; vx = 0;
                    } else if (previousX - headHalfWidth >= luckyRect.right && x - headHalfWidth < luckyRect.right) {
                        x = luckyRect.right + headHalfWidth; vx = 0;
                    }
                }
            }

            if (preparing) {
                animation = 'jump';
                frameIndex = manifest.animations.jump[prepareTime < .035 ? 0 : Math.min(1, manifest.animations.jump.length - 1)];
            } else if (!grounded) {
                animation = 'jump';
                const phase = Math.abs(vy) < 90 * sceneScale ? 3 : vy > 0 ? 2 : 4;
                frameIndex = manifest.animations.jump[Math.min(phase, manifest.animations.jump.length - 1)];
            } else if (Math.abs(vx) > 6 * sceneScale) {
                animation = 'walk';
                walkTime += dt * Math.abs(vx) / speed;
                frameIndex = manifest.animations.walk[Math.floor(walkTime / .115) % manifest.animations.walk.length];
            } else {
                animation = 'idle';
                walkTime = 0;
                frameIndex = manifest.animations.idle[0];
            }
        }

        function timedFrame(delays, elapsed) {
            const duration = delays.reduce((total, delay) => total + delay, 0);
            let time = elapsed % duration;
            for (let index = 0; index < delays.length; index++) {
                if (time < delays[index]) return index;
                time -= delays[index];
            }
            return 0;
        }

        function drawCompanionSprite(sprite, anchorX, anchorY, factor = 1) {
            context.drawImage(companionAtlas, sprite.x, sprite.y, sprite.w, sprite.h,
                Math.round(anchorX + sprite.offsetX * scale * factor), Math.round(anchorY + sprite.offsetY * scale * factor),
                sprite.drawW * scale * factor, sprite.drawH * scale * factor);
        }

        function drawHouse() {
            const scenery = companion.scenery;
            drawCompanionSprite(scenery.sign, signCenter, floor);
            drawCompanionSprite(scenery.house, houseCenter, floor);
            const chimneyX = houseCenter + scenery.chimney.x * scale;
            const chimneyY = floor + scenery.chimney.y * scale;
            for (let index = 0; index < (ambientMotion() ? 3 : 1); index++) {
                const phase = ambientMotion() ? (catClock / 3.8 + index / 3) % 1 : .35;
                context.globalAlpha = ambientMotion() ? Math.sin(phase * Math.PI) * .55 : .75;
                drawCompanionSprite(scenery.smoke, chimneyX + phase * 21 * scale,
                    chimneyY - phase * 24 * scale, .45 + phase * .55);
            }
            context.globalAlpha = 1;
        }

        function drawCharacter() {
            const sprite = manifest.frames[frameIndex];
            const flip = facing < 0 && (animation === 'walk'
                || animation === 'jump' && manifest.character.flipJump !== false
                || animation === 'idle' && manifest.character.flipIdle === true);
            context.save();
            context.translate(Math.round(x), Math.round(floor - y));
            if (flip) context.scale(-1, 1);
            const dx = -characterWidth / 2 + (sprite.offsetX || 0) * scale;
            const dy = -characterHeight + (sprite.offsetY || 0) * scale;
            context.drawImage(atlas, sprite.x, sprite.y, sprite.w, sprite.h,
                Math.round(dx), Math.round(dy), (sprite.drawW || sprite.w) * scale, (sprite.drawH || sprite.h) * scale);
            context.restore();
        }

        function drawSleepLetters() {
            const glyph = companion.z;
            for (let index = 0; index < 3; index++) {
                const phase = ambientMotion() ? (catClock / 2.9 + index / 3) % 1 : (index + .5) / 3;
                const size = (9 + phase * 7) * scale;
                const left = catX - 23 * scale + phase * 24 * scale;
                const top = catFloor - (companion.height + 4 + phase * 38) * scale;
                context.globalAlpha = ambientMotion() ? Math.sin(phase * Math.PI) * .9 : .7;
                context.drawImage(companionAtlas, glyph.x, glyph.y, glyph.w, glyph.h,
                    Math.round(left), Math.round(top), size, size * glyph.drawH);
            }
            context.globalAlpha = 1;
        }

        function draw() {
            if (!loaded || !width || !height || destroyed) return;
            updateView();
            context.clearRect(0, 0, viewportWidth, height);
            context.imageSmoothingEnabled = false;
            context.save();
            context.translate(-Math.round(cameraX), 0);
            if (scene === 'inside' && roomBackground) {
                // Fit the complete source image without cropping; the outer stage supplies black bars.
                const backgroundScale = Math.min(width / roomBackground.naturalWidth, height / roomBackground.naturalHeight);
                const backgroundWidth = roomBackground.naturalWidth * backgroundScale;
                const backgroundHeight = roomBackground.naturalHeight * backgroundScale;
                context.drawImage(roomBackground, (width - backgroundWidth) / 2, (height - backgroundHeight) / 2,
                    backgroundWidth, backgroundHeight);
            }
            else if (companion) drawHouse();
            const pettingNow = petting?.phase === 'petting';
            if (companion && scene === 'inside') {
                const props = companion.props;
                drawCompanionSprite(props.table, tableX, floor);
                drawCompanionSprite(props.photo, tableX, floor - props.tableSurface * scale);
                drawCompanionSprite(props.bed, bedCenter, floor);
                const sleepingIndex = companion.sleepSequence[timedFrame(companion.sleepDelays, catClock)];
                const catFrame = pettingNow ? timedFrame(companion.pettingDelays, petting.elapsed) : sleepingIndex;
                drawCompanionSprite(pettingNow ? companion.petting[catFrame]
                    : ambientMotion() ? companion.sleeping[sleepingIndex] : companion.base, catX, catFloor);
                root.dataset.catState = petting ? petting.phase : 'sleeping';
                root.dataset.catFrame = String(catFrame);
                root.dataset.catX = catX.toFixed(2);
                root.dataset.catFloor = catFloor.toFixed(2);
                root.dataset.catClock = catClock.toFixed(3);
            }
            if (!pettingNow) drawCharacter();
            if (companion && scene === 'inside') {
                // The front cushion overlaps the paws, keeping the cat inside its bed.
                drawCompanionSprite(companion.props.bedFront, bedCenter, floor);
                drawSleepLetters();
                updateCatButton();
            }
            context.restore();
            if (scene === 'outside') root.dataset.catState = 'inside-house';
            root.dataset.worldClock = catClock.toFixed(3);
            root.dataset.characterState = preparing ? 'prepare' : animation;
            root.dataset.characterX = x.toFixed(2);
            root.dataset.characterY = y.toFixed(2);
            root.dataset.characterFrame = String(frameIndex);
            root.classList.toggle('is-playing', Boolean(petting) || preparing || !grounded || Math.abs(vx) > 1);
        }

        function tick(now) {
            frame = 0;
            if (blocked()) { sync(); return; }
            const delta = lastTime === null ? step : Math.min(.05, (now - lastTime) / 1000);
            lastTime = now;
            accumulator += delta;
            while (accumulator >= step) { update(step); accumulator -= step; }
            const playing = travel || petting || preparing || !grounded || Math.abs(vx) > .1 || pressed('left') || pressed('right') || jumpBuffer > 0 || (scene === 'outside' && luckyCooldown > 0);
            if (playing || !lastPaint || now - lastPaint >= 1000 / 24) { draw(); lastPaint = now; }
            if (playing || companion && ambientMotion()) {
                frame = requestAnimationFrame(tick);
            } else { lastTime = null; accumulator = 0; }
        }

        function resize() {
            if (destroyed || presentation?.required && !presentation.active) return;
            const previousWidth = width;
            const previousSceneScale = sceneScale;
            const stageWidth = Math.max(1, stage.clientWidth);
            const stageHeight = Math.max(1, stage.clientHeight);
            if (scene === 'inside') {
                const roomAspect = roomBackground?.naturalWidth / roomBackground?.naturalHeight || 16 / 9;
                // Keep the complete room inset, with breathing room on every edge of the outer arena.
                viewportWidth = Math.min(stageWidth * .94, stageHeight * .84 * roomAspect);
                height = viewportWidth / roomAspect;
                sceneOffsetX = (stageWidth - viewportWidth) / 2;
                sceneOffsetY = (stageHeight - height) / 2;
                // The room image fits its frame independently; actors retain the outdoor scale.
                sceneScale = 1;
                canvas.style.width = `${viewportWidth}px`;
                canvas.style.height = `${height}px`;
                canvas.style.left = `${sceneOffsetX}px`;
                canvas.style.top = `${sceneOffsetY}px`;
                width = viewportWidth;
            } else {
                viewportWidth = stageWidth;
                height = stageHeight;
                sceneOffsetX = 0; sceneOffsetY = 0; sceneScale = 1;
                ['width', 'height', 'left', 'top'].forEach(property => canvas.style.removeProperty(property));
                width = Math.max(viewportWidth, 900);
            }
            const ratio = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.round(viewportWidth * ratio);
            canvas.height = Math.round(height * ratio);
            context.setTransform(canvas.width / viewportWidth, 0, 0, canvas.height / height, 0, 0);
            const css = getComputedStyle(root);
            floor = Math.max(0, height - (parseFloat(css.getPropertyValue('--character-ground')) || 20) * sceneScale);
            if (loaded) {
                const desiredHeight = parseFloat(css.getPropertyValue('--character-height'));
                scale = (desiredHeight > 0 ? desiredHeight / manifest.character.height
                    : parseFloat(css.getPropertyValue('--character-scale')) || 1) * sceneScale;
                scale = Math.min(scale, (width - 12) / manifest.character.width, (floor - 8) / manifest.character.height);
                if (companion) scale = Math.min(scale,
                    (width - 24) / (companion.props.bed.drawW + companion.props.table.drawW + 16));
                scale = Math.max(.01, scale);
                characterWidth = manifest.character.width * scale;
                characterHeight = manifest.character.height * scale;
                positionCompanion();
                positionHouse();
                x = positioned && previousWidth ? x / previousWidth * width : width * .18;
                if (positioned) {
                    const relativeScale = sceneScale / previousSceneScale;
                    y *= relativeScale; vy *= relativeScale; vx *= relativeScale;
                }
                positioned = true;
                x = Math.max(characterWidth / 2, Math.min(width - characterWidth / 2, x));
                y = Math.min(y, Math.max(0, floor - characterHeight - 3));
                if (petting?.phase === 'petting') { x = petTarget(); y = bedRise; }
                else if (grounded && !petting) y = supportAt(x);
                if (scene === 'outside') {
                    if (luckyPosition === null) spawnLucky();
                    else positionLucky();
                }
                draw();
            }
        }

        function isControl(target) {
            return target instanceof Element && Boolean(target.closest('a,button,input,textarea,select,[contenteditable="true"],[role="textbox"]'));
        }

        function keyDown(event) {
            const action = actions.get(event.code);
            if (!action || blocked() || isControl(event.target)) return;
            if (document.activeElement !== root && document.activeElement !== canvas) return;
            event.preventDefault();
            if (action === 'interact') { if (!event.repeat) interact(); return; }
            if (event.repeat || keys.has(event.code)) return;
            cancelPetting();
            travel = null;
            const wasJumping = pressed('jump');
            keys.add(event.code);
            if (action === 'jump' && !wasJumping) queueJump();
            updateButtons();
            wake();
        }

        function keyUp(event) {
            if (!keys.delete(event.code)) return;
            updateButtons();
            wake();
        }

        function pointerUp(event) {
            if (!pointers.delete(event.pointerId)) return;
            updateButtons();
            wake();
        }

        buttons.forEach(button => {
            button.disabled = true;
            button.addEventListener('pointerdown', event => {
                if (blocked() || event.button !== 0) return;
                event.preventDefault();
                root.focus({ preventScroll: true });
                cancelPetting();
                travel = null;
                const action = button.dataset.characterControl;
                const wasJumping = pressed('jump');
                pointers.set(event.pointerId, action);
                try { button.setPointerCapture(event.pointerId); } catch { /* Window-level release is also installed. */ }
                if (action === 'jump' && !wasJumping) queueJump();
                updateButtons(); wake();
            });
            button.addEventListener('lostpointercapture', pointerUp);
            button.addEventListener('keydown', event => {
                if (!['Space', 'Enter'].includes(event.code) || blocked()) return;
                event.preventDefault();
                const action = button.dataset.characterControl;
                if (event.repeat || buttonKeys.has(action)) return;
                cancelPetting();
                travel = null;
                const wasJumping = pressed('jump');
                buttonKeys.add(action);
                if (action === 'jump' && !wasJumping) queueJump();
                updateButtons(); wake();
            });
            button.addEventListener('keyup', event => {
                if (!['Space', 'Enter'].includes(event.code)) return;
                event.preventDefault();
                buttonKeys.delete(button.dataset.characterControl);
                updateButtons(); wake();
            });
            button.addEventListener('blur', () => { buttonKeys.clear(); updateButtons(); wake(); });
            button.addEventListener('contextmenu', event => event.preventDefault());
        });

        // Clicking/keyboard activation also makes the discovery accessible without a timed jump.
        luckyBlock.addEventListener('click', () => {
            if (blocked()) return;
            root.focus({ preventScroll: true });
            revealFact();
            wake();
        });
        catButton.addEventListener('click', startPetting);
        doorButton.addEventListener('click', () => {
            if (blocked() || scene !== 'outside' || !companion) return;
            root.focus({ preventScroll: true });
            if (!grounded || preparing) return;
            clearInput();
            travel = { target: 'house' };
            wake();
        });
        exitButton.addEventListener('click', () => {
            if (!blocked() && canExit()) changeScene('outside');
        });

        const photoOverlay = document.createElement('div');
        photoOverlay.className = 'character-keepsake-overlay';
        photoOverlay.hidden = true;
        const photoDialog = document.createElement('dialog');
        photoDialog.className = 'character-keepsake-dialog';
        photoDialog.setAttribute('aria-label', 'Photograph');
        photoDialog.innerHTML = '<div class="character-keepsake-shell"><div class="character-keepsake-bar"><span>Photo</span><button type="button" aria-label="Close photograph" autofocus>×</button></div><img alt="Portrait of a woman holding a cat, in a wooden frame with pink flowers." width="1254" height="1254"><p role="status" hidden>Loading photograph…</p></div>';
        photoOverlay.append(photoDialog);
        stage.append(photoOverlay);
        const keepsakeImage = photoDialog.querySelector('img');
        const keepsakeStatus = photoDialog.querySelector('[role="status"]');
        const keepsakeClose = photoDialog.querySelector('button');
        let photoBackground = [];
        let photoBackdropStart = false;

        function closePhoto(restoreFocus = true) {
            if (!photoOpen) return;
            photoOpen = false;
            root.dataset.photoOpen = 'false';
            if (photoDialog.open) photoDialog.close();
            photoOverlay.hidden = true;
            photoBackground.forEach(({ element, inert }) => { element.inert = inert; });
            photoBackground = [];
            if (restoreFocus && !destroyed) photoLink.focus({ preventScroll: true });
            sync();
        }

        if (typeof photoDialog.show === 'function') {
            photoLink.setAttribute('aria-haspopup', 'dialog');
            photoLink.addEventListener('click', event => {
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                if (blocked() || scene !== 'inside' || photoDialog.open) return;
                keepsakeStatus.textContent = 'Loading photograph…';
                keepsakeStatus.hidden = keepsakeImage.complete && keepsakeImage.naturalWidth > 0;
                keepsakeImage.src = photoLink.href;
                clearInput();
                photoOpen = true;
                root.dataset.photoOpen = 'true';
                photoOverlay.hidden = false;
                photoBackground = [...stage.children, root.querySelector('.contact-character-toolbar')]
                    .filter(element => element && element !== photoOverlay)
                    .map(element => ({ element, inert: element.inert }));
                photoBackground.forEach(({ element }) => { element.inert = true; });
                // A local, non-top-layer dialog stays inside the game and keeps its audio session active.
                photoDialog.show();
                keepsakeClose.focus({ preventScroll: true });
                sync();
            });
            keepsakeImage.addEventListener('load', () => { keepsakeStatus.hidden = true; });
            keepsakeImage.addEventListener('error', () => {
                keepsakeStatus.textContent = 'This photograph could not load. Please try again.';
                keepsakeStatus.hidden = false;
            });
            keepsakeClose.addEventListener('click', () => closePhoto());
            photoOverlay.addEventListener('pointerdown', event => { photoBackdropStart = event.target === photoOverlay; });
            photoOverlay.addEventListener('click', event => {
                if (photoBackdropStart && event.target === photoOverlay) closePhoto();
                photoBackdropStart = false;
            });
            photoDialog.addEventListener('keydown', event => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    closePhoto();
                } else if (event.key === 'Tab') {
                    event.preventDefault();
                    keepsakeClose.focus({ preventScroll: true });
                } else if (event.key.startsWith('Arrow')) event.preventDefault();
            });
            photoDialog.addEventListener('close', () => {
                if (!photoDialog.open) closePhoto();
            });
        }

        presentation = createMobilePresentation(root, stage, {
            change() { clearInput(); resize(); sync(); },
            exit() { closePhoto(false); clearInput(); gameAudio.pause(); stopFrame(); }
        });

        root.addEventListener('keydown', keyDown);
        root.addEventListener('pointerdown', event => {
            if (event.target === canvas || event.target === root) root.focus({ preventScroll: true });
        });
        root.addEventListener('focusout', event => {
            if (!root.contains(event.relatedTarget)) { clearInput(); wake(); }
            else if (isControl(event.relatedTarget)) { keys.clear(); updateButtons(); wake(); }
        });
        document.addEventListener('keyup', keyUp);
        window.addEventListener('pointerup', pointerUp);
        window.addEventListener('pointercancel', pointerUp);
        window.addEventListener('blur', onBlur);
        window.addEventListener('focus', sync);
        document.addEventListener('visibilitychange', sync);
        window.addEventListener('portfolio:overlay', sync);
        window.addEventListener('portfolio:motion', sync);
        reducedMotion.addEventListener('change', sync);
        window.addEventListener('resize', resize, { passive: true });

        function onBlur() { gameAudio.pause(); clearInput(); stopFrame(); draw(); root.classList.remove('is-playing', 'is-awake'); }
        const visibilityObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
            visible = entries[0].isIntersecting;
            sync();
        }, { threshold: .01 }) : null;
        const sizeObserver = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
        const stateObserver = 'MutationObserver' in window ? new MutationObserver(sync) : null;
        visibilityObserver?.observe(root);
        sizeObserver?.observe(canvas);
        stateObserver?.observe(html, { attributes: true, attributeFilter: ['class', 'data-motion'] });

        function pageHide(event) {
            pageActive = false;
            presentation.leave();
            closePhoto(false);
            sync();
            if (event.persisted) return;
            destroyed = true;
            presentation.destroy();
            gameAudio.destroy();
            visibilityObserver?.disconnect(); sizeObserver?.disconnect(); stateObserver?.disconnect();
            document.removeEventListener('keyup', keyUp);
            window.removeEventListener('pointerup', pointerUp);
            window.removeEventListener('pointercancel', pointerUp);
            window.removeEventListener('blur', onBlur);
            window.removeEventListener('focus', sync);
            document.removeEventListener('visibilitychange', sync);
            window.removeEventListener('portfolio:overlay', sync);
            window.removeEventListener('portfolio:motion', sync);
            reducedMotion.removeEventListener('change', sync);
            window.removeEventListener('resize', resize);
            window.removeEventListener('pagehide', pageHide);
            window.removeEventListener('pageshow', pageShow);
        }
        function pageShow(event) {
            if (!event.persisted || destroyed) return;
            pageActive = true;
            resize(); sync();
        }
        window.addEventListener('pagehide', pageHide);
        window.addEventListener('pageshow', pageShow);

        async function load() {
            root.setAttribute('aria-busy', 'true');
            try {
                const manifestURL = new URL(root.dataset.spriteManifest || 'assets/Sprites/character-atlas.json', document.baseURI);
                const embedded = root.querySelector('script[data-character-manifest]')
                    || document.querySelector('script[data-character-manifest]');
                if (embedded) manifest = JSON.parse(embedded.textContent);
                else {
                    const response = await fetch(manifestURL);
                    if (!response.ok) throw new Error('Sprite manifest unavailable');
                    manifest = await response.json();
                }
                if (!(manifest.character?.width > 0) || !(manifest.character?.height > 0)
                    || !Array.isArray(manifest.frames) || !manifest.frames.length
                    || ['idle', 'walk', 'jump'].some(name => !Array.isArray(manifest.animations?.[name])
                        || !manifest.animations[name].length
                        || manifest.animations[name].some(index => !Number.isInteger(index) || !manifest.frames[index]))) {
                    throw new Error('Invalid sprite manifest');
                }
                atlas = new Image();
                atlas.decoding = 'async';
                atlas.src = new URL(manifest.image, manifestURL).href;
                await atlas.decode();
                if (destroyed) return;
                if (manifest.frames.some(sprite => !(sprite.w > 0) || !(sprite.h > 0)
                    || !(sprite.x >= 0) || !(sprite.y >= 0)
                    || sprite.x + sprite.w > atlas.naturalWidth || sprite.y + sprite.h > atlas.naturalHeight)) {
                    throw new Error('Sprite rectangle outside atlas');
                }
                if (manifest.companion) {
                    try {
                        const supplied = manifest.companion;
                        companionAtlas = new Image();
                        companionAtlas.src = new URL(supplied.image, manifestURL).href;
                        await companionAtlas.decode();
                        const frames = [supplied.base, supplied.z, ...supplied.sleeping, ...supplied.petting,
                            supplied.props.bed, supplied.props.bedFront, supplied.props.table, supplied.props.photo,
                            supplied.scenery.house, supplied.scenery.smoke, supplied.scenery.sign];
                        if (!(supplied.width > 0) || !(supplied.height > 0) || !Number.isFinite(supplied.characterOffset)
                            || !supplied.petting.length || !supplied.sleepSequence.length
                            || !(supplied.props.bedRise > 0) || !(supplied.props.tableSurface > 0)
                            || supplied.petting.length !== supplied.pettingDelays.length
                            || supplied.sleepSequence.length !== supplied.sleepDelays.length
                            || supplied.sleepSequence.some(index => !Number.isInteger(index) || !supplied.sleeping[index])
                            || [...supplied.sleepDelays, ...supplied.pettingDelays].some(delay => !(delay > 0) || !Number.isFinite(delay))
                            || frames.some(sprite => !sprite || !(sprite.w > 0) || !(sprite.h > 0)
                                || sprite.x < 0 || sprite.y < 0 || sprite.x + sprite.w > companionAtlas.naturalWidth
                                || sprite.y + sprite.h > companionAtlas.naturalHeight
                                || ![sprite.offsetX, sprite.offsetY, sprite.drawW, sprite.drawH].every(Number.isFinite)
                                || !(sprite.drawW > 0) || !(sprite.drawH > 0))) throw new Error('Invalid companion atlas');
                        roomBackground = new Image();
                        roomBackground.src = new URL(supplied.scenery.background, manifestURL).href;
                        await roomBackground.decode();
                        photoLink.href = new URL(supplied.scenery.picture, manifestURL).href;
                        companion = supplied;
                    } catch { /* The character remains playable if the optional scenery cannot load. */ }
                }
                if (destroyed) return;
                loaded = true;
                frameIndex = manifest.animations.idle[0];
                root.hidden = false;
                root.classList.add('is-ready');
                buttons.forEach(button => { button.disabled = false; });
                catButton.hidden = true;
                resize(); sync();
            } catch {
                if (destroyed) return;
                root.classList.add('has-error');
            } finally {
                if (!destroyed) root.setAttribute('aria-busy', 'false');
            }
        }

        resize();
        load();
    }

    function createMobilePresentation(root, stage, callbacks) {
        const mobile = window.matchMedia('(pointer: coarse), (max-width: 1024px) and (any-pointer: coarse)');
        const events = new AbortController();
        const frame = document.createElement('div');
        frame.className = 'character-game-frame';
        stage.before(frame);
        frame.append(stage);
        const launcher = document.createElement('div');
        launcher.className = 'character-mobile-launcher';
        launcher.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="13" width="36" height="22" rx="4"/><path d="M12 24h8m-4-4v8m16-6h.01M36 27h.01"/></svg><h3>Play in landscape</h3><p>Turn your phone sideways for the full game.</p><button type="button">Play full screen <span aria-hidden="true">↗</span></button>';
        const bar = document.createElement('div');
        bar.className = 'character-mobile-bar';
        bar.innerHTML = '<button type="button" aria-label="Exit game">Exit game <span aria-hidden="true">×</span></button>';
        const rotate = document.createElement('div');
        rotate.className = 'character-mobile-rotate';
        rotate.setAttribute('role', 'status');
        rotate.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="23" y="14" width="20" height="36" rx="4"/><path d="M11 30a22 22 0 0 1 39-12m-1-9 2 10-10-1M53 34a22 22 0 0 1-39 12m1 9-2-10 10 1"/></svg><h3>Turn your phone sideways</h3><p>The game is paused until you rotate to landscape.</p>';
        root.append(launcher, bar, rotate);
        const playButton = launcher.querySelector('button');
        const exitButton = bar.querySelector('button');
        const toolbar = root.querySelector('.contact-character-toolbar');
        const html = document.documentElement;
        const role = root.getAttribute('role');
        let active = false;
        let landscape = false;
        let scale = 1;
        let revision = 0;
        let nativeFullscreen = false;
        let nativeExit = null;
        let orientationLocked = false;
        let placeholder = null;
        let background = [];
        let scrollPosition = null;
        let layoutFrame = 0;
        let destroyed = false;
        const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;

        function exitNative() {
            if (fullscreenElement() !== root) return;
            try {
                const exit = document.exitFullscreen || document.webkitExitFullscreen;
                const pending = Promise.resolve(exit?.call(document)).catch(() => {});
                nativeExit = pending;
                playButton.disabled = true;
                pending.finally(() => {
                    if (nativeExit !== pending) return;
                    nativeExit = null;
                    playButton.disabled = false;
                });
            } catch { /* The fixed viewport is restored independently of the native API. */ }
        }

        function update() {
            if (destroyed) return;
            launcher.hidden = !mobile.matches || active;
            root.classList.toggle('is-mobile-mode', mobile.matches);
            bar.hidden = rotate.hidden = !active;
            if (!active) {
                frame.inert = mobile.matches;
                callbacks.change();
                return;
            }
            const width = root.clientWidth;
            const height = root.clientHeight;
            landscape = width > height;
            root.classList.toggle('is-portrait', !landscape);
            rotate.hidden = landscape;
            frame.inert = !landscape;
            const barStyle = getComputedStyle(bar);
            const toolbarStyle = getComputedStyle(toolbar);
            const availableWidth = Math.max(1, width - Math.max(12, parseFloat(barStyle.paddingLeft) || 0)
                - Math.max(12, parseFloat(barStyle.paddingRight) || 0));
            const top = bar.offsetHeight + 8;
            const availableHeight = Math.max(1, height - top - toolbar.offsetHeight
                - (parseFloat(toolbarStyle.bottom) || 8) - 8);
            // Keep the exact 1160 x 420 desktop arena. Only its presentation is scaled.
            scale = Math.min(availableWidth / 1160, availableHeight / 420);
            root.style.setProperty('--mobile-game-scale', String(scale));
            frame.style.width = `${1160 * scale}px`;
            frame.style.height = `${420 * scale}px`;
            frame.style.left = `${(width - 1160 * scale) / 2}px`;
            frame.style.top = `${top + (availableHeight - 420 * scale) / 2}px`;
            callbacks.change();
        }

        function scheduleLayout() {
            if (layoutFrame || destroyed) return;
            layoutFrame = requestAnimationFrame(() => { layoutFrame = 0; update(); });
        }

        function leave(closeNative = true) {
            if (!active) return;
            active = false;
            ++revision;
            callbacks.exit();
            if (orientationLocked) {
                try { screen.orientation.unlock(); } catch { /* Unlocking is optional. */ }
                orientationLocked = false;
            }
            if (closeNative) exitNative();
            nativeFullscreen = false;
            root.classList.remove('is-mobile-session', 'is-portrait');
            html.classList.remove('character-mobile-open');
            root.removeAttribute('aria-modal');
            if (role) root.setAttribute('role', role);
            else root.removeAttribute('role');
            background.forEach(({ element, inert }) => { element.inert = inert; });
            background = [];
            if (placeholder?.isConnected) placeholder.replaceWith(root);
            placeholder = null;
            frame.removeAttribute('style');
            root.style.removeProperty('--mobile-game-scale');
            update();
            if (scrollPosition) {
                const position = scrollPosition;
                const ticket = revision;
                const restoreScroll = () => {
                    if (active || destroyed || ticket !== revision) return;
                    window.scrollTo({ left: position.x, top: position.y, behavior: 'instant' });
                };
                restoreScroll();
                // Native fullscreen exit may restore the browser's own earlier scroll position.
                if (nativeExit) nativeExit.then(restoreScroll);
                scrollPosition = null;
            }
            if (mobile.matches && playButton.isConnected) playButton.focus({ preventScroll: true });
        }

        async function enter() {
            if (destroyed || active || nativeExit || !mobile.matches) return;
            const ticket = ++revision;
            scrollPosition = { x: window.scrollX, y: window.scrollY };
            placeholder = document.createComment('Game returns here after leaving fullscreen.');
            root.before(placeholder);
            document.body.append(root);
            background = [...document.body.children].filter(element => element !== root)
                .map(element => ({ element, inert: element.inert }));
            background.forEach(({ element }) => { element.inert = true; });
            active = true;
            root.classList.add('is-mobile-session');
            root.setAttribute('role', 'dialog');
            root.setAttribute('aria-modal', 'true');
            html.classList.add('character-mobile-open');
            root.focus({ preventScroll: true });
            update();
            // These APIs require a user gesture and are not available in every mobile browser.
            try {
                const request = root.requestFullscreen || root.webkitRequestFullscreen;
                if (request) await request.call(root, { navigationUI: 'hide' });
            } catch { /* The screen-filling layout and mandatory rotation gate remain usable. */ }
            if (destroyed || !active || ticket !== revision) {
                if (!active) exitNative();
                return;
            }
            nativeFullscreen = fullscreenElement() === root;
            try {
                if (typeof screen.orientation?.lock === 'function') {
                    await screen.orientation.lock('landscape');
                    if (active) orientationLocked = true;
                    else screen.orientation.unlock();
                }
            } catch { /* Unsupported orientation locks use the visible rotation gate. */ }
            if (active && ticket === revision) update();
        }

        function fullscreenChanged() {
            if (!active) return;
            if (fullscreenElement() === root) nativeFullscreen = true;
            else if (nativeFullscreen) { leave(false); return; }
            scheduleLayout();
        }

        playButton.addEventListener('click', enter, { signal: events.signal });
        exitButton.addEventListener('click', () => leave(), { signal: events.signal });
        root.addEventListener('keydown', event => {
            if (!active || event.defaultPrevented) return;
            if (event.key === 'Escape' && !root.querySelector('.character-keepsake-dialog[open]')) {
                event.preventDefault();
                leave();
            } else if (event.key === 'Tab') {
                const focusable = [...root.querySelectorAll('button, a[href], [tabindex="0"]')]
                    .filter(element => !element.disabled && !element.closest('[inert]')
                        && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
                const index = focusable.indexOf(document.activeElement);
                const next = event.shiftKey ? (index <= 0 ? focusable.at(-1) : focusable[index - 1])
                    : focusable[(index + 1) % focusable.length];
                if (next) { event.preventDefault(); next.focus({ preventScroll: true }); }
            }
        }, { signal: events.signal });
        mobile.addEventListener('change', () => {
            if (!mobile.matches && active) leave();
            update();
        }, { signal: events.signal });
        window.addEventListener('resize', scheduleLayout, { signal: events.signal, passive: true });
        window.visualViewport?.addEventListener('resize', scheduleLayout, { signal: events.signal, passive: true });
        document.addEventListener('fullscreenchange', fullscreenChanged, { signal: events.signal });
        document.addEventListener('webkitfullscreenchange', fullscreenChanged, { signal: events.signal });
        const controller = {
            get required() { return mobile.matches; },
            get active() { return active; },
            get landscape() { return active && root.clientWidth > root.clientHeight; },
            get scale() { return active ? scale : 1; },
            leave,
            destroy() {
                leave();
                destroyed = true;
                cancelAnimationFrame(layoutFrame);
                events.abort();
            }
        };
        // Defer the first callback until the game owns this controller.
        queueMicrotask(update);
        return controller;
    }

    function createGameAudio(root, canPlay) {
        const tracks = [
            'assets/sounds/soundtrack/LISA-Chill.mp3',
            'assets/sounds/soundtrack/LISA-Dream.mp3',
            'assets/sounds/soundtrack/LISA–Moonlit-Floor.mp3'
        ];
        const music = new Audio();
        music.preload = 'none';
        music.volume = .9;
        const effects = {
            collect: new Audio(new URL('assets/sounds/effects/Collect.mp3', document.baseURI).href),
            jump: new Audio(new URL('assets/sounds/effects/jump.mp3', document.baseURI).href)
        };
        Object.values(effects).forEach(sound => { sound.preload = 'none'; });
        const events = new AbortController();
        const failedTracks = new Set();
        let started = false;
        let destroyed = false;
        let pending = false;
        let revision = 0;
        let current = -1;
        let bag = [];

        function selectTrack() {
            if (!bag.length) {
                bag = tracks.map((_, index) => index).filter(index => !failedTracks.has(index));
                for (let index = bag.length - 1; index > 0; index--) {
                    const other = Math.floor(Math.random() * (index + 1));
                    [bag[index], bag[other]] = [bag[other], bag[index]];
                }
                const end = bag.length - 1;
                if (end > 0 && bag[end] === current) [bag[0], bag[end]] = [bag[end], bag[0]];
            }
            if (!bag.length) return false;
            current = bag.pop();
            revision++;
            music.src = new URL(tracks[current], document.baseURI).href;
            return true;
        }

        function pause() {
            revision++;
            music.pause();
            Object.values(effects).forEach(sound => sound.pause());
        }

        function sync() {
            if (destroyed) return;
            if (!started || !canPlay()) { pause(); return; }
            if (!music.src && !selectTrack()) return;
            if (!music.paused || pending || failedTracks.size === tracks.length) return;
            pending = true;
            const attempt = revision;
            // Browser autoplay denials and an interrupted pending play must never affect the game.
            Promise.resolve(music.play()).catch(() => {}).finally(() => {
                pending = false;
                if (!destroyed && attempt !== revision && started && canPlay()) sync();
            });
        }

        function activate(event) {
            if (destroyed || !event.isTrusted) return;
            if (event.type === 'keydown' && (event.repeat || ![
                'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyE', 'Space', 'Enter'
            ].includes(event.code))) return;
            if (event.type === 'pointerdown' && event.button !== 0) return;
            if (!root.contains(document.activeElement)) root.focus({ preventScroll: true });
            started = true;
            sync();
        }

        function nextTrack() {
            if (!destroyed && selectTrack()) sync();
        }
        music.addEventListener('ended', nextTrack, { signal: events.signal });
        music.addEventListener('error', () => {
            failedTracks.add(current);
            bag = bag.filter(index => !failedTracks.has(index));
            nextTrack();
        }, { signal: events.signal });
        ['pointerdown', 'keydown', 'click'].forEach(type => root.addEventListener(type, activate,
            { capture: true, signal: events.signal }));
        root.addEventListener('focusin', sync, { signal: events.signal });
        root.addEventListener('focusout', event => {
            if (root.contains(event.relatedTarget)) return;
            // Let the browser finish transferring focus between game controls before testing ownership.
            requestAnimationFrame(sync);
        }, { signal: events.signal });

        return {
            sync, pause,
            effect(name) {
                if (destroyed || !started || !canPlay()) return;
                const sound = effects[name];
                if (!sound) return;
                sound.pause();
                sound.currentTime = 0;
                Promise.resolve(sound.play()).catch(() => {});
            },
            destroy() {
                destroyed = true;
                pause();
                events.abort();
                [music, ...Object.values(effects)].forEach(sound => {
                    sound.removeAttribute('src');
                    sound.load();
                });
            }
        };
    }

    function createWorld(stage) {
        const scenery = document.createElement('div');
        scenery.className = 'character-world';
        scenery.setAttribute('aria-hidden', 'true');
        scenery.innerHTML = `
            <img class="character-world-sky" src="assets/pixel/grove-sky.svg" alt="" decoding="async">
            <img class="character-world-island character-world-island--one" src="assets/pixel/grove-island.svg" alt="" decoding="async">
            <img class="character-world-island character-world-island--two" src="assets/pixel/grove-island.svg" alt="" decoding="async">
            <img class="character-world-island character-world-island--three" src="assets/pixel/grove-island.svg" alt="" decoding="async">
            <img class="character-world-willow" src="assets/pixel/grove-willow.svg" alt="" decoding="async">
            <img class="character-world-crystals" src="assets/pixel/grove-crystals.svg" alt="" decoding="async">
            <img class="character-world-mushrooms" src="assets/pixel/grove-mushrooms.svg" alt="" decoding="async">
            <div class="character-world-ground"></div>
            <span class="character-firefly" style="--fly-x:12%;--fly-y:48%;--fly-delay:-2s"></span>
            <span class="character-firefly" style="--fly-x:31%;--fly-y:70%;--fly-delay:-6s"></span>
            <span class="character-firefly" style="--fly-x:44%;--fly-y:32%;--fly-delay:-1s"></span>
            <span class="character-firefly" style="--fly-x:59%;--fly-y:60%;--fly-delay:-4s"></span>
            <span class="character-firefly" style="--fly-x:76%;--fly-y:46%;--fly-delay:-7s"></span>
            <span class="character-firefly" style="--fly-x:92%;--fly-y:75%;--fly-delay:-3s"></span>`;
        const luckyBlock = document.createElement('button');
        luckyBlock.type = 'button';
        luckyBlock.className = 'character-lucky-block';
        luckyBlock.setAttribute('aria-label', 'Lucky block. Jump underneath or activate to discover a fact about Nataly.');
        luckyBlock.setAttribute('aria-disabled', 'false');
        luckyBlock.innerHTML = `<svg viewBox="0 0 36 36" aria-hidden="true" focusable="false" shape-rendering="crispEdges">
            <path fill="#16304e" d="M4 0h28v4h4v28h-4v4H4v-4H0V4h4Z"/>
            <path fill="#d6bb79" d="M4 2h28v2h2v28h-2v2H4v-2H2V4h2Z"/>
            <path fill="#304d74" d="M6 6h24v24H6Z"/>
            <path fill="#5988ad" d="M6 6h24v2H8v22H6Z"/>
            <path fill="#1c3558" d="M28 8h2v22H8v-2h20Z"/>
            <path fill="#f2e2af" d="M4 4h2v2H4zm26 0h2v2h-2zM4 30h2v2H4zm26 0h2v2h-2Z"/>
            <path class="lucky-question" fill="#f5e8c5" d="M12 10h10v2h2v6h-4v4h-4v-6h4v-4h-6v4h-4v-4h2zm4 14h4v4h-4Z"/>
            <path class="lucky-gem" fill="#a9dce0" d="M16 14h4v2h2v4h-2v2h-4v-2h-2v-4h2Z"/>
            </svg>
            <span class="lucky-spark" style="--spark-x:-44px;--spark-y:-32px"></span><span class="lucky-spark" style="--spark-x:-22px;--spark-y:-56px"></span>
            <span class="lucky-spark" style="--spark-x:14px;--spark-y:-62px"></span><span class="lucky-spark" style="--spark-x:40px;--spark-y:-36px"></span>
            <span class="lucky-spark" style="--spark-x:-38px;--spark-y:12px"></span><span class="lucky-spark" style="--spark-x:42px;--spark-y:8px"></span>`;
        const factPanel = document.createElement('aside');
        factPanel.className = 'contact-character-fact';
        factPanel.hidden = true;
        factPanel.setAttribute('role', 'status');
        factPanel.setAttribute('aria-live', 'polite');
        factPanel.setAttribute('aria-atomic', 'true');
        factPanel.innerHTML = '<span class="character-fact-title">Did you know?</span><p data-character-fact></p>';
        stage.prepend(scenery);
        stage.append(luckyBlock, factPanel);
        return { luckyBlock, factPanel, factText: factPanel.querySelector('[data-character-fact]') };
    }
})();
