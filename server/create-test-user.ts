import { storage } from "./storage";
import { hashPassword } from "./auth";
import { encrypt } from "./encryption";

async function createTestUser() {
  const username = "testuser";
  const password = "test123";
  
  console.log("Creating test user...");
  
  // Check if Yahoo credentials are available in environment
  if (!process.env.YAHOO_CLIENT_ID || !process.env.YAHOO_CLIENT_SECRET) {
    console.error("YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET must be set in environment");
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
    
    // Encrypt and save Yahoo credentials
    const encryptedClientId = encrypt(process.env.YAHOO_CLIENT_ID);
    const encryptedClientSecret = encrypt(process.env.YAHOO_CLIENT_SECRET);
    
    await storage.saveYahooCredentials({
      userId: user.id,
      encryptedClientId,
      encryptedClientSecret,
    });
    
    console.log("✅ Saved Yahoo credentials for test user");
    console.log("\nTest user credentials:");
    console.log(`  Username: ${username}`);
    console.log(`  Password: ${password}`);
    console.log("\nYou can now login and connect to Yahoo Fantasy!");
    
    process.exit(0);
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate")) {
      console.log("ℹ️  Test user already exists");
      
      // Try to get existing user and update credentials
      const user = await storage.getUserByUsername(username);
      if (user) {
        const encryptedClientId = encrypt(process.env.YAHOO_CLIENT_ID!);
        const encryptedClientSecret = encrypt(process.env.YAHOO_CLIENT_SECRET!);
        
        await storage.saveYahooCredentials({
          userId: user.id,
          encryptedClientId,
          encryptedClientSecret,
        });
        
        console.log("✅ Updated Yahoo credentials for existing test user");
        console.log("\nTest user credentials:");
        console.log(`  Username: ${username}`);
        console.log(`  Password: ${password}`);
      }
      process.exit(0);
    }
    
    console.error("Error creating test user:", error);
    process.exit(1);
  }
}

createTestUser();
