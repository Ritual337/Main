import { signJWT } from '../_jwt.js';
import { verifyPassword } from '../_password.js';
import { checkRateLimit, clearRateLimit } from '../_ratelimit.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const key = `login:admin:${ip}`;

  const rl = await checkRateLimit(env.DB, key, 5, 60 * 1000);
  if (!rl.allowed) {
    const secsLeft = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    return new Response(
      JSON.stringify({ error: `Too many attempts. Try again in ${secsLeft}s.` }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(secsLeft) } }
    );
  }

  let password;
  try {
    ({ password } = await request.json());
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  if (!password) {
    return new Response(JSON.stringify({ error: 'Password required' }), { status: 400 });
  }

  const ok = await verifyPassword(password, env.ADMIN_PASSWORD_HASH);
  if (!ok) {
    return new Response(JSON.stringify({ error: 'Invalid password' }), { status: 401 });
  }

  await clearRateLimit(env.DB, key);

  const token = await signJWT(
    { role: 'admin', exp: Date.now() + 30 * 60 * 1000 },
    env.JWT_SECRET
  );
  return new Response(JSON.stringify({ token }), {
    headers: { 'Content-Type': 'application/json' },
  });
}