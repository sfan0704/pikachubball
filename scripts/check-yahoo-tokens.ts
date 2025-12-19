// Load environment variables
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { storage } from "../server/storage";

async function checkTokens() {
  console.log("🔍 Checking for users with Yahoo tokens...\n");

  try {
    // Get test user
    const testUser = await storage.getUserByUsername("testuser");
    
    if (testUser) {
      const token = await storage.getYahooToken(testUser.id);
      if (token) {
        const expiresAt = new Date(token.expiresAt * 1000);
        const now = new Date();
        const isValid = expiresAt > now;
        
        console.log("✅ Found Yahoo token for testuser:");
        console.log(`   User ID: ${testUser.id}`);
        console.log(`   Token expires: ${expiresAt.toISOString()}`);
        console.log(`   Status: ${isValid ? "✅ Valid" : "❌ Expired"}`);
        console.log(`   Time until expiry: ${Math.floor((expiresAt.getTime() - now.getTime()) / 1000 / 60)} minutes\n`);
        
        if (isValid) {
          console.log("🎉 You can now test authentication!");
          console.log("   Run: npm run test:yahoo-auth\n");
        } else {
          console.log("⚠️  Token is expired. Please reconnect your Yahoo account.\n");
        }
      } else {
        console.log("❌ testuser doesn't have a Yahoo token yet.");
        console.log("   To get a token:");
        console.log("   1. Login at http://localhost:5000");
        console.log("   2. Go to Settings");
        console.log("   3. Connect your Yahoo account\n");
      }
    } else {
      console.log("❌ testuser not found. Run: npm run create-test-user\n");
    }
  } catch (error: any) {
    console.error("Error checking tokens:", error.message);
    process.exit(1);
  }
}

checkTokens();

