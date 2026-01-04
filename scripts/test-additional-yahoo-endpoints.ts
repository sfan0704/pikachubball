/**
 * Test Additional Yahoo API Endpoints
 * 
 * This script tests additional endpoints from the Yahoo Fantasy Sports API guide
 * that we haven't tested yet, to ensure comprehensive documentation.
 */

import { config } from "dotenv";
import { resolve } from "path";
import { writeFileSync } from "fs";
import { join } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { storage } from "../server/storage";
import { getYahooApiClient } from "../server/services/yahoo/yahoo-api-client";

const OUTPUT_DIR = join(process.cwd(), "scripts", "yahoo-api-responses");

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms: ${operation}`)), timeoutMs)
    ),
  ]);
}

async function main() {
  console.log("🧪 Testing Additional Yahoo API Endpoints\n");

  const username = process.env.TEST_USERNAME || "testuser";
  const user = await storage.getUserByUsername(username);
  
  if (!user) {
    console.error(`❌ User "${username}" not found.`);
    process.exit(1);
  }

  const token = await storage.getYahooToken(user.id);
  if (!token) {
    console.error("❌ User doesn't have a Yahoo token.");
    process.exit(1);
  }

  const client = await getYahooApiClient(user.id);
  
  // Get latest NBA league
  const rawLeaguesResponse = await withTimeout(
    client.getRawApiResponse("/users;use_login=1/games/leagues"),
    30000,
    "getAllUserLeagues"
  );
  
  const fantasyContent = rawLeaguesResponse?.fantasy_content;
  let latestLeagueKey: string | null = null;
  
  if (fantasyContent?.users) {
    const users = fantasyContent.users;
    const userKeys = Object.keys(users).filter(key => key !== "count" && !isNaN(Number(key)));
    
    for (const userKey of userKeys) {
      const userData = users[userKey]?.user;
      if (Array.isArray(userData) && userData[1]?.games) {
        const games = userData[1].games;
        const gameKeys = Object.keys(games).filter(key => key !== "count" && !isNaN(Number(key)));
        
        // Find latest NBA league
        const nbaLeagues: Array<{ leagueKey: string; season: number }> = [];
        for (const gameKey of gameKeys) {
          const gameData = games[gameKey]?.game;
          if (Array.isArray(gameData) && gameData[1]?.leagues) {
            const leagues = gameData[1].leagues;
            const leagueKeysInGame = Object.keys(leagues).filter(key => key !== "count" && !isNaN(Number(key)));
            const gameProps = Array.isArray(gameData[0]) ? gameData[0] : [gameData[0]];
            const gameCode = gameProps.find((p: any) => p.code)?.code || "";
            const season = parseInt(gameProps.find((p: any) => p.season)?.season || "0");
            
            if (gameCode === "nba") {
              for (const leagueKey of leagueKeysInGame) {
                const leagueData = leagues[leagueKey]?.league;
                if (Array.isArray(leagueData) && leagueData[0]) {
                  const leagueProps = Array.isArray(leagueData[0]) ? leagueData[0] : [leagueData[0]];
                  const leagueKeyValue = leagueProps.find((p: any) => p.league_key)?.league_key;
                  if (leagueKeyValue) {
                    nbaLeagues.push({ leagueKey: leagueKeyValue, season });
                  }
                }
              }
            }
          }
        }
        
        if (nbaLeagues.length > 0) {
          nbaLeagues.sort((a, b) => b.season - a.season);
          latestLeagueKey = nbaLeagues[0].leagueKey;
          break;
        }
      }
    }
  }
  
  if (!latestLeagueKey) {
    console.error("❌ Could not find latest NBA league");
    process.exit(1);
  }
  
  console.log(`✅ Found latest NBA league: ${latestLeagueKey}\n`);
  
  // Get a team key and player key for testing
  const standings = await withTimeout(
    client.getRawApiResponse(`/league/${latestLeagueKey}/standings`),
    30000,
    "getLeagueStandings"
  );
  
  const standingsData = standings?.fantasy_content?.league;
  let teamKey: string | null = null;
  let playerKey: string | null = null;
  
  if (Array.isArray(standingsData) && standingsData[1]?.standings) {
    const standingsObj = standingsData[1].standings;
    if (Array.isArray(standingsObj) && standingsObj[0]?.teams) {
      const teams = standingsObj[0].teams;
      const teamIndexKeys = Object.keys(teams).filter(key => key !== "count" && !isNaN(Number(key)));
      if (teamIndexKeys.length > 0) {
        const firstTeam = teams[teamIndexKeys[0]];
        if (firstTeam?.team?.[0]) {
          const teamProps = Array.isArray(firstTeam.team[0]) ? firstTeam.team[0] : [firstTeam.team[0]];
          const teamKeyObj = teamProps.find((prop: any) => prop?.team_key);
          if (teamKeyObj?.team_key) {
            teamKey = teamKeyObj.team_key;
            
            // Get roster to find a player
            const roster = await withTimeout(
              client.getRawApiResponse(`/team/${teamKey}/roster`),
              30000,
              "getTeamRoster"
            );
            
            const rosterData = roster?.fantasy_content?.team;
            if (Array.isArray(rosterData) && rosterData[1]?.roster) {
              const rosterObj = rosterData[1].roster;
              const positionKeys = Object.keys(rosterObj).filter(key => key !== "count" && !isNaN(Number(key)));
              
              for (const positionKey of positionKeys) {
                const positionData = rosterObj[positionKey];
                if (positionData?.players) {
                  const players = positionData.players;
                  const playerIndexKeys = Object.keys(players).filter(key => key !== "count" && !isNaN(Number(key)));
                  if (playerIndexKeys.length > 0) {
                    const firstPlayer = players[playerIndexKeys[0]];
                    if (firstPlayer?.player && Array.isArray(firstPlayer.player) && firstPlayer.player[0]) {
                      const playerProps = Array.isArray(firstPlayer.player[0]) ? firstPlayer.player[0] : [firstPlayer.player[0]];
                      const playerKeyObj = playerProps.find((prop: any) => prop?.player_key);
                      if (playerKeyObj?.player_key) {
                        playerKey = playerKeyObj.player_key;
                        break;
                      }
                    }
                  }
                }
                if (playerKey) break;
              }
            }
          }
        }
      }
    }
  }
  
  if (!teamKey) {
    console.error("❌ Could not find team key");
    process.exit(1);
  }
  
  console.log(`✅ Found team: ${teamKey}`);
  if (playerKey) {
    console.log(`✅ Found player: ${playerKey}\n`);
  } else {
    console.log(`⚠️  Could not find player key\n`);
  }
  
  // Test additional endpoints from Yahoo guide
  const additionalTests: Array<{ name: string; endpoint: string; filename: string }> = [];
  
  // Player endpoints
  if (playerKey) {
    additionalTests.push(
      { name: "Player Info", endpoint: `/player/${playerKey}`, filename: "test-player-info-raw.json" },
      { name: "Player Stats (Season)", endpoint: `/player/${playerKey}/stats`, filename: "test-player-stats-season-raw.json" },
      { name: "Player Stats (Week 1)", endpoint: `/player/${playerKey}/stats;type=week;week=1`, filename: "test-player-stats-week1-raw.json" },
      { name: "Player Stats (Last Week)", endpoint: `/player/${playerKey}/stats;type=lastweek`, filename: "test-player-stats-lastweek-raw.json" },
      { name: "Player Stats (Last Month)", endpoint: `/player/${playerKey}/stats;type=lastmonth`, filename: "test-player-stats-lastmonth-raw.json" },
    );
  }
  
  // Team endpoints with different parameters
  additionalTests.push(
    { name: "Team Stats (Date)", endpoint: `/team/${teamKey}/stats;type=date;date=2025-12-11`, filename: "test-team-stats-date-raw.json" },
  );
  
  // League endpoints with filters
  additionalTests.push(
    { name: "League Players (Sorted by Points)", endpoint: `/league/${latestLeagueKey}/players;sort=PTS`, filename: "test-league-players-sorted-pts-raw.json" },
    { name: "League Players (Start/Count)", endpoint: `/league/${latestLeagueKey}/players;start=0;count=10`, filename: "test-league-players-paginated-raw.json" },
  );
  
  console.log(`🧪 Testing ${additionalTests.length} additional endpoints...\n`);
  
  for (const test of additionalTests) {
    try {
      console.log(`📡 Testing: ${test.name}...`);
      const data = await withTimeout(
        client.getRawApiResponse(test.endpoint),
        60000,
        test.name
      );
      writeFileSync(join(OUTPUT_DIR, test.filename), JSON.stringify(data, null, 2), "utf-8");
      console.log(`  ✅ Saved: ${test.filename}\n`);
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}\n`);
      const errorData = {
        error: true,
        message: error.message,
        endpoint: test.endpoint,
      };
      writeFileSync(join(OUTPUT_DIR, test.filename.replace(".json", "-error.json")), JSON.stringify(errorData, null, 2), "utf-8");
    }
  }
  
  console.log("✅ Additional endpoint testing complete!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
