/*
 * protection.js — client-side content protection.
 * Blocks right-click context menu, dragging of images/links, and text
 * selection. Re-enables text selection on form inputs so the guestbook
 * and login pages still work.
 * Owner bypass: append ?dev=1 to any URL.
 */
(function () {
    'use strict';
    if (location.search.includes('dev=1')) return;

    // Inject the CSS bits that can't be done from JS event listeners alone.
    var style = document.createElement('style');
    style.textContent = [
        'body{-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;}',
        'img{-webkit-user-drag:none;user-drag:none;}',
        'input,textarea{-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;user-select:text;}',
        '*{-webkit-tap-highlight-color:transparent;}'
    ].join('');
    (document.head || document.documentElement).appendChild(style);

    // Block right-click.
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // Block drag (images, links, selected text).
    document.addEventListener('dragstart', function (e) { e.preventDefault(); });
})();
