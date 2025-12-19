/**
 * Yahoo Fantasy Basketball Stat IDs
 * These are the numeric identifiers Yahoo uses for different statistics
 */

// Standard 9-category stats
export const YAHOO_STAT_IDS = {
  // Percentage stats (computed from makes/attempts)
  FG_PCT: '5',      // Field Goal Percentage
  FT_PCT: '8',      // Free Throw Percentage
  
  // Counting stats
  TPM: '10',        // Three Pointers Made
  PTS: '12',        // Points
  REB: '15',        // Rebounds
  AST: '16',        // Assists
  STL: '17',        // Steals
  BLK: '18',        // Blocks
  TO: '19',         // Turnovers
  
  // Makes/Attempts (for percentage calculations)
  FG_MAKES_ATTEMPTS: '9004003',  // Format: "127/298"
  FT_MAKES_ATTEMPTS: '9007006',   // Format: "76/94"
} as const;

export type YahooStatId = typeof YAHOO_STAT_IDS[keyof typeof YAHOO_STAT_IDS];

