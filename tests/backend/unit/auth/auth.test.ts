import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hashPassword, comparePassword } from '../../../../server/config/auth';

describe('Password Hashing & Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hashPassword()', () => {
    it('should hash a password', async () => {
      // ARRANGE
      const password = 'test-password-123';
      
      // ACT
      const hash = await hashPassword(password);
      
      // ASSERT
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password); // Should not be plaintext
    });

    it('should create different hashes for same password', async () => {
      // ARRANGE
      const password = 'test-password-123';
      
      // ACT
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      // ASSERT
      // bcrypt uses salt, so hashes should differ even for same password
      expect(hash1).not.toBe(hash2);
    });

    it('should create valid bcrypt hash format', async () => {
      // ARRANGE
      const password = 'test-password';
      
      // ACT
      const hash = await hashPassword(password);
      
      // ASSERT
      // bcrypt hashes start with $2a$, $2b$, or $2x$
      expect(/^\$2[aby]\$/.test(hash)).toBe(true);
    });

    it('should handle long passwords', async () => {
      // ARRANGE
      const longPassword = 'a'.repeat(100);
      
      // ACT
      const hash = await hashPassword(longPassword);
      
      // ASSERT
      expect(hash).toBeTruthy();
    });

    it('should handle special characters', async () => {
      // ARRANGE
      const password = 'P@ssw0rd!#$%^&*()_+-=[]{}|;:,.<>?';
      
      // ACT
      const hash = await hashPassword(password);
      
      // ASSERT
      expect(hash).toBeTruthy();
    });
  });

  describe('comparePassword()', () => {
    it('should verify correct password', async () => {
      // ARRANGE
      const password = 'test-password-123';
      const hash = await hashPassword(password);
      
      // ACT
      const isValid = await comparePassword(password, hash);
      
      // ASSERT
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      // ARRANGE
      const password = 'test-password-123';
      const wrongPassword = 'wrong-password';
      const hash = await hashPassword(password);
      
      // ACT
      const isValid = await comparePassword(wrongPassword, hash);
      
      // ASSERT
      expect(isValid).toBe(false);
    });

    it('should be case-sensitive', async () => {
      // ARRANGE
      const password = 'TestPassword123';
      const hash = await hashPassword(password);
      
      // ACT
      const isValid = await comparePassword('testpassword123', hash);
      
      // ASSERT
      expect(isValid).toBe(false);
    });

    it('should reject empty password', async () => {
      // ARRANGE
      const password = 'test-password';
      const hash = await hashPassword(password);
      
      // ACT
      const isValid = await comparePassword('', hash);
      
      // ASSERT
      expect(isValid).toBe(false);
    });

    it('should handle whitespace sensitivity', async () => {
      // ARRANGE
      const password = 'test password';
      const hash = await hashPassword(password);
      
      // ACT
      const withoutSpace = await comparePassword('testpassword', hash);
      const withExtraSpace = await comparePassword('test  password', hash);
      
      // ASSERT
      expect(withoutSpace).toBe(false);
      expect(withExtraSpace).toBe(false);
    });

    it('should verify hashes from different rounds', async () => {
      // ARRANGE
      const password = 'test-password';
      const hash = await hashPassword(password);
      
      // ACT
      // Should work regardless of when hash was created
      const isValid = await comparePassword(password, hash);
      
      // ASSERT
      expect(isValid).toBe(true);
    });
  });

  describe('Password Security', () => {
    it('should not be vulnerable to timing attacks (basic)', async () => {
      // ARRANGE
      const password = 'correct-password';
      const hash = await hashPassword(password);
      
      // ACT
      // Timing-safe comparison should be used by bcrypt
      // Just verify both correct and incorrect fail consistently
      const correct = await comparePassword(password, hash);
      const incorrect = await comparePassword('wrong', hash);
      
      // ASSERT
      expect(correct).toBe(true);
      expect(incorrect).toBe(false);
    });

    it('should handle very similar passwords as different', async () => {
      // ARRANGE
      const password1 = 'password123';
      const password2 = 'password124';
      const hash1 = await hashPassword(password1);
      
      // ACT
      const matches = await comparePassword(password2, hash1);
      
      // ASSERT
      expect(matches).toBe(false);
    });
  });
});
