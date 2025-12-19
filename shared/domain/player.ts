/**
 * Player Domain Model
 * Minimal player information for now
 */

export type PlayerStatus = 'active' | 'injured' | 'out';

/**
 * Player domain model
 */
export interface Player {
  playerKey: string;      // e.g., "466.p.12345"
  name: string;           // e.g., "LeBron James"
  position: string;       // e.g., "SF,PF" (comma-separated)
  nbaTeam: string;        // e.g., "LAL"
  status: PlayerStatus;   // 'active', 'injured', or 'out'
}

