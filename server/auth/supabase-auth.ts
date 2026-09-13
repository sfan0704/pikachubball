import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { parse, serialize } from "cookie";
import type { Request, Response } from "express";

export const AUTH_COOKIE_NAME = "pikachubball-auth";
export const YAHOO_PROVIDER = "custom:yahoo";
export const YAHOO_ISSUER = "https://api.login.yahoo.com";
export const AUTH_NO_STORE_HEADERS = Object.freeze({
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
});

export interface HostedAuthConfig {
  appOrigin: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  secureCookies: boolean;
}

export interface YahooSessionIdentity {
  userId: string;
  yahooGuid: string;
  displayName: string | null;
  email: string | null;
}

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
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error(`${name} must be an origin without credentials or a path`);
  }
  return url.origin;
}

export function readHostedAuthConfig(
  environment: NodeJS.ProcessEnv = process.env,
): HostedAuthConfig {
  const production = environment.NODE_ENV === "production";
  const appOrigin = parseOrigin(
    environment.APP_ORIGIN ?? "http://localhost:5000",
    "APP_ORIGIN",
    !production,
  );
  const supabaseUrl = parseOrigin(
    environment.SUPABASE_URL ?? "http://127.0.0.1:54321",
    "SUPABASE_URL",
    !production,
  );
  const supabasePublishableKey = environment.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabasePublishableKey) {
    throw new Error("SUPABASE_PUBLISHABLE_KEY is required");
  }
  if (
    production &&
    !supabasePublishableKey.startsWith("sb_publishable_") &&
    !supabasePublishableKey.startsWith("eyJ")
  ) {
    throw new Error("SUPABASE_PUBLISHABLE_KEY has an unsupported format");
  }

  return {
    appOrigin,
    supabaseUrl,
    supabasePublishableKey,
    secureCookies: production,
  };
}

export function hardenCookieOptions(
  options: CookieOptions,
  secure: boolean,
): CookieOptions {
  const { domain: _discardedDomain, ...safeOptions } = options;
  return {
    ...safeOptions,
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  };
}

export function applyAuthNoStore(res: Response): void {
  res.set(AUTH_NO_STORE_HEADERS);
}

export function createSupabaseRequestClient(
  req: Request,
  res: Response,
  environment: NodeJS.ProcessEnv = process.env,
): SupabaseClient {
  const config = readHostedAuthConfig(environment);
  const incomingCookies = parse(req.headers.cookie ?? "");

  return createServerClient(
    config.supabaseUrl,
    config.supabasePublishableKey,
    {
      cookieOptions: { name: AUTH_COOKIE_NAME },
      cookies: {
        getAll() {
          return Object.entries(incomingCookies).flatMap(([name, value]) =>
            value === undefined ? [] : [{ name, value }],
          );
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            res.append(
              "Set-Cookie",
              serialize(name, value, hardenCookieOptions(options, config.secureCookies)),
            );
          }
        },
      },
    },
  );
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Yahoo identity is missing ${field}`);
  }
  return value;
}

export function projectYahooIdentity(user: User): YahooSessionIdentity {
  const identity = user.identities?.find(
    (candidate) => candidate.provider === YAHOO_PROVIDER,
  );
  if (!identity) {
    throw new Error("Authenticated session is not a Yahoo identity");
  }

  const identityData = identity.identity_data ?? {};
  const issuer = identityData.iss;
  if (issuer !== undefined && issuer !== YAHOO_ISSUER) {
    throw new Error("Yahoo identity issuer does not match");
  }

  return {
    userId: requiredString(user.id, "Supabase subject"),
    yahooGuid: requiredString(identityData.sub, "provider subject"),
    displayName:
      typeof identityData.name === "string" ? identityData.name : null,
    email: typeof user.email === "string" ? user.email : null,
  };
}

export function requireYahooProviderTokens(session: Session): {
  accessToken: string;
  refreshToken: string;
} {
  return {
    accessToken: requiredString(session.provider_token, "provider access token"),
    refreshToken: requiredString(
      session.provider_refresh_token,
      "provider refresh token",
    ),
  };
}

export async function readVerifiedYahooIdentity(
  client: SupabaseClient,
): Promise<YahooSessionIdentity> {
  const { data: claimsData, error: claimsError } = await client.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) {
    throw new Error("Supabase session claims are invalid");
  }

  const { data, error } = await client.auth.getUser();
  if (error || !data.user || data.user.id !== claimsData.claims.sub) {
    throw new Error("Supabase session user is invalid");
  }
  return projectYahooIdentity(data.user);
}
