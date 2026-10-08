import type { MeResponse, Preferences } from "../../shared/api/account";
import type { RequestContext } from "../http/request-context";

/** The signed-in user, whether Yahoo is connected, and their saved choices. */
export async function getMe({ user, storage }: RequestContext): Promise<MeResponse> {
  const [token, preferences] = await Promise.all([
    storage.getYahooToken(user.userId),
    storage.getPreferences(),
  ]);
  return {
    user: { id: user.userId, displayName: user.displayName, email: user.email },
    yahoo: { connected: token !== undefined },
    preferences,
  };
}

/** Saves the user's choices and returns what is now stored. */
export async function savePreferences(
  { storage }: Pick<RequestContext, "storage">,
  preferences: Preferences
): Promise<Preferences> {
  await storage.savePreferences(preferences);
  return storage.getPreferences();
}
