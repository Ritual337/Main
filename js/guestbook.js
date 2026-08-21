/*
 * guestbook.js — behavior for guestbook.html.
 * Reads/writes entries through GuestbookStore (see guestbook-store.js),
 * which now communicates with the Cloudflare backend API.
 */
(function () {
    'use strict';

    (function toastSystem() {
        const stack = document.getElementById('toast-stack');
        window.showToast = function (msg, opts = {}) {
            const el = document.createElement('div');
            el.className = 'toast' + (opts.error ? ' error' : '');
            el.textContent = msg;
            stack.appendChild(el);
            requestAnimationFrame(() => el.classList.add('show'));
            setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 350); }, opts.duration || 2800);
        };
    })();

    function fmtTime(ts) {
        const d = new Date(ts);
        const now = new Date();
        const sameDay = d.toDateString() === now.toDateString();
        const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (sameDay) return 'today, ' + time;
        return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined }) + ', ' + time;
    }

    async function renderLedger() {
        const ledger = document.getElementById('ledger');
        const countEl = document.getElementById('ledger-count');
        let entries;
        try {
            entries = await GuestbookStore.getAll();
        } catch (err) {
            console.error(err);
            ledger.innerHTML = '';
            const errEl = document.createElement('div');
            errEl.className = 'ledger-empty';
            errEl.textContent = "couldn't load entries — try refreshing.";
            ledger.appendChild(errEl);
            countEl.textContent = '';
            return;
        }

        countEl.innerHTML = '';
        const strong = document.createElement('strong');
        strong.textContent = String(entries.length);
        countEl.appendChild(strong);
        countEl.appendChild(document.createTextNode(entries.length === 1 ? ' entry signed' : ' entries signed'));

        ledger.innerHTML = '';
        if (entries.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'ledger-empty';
            empty.textContent = "no one's signed yet. be the first.";
            ledger.appendChild(empty);
            return;
        }

        entries.forEach((entry, i) => {
            const row = document.createElement('div');
            row.className = 'entry';
            row.style.animationDelay = Math.min(i * 0.04, 0.6) + 's';

            const num = document.createElement('div');
            num.className = 'entry-num';
            num.textContent = 'N°' + String(entries.length - i).padStart(3, '0');

            const body = document.createElement('div');
            const head = document.createElement('div');
            head.className = 'entry-head';
            const name = document.createElement('span');
            name.className = 'entry-name';
            name.textContent = entry.name;
            const time = document.createElement('span');
            time.className = 'entry-time';
            time.textContent = fmtTime(entry.createdAt);
            head.appendChild(name);
            head.appendChild(time);

            const msg = document.createElement('div');
            msg.className = 'entry-msg';
            msg.textContent = '\u201c' + entry.message + '\u201d';

            body.appendChild(head);
            body.appendChild(msg);
            row.appendChild(num);
            row.appendChild(body);
            ledger.appendChild(row);
        });
    }

    (function signForm() {
        const form = document.getElementById('sign-form');
        const nameInp = document.getElementById('gb-name');
        const msgInp = document.getElementById('gb-message');
        const websiteInp = document.getElementById('gb-website');
        const countEl = document.getElementById('gb-count');
        const submitBtn = document.getElementById('gb-submit');

        function updateCount() {
            const left = 240 - msgInp.value.length;
            countEl.textContent = left + ' left';
        }
        msgInp.addEventListener('input', updateCount);
        updateCount();

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Honeypot: a real visitor never fills this hidden field.
            if (websiteInp.value.trim() !== '') return;

            const message = msgInp.value.trim();
            if (!message) { window.showToast?.('Say something first.', { error: true }); return; }

            submitBtn.disabled = true;
            try {
                await GuestbookStore.add({ name: nameInp.value, message });
                await renderLedger();
                form.reset();
                updateCount();
                window.showToast?.('Signed. Thanks for stopping by.');
            } catch (err) {
                window.showToast?.(err.message || 'Could not sign — try again.', { error: true });
            } finally {
                submitBtn.disabled = false;
            }
        });
    })();

    renderLedger();
})();
