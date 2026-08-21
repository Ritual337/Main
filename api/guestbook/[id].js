import { verifyJWT } from '../_jwt.js';

export async function onRequest(context) {
  const { request, env, params } = context;

  if (request.method !== 'DELETE') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }
  const token = authHeader.slice(7);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) {
    return new Response('Unauthorized', { status: 401 });
  }

  const id = params.id;
  await env.DB.prepare('DELETE FROM entries WHERE id = ?').bind(id).run();
  return new Response(null, { status: 204 });
}