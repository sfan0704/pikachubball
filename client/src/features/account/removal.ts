/** What removing something does at Yahoo, as reported by the API. */
export interface RemovalResult {
  revokedAtYahoo: boolean;
}

/** The two removals the Account dialog offers. */
export type RemovalKind = "disconnect" | "delete";

/** What a finished removal did, in words, including whether Yahoo confirmed the revocation. */
export function removalMessage(kind: RemovalKind, result: RemovalResult): string {
  const done = kind === "disconnect" ? "Yahoo disconnected." : "Account deleted.";
  return result.revokedAtYahoo
    ? `${done} Access was revoked at Yahoo.`
    : `${done} Yahoo did not confirm the revocation; to be sure, remove Pikachu Basketball from your Yahoo account's connected apps.`;
}

/** The sign-in page address that carries a finished removal, so the page can still report it. */
export function removalDestination(kind: RemovalKind, result: RemovalResult): string {
  const params = new URLSearchParams({ removed: kind, revoked: String(result.revokedAtYahoo) });
  return `/auth?${params.toString()}`;
}

/** The removal a sign-in page address reports, or null when it reports none or is malformed. */
export function removalFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const kind = params.get("removed");
  const revoked = params.get("revoked");
  if ((kind !== "disconnect" && kind !== "delete") || (revoked !== "true" && revoked !== "false")) {
    return null;
  }
  return removalMessage(kind, { revokedAtYahoo: revoked === "true" });
}
