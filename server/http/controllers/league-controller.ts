import type { Request, Response } from "express";
import {
  leaguesQuerySchema,
  leaguesResponseSchema,
  rosterParamsSchema,
  rosterResponseSchema,
} from "../../../shared/api/leagues";
import { leagueScopeParamsSchema } from "../../../shared/api/league-scope";
import { teamTableSchema } from "../../../shared/api/team-table";
import { asyncHandler } from "../middleware/error-handler";
import type { ServerDependencies } from "../dependencies";
import { getRequestContext } from "../request-context";
import { getLeagueScope } from "../../services/league-scope-service";
import { getLeagueTeamRoster, listLeagues } from "../../services/leagues-service";

/** Thin HTTP adapter for the league endpoints. */
export function createLeagueController({
  createFantasyDataSource,
}: Pick<ServerDependencies, "createFantasyDataSource">) {
  return {
    /** `GET /api/leagues`: the stored leagues, replaced from Yahoo first when `refresh=true`. */
    listLeagues: asyncHandler(async (req: Request, res: Response) => {
      const query = leaguesQuerySchema.parse(req.query);
      const context = getRequestContext(req);
      const leagues = await listLeagues(
        context.storage,
        context.yahooClient,
        query.refresh === "true"
      );
      res.json(leaguesResponseSchema.parse({ leagues }));
    }),

    /** `GET /api/leagues/:key/teams/:team/roster` */
    getRoster: asyncHandler(async (req: Request, res: Response) => {
      const { key, team } = rosterParamsSchema.parse(req.params);
      const context = getRequestContext(req);
      const roster = await getLeagueTeamRoster(
        context.storage,
        context.yahooClient,
        key,
        team,
        context.clock
      );
      res.json(rosterResponseSchema.parse(roster));
    }),

    /** `GET /api/leagues/:key/:scope`: the team table for a season or week. */
    getLeagueScope: asyncHandler(async (req: Request, res: Response) => {
      const { key, scope } = leagueScopeParamsSchema.parse(req.params);
      const context = getRequestContext(req);
      const table = await getLeagueScope(
        context.storage,
        createFantasyDataSource(context.yahooClient),
        key,
        scope
      );
      res.json(teamTableSchema.parse(table));
    }),
  };
}
