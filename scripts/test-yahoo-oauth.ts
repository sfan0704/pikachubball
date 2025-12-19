// Load environment variables
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { storage } from "../server/storage";
import { getAuthorizationUrl, generateState } from "../server/yahoo-auth";
import { env } from "../server/config/env";

async function testOAuth() {
  console.log("🧪 Testing Yahoo OAuth Setup...\n");

  // Check credentials
  if (!env.YAHOO_CLIENT_ID || !env.YAHOO_CLIENT_SECRET) {
    console.error("❌ YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET must be set in .env.local");
    process.exit(1);
  }

  console.log("✅ Yahoo credentials found in .env.local");
  console.log(`   Client ID: ${env.YAHOO_CLIENT_ID.substring(0, 10)}...`);
  console.log(`   Client Secret: ${env.YAHOO_CLIENT_SECRET.substring(0, 10)}...\n`);

  // Check redirect URI
  const redirectUri = env.YAHOO_REDIRECT_URI || 
    (process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/yahoo/callback`
      : `https://localhost:${env.PORT}/api/auth/yahoo/callback`);

  console.log("✅ Redirect URI configured:");
  console.log(`   ${redirectUri}\n`);

  // Check if we have a test user
  const testUser = await storage.getUserByUsername("testuser");
  if (!testUser) {
    console.log("⚠️  Test user not found. Creating one...\n");
    // We can't create a user here without password hashing, so just note it
    console.log("   Please ensure testuser exists or use an existing user\n");
  } else {
    console.log(`✅ Test user found: testuser (ID: ${testUser.id})\n`);

    // Check if user has token
    const token = await storage.getYahooToken(testUser.id);
    if (token) {
      const expiresAt = new Date(token.expiresAt * 1000);
      const now = new Date();
      const isValid = expiresAt > now;
      console.log(`ℹ️  User has Yahoo token:`);
      console.log(`   Status: ${isValid ? "✅ Valid" : "❌ Expired"}`);
      console.log(`   Expires: ${expiresAt.toISOString()}\n`);
    } else {
      console.log("ℹ️  User doesn't have Yahoo token (needs to connect)\n");
    }
  }

  // Test generating auth URL
  console.log("🔄 Testing OAuth URL generation...\n");
  
  try {
    const state = generateState();
    const authUrl = getAuthorizationUrl(state, env.YAHOO_CLIENT_ID!);
    
    console.log("✅ OAuth URL generated successfully!\n");
    console.log("📋 Authorization URL:");
    console.log(`   ${authUrl}\n`);
    
    console.log("📝 Next steps to test OAuth:");
    console.log("   1. Make sure your server is running: npm run dev");
    console.log("   2. Make sure ngrok is running and YAHOO_REDIRECT_URI matches");
    console.log("   3. Update your Yahoo app's redirect URI to match:");
    console.log(`      ${redirectUri}`);
    console.log("   4. Login to your app at: http://localhost:5000");
    console.log("   5. Go to Settings and click 'Connect Yahoo Account'");
    console.log("   6. Complete the OAuth flow\n");
    
    console.log("🔗 Or test directly by visiting:");
    console.log(`   http://localhost:5000/api/auth/yahoo (while logged in)\n`);

  } catch (error: any) {
    console.error("❌ Failed to generate OAuth URL:");
    console.error(`   ${error.message}`);
    process.exit(1);
  }
}

testOAuth().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

