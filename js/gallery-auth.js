const GALLERY_AUTH = (() => {
  const API_BASE = '/api';
  const TOKEN_KEY = 'ritual_gallery_token';
  const LOCKOUT_KEY = 'ritual_gallery_lockout_v1';
  const LOGIN_PAGE = 'login.html';
  const GALLERY_PAGE = 'gallery.html';
  const LOCKOUT_AFTER = 5;
  const LOCKOUT_MS = 60 * 1000;

  const getToken   = () => sessionStorage.getItem(TOKEN_KEY);
  const setToken   = (t) => sessionStorage.setItem(TOKEN_KEY, t);
  const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);

  function getLockout() {
    try {
      const raw = sessionStorage.getItem(LOCKOUT_KEY);
      return raw ? JSON.parse(raw) : { failCount: 0, lockedUntil: 0 };
    } catch {
      return { failCount: 0, lockedUntil: 0 };
    }
  }

  function recordFailure() {
    const state = getLockout();
    state.failCount = (state.failCount || 0) + 1;
    if (state.failCount >= LOCKOUT_AFTER) {
      state.lockedUntil = Date.now() + LOCKOUT_MS;
      state.failCount = 0;
    }
    sessionStorage.setItem(LOCKOUT_KEY, JSON.stringify(state));
    return state;
  }

  function clearLockout() {
    sessionStorage.removeItem(LOCKOUT_KEY);
  }

  function requireAuth() {
    if (!getToken()) {
      const redirect = encodeURIComponent(location.pathname + location.search);
      window.location.href = `${LOGIN_PAGE}?redirect=${redirect}`;
      return false;
    }
    return true;
  }

  async function login(password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error(data.error || 'Incorrect password.');
    if (!data.token) throw new Error('Backend response is missing a token.');
    setToken(data.token);
    return data;
  }

  function logout() {
    clearToken();
    window.location.href = LOGIN_PAGE;
  }

  async function authFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${getToken()}`,
      },
    });
    if (res.status === 401) {
      clearToken();
      window.location.href = LOGIN_PAGE;
      throw new Error('Session expired.');
    }
    return res;
  }

  return {
    API_BASE, getToken, setToken, clearToken,
    requireAuth, login, logout, authFetch,
    getLockout, recordFailure, clearLockout,
    LOCKOUT_AFTER, LOCKOUT_MS,
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-logout]').forEach((btn) => {
    btn.addEventListener('click', GALLERY_AUTH.logout);
  });

  const form = document.getElementById('login-form');
  if (!form) return;

  const input   = document.getElementById('password');
  const errorEl = document.getElementById('login-error');
  const submit  = document.getElementById('login-submit');

  let lockoutInterval = null;

  function applyLockoutUI() {
    const state = GALLERY_AUTH.getLockout();
    clearInterval(lockoutInterval);

    if (state.lockedUntil && state.lockedUntil > Date.now()) {
      submit.disabled = true;
      const tick = () => {
        const secs = Math.max(0, Math.ceil((state.lockedUntil - Date.now()) / 1000));
        if (secs <= 0) {
          clearInterval(lockoutInterval);
          errorEl.textContent = '';
          submit.disabled = false;
          return;
        }
        errorEl.textContent = `Too many attempts — try again in ${secs}s.`;
      };
      tick();
      lockoutInterval = setInterval(tick, 1000);
    } else {
      submit.disabled = false;
    }
  }

  // If a previous session already tripped the lockout, show it immediately.
  applyLockoutUI();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const current = GALLERY_AUTH.getLockout();
    if (current.lockedUntil && current.lockedUntil > Date.now()) return;

    errorEl.textContent = '';
    submit.disabled = true;
    submit.querySelector('span').textContent = 'Checking…';

    try {
      await GALLERY_AUTH.login(input.value);
      GALLERY_AUTH.clearLockout();
      const params = new URLSearchParams(location.search);
      window.location.href = params.get('redirect') || GALLERY_PAGE;
    } catch (err) {
      const newState = GALLERY_AUTH.recordFailure();
      submit.querySelector('span').textContent = 'Enter';
      input.focus();
      input.select();

      if (newState.lockedUntil > Date.now()) {
        applyLockoutUI();
      } else {
        submit.disabled = false;
        const left = GALLERY_AUTH.LOCKOUT_AFTER - newState.failCount;
        errorEl.textContent = `Incorrect password. ${left} attempt${left === 1 ? '' : 's'} left.`;
      }
    }
  });
});