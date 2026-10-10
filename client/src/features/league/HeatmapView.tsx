import { useMemo } from "react";
import type { TeamTable } from "@shared/domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { buildHeatmapRows, type HeatmapRowModel } from "./rankings-model";

function HeatmapRowView({ row }: { row: HeatmapRowModel }) {
  return (
    <TableRow
      className={row.isMine ? "font-medium" : ""}
      data-testid={`row-heatmap-${row.teamKey}`}
    >
      <TableCell>
        {row.teamName}
        {row.isMine && <span className="ml-1 text-primary">(you)</span>}
      </TableCell>
      {row.cells.map((cell) => (
        <TableCell
          key={cell.key}
          className="text-center"
          style={{ backgroundColor: `hsl(var(--primary) / ${(cell.intensity * 0.6).toFixed(2)})` }}
        >
          {cell.text}
          {cell.rank !== null && <span className="block text-xs">({cell.rank})</span>}
        </TableCell>
      ))}
    </TableRow>
  );
}

/** Every team's total and rank in every category, shaded by how strong it is. */
export function HeatmapView({ table, myTeamKey }: { table: TeamTable; myTeamKey: string }) {
  const rows = useMemo(() => buildHeatmapRows(table, myTeamKey), [table, myTeamKey]);
  return (
    <Card data-testid="card-heatmap">
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-xl md:text-2xl">Category heatmap</CardTitle>
        <p className="text-xs md:text-sm text-muted-foreground">
          Darker is stronger in that category. Each cell shows the total and, in brackets, the
          team's rank.
        </p>
      </CardHeader>
      <CardContent className="p-0 md:p-6">
        <div className="overflow-x-auto">
          <Table label="Heatmap table" className="text-xs md:text-sm">
            <caption className="sr-only">Category totals and ranks by team</caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="min-w-[140px]">
                  Team
                </TableHead>
                {CATEGORIES.map((key) => (
                  <TableHead key={key} scope="col" className="text-center min-w-[72px]">
                    {CATEGORY_LABELS[key]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <HeatmapRowView key={row.teamKey} row={row} />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
