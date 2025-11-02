import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

if (!process.env.ENCRYPTION_KEY) {
  console.warn("WARNING: ENCRYPTION_KEY not set in environment. Using random key (data will not persist across restarts)");
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  try {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    
    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
