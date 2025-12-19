// Load environment variables
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import YahooFantasy from "yahoo-fantasy";
import { env } from "../server/config/env";

async function testInit() {
  console.log("🧪 Testing Yahoo Fantasy Library Initialization...\n");

  // Check if credentials are available
  if (!env.YAHOO_CLIENT_ID || !env.YAHOO_CLIENT_SECRET) {
    console.error("❌ YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET must be set in .env.local");
    process.exit(1);
  }

  console.log("✅ Found Yahoo credentials in .env.local");
  console.log(`   Client ID: ${env.YAHOO_CLIENT_ID.substring(0, 10)}...`);
  console.log(`   Client Secret: ${env.YAHOO_CLIENT_SECRET.substring(0, 10)}...\n`);

  // Get redirect URI
  function getRedirectUri(): string {
    if (env.YAHOO_REDIRECT_URI) {
      return env.YAHOO_REDIRECT_URI;
    }
    if (process.env.REPLIT_DEV_DOMAIN) {
      return `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/yahoo/callback`;
    }
    const port = env.PORT;
    return `https://localhost:${port}/api/auth/yahoo/callback`;
  }

  const redirectUri = getRedirectUri();
  console.log(`✅ Redirect URI: ${redirectUri}\n`);

  // Test library initialization
  console.log("🔄 Initializing YahooFantasy library...\n");

  try {
    const yf = new YahooFantasy(
      env.YAHOO_CLIENT_ID!,
      env.YAHOO_CLIENT_SECRET!,
      (newAccessToken, newRefreshToken) => {
        console.log("📝 Token refresh callback triggered");
        console.log(`   New access token: ${newAccessToken.substring(0, 20)}...`);
        console.log(`   New refresh token: ${newRefreshToken.substring(0, 20)}...`);
      },
      redirectUri
    );

    console.log("✅ YahooFantasy library initialized successfully!\n");
    console.log("📋 Library instance created with:");
    console.log("   - Client ID: ✓");
    console.log("   - Client Secret: ✓");
    console.log("   - Token callback: ✓");
    console.log("   - Redirect URI: ✓\n");

    console.log("ℹ️  Note: To test actual API calls, you need:");
    console.log("   1. A user with a valid Yahoo OAuth token");
    console.log("   2. Call yf.setUserToken(accessToken)");
    console.log("   3. Then you can call yf.user.games() or other methods\n");

    console.log("✅ Library initialization test PASSED!");
    console.log("   The yahoo-fantasy library is ready to use with your credentials.\n");

  } catch (error: any) {
    console.error("❌ Library initialization FAILED:");
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testInit().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

