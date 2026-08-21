import { verifyJWT } from './_jwt.js';

export async function onRequest(context) {
  const { request, env } = context;

  // GET – list all entries
  if (request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM entries ORDER BY createdAt DESC').all();
    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // POST – add a new entry
  if (request.method === 'POST') {
    const body = await request.json();
    const name = (body.name || '').trim().slice(0, 30) || 'someone';
    const message = (body.message || '').trim().slice(0, 240);
    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400 });
    }
    const id = 'g_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    const createdAt = Date.now();
    await env.DB.prepare('INSERT INTO entries (id, name, message, createdAt) VALUES (?, ?, ?, ?)')
      .bind(id, name, message, createdAt)
      .run();
    return new Response(JSON.stringify({ id, name, message, createdAt }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // DELETE – clear all entries (admin only)
  if (request.method === 'DELETE') {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response('Unauthorized', { status: 401 });
    }
    const token = authHeader.slice(7);
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (!payload) {
      return new Response('Unauthorized', { status: 401 });
    }
    await env.DB.prepare('DELETE FROM entries').run();
    return new Response(null, { status: 204 });
  }

  return new Response('Method not allowed', { status: 405 });
}
