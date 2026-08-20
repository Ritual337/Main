import { signJWT } from '../_jwt.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { password } = await request.json();
  if (!password) {
    return new Response(JSON.stringify({ error: 'Password required' }), { status: 400 });
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  if (hashHex !== env.ADMIN_PASSWORD_HASH) {
    return new Response(JSON.stringify({ error: 'Invalid password' }), { status: 401 });
  }

  const token = await signJWT({ exp: Date.now() + 30 * 60 * 1000 }, env.JWT_SECRET);
  return new Response(JSON.stringify({ token }), {
    headers: { 'Content-Type': 'application/json' },
  });
}