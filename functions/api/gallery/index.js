import { verifyJWT } from '../_jwt.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Verify token
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const token = authHeader.slice(7);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Fetch images from D1
  const { results } = await env.GALLERY_DB.prepare('SELECT * FROM gallery_images ORDER BY uploaded_at DESC').all();

  const images = results.map((row) => ({
    id: row.id,
    src: `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/${row.filename}`,
    caption: row.caption || '',
  }));

  return new Response(JSON.stringify({ images }), {
    headers: { 'Content-Type': 'application/json' },
  });
}