import { verifyJWT } from '../../_jwt.js';

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

async function sha1Hex(input) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const token = authHeader.slice(7);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload || payload.role !== 'gallery') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Early reject on Content-Length if it already says the body is huge.
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_FILE_SIZE * 1.5) {
    return new Response(JSON.stringify({ error: 'Request too large (max 8 MB)' }), { status: 413 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const caption = (formData.get('caption') || '').toString().slice(0, 300);

  if (!file || typeof file === 'string') {
    return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return new Response(JSON.stringify({ error: 'File too large (max 8 MB)' }), { status: 413 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return new Response(JSON.stringify({ error: 'Unsupported file type' }), { status: 415 });
  }

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const dataURI = `data:${file.type};base64,${base64}`;

  // Sign the upload request with our Cloudinary secret.
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await sha1Hex(`timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`;

  const cloudinaryForm = new FormData();
  cloudinaryForm.append('file', dataURI);
  cloudinaryForm.append('timestamp', String(timestamp));
  cloudinaryForm.append('api_key', env.CLOUDINARY_API_KEY);
  cloudinaryForm.append('signature', signature);

  try {
    const cloudinaryRes = await fetch(uploadUrl, {
      method: 'POST',
      body: cloudinaryForm,
    });

    const result = await cloudinaryRes.json();

    if (!cloudinaryRes.ok) {
      throw new Error(result.error?.message || 'Cloudinary upload failed');
    }

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