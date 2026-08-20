/*
 * admin.js — auth gate + dashboard behavior for admin.html.
 *
 * ============================================================================
 * ⚠ SECURITY NOTE — READ THIS BEFORE PUTTING ANYTHING REAL BEHIND THIS PAGE
 * ============================================================================
 * Ritual is a static site with no server. Everything below — the password
 * check, the session, the lockout — runs entirely in the visitor's own
 * browser, using code anyone can read via "view source" and data anyone can
 * read or edit via devtools > Application > Storage. That means:
 *
 *   - This gate stops a casual visitor from poking around. It does NOT stop
 *     someone who opens devtools: they can read admin.js, flip the
 *     `dashboard` element's `hidden` attribute, or just delete the
 *     ritual_admin_auth_v1 key and go through setup again as "the admin."
 *   - The password hash lives in localStorage, on the visitor's own device.
 *     It is not a secret from that visitor. Hashing it (see sha256Hex below)
 *     stops someone glancing at the raw value from reading the password back
 *     out, but it is not protection against someone who controls the device.
 *   - Nothing here can protect data that matters — real guestbook moderation
 *     for a real audience needs a real backend.
 *
 * Before this handles anything you'd actually be upset to lose control of:
 *   1. Add a server that verifies credentials itself and issues a
 *      short-lived, HttpOnly, Secure, SameSite=Strict session cookie (or a
 *      JWT) — never a client-side "is this hash equal" check.
 *   2. Require that cookie/token on every admin API request server-side,
 *      not just in the browser.
 *   3. Serve the whole site over HTTPS.
 *   4. Rate-limit and log login attempts on the server, not just in
 *      sessionStorage (which any visitor can clear).
 *
 * Everything in this file is written so that swapping in that real backend
 * later is mostly a matter of replacing the bodies of AdminAuth.verifyPassword()
 * and GuestbookStore's methods (see guestbook-store.js) with fetch() calls —
 * the TODO(backend) comments mark exactly where.
 * ============================================================================
 */
(function () {
    'use strict';

    const AUTH_KEY = 'ritual_admin_auth_v1';       // localStorage: { salt, hash, createdAt }
    const SESSION_KEY = 'ritual_admin_session_v1';  // sessionStorage: { token, expiresAt }
    const LOCKOUT_KEY = 'ritual_admin_lockout_v1';  // sessionStorage: { failCount, lockedUntil }
    const AUDIT_KEY = 'ritual_admin_audit_v1';      // localStorage: [{ action, detail, at }, ...]

    const SESSION_MS = 30 * 60 * 1000;   // auto-logout after 30 minutes idle-or-not
    const LOCKOUT_AFTER = 5;             // failed attempts before a cooldown
    const LOCKOUT_MS = 60 * 1000;        // cooldown length
    const AUDIT_MAX = 50;

    // ---- low-level helpers ---------------------------------------------

    async function sha256Hex(str) {
        const bytes = new TextEncoder().encode(str);
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    function randomHex(byteLen) {
        const arr = new Uint8Array(byteLen);
        crypto.getRandomValues(arr);
        return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    function readJSON(storage, key, fallback) {
        try {
            const raw = storage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch { return fallback; }
    }
    function writeJSON(storage, key, value) {
        try { storage.setItem(key, JSON.stringify(value)); return true; }
        catch (err) { console.error('admin: storage write failed', err); return false; }
    }

    // ---- AdminAuth --------------------------------------------------------

    const AdminAuth = {
        hasAccount() {
            return !!readJSON(localStorage, AUTH_KEY, null);
        },

        async createAccount(password) {
            const salt = randomHex(16);
            const hash = await sha256Hex(salt + ':' + password);
            writeJSON(localStorage, AUTH_KEY, { salt, hash, createdAt: Date.now() });
            logAudit('Admin access created on this device');
            return this.startSession();
        },

        async verifyPassword(password) {
            // TODO(backend): replace this whole method with something like
            //   const res = await fetch('/api/admin/login', {
            //       method: 'POST', headers: { 'Content-Type': 'application/json' },
            //       body: JSON.stringify({ password }),
            //   });
            //   if (!res.ok) return false;
            //   const { token, expiresAt } = await res.json();
            //   sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, expiresAt }));
            //   return true;
            const account = readJSON(localStorage, AUTH_KEY, null);
            if (!account) return false;
            const hash = await sha256Hex(account.salt + ':' + password);
            return hash === account.hash;
        },

        resetAccount() {
            localStorage.removeItem(AUTH_KEY);
            sessionStorage.removeItem(SESSION_KEY);
            sessionStorage.removeItem(LOCKOUT_KEY);
            logAudit('Admin access reset on this device');
        },

        startSession() {
            const session = { token: randomHex(16), expiresAt: Date.now() + SESSION_MS };
            writeJSON(sessionStorage, SESSION_KEY, session);
            sessionStorage.removeItem(LOCKOUT_KEY);
            logAudit('Logged in');
            return session;
        },

        getSession() {
            const session = readJSON(sessionStorage, SESSION_KEY, null);
            if (!session) return null;
            if (Date.now() > session.expiresAt) { sessionStorage.removeItem(SESSION_KEY); return null; }
            return session;
        },

        endSession(reason) {
            sessionStorage.removeItem(SESSION_KEY);
            logAudit(reason || 'Logged out');
        },

        // Forward-compatible stub: once there's a backend, requests that need
        // auth would send this header. Today it's inert — nothing checks it.
        authHeaders() {
            const session = this.getSession();
            return session ? { Authorization: 'Bearer ' + session.token } : {};
        },

        // ---- lockout (a mild deterrent, not real rate limiting) ----------
        getLockout() {
            return readJSON(sessionStorage, LOCKOUT_KEY, { failCount: 0, lockedUntil: 0 });
        },
        recordFailure() {
            const state = this.getLockout();
            state.failCount = (state.failCount || 0) + 1;
            if (state.failCount >= LOCKOUT_AFTER) {
                state.lockedUntil = Date.now() + LOCKOUT_MS;
                state.failCount = 0;
            }
            writeJSON(sessionStorage, LOCKOUT_KEY, state);
            return state;
        },
        clearLockout() {
            sessionStorage.removeItem(LOCKOUT_KEY);
        },
    };

    function logAudit(action, detail) {
        const entries = readJSON(localStorage, AUDIT_KEY, []);
        entries.unshift({ action, detail: detail || '', at: Date.now() });
        writeJSON(localStorage, AUDIT_KEY, entries.slice(0, AUDIT_MAX));
    }

    // ---- toast --------------------------------------------------------

    (function toastSystem() {
        const stack = document.getElementById('toast-stack');
        window.showToast = function (msg, opts = {}) {
            const el = document.createElement('div');
            el.className = 'toast' + (opts.error ? ' error' : '');
            el.textContent = msg;
            stack.appendChild(el);
            requestAnimationFrame(() => el.classList.add('show'));
            setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 350); }, opts.duration || 2600);
        };
    })();

    // ---- password show/hide toggles ------------------------------------

    document.querySelectorAll('.pass-toggle').forEach((btn) => {
        btn.addEventListener('click', () => {
            const target = document.getElementById(btn.dataset.target);
            const showing = target.type === 'text';
            target.type = showing ? 'password' : 'text';
            btn.innerHTML = showing ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
        });
    });

    // ---- gate view state -------------------------------------------------

    const gateLabel = document.getElementById('gate-label');
    const gateTitle = document.getElementById('gate-title');
    const gateSub = document.getElementById('gate-sub');
    const setupForm = document.getElementById('setup-form');
    const loginForm = document.getElementById('login-form');
    const authGate = document.getElementById('auth-gate');
    const dashboard = document.getElementById('dashboard');

    function showSetup() {
        gateLabel.textContent = 'First-time setup';
        gateTitle.textContent = 'Set a password';
        gateSub.textContent = "No admin password is set on this device yet. Choose one to continue — it's stored only in this browser.";
        setupForm.hidden = false;
        loginForm.hidden = true;
        authGate.hidden = false;
        dashboard.hidden = true;
        setupForm.querySelector('input')?.focus();
    }

    function showLogin() {
        gateLabel.textContent = 'Restricted access';
        gateTitle.textContent = 'Admin';
        gateSub.textContent = 'Enter the password for this device to continue.';
        setupForm.hidden = true;
        loginForm.hidden = false;
        authGate.hidden = false;
        dashboard.hidden = true;
        applyLockoutUI();
        if (!AdminAuth.getLockout().lockedUntil) document.getElementById('login-pass')?.focus();
    }

    let lockoutInterval = null;
    function applyLockoutUI() {
        const state = AdminAuth.getLockout();
        const errorEl = document.getElementById('login-error');
        const submitBtn = document.getElementById('login-submit');
        clearInterval(lockoutInterval);
        if (state.lockedUntil && state.lockedUntil > Date.now()) {
            submitBtn.disabled = true;
            const tick = () => {
                const secs = Math.max(0, Math.ceil((state.lockedUntil - Date.now()) / 1000));
                if (secs <= 0) {
                    clearInterval(lockoutInterval);
                    errorEl.textContent = '';
                    submitBtn.disabled = false;
                    return;
                }
                errorEl.textContent = `Too many attempts — try again in ${secs}s.`;
            };
            tick();
            lockoutInterval = setInterval(tick, 1000);
        } else {
            submitBtn.disabled = false;
        }
    }

    async function showDashboard() {
        authGate.hidden = true;
        dashboard.hidden = false;
        await refreshDashboard();
        startSessionTimer();
    }

    // ---- setup form ------------------------------------------------------

    setupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pass = document.getElementById('setup-pass').value;
        const confirm = document.getElementById('setup-pass-confirm').value;
        const errorEl = document.getElementById('setup-error');
        errorEl.textContent = '';
        if (pass.length < 8) { errorEl.textContent = 'Use at least 8 characters.'; return; }
        if (pass !== confirm) { errorEl.textContent = "Passwords don't match."; return; }
        await AdminAuth.createAccount(pass);
        setupForm.reset();
        window.showToast?.('Admin access created for this device.');
        showDashboard();
    });

    // ---- login form ------------------------------------------------------

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const state = AdminAuth.getLockout();
        if (state.lockedUntil && state.lockedUntil > Date.now()) return;

        const pass = document.getElementById('login-pass').value;
        const errorEl = document.getElementById('login-error');
        const ok = await AdminAuth.verifyPassword(pass);
        if (ok) {
            AdminAuth.startSession();
            loginForm.reset();
            errorEl.textContent = '';
            showDashboard();
        } else {
            const newState = AdminAuth.recordFailure();
            document.getElementById('login-pass').value = '';
            document.getElementById('login-pass').focus();
            if (newState.lockedUntil > Date.now()) {
                applyLockoutUI();
            } else {
                const left = LOCKOUT_AFTER - newState.failCount;
                errorEl.textContent = `Incorrect password. ${left} attempt${left === 1 ? '' : 's'} left.`;
            }
        }
    });

    document.getElementById('reset-link').addEventListener('click', () => {
        const sure = confirm("This clears the admin password saved on this device. You'll set up a new one next. Continue?");
        if (!sure) return;
        AdminAuth.resetAccount();
        showSetup();
    });

    // ---- session timer / auto-logout -------------------------------------

    let sessionInterval = null;
    function startSessionTimer() {
        clearInterval(sessionInterval);
        const timerEl = document.getElementById('session-timer');
        const tick = () => {
            const session = AdminAuth.getSession();
            if (!session) {
                clearInterval(sessionInterval);
                window.showToast?.('Session expired — please log in again.', { error: true });
                showLogin();
                return;
            }
            const secs = Math.max(0, Math.round((session.expiresAt - Date.now()) / 1000));
            const m = String(Math.floor(secs / 60)).padStart(2, '0');
            const s = String(secs % 60).padStart(2, '0');
            timerEl.textContent = `session — ${m}:${s}`;
        };
        tick();
        sessionInterval = setInterval(tick, 1000);
    }

    document.getElementById('logout-btn').addEventListener('click', () => {
        clearInterval(sessionInterval);
        AdminAuth.endSession('Logged out');
        showLogin();
    });

    // ---- dashboard rendering -----------------------------------------

    function fmtTime(ts) {
        const d = new Date(ts);
        const now = new Date();
        const sameDay = d.toDateString() === now.toDateString();
        const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return (sameDay ? 'today, ' : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ') + time;
    }

    function storageUsedBytes() {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('ritual_')) {
                total += new Blob([localStorage.getItem(key) || '']).size;
            }
        }
        return total;
    }

    async function refreshDashboard() {
        const entries = await GuestbookStore.getAll();
        const today = new Date().toDateString();

        document.getElementById('stat-total').textContent = String(entries.length);
        document.getElementById('stat-today').textContent = String(entries.filter((e) => new Date(e.createdAt).toDateString() === today).length);
        document.getElementById('stat-storage').textContent = (storageUsedBytes() / 1024).toFixed(1) + ' KB';

        renderEntryTable(entries);
        renderAuditLog();
    }

    function renderEntryTable(entries) {
        const table = document.getElementById('entry-table');
        table.innerHTML = '';
        if (entries.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'table-empty';
            empty.textContent = 'No entries yet.';
            table.appendChild(empty);
            return;
        }
        entries.forEach((entry, i) => {
            const row = document.createElement('div');
            row.className = 'entry-row';

            const num = document.createElement('div');
            num.className = 'entry-row-num';
            num.textContent = 'N°' + String(entries.length - i).padStart(3, '0');

            const meta = document.createElement('div');
            meta.className = 'entry-row-meta';
            const name = document.createElement('div');
            name.className = 'entry-row-name';
            name.textContent = entry.name;
            const time = document.createElement('div');
            time.className = 'entry-row-time';
            time.textContent = fmtTime(entry.createdAt);
            meta.appendChild(name);
            meta.appendChild(time);

            const msg = document.createElement('div');
            msg.className = 'entry-row-msg';
            msg.textContent = entry.message;

            const del = document.createElement('button');
            del.className = 'entry-row-del';
            del.setAttribute('aria-label', 'Delete this entry');
            del.innerHTML = '<i class="fas fa-trash"></i>';
            del.addEventListener('click', () => deleteEntry(entry));

            row.appendChild(num);
            row.appendChild(meta);
            row.appendChild(msg);
            row.appendChild(del);
            table.appendChild(row);
        });
    }

    async function deleteEntry(entry) {
        const sure = confirm(`Delete this entry from "${entry.name}"? This can't be undone.`);
        if (!sure) return;
        await GuestbookStore.remove(entry.id);
        logAudit('Deleted entry', `from ${entry.name}`);
        window.showToast?.('Entry deleted.');
        refreshDashboard();
    }

    document.getElementById('clear-all-btn').addEventListener('click', async () => {
        const entries = await GuestbookStore.getAll();
        if (entries.length === 0) { window.showToast?.('Nothing to clear.'); return; }
        const sure = confirm(`Delete all ${entries.length} guestbook entries? This can't be undone.`);
        if (!sure) return;
        await GuestbookStore.clear();
        logAudit('Cleared all entries', `${entries.length} removed`);
        window.showToast?.('All entries cleared.');
        refreshDashboard();
    });

    function renderAuditLog() {
        const list = document.getElementById('audit-list');
        const entries = readJSON(localStorage, AUDIT_KEY, []);
        list.innerHTML = '';
        if (entries.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'table-empty';
            empty.textContent = 'No activity yet.';
            list.appendChild(empty);
            return;
        }
        entries.forEach((e) => {
            const row = document.createElement('div');
            row.className = 'audit-row';
            const action = document.createElement('span');
            action.className = 'audit-action';
            action.textContent = e.action + (e.detail ? ' — ' + e.detail : '');
            const time = document.createElement('span');
            time.className = 'audit-time';
            time.textContent = fmtTime(e.at);
            row.appendChild(action);
            row.appendChild(time);
            list.appendChild(row);
        });
    }

    // ---- boot --------------------------------------------------------

    (function init() {
        // crypto.subtle (used for password hashing) only exists in a secure
        // context — HTTPS, or localhost while developing. Fail loudly and
        // clearly here rather than throwing on the first login attempt.
        if (!window.crypto || !window.crypto.subtle) {
            gateLabel.textContent = 'Unavailable';
            gateTitle.textContent = 'Needs HTTPS';
            gateSub.textContent = 'This panel hashes your password with the Web Crypto API, which browsers only allow on HTTPS (or localhost while developing). Serve the site over HTTPS and reload this page.';
            setupForm.hidden = true;
            loginForm.hidden = true;
            authGate.hidden = false;
            dashboard.hidden = true;
            return;
        }
        if (!AdminAuth.hasAccount()) { showSetup(); return; }
        const session = AdminAuth.getSession();
        if (session) { showDashboard(); return; }
        showLogin();
    })();
})();
