import type { UserLeague } from "@shared/api/leagues";
import type { TeamTable } from "@shared/domain";
import type { Selection } from "./selection";
import { optionFor, scopeOptions } from "./scope-options";

interface LeagueControlsProps {
  selection: Selection;
  leagues: readonly UserLeague[];
  /** Any loaded table for this league, to know the current week and the teams. */
  table: TeamTable | undefined;
  onSelect: (change: Partial<Selection>) => void;
}

const SELECT_CLASS =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring";

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-[160px]">
      <label htmlFor={id} className="mb-1 block text-xs md:text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function LeagueSelect({
  leagues,
  value,
  onChange,
}: {
  leagues: readonly UserLeague[];
  value: string;
  onChange: (leagueKey: string) => void;
}) {
  return (
    <Field id="league-select" label="League">
      <select
        id="league-select"
        className={SELECT_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {leagues.map((league) => (
          <option key={league.leagueKey} value={league.leagueKey}>
            {league.name}
            {league.season ? ` (${league.season})` : ""}
            {league.isFinished ? " – finished" : ""}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** League, time period and team ("viewing as") pickers; plain selects so they work with any keyboard or screen reader. */
export function LeagueControls({ selection, leagues, table, onSelect }: LeagueControlsProps) {
  const options = scopeOptions(table?.settings.currentWeek ?? null);
  const scope = optionFor(selection.scope, options);
  const shownOptions = options.some((option) => option.value === scope.value)
    ? options
    : [...options, scope];
  const chooseScope = (value: string) =>
    onSelect({ scope: shownOptions.find((option) => option.value === value)?.scope });

  return (
    <div className="flex flex-col gap-3 md:flex-row">
      {leagues.length > 1 && (
        <LeagueSelect
          leagues={leagues}
          value={selection.leagueKey}
          onChange={(leagueKey) => onSelect({ leagueKey })}
        />
      )}
      <Field id="scope-select" label="Time period">
        <select
          id="scope-select"
          className={SELECT_CLASS}
          value={scope.value}
          onChange={(event) => chooseScope(event.target.value)}
        >
          {shownOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
      {table && (
        <Field id="team-select" label="Viewing as">
          <select
            id="team-select"
            className={SELECT_CLASS}
            value={selection.teamKey}
            onChange={(event) => onSelect({ teamKey: event.target.value })}
          >
            {table.teams.map((team) => (
              <option key={team.teamKey} value={team.teamKey}>
                {team.teamName}
              </option>
            ))}
          </select>
        </Field>
      )}
    </div>
  );
}
