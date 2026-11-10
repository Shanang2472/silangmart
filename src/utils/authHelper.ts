import crypto from 'crypto';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (process.env.NODE_ENV === 'production' && (!secret || secret.length < 32)) {
    throw new Error('Production requires a JWT_SECRET that is at least 32 characters long.');
  }
  return secret || 'silang-mini-mart-secret-key-12345';
}

export function validateJwtConfiguration(): void {
  getJwtSecret();
}

export interface TokenPayload {
  username: string;
  role: 'admin' | 'customer' | 'rider' | 'supplier';
  name: string;
  exp: number;
}

export function generateToken(payload: Omit<TokenPayload, 'exp'>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days expiration
  const fullPayload = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', getJwtSecret())
    .update(`${header}.${fullPayload}`)
    .digest('base64url');
  return `${header}.${fullPayload}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', getJwtSecret())
      .update(`${header}.${payload}`)
      .digest('base64url');
    if (signature !== expectedSig) return null;

    const parsedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TokenPayload;
    if (parsedPayload.exp < Math.floor(Date.now() / 1000)) return null; // expired

    return parsedPayload;
  } catch {
    return null;
  }
}
