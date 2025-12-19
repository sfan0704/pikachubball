// Load environment variables
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

/**
 * Test script to verify migration structure without requiring OAuth
 * This checks that all imports resolve and the code structure is correct
 */

async function testStructure() {
  console.log("🧪 Testing Migration Structure...\n");

  const tests: { name: string; passed: boolean; error?: string }[] = [];

  // Test 1: Verify yahoo-api-client can be imported
  try {
    await import("../server/services/yahoo/yahoo-api-client.js");
    tests.push({ name: "Import yahoo-api-client", passed: true });
  } catch (error: any) {
    tests.push({ name: "Import yahoo-api-client", passed: false, error: error.message });
  }

  // Test 2: Verify old yahoo-fantasy-service is removed
  try {
    await import("../server/services/yahoo/yahoo-fantasy-service.js");
    tests.push({ name: "yahoo-fantasy-service removed", passed: false, error: "yahoo-fantasy-service.ts still exists!" });
  } catch (error: any) {
    if (error.message.includes("Cannot find module")) {
      tests.push({ name: "yahoo-fantasy-service removed", passed: true });
    } else {
      tests.push({ name: "yahoo-fantasy-service removed", passed: false, error: error.message });
    }
  }

  // Test 3: Verify league service can be imported
  try {
    await import("../server/services/yahoo/league-service.js");
    tests.push({ name: "Import league-service", passed: true });
  } catch (error: any) {
    tests.push({ name: "Import league-service", passed: false, error: error.message });
  }

  // Test 4: Verify roster service can be imported
  try {
    await import("../server/services/yahoo/roster-service.js");
    tests.push({ name: "Import roster-service", passed: true });
  } catch (error: any) {
    tests.push({ name: "Import roster-service", passed: false, error: error.message });
  }

  // Test 5: Verify fantasy-data-source can be imported
  try {
    await import("../server/services/fantasy-data-source.js");
    tests.push({ name: "Import fantasy-data-source", passed: true });
  } catch (error: any) {
    tests.push({ name: "Import fantasy-data-source", passed: false, error: error.message });
  }

  // Test 6: Verify controllers can be imported
  try {
    await import("../server/controllers/yahooController.js");
    tests.push({ name: "Import yahooController", passed: true });
  } catch (error: any) {
    tests.push({ name: "Import yahooController", passed: false, error: error.message });
  }

  // Test 7: Verify middleware can be imported
  try {
    await import("../server/middleware/yahooAuth.js");
    tests.push({ name: "Import yahooAuth middleware", passed: true });
  } catch (error: any) {
    tests.push({ name: "Import yahooAuth middleware", passed: false, error: error.message });
  }

  // Test 8: Verify MCP client is removed
  try {
    await import("../server/mcp-client.js");
    tests.push({ name: "MCP client removed", passed: false, error: "mcp-client.ts still exists!" });
  } catch (error: any) {
    if (error.message.includes("Cannot find module")) {
      tests.push({ name: "MCP client removed", passed: true });
    } else {
      tests.push({ name: "MCP client removed", passed: false, error: error.message });
    }
  }

  // Test 9: Verify yahoo-parser is removed
  try {
    await import("../server/services/yahoo/yahoo-parser.js");
    tests.push({ name: "yahoo-parser removed", passed: false, error: "yahoo-parser.ts still exists!" });
  } catch (error: any) {
    if (error.message.includes("Cannot find module")) {
      tests.push({ name: "yahoo-parser removed", passed: true });
    } else {
      tests.push({ name: "yahoo-parser removed", passed: false, error: error.message });
    }
  }

  // Print results
  console.log("Test Results:\n");
  let passed = 0;
  let failed = 0;

  tests.forEach((test) => {
    if (test.passed) {
      console.log(`✅ ${test.name}`);
      passed++;
    } else {
      console.log(`❌ ${test.name}`);
      if (test.error) {
        console.log(`   Error: ${test.error}`);
      }
      failed++;
    }
  });

  console.log(`\n📊 Summary: ${passed} passed, ${failed} failed\n`);

  if (failed === 0) {
    console.log("✅ All structure tests passed!");
    console.log("\n📝 Next steps to test with real data:");
    console.log("   1. Deploy to a server with HTTPS (or use ngrok/localtunnel)");
    console.log("   2. Connect your Yahoo account via OAuth");
    console.log("   3. Test endpoints: /api/yahoo/test-auth, /api/yahoo/leagues");
    process.exit(0);
  } else {
    console.log("❌ Some tests failed. Please fix the issues above.");
    process.exit(1);
  }
}

testStructure().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

