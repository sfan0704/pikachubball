/**
 * Yahoo API Documentation Script
 * 
 * This script comprehensively tests Yahoo Fantasy Sports APIs using your latest NBA league
 * and documents their exact structure. The raw responses are saved to JSON files, and a 
 * markdown documentation file is generated to help drive parsing logic.
 * 
 * **What This Script Tests:**
 * 
 * **League Data:**
 * - League settings, metadata, draft results
 * - Standings with rankings
 * - Scoreboards (current week, week 1, multiple weeks)
 * - Transactions
 * 
 * **Team Data:**
 * - All teams in the league
 * - Team rosters (current and weekly)
 * - Team stats (season and weekly)
 * - Team matchups (shows games played per week)
 * 
 * **Player Data:**
 * - All players from all teams
 * - Player info (status, position, team)
 * - Player stats (season, current week, week 1, last week, last month)
 * - Free agents
 * - League-wide player list with stats
 * 
 * **Rankings & Stats:**
 * - Standings with detailed stats
 * - Team rankings
 * - Player rankings
 * - Games played per week (from matchups and scoreboards)
 * 
 * Usage:
 *   npm run document:yahoo-api
 *   or
 *   DOTENV_CONFIG_PATH=.env.local node -r dotenv/config node_modules/.bin/tsx scripts/document-yahoo-api.ts
 */

// Load environment variables
import { config } from "dotenv";
import { resolve } from "path";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { storage } from "../server/storage";
import { getYahooApiClient } from "../server/services/yahoo/yahoo-api-client";
import { logger } from "../server/utils/logger";

/**
 * Wrapper to add timeout to API calls
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms: ${operation}`)), timeoutMs)
    ),
  ]);
}

const OUTPUT_DIR = join(process.cwd(), "scripts", "yahoo-api-responses");
const DOC_FILE = join(OUTPUT_DIR, "API_DOCUMENTATION.md");

interface ApiCall {
  name: string;
  description: string;
  call: () => Promise<any>;
  filename: string;
}

/**
 * Ensure output directory exists
 */
function ensureOutputDir() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
  }
}

/**
 * Save API response to JSON file
 */
function saveResponse(filename: string, data: any) {
  const filepath = join(OUTPUT_DIR, filename);
  writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`  ✅ Saved: ${filename}`);
}

/**
 * Generate markdown documentation from collected responses
 */
function generateDocumentation(responses: Array<{ name: string; filename: string; data: any; description: string }>) {
  let doc = `# Yahoo Fantasy Sports API Documentation

This document describes the exact structure of Yahoo Fantasy Sports API responses.
This documentation is generated from actual API calls and should be used to drive parsing logic.

**Generated:** ${new Date().toISOString()}

---

`;

  for (const { name, filename, data, description } of responses) {
    doc += `## ${name}\n\n`;
    doc += `${description}\n\n`;
    doc += `**Response File:** \`${filename}\`\n\n`;
    
    // Add structure analysis
    doc += `### Structure Analysis\n\n`;
    doc += `\`\`\`json\n`;
    doc += JSON.stringify(analyzeStructure(data), null, 2);
    doc += `\n\`\`\`\n\n`;
    
    // Add key observations
    const observations = extractObservations(data, name);
    if (observations.length > 0) {
      doc += `### Key Observations\n\n`;
      observations.forEach(obs => {
        doc += `- ${obs}\n`;
      });
      doc += `\n`;
    }
    
    doc += `---\n\n`;
  }

  // Add general notes
  doc += `## General Notes\n\n`;
  doc += `### Common Patterns\n\n`;
  doc += `1. **Array Structure**: Yahoo API often uses arrays where:\n`;
  doc += `   - \`[0]\` contains properties (array of objects)\n`;
  doc += `   - \`[1]\` contains subresources (object with nested data)\n\n`;
  doc += `2. **Numeric String Keys**: Collections often use numeric string keys like \`"0"\`, \`"1"\` instead of arrays\n\n`;
  doc += `3. **Count Properties**: Collections include a \`count\` property alongside indexed entries\n\n`;
  doc += `4. **Nested Structures**: Data is deeply nested with \`fantasy_content\` as the root wrapper\n\n`;

  writeFileSync(DOC_FILE, doc, "utf-8");
  console.log(`\n📝 Generated documentation: ${DOC_FILE}`);
}

/**
 * Analyze the structure of a response (simplified version)
 */
function analyzeStructure(data: any, depth = 0, maxDepth = 4, visited = new WeakSet()): any {
  if (depth > maxDepth) {
    return "[...]";
  }

  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return [];
    }
    // Analyze first few items
    const samples = data.slice(0, 3).map(item => analyzeStructure(item, depth + 1, maxDepth, visited));
    if (data.length > 3) {
      samples.push(`... (${data.length - 3} more items)`);
    }
    return samples;
  }

  if (typeof data === "object") {
    // Handle circular references
    if (visited.has(data)) {
      return "[circular reference]";
    }
    visited.add(data);

    const result: any = {};
    const keys = Object.keys(data);
    
    // Limit number of keys shown
    const keysToShow = keys.slice(0, 10);
    for (const key of keysToShow) {
      result[key] = analyzeStructure(data[key], depth + 1, maxDepth, visited);
    }
    if (keys.length > 10) {
      result["..."] = `${keys.length - 10} more keys`;
    }
    return result;
  }

  // For primitives, show the type and a sample value
  if (typeof data === "string" && data.length > 100) {
    return `string(${data.length} chars): "${data.substring(0, 50)}..."`;
  }
  
  return typeof data === "string" ? `"${data}"` : data;
}

/**
 * Extract key observations about the API response structure
 */
function extractObservations(data: any, apiName: string): string[] {
  const observations: string[] = [];

  // Check for array structure pattern
  if (data && typeof data === "object") {
    const fantasyContent = data.fantasy_content;
    if (fantasyContent) {
      observations.push("Response wrapped in `fantasy_content` root object");
      
      // Check for array pattern [0] = properties, [1] = subresources
      const firstKey = Object.keys(fantasyContent)[0];
      const firstValue = fantasyContent[firstKey];
      if (Array.isArray(firstValue) && firstValue.length >= 2) {
        observations.push(`Uses array structure: ${firstKey}[0] = properties, ${firstKey}[1] = subresources`);
      }
      
      // Check for numeric string keys
      if (firstValue && typeof firstValue === "object" && !Array.isArray(firstValue)) {
        const hasNumericKeys = Object.keys(firstValue).some(key => 
          key !== "count" && !isNaN(Number(key))
        );
        if (hasNumericKeys) {
          observations.push("Uses numeric string keys (e.g., \"0\", \"1\") instead of arrays for collections");
        }
      }
    }
    
    // Check for count properties
    if (data.count !== undefined) {
      observations.push("Includes `count` property for collections");
    }
  }

  return observations;
}

/**
 * Main execution
 */
async function main() {
  console.log("🔍 Yahoo Fantasy Sports API Documentation Generator\n");
  console.log("This script will call various Yahoo APIs and document their responses.\n");

  // Get test user
  const username = process.env.TEST_USERNAME || "testuser";
  const user = await storage.getUserByUsername(username);
  
  if (!user) {
    console.error(`❌ User "${username}" not found.`);
    console.error("   Please create a test user or set TEST_USERNAME environment variable.");
    process.exit(1);
  }

  console.log(`✅ Found user: ${username} (ID: ${user.id})\n`);

  // Check if user has Yahoo token
  const token = await storage.getYahooToken(user.id);
  if (!token) {
    console.error("❌ User doesn't have a Yahoo token.");
    console.error("   Please login and connect your Yahoo account first.");
    process.exit(1);
  }

  console.log("✅ User has Yahoo token");
  console.log(`   Token expires at: ${new Date(token.expiresAt * 1000).toISOString()}\n`);

  // Ensure output directory exists
  ensureOutputDir();

  // Initialize API client
  console.log("🔄 Initializing Yahoo API client...\n");
  const client = await getYahooApiClient(user.id);
  console.log("✅ API client initialized\n");

  // Define API calls to make (using raw API responses)
  const apiCalls: ApiCall[] = [
    {
      name: "getUserGames (Raw)",
      description: "Get raw response for /users;use_login=1/games",
      call: () => withTimeout(
        client.getRawApiResponse("/users;use_login=1/games"),
        30000,
        "getUserGames"
      ),
      filename: "01-get-user-games-raw.json",
    },
    {
      name: "getAllUserLeagues (Raw)",
      description: "Get raw response for /users;use_login=1/games/leagues",
      call: () => withTimeout(
        client.getRawApiResponse("/users;use_login=1/games/leagues"),
        30000,
        "getAllUserLeagues"
      ),
      filename: "02-get-all-user-leagues-raw.json",
    },
  ];

  // Parse league information from raw responses
  const leagueKeys: Array<{ leagueKey: string; name: string; gameCode: string; season: string }> = [];
  
  try {
    console.log("📋 Parsing league information from raw responses...\n");
    
    // Get the raw leagues response (we'll use the one we already fetched)
    console.log(`  📡 Fetching raw leagues response...`);
    const rawLeaguesResponse = await withTimeout(
      client.getRawApiResponse("/users;use_login=1/games/leagues"),
      30000, // 30 second timeout
      "getAllUserLeagues"
    );
    
    // Parse the raw response structure
    const fantasyContent = rawLeaguesResponse?.fantasy_content;
    if (fantasyContent?.users) {
      const users = fantasyContent.users;
      // Handle numeric string keys
      const userKeys = Object.keys(users).filter(key => key !== "count" && !isNaN(Number(key)));
      
      for (const userKey of userKeys) {
        const userData = users[userKey]?.user;
        if (Array.isArray(userData) && userData[1]?.games) {
          const games = userData[1].games;
          const gameKeys = Object.keys(games).filter(key => key !== "count" && !isNaN(Number(key)));
          
          for (const gameKey of gameKeys) {
            const gameData = games[gameKey]?.game;
            if (Array.isArray(gameData) && gameData[1]?.leagues) {
              const leagues = gameData[1].leagues;
              const leagueKeysInGame = Object.keys(leagues).filter(key => key !== "count" && !isNaN(Number(key)));
              
              // Get game info from gameData[0]
              const gameProps = Array.isArray(gameData[0]) ? gameData[0] : [gameData[0]];
              const gameCode = gameProps.find((p: any) => p.code)?.code || "";
              const season = gameProps.find((p: any) => p.season)?.season || "";
              
              for (const leagueKey of leagueKeysInGame) {
                const leagueData = leagues[leagueKey]?.league;
                if (Array.isArray(leagueData) && leagueData[0]) {
                  const leagueProps = Array.isArray(leagueData[0]) ? leagueData[0] : [leagueData[0]];
                  const leagueKeyValue = leagueProps.find((p: any) => p.league_key)?.league_key;
                  const leagueName = leagueProps.find((p: any) => p.name)?.name || "Unknown";
                  
                  if (leagueKeyValue) {
                    leagueKeys.push({
                      leagueKey: leagueKeyValue,
                      name: leagueName,
                      gameCode,
                      season,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
    
    console.log(`✅ Found ${leagueKeys.length} league(s):`);
    leagueKeys.forEach((league, idx) => {
      console.log(`   ${idx + 1}. ${league.name} (${league.leagueKey}) - ${league.gameCode} ${league.season}`);
    });
    console.log();

    // Find the latest NBA league (most recent season)
    const nbaLeagues = leagueKeys
      .filter(l => l.gameCode === "nba")
      .sort((a, b) => {
        // Sort by season (descending), then by league key
        const seasonA = parseInt(a.season);
        const seasonB = parseInt(b.season);
        if (seasonA !== seasonB) return seasonB - seasonA;
        return b.leagueKey.localeCompare(a.leagueKey);
      });
    
    if (nbaLeagues.length > 0) {
      const latestNbaLeague = nbaLeagues[0];
      console.log(`\n🎯 Found latest NBA league: ${latestNbaLeague.name}`);
      console.log(`   League Key: ${latestNbaLeague.leagueKey}`);
      console.log(`   Season: ${latestNbaLeague.season}`);
      console.log(`   Game Code: ${latestNbaLeague.gameCode}\n`);
      
      // Focus on the latest NBA league for comprehensive documentation
      const leaguesToProcess = [latestNbaLeague];
      console.log(`📊 Processing latest NBA league for comprehensive API documentation...\n`);
      
      for (let i = 0; i < leaguesToProcess.length; i++) {
        const league = leaguesToProcess[i];
        const leagueNum = i + 1;
        const prefix = `${String(leagueNum).padStart(2, "0")}-${league.gameCode}-${league.season}`;
        
        // Add league-specific API calls
        apiCalls.push(
          {
            name: `getLeagueStandings (Raw) - ${league.name}`,
            description: `Get raw standings response for league ${league.leagueKey} (includes rankings, team records)`,
            call: () => withTimeout(
              client.getRawApiResponse(`/league/${league.leagueKey}/standings`),
              60000,
              `getLeagueStandings for ${league.leagueKey}`
            ),
            filename: `${prefix}-standings-raw.json`,
          },
          {
            name: `getLeagueStandings with Stats (Raw) - ${league.name}`,
            description: `Get raw standings with detailed stats for league ${league.leagueKey}`,
            call: () => withTimeout(
              client.getRawApiResponse(`/league/${league.leagueKey}/standings;out=stats`),
              60000,
              `getLeagueStandings with stats for ${league.leagueKey}`
            ),
            filename: `${prefix}-standings-stats-raw.json`,
          },
          {
            name: `getLeagueSettings (Raw) - ${league.name}`,
            description: `Get raw settings response for league ${league.leagueKey}`,
            call: () => withTimeout(
              client.getRawApiResponse(`/league/${league.leagueKey}/settings`),
              60000,
              `getLeagueSettings for ${league.leagueKey}`
            ),
            filename: `${prefix}-settings-raw.json`,
          },
          {
            name: `getLeagueScoreboard (Raw) - ${league.name}`,
            description: `Get raw current week scoreboard response for league ${league.leagueKey}`,
            call: () => withTimeout(
              client.getRawApiResponse(`/league/${league.leagueKey}/scoreboard`),
              60000,
              `getLeagueScoreboard for ${league.leagueKey}`
            ),
            filename: `${prefix}-scoreboard-raw.json`,
          },
          {
            name: `getLeagueScoreboard Week 1 (Raw) - ${league.name}`,
            description: `Get raw week 1 scoreboard response for league ${league.leagueKey}`,
            call: () => withTimeout(
              client.getRawApiResponse(`/league/${league.leagueKey}/scoreboard;week=1`),
              60000,
              `getLeagueScoreboard Week 1 for ${league.leagueKey}`
            ),
            filename: `${prefix}-scoreboard-week1-raw.json`,
          },
          {
            name: `getLeagueScoreboard Current Week (Raw) - ${league.name}`,
            description: `Get raw current week scoreboard response for league ${league.leagueKey}`,
            call: async () => {
              // First get league settings to find current week
              const settings = await withTimeout(
                client.getRawApiResponse(`/league/${league.leagueKey}/settings`),
                30000,
                `getLeagueSettings for current week`
              );
              // Settings structure: league[0] is an object with current_week property directly
              const leagueProps = settings?.fantasy_content?.league?.[0];
              const currentWeek = (leagueProps && typeof leagueProps === 'object' && 'current_week' in leagueProps) 
                ? leagueProps.current_week 
                : "1";
              return withTimeout(
                client.getRawApiResponse(`/league/${league.leagueKey}/scoreboard;week=${currentWeek}`),
                60000,
                `getLeagueScoreboard Week ${currentWeek} for ${league.leagueKey}`
              );
            },
            filename: `${prefix}-scoreboard-current-week-raw.json`,
          },
          {
            name: `getLeagueScoreboard Multiple Weeks (Raw) - ${league.name}`,
            description: `Get raw scoreboard for weeks 1-4 for league ${league.leagueKey}`,
            call: async () => {
              const weeks = [];
              for (let week = 1; week <= 4; week++) {
                const weekData = await withTimeout(
                  client.getRawApiResponse(`/league/${league.leagueKey}/scoreboard;week=${week}`),
                  60000,
                  `getLeagueScoreboard Week ${week}`
                );
                weeks.push({ week, data: weekData });
                await new Promise(resolve => setTimeout(resolve, 500)); // Delay between weeks
              }
              return { weeks };
            },
            filename: `${prefix}-scoreboard-weeks1-4-raw.json`,
          },
          {
            name: `getLeagueTeams (Raw) - ${league.name}`,
            description: `Get raw teams response for league ${league.leagueKey}`,
            call: () => withTimeout(
              client.getRawApiResponse(`/league/${league.leagueKey}/teams`),
              60000,
              `getLeagueTeams for ${league.leagueKey}`
            ),
            filename: `${prefix}-teams-raw.json`,
          },
          {
            name: `getLeaguePlayers (Raw) - ${league.name}`,
            description: `Get raw players response for league ${league.leagueKey} (all available players)`,
            call: () => withTimeout(
              client.getRawApiResponse(`/league/${league.leagueKey}/players`),
              60000,
              `getLeaguePlayers for ${league.leagueKey}`
            ),
            filename: `${prefix}-players-raw.json`,
          },
          {
            name: `getLeaguePlayers with Stats (Raw) - ${league.name}`,
            description: `Get raw players with stats for league ${league.leagueKey}`,
            call: () => withTimeout(
              client.getRawApiResponse(`/league/${league.leagueKey}/players;out=stats`),
              60000,
              `getLeaguePlayers with stats for ${league.leagueKey}`
            ),
            filename: `${prefix}-players-stats-raw.json`,
          },
          {
            name: `getLeagueFreeAgents (Raw) - ${league.name}`,
            description: `Get raw free agents for league ${league.leagueKey}`,
            call: () => withTimeout(
              client.getRawApiResponse(`/league/${league.leagueKey}/players;status=FA`),
              60000,
              `getLeagueFreeAgents for ${league.leagueKey}`
            ),
            filename: `${prefix}-freeagents-raw.json`,
          },
          {
            name: `getLeagueTransactions (Raw) - ${league.name}`,
            description: `Get raw transactions response for league ${league.leagueKey}`,
            call: () => withTimeout(
              client.getRawApiResponse(`/league/${league.leagueKey}/transactions`),
              120000, // Transactions can be large, give it 2 minutes
              `getLeagueTransactions for ${league.leagueKey}`
            ),
            filename: `${prefix}-transactions-raw.json`,
          },
          {
            name: `getLeagueDraftResults (Raw) - ${league.name}`,
            description: `Get raw draft results for league ${league.leagueKey}`,
            call: () => withTimeout(
              client.getRawApiResponse(`/league/${league.leagueKey}/draftresults`),
              60000,
              `getLeagueDraftResults for ${league.leagueKey}`
            ),
            filename: `${prefix}-draftresults-raw.json`,
          },
          {
            name: `getLeagueMetadata (Raw) - ${league.name}`,
            description: `Get raw league metadata for ${league.leagueKey}`,
            call: () => withTimeout(
              client.getRawApiResponse(`/league/${league.leagueKey}/metadata`),
              60000,
              `getLeagueMetadata for ${league.leagueKey}`
            ),
            filename: `${prefix}-metadata-raw.json`,
          },
        );
      }
      
      // For the latest NBA league, get comprehensive team and player details
      const latestLeague = leaguesToProcess[0];
      console.log(`🔍 Fetching comprehensive data for latest NBA league: ${latestLeague.name}...\n`);
      
      try {
        // Get standings to find team keys
        console.log(`  📊 Fetching standings to discover teams...`);
        const standingsRaw = await withTimeout(
          client.getRawApiResponse(`/league/${latestLeague.leagueKey}/standings`),
          30000, // 30 second timeout
          `getLeagueStandings for ${latestLeague.leagueKey}`
        );
        const standingsData = standingsRaw?.fantasy_content?.league;
        const teamKeys: string[] = [];
        
        if (Array.isArray(standingsData) && standingsData[1]?.standings) {
          const standingsObj = standingsData[1].standings;
          if (Array.isArray(standingsObj) && standingsObj[0]?.teams) {
            const teams = standingsObj[0].teams;
            const teamIndexKeys = Object.keys(teams).filter(key => key !== "count" && !isNaN(Number(key)));
            
            // Get all teams, not just first 3, for comprehensive documentation
            for (const teamIndexKey of teamIndexKeys) {
              const teamData = teams[teamIndexKey];
              if (teamData?.team?.[0]) {
                const teamProps = Array.isArray(teamData.team[0]) ? teamData.team[0] : [teamData.team[0]];
                const teamKeyObj = teamProps.find((prop: any) => prop.team_key);
                if (teamKeyObj?.team_key) {
                  teamKeys.push(teamKeyObj.team_key);
                }
              }
            }
          }
        }
        
        console.log(`  ✅ Found ${teamKeys.length} team key(s)\n`);
        
        // Add comprehensive team-specific API calls
        for (let i = 0; i < teamKeys.length; i++) {
          const teamKey = teamKeys[i];
          const teamNum = i + 1;
          const prefix = `10-${String(teamNum).padStart(2, "0")}-team-${teamKey.split(".").pop()}`;
          
          apiCalls.push(
            {
              name: `getTeamRoster (Raw) - Team ${teamNum}`,
              description: `Get raw roster response for team ${teamKey} (includes player status, positions)`,
              call: () => withTimeout(
                client.getRawApiResponse(`/team/${teamKey}/roster`),
                60000,
                `getTeamRoster for ${teamKey}`
              ),
              filename: `${prefix}-roster-raw.json`,
            },
            {
              name: `getTeamStats Season (Raw) - Team ${teamNum}`,
              description: `Get raw season stats for team ${teamKey}`,
              call: () => withTimeout(
                client.getRawApiResponse(`/team/${teamKey}/stats`),
                60000,
                `getTeamStats for ${teamKey}`
              ),
              filename: `${prefix}-stats-season-raw.json`,
            },
            {
              name: `getTeamStats Current Week (Raw) - Team ${teamNum}`,
              description: `Get raw current week stats for team ${teamKey}`,
              call: async () => {
                // Get current week from settings first
                const settings = await withTimeout(
                  client.getRawApiResponse(`/league/${latestLeague.leagueKey}/settings`),
                  30000,
                  `getLeagueSettings for current week`
                );
                // Settings structure: league[0] is an object with current_week property directly
              const leagueProps = settings?.fantasy_content?.league?.[0];
              const currentWeek = (leagueProps && typeof leagueProps === 'object' && 'current_week' in leagueProps) 
                ? leagueProps.current_week 
                : "1";
                return withTimeout(
                  client.getRawApiResponse(`/team/${teamKey}/stats;type=week;week=${currentWeek}`),
                  60000,
                  `getTeamStats Week ${currentWeek} for ${teamKey}`
                );
              },
              filename: `${prefix}-stats-week-current-raw.json`,
            },
            {
              name: `getTeamMatchups (Raw) - Team ${teamNum}`,
              description: `Get raw matchups response for team ${teamKey} (shows games played per week)`,
              call: () => withTimeout(
                client.getRawApiResponse(`/team/${teamKey}/matchups`),
                60000,
                `getTeamMatchups for ${teamKey}`
              ),
              filename: `${prefix}-matchups-raw.json`,
            },
            {
              name: `getTeamRoster Week 1 (Raw) - Team ${teamNum}`,
              description: `Get raw week 1 roster for team ${teamKey} (to see weekly roster changes)`,
              call: () => withTimeout(
                client.getRawApiResponse(`/team/${teamKey}/roster;week=1`),
                60000,
                `getTeamRoster Week 1 for ${teamKey}`
              ),
              filename: `${prefix}-roster-week1-raw.json`,
            },
          );
          
          // Get roster to find player keys (with progress logging and delay)
          try {
            console.log(`  📋 Fetching roster for team ${teamNum} to discover players...`);
            const rosterRaw = await withTimeout(
              client.getRawApiResponse(`/team/${teamKey}/roster`),
              30000, // 30 second timeout
              `getTeamRoster for ${teamKey}`
            );
            const rosterData = rosterRaw?.fantasy_content?.team;
            const playerKeys: string[] = [];
            
            if (Array.isArray(rosterData) && rosterData[1]?.roster) {
              const roster = rosterData[1].roster;
              // Handle numeric string keys for roster positions (like "0", "1", etc.)
              const rosterPositionKeys = Object.keys(roster).filter(key => key !== "count" && !isNaN(Number(key)));
              
              for (const positionKey of rosterPositionKeys) {
                const positionData = roster[positionKey];
                if (positionData?.players) {
                  const players = positionData.players;
                  const playerIndexKeys = Object.keys(players).filter(key => key !== "count" && !isNaN(Number(key)));
                  
                  for (const playerIndexKey of playerIndexKeys) {
                    const playerData = players[playerIndexKey];
                    // Player structure: playerData.player is an array where [0] is an array of property objects
                    if (playerData?.player && Array.isArray(playerData.player) && playerData.player[0]) {
                      const playerProps = Array.isArray(playerData.player[0]) ? playerData.player[0] : [playerData.player[0]];
                      // Find the property object that contains player_key
                      const playerKeyObj = playerProps.find((prop: any) => prop && prop.player_key);
                      if (playerKeyObj?.player_key) {
                        playerKeys.push(playerKeyObj.player_key);
                        // Get all players, not just 3, for comprehensive documentation
                      }
                    }
                  }
                }
              }
            }
            
            if (playerKeys.length > 0) {
              console.log(`  ✅ Found ${playerKeys.length} player key(s) for team ${teamNum}`);
              
              // Get current week for player stats
              const settings = await withTimeout(
                client.getRawApiResponse(`/league/${latestLeague.leagueKey}/settings`),
                30000,
                `getLeagueSettings for current week`
              );
              // Settings structure: league[0] is an object with current_week property directly
              const leagueProps = settings?.fantasy_content?.league?.[0];
              const currentWeek = (leagueProps && typeof leagueProps === 'object' && 'current_week' in leagueProps) 
                ? leagueProps.current_week 
                : "1";
              
              // Add comprehensive player-specific API calls for ALL players
              for (let j = 0; j < playerKeys.length; j++) {
                const playerKey = playerKeys[j];
                const playerNum = j + 1;
                const playerPrefix = `11-${String(teamNum).padStart(2, "0")}-${String(playerNum).padStart(2, "0")}-player-${playerKey.split(".").pop()}`;
                
                apiCalls.push(
                  {
                    name: `getPlayerInfo (Raw) - Player ${teamNum}-${playerNum}`,
                    description: `Get raw player info for ${playerKey} (includes status, position, team)`,
                    call: () => withTimeout(
                      client.getRawApiResponse(`/player/${playerKey}`),
                      60000,
                      `getPlayerInfo for ${playerKey}`
                    ),
                    filename: `${playerPrefix}-info-raw.json`,
                  },
                  {
                    name: `getPlayerStats Season (Raw) - Player ${teamNum}-${playerNum}`,
                    description: `Get raw season stats for player ${playerKey}`,
                    call: () => withTimeout(
                      client.getRawApiResponse(`/player/${playerKey}/stats`),
                      60000,
                      `getPlayerStats for ${playerKey}`
                    ),
                    filename: `${playerPrefix}-stats-season-raw.json`,
                  },
                  {
                    name: `getPlayerStats Current Week (Raw) - Player ${teamNum}-${playerNum}`,
                    description: `Get raw current week (${currentWeek}) stats for player ${playerKey}`,
                    call: () => withTimeout(
                      client.getRawApiResponse(`/player/${playerKey}/stats;type=week;week=${currentWeek}`),
                      60000,
                      `getPlayerStats Week ${currentWeek} for ${playerKey}`
                    ),
                    filename: `${playerPrefix}-stats-week${currentWeek}-raw.json`,
                  },
                  {
                    name: `getPlayerStats Week 1 (Raw) - Player ${teamNum}-${playerNum}`,
                    description: `Get raw week 1 stats for player ${playerKey}`,
                    call: () => withTimeout(
                      client.getRawApiResponse(`/player/${playerKey}/stats;type=week;week=1`),
                      60000,
                      `getPlayerStats Week 1 for ${playerKey}`
                    ),
                    filename: `${playerPrefix}-stats-week1-raw.json`,
                  },
                  {
                    name: `getPlayerStats Last Week (Raw) - Player ${teamNum}-${playerNum}`,
                    description: `Get raw last week stats for player ${playerKey}`,
                    call: () => withTimeout(
                      client.getRawApiResponse(`/player/${playerKey}/stats;type=lastweek`),
                      60000,
                      `getPlayerStats LastWeek for ${playerKey}`
                    ),
                    filename: `${playerPrefix}-stats-lastweek-raw.json`,
                  },
                  {
                    name: `getPlayerStats Last Month (Raw) - Player ${teamNum}-${playerNum}`,
                    description: `Get raw last month stats for player ${playerKey}`,
                    call: () => withTimeout(
                      client.getRawApiResponse(`/player/${playerKey}/stats;type=lastmonth`),
                      60000,
                      `getPlayerStats LastMonth for ${playerKey}`
                    ),
                    filename: `${playerPrefix}-stats-lastmonth-raw.json`,
                  },
                );
              }
              
              console.log(`  ✅ Added comprehensive API calls for ${playerKeys.length} player(s)\n`);
            } else {
              console.log(`  ⚠️  No players found for team ${teamNum}\n`);
            }
            
            // Add delay between team discovery calls to avoid rate limiting
            if (i < teamKeys.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } catch (error: any) {
            console.log(`  ⚠️  Could not fetch players for team ${teamNum}: ${error.message}\n`);
            // Add delay even on error to avoid rate limiting
            if (i < teamKeys.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
      } catch (error: any) {
        console.log(`⚠️  Could not fetch detailed data for league: ${error.message}\n`);
      }
    } else {
      console.log("⚠️  No leagues found. Only basic API calls will be made.\n");
    }
  } catch (error: any) {
    console.log(`⚠️  Error fetching leagues: ${error.message}`);
    console.log("   Continuing with basic API calls only...\n");
  }

  // Execute all API calls
  console.log(`🚀 Executing ${apiCalls.length} API calls...\n`);
  const responses: Array<{ name: string; filename: string; data: any; description: string }> = [];

  for (const apiCall of apiCalls) {
    try {
      console.log(`📡 Calling ${apiCall.name}...`);
      const data = await withTimeout(
        apiCall.call(),
        60000, // 60 second timeout for actual API calls
        apiCall.name
      );
      saveResponse(apiCall.filename, data);
      responses.push({
        name: apiCall.name,
        filename: apiCall.filename,
        data,
        description: apiCall.description,
      });
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
      // Save error response
      const errorData = {
        error: true,
        message: error.message,
        stack: error.stack,
      };
      saveResponse(apiCall.filename.replace(".json", "-error.json"), errorData);
    }
  }

  // Generate documentation
  console.log(`\n📝 Generating documentation from ${responses.length} responses...\n`);
  generateDocumentation(responses);

  console.log("\n✅ Documentation generation complete!");
  console.log(`\n📂 Output directory: ${OUTPUT_DIR}`);
  console.log(`📄 Documentation: ${DOC_FILE}`);
  console.log(`\n💡 Use these files to understand the API structure and update parsing logic.`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
