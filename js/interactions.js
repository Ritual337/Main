/*
 * interactions.js — motion orchestration layer
 *
 * Division of labour (documented so it never blurs back together):
 *   - Preloader    → a brief "archive opening" shutter on first load so
 *                    fonts/layout settle before any motion starts —
 *                    nothing else fires until it dispatches 'siteReady'.
 *   - Lenis        → smooth scrolling only.
 *   - GSAP+ST      → scroll-scrubbed / timed work: hero letter entrance,
 *                    per-section entrance choreography, the Frames
 *                    mosaic's cascade-in + continuous parallax drift.
 *   - Motion.dev   → UI-level micro-interactions: nav scroll-spy indicator,
 *                    tactile button press feedback.
 *
 * Everything here respects prefers-reduced-motion by skipping straight to
 * the resting state.
 */

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Preloader: the archive "opening" ----------
 * Purely additive — if this IIFE never runs (JS blocked) a CSS-only
 * keyframe on #preloader (see style.css) hides it after ~3.2s regardless,
 * so the site is never permanently stuck behind it. */
(function preloader() {
    const el = document.getElementById('preloader');
    if (!el) { document.dispatchEvent(new Event('siteReady')); return; }

    if (REDUCED_MOTION || !window.gsap) {
        el.remove();
        document.dispatchEvent(new Event('siteReady'));
        return;
    }

    const bar = document.getElementById('preloader-bar');
    const pct = document.getElementById('preloader-pct');
    const proxy = { v: 0 };
    let pageLoaded = false;
    window.addEventListener('load', () => { pageLoaded = true; }, { once: true });

    const fill = gsap.timeline();
    fill.to(proxy, {
        v: 92, duration: 1.5, ease: 'power1.inOut',
        onUpdate: () => {
            if (bar) bar.style.width = proxy.v + '%';
            if (pct) pct.textContent = Math.round(proxy.v) + '%';
        },
    }).call(finish);

    function finish() {
        // Wait for the real page-load event too (capped), then snap to 100 and open the shutter.
        const waitLoad = () => {
            if (pageLoaded) return Promise.resolve();
            return new Promise((res) => {
                window.addEventListener('load', res, { once: true });
                setTimeout(res, 1500);
            });
        };
        waitLoad().then(() => {
            gsap.to(proxy, {
                v: 100, duration: 0.3, ease: 'power1.out',
                onUpdate: () => {
                    if (bar) bar.style.width = proxy.v + '%';
                    if (pct) pct.textContent = Math.round(proxy.v) + '%';
                },
                onComplete: openShutter,
            });
        });
    }

    function openShutter() {
        const tl = gsap.timeline({
            onComplete: () => { el.remove(); document.dispatchEvent(new Event('siteReady')); },
        });
        tl.to('.preloader-inner', { opacity: 0, scale: 0.94, filter: 'blur(6px)', duration: 0.45, ease: 'power2.in' })
          .to('.preloader-panel-top', { yPercent: -101, duration: 1.0, ease: 'power4.inOut' }, '-=0.1')
          .to('.preloader-panel-bottom', { yPercent: 101, duration: 1.0, ease: 'power4.inOut' }, '<');
    }
})();

/* ---------- Lenis: smooth scroll ---------- */
let lenis = null;
if (!REDUCED_MOTION && window.Lenis) {
    lenis = new Lenis({
        duration: 1.05,
        easing: (t) => 1 - Math.pow(1 - t, 3),
        smoothWheel: true,
        allowNestedScroll: true,
    });

    // Exactly one thing may call lenis.raf() per frame. Previously a manual
    // requestAnimationFrame loop AND gsap.ticker were both driving it —
    // double the smooth-scroll math every frame, from two different time
    // sources, which is what was causing the heavy scroll lag.
    if (window.gsap && window.ScrollTrigger) {
        gsap.ticker.add((time) => { lenis.raf(time * 1000); });
        gsap.ticker.lagSmoothing(0);
        lenis.on('scroll', ScrollTrigger.update);
    } else {
        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);
    }

    // Smooth anchor navigation (nav links, hero scroll hint, back-to-top).
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
        a.addEventListener('click', (e) => {
            const id = a.getAttribute('href');
            if (id.length < 2) return;
            const target = document.querySelector(id);
            if (!target) return;
            e.preventDefault();
            lenis.scrollTo(target, { offset: -60, duration: 1.1 });
        });
    });
    window.__lenis = lenis;
}

/* ---------- GSAP: hero entrance ---------- */
(function heroEntrance() {
    const titleEl = document.querySelector('.hero-title');
    if (!titleEl) return;

    // Split "RITUAL" into individual animated characters.
    const word = titleEl.textContent.trim();
    titleEl.textContent = '';
    word.split('').forEach((ch) => {
        const span = document.createElement('span');
        span.className = 'char';
        span.textContent = ch;
        titleEl.appendChild(span);
    });

    if (REDUCED_MOTION || !window.gsap) {
        titleEl.querySelectorAll('.char').forEach((c) => { c.style.opacity = 1; c.style.transform = 'none'; });
        document.querySelectorAll('.hero-tag, .hero-kicker, .hero-rule, .hero-subtitle, .hero-scroll-hint')
            .forEach((el) => { el.style.opacity = 1; el.style.transform = 'none'; });
        titleEl.style.setProperty('--after-reveal', '1');
        window.__heroDone = true;
        return;
    }

    function play() {
        const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
        tl.to('.hero-kicker', { opacity: 1, y: 0, duration: 1.0 }, 0.05)
          .to('.hero-title .char', { opacity: 1, y: 0, rotate: 0, duration: 1.35, stagger: 0.052 }, 0.2)
          .to(titleEl, { onStart: () => titleEl.style.setProperty('--after-reveal', '1'), duration: 0.1 }, '-=0.7')
          .to('.hero-rule', { scaleX: 1, duration: 1.1, ease: 'power4.inOut' }, '-=0.75')
          .to('.hero-subtitle', { opacity: 1, y: 0, duration: 0.9 }, '-=0.6')
          .to('.hero-tag-left, .hero-tag-right', { opacity: 1, y: 0, duration: 0.8, stagger: 0.15 }, '-=0.65')
          .to('.hero-scroll-hint', { opacity: 1, y: 0, duration: 0.8 }, '-=0.5')
          .call(() => { window.__heroDone = true; document.dispatchEvent(new Event('heroDone')); });
    }

    document.addEventListener('siteReady', play, { once: true });
})();

/* ---------- GSAP + ScrollTrigger: section entrances ----------
 * Every section gets its own authored entrance rather than one
 * repeated fade-up — the motion is chosen to fit what the section
 * actually is (a dossier reads like two case-file halves sliding
 * into place, the log/archive grids assemble as a set, the notes
 * panel opens like a drawer along its own red rule, etc). Each
 * ScrollTrigger fires once, the first time the section is scrolled
 * into view. */
(function sectionEntrances() {
    if (REDUCED_MOTION || !window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);

    const EASE = 'power4.out';

    function reveal(trigger, targets, vars, opts = {}) {
        if (Array.isArray(targets) || targets instanceof NodeList) {
            targets = Array.from(targets).filter(Boolean);
        }
        if (!targets || targets.length === 0) return;
        ScrollTrigger.create({
            trigger,
            start: opts.start || 'top 80%',
            once: true,
            onEnter: () => gsap.to(targets, {
                opacity: 1, x: 0, y: 0, scale: 1, rotate: 0,
                duration: opts.duration || 1.1,
                ease: EASE,
                stagger: opts.stagger || 0,
                ...vars,
            }),
        });
    }

    // Dossier — two halves slide inward from opposite edges, like a
    // case file being opened flat, slow enough to actually read as
    // two objects converging rather than a single quick fade.
    const dossier = document.getElementById('dossier');
    if (dossier) {
        reveal(dossier, dossier.querySelector('.dossier-text'), {}, { duration: 1.5 });
        reveal(dossier, dossier.querySelector('.dossier-visual'), {}, { duration: 1.5 });
    }

    // Index / log — heading settles first, then the grid assembles
    // card by card, left to right, each with its own soft focus-pull.
    const log = document.getElementById('log');
    if (log) {
        reveal(log, [log.querySelector(':scope > .eyebrow'), log.querySelector(':scope > .section-note')], {}, { stagger: 0.14, duration: 1.2 });
        reveal(log, log.querySelectorAll('.log-card'), {}, { start: 'top 76%', duration: 1.1, stagger: 0.09 });
    }

    // Frames — heading settles, then the grid assembles in one light,
    // one-time cascade. (No continuous scroll-scrubbed parallax here
    // anymore — ten separate scrub listeners recalculating every scroll
    // tick was the main source of the lag.)
    const frames = document.getElementById('frames');
    if (frames) {
        reveal(frames, [frames.querySelector(':scope > .eyebrow'), frames.querySelector(':scope > .section-note')], {}, { stagger: 0.14, duration: 1.2 });
        reveal(frames, frames.querySelectorAll('.frame-cell'), {}, { start: 'top 80%', duration: 0.9, stagger: 0.05 });
    }

    // Signal — the equalizer "powers on" with a snap, then the quote
    // and LEDs settle after, mirroring an actual signal coming through.
    const signal = document.getElementById('signal');
    if (signal) {
        reveal(signal, signal.querySelector(':scope > .eyebrow'), {}, { duration: 1.2 });
        reveal(signal, signal.querySelector('.signal-eq'), { duration: 0.7, ease: 'back.out(2.4)' }, { start: 'top 78%' });
        reveal(signal, signal.querySelector('.whisper-container'), {}, { start: 'top 70%', duration: 1.3 });
        reveal(signal, signal.querySelector('.whisper-leds'), {}, { start: 'top 64%', duration: 1.0 });
    }

    // Writings — tabs drop into place like index cards, then the
    // panel slides out from behind its red rule, drawer-style, with
    // a slower, heavier pull so it reads as something being opened.
    const notes = document.getElementById('notes');
    if (notes) {
        reveal(notes, notes.querySelector(':scope > .eyebrow'), {}, { duration: 1.2 });
        reveal(notes, notes.querySelectorAll('.notes-tab'), {}, { start: 'top 80%', duration: 0.9, stagger: 0.09 });
        reveal(notes, notes.querySelector('.notes-panel'), {}, { start: 'top 72%', duration: 1.4 });
    }

    // Archives — grid cells assemble in reading order, same rhythm as
    // the log grid so the two "index" moments of the site rhyme.
    const indexSection = document.getElementById('index');
    if (indexSection) {
        reveal(indexSection, indexSection.querySelector(':scope > .eyebrow'), {}, { duration: 1.2 });
        reveal(indexSection, indexSection.querySelectorAll('.index-cell'), {}, { start: 'top 76%', duration: 1.1, stagger: 0.09 });
    }

    // Footer — a quiet settle, no fanfare; it's chrome, not content.
    const footerInner = document.querySelector('footer .footer-inner');
    if (footerInner) reveal(document.querySelector('footer'), footerInner, {}, { start: 'top 92%', duration: 1.0 });
})();

/* ---------- Motion.dev: nav scroll-spy indicator ---------- */
(function navIndicator() {
    const nav = document.querySelector('.nav-links');
    if (!nav) return;
    const links = Array.from(nav.querySelectorAll('a'));
    if (!links.length) return;

    const indicator = document.createElement('span');
    indicator.id = 'nav-indicator';
    nav.appendChild(indicator);

    const sections = links
        .map((a) => document.querySelector(a.getAttribute('href')))
        .filter(Boolean);

    function moveIndicator(link) {
        const navRect = nav.getBoundingClientRect();
        const r = link.getBoundingClientRect();
        const left = r.left - navRect.left;
        const width = r.width;
        if (window.Motion?.animate) {
            window.Motion.animate(indicator, { left: [indicator.style.left || left + 'px', left + 'px'], width: [indicator.style.width || width + 'px', width + 'px'] }, { duration: 0.35, easing: [0.22, 1, 0.36, 1] });
        } else {
            indicator.style.left = left + 'px';
            indicator.style.width = width + 'px';
        }
    }

    let active = null;
    function setActive(link) {
        if (active === link) return;
        active?.classList.remove('active');
        link.classList.add('active');
        active = link;
        moveIndicator(link);
    }

    if ('IntersectionObserver' in window && sections.length) {
        const obs = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const idx = sections.indexOf(entry.target);
                    if (idx > -1) setActive(links[idx]);
                }
            });
        }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });
        sections.forEach((s) => obs.observe(s));
    }

    links.forEach((l) => l.addEventListener('mouseenter', () => moveIndicator(l)));
    nav.addEventListener('mouseleave', () => { if (active) moveIndicator(active); });
    window.addEventListener('resize', () => { if (active) moveIndicator(active); });
})();

/* ---------- Motion.dev: tactile button press feedback ---------- */
(function pressFeedback() {
    if (REDUCED_MOTION || !window.Motion?.animate) return;
    const selector = '.log-card, .index-cell, .notes-tab, .whisper-dot, .player-btn, .read-more-btn, #back-to-top, .footer-brand, .frame-cell';
    document.querySelectorAll(selector).forEach((el) => {
        el.addEventListener('pointerdown', () => {
            window.Motion.animate(el, { scale: 0.96 }, { duration: 0.12, easing: [0.4, 0, 0.2, 1] });
        });
        el.addEventListener('pointerup', () => {
            window.Motion.animate(el, { scale: 1 }, { duration: 0.28, easing: [0.34, 1.56, 0.64, 1] });
        });
        el.addEventListener('pointerleave', () => {
            window.Motion.animate(el, { scale: 1 }, { duration: 0.2, easing: [0.22, 1, 0.36, 1] });
        });
    });
})();