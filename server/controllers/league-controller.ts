import type { Request, Response } from "express";
import { leagueScopeParamsSchema } from "../../shared/api/league-scope";
import { teamTableSchema } from "../../shared/api/team-table";
import { asyncHandler } from "../middleware/error-handler";
import type { ServerDependencies } from "../dependencies";
import { getRequestContext } from "../request-context";
import { getLeagueScope } from "../services/league-scope-service";

/** Thin HTTP adapter for the league endpoints. */
export function createLeagueController({
  createFantasyDataSource,
}: Pick<ServerDependencies, "createFantasyDataSource">) {
  return {
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
