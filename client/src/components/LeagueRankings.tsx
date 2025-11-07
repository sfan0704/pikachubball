import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TeamRanking } from "@shared/schema";
import { useState } from "react";

interface LeagueRankingsProps {
  rankings: TeamRanking[];
  userTeamKey?: string;
}

export default function LeagueRankings({ rankings, userTeamKey }: LeagueRankingsProps) {
  const [showStats, setShowStats] = useState(false);
  const getRankColor = (rank: number, total: number) => {
    const pct = rank / total;
    if (pct <= 0.33) return "text-green-600 dark:text-green-400";
    if (pct <= 0.66) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getMasterRankBadge = (index: number) => {
    if (index === 0) return <Badge className="bg-yellow-500 text-yellow-950">1st</Badge>;
    if (index === 1) return <Badge className="bg-gray-400 text-gray-950">2nd</Badge>;
    if (index === 2) return <Badge className="bg-orange-600 text-orange-950">3rd</Badge>;
    return <Badge variant="outline">{index + 1}</Badge>;
  };

  const formatStat = (key: keyof TeamRanking['stats'], value: number) => {
    if (key === 'fgPct' || key === 'ftPct') {
      return (value * 100).toFixed(1) + '%';
    }
    return value.toString();
  };

  return (
    <Card data-testid="card-league-rankings">
      <CardHeader className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
          <div className="min-w-0">
            <CardTitle data-testid="heading-rankings" className="text-xl md:text-2xl">
              9-Cat Master Rankings
            </CardTitle>
            <p className="text-xs md:text-sm text-muted-foreground">
              Teams ranked by average position across all 9 categories
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              id="view-toggle"
              checked={showStats}
              onCheckedChange={setShowStats}
              data-testid="switch-view-toggle"
            />
            <Label htmlFor="view-toggle" className="text-xs md:text-sm cursor-pointer">
              {showStats ? "Actual Stats" : "Rankings"}
            </Label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 md:p-6">
        <div className="overflow-x-auto">
          <Table className="text-xs md:text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-card w-12 md:w-16">Rank</TableHead>
                <TableHead className="sticky left-12 md:left-16 z-10 bg-card min-w-[120px] md:min-w-[160px]">Team</TableHead>
                <TableHead className="text-center min-w-[60px]">FG%</TableHead>
                <TableHead className="text-center min-w-[60px]">FT%</TableHead>
                <TableHead className="text-center min-w-[60px]">3PM</TableHead>
                <TableHead className="text-center min-w-[60px]">PTS</TableHead>
                <TableHead className="text-center min-w-[60px]">REB</TableHead>
                <TableHead className="text-center min-w-[60px]">AST</TableHead>
                <TableHead className="text-center min-w-[60px]">STL</TableHead>
                <TableHead className="text-center min-w-[60px]">BLK</TableHead>
                <TableHead className="text-center min-w-[60px]">TO</TableHead>
                <TableHead className="text-center min-w-[60px] bg-muted/50">Avg</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankings.map((team, index) => {
                const isUserTeam = team.teamKey === userTeamKey;
                return (
                  <TableRow
                    key={team.teamKey}
                    className={isUserTeam ? "bg-primary/5 font-medium" : ""}
                    data-testid={`row-ranking-${team.teamKey}`}
                  >
                    <TableCell className="sticky left-0 z-10 bg-card">{getMasterRankBadge(index)}</TableCell>
                    <TableCell className="sticky left-12 md:left-16 z-10 bg-card font-medium">
                      <span className="line-clamp-1">
                        {team.teamName}
                        {isUserTeam && <span className="ml-1 text-primary">★</span>}
                      </span>
                    </TableCell>
                    <TableCell className={`text-center ${!showStats ? getRankColor(team.categoryRanks.fgPct, rankings.length) : ''}`}>
                      {showStats ? formatStat('fgPct', team.stats.fgPct) : team.categoryRanks.fgPct}
                    </TableCell>
                    <TableCell className={`text-center ${!showStats ? getRankColor(team.categoryRanks.ftPct, rankings.length) : ''}`}>
                      {showStats ? formatStat('ftPct', team.stats.ftPct) : team.categoryRanks.ftPct}
                    </TableCell>
                    <TableCell className={`text-center ${!showStats ? getRankColor(team.categoryRanks.tpm, rankings.length) : ''}`}>
                      {showStats ? formatStat('tpm', team.stats.tpm) : team.categoryRanks.tpm}
                    </TableCell>
                    <TableCell className={`text-center ${!showStats ? getRankColor(team.categoryRanks.pts, rankings.length) : ''}`}>
                      {showStats ? formatStat('pts', team.stats.pts) : team.categoryRanks.pts}
                    </TableCell>
                    <TableCell className={`text-center ${!showStats ? getRankColor(team.categoryRanks.reb, rankings.length) : ''}`}>
                      {showStats ? formatStat('reb', team.stats.reb) : team.categoryRanks.reb}
                    </TableCell>
                    <TableCell className={`text-center ${!showStats ? getRankColor(team.categoryRanks.ast, rankings.length) : ''}`}>
                      {showStats ? formatStat('ast', team.stats.ast) : team.categoryRanks.ast}
                    </TableCell>
                    <TableCell className={`text-center ${!showStats ? getRankColor(team.categoryRanks.stl, rankings.length) : ''}`}>
                      {showStats ? formatStat('stl', team.stats.stl) : team.categoryRanks.stl}
                    </TableCell>
                    <TableCell className={`text-center ${!showStats ? getRankColor(team.categoryRanks.blk, rankings.length) : ''}`}>
                      {showStats ? formatStat('blk', team.stats.blk) : team.categoryRanks.blk}
                    </TableCell>
                    <TableCell className={`text-center ${!showStats ? getRankColor(team.categoryRanks.to, rankings.length) : ''}`}>
                      {showStats ? formatStat('to', team.stats.to) : team.categoryRanks.to}
                    </TableCell>
                    <TableCell className="text-center font-semibold bg-muted/50">
                      {team.totalRank.toFixed(1)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
