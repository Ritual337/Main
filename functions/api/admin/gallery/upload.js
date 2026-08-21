import { verifyJWT } from '../../_jwt.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // 1. Verify JWT token
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const token = authHeader.slice(7);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // 2. Parse form data
  const formData = await request.formData();
  const file = formData.get('file');
  const caption = formData.get('caption') || '';

  if (!file) {
    return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400 });
  }

  // 3. Convert file to base64
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const dataURI = `data:${file.type};base64,${base64}`;

  // 4. Prepare Cloudinary parameters
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;

  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${Date.now()}_${file.name.split('.')[0]}`;
  const folder = 'ritual_gallery';

  // Build parameters object (exclude api_key and signature)
  const params = {
    folder: folder,
    public_id: publicId,
    timestamp: timestamp,
  };

  // Sort keys alphabetically and build signature string
  const sortedKeys = Object.keys(params).sort();
  const signatureString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');

  // Compute HMAC-SHA256 signature using Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(apiSecret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureString));
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Build Cloudinary upload URL
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  // Prepare form data for Cloudinary
  const cloudinaryForm = new FormData();
  cloudinaryForm.append('file', dataURI);
  cloudinaryForm.append('api_key', apiKey);
  cloudinaryForm.append('timestamp', timestamp);
  cloudinaryForm.append('signature', signature);
  cloudinaryForm.append('public_id', publicId);
  cloudinaryForm.append('folder', folder);

  try {
    const cloudinaryRes = await fetch(uploadUrl, {
      method: 'POST',
      body: cloudinaryForm,
    });

    const result = await cloudinaryRes.json();

    if (!cloudinaryRes.ok) {
      throw new Error(result.error?.message || 'Cloudinary upload failed');
    }

    // 5. Save to D1
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