import { verifyJWT } from '../../../_jwt.js';
import cloudinary from 'cloudinary';

export async function onRequest(context) {
  const { request, env, params } = context;

  if (request.method !== 'DELETE') {
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

  const id = params.id;
  const { results } = await env.GALLERY_DB.prepare('SELECT filename FROM gallery_images WHERE id = ?').bind(id).all();
  if (results.length === 0) {
    return new Response(JSON.stringify({ error: 'Image not found' }), { status: 404 });
  }

  const filename = results[0].filename;
  const publicId = filename.split('.').slice(0, -1).join('.');

  const v2 = cloudinary.v2;
  v2.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });

  try {
    await v2.uploader.destroy(publicId);
  } catch (err) {
    console.error('Cloudinary delete error:', err.message);
  }

  await env.GALLERY_DB.prepare('DELETE FROM gallery_images WHERE id = ?').bind(id).run();
  return new Response(null, { status: 204 });
}