import type { UserLeague } from "@shared/api/leagues";

interface LeagueHeaderProps {
  league: UserLeague;
  /** The user's team name, once a table has loaded; the key until then. */
  teamName: string | null;
}

/** Always says which season, league and team the screen is about. */
export function LeagueHeader({ league, teamName }: LeagueHeaderProps) {
  return (
    <div className="space-y-1" data-testid="league-header">
      <h2 className="text-2xl md:text-3xl font-bold">{league.name}</h2>
      <p className="text-sm md:text-base text-muted-foreground">
        {league.season === null ? "Season unknown" : `${league.season} season`}
        {league.isFinished ? " (finished)" : ""} · {teamName ?? league.teamKey}
      </p>
    </div>
  );
}
