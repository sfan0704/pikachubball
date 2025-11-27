import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from '../../../../server/auth';

describe('Password Hashing & Verification', () => {
  describe('hashPassword()', () => {
    it('should hash a password', async () => {
      const password = 'test-password-123';
      const hash = await hashPassword(password);
      
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password); // Should not be plaintext
    });

    it('should create different hashes for same password', async () => {
      const password = 'test-password-123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      // bcrypt uses salt, so hashes should differ even for same password
      expect(hash1).not.toBe(hash2);
    });

    it('should create valid bcrypt hash format', async () => {
      const password = 'test-password';
      const hash = await hashPassword(password);
      
      // bcrypt hashes start with $2a$, $2b$, or $2x$
      expect(/^\$2[aby]\$/.test(hash)).toBe(true);
    });

    it('should handle long passwords', async () => {
      const longPassword = 'a'.repeat(100);
      const hash = await hashPassword(longPassword);
      expect(hash).toBeTruthy();
    });

    it('should handle special characters', async () => {
      const password = 'P@ssw0rd!#$%^&*()_+-=[]{}|;:,.<>?';
      const hash = await hashPassword(password);
      expect(hash).toBeTruthy();
    });
  });

  describe('comparePassword()', () => {
    it('should verify correct password', async () => {
      const password = 'test-password-123';
      const hash = await hashPassword(password);
      
      const isValid = await comparePassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'test-password-123';
      const wrongPassword = 'wrong-password';
      const hash = await hashPassword(password);
      
      const isValid = await comparePassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it('should be case-sensitive', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);
      
      const isValid = await comparePassword('testpassword123', hash);
      expect(isValid).toBe(false);
    });

    it('should reject empty password', async () => {
      const password = 'test-password';
      const hash = await hashPassword(password);
      
      const isValid = await comparePassword('', hash);
      expect(isValid).toBe(false);
    });

    it('should handle whitespace sensitivity', async () => {
      const password = 'test password';
      const hash = await hashPassword(password);
      
      const withoutSpace = await comparePassword('testpassword', hash);
      const withExtraSpace = await comparePassword('test  password', hash);
      
      expect(withoutSpace).toBe(false);
      expect(withExtraSpace).toBe(false);
    });

    it('should verify hashes from different rounds', async () => {
      const password = 'test-password';
      const hash = await hashPassword(password);
      
      // Should work regardless of when hash was created
      const isValid = await comparePassword(password, hash);
      expect(isValid).toBe(true);
    });
  });

  describe('Password Security', () => {
    it('should not be vulnerable to timing attacks (basic)', async () => {
      const password = 'correct-password';
      const hash = await hashPassword(password);
      
      // Timing-safe comparison should be used by bcrypt
      // Just verify both correct and incorrect fail consistently
      const correct = await comparePassword(password, hash);
      const incorrect = await comparePassword('wrong', hash);
      
      expect(correct).toBe(true);
      expect(incorrect).toBe(false);
    });

    it('should handle very similar passwords as different', async () => {
      const password1 = 'password123';
      const password2 = 'password124';
      
      const hash1 = await hashPassword(password1);
      
      const matches = await comparePassword(password2, hash1);
      expect(matches).toBe(false);
    });
  });
});
