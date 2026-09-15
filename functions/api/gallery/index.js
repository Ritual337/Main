export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Public endpoint – no authentication required.

  const { results } = await env.GALLERY_DB
    .prepare('SELECT * FROM gallery_images ORDER BY uploaded_at DESC LIMIT 200')
    .all();

  const base = `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload`;

  // Two variants per image:
  //   src  — grid thumbnail   (≤800px wide,  auto quality, auto format)
  //   full — lightbox view    (≤1800px wide, auto quality, auto format)
  const images = results.map((row) => ({
    id: row.id,
    src:  `${base}/w_800,q_auto,f_auto/${row.filename}`,
    full: `${base}/w_1800,q_auto,f_auto/${row.filename}`,
    caption: row.caption || '',
    uploaded_at: row.uploaded_at,
  }));

  return new Response(JSON.stringify({ images }), {
    headers: { 'Content-Type': 'application/json' },
  });
}