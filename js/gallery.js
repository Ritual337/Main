/**
 * Ritual — Gallery page logic.
 * Expects GALLERY_AUTH from gallery-auth.js to be loaded first.
 */

let lbImages = [];
let lbIndex = 0;

document.addEventListener('DOMContentLoaded', async () => {
  if (!GALLERY_AUTH.requireAuth()) return;

  const state = document.getElementById('gallery-state');
  const grid = document.getElementById('gallery-grid');

  const showState = (text) => { state.textContent = text; state.hidden = false; grid.hidden = true; };

  showState('Loading transmission…');

  let images = [];
  try {
    const res = await GALLERY_AUTH.authFetch('/gallery');
    if (!res.ok) throw new Error(`API responded ${res.status}`);
    const data = await res.json();
    images = data.images || [];
  } catch (err) {
    console.error('[gallery] backend error:', err);
    images = [];
  }

  if (!images.length) { showState('No frames yet.'); return; }

  state.hidden = true;
  grid.hidden = false;
  renderGrid(images);
});

function renderGrid(images) {
  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = images.map((img, i) => `
    <button class="gallery-card" data-index="${i}" type="button">
      <span class="gallery-num">${String(i + 1).padStart(2, '0')}</span>
      <img src="${img.src}" alt="${img.caption || ''}" loading="lazy" />
      <span class="gallery-cap">${img.caption || ''}</span>
    </button>
  `).join('');

  // Re-apply saved layout
  const savedLayout = localStorage.getItem('ritual_gallery_layout') || 'grid';
  grid.className = 'gallery-grid layout-' + savedLayout;

  grid.querySelectorAll('.gallery-card').forEach((card) => {
    card.addEventListener('click', () => openLightbox(images, Number(card.dataset.index)));
  });
}

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