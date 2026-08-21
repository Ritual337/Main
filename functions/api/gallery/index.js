export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Public endpoint – no authentication required

  // Fetch images from D1
  const { results } = await env.GALLERY_DB.prepare('SELECT * FROM gallery_images ORDER BY uploaded_at DESC').all();

  const images = results.map((row) => ({
    id: row.id,
    src: `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/${row.filename}`,
    caption: row.caption || '',
    uploaded_at: row.uploaded_at,   // ← add this line
  }));

  return new Response(JSON.stringify({ images }), {
    headers: { 'Content-Type': 'application/json' },
  });
}