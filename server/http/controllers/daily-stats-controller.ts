import type { Request, Response } from "express";
import type { z } from "zod";
import { NotFoundError } from "../../../shared/api/errors";
import {
  draftResponseSchema,
  gameLogsRequestSchema,
  gameLogsResponseSchema,
  leagueParamsSchema,
  playerListQuerySchema,
  playerListResponseSchema,
  playerStatsRequestSchema,
  playerStatsResponseSchema,
  scheduleResponseSchema,
  teamDayParamsSchema,
  teamDayResponseSchema,
  teamParamsSchema,
  transactionsResponseSchema,
  weeksResponseSchema,
} from "../../../shared/api/daily-stats";
import { asyncHandler } from "../middleware/error-handler";
import type { ServerDependencies } from "../dependencies";
import { getRequestContext } from "../request-context";
import * as dailyStats from "../../services/daily-stats-service";

type Access = dailyStats.DailyStatsAccess;

/** Thin HTTP adapter for the daily-stats dataset endpoints. */
export function createDailyStatsController({
  createDailyStatsSource,
}: Pick<ServerDependencies, "createDailyStatsSource">) {
  const accessFor = (req: Request): Access => {
    if (createDailyStatsSource === null) {
      throw new NotFoundError("Daily stats");
    }
    const { storage, clock, yahooClient, logger } = getRequestContext(req);
    return { storage, clock, source: createDailyStatsSource({ yahooClient, logger }) };
  };

  /** Runs one use case and sends its result, checked against the endpoint's response schema. */
  const endpoint = <S extends z.ZodTypeAny>(
    schema: S,
    run: (req: Request, access: Access) => Promise<z.input<S>>
  ) =>
    asyncHandler(async (req: Request, res: Response) => {
      res.json(schema.parse(await run(req, accessFor(req))));
    });

  return {
    /** `GET /api/leagues/:key/teams/:team/days/:date` */
    getTeamDay: endpoint(teamDayResponseSchema, (req, access) => {
      const { key, team, date } = teamDayParamsSchema.parse(req.params);
      return dailyStats.getTeamDay(access, key, team, date);
    }),
    /** `GET /api/leagues/:key/games?players=` */
    getGameLogs: endpoint(gameLogsResponseSchema, (req, access) => {
      const { key, players } = gameLogsRequestSchema.parse({ ...req.params, ...req.query });
      return dailyStats.getGameLogs(access, key, players);
    }),
    /** `GET /api/leagues/:key/player-stats/:period?players=` */
    getPlayerStats: endpoint(playerStatsResponseSchema, (req, access) => {
      const request = playerStatsRequestSchema.parse({ ...req.params, ...req.query });
      return dailyStats.getPlayerStats(access, request.key, request.period, request.players);
    }),
    /** `GET /api/leagues/:key/players` */
    listPlayers: endpoint(playerListResponseSchema, (req, access) => {
      const { key } = leagueParamsSchema.parse(req.params);
      return dailyStats.listPlayers(access, key, playerListQuerySchema.parse(req.query));
    }),
    /** `GET /api/leagues/:key/schedule` */
    getSchedule: endpoint(scheduleResponseSchema, (req, access) =>
      dailyStats.getSchedule(access, leagueParamsSchema.parse(req.params).key)
    ),
    /** `GET /api/leagues/:key/teams/:team/transactions` */
    getTransactions: endpoint(transactionsResponseSchema, (req, access) => {
      const { key, team } = teamParamsSchema.parse(req.params);
      return dailyStats.getTransactions(access, key, team);
    }),
    /** `GET /api/leagues/:key/draft` */
    getDraft: endpoint(draftResponseSchema, (req, access) =>
      dailyStats.getDraft(access, leagueParamsSchema.parse(req.params).key)
    ),
    /** `GET /api/leagues/:key/weeks` */
    getWeeks: endpoint(weeksResponseSchema, (req, access) =>
      dailyStats.getWeeks(access, leagueParamsSchema.parse(req.params).key)
    ),
  };
}
