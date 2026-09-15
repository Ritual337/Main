export async function checkRateLimit(db, key, maxAttempts, windowMs) {
    const now = Date.now();
  
    const row = await db
      .prepare('SELECT count, reset_at FROM rate_limits WHERE key = ?')
      .bind(key)
      .first();
  
    if (!row || now >= row.reset_at) {
      const resetAt = now + windowMs;
      await db
        .prepare('INSERT OR REPLACE INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)')
        .bind(key, resetAt)
        .run();
      cleanupOldRows(db);
      return { allowed: true, resetAt };
    }
  
    if (row.count >= maxAttempts) {
      return { allowed: false, resetAt: row.reset_at };
    }
  
    await db
      .prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?')
      .bind(key)
      .run();
    return { allowed: true, resetAt: row.reset_at };
  }
  
  export async function clearRateLimit(db, key) {
    await db.prepare('DELETE FROM rate_limits WHERE key = ?').bind(key).run();
  }
  
  function cleanupOldRows(db) {
    if (Math.random() > 0.05) return;
    db.prepare('DELETE FROM rate_limits WHERE reset_at < ?').bind(Date.now()).run().catch(() => {});
  }