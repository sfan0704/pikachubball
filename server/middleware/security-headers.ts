import type { NextFunction, Request, Response } from "express";

/**
 * Only the app's own origin may supply anything. Inline styles are allowed
 * because React sets style attributes and Radix injects a style element; scripts
 * stay strictly same-origin, with no inline code and no eval.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/**
 * Headers for every response. vercel.json repeats them for the files Vercel's
 * CDN serves itself (a test keeps the two identical).
 */
export const SECURITY_HEADERS = {
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "X-Frame-Options": "DENY",
} as const;

/** Headers that must not be sent while developing against the Vite dev server over http. */
const PRODUCTION_ONLY = new Set(["Content-Security-Policy", "Strict-Transport-Security"]);

/**
 * Sets the security headers on every response. In development the Content
 * Security Policy and HSTS are left off, because Vite's dev server needs inline
 * scripts and a websocket, and the page is served over local http or a local certificate.
 */
export function createSecurityHeaders({ development }: { development: boolean }) {
  const headers = Object.entries(SECURITY_HEADERS).filter(
    ([name]) => !(development && PRODUCTION_ONLY.has(name))
  );
  return function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
    for (const [name, value] of headers) {
      res.setHeader(name, value);
    }
    next();
  };
}
