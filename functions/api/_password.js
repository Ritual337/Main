export async function verifyPassword(password, storedHash) {
    if (typeof password !== 'string' || typeof storedHash !== 'string') return false;
  
    const parts = storedHash.split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  
    const iterations = parseInt(parts[1], 10);
    if (!Number.isFinite(iterations) || iterations < 1) return false;
  
    let salt, expected;
    try {
      salt = Uint8Array.from(atob(parts[2]), c => c.charCodeAt(0));
      expected = Uint8Array.from(atob(parts[3]), c => c.charCodeAt(0));
    } catch {
      return false;
    }
  
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
  
    const derived = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      keyMaterial,
      expected.length * 8
    );
  
    const derivedBytes = new Uint8Array(derived);
    if (derivedBytes.length !== expected.length) return false;
  
    let diff = 0;
    for (let i = 0; i < derivedBytes.length; i++) {
      diff |= derivedBytes[i] ^ expected[i];
    }
    return diff === 0;
  }