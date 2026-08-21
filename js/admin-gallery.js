/**
 * Admin Gallery — Full admin with upload preview, progress, batch delete, drag-drop, metadata.
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!GALLERY_AUTH.requireAuth()) return;

  const CLOUD_NAME = 'mjuaz754';
  const grid = document.getElementById('image-grid');
  const fileInput = document.getElementById('file-input');
  const captionInput = document.getElementById('caption-input');
  const uploadBtn = document.getElementById('upload-btn');
  const status = document.getElementById('upload-status');
  const preview = document.getElementById('upload-preview');
  const progressWrap = document.getElementById('progress-wrap');
  const progressBar = document.getElementById('progress-bar');
  const uploadArea = document.getElementById('upload-area');
  const refreshBtn = document.getElementById('refresh-btn');
  const batchDeleteBtn = document.getElementById('batch-delete-btn');
  const selectionInfo = document.getElementById('selection-info');
  const meta = document.getElementById('admin-meta');
  const countEl = document.getElementById('published-count');

  let selectedIds = new Set();
  let allImages = [];

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

  // ---- Format date ----
  function formatDate(ts) {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'today';
    const days = Math.floor((now - d) / 86400000);
    if (days < 7) return days + 'd ago';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  // ---- Load images ----
  async function loadImages() {
    const res = await GALLERY_AUTH.authFetch('/admin/gallery/images');
    const data = await res.json();
    allImages = data.images || [];
    renderGrid();
    // Update metadata
    if (allImages.length > 0) {
      const last = allImages[0];
      meta.textContent = `${allImages.length} total · last ${formatDate(last.uploaded_at || Date.now())}`;
    } else {
      meta.textContent = '0 total';
    }
    countEl.textContent = allImages.length + ' images';
    selectedIds.clear();
    updateSelectionUI();
  }

  // ---- Render grid with checkboxes ----
  function renderGrid() {
    grid.innerHTML = allImages.map(img => `
      <div class="image-item" data-id="${img.id}">
        <div class="checkbox-wrap">
          <input type="checkbox" class="image-checkbox" data-id="${img.id}" />
        </div>
        <img src="https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${img.filename}" alt="${img.caption}" loading="lazy" />
        <div class="caption">${img.caption || 'Untitled'}</div>
        <div class="meta">${img.uploaded_at ? '📅 ' + formatDate(img.uploaded_at) : ''}</div>
        <button class="delete-btn" data-id="${img.id}">Delete</button>
      </div>
    `).join('');

    // Checkbox events
    grid.querySelectorAll('.image-checkbox').forEach(cb => {
      cb.checked = selectedIds.has(cb.dataset.id);
      cb.addEventListener('change', () => {
        if (cb.checked) selectedIds.add(cb.dataset.id);
        else selectedIds.delete(cb.dataset.id);
        updateSelectionUI();
      });
    });

    // Delete single
    grid.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (!confirm('Delete this image?')) return;
        try {
          await GALLERY_AUTH.authFetch(`/admin/gallery/delete/${id}`, { method: 'DELETE' });
          window.showToast('Deleted.');
          loadImages();
        } catch (err) {
          window.showToast('Delete failed: ' + err.message, { error: true });
        }
      });
    });
  }

  // ---- Batch delete ----
  function updateSelectionUI() {
    const count = selectedIds.size;
    selectionInfo.textContent = count + ' selected';
    batchDeleteBtn.disabled = count === 0;
    // Sync checkboxes
    grid.querySelectorAll('.image-checkbox').forEach(cb => {
      cb.checked = selectedIds.has(cb.dataset.id);
    });
  }

  batchDeleteBtn.addEventListener('click', async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected images?`)) return;
    const ids = [...selectedIds];
    let deleted = 0;
    for (const id of ids) {
      try {
        await GALLERY_AUTH.authFetch(`/admin/gallery/delete/${id}`, { method: 'DELETE' });
        deleted++;
      } catch (_) { /* ignore single failures */ }
    }
    window.showToast(`Deleted ${deleted} images.`);
    loadImages();
  });

  // ---- Refresh ----
  refreshBtn.addEventListener('click', () => {
    loadImages();
    window.showToast('Refreshed.');
  });

  // ---- Upload with progress ----
  uploadBtn.addEventListener('click', () => doUpload());

  function doUpload() {
    const file = fileInput.files[0];
    if (!file) { status.textContent = 'Select a file first.'; return; }

    status.textContent = 'Uploading...';
    progressWrap.classList.add('show');
    progressBar.style.width = '0%';
    uploadBtn.disabled = true;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('caption', captionInput.value || '');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/gallery/upload');
    xhr.setRequestHeader('Authorization', 'Bearer ' + GALLERY_AUTH.getToken());

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progressBar.style.width = pct + '%';
      }
    });

    xhr.onload = () => {
      progressWrap.classList.remove('show');
      uploadBtn.disabled = false;
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        status.textContent = 'Upload successful!';
        window.showToast('Uploaded!');
        fileInput.value = '';
        captionInput.value = '';
        preview.classList.remove('show');
        preview.src = '';
        loadImages();
      } else {
        let msg = 'Upload failed.';
        try { const err = JSON.parse(xhr.responseText); msg = err.error || msg; } catch (_) {}
        status.textContent = 'Error: ' + msg;
        window.showToast(msg, { error: true });
      }
    };

    xhr.onerror = () => {
      progressWrap.classList.remove('show');
      uploadBtn.disabled = false;
      status.textContent = 'Network error.';
      window.showToast('Network error.', { error: true });
    };

    xhr.send(formData);
  }

  // ---- Image preview before upload ----
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.src = e.target.result;
        preview.classList.add('show');
      };
      reader.readAsDataURL(file);
    } else {
      preview.classList.remove('show');
      preview.src = '';
    }
  });

  // ---- Drag and drop ----
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
  });
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      fileInput.files = files;
      fileInput.dispatchEvent(new Event('change'));
    }
  });

  // ---- Layout Settings ----
  const layoutSelect = document.getElementById('layout-select');
  const saveLayoutBtn = document.getElementById('save-layout-btn');
  const layoutStatus = document.getElementById('layout-status');

  const savedLayout = localStorage.getItem('ritual_gallery_layout') || 'grid';
  layoutSelect.value = savedLayout;

  saveLayoutBtn.addEventListener('click', () => {
    const value = layoutSelect.value;
    localStorage.setItem('ritual_gallery_layout', value);
    layoutStatus.textContent = '✓ Saved!';
    setTimeout(() => { layoutStatus.textContent = ''; }, 2000);
    window.showToast('Layout saved!');
  });

  // ---- Init ----
  await loadImages();
});
