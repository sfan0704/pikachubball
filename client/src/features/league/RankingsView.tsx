import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { TeamTable } from "@shared/domain";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CATEGORY_LABELS } from "./categories";
import { CATEGORIES } from "@shared/domain";
import {
  buildRankingsRows,
  defaultDirection,
  type RankingsMode,
  type RankingsRow,
  type SortDirection,
  type SortKey,
  type Tone,
} from "./rankings-model";

const TONE_CLASS: Record<Tone, string> = {
  good: "text-green-700 dark:text-green-400",
  middle: "text-yellow-700 dark:text-yellow-400",
  poor: "text-red-700 dark:text-red-400",
  unknown: "text-muted-foreground",
};

function positionLabel(position: number | null): string {
  if (position === null) {
    return "—";
  }
  const suffix = position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "";
  return `${position}${suffix}`;
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: SortKey;
  sort: { key: SortKey; direction: SortDirection };
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === column;
  const Icon = !active ? ChevronsUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      scope="col"
      className="text-center min-w-[60px]"
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        className="inline-flex min-h-[44px] items-center justify-center gap-1 px-1"
        onClick={() => onSort(column)}
        data-testid={`sort-${column}`}
      >
        {label}
        <Icon className={`h-3 w-3 ${active ? "" : "opacity-40"}`} aria-hidden="true" />
      </button>
    </TableHead>
  );
}

function RankingsRowView({ row }: { row: RankingsRow }) {
  return (
    <TableRow
      className={row.isMine ? "bg-primary/5 font-medium" : ""}
      data-testid={`row-ranking-${row.teamKey}`}
    >
      <TableCell>
        <Badge variant={row.position === 1 ? "default" : "outline"}>
          {positionLabel(row.position)}
        </Badge>
      </TableCell>
      <TableCell>
        <span className="line-clamp-1">
          {row.teamName}
          {row.isMine && <span className="ml-1 text-primary">(you)</span>}
        </span>
        {row.managerName && (
          <span className="block text-xs font-normal text-muted-foreground">{row.managerName}</span>
        )}
      </TableCell>
      {row.cells.map((cell) => (
        <TableCell key={cell.key} className={`text-center ${TONE_CLASS[cell.tone]}`}>
          {cell.text}
        </TableCell>
      ))}
      <TableCell className="text-center font-semibold bg-muted/50">{row.sumText}</TableCell>
    </TableRow>
  );
}

function RankingsHeading({
  totals,
  onChange,
}: {
  totals: boolean;
  onChange: (totals: boolean) => void;
}) {
  return (
    <CardHeader className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="text-xl md:text-2xl">9-category rankings</CardTitle>
          <p className="text-xs md:text-sm text-muted-foreground">
            Ordered by the sum of each team's category ranks. This is not Yahoo's official
            standings.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch id="rankings-mode" checked={totals} onCheckedChange={onChange} />
          <Label htmlFor="rankings-mode" className="text-sm cursor-pointer">
            {totals ? "Totals" : "Ranks"}
          </Label>
        </div>
      </div>
    </CardHeader>
  );
}

function useRankingsState(table: TeamTable, myTeamKey: string) {
  const [mode, setMode] = useState<RankingsMode>("ranks");
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "sum",
    direction: "asc",
  });
  const rows = useMemo(
    () => buildRankingsRows(table, myTeamKey, mode, sort),
    [table, myTeamKey, mode, sort]
  );
  const onSort = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: defaultDirection(mode, key) }
    );
  const changeMode = (totals: boolean) => {
    const next: RankingsMode = totals ? "totals" : "ranks";
    setMode(next);
    setSort({ key: sort.key, direction: defaultDirection(next, sort.key) });
  };
  return { mode, sort, rows, onSort, changeMode };
}

/** Season or weekly rankings from one team table: category ranks or totals, sortable. */
export function RankingsView({ table, myTeamKey }: { table: TeamTable; myTeamKey: string }) {
  const { mode, sort, rows, onSort, changeMode } = useRankingsState(table, myTeamKey);
  return (
    <Card data-testid="card-league-rankings">
      <RankingsHeading totals={mode === "totals"} onChange={changeMode} />
      <CardContent className="p-0 md:p-6">
        <div className="overflow-x-auto">
          <Table className="text-xs md:text-sm">
            <caption className="sr-only">Teams ranked by category rank sum</caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="w-16">
                  Place
                </TableHead>
                <TableHead scope="col" className="min-w-[140px]">
                  Team
                </TableHead>
                {CATEGORIES.map((key) => (
                  <SortHeader
                    key={key}
                    label={CATEGORY_LABELS[key]}
                    column={key}
                    sort={sort}
                    onSort={onSort}
                  />
                ))}
                <SortHeader
                  label="Category rank sum — lower is better"
                  column="sum"
                  sort={sort}
                  onSort={onSort}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <RankingsRowView key={row.teamKey} row={row} />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
