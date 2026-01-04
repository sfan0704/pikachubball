import crypto from "crypto";
import { env } from "../config/env";

// ENCRYPTION_KEY is validated on startup via env.ts
const ENCRYPTION_KEY = env.ENCRYPTION_KEY;

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encryptedHex = cipher.update(text, 'utf8', 'hex');
  encryptedHex += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encryptedHex}`;
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
    
    let decryptedText = decipher.update(encrypted, 'hex', 'utf8');
    decryptedText += decipher.final('utf8');
    
    return decryptedText;
  } catch (error) {
    // Use console.error directly to avoid circular dependency
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Generate a new encryption key for use with the encryption functions
 * 
 * This utility function generates a 64-character hex string (32 bytes) that can be used
 * as an encryption key. Useful for:
 * - Setting up new installations
 * - Generating keys for migrations
 * - Testing encryption functionality
 * 
 * @returns A 64-character hexadecimal string suitable for use as an encryption key
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

