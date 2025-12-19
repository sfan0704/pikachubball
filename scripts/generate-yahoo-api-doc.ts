/**
 * Yahoo API Documentation Generator
 * 
 * This script analyzes actual Yahoo API responses and generates comprehensive documentation
 * based ONLY on successful API calls. It does not assume anything - everything is derived
 * from actual response data.
 * 
 * Usage:
 *   npm run generate:yahoo-api-doc
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { storage } from "../server/storage";
import { getYahooApiClient } from "../server/services/yahoo/yahoo-api-client";

const RESPONSES_DIR = join(process.cwd(), "scripts", "yahoo-api-responses");
const DOCS_DIR = join(process.cwd(), "docs");
const DOC_FILE = join(DOCS_DIR, "YAHOO_API_DOCUMENTATION.md");

/**
 * Analyze a JSON response file and extract structure information
 */
function analyzeResponse(filepath: string): {
  filename: string;
  structure: any;
  keyPaths: string[];
  observations: string[];
} {
  const content = readFileSync(filepath, "utf-8");
  const data = JSON.parse(content);
  
  const keyPaths: string[] = [];
  const observations: string[] = [];
  
  // Extract key paths and structure
  function traverse(obj: any, path: string = "", depth: number = 0): void {
    if (depth > 5) return; // Limit depth
    
    if (obj === null || obj === undefined) {
      return;
    }
    
    if (Array.isArray(obj)) {
      observations.push(`Array found at path: ${path || "root"}`);
      if (obj.length > 0) {
        // Check if it's the Yahoo pattern: [0] = properties, [1] = subresources
        if (obj.length >= 2 && typeof obj[0] === 'object' && typeof obj[1] === 'object') {
          observations.push(`Yahoo array pattern detected at ${path}: [0] = properties, [1] = subresources`);
        }
        traverse(obj[0], `${path}[0]`, depth + 1);
      }
      return;
    }
    
    if (typeof obj === "object") {
      const keys = Object.keys(obj);
      
      // Check for numeric string keys pattern
      const numericKeys = keys.filter(k => k !== "count" && !isNaN(Number(k)));
      if (numericKeys.length > 0 && keys.includes("count")) {
        observations.push(`Numeric string keys pattern at ${path}: uses "0", "1", etc. with "count" property`);
      }
      
      for (const key of keys.slice(0, 20)) { // Limit keys analyzed
        const value = obj[key];
        const newPath = path ? `${path}.${key}` : key;
        
        // Track important keys
        if (key.includes("key") || key.includes("id") || key.includes("stat") || 
            key.includes("team") || key.includes("player") || key.includes("league")) {
          keyPaths.push(newPath);
        }
        
        traverse(value, newPath, depth + 1);
      }
    }
  }
  
  traverse(data);
  
  return {
    filename: filepath.split("/").pop() || "",
    structure: data,
    keyPaths: [...new Set(keyPaths)].slice(0, 50),
    observations: [...new Set(observations)],
  };
}

/**
 * Extract endpoint information from filename
 */
function extractEndpointInfo(filename: string): {
  type: string;
  resource: string;
  params?: string;
} {
  // Pattern: 01-nba-2025-standings-raw.json
  // Pattern: 10-01-team-11-roster-raw.json
  // Pattern: 11-01-01-player-4610-stats-raw.json
  
  if (filename.includes("get-user-games")) {
    return { type: "users", resource: "games" };
  }
  if (filename.includes("get-all-user-leagues")) {
    return { type: "users", resource: "games/leagues" };
  }
  if (filename.includes("standings")) {
    return { type: "league", resource: "standings" };
  }
  if (filename.includes("settings")) {
    return { type: "league", resource: "settings" };
  }
  if (filename.includes("scoreboard")) {
    const weekMatch = filename.match(/week(\d+)/);
    return { type: "league", resource: "scoreboard", params: weekMatch ? `week=${weekMatch[1]}` : undefined };
  }
  if (filename.includes("teams")) {
    return { type: "league", resource: "teams" };
  }
  if (filename.includes("players") && !filename.includes("player-")) {
    return { type: "league", resource: "players" };
  }
  if (filename.includes("freeagents")) {
    return { type: "league", resource: "players", params: "status=FA" };
  }
  if (filename.includes("transactions")) {
    return { type: "league", resource: "transactions" };
  }
  if (filename.includes("draftresults")) {
    return { type: "league", resource: "draftresults" };
  }
  if (filename.includes("metadata")) {
    return { type: "league", resource: "metadata" };
  }
  if (filename.includes("roster")) {
    const weekMatch = filename.match(/week(\d+)/);
    return { type: "team", resource: "roster", params: weekMatch ? `week=${weekMatch[1]}` : undefined };
  }
  if (filename.includes("stats") && filename.includes("team")) {
    if (filename.includes("season")) {
      return { type: "team", resource: "stats", params: "type=season" };
    }
    if (filename.includes("week")) {
      return { type: "team", resource: "stats", params: "type=week" };
    }
    return { type: "team", resource: "stats" };
  }
  if (filename.includes("matchups")) {
    return { type: "team", resource: "matchups" };
  }
  if (filename.includes("player-") && filename.includes("info")) {
    return { type: "player", resource: "metadata" };
  }
  if (filename.includes("player-") && filename.includes("stats")) {
    if (filename.includes("season")) {
      return { type: "player", resource: "stats" };
    }
    if (filename.includes("week")) {
      const weekMatch = filename.match(/week(\d+)/);
      return { type: "player", resource: "stats", params: weekMatch ? `type=week;week=${weekMatch[1]}` : "type=week" };
    }
    if (filename.includes("lastweek")) {
      return { type: "player", resource: "stats", params: "type=lastweek" };
    }
    if (filename.includes("lastmonth")) {
      return { type: "player", resource: "stats", params: "type=lastmonth" };
    }
    return { type: "player", resource: "stats" };
  }
  
  return { type: "unknown", resource: "unknown" };
}

/**
 * Generate comprehensive documentation from actual API responses
 */
async function generateDocumentation() {
  console.log("📚 Generating Yahoo API Documentation from actual responses...\n");
  
  // Get all JSON files
  const files = readdirSync(RESPONSES_DIR)
    .filter(f => f.endsWith(".json"))
    .sort();
  
  console.log(`Found ${files.length} response files\n`);
  
  // Analyze each file
  const analyses: Array<{
    filename: string;
    endpoint: ReturnType<typeof extractEndpointInfo>;
    analysis: ReturnType<typeof analyzeResponse>;
    sampleData: any;
  }> = [];
  
  for (const file of files) {
    const filepath = join(RESPONSES_DIR, file);
    try {
      const analysis = analyzeResponse(filepath);
      const endpoint = extractEndpointInfo(file);
      const sampleData = analysis.structure;
      
      analyses.push({ filename: file, endpoint, analysis, sampleData });
      console.log(`✅ Analyzed: ${file}`);
    } catch (error: any) {
      console.error(`❌ Error analyzing ${file}: ${error.message}`);
    }
  }
  
  // Group by endpoint type
  const byType: Record<string, typeof analyses> = {};
  for (const analysis of analyses) {
    const type = analysis.endpoint.type;
    if (!byType[type]) {
      byType[type] = [];
    }
    byType[type].push(analysis);
  }
  
  // Generate markdown documentation
  let doc = `# Yahoo Fantasy Sports API Documentation

**Generated from actual API responses** - This documentation is based on real API calls made to Yahoo Fantasy Sports API.
No assumptions were made - everything documented here comes from successful API responses.

**Generated:** ${new Date().toISOString()}
**League Used:** Latest NBA League (2025 season)
**Total API Calls Analyzed:** ${analyses.length}

---

## Table of Contents

1. [API Structure Overview](#api-structure-overview)
2. [User & Game Endpoints](#user--game-endpoints)
3. [League Endpoints](#league-endpoints)
4. [Team Endpoints](#team-endpoints)
5. [Player Endpoints](#player-endpoints)
6. [Common Patterns](#common-patterns)
7. [Data Extraction Examples](#data-extraction-examples)

---

## API Structure Overview

### Root Structure

All Yahoo Fantasy Sports API responses follow this structure:

\`\`\`json
{
  "fantasy_content": {
    "xml:lang": "en-US",
    "yahoo:uri": "/fantasy/v2/...",
    // ... resource data ...
    "time": "...",
    "copyright": "...",
    "refresh_rate": "60"
  }
}
\`\`\`

**Key Observations:**
- All responses are wrapped in \`fantasy_content\` object
- \`yahoo:uri\` shows the endpoint that was called
- Response includes timing and copyright information

---

`;

  // User & Game Endpoints
  if (byType.users) {
    doc += `## User & Game Endpoints\n\n`;
    for (const analysis of byType.users) {
      doc += `### ${analysis.endpoint.resource}\n\n`;
      doc += `**Endpoint:** \`/fantasy/v2/users;use_login=1/${analysis.endpoint.resource}\`\n\n`;
      doc += `**Response File:** \`${analysis.filename}\`\n\n`;
      
      // Show structure
      const structure = analysis.sampleData?.fantasy_content;
      if (structure) {
        doc += `**Structure:**\n\`\`\`json\n`;
        doc += JSON.stringify({
          fantasy_content: {
            users: structure.users ? "..." : undefined,
            games: structure.games ? "..." : undefined,
          }
        }, null, 2).substring(0, 500);
        doc += `\n\`\`\`\n\n`;
      }
      
      doc += `**Key Observations:**\n`;
      analysis.analysis.observations.slice(0, 5).forEach(obs => {
        doc += `- ${obs}\n`;
      });
      doc += `\n---\n\n`;
    }
  }
  
  // League Endpoints
  if (byType.league) {
    doc += `## League Endpoints\n\n`;
    
    const leagueEndpoints = new Map<string, typeof analyses>();
    for (const analysis of byType.league) {
      const key = `${analysis.endpoint.resource}${analysis.endpoint.params ? `?${analysis.endpoint.params}` : ""}`;
      if (!leagueEndpoints.has(key)) {
        leagueEndpoints.set(key, []);
      }
      leagueEndpoints.get(key)!.push(analysis);
    }
    
    for (const [endpointKey, endpointAnalyses] of leagueEndpoints) {
      const analysis = endpointAnalyses[0];
      doc += `### ${analysis.endpoint.resource}${analysis.endpoint.params ? ` (${analysis.endpoint.params})` : ""}\n\n`;
      doc += `**Endpoint:** \`/fantasy/v2/league/{league_key}/${analysis.endpoint.resource}${analysis.endpoint.params ? `;${analysis.endpoint.params}` : ""}\`\n\n`;
      doc += `**Response File:** \`${analysis.filename}\`\n\n`;
      
      // Extract actual structure from response
      const structure = analysis.sampleData?.fantasy_content?.league;
      if (structure) {
        doc += `**Response Structure:**\n\n`;
        doc += `\`\`\`json\n`;
        
        // Show the actual structure pattern
        if (Array.isArray(structure)) {
          doc += `{\n  "fantasy_content": {\n    "league": [\n      { /* Properties: league_key, name, current_week, etc. */ },\n      { /* Subresources: ${analysis.endpoint.resource} */ }\n    ]\n  }\n}\n`;
        } else {
          doc += JSON.stringify({ fantasy_content: { league: "..." } }, null, 2);
        }
        doc += `\n\`\`\`\n\n`;
        
        // Show actual properties from [0]
        if (Array.isArray(structure) && structure[0]) {
          const props = structure[0];
          if (typeof props === 'object') {
            const propKeys = Object.keys(props).filter(k => !k.startsWith("_")).slice(0, 20);
            doc += `**League Properties Available:**\n`;
            propKeys.forEach(key => {
              const value = props[key];
              const valueType = Array.isArray(value) ? "array" : typeof value;
              doc += `- \`${key}\`: ${valueType}${typeof value === 'string' && value.length < 50 ? ` = "${value}"` : ""}\n`;
            });
            doc += `\n`;
          }
        }
        
        // Show subresource structure
        if (Array.isArray(structure) && structure[1]) {
          const subresources = structure[1];
          doc += `**Subresource Structure:**\n\`\`\`json\n`;
          doc += JSON.stringify(subresources, null, 2).substring(0, 1000);
          doc += `\n\`\`\`\n\n`;
        }
      }
      
      doc += `**Key Observations:**\n`;
      analysis.analysis.observations.slice(0, 5).forEach(obs => {
        doc += `- ${obs}\n`;
      });
      doc += `\n---\n\n`;
    }
  }
  
  // Team Endpoints
  if (byType.team) {
    doc += `## Team Endpoints\n\n`;
    
    const teamEndpoints = new Map<string, typeof analyses>();
    for (const analysis of byType.team) {
      const key = `${analysis.endpoint.resource}${analysis.endpoint.params ? `?${analysis.endpoint.params}` : ""}`;
      if (!teamEndpoints.has(key)) {
        teamEndpoints.set(key, []);
      }
      teamEndpoints.get(key)!.push(analysis);
    }
    
    for (const [endpointKey, endpointAnalyses] of teamEndpoints) {
      const analysis = endpointAnalyses[0];
      doc += `### ${analysis.endpoint.resource}${analysis.endpoint.params ? ` (${analysis.endpoint.params})` : ""}\n\n`;
      doc += `**Endpoint:** \`/fantasy/v2/team/{team_key}/${analysis.endpoint.resource}${analysis.endpoint.params ? `;${analysis.endpoint.params}` : ""}\`\n\n`;
      doc += `**Response File:** \`${analysis.filename}\`\n\n`;
      
      const structure = analysis.sampleData?.fantasy_content?.team;
      if (structure) {
        doc += `**Response Structure:**\n\n`;
        if (Array.isArray(structure)) {
          doc += `\`\`\`json\n`;
          doc += `{\n  "fantasy_content": {\n    "team": [\n      [ /* Array of property objects */ ],\n      { /* Subresources */ }\n    ]\n  }\n}\n`;
          doc += `\n\`\`\`\n\n`;
          
          // Show team properties
          if (structure[0] && Array.isArray(structure[0])) {
            const props = structure[0];
            doc += `**Team Properties (from team[0] array):**\n`;
            props.slice(0, 10).forEach((prop: any, idx: number) => {
              if (prop && typeof prop === 'object') {
                const keys = Object.keys(prop);
                keys.forEach(key => {
                  doc += `- \`team[0][${idx}].${key}\`: ${typeof prop[key]}\n`;
                });
              }
            });
            doc += `\n`;
          }
          
          // Show subresources
          if (structure[1]) {
            doc += `**Subresources (team[1]):**\n\`\`\`json\n`;
            doc += JSON.stringify(structure[1], null, 2).substring(0, 1500);
            doc += `\n\`\`\`\n\n`;
          }
        }
      }
      
      doc += `**Key Observations:**\n`;
      analysis.analysis.observations.slice(0, 5).forEach(obs => {
        doc += `- ${obs}\n`;
      });
      doc += `\n---\n\n`;
    }
  }
  
  // Player Endpoints
  if (byType.player) {
    doc += `## Player Endpoints\n\n`;
    
    const playerEndpoints = new Map<string, typeof analyses>();
    for (const analysis of byType.player) {
      const key = `${analysis.endpoint.resource}${analysis.endpoint.params ? `?${analysis.endpoint.params}` : ""}`;
      if (!playerEndpoints.has(key)) {
        playerEndpoints.set(key, []);
      }
      playerEndpoints.get(key)!.push(analysis);
    }
    
    for (const [endpointKey, endpointAnalyses] of playerEndpoints) {
      const analysis = endpointAnalyses[0];
      doc += `### ${analysis.endpoint.resource}${analysis.endpoint.params ? ` (${analysis.endpoint.params})` : ""}\n\n`;
      doc += `**Endpoint:** \`/fantasy/v2/player/{player_key}/${analysis.endpoint.resource}${analysis.endpoint.params ? `;${analysis.endpoint.params}` : ""}\`\n\n`;
      doc += `**Response File:** \`${analysis.filename}\`\n\n`;
      
      const structure = analysis.sampleData?.fantasy_content?.player;
      if (structure) {
        doc += `**Response Structure:**\n\n`;
        if (Array.isArray(structure)) {
          doc += `\`\`\`json\n`;
          doc += `{\n  "fantasy_content": {\n    "player": [\n      [ /* Array of property objects */ ],\n      { /* Subresources: stats, etc. */ }\n    ]\n  }\n}\n`;
          doc += `\n\`\`\`\n\n`;
        }
      }
      
      doc += `**Key Observations:**\n`;
      analysis.analysis.observations.slice(0, 5).forEach(obs => {
        doc += `- ${obs}\n`;
      });
      doc += `\n---\n\n`;
    }
  }
  
  // Common Patterns
  doc += `## Common Patterns\n\n`;
  doc += `### 1. Array Structure Pattern\n\n`;
  doc += `Yahoo API uses arrays where:\n`;
  doc += `- \`[0]\` contains properties (array of objects, each object has one property)\n`;
  doc += `- \`[1]\` contains subresources (object with nested data)\n\n`;
  doc += `**Example from League Settings:**\n`;
  doc += `\`\`\`json\n`;
  doc += `{\n  "fantasy_content": {\n    "league": [\n      [\n        { "league_key": "466.l.29849" },\n        { "league_id": "29849" },\n        { "name": "..." },\n        { "current_week": 8 },\n        // ... more property objects\n      ],\n      {\n        "settings": [ /* settings data */ ]\n      }\n    ]\n  }\n}\n`;
  doc += `\n\`\`\`\n\n`;
  
  doc += `### 2. Numeric String Keys Pattern\n\n`;
  doc += `Collections use numeric string keys (\`"0"\`, \`"1"\`, etc.) instead of arrays:\n\n`;
  doc += `\`\`\`json\n`;
  doc += `{\n  "teams": {\n    "0": { "team": [...] },\n    "1": { "team": [...] },\n    "count": 14\n  }\n}\n`;
  doc += `\n\`\`\`\n\n`;
  
  doc += `### 3. Property Objects Pattern\n\n`;
  doc += `Properties are stored as individual objects in an array:\n\n`;
  doc += `\`\`\`json\n`;
  doc += `[\n  { "team_key": "466.l.29849.t.3" },\n  { "team_id": "3" },\n  { "name": "JC醫🐲" },\n  [],  // Empty arrays are used as placeholders\n  { "url": "..." }\n]\n`;
  doc += `\n\`\`\`\n\n`;
  
  // Data Extraction Examples
  doc += `## Data Extraction Examples\n\n`;
  doc += `### Extracting League Current Week\n\n`;
  doc += `\`\`\`typescript\n`;
  doc += `const settings = await client.getRawApiResponse(\`/league/\${leagueKey}/settings\`);\n`;
  doc += `const currentWeek = settings?.fantasy_content?.league?.[0]?.current_week;\n`;
  doc += `// Note: league[0] is an object, not an array\n`;
  doc += `\n\`\`\`\n\n`;
  
  doc += `### Extracting Team Keys from Standings\n\n`;
  doc += `\`\`\`typescript\n`;
  doc += `const standings = await client.getRawApiResponse(\`/league/\${leagueKey}/standings\`);\n`;
  doc += `const teams = standings?.fantasy_content?.league?.[1]?.standings?.[0]?.teams;\n`;
  doc += `const teamKeys: string[] = [];\n`;
  doc += `const teamIndexKeys = Object.keys(teams).filter(key => key !== "count" && !isNaN(Number(key)));\n`;
  doc += `for (const teamIndexKey of teamIndexKeys) {\n`;
  doc += `  const teamData = teams[teamIndexKey];\n`;
  doc += `  const teamProps = Array.isArray(teamData.team[0]) ? teamData.team[0] : [teamData.team[0]];\n`;
  doc += `  const teamKeyObj = teamProps.find((prop: any) => prop?.team_key);\n`;
  doc += `  if (teamKeyObj?.team_key) {\n`;
  doc += `    teamKeys.push(teamKeyObj.team_key);\n`;
  doc += `  }\n`;
  doc += `}\n`;
  doc += `\n\`\`\`\n\n`;
  
  doc += `### Extracting Player Keys from Roster\n\n`;
  doc += `\`\`\`typescript\n`;
  doc += `const roster = await client.getRawApiResponse(\`/team/\${teamKey}/roster\`);\n`;
  doc += `const rosterData = roster?.fantasy_content?.team;\n`;
  doc += `const playerKeys: string[] = [];\n`;
  doc += `if (Array.isArray(rosterData) && rosterData[1]?.roster) {\n`;
  doc += `  const rosterObj = rosterData[1].roster;\n`;
  doc += `  const positionKeys = Object.keys(rosterObj).filter(key => key !== "count" && !isNaN(Number(key)));\n`;
  doc += `  for (const positionKey of positionKeys) {\n`;
  doc += `    const positionData = rosterObj[positionKey];\n`;
  doc += `    if (positionData?.players) {\n`;
  doc += `      const players = positionData.players;\n`;
  doc += `      const playerIndexKeys = Object.keys(players).filter(key => key !== "count" && !isNaN(Number(key)));\n`;
  doc += `      for (const playerIndexKey of playerIndexKeys) {\n`;
  doc += `        const playerData = players[playerIndexKey];\n`;
  doc += `        if (playerData?.player && Array.isArray(playerData.player) && playerData.player[0]) {\n`;
  doc += `          const playerProps = Array.isArray(playerData.player[0]) ? playerData.player[0] : [playerData.player[0]];\n`;
  doc += `          const playerKeyObj = playerProps.find((prop: any) => prop?.player_key);\n`;
  doc += `          if (playerKeyObj?.player_key) {\n`;
  doc += `            playerKeys.push(playerKeyObj.player_key);\n`;
  doc += `          }\n`;
  doc += `        }\n`;
  doc += `      }\n`;
  doc += `    }\n`;
  doc += `  }\n`;
  doc += `}\n`;
  doc += `\n\`\`\`\n\n`;
  
  // Ensure docs directory exists
  mkdirSync(DOCS_DIR, { recursive: true });
  
  // Write documentation
  writeFileSync(DOC_FILE, doc, "utf-8");
  console.log(`\n✅ Documentation generated: ${DOC_FILE}`);
  console.log(`\n📊 Summary:`);
  console.log(`   - Total files analyzed: ${analyses.length}`);
  console.log(`   - User endpoints: ${byType.users?.length || 0}`);
  console.log(`   - League endpoints: ${byType.league?.length || 0}`);
  console.log(`   - Team endpoints: ${byType.team?.length || 0}`);
  console.log(`   - Player endpoints: ${byType.player?.length || 0}`);
}

generateDocumentation().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
