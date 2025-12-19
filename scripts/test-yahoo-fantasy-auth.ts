// Load environment variables
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { storage } from "../server/storage";
import { getYahooApiClient } from "../server/services/yahoo/yahoo-api-client";

async function testAuth() {
  console.log("🧪 Testing Yahoo Fantasy Authentication with direct API client...\n");

  // Get test user
  const username = "testuser";
  const user = await storage.getUserByUsername(username);
  
  if (!user) {
    console.error("❌ Test user not found. Please run: npm run create-test-user");
    process.exit(1);
  }

  console.log(`✅ Found test user: ${username} (ID: ${user.id})\n`);

  // Check if user has Yahoo token
  const token = await storage.getYahooToken(user.id);
  if (!token) {
    console.error("❌ Test user doesn't have a Yahoo token.");
    console.error("   Please login and connect your Yahoo account first.");
    console.error("   1. Login at http://localhost:5000");
    console.error("   2. Go to Settings and connect Yahoo account");
    process.exit(1);
  }

  console.log("✅ User has Yahoo token");
  console.log(`   Token expires at: ${new Date(token.expiresAt * 1000).toISOString()}\n`);

  // Test authentication
  console.log("🔄 Testing authentication with Yahoo API client...\n");
  
  try {
    const client = await getYahooApiClient(user.id);
    const games = await client.getUserGames();
    
    console.log("✅ Authentication test PASSED!\n");
    console.log("📊 Response data:");
    console.log(JSON.stringify(games, null, 2));
  } catch (error: any) {
    console.error("❌ Authentication test FAILED");
    console.error(`   Error: ${error.message}`);
    if (error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testAuth().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

