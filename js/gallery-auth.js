/**
 * Ritual — Gallery auth module.
 * Client-side session handling that talks to a backend you add later.
 * See GALLERY_BACKEND_README.md for the exact API contract expected here.
 *
 * IMPORTANT: this file only *gates the UI*. Real protection has to come from
 * your backend rejecting unauthenticated requests to /gallery — never trust
 * the client alone.
 */
const GALLERY_AUTH = (() => {
  const API_BASE = '/api';              // change to your backend base URL
  const TOKEN_KEY = 'ritual_gallery_token';
  const LOGIN_PAGE = 'login.html';
  const GALLERY_PAGE = 'gallery.html';

  const getToken   = () => sessionStorage.getItem(TOKEN_KEY);
  const setToken   = (t) => sessionStorage.setItem(TOKEN_KEY, t);
  const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);

  // Call at the top of any protected page. Redirects to login if no token.
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
    try { data = await res.json(); } catch (_) { /* non-JSON response */ }
    if (!res.ok) throw new Error(data.error || 'Incorrect password.');
    if (!data.token) throw new Error('Backend response is missing a token.');
    setToken(data.token);
    return data;
  }

  function logout() {
    clearToken();
    window.location.href = LOGIN_PAGE;
  }

  // Fetch wrapper that attaches the bearer token and bounces to login on 401.
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

  return { API_BASE, getToken, setToken, clearToken, requireAuth, login, logout, authFetch };
})();

// Wire up login.html's form + any [data-logout] buttons on any page.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-logout]').forEach((btn) => {
    btn.addEventListener('click', GALLERY_AUTH.logout);
  });

  const form = document.getElementById('login-form');
  if (!form) return;

  const input   = document.getElementById('password');
  const errorEl = document.getElementById('login-error');
  const submit  = document.getElementById('login-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    submit.disabled = true;
    submit.querySelector('span').textContent = 'Checking…';

    try {
      await GALLERY_AUTH.login(input.value);
      const params = new URLSearchParams(location.search);
      window.location.href = params.get('redirect') || 'gallery.html';
    } catch (err) {
      errorEl.textContent = err.message || 'Something went wrong.';
      errorEl.hidden = false;
      submit.disabled = false;
      submit.querySelector('span').textContent = 'Enter';
      input.focus();
      input.select();
    }
  });
});
