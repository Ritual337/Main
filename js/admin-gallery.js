document.addEventListener('DOMContentLoaded', async () => {
  if (!GALLERY_AUTH.requireAuth()) return;

  const CLOUD_NAME = 'mjuaz754';
  const grid = document.getElementById('image-grid');
  const fileInput = document.getElementById('file-input');
  const captionInput = document.getElementById('caption-input');
  const uploadBtn = document.getElementById('upload-btn');
  const status = document.getElementById('upload-status');

  async function loadImages() {
    const res = await GALLERY_AUTH.authFetch('/admin/gallery/images');
    const data = await res.json();
    grid.innerHTML = data.images.map(img => `
      <div class="image-item" data-id="${img.id}">
        <img src="https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${img.filename}" alt="${img.caption}" />
        <div class="caption">${img.caption}</div>
        <button class="delete-btn" data-id="${img.id}">Delete</button>
      </div>
    `).join('');

    grid.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this image?')) return;
        const id = btn.dataset.id;
        try {
          await GALLERY_AUTH.authFetch(`/admin/gallery/delete/${id}`, { method: 'DELETE' });
          loadImages();
        } catch (err) {
          alert('Delete failed: ' + err.message);
        }
      });
    });
  }

  uploadBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) { status.textContent = 'Select a file first.'; return; }
    status.textContent = 'Uploading...';
    const formData = new FormData();
    formData.append('file', file);
    formData.append('caption', captionInput.value || '');

    try {
      const res = await GALLERY_AUTH.authFetch('/admin/gallery/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }
      status.textContent = 'Upload successful!';
      fileInput.value = '';
      captionInput.value = '';
      loadImages();
    } catch (err) {
      status.textContent = 'Error: ' + err.message;
    }
  });

  // ---- Layout Settings ----
  const layoutSelect = document.getElementById('layout-select');
  const saveLayoutBtn = document.getElementById('save-layout-btn');
  const layoutStatus = document.getElementById('layout-status');

  // Load saved setting
  const savedLayout = localStorage.getItem('ritual_gallery_layout') || 'grid';
  layoutSelect.value = savedLayout;

  saveLayoutBtn.addEventListener('click', () => {
    const value = layoutSelect.value;
    localStorage.setItem('ritual_gallery_layout', value);
    layoutStatus.textContent = '✓ Saved!';
    setTimeout(() => { layoutStatus.textContent = ''; }, 2000);
  });

  loadImages();
});