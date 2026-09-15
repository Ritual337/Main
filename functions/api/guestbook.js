import { verifyJWT } from './_jwt.js';
import { checkRateLimit } from './_ratelimit.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM entries ORDER BY createdAt DESC').all();
    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (request.method === 'POST') {
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const key = `gb:post:${ip}`;

    const rl = await checkRateLimit(env.DB, key, 3, 60 * 1000);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: 'Slow down — one message every 20 seconds.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
    }

    const rawName = typeof body.name === 'string' ? body.name : '';
    const rawMessage = typeof body.message === 'string' ? body.message : '';

    const name = rawName.trim().slice(0, 30) || 'someone';
    const message = rawMessage.trim().slice(0, 240);

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

  if (request.method === 'DELETE') {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response('Unauthorized', { status: 401 });
    }
    const token = authHeader.slice(7);
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (!payload || payload.role !== 'admin') {
      return new Response('Unauthorized', { status: 401 });
    }
    await env.DB.prepare('DELETE FROM entries').run();
    return new Response(null, { status: 204 });
  }

  return new Response('Method not allowed', { status: 405 });
}