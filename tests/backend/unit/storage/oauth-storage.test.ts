import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from '../../../../server/storage';
import { db } from '../../../../server/config/db';
import { users } from '@shared/schema';
import { createMockUser, createMockOAuthUser } from '../../fixtures/test-helpers';

// Mock the database module
vi.mock('../../../../server/config/db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

describe('OAuth Storage Methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserByYahooGuid', () => {
    it('should return user if found by Yahoo GUID', async () => {
      // ARRANGE
      const mockOAuthUser = createMockOAuthUser();
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockOAuthUser]),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect);

      // ACT
      const result = await storage.getUserByYahooGuid('YAHOO_GUID_ABC123');

      // ASSERT
      expect(result).toEqual(mockOAuthUser);
      expect(db.select).toHaveBeenCalled();
    });

    it('should return undefined if no user found with Yahoo GUID', async () => {
      // ARRANGE
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect);

      // ACT
      const result = await storage.getUserByYahooGuid('NONEXISTENT_GUID');

      // ASSERT
      expect(result).toBeUndefined();
    });
  });

  describe('createOAuthUser', () => {
    it('should create a new OAuth user without password', async () => {
      // ARRANGE
      const newOAuthUser = {
        username: 'yahoo_user_xyz789',
        yahooGuid: 'YAHOO_GUID_XYZ789',
        displayName: 'New Yahoo User',
        email: 'newuser@yahoo.com',
      };
      const createdUser = createMockOAuthUser({
        ...newOAuthUser,
        id: 'new-user-id',
        password: null,
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdUser]),
        }),
      });
      vi.mocked(db.insert).mockImplementation(mockInsert);

      // ACT
      const result = await storage.createOAuthUser(newOAuthUser);

      // ASSERT
      expect(result).toEqual(createdUser);
      expect(result.password).toBeNull();
      expect(result.yahooGuid).toBe('YAHOO_GUID_XYZ789');
      expect(db.insert).toHaveBeenCalledWith(users);
    });

    it('should create OAuth user with minimal fields (only required)', async () => {
      // ARRANGE
      const minimalOAuthUser = {
        username: 'yahoo_minimal',
        yahooGuid: 'YAHOO_GUID_MINIMAL',
      };
      const createdUser = createMockOAuthUser({
        ...minimalOAuthUser,
        displayName: null,
        email: null,
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdUser]),
        }),
      });
      vi.mocked(db.insert).mockImplementation(mockInsert);

      // ACT
      const result = await storage.createOAuthUser(minimalOAuthUser);

      // ASSERT
      expect(result).toEqual(createdUser);
      expect(result.yahooGuid).toBe('YAHOO_GUID_MINIMAL');
    });
  });

  describe('existing user methods still work', () => {
    it('getUserByUsername should return user with new schema fields', async () => {
      // ARRANGE
      const mockUser = createMockUser({
        yahooGuid: null,
        displayName: null,
        email: null,
      });
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect);

      // ACT
      const result = await storage.getUserByUsername('testuser');

      // ASSERT
      expect(result).toEqual(mockUser);
      expect(result?.password).toBe('hashed-password');
      expect(result?.yahooGuid).toBeNull();
    });

    it('createUser should create user with password (admin user)', async () => {
      // ARRANGE
      const adminUser = {
        username: 'admin',
        password: 'hashed-admin-password',
      };
      const createdAdmin = createMockUser({
        ...adminUser,
        id: 'admin-id',
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdAdmin]),
        }),
      });
      vi.mocked(db.insert).mockImplementation(mockInsert);

      // ACT
      const result = await storage.createUser(adminUser);

      // ASSERT
      expect(result).toEqual(createdAdmin);
      expect(result.password).toBe('hashed-admin-password');
    });
  });
});

