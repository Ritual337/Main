/*
 * admin.js — auth gate + dashboard behavior for admin-guestbook.html.
 * Uses Cloudflare Pages Functions as the backend (D1 + JWT auth).
 */
(function () {
    'use strict';

    const SESSION_KEY = 'ritual_admin_session_v1';
    const LOCKOUT_KEY = 'ritual_admin_lockout_v1';
    const AUDIT_KEY = 'ritual_admin_audit_v1';

    const SESSION_MS = 30 * 60 * 1000;
    const LOCKOUT_AFTER = 5;
    const LOCKOUT_MS = 60 * 1000;
    const AUDIT_MAX = 50;

    // ---- low-level helpers ---------------------------------------------

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
        async verifyPassword(password) {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            if (!res.ok) return false;
            const { token } = await res.json();
            const session = { token, expiresAt: Date.now() + SESSION_MS };
            writeJSON(sessionStorage, SESSION_KEY, session);
            sessionStorage.removeItem(LOCKOUT_KEY);
            logAudit('Logged in');
            return true;
        },

        getSession() {
            const session = readJSON(sessionStorage, SESSION_KEY, null);
            if (!session) return null;
            if (Date.now() > session.expiresAt) {
                sessionStorage.removeItem(SESSION_KEY);
                return null;
            }
            return session;
        },

        endSession(reason) {
            sessionStorage.removeItem(SESSION_KEY);
            logAudit(reason || 'Logged out');
        },

        authHeaders() {
            const session = this.getSession();
            return session ? { Authorization: 'Bearer ' + session.token } : {};
        },

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
    const loginForm = document.getElementById('login-form');
    const authGate = document.getElementById('auth-gate');
    const dashboard = document.getElementById('dashboard');

    function showLogin() {
        gateLabel.textContent = 'Restricted access';
        gateTitle.textContent = 'Admin';
        gateSub.textContent = 'Enter the admin password for this site.';
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
        // Auto‑refresh every 30 seconds
        if (window.dashRefreshInterval) clearInterval(window.dashRefreshInterval);
        window.dashRefreshInterval = setInterval(() => {
            if (!dashboard.hidden) {
                refreshDashboard();
            }
        }, 30000);
    }

    // ---- login form ------------------------------------------------------

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const state = AdminAuth.getLockout();
        if (state.lockedUntil && state.lockedUntil > Date.now()) return;

        const pass = document.getElementById('login-pass').value;
        const errorEl = document.getElementById('login-error');
        const ok = await AdminAuth.verifyPassword(pass);
        if (ok) {
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

    // ---- session timer / auto-logout -------------------------------------

    let sessionInterval = null;
    function startSessionTimer() {
        clearInterval(sessionInterval);
        const timerEl = document.getElementById('session-timer');
        const tick = () => {
            const session = AdminAuth.getSession();
            if (!session) {
                clearInterval(sessionInterval);
                if (window.dashRefreshInterval) {
                    clearInterval(window.dashRefreshInterval);
                    window.dashRefreshInterval = null;
                }
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
        if (window.dashRefreshInterval) {
            clearInterval(window.dashRefreshInterval);
            window.dashRefreshInterval = null;
        }
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

    // ---- Clear activity log --------------------------------------------
    document.getElementById('clear-audit-btn').addEventListener('click', () => {
        const entries = readJSON(localStorage, AUDIT_KEY, []);
        if (entries.length === 0) {
            window.showToast?.('Activity log is already empty.');
            return;
        }
        const sure = confirm('Clear the admin activity log? This cannot be undone.');
        if (!sure) return;
        localStorage.removeItem(AUDIT_KEY);
        window.showToast?.('Activity log cleared.');
        renderAuditLog();
    });

    // ---- Refresh dashboard button --------------------------------------
    document.getElementById('refresh-dash-btn').addEventListener('click', () => {
        refreshDashboard();
        window.showToast?.('Refreshed.');
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
        if (!window.crypto || !window.crypto.subtle) {
            gateLabel.textContent = 'Unavailable';
            gateTitle.textContent = 'Needs HTTPS';
            gateSub.textContent = 'This panel requires HTTPS (or localhost) for security.';
            authGate.hidden = false;
            dashboard.hidden = true;
            return;
        }

        // Check for existing valid session
        const session = AdminAuth.getSession();
        if (session) {
            showDashboard();
        } else {
            showLogin();
        }
    })();
})();
