import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Use the existing ENCRYPTION_KEY or fallback to GEMINI_API_KEY as a pseudo-secret for dev
function getSecretKey(): string {
  const secret = process.env.ENCRYPTION_KEY || process.env.GEMINI_API_KEY || 'default-insecure-secret-key-32b!';
  if (secret.length < 32) {
    return secret.padEnd(32, '0');
  }
  return secret.slice(0, 32);
}

export function encryptString(text: string): string {
  if (!text) return text;
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  const key = crypto.pbkdf2Sync(getSecretKey(), salt, 100000, KEY_LENGTH, 'sha256');
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // enc:version:salt:iv:tag:ciphertext
  return `enc:v1:${salt.toString('base64')}:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptString(encryptedText: string): string {
  if (!encryptedText || !encryptedText.startsWith('enc:v1:')) {
    return encryptedText; // Not encrypted or unknown format
  }

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 6) throw new Error('Invalid encryption format');

    const [,, saltB64, ivB64, tagB64, encryptedB64] = parts;
    
    const salt = Buffer.from(saltB64, 'base64');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const encrypted = Buffer.from(encryptedB64, 'base64');

    const key = crypto.pbkdf2Sync(getSecretKey(), salt, 100000, KEY_LENGTH, 'sha256');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('Decryption failed', err);
    return '0'; // Return 0 as safe fallback for numbers
  }
}

export function encryptNumber(num: number | string | null | undefined): string | null {
  if (num === null || num === undefined) return null;
  return encryptString(String(num));
}

export function decryptNumber(encryptedText: string | number | null | undefined): number {
  if (encryptedText === null || encryptedText === undefined) return 0;
  if (typeof encryptedText === 'number') return encryptedText;
  
  const decrypted = decryptString(encryptedText);
  const parsed = Number(decrypted);
  return isNaN(parsed) ? 0 : parsed;
}
