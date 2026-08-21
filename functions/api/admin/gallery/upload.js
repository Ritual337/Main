import { verifyJWT } from '../../_jwt.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Verify JWT token
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const token = authHeader.slice(7);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Parse form data
  const formData = await request.formData();
  const file = formData.get('file');
  const caption = formData.get('caption') || '';

  if (!file) {
    return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400 });
  }

  // Convert file to base64 data URI
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const dataURI = `data:${file.type};base64,${base64}`;

  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = 'ritual_gallery_unsigned';

  // Build Cloudinary unsigned upload URL
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  // Prepare form data for Cloudinary - ONLY file + upload_preset
  const cloudinaryForm = new FormData();
  cloudinaryForm.append('file', dataURI);
  cloudinaryForm.append('upload_preset', uploadPreset);

  try {
    const cloudinaryRes = await fetch(uploadUrl, {
      method: 'POST',
      body: cloudinaryForm,
    });

    const result = await cloudinaryRes.json();

    if (!cloudinaryRes.ok) {
      throw new Error(result.error?.message || 'Cloudinary upload failed');
    }

    // Save to D1
    const filename = result.public_id + '.' + result.format;
    const id = 'img_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const uploaded_at = Date.now();

    await env.GALLERY_DB.prepare(
      'INSERT INTO gallery_images (id, filename, caption, uploaded_at) VALUES (?, ?, ?, ?)'
    ).bind(id, filename, caption, uploaded_at).run();

    return new Response(JSON.stringify({ success: true, id, filename }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}