import { z } from "zod";
import { meResponseSchema, preferencesSchema, type Preferences } from "@shared/api/account";
import type { LeagueScope } from "@shared/api/league-scope";
import { leaguesResponseSchema, rosterResponseSchema } from "@shared/api/leagues";
import { teamTableSchema } from "@shared/api/team-table";
import { apiRequest } from "./http";

const signOutSchema = z.object({ success: z.literal(true) });
const removalSchema = z.object({ revokedAtYahoo: z.boolean() });

/** `GET /api/me` */
export const getMe = (signal?: AbortSignal) => apiRequest("/api/me", meResponseSchema, { signal });

/** `PUT /api/me/preferences` */
export const savePreferences = (preferences: Preferences) =>
  apiRequest("/api/me/preferences", preferencesSchema, { method: "PUT", body: preferences });

/** `GET /api/leagues`, replaced from Yahoo first when `refresh` is true. */
export const getLeagues = (refresh = false, signal?: AbortSignal) =>
  apiRequest(`/api/leagues${refresh ? "?refresh=true" : ""}`, leaguesResponseSchema, { signal });

/** `GET /api/leagues/:key/:scope` */
export const getLeagueScope = (leagueKey: string, scope: LeagueScope, signal?: AbortSignal) =>
  apiRequest(`/api/leagues/${encodeURIComponent(leagueKey)}/${scope}`, teamTableSchema, { signal });

/** `GET /api/leagues/:key/teams/:team/roster` */
export const getRoster = (leagueKey: string, teamKey: string, signal?: AbortSignal) =>
  apiRequest(
    `/api/leagues/${encodeURIComponent(leagueKey)}/teams/${encodeURIComponent(teamKey)}/roster`,
    rosterResponseSchema,
    { signal }
  );

/** `DELETE /api/me/yahoo` */
export const disconnectYahoo = () =>
  apiRequest("/api/me/yahoo", removalSchema, { method: "DELETE" });

/** `DELETE /api/me` */
export const deleteAccount = () => apiRequest("/api/me", removalSchema, { method: "DELETE" });

/** `POST /api/auth/logout` */
export const signOut = () =>
  apiRequest("/api/auth/logout", signOutSchema, { method: "POST", body: {} });
