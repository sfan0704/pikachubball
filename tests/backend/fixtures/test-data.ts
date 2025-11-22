import type { TeamRanking, CategoryStats } from '../../../shared/schema';

/**
 * Test data factories for creating test fixtures
 */

export function createTestTeamRanking(overrides?: Partial<TeamRanking>): TeamRanking {
  const defaultStats: CategoryStats = {
    fgPct: 0.475,
    ftPct: 0.825,
    tpm: 95,
    pts: 1020,
    reb: 425,
    ast: 280,
    stl: 85,
    blk: 65,
    to: 120,
  };

  const defaultRanks: CategoryStats = {
    fgPct: 1,
    ftPct: 1,
    tpm: 1,
    pts: 1,
    reb: 1,
    ast: 1,
    stl: 1,
    blk: 1,
    to: 1,
  };

  const baseRanking: TeamRanking = {
    teamKey: '466.l.12345.t.1',
    teamName: 'Test Team',
    managerName: 'Test Manager',
    stats: defaultStats,
    categoryRanks: defaultRanks,
    totalRank: 1.0,
    ...overrides,
  };

  // Add optional fields that exist in implementation but not in schema
  return {
    ...baseRanking,
    fgMakes: 380,
    fgAttempts: 800,
    ftMakes: 165,
    ftAttempts: 200,
  } as TeamRanking & {
    fgMakes?: number;
    fgAttempts?: number;
    ftMakes?: number;
    ftAttempts?: number;
  };
}

export function createTestUser(overrides?: {
  id?: number;
  username?: string;
  hasYahooToken?: boolean;
  hasOpenAiKey?: boolean;
}) {
  return {
    id: overrides?.id || 1,
    username: overrides?.username || 'testuser',
    passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
    hasYahooToken: overrides?.hasYahooToken ?? true,
    hasOpenAiKey: overrides?.hasOpenAiKey ?? true,
  };
}

export function createTestYahooToken(overrides?: {
  userId?: number;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}) {
  return {
    userId: overrides?.userId || 1,
    accessToken: overrides?.accessToken || 'test-access-token',
    refreshToken: overrides?.refreshToken || 'test-refresh-token',
    expiresAt: overrides?.expiresAt || Date.now() + 3600000, // 1 hour from now
  };
}

export const testLeagueKey = '466.l.12345';
export const testTeamKey = '466.l.12345.t.1';
export const testUserGuid = 'test-user-guid';
