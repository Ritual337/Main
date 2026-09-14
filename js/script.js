/*
 * script.js — page interactivity (component logic only).
 * Scroll-driven motion lives in interactions.js (Lenis + GSAP).
 * The three.js background lives in three-loader.js / three-scene.js.
 */
(function cursorGlow() {
    const glow = document.getElementById('cursor-glow');
    if (!glow) return;
    document.addEventListener('mousemove', (e) => {
        glow.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
    });
    const hoverEls = document.querySelectorAll(
        'a, button, .clickable-img, .index-cell, .notes-tab, .frame-cell, .log-card, .read-more-btn, .copyable, .whisper-dot, .card-scene'
    );
    hoverEls.forEach(el => {
        el.addEventListener('mouseenter', () => glow.classList.add('hover'));
        el.addEventListener('mouseleave', () => glow.classList.remove('hover'));
    });
})();

(function scrollProgress() {
    const bar = document.getElementById('scroll-progress');
    if (!bar) return;
    function update() {
        const p = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = 'scaleX(' + (p > 0 ? window.scrollY / p : 0) + ')';
    }
    window.addEventListener('scroll', update);
    update();
})();

(function backToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;
    window.addEventListener('scroll', () => { btn.classList.toggle('visible', window.scrollY > 500); });
    btn.addEventListener('click', () => {
        if (window.__lenis) window.__lenis.scrollTo(0, { duration: 1.1 });
        else window.scrollTo({ top: 0, behavior: 'smooth' });
    });
})();

(function navScroll() {
    const nav = document.getElementById('nav-bar');
    if (!nav) return;
    window.addEventListener('scroll', () => { nav.classList.toggle('scrolled', window.scrollY > 60); });
})();

(function navClock() {
    const el = document.getElementById('nav-clock');
    if (!el) return;
    function pad(n) { return String(n).padStart(2, '0'); }
    function tick() {
        const now = new Date();
        el.textContent = pad(now.getUTCHours()) + ':' + pad(now.getUTCMinutes()) + ':' + pad(now.getUTCSeconds()) + ' UTC';
    }
    tick();
    setInterval(tick, 1000);
})();

(function heroScrollHint() {
    const btn = document.getElementById('hero-scroll-hint');
    if (!btn) return;
    btn.addEventListener('click', () => {
        const target = document.getElementById('dossier');
        if (!target) return;
        if (window.__lenis) window.__lenis.scrollTo(target, { offset: -60, duration: 1.1 });
        else target.scrollIntoView({ behavior: 'smooth' });
    });
})();

(function mobileMenu() {
    const toggle = document.getElementById('mobile-nav-toggle');
    const menu = document.getElementById('mobile-menu');
    const closeBtn = document.getElementById('mobile-menu-close');
    if (!toggle || !menu || !closeBtn) return;
    const links = menu.querySelectorAll('a');
    toggle.addEventListener('click', () => menu.classList.add('active'));
    closeBtn.addEventListener('click', () => menu.classList.remove('active'));
    links.forEach(l => l.addEventListener('click', () => menu.classList.remove('active')));
    menu.addEventListener('click', (e) => { if (e.target === menu) menu.classList.remove('active'); });
})();

(function rippleFx() {
    const container = document.getElementById('ripple-container');
    if (!container) return;
    document.addEventListener('click', (e) => {
        const r = document.createElement('div');
        r.className = 'ripple';
        const s = 35 + Math.random() * 55;
        r.style.width = s + 'px';
        r.style.height = s + 'px';
        r.style.left = (e.clientX - s / 2) + 'px';
        r.style.top = (e.clientY - s / 2) + 'px';
        container.appendChild(r);
        setTimeout(() => r.remove(), 900);
    });
})();

(function toastSystem() {
    const stack = document.getElementById('toast-stack');
    if (!stack) return;

    /**
     * showToast('message')
     * showToast('message', 4000)
     * showToast('message', { duration: 4000, error: true })
     */
    window.showToast = function (msg, opts = {}) {
        const duration = (typeof opts === 'number')
            ? opts
            : (opts.duration || 2800);

        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = msg;
        stack.appendChild(el);

        requestAnimationFrame(() => el.classList.add('show'));

        setTimeout(() => {
            el.classList.remove('show');
            setTimeout(() => el.remove(), 350);
        }, duration);
    };
})();

(function lightboxFx() {
    const items = Array.from(document.querySelectorAll('.clickable-img'));
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    const cap = document.getElementById('lightbox-caption');
    const close = document.getElementById('lightbox-close');
    const backdrop = document.getElementById('lightbox-backdrop');
    const prev = document.getElementById('lightbox-prev');
    const next = document.getElementById('lightbox-next');
    if (!items.length || !lb || !img || !cap || !close || !backdrop || !prev || !next) return;

    let cur = 0;

    const visibleItems = () => items.filter(el => !el.classList.contains('is-hidden'));

    function open(i) {
        const visible = visibleItems();
        if (!visible.length) return;

        let el = items[i];
        if (!el || el.classList.contains('is-hidden')) el = visible[0];
        i = items.indexOf(el);

        cur = i;
        img.src = el.dataset.src;
        cap.textContent = el.dataset.caption || '';
        lb.classList.add('active');
        document.body.classList.add('overlay-open');
        img.style.opacity = '0';
        img.onload = () => { img.style.opacity = '1'; };
        setTimeout(() => { img.style.opacity = '1'; }, 200);
    }

    function step(dir) {
        const visible = visibleItems();
        if (!visible.length) return;
        let idx = visible.indexOf(items[cur]);
        if (idx === -1) idx = 0;
        idx = (idx + dir + visible.length) % visible.length;
        open(items.indexOf(visible[idx]));
    }

    function closeLb() {
        lb.classList.remove('active');
        document.body.classList.remove('overlay-open');
        setTimeout(() => { img.src = ''; }, 350);
    }

    items.forEach(el => el.addEventListener('click', (e) => {
        if (e.target.closest('.mark-burst-layer') && e.detail === 2) return;
        open(items.indexOf(el));
    }));

    close.addEventListener('click', closeLb);
    backdrop.addEventListener('click', closeLb);
    prev.addEventListener('click', () => step(-1));
    next.addEventListener('click', () => step(1));

    document.addEventListener('keydown', (e) => {
        if (!lb.classList.contains('active')) return;
        if (e.key === 'Escape') closeLb();
        if (e.key === 'ArrowLeft') step(-1);
        if (e.key === 'ArrowRight') step(1);
    });
})();

(function framesFilter() {
    const grid = document.getElementById('frame-grid');
    const bar = document.getElementById('frame-filters');
    if (!grid || !bar) return;

    const cells = Array.from(grid.querySelectorAll('.frame-cell'));
    const buttons = Array.from(bar.querySelectorAll('.frame-filter'));
    if (!cells.length || !buttons.length) return;

    function apply(filter) {
        let shown = 0;
        cells.forEach(cell => {
            const tags = (cell.dataset.tags || '').split(/\s+/);
            const match = filter === 'all' || tags.includes(filter);

            if (match) {
                cell.classList.remove('is-hidden', 'filter-in');
                void cell.offsetWidth;
                cell.style.animationDelay = (shown * 45) + 'ms';
                cell.classList.add('filter-in');
                shown++;
            } else {
                cell.classList.remove('filter-in');
                cell.classList.add('is-hidden');
            }
        });
    }

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.classList.contains('active')) return;
            buttons.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
            apply(btn.dataset.filter);
        });
    });
})();

/* The filter strip is new markup, so interactions.js doesn't know about
   it — give it its own one-shot entrance rather than leaving it to pop
   in ahead of the tiles. */
(function frameFiltersEntrance() {
    const bar = document.getElementById('frame-filters');
    if (!bar) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    bar.style.opacity = '0';
    bar.style.transform = 'translateY(18px)';
    bar.style.transition =
        'opacity .6s cubic-bezier(.23,1,.32,1), transform .6s cubic-bezier(.23,1,.32,1)';

    const io = new IntersectionObserver((entries) => {
        entries.forEach(en => {
            if (!en.isIntersecting) return;
            bar.style.opacity = '1';
            bar.style.transform = 'none';
            io.disconnect();
        });
    }, { threshold: 0.2 });

    io.observe(bar);
})();

(function sparkBurst() {
    document.querySelectorAll('.frame-cell, .clickable-img').forEach(el => {
        let burstLayer = el.querySelector('.mark-burst-layer');
        if (!burstLayer) {
            burstLayer = document.createElement('div');
            burstLayer.className = 'mark-burst-layer';
            el.appendChild(burstLayer);
        }
        function pop(x, y, count) {
            for (let i = 0; i < count; i++) {
                const mark = document.createElement('span');
                mark.className = 'mark-pop';
                mark.innerHTML = '✦';
                mark.style.left = (x + (Math.random() * 35 - 17)) + 'px';
                mark.style.top = (y + (Math.random() * 12 - 6)) + 'px';
                mark.style.animationDelay = (i * 0.04) + 's';
                mark.style.fontSize = (1 + Math.random() * 0.6) + 'rem';
                burstLayer.appendChild(mark);
                setTimeout(() => mark.remove(), 1100);
            }
        }
        el.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const rect = el.getBoundingClientRect();
            pop(e.clientX - rect.left, e.clientY - rect.top, 6);
        });
        let lastTap = 0;
        el.addEventListener('touchstart', (e) => {
            const now = Date.now();
            if (now - lastTap < 400) {
                e.preventDefault();
                const touch = e.touches[0];
                const rect = el.getBoundingClientRect();
                pop(touch.clientX - rect.left, touch.clientY - rect.top, 5);
            }
            lastTap = now;
        });
    });
})();

(function heroTypewriter() {
    const el = document.getElementById('hero-subtitle');
    if (!el) return;
    const full = "The beginning of a new era. Embrace her reign.";
    let idx = 0;
    let html = '';
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.innerHTML = full;
        return;
    }
    function type() {
        if (idx < full.length) {
            html += full[idx];
            idx++;
            el.innerHTML = html + ' <span class="cursor-blink"></span>';
            setTimeout(type, 22);
        } else {
            const cursor = el.querySelector('.cursor-blink');
            if (cursor) cursor.classList.add('hidden');
        }
    }
    // Wait for the hero letter entrance (interactions.js) before typing.
    if (window.__heroDone) setTimeout(type, 200);
    else document.addEventListener('heroDone', () => setTimeout(type, 200), { once: true });
})();

(function signalTicker() {
    const quotes = [
        '"Left behind a land forsaken"',
        '"Every ritual begins with a single breath."',
        '"Is life the moment we cherish? Or the moment we are cherished?"',
        '"We never understand the value of something until we lose it forever"',
        '"Silence is not empty — it is full of answers"',
    ];
    const textEl = document.getElementById('whisper-text');
    const dots = document.querySelectorAll('.whisper-dot');
    if (!textEl || !dots.length) return;
    let current = 0;
    let interval;
    function show(i) {
        current = i;
        textEl.classList.add('fading');
        setTimeout(() => {
            textEl.textContent = quotes[i];
            textEl.classList.remove('fading');
            dots.forEach((d, j) => d.classList.toggle('active', j === i));
        }, 400);
    }
    dots.forEach(d => d.addEventListener('click', () => {
        clearInterval(interval);
        show(parseInt(d.dataset.index));
        interval = setInterval(next, 4000);
    }));
    function next() { show((current + 1) % quotes.length); }
    interval = setInterval(next, 4000);
})();

(function notesSection() {
    const data = [
        { tag: 'Latest — June 2026', title: 'On why I started this site',
            body: 'I wanted a place that was just mine. Not a feed, not a profile. Something closer to a room — where things accumulate slowly and nothing needs to perform. The internet used to feel more like that, and I miss it.\n\nNobody asked for this. That\'s kind of the point. A photo that isn\'t good enough for a "grid." A thought too short for an essay and too long for a caption. This is the drawer for that stuff.\n\nIf you\'re reading this, hi. You found the drawer.' },
        { tag: 'May 2026', title: 'Humanity vs. religion — a false war',
            body: 'People ask which one I "really" believe in, like it\'s an importance. It isn\'t. I\'m a human and humanity is my religion. If your belief makes you hate other human being just for their beliefs or appearance; your belief is false. I would pick being a human over going to \'heaven\' any day. ' },
        { tag: 'July 2026', title: 'Got a job in IT',
            body: 'OH MY GOD. It was such a tough time for me. Doing 3 part times was killing me but finally got my *cough* *cough* dream job in IT. It\'s stressful but it pays the bills + my ~ ;)' },
        { tag: 'August 2026', title: 'Finally got married',
            body: 'Daylight shows you everything at once. Night makes you choose— after so much overthinking and ups and down in life, I finally settled down with my lover of 8 years. Even though it\'s hard to get used to it at age 24. Nevertheless. Yay me :)' },
    ];
    const tabs = document.querySelectorAll('.notes-tab');
    const panel = document.getElementById('notes-panel');
    const tagEl = document.getElementById('notes-tag');
    const titleEl = document.getElementById('notes-title');
    const bodyEl = document.getElementById('notes-body');
    const toggleBtn = document.getElementById('notes-toggle');
    if (!tabs.length || !panel || !tagEl || !titleEl || !bodyEl || !toggleBtn) return;
    let cur = 0;
    let expanded = false;

    function render(i, animate = true) {
        const d = data[i];
        function apply() {
            tagEl.textContent = d.tag;
            titleEl.textContent = d.title;
            bodyEl.textContent = d.body;
            expanded = false;
            bodyEl.classList.remove('expanded');
            toggleBtn.textContent = 'Read more →';
            panel.classList.remove('swapping');
        }
        if (animate) { panel.classList.add('swapping'); setTimeout(apply, 220); } else { apply(); }
        tabs.forEach((n, j) => n.classList.toggle('active', j === i));
        cur = i;
    }
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const i = parseInt(tab.dataset.note, 10);
            if (i !== cur) render(i, true);
        });
    });
    toggleBtn.addEventListener('click', () => {
        expanded = !expanded;
        bodyEl.classList.toggle('expanded', expanded);
        toggleBtn.textContent = expanded ? 'Show less ←' : 'Read more →';
    });
    render(0, false);
})();

(function copyable() {
    document.querySelectorAll('.copyable').forEach(el => {
        const handler = (e) => {
            e.stopPropagation();
            const t = el.dataset.copy;
            if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(t).then(() => window.showToast?.('Copied: ' + t));
            } else {
                window.showToast?.(t);
            }
        };
        el.addEventListener('click', handler);
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(e); } });
    });
})();

(function easterEggClicks() {
    const link = document.getElementById('easter-egg-link');
    if (!link) return;
    let count = 0;
    link.addEventListener('click', (e) => {
        e.preventDefault();
        count++;
        if (count >= 7) window.location.href = 'easteregg.html';
    });
})();

(function easterEggKeys() {
    const FLICKER_MS = 5000;   // glitch + invert phase
    const ERASE_MS   = 5000;   // page deletion phase

    let buf = '';
    let active = false;

    document.addEventListener('keydown', (e) => {
        if (active) return;
        if (e.key.length !== 1) return;

        buf = (buf + e.key.toLowerCase()).slice(-6);
        if (buf !== 'ritual') return;

        active = true;
        buf = '';

        /* ---- phase 1: discovery ---- */
        window.showToast?.('you found it. hi.', { duration: FLICKER_MS });
        document.body.classList.add('ritual-glitch');

        const start = Date.now();
        const flicker = setInterval(() => {
            document.body.style.filter =
                Math.random() > 0.5 ? 'invert(1)' : 'none';
            document.body.style.transform =
                Math.random() > 0.7
                    ? `translate(${Math.random() * 8 - 4}px, ${Math.random() * 8 - 4}px)`
                    : 'none';

            if (Date.now() - start >= FLICKER_MS) {
                clearInterval(flicker);
                document.body.style.filter = 'none';
                document.body.style.transform = 'none';
                document.body.classList.remove('ritual-glitch');
                beginErase();
            }
        }, 60);

        /* ---- phase 2: erasure ---- */
        function beginErase() {
            const scan = document.getElementById('wipe-scan');
            if (scan) {
                scan.classList.remove('active');
                void scan.offsetWidth;        // restart the sweep cleanly
                scan.classList.add('active');
            }

            // every top-level node, in document order, except the scan line
            const targets = Array.from(document.body.children)
                .filter(el => el.id !== 'wipe-scan');

            const step = ERASE_MS / Math.max(targets.length, 1);

            targets.forEach((el, i) => {
                setTimeout(() => {
                    el.classList.add('erase-target');
                    void el.offsetWidth;      // force style flush so it transitions
                    el.classList.add('erased');
                }, i * step);
            });

            /* ---- phase 3: the blank page ---- */
            setTimeout(() => {
                document.body.innerHTML = '';
                document.body.removeAttribute('style');
                document.body.style.cssText = 'background:#000;margin:0;cursor:default;';
                document.documentElement.style.cssText = 'background:#000;';
                document.title = '';
                window.scrollTo(0, 0);
            }, ERASE_MS + 500);
        }
    });
})();

(function footerStatus() {
    const footerRight = document.getElementById('footer-right');
    if (!footerRight) return;
    const statuses = [
        "probably still asleep", "up way too late", "up way too late", "technically tomorrow now",
        "the quiet hour", "too early for anyone", "coffee, first attempt", "getting going, slowly",
        "awake, unconvinced", "mid-morning, focused-ish", "in the middle of something",
        "nearly lunch", "lunch, probably late", "afternoon slump incoming", "afternoon slump, arrived",
        "second coffee", "winding toward evening", "closing tabs", "golden hour",
        "dinner or a walk", "settling in for the night", "editing photos", "the good hours begin",
        "still here, still working"
    ];
    function update() {
        const now = new Date();
        const h = now.getUTCHours();
        const ts = now.toUTCString().slice(17, 22);
        const status = statuses[h] || "doing something";
        footerRight.textContent = '© 2026 — you\'re reading this at ' + ts + ' UTC · ' + status;
    }
    update();
    setInterval(update, 20000);
})();

(function poemOverlay() {
    const overlay = document.getElementById('poem-overlay');
    const trigger = document.getElementById('writing-interest');
    const closeBtn = document.getElementById('poem-close-btn');
    if (!overlay || !trigger) return;
    trigger.addEventListener('click', () => { overlay.classList.add('active'); document.body.classList.add('overlay-open'); });
    closeBtn.addEventListener('click', () => { overlay.classList.remove('active'); document.body.classList.remove('overlay-open'); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.classList.remove('active'); document.body.classList.remove('overlay-open'); } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('active')) { overlay.classList.remove('active'); document.body.classList.remove('overlay-open'); } });
})();

(function glitchOverlay() {
    const overlay = document.getElementById('glitch-overlay');
    const trigger = document.getElementById('design-interest');
    const closeBtn = document.getElementById('glitch-close-btn');
    const text = document.getElementById('glitch-ritual-text');
    if (!overlay || !trigger) return;
    let timers = [];
    function startCycle() {
        stopCycle();
        function schedIntense() {
            if (!overlay.classList.contains('active')) return;
            text.classList.add('intense');
            timers.push(setTimeout(() => text.classList.remove('intense'), 150 + Math.random() * 300));
            timers.push(setTimeout(schedIntense, 1200 + Math.random() * 4000));
        }
        timers.push(setTimeout(schedIntense, 800));
    }
    function stopCycle() { timers.forEach(t => clearTimeout(t)); timers = []; text?.classList.remove('intense'); }
    trigger.addEventListener('click', () => { overlay.classList.add('active'); document.body.classList.add('overlay-open'); startCycle(); });
    closeBtn.addEventListener('click', () => { overlay.classList.remove('active'); document.body.classList.remove('overlay-open'); stopCycle(); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.classList.remove('active'); document.body.classList.remove('overlay-open'); stopCycle(); } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('active')) { overlay.classList.remove('active'); document.body.classList.remove('overlay-open'); stopCycle(); } });
})();

(function cardFlip() {
    const overlay = document.getElementById('card-overlay');
    const trigger = document.getElementById('card-interest');
    const closeBtn = document.getElementById('card-close-btn');
    const scene = document.getElementById('card-scene');
    if (!overlay || !trigger || !closeBtn || !scene) return;

    trigger.addEventListener('click', () => { overlay.classList.add('active'); document.body.classList.add('overlay-open'); });
    closeBtn.addEventListener('click', () => { overlay.classList.remove('active'); document.body.classList.remove('overlay-open'); scene.classList.remove('flipped', 'hover-flipped'); });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) { overlay.classList.remove('active'); document.body.classList.remove('overlay-open'); scene.classList.remove('flipped', 'hover-flipped'); }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) { overlay.classList.remove('active'); document.body.classList.remove('overlay-open'); scene.classList.remove('flipped', 'hover-flipped'); }
    });
    scene.addEventListener('mouseenter', () => { if (!scene.classList.contains('flipped')) scene.classList.add('hover-flipped'); });
    scene.addEventListener('mouseleave', () => scene.classList.remove('hover-flipped'));
    scene.addEventListener('click', () => {
        scene.classList.toggle('flipped');
        if (scene.classList.contains('flipped')) scene.classList.remove('hover-flipped');
    });
    scene.addEventListener('touchstart', (e) => {
        e.preventDefault();
        scene.classList.toggle('flipped');
        if (scene.classList.contains('flipped')) scene.classList.remove('hover-flipped');
    });
})();

(function guestbookLink() {
    document.getElementById('guestbook-interest')?.addEventListener('click', () => { window.location.href = 'guestbook.html'; });
})();

(function galleryLink() {
    document.getElementById('gallery-interest')?.addEventListener('click', () => { window.location.href = 'gallery.html'; });
})();

(function musicPlayer() {
    const player = document.getElementById('music-player');
    const trigger = document.getElementById('music-interest');
    const closeBtn = document.getElementById('player-close');
    const dragHandle = document.getElementById('player-drag-handle');
    if (!player || !trigger) return;
    trigger.addEventListener('click', () => {
        player.classList.add('active');
        if (!player.style.top) { player.style.top = 'calc(50% - 110px)'; player.style.left = 'calc(50% - 137px)'; }
    });
    closeBtn.addEventListener('click', () => { player.classList.remove('active'); audio.pause(); });

    let isDragging = false, sx, sy, il, it;
    dragHandle.addEventListener('mousedown', (e) => {
        if (e.target.closest('.player-close-btn')) return;
        isDragging = true;
        sx = e.clientX; sy = e.clientY;
        const r = player.getBoundingClientRect();
        il = r.left; it = r.top;
        player.style.transition = 'none';
        e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let nl = il + e.clientX - sx, nt = it + e.clientY - sy;
        nl = Math.min(Math.max(nl, 0), window.innerWidth - player.offsetWidth);
        nt = Math.min(Math.max(nt, 0), window.innerHeight - player.offsetHeight);
        player.style.left = nl + 'px';
        player.style.top = nt + 'px';
    });
    window.addEventListener('mouseup', () => { if (isDragging) { isDragging = false; player.style.transition = 'opacity 0.3s ease'; } });

    const volBtn = document.getElementById('volume-btn');
    const volPopup = document.getElementById('volume-popup');
    volBtn.addEventListener('click', (e) => { e.stopPropagation(); volPopup.classList.toggle('active'); });
    document.addEventListener('click', (e) => { if (!volBtn.contains(e.target) && !volPopup.contains(e.target)) volPopup.classList.remove('active'); });

    const audio = new Audio();
    const playlist = [
        { title: 'Where Have You Been', artist: 'Bryan V', src: 'music/Bryan V - Where Have You Been.mp3' },
        { title: 'Only One', artist: 'Carlie Hanson', src: 'music/Carlie Hanson - Only One.mp3' },
        { title: 'Reforget', artist: 'Cash Cash ft. Violet Days', src: 'music/Cash Cash, Violet Days - Reforget (feat. Violet Days).mp3' },
        { title: 'Mama', artist: 'Clean Bandit ft. Ellie Goulding', src: 'music/Clean Bandit, Ellie Goulding - Mama (feat. Ellie Goulding).mp3' },
        { title: 'Let It Be Me', artist: 'David Guetta ft. Ava Max', src: 'music/David Guetta, Ava Max - Let It Be Me (feat. Ava Max).mp3' },
        { title: 'Wilder', artist: 'Gamma Skies, Cleo Kelley', src: 'music/Gamma Skies, Cleo Kelley - Wilder.mp3' },
        { title: 'Body Back', artist: 'Gryffin, Maia Wright', src: 'music/Gryffin, Maia Wright - Body Back.mp3' },
        { title: 'Wild', artist: 'Jonas Blue', src: 'music/Jonas Blue, Chelcee Grimes, TINI, JHAYCO - Wild.mp3' },
        { title: 'Mona Lisa', artist: 'K-391', src: 'music/K-391 - Mona Lisa.mp3' },
        { title: 'Dance Alone', artist: 'Preston Pablo', src: 'music/Preston Pablo, Juliana - Dance Alone (Juliana Remix).mp3' },
        { title: 'Floating Through Space', artist: 'Sia, David Guetta', src: 'music/Sia, David Guetta - Floating Through Space.mp3' },
        { title: 'Harder', artist: 'Tiësto ft. Talay Riley', src: 'music/Tiësto, KSHMR, Talay Riley - Harder (feat. Talay Riley).mp3' },
    ];
    let curTrack = 0, isPlaying = false;
    const trackTitle = document.getElementById('track-title');
    const trackArtist = document.getElementById('track-artist');
    const playBtn = document.getElementById('player-play');
    const prevBtn = document.getElementById('player-prev');
    const nextBtn = document.getElementById('player-next');
    const progBar = document.getElementById('player-progress');
    const curTimeEl = document.getElementById('current-time');
    const durTimeEl = document.getElementById('duration-time');
    const volBar = document.getElementById('player-volume');

    function loadTrack(i) {
        const t = playlist[i];
        audio.src = t.src;
        audio.load();
        trackTitle.textContent = t.title;
        trackArtist.textContent = t.artist;
        progBar.value = 0;
        curTimeEl.textContent = '0:00';
        durTimeEl.textContent = '0:00';
        if (isPlaying) audio.play().catch(() => {});
    }
    function fmt(s) { const m = Math.floor(s / 60), sec = Math.floor(s % 60); return m + ':' + sec.toString().padStart(2, '0'); }
    audio.addEventListener('loadedmetadata', () => { durTimeEl.textContent = fmt(audio.duration); progBar.max = audio.duration; });
    audio.addEventListener('timeupdate', () => { progBar.value = audio.currentTime; curTimeEl.textContent = fmt(audio.currentTime); });
    audio.addEventListener('ended', () => { curTrack = (curTrack + 1) % playlist.length; loadTrack(curTrack); audio.play().catch(() => {}); });
    playBtn.addEventListener('click', () => {
        if (isPlaying) { audio.pause(); playBtn.innerHTML = '<i class="fas fa-play"></i>'; }
        else { audio.play().catch(() => {}); playBtn.innerHTML = '<i class="fas fa-pause"></i>'; }
        isPlaying = !isPlaying;
        player.classList.toggle('playing', isPlaying);
    });
    prevBtn.addEventListener('click', () => { curTrack = (curTrack - 1 + playlist.length) % playlist.length; loadTrack(curTrack); if (isPlaying) audio.play().catch(() => {}); });
    nextBtn.addEventListener('click', () => { curTrack = (curTrack + 1) % playlist.length; loadTrack(curTrack); if (isPlaying) audio.play().catch(() => {}); });
    progBar.addEventListener('input', () => { audio.currentTime = progBar.value; });
    volBar.addEventListener('input', () => { audio.volume = volBar.value; });
    audio.volume = 0.8;
    volBar.value = 0.8;
    loadTrack(curTrack);
})();