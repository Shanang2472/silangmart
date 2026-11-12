import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';

const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;
const SCRYPT_PREFIX = 'scrypt$';

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      KEY_LENGTH,
      {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCK_SIZE,
        p: SCRYPT_PARALLELIZATION,
        maxmem: MAX_MEMORY,
      },
      (error, key) => {
        if (error) reject(error);
        else resolve(key as Buffer);
      }
    );
  });
}

function safeEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function isScryptHash(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts = value.split('$');
  if (
    parts.length !== 6 ||
    parts[0] !== 'scrypt' ||
    Number(parts[1]) !== SCRYPT_COST ||
    Number(parts[2]) !== SCRYPT_BLOCK_SIZE ||
    Number(parts[3]) !== SCRYPT_PARALLELIZATION
  ) {
    return false;
  }

  const salt = Buffer.from(parts[4], 'base64');
  const key = Buffer.from(parts[5], 'base64');
  return salt.length === SALT_LENGTH && key.length === KEY_LENGTH;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt);
  return `${SCRYPT_PREFIX}${SCRYPT_COST}$${SCRYPT_BLOCK_SIZE}$${SCRYPT_PARALLELIZATION}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, storedValue: unknown): Promise<boolean> {
  if (typeof storedValue !== 'string' || !storedValue) return false;

  if (storedValue.startsWith(SCRYPT_PREFIX)) {
    if (!isScryptHash(storedValue)) return false;
    const parts = storedValue.split('$');
    const salt = Buffer.from(parts[4], 'base64');
    const expectedKey = Buffer.from(parts[5], 'base64');
    const actualKey = await deriveKey(password, salt);
    return safeEqual(actualKey, expectedKey);
  }

  if (/^[a-f\d]{64}$/i.test(storedValue)) {
    const legacySha256 = Buffer.from(storedValue, 'hex');
    const actualSha256 = createHash('sha256').update(password).digest();
    return safeEqual(actualSha256, legacySha256);
  }

  return safeEqual(Buffer.from(password), Buffer.from(storedValue));
}
