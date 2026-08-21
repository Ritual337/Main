/**
 * Gallery — Public gallery with search, pagination, skeleton, and lightbox share.
 */

let allImages = [];
let filteredImages = [];
let currentPage = 1;
const PER_PAGE = 24;
let lbImages = [];
let lbIndex = 0;
let pollingInterval = null;

// ---- DOM refs ----
const state = document.getElementById('gallery-state');
const grid = document.getElementById('gallery-grid');
const meta = document.getElementById('gallery-meta');
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
const pagination = document.getElementById('pagination');

// ---- Toast ----
window.showToast = window.showToast || ((msg, opts) => {
  const stack = document.getElementById('toast-stack') || (() => {
    const d = document.createElement('div');
    d.id = 'toast-stack';
    d.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;align-items:center;gap:.5rem;pointer-events:none;max-width:90vw;';
    document.body.appendChild(d);
    return d;
  })();
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = `font-family:'IBM Plex Mono',monospace;font-size:.55rem;letter-spacing:.1em;color:#efe8d9;background:rgba(11,10,9,.94);border:1px solid #3c352d;border-left:2px solid ${opts?.error ? '#6e0f17' : '#ff3346'};padding:.6rem 1rem;opacity:0;transform:translateY(10px);transition:opacity .3s ease,transform .3s ease;white-space:nowrap;pointer-events:none;backdrop-filter:blur(8px);border-radius:2px;max-width:100%;`;
  stack.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(10px)'; setTimeout(() => el.remove(), 350); }, opts?.duration || 2800);
});

// ---- Helper functions ----
function showState(text) {
  state.textContent = text;
  state.hidden = false;
  grid.hidden = true;
  pagination.hidden = true;
  meta.textContent = '';
}

function hideState() {
  state.hidden = true;
  grid.hidden = false;
  pagination.hidden = false;
}

function formatDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'today';
  const days = Math.floor((now - d) / (86400000));
  if (days < 7) return days + 'd ago';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ---- Load images ----
async function loadImages() {
  showState('Loading…');
  grid.className = 'gallery-grid skeleton';
  grid.innerHTML = Array(12).fill(0).map(() => `
    <div class="gallery-card"><div class="skeleton-img"></div></div>
  `).join('');

  try {
    const res = await fetch('/api/gallery');
    if (!res.ok) throw new Error(`API responded ${res.status}`);
    const data = await res.json();
    allImages = data.images || [];
  } catch (err) {
    console.error('[gallery] error:', err);
    allImages = [];
  }

  // Update metadata
  if (allImages.length > 0) {
    const last = allImages[0];
    meta.textContent = `${allImages.length} frames · last ${formatDate(last.createdAt || Date.now())}`;
  } else {
    meta.textContent = '0 frames';
  }

  filteredImages = [...allImages];
  currentPage = 1;
  render();
}

// ---- Search ----
function applySearch() {
  const q = searchInput.value.trim().toLowerCase();
  filteredImages = q ? allImages.filter(img => (img.caption || '').toLowerCase().includes(q)) : [...allImages];
  currentPage = 1;
  render();
}

searchInput.addEventListener('input', applySearch);
searchClear.addEventListener('click', () => {
  searchInput.value = '';
  applySearch();
  searchInput.focus();
});

// ---- Pagination ----
function renderPagination(total) {
  const totalPages = Math.ceil(total / PER_PAGE);
  pagination.innerHTML = '';
  if (totalPages <= 1) return;

  const prev = document.createElement('button');
  prev.textContent = '←';
  prev.disabled = currentPage === 1;
  prev.addEventListener('click', () => { if (currentPage > 1) { currentPage--; render(); } });
  pagination.appendChild(prev);

  for (let i = 1; i <= Math.min(totalPages, 8); i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i === currentPage) btn.className = 'active';
    btn.addEventListener('click', () => { currentPage = i; render(); });
    pagination.appendChild(btn);
  }

  if (totalPages > 8) {
    const dots = document.createElement('span');
    dots.textContent = '…';
    dots.style.cssText = 'font-family:var(--mono);color:var(--ink);padding:.4rem .4rem;';
    pagination.appendChild(dots);
    const last = document.createElement('button');
    last.textContent = totalPages;
    last.addEventListener('click', () => { currentPage = totalPages; render(); });
    pagination.appendChild(last);
  }

  const next = document.createElement('button');
  next.textContent = '→';
  next.disabled = currentPage === totalPages;
  next.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; render(); } });
  pagination.appendChild(next);
}

// ---- Render grid ----
function render() {
  const total = filteredImages.length;
  if (total === 0) {
    showState(searchInput.value.trim() ? 'No frames match your search.' : 'No frames yet.');
    pagination.innerHTML = '';
    return;
  }

  hideState();
  const start = (currentPage - 1) * PER_PAGE;
  const pageImages = filteredImages.slice(start, start + PER_PAGE);

  grid.className = 'gallery-grid fade';
  grid.innerHTML = pageImages.map((img, i) => `
    <button class="gallery-card" data-index="${start + i}" type="button">
      <span class="gallery-num">${String(start + i + 1).padStart(2, '0')}</span>
      <img src="${img.src}" alt="${img.caption || ''}" loading="lazy" />
      <span class="gallery-cap">${img.caption || ''}</span>
    </button>
  `).join('');

  // Re-apply layout
  const savedLayout = localStorage.getItem('ritual_gallery_layout') || 'grid';
  grid.className = 'gallery-grid layout-' + savedLayout;

  // Attach click events
  grid.querySelectorAll('.gallery-card').forEach((card) => {
    card.addEventListener('click', () => {
      const idx = Number(card.dataset.index);
      openLightbox(filteredImages, idx);
    });
  });

  renderPagination(total);
  // After a tiny delay, remove fade
  requestAnimationFrame(() => {
    grid.classList.remove('fade');
  });
}

// ---- Lightbox ----
function openLightbox(images, index) {
  lbImages = images;
  lbIndex = index;
  document.body.classList.add('overlay-open');
  document.getElementById('lightbox').classList.add('active');
  showLightboxImage();
}

function showLightboxImage() {
  const img = lbImages[lbIndex];
  const el = document.getElementById('lightbox-img');
  el.src = img.src;
  el.alt = img.caption || '';
  document.getElementById('lightbox-caption').textContent = img.caption || '';
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('active');
  document.body.classList.remove('overlay-open');
}

function step(delta) {
  lbIndex = (lbIndex + delta + lbImages.length) % lbImages.length;
  showLightboxImage();
}

// ---- Share link ----
document.getElementById('lightbox-share').addEventListener('click', () => {
  const img = lbImages[lbIndex];
  if (!img) return;
  const shareUrl = `${window.location.origin}${window.location.pathname}?image=${encodeURIComponent(img.id)}`;
  navigator.clipboard.writeText(shareUrl).then(() => {
    window.showToast('Link copied to clipboard!');
  }).catch(() => {
    // Fallback
    const input = document.createElement('input');
    input.value = shareUrl;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
    window.showToast('Link copied!');
  });
});

// ---- Lightbox keyboard + swipe ----
document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
document.getElementById('lightbox-backdrop').addEventListener('click', closeLightbox);
document.getElementById('lightbox-prev').addEventListener('click', () => step(-1));
document.getElementById('lightbox-next').addEventListener('click', () => step(1));

document.addEventListener('keydown', (e) => {
  if (!document.getElementById('lightbox').classList.contains('active')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') step(-1);
  if (e.key === 'ArrowRight') step(1);
});

// Swipe support (touch)
let touchStartX = 0;
let touchStartY = 0;
const lightbox = document.getElementById('lightbox');
lightbox.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
}, { passive: true });
lightbox.addEventListener('touchend', (e) => {
  if (!lightbox.classList.contains('active')) return;
  const dx = e.changedTouches[0].screenX - touchStartX;
  const dy = e.changedTouches[0].screenY - touchStartY;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) step(1);
    else step(-1);
  }
}, { passive: true });

// ---- Auto-polling (every 30s) ----
function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(async () => {
    try {
      const res = await fetch('/api/gallery');
      if (!res.ok) return;
      const data = await res.json();
      const newImages = data.images || [];
      if (newImages.length !== allImages.length || JSON.stringify(newImages.map(i => i.id)) !== JSON.stringify(allImages.map(i => i.id))) {
        allImages = newImages;
        filteredImages = [...allImages];
        if (allImages.length > 0) {
          const last = allImages[0];
          meta.textContent = `${allImages.length} frames · last ${formatDate(last.createdAt || Date.now())}`;
        }
        applySearch(); // re-apply search and re-render
        window.showToast('Gallery updated.');
      }
    } catch (_) { /* ignore */ }
  }, 30000);
}

// ---- Deep link ----
function checkDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const imageId = params.get('image');
  if (imageId && allImages.length) {
    const idx = allImages.findIndex(i => i.id === imageId);
    if (idx >= 0) {
      setTimeout(() => openLightbox(allImages, idx), 500);
      // Clean URL
      const url = new URL(window.location);
      url.searchParams.delete('image');
      window.history.replaceState({}, '', url);
    }
  }
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', async () => {
  await loadImages();
  startPolling();
  checkDeepLink();
});
