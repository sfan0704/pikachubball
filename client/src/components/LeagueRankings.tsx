import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TeamRanking {
  teamKey: string;
  teamName: string;
  stats: {
    fgPct: number;
    ftPct: number;
    tpm: number;
    pts: number;
    reb: number;
    ast: number;
    stl: number;
    blk: number;
    to: number;
  };
  categoryRanks: {
    fgPct: number;
    ftPct: number;
    tpm: number;
    pts: number;
    reb: number;
    ast: number;
    stl: number;
    blk: number;
    to: number;
  };
  totalRank: number;
}

interface LeagueRankingsProps {
  rankings: TeamRanking[];
  userTeamKey?: string;
}

export default function LeagueRankings({ rankings, userTeamKey }: LeagueRankingsProps) {
  const getRankColor = (rank: number, total: number) => {
    const pct = rank / total;
    if (pct <= 0.33) return "text-green-600 dark:text-green-400";
    if (pct <= 0.66) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getMasterRankBadge = (index: number) => {
    if (index === 0) return <Badge className="bg-yellow-500">🥇 1st</Badge>;
    if (index === 1) return <Badge className="bg-gray-400">🥈 2nd</Badge>;
    if (index === 2) return <Badge className="bg-orange-600">🥉 3rd</Badge>;
    return <Badge variant="outline">{index + 1}</Badge>;
  };

  return (
    <Card data-testid="card-league-rankings">
      <CardHeader>
        <CardTitle data-testid="heading-rankings">9-Cat Master Rankings</CardTitle>
        <p className="text-sm text-muted-foreground">
          Teams ranked by average position across all 9 categories
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Rank</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-center">FG%</TableHead>
                <TableHead className="text-center">FT%</TableHead>
                <TableHead className="text-center">3PM</TableHead>
                <TableHead className="text-center">PTS</TableHead>
                <TableHead className="text-center">REB</TableHead>
                <TableHead className="text-center">AST</TableHead>
                <TableHead className="text-center">STL</TableHead>
                <TableHead className="text-center">BLK</TableHead>
                <TableHead className="text-center">TO</TableHead>
                <TableHead className="text-center">Avg</TableHead>
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
                    <TableCell>{getMasterRankBadge(index)}</TableCell>
                    <TableCell className="font-medium">
                      {team.teamName}
                      {isUserTeam && <span className="ml-2 text-primary">★</span>}
                    </TableCell>
                    <TableCell className={`text-center ${getRankColor(team.categoryRanks.fgPct, rankings.length)}`}>
                      {team.categoryRanks.fgPct}
                    </TableCell>
                    <TableCell className={`text-center ${getRankColor(team.categoryRanks.ftPct, rankings.length)}`}>
                      {team.categoryRanks.ftPct}
                    </TableCell>
                    <TableCell className={`text-center ${getRankColor(team.categoryRanks.tpm, rankings.length)}`}>
                      {team.categoryRanks.tpm}
                    </TableCell>
                    <TableCell className={`text-center ${getRankColor(team.categoryRanks.pts, rankings.length)}`}>
                      {team.categoryRanks.pts}
                    </TableCell>
                    <TableCell className={`text-center ${getRankColor(team.categoryRanks.reb, rankings.length)}`}>
                      {team.categoryRanks.reb}
                    </TableCell>
                    <TableCell className={`text-center ${getRankColor(team.categoryRanks.ast, rankings.length)}`}>
                      {team.categoryRanks.ast}
                    </TableCell>
                    <TableCell className={`text-center ${getRankColor(team.categoryRanks.stl, rankings.length)}`}>
                      {team.categoryRanks.stl}
                    </TableCell>
                    <TableCell className={`text-center ${getRankColor(team.categoryRanks.blk, rankings.length)}`}>
                      {team.categoryRanks.blk}
                    </TableCell>
                    <TableCell className={`text-center ${getRankColor(team.categoryRanks.to, rankings.length)}`}>
                      {team.categoryRanks.to}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
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
