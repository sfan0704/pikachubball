import { z } from "zod";

/** Settings the Supabase sign-in flow needs. */
export interface HostedAuthConfig {
  readonly appOrigin: string;
  readonly supabaseUrl: string;
  readonly supabasePublishableKey: string;
  readonly secureCookies: boolean;
}

/** The Yahoo app's credentials, used to refresh and revoke Yahoo tokens. */
export interface YahooAppConfig {
  readonly clientId: string | null;
  readonly clientSecret: string | null;
  /** Sent as redirect_uri when refreshing tokens. */
  readonly providerRedirectUri: string | null;
}

/** All server configuration, parsed once at startup. */
export interface AppConfig {
  readonly nodeEnv: "development" | "production" | "test";
  readonly port: number;
  readonly trustProxy: boolean;
  /** The deployed commit, sent on every response so an old browser tab can tell it is out of date. */
  readonly buildId: string;
  readonly auth: HostedAuthConfig;
  /** 64 hex characters: the key for new token writes. */
  readonly encryptionKey: string;
  /** Version recorded with tokens written under `encryptionKey`; raised by one at each rotation. */
  readonly encryptionKeyVersion: number;
  /** The previous key (version - 1), set only while a key rotation is under way. */
  readonly encryptionKeyPrevious: string | null;
  readonly yahoo: YahooAppConfig;
}

const hexKey = z
  .string()
  .regex(/^[a-fA-F0-9]{64}$/, "must be exactly 64 hex characters (32 bytes)");

const optionalTrimmed = z
  .string()
  .optional()
  .transform((value) => (value?.trim() ? value.trim() : null));

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  VERCEL_GIT_COMMIT_SHA: optionalTrimmed,
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  APP_ORIGIN: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1, "is required"),
  ENCRYPTION_KEY: hexKey,
  ENCRYPTION_KEY_VERSION: z.coerce.number().int().min(1).max(32767).default(1),
  ENCRYPTION_KEY_PREVIOUS: hexKey.optional(),
  YAHOO_CLIENT_ID: optionalTrimmed,
  YAHOO_CLIENT_SECRET: optionalTrimmed,
  YAHOO_PROVIDER_REDIRECT_URI: z
    .string()
    .url()
    .optional()
    .transform((value) => value ?? null),
});

/** An origin with no credentials, path, query or fragment; HTTPS except loopback outside production. */
function parseOrigin(value: string, name: string, allowLoopback: boolean): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL`);
  }
  const loopback =
    allowLoopback &&
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !loopback) {
    throw new Error(`${name} must use HTTPS`);
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error(`${name} must be an origin without credentials or a path`);
  }
  return url.origin;
}

/**
 * Parses and validates the configuration once. Throws a single error naming
 * every problem, so the app refuses to start on bad configuration.
 */
export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.safeParse(environment);
  if (!parsed.success) {
    const problems = parsed.error.errors.map((issue) => `${issue.path.join(".")} ${issue.message}`);
    throw new Error(`Invalid configuration: ${problems.join("; ")}`);
  }
  const values = parsed.data;
  const production = values.NODE_ENV === "production";

  if (values.ENCRYPTION_KEY_PREVIOUS && values.ENCRYPTION_KEY_VERSION < 2) {
    throw new Error(
      "Invalid configuration: ENCRYPTION_KEY_PREVIOUS needs ENCRYPTION_KEY_VERSION of 2 or more"
    );
  }

  const publishableKey = values.SUPABASE_PUBLISHABLE_KEY;
  if (
    production &&
    !publishableKey.startsWith("sb_publishable_") &&
    !publishableKey.startsWith("eyJ")
  ) {
    throw new Error("Invalid configuration: SUPABASE_PUBLISHABLE_KEY has an unsupported format");
  }

  return {
    nodeEnv: values.NODE_ENV,
    port: values.PORT,
    trustProxy: production || values.TRUST_PROXY,
    buildId: values.VERCEL_GIT_COMMIT_SHA ?? "development",
    auth: {
      appOrigin: parseOrigin(
        values.APP_ORIGIN ?? "http://localhost:5000",
        "APP_ORIGIN",
        !production
      ),
      supabaseUrl: parseOrigin(
        values.SUPABASE_URL ?? "http://127.0.0.1:54321",
        "SUPABASE_URL",
        !production
      ),
      supabasePublishableKey: publishableKey,
      secureCookies: production,
    },
    encryptionKey: values.ENCRYPTION_KEY,
    encryptionKeyVersion: values.ENCRYPTION_KEY_VERSION,
    encryptionKeyPrevious: values.ENCRYPTION_KEY_PREVIOUS ?? null,
    yahoo: {
      clientId: values.YAHOO_CLIENT_ID,
      clientSecret: values.YAHOO_CLIENT_SECRET,
      providerRedirectUri: values.YAHOO_PROVIDER_REDIRECT_URI,
    },
  };
}
