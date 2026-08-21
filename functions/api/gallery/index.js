import { verifyJWT } from '../_jwt.js';
import cloudinary from 'cloudinary';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'GET') {
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

  const { results } = await env.GALLERY_DB.prepare('SELECT * FROM gallery_images ORDER BY uploaded_at DESC').all();

  const v2 = cloudinary.v2;
  v2.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });

  const images = results.map((row) => {
    const publicId = row.filename.split('.').slice(0, -1).join('.');
    const timestamp = Math.floor(Date.now() / 1000) + 3600;
    const url = v2.utils.url(publicId, {
      sign_url: true,
      expires_at: timestamp,
      secure: true,
    });
    return {
      id: row.id,
      src: url,
      caption: row.caption || '',
    };
  });

  return new Response(JSON.stringify({ images }), {
    headers: { 'Content-Type': 'application/json' },
  });
}