/*
 * guestbook-store.js — shared data-access layer for guestbook entries.
 * Used by both guestbook.js (public page) and admin.js (moderation panel),
 * so there is exactly one place that knows how entries are persisted.
 *
 * Right now that's the browser's localStorage — the site has no server yet,
 * so this is the simplest thing that lets the guestbook actually work and
 * lets admin.html moderate what's in it. Every method below is async and
 * returns data shaped the way a real backend would, so swapping the inside
 * of each method for a `fetch()` call later shouldn't require changing any
 * calling code in guestbook.js or admin.js.
 *
 * Suggested REST contract for whenever a backend exists:
 *   GET    /api/guestbook             -> [{ id, name, message, createdAt }, ...]
 *   POST   /api/guestbook             <- { name, message }        -> created entry
 *   DELETE /api/guestbook/:id         (admin only, auth required) -> 204
 *   DELETE /api/guestbook             (admin only, auth required) -> clears all
 * Each TODO(backend) comment below marks exactly where that call would go.
 *
 * IMPORTANT: localStorage is per-browser, per-device. A note signed on one
 * visitor's phone will not show up on another visitor's laptop — it only
 * looks like a shared guestbook because everyone's writing into their own
 * copy. Real cross-visitor persistence needs a server + database behind
 * the endpoints above.
 */
(function (global) {
    'use strict';

    const STORAGE_KEY = 'ritual_guestbook_entries_v1';

    function readRaw() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            console.error('guestbook-store: could not read local storage', err);
            return [];
        }
    }

    function writeRaw(entries) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
            return true;
        } catch (err) {
            // Most likely a private-browsing / storage-full quota error.
            console.error('guestbook-store: could not write local storage', err);
            return false;
        }
    }

    function makeId() {
        return 'g_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }

    const GuestbookStore = {
        /** GET /api/guestbook — newest first. */
        async getAll() {
            // TODO(backend): const res = await fetch('/api/guestbook'); return res.json();
            return readRaw().slice().sort((a, b) => b.createdAt - a.createdAt);
        },

        /** POST /api/guestbook */
        async add({ name, message }) {
            const clean = {
                id: makeId(),
                name: (name || '').trim().slice(0, 30) || 'someone',
                message: (message || '').trim().slice(0, 240),
                createdAt: Date.now(),
            };
            if (!clean.message) throw new Error('A message is required.');
            // TODO(backend):
            // const res = await fetch('/api/guestbook', {
            //     method: 'POST', headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ name: clean.name, message: clean.message }),
            // });
            // return res.json();
            const entries = readRaw();
            entries.push(clean);
            if (!writeRaw(entries)) throw new Error('Could not save — your browser storage may be full.');
            return clean;
        },

        /** DELETE /api/guestbook/:id — admin only. */
        async remove(id) {
            // TODO(backend):
            // await fetch(`/api/guestbook/${id}`, { method: 'DELETE', headers: AdminAuth.authHeaders() });
            const entries = readRaw().filter((e) => e.id !== id);
            return writeRaw(entries);
        },

        /** DELETE /api/guestbook — admin only, clears every entry. */
        async clear() {
            // TODO(backend):
            // await fetch('/api/guestbook', { method: 'DELETE', headers: AdminAuth.authHeaders() });
            return writeRaw([]);
        },

        async count() {
            return readRaw().length;
        },
    };

    global.GuestbookStore = GuestbookStore;
})(window);
