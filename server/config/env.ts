import { z } from "zod";

/**
 * Environment variable schema validation
 * Validates all required environment variables on startup
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().transform(Number).default("5000"),
  ENCRYPTION_KEY: z.string().regex(
    /^[a-fA-F0-9]{64}$/,
    "ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)",
  ),
  // Server-only Yahoo credentials used to refresh Fantasy API access.
  YAHOO_CLIENT_ID: z.string().optional(),
  YAHOO_CLIENT_SECRET: z.string().optional(),
  YAHOO_PROVIDER_REDIRECT_URI: z.string().url().optional(),
  // Vercel and local reverse-proxy support.
  TRUST_PROXY: z.string().optional().transform((val) => val === "true"),
});

/**
 * Validated environment variables
 * Throws error on startup if validation fails
 */
export const env = (() => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // In test environment, don't exit - throw error instead
      const nodeEnv = process.env.NODE_ENV || 'development';
      if (nodeEnv === 'test') {
        throw new Error(
          `Environment variable validation failed: ${error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ")}`
        );
      }
      console.error("❌ Environment variable validation failed:");
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      console.error("\nPlease check your .env.local file and ensure all required variables are set.");
      process.exit(1);
    }
    throw error;
  }
})();

/**
 * Type-safe environment variable access
 */
export type Env = z.infer<typeof envSchema>;
