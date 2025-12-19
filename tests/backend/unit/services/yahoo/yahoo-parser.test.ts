import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parsePlayer,
} from '../../../../../server/services/parsers/player-parser';
import type { Player } from '@shared/domain';

// Note: parseLeaguesResponse was removed - league parsing is now done in league-service.ts
// parsePlayerStatus is now a private function in player-parser.ts

describe('yahoo-parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Note: parsePlayerStatus is now a private function in player-parser.ts
  // Status parsing is tested through parsePlayer tests below

  describe('parsePlayer', () => {
    it('should parse valid player data', () => {
      // ARRANGE
      const playerArray = [
        [
          { player_key: '466.p.123' },
          { name: { full: 'LeBron James' } },
          { display_position: 'SF' },
          { editorial_team_abbr: 'LAL' },
          { status: '' },
        ],
      ];

      // ACT
      const player = parsePlayer(playerArray);

      // ASSERT
      expect(player).toEqual({
        playerKey: '466.p.123',
        name: 'LeBron James',
        position: 'SF',
        nbaTeam: 'LAL',
        status: 'active',
      });
    });

    it('should use eligible_positions if display_position missing', () => {
      // ARRANGE
      const playerArray = [
        [
          { player_key: '466.p.123' },
          { name: { full: 'Player Name' } },
          { eligible_positions: [{ position: 'PG' }] },
          { editorial_team_abbr: 'GSW' },
          { status: '' },
        ],
      ];

      // ACT
      const player = parsePlayer(playerArray);

      // ASSERT
      expect(player?.position).toBe('PG');
    });

    it('should handle injured player', () => {
      // ARRANGE
      const playerArray = [
        [
          { player_key: '466.p.123' },
          { name: { full: 'Player Name' } },
          { display_position: 'SG' },
          { editorial_team_abbr: 'MIA' },
          { status: 'IL' },
        ],
      ];

      // ACT
      const player = parsePlayer(playerArray);

      // ASSERT
      expect(player?.status).toBe('injured');
    });

    it('should return null for invalid player data', () => {
      // ARRANGE & ACT & ASSERT
      expect(parsePlayer(null)).toBeNull();
      expect(parsePlayer(undefined)).toBeNull();
      expect(parsePlayer([])).toBeNull();
      expect(parsePlayer([{}])).toBeNull();
    });

    it('should use defaults for missing fields', () => {
      // ARRANGE
      const playerArray = [
        [
          { player_key: '466.p.123' },
          // Missing name, position, team, status
        ],
      ];

      // ACT
      const player = parsePlayer(playerArray);

      // ASSERT
      // parsePlayer uses defaults for missing fields when player_key exists
      expect(player).not.toBeNull();
      expect(player?.playerKey).toBe('466.p.123');
      expect(player?.name).toBe('Unknown Player');
      expect(player?.position).toBe('N/A');
      expect(player?.nbaTeam).toBe('N/A');
      expect(player?.status).toBe('active');
    });
  });
});

