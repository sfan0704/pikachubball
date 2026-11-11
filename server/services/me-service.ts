import type { Features, MeResponse, Preferences } from "../../shared/api/account";
import type { RequestContext } from "../http/request-context";

/** The signed-in user, whether Yahoo is connected, their saved choices and the wired features. */
export async function getMe(
  { user, storage }: RequestContext,
  features: Features
): Promise<MeResponse> {
  const [token, preferences] = await Promise.all([
    storage.getYahooToken(user.userId),
    storage.getPreferences(),
  ]);
  return {
    user: { id: user.userId, displayName: user.displayName, email: user.email },
    yahoo: { connected: token !== undefined },
    preferences,
    features,
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
