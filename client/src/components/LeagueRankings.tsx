import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TeamRanking, RankingsMetadata } from "@shared/schema";
import { useState, useMemo } from "react";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";

interface LeagueRankingsProps {
  rankings: TeamRanking[];
  metadata: RankingsMetadata;
  userTeamKey?: string;
}

type SortKey = 'fgPct' | 'ftPct' | 'tpm' | 'pts' | 'reb' | 'ast' | 'stl' | 'blk' | 'to' | 'totalRank';
type SortDirection = 'asc' | 'desc';

export default function LeagueRankings({ rankings, metadata, userTeamKey }: LeagueRankingsProps) {
  const [showStats, setShowStats] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('totalRank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      // When showing ranks (not stats), lower is always better, so default to asc
      // When showing stats, higher is better (except TO), so default to desc
      if (!showStats) {
        // Rankings view: lower rank numbers are better (always asc)
        setSortDirection('asc');
      } else {
        // Stats view: higher is better except for TO and totalRank (desc for most, asc for TO/totalRank)
        setSortDirection(key === 'to' || key === 'totalRank' ? 'asc' : 'desc');
      }
    }
  };

  const sortedRankings = useMemo(() => {
    const sorted = [...rankings].sort((a, b) => {
      let aValue: number;
      let bValue: number;

      if (sortBy === 'totalRank') {
        aValue = a.totalRank;
        bValue = b.totalRank;
      } else {
        aValue = showStats ? a.stats[sortBy] : a.categoryRanks[sortBy];
        bValue = showStats ? b.stats[sortBy] : b.categoryRanks[sortBy];
      }

      if (sortDirection === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
    return sorted;
  }, [rankings, sortBy, sortDirection, showStats]);

  const getRankColor = (rank: number, total: number) => {
    const pct = rank / total;
    if (pct <= 0.33) return "text-green-600 dark:text-green-400";
    if (pct <= 0.66) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getStatGradientColor = (key: SortKey, value: number, allTeams: TeamRanking[]) => {
    const values = allTeams.map(t => t.stats[key as keyof TeamRanking['stats']]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // For TO, lower is better (invert the gradient)
    const normalizedValue = key === 'to' 
      ? (max - value) / (max - min || 1)
      : (value - min) / (max - min || 1);
    
    // Create gradient from red (0) to yellow (0.5) to green (1)
    if (normalizedValue >= 0.66) {
      return "text-green-600 dark:text-green-400 font-medium";
    } else if (normalizedValue >= 0.33) {
      return "text-yellow-600 dark:text-yellow-400";
    } else {
      return "text-red-600 dark:text-red-400";
    }
  };

  // Pre-sort rankings by totalRank to get true master rank positions
  const masterRankOrder = useMemo(() => {
    return [...rankings].sort((a, b) => a.totalRank - b.totalRank);
  }, [rankings]);

  const getMasterRankBadge = (teamKey: string) => {
    const actualIndex = masterRankOrder.findIndex(r => r.teamKey === teamKey);
    if (actualIndex === 0) return <Badge className="bg-yellow-500 text-yellow-950">1st</Badge>;
    if (actualIndex === 1) return <Badge className="bg-gray-400 text-gray-950">2nd</Badge>;
    if (actualIndex === 2) return <Badge className="bg-orange-600 text-orange-950">3rd</Badge>;
    return <Badge variant="outline">{actualIndex + 1}</Badge>;
  };

  const formatStat = (key: keyof TeamRanking['stats'], value: number, team?: any) => {
    if (key === 'fgPct' && team?.fgMakes !== undefined) {
      return `${team.fgMakes}/${team.fgAttempts} (${(value * 100).toFixed(1)}%)`;
    }
    if (key === 'ftPct' && team?.ftMakes !== undefined) {
      return `${team.ftMakes}/${team.ftAttempts} (${(value * 100).toFixed(1)}%)`;
    }
    if (key === 'fgPct' || key === 'ftPct') {
      return (value * 100).toFixed(1) + '%';
    }
    return value.toString();
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortBy !== columnKey) {
      return <ChevronsUpDown className="ml-1 h-3 w-3 inline opacity-40" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-1 h-3 w-3 inline" />
      : <ArrowDown className="ml-1 h-3 w-3 inline" />;
  };

  return (
    <Card data-testid="card-league-rankings">
      <CardHeader className="p-4 md:p-6">
        <div className="flex flex-col gap-3 md:gap-4">
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
        </div>
      </CardHeader>
      <CardContent className="p-0 md:p-6">
        <div className="overflow-x-auto">
          <Table className="text-xs md:text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-card w-12 md:w-16">Rank</TableHead>
                <TableHead className="sticky left-12 md:left-16 z-10 bg-card min-w-[120px] md:min-w-[160px]">Team</TableHead>
                <TableHead 
                  className="text-center min-w-[60px] cursor-pointer hover-elevate select-none"
                  onClick={() => handleSort('fgPct')}
                  data-testid="header-fgpct"
                >
                  FG%<SortIcon columnKey="fgPct" />
                </TableHead>
                <TableHead 
                  className="text-center min-w-[60px] cursor-pointer hover-elevate select-none"
                  onClick={() => handleSort('ftPct')}
                  data-testid="header-ftpct"
                >
                  FT%<SortIcon columnKey="ftPct" />
                </TableHead>
                <TableHead 
                  className="text-center min-w-[60px] cursor-pointer hover-elevate select-none"
                  onClick={() => handleSort('tpm')}
                  data-testid="header-tpm"
                >
                  3PM<SortIcon columnKey="tpm" />
                </TableHead>
                <TableHead 
                  className="text-center min-w-[60px] cursor-pointer hover-elevate select-none"
                  onClick={() => handleSort('pts')}
                  data-testid="header-pts"
                >
                  PTS<SortIcon columnKey="pts" />
                </TableHead>
                <TableHead 
                  className="text-center min-w-[60px] cursor-pointer hover-elevate select-none"
                  onClick={() => handleSort('reb')}
                  data-testid="header-reb"
                >
                  REB<SortIcon columnKey="reb" />
                </TableHead>
                <TableHead 
                  className="text-center min-w-[60px] cursor-pointer hover-elevate select-none"
                  onClick={() => handleSort('ast')}
                  data-testid="header-ast"
                >
                  AST<SortIcon columnKey="ast" />
                </TableHead>
                <TableHead 
                  className="text-center min-w-[60px] cursor-pointer hover-elevate select-none"
                  onClick={() => handleSort('stl')}
                  data-testid="header-stl"
                >
                  STL<SortIcon columnKey="stl" />
                </TableHead>
                <TableHead 
                  className="text-center min-w-[60px] cursor-pointer hover-elevate select-none"
                  onClick={() => handleSort('blk')}
                  data-testid="header-blk"
                >
                  BLK<SortIcon columnKey="blk" />
                </TableHead>
                <TableHead 
                  className="text-center min-w-[60px] cursor-pointer hover-elevate select-none"
                  onClick={() => handleSort('to')}
                  data-testid="header-to"
                >
                  TO<SortIcon columnKey="to" />
                </TableHead>
                <TableHead 
                  className="text-center min-w-[60px] bg-muted/50 cursor-pointer hover-elevate select-none"
                  onClick={() => handleSort('totalRank')}
                  data-testid="header-avg"
                >
                  Avg<SortIcon columnKey="totalRank" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRankings.map((team, index) => {
                const isUserTeam = team.teamKey === userTeamKey;
                return (
                  <TableRow
                    key={team.teamKey}
                    className={isUserTeam ? "bg-primary/5 font-medium" : ""}
                    data-testid={`row-ranking-${team.teamKey}`}
                  >
                    <TableCell className="sticky left-0 z-10 bg-card">{getMasterRankBadge(team.teamKey)}</TableCell>
                    <TableCell className="sticky left-12 md:left-16 z-10 bg-card font-medium">
                      <div className="flex flex-col gap-0.5">
                        <span className="line-clamp-1">
                          {team.teamName}
                          {isUserTeam && <span className="ml-1 text-primary">★</span>}
                        </span>
                        {team.managerName && (
                          <span className="text-xs text-muted-foreground font-normal line-clamp-1">
                            {team.managerName}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={`text-center ${showStats ? getStatGradientColor('fgPct', team.stats.fgPct, rankings) : getRankColor(team.categoryRanks.fgPct, rankings.length)}`}>
                      {showStats ? formatStat('fgPct', team.stats.fgPct, team) : team.categoryRanks.fgPct}
                    </TableCell>
                    <TableCell className={`text-center ${showStats ? getStatGradientColor('ftPct', team.stats.ftPct, rankings) : getRankColor(team.categoryRanks.ftPct, rankings.length)}`}>
                      {showStats ? formatStat('ftPct', team.stats.ftPct, team) : team.categoryRanks.ftPct}
                    </TableCell>
                    <TableCell className={`text-center ${showStats ? getStatGradientColor('tpm', team.stats.tpm, rankings) : getRankColor(team.categoryRanks.tpm, rankings.length)}`}>
                      {showStats ? formatStat('tpm', team.stats.tpm) : team.categoryRanks.tpm}
                    </TableCell>
                    <TableCell className={`text-center ${showStats ? getStatGradientColor('pts', team.stats.pts, rankings) : getRankColor(team.categoryRanks.pts, rankings.length)}`}>
                      {showStats ? formatStat('pts', team.stats.pts) : team.categoryRanks.pts}
                    </TableCell>
                    <TableCell className={`text-center ${showStats ? getStatGradientColor('reb', team.stats.reb, rankings) : getRankColor(team.categoryRanks.reb, rankings.length)}`}>
                      {showStats ? formatStat('reb', team.stats.reb) : team.categoryRanks.reb}
                    </TableCell>
                    <TableCell className={`text-center ${showStats ? getStatGradientColor('ast', team.stats.ast, rankings) : getRankColor(team.categoryRanks.ast, rankings.length)}`}>
                      {showStats ? formatStat('ast', team.stats.ast) : team.categoryRanks.ast}
                    </TableCell>
                    <TableCell className={`text-center ${showStats ? getStatGradientColor('stl', team.stats.stl, rankings) : getRankColor(team.categoryRanks.stl, rankings.length)}`}>
                      {showStats ? formatStat('stl', team.stats.stl) : team.categoryRanks.stl}
                    </TableCell>
                    <TableCell className={`text-center ${showStats ? getStatGradientColor('blk', team.stats.blk, rankings) : getRankColor(team.categoryRanks.blk, rankings.length)}`}>
                      {showStats ? formatStat('blk', team.stats.blk) : team.categoryRanks.blk}
                    </TableCell>
                    <TableCell className={`text-center ${showStats ? getStatGradientColor('to', team.stats.to, rankings) : getRankColor(team.categoryRanks.to, rankings.length)}`}>
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
