import { signJWT } from '../_jwt.js';
import { verifyPassword } from '../_password.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { password } = await request.json();
  if (!password) {
    return new Response(JSON.stringify({ error: 'Password required' }), { status: 400 });
  }

  const ok = await verifyPassword(password, env.GALLERY_PASSWORD_HASH);
  if (!ok) {
    return new Response(JSON.stringify({ error: 'Invalid password' }), { status: 401 });
  }

  const token = await signJWT(
    { role: 'gallery', exp: Date.now() + 60 * 60 * 1000 },
    env.JWT_SECRET
  );
  return new Response(JSON.stringify({ token }), {
    headers: { 'Content-Type': 'application/json' },
  });
}