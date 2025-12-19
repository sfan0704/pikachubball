// Load environment variables
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { storage } from "../server/storage";
import { hashPassword } from "../server/config/auth";
import { env } from "../server/config/env";

async function createTestUser() {
  const username = "testuser";
  const password = "test123";
  
  console.log("Creating test user...");
  
  // Check if Yahoo credentials are available in environment
  if (!env.YAHOO_CLIENT_ID || !env.YAHOO_CLIENT_SECRET) {
    console.error("YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET must be set in .env.local");
    process.exit(1);
  }
  
  try {
    // Create user
    const hashedPassword = await hashPassword(password);
    const user = await storage.createUser({
      username,
      password: hashedPassword,
    });
    
    console.log(`✅ Created user: ${username} (ID: ${user.id})`);
    console.log("\nTest user credentials:");
    console.log(`  Username: ${username}`);
    console.log(`  Password: ${password}`);
    console.log("\nYou can now login and connect to Yahoo Fantasy!");
    console.log("Note: Yahoo credentials are configured at the app level in .env.local");
    
    process.exit(0);
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate")) {
      console.log("ℹ️  Test user already exists");
      const user = await storage.getUserByUsername(username);
      if (user) {
        console.log("\nTest user credentials:");
        console.log(`  Username: ${username}`);
        console.log(`  Password: ${password}`);
        console.log("\nNote: Yahoo credentials are configured at the app level in .env.local");
      }
      process.exit(0);
    }
    
    console.error("Error creating test user:", error);
    process.exit(1);
  }
}

createTestUser();
