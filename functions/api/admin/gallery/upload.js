import { verifyJWT } from '../../_jwt.js';
import cloudinary from 'cloudinary';

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
  if (!payload) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const caption = formData.get('caption') || '';

  if (!file) {
    return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400 });
  }

  const v2 = cloudinary.v2;
  v2.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const dataURI = `data:${file.type};base64,${base64}`;

  try {
    const result = await v2.uploader.upload(dataURI, {
      folder: 'ritual_gallery',
      public_id: `${Date.now()}_${file.name.split('.')[0]}`,
    });

    const publicId = result.public_id;
    const filename = publicId + '.' + result.format;
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
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}