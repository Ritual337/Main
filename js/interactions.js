/*
 * interactions.js — motion orchestration layer
 *
 * Division of labour (documented so it never blurs back together):
 *   - Lenis        → smooth scrolling only. allowNestedScroll:true so the
 *                    horizontal Frames filmstrip doesn't lock vertical scroll.
 *   - GSAP+ST      → scroll-scrubbed / timed work: hero letter entrance,
 *                    section reveals (.reveal → .in-view), frame-wipe reveal.
 *   - Motion.dev   → UI-level micro-interactions: nav scroll-spy indicator,
 *                    tactile button press feedback.
 *
 * Everything here respects prefers-reduced-motion by skipping straight to
 * the resting state.
 */

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Lenis: smooth scroll ---------- */
let lenis = null;
if (!REDUCED_MOTION && window.Lenis) {
    lenis = new Lenis({
        duration: 1.05,
        easing: (t) => 1 - Math.pow(1 - t, 3),
        smoothWheel: true,
        allowNestedScroll: true, // fixes the Frames filmstrip scroll-lock bug
    });
    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Keep GSAP's ScrollTrigger in sync with Lenis-driven scroll.
    if (window.gsap && window.ScrollTrigger) {
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => { lenis.raf(time * 1000); });
        gsap.ticker.lagSmoothing(0);
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
        titleEl.style.setProperty('--afterOpacity', '1');
        window.__heroDone = true;
        return;
    }

    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to('.hero-kicker', { opacity: 1, y: 0, duration: 0.7 }, 0.1)
      .to('.hero-title .char', { opacity: 1, y: 0, rotate: 0, duration: 1, stagger: 0.045 }, 0.15)
      .to(titleEl, { onStart: () => titleEl.style.setProperty('--after-reveal', '1') }, '-=0.5')
      .to('.hero-rule', { scaleX: 1, duration: 0.8, ease: 'power3.out' }, '-=0.6')
      .to('.hero-subtitle', { opacity: 1, duration: 0.6 }, '-=0.5')
      .to('.hero-tag-left, .hero-tag-right', { opacity: 1, duration: 0.6, stagger: 0.1 }, '-=0.6')
      .to('.hero-scroll-hint', { opacity: 1, duration: 0.6 }, '-=0.4')
      .call(() => { window.__heroDone = true; document.dispatchEvent(new Event('heroDone')); });
})();

/* ---------- GSAP + ScrollTrigger: section reveals ---------- */
(function scrollReveals() {
    const els = document.querySelectorAll('.reveal');
    if (!els.length) return;

    if (REDUCED_MOTION || !window.gsap || !window.ScrollTrigger) {
        els.forEach((el) => el.classList.add('in-view'));
        return;
    }
    gsap.registerPlugin(ScrollTrigger);
    els.forEach((el) => {
        ScrollTrigger.create({
            trigger: el,
            start: 'top 85%',
            once: true,
            onEnter: () => el.classList.add('in-view'),
        });
    });
})();

/* ---------- GSAP + ScrollTrigger: frame-wipe reveal (Frames section) ---------- */
(function frameWipe() {
    const items = document.querySelectorAll('.frame-item');
    if (!items.length) return;

    if (REDUCED_MOTION || !window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);

    items.forEach((item, i) => {
        let wipe = item.querySelector('.frame-wipe');
        if (!wipe) {
            wipe = document.createElement('div');
            wipe.className = 'frame-wipe';
            const photo = item.querySelector('.frame-photo');
            photo?.appendChild(wipe);
        }
        gsap.set(wipe, { scaleX: 1 });
        gsap.to(wipe, {
            scaleX: 0,
            duration: 0.9,
            ease: 'power4.inOut',
            delay: (i % 6) * 0.04,
            scrollTrigger: {
                trigger: item,
                horizontal: false,
                start: 'left 92%',
                containerAnimation: undefined,
                toggleActions: 'play none none none',
                once: true,
            },
        });
    });
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
    const selector = '.log-card, .index-cell, .notes-tab, .whisper-dot, .player-btn, .read-more-btn, .filmstrip-nav, #back-to-top, .footer-brand, .frame-item';
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