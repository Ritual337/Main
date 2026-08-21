/*
 * three-loader.js — performance gate for the background scene.
 * Previously three.min.js loaded unconditionally in <head>, even for visitors
 * whose OS/browser requests reduced motion (the old inline script just hid the
 * canvas *after* the ~600KB library had already downloaded and initialized).
 * This file skips that download entirely when it isn't needed, and only then
 * fetches three.min.js followed by three-scene.js.
 */
(function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const canvas = document.getElementById('three-canvas');
        if (canvas) canvas.style.display = 'none';
        return;
    }
    const lib = document.createElement('script');
    lib.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    lib.onload = function () {
        const scene = document.createElement('script');
        scene.src = 'js/three-scene.js';
        document.body.appendChild(scene);
    };
    lib.onerror = function () {
        const canvas = document.getElementById('three-canvas');
        if (canvas) canvas.style.display = 'none';
    };
    document.head.appendChild(lib);
})();
