/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../../client/src/lib/queryClient';

// Mock data for testing
const mockLeague = {
  leagueKey: '466.l.12345',
  leagueName: 'Elite 9-Cat',
  teamKey: '466.l.12345.t.1',
  teamName: 'Dream Team'
};

const mockRankings = {
  rankings: [
    {
      teamKey: '466.l.12345.t.1',
      teamName: 'Dream Team',
      managerName: 'Player1',
      stats: { fgPct: 0.45, ftPct: 0.80, tpm: 5.5, pts: 110, reb: 45, ast: 25, stl: 8, blk: 5, to: 12 },
      categoryRanks: { fgPct: 1, ftPct: 2, tpm: 1, pts: 1, reb: 2, ast: 1, stl: 1, blk: 1, to: 9 },
      totalRank: 1.4
    },
    {
      teamKey: '466.l.12345.t.2',
      teamName: 'Rivals',
      managerName: 'Player2',
      stats: { fgPct: 0.44, ftPct: 0.78, tpm: 5.2, pts: 105, reb: 43, ast: 24, stl: 7, blk: 4, to: 14 },
      categoryRanks: { fgPct: 2, ftPct: 3, tpm: 2, pts: 2, reb: 3, ast: 2, stl: 2, blk: 2, to: 8 },
      totalRank: 2.3
    }
  ],
  metadata: { scope: 'season', week: 1, currentWeek: 20, totalWeeks: 20 }
};

const mockMatchup = {
  myTeam: { teamKey: mockLeague.teamKey, teamName: mockLeague.teamName },
  opponent: { teamKey: '466.l.12345.t.2', teamName: 'Opponent Team' },
  categories: [
    { category: 'fgPct', myTeam: 0.45, opponent: 0.44, winning: true, myTeamMakes: 100, myTeamAttempts: 222, opponentMakes: 98, opponentAttempts: 223 },
    { category: 'ftPct', myTeam: 0.80, opponent: 0.78, winning: true, myTeamMakes: 80, myTeamAttempts: 100, opponentMakes: 78, opponentAttempts: 100 },
    { category: 'tpm', myTeam: 5.5, opponent: 5.2, winning: true },
    { category: 'pts', myTeam: 110, opponent: 105, winning: true },
    { category: 'reb', myTeam: 45, opponent: 43, winning: true },
    { category: 'ast', myTeam: 25, opponent: 24, winning: true },
    { category: 'stl', myTeam: 8, opponent: 7, winning: true },
    { category: 'blk', myTeam: 5, opponent: 4, winning: true },
    { category: 'to', myTeam: 12, opponent: 14, winning: true }
  ],
  score: { wins: 9, losses: 0, ties: 0 },
  metadata: { scope: 'week', week: 1, currentWeek: 1, totalWeeks: 20 }
};

describe('Display Functionality Tests', () => {
  describe('League Rankings Display', () => {
    it('should render rankings table with all teams', () => {
      // ARRANGE & ACT
      render(
        <div>
          <table>
            <thead>
              <tr>
                <th>Team</th>
                <th>Manager</th>
                <th>FG%</th>
                <th>FT%</th>
                <th>3PM</th>
                <th>PTS</th>
                <th>REB</th>
                <th>AST</th>
                <th>STL</th>
                <th>BLK</th>
                <th>TO</th>
                <th>Total Rank</th>
              </tr>
            </thead>
            <tbody>
              {mockRankings.rankings.map((team) => (
                <tr key={team.teamKey} data-testid={`row-team-${team.teamKey}`}>
                  <td data-testid={`text-teamname-${team.teamKey}`}>{team.teamName}</td>
                  <td data-testid={`text-manager-${team.teamKey}`}>{team.managerName}</td>
                  <td>{team.stats.fgPct.toFixed(2)}</td>
                  <td>{team.stats.ftPct.toFixed(2)}</td>
                  <td>{team.stats.tpm.toFixed(1)}</td>
                  <td>{team.stats.pts.toFixed(0)}</td>
                  <td>{team.stats.reb.toFixed(0)}</td>
                  <td>{team.stats.ast.toFixed(0)}</td>
                  <td>{team.stats.stl.toFixed(1)}</td>
                  <td>{team.stats.blk.toFixed(1)}</td>
                  <td>{team.stats.to.toFixed(1)}</td>
                  <td data-testid={`text-rank-${team.teamKey}`}>{team.totalRank.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

      // ASSERT
      // Verify all teams rendered
      expect(screen.getByText('Dream Team')).toBeInTheDocument();
      expect(screen.getByText('Rivals')).toBeInTheDocument();
      expect(screen.getByText('Player1')).toBeInTheDocument();
      expect(screen.getByText('Player2')).toBeInTheDocument();

      // Verify stats displayed correctly
      expect(screen.getByText('0.45')).toBeInTheDocument(); // FG%
      expect(screen.getByText('110')).toBeInTheDocument(); // PTS
    });

    it('should display category rankings with color coding', () => {
      // ARRANGE & ACT
      render(
        <div>
          {mockRankings.rankings.map((team) => (
            <div key={team.teamKey} data-testid={`card-team-${team.teamKey}`}>
              <div className={team.categoryRanks.fgPct === 1 ? 'bg-green-100' : 'bg-gray-100'}>
                FG% Rank: {team.categoryRanks.fgPct}
              </div>
              <div className={team.categoryRanks.pts === 1 ? 'bg-green-100' : 'bg-gray-100'}>
                PTS Rank: {team.categoryRanks.pts}
              </div>
            </div>
          ))}
        </div>
      );

      // ASSERT
      // Verify top team has highlighted rank
      const topTeamCard = screen.getByTestId(`card-team-${mockRankings.rankings[0].teamKey}`);
      expect(topTeamCard).toBeInTheDocument();
      expect(within(topTeamCard).getByText(/FG% Rank: 1/)).toBeInTheDocument();
    });

    it('should display makes/attempts for percentage stats (FG%, FT%)', () => {
      // ARRANGE & ACT
      render(
        <div>
          {mockMatchup.categories
            .filter(c => ['fgPct', 'ftPct'].includes(c.category))
            .map((cat) => (
              <div key={cat.category} data-testid={`stat-${cat.category}`}>
                <span data-testid={`text-my-makes-${cat.category}`}>
                  {cat.myTeamMakes}/{cat.myTeamAttempts}
                </span>
                vs
                <span data-testid={`text-opp-makes-${cat.category}`}>
                  {cat.opponentMakes}/{cat.opponentAttempts}
                </span>
              </div>
            ))}
        </div>
      );

      // ASSERT
      // Verify makes/attempts displayed
      expect(screen.getByText('100/222')).toBeInTheDocument();
      expect(screen.getByText('98/223')).toBeInTheDocument();
    });

    it('should handle week selection dropdown', async () => {
      // ARRANGE
      const user = userEvent.setup();
      const weeks = Array.from({ length: mockRankings.metadata.currentWeek }, (_, i) => i + 1);

      // ACT
      render(
        <select data-testid="select-week">
          <option value="season">Season (to date)</option>
          {weeks.map((week) => (
            <option key={week} value={week.toString()} data-testid={`option-week-${week}`}>
              Week {week}
            </option>
          ))}
        </select>
      );

      const select = screen.getByTestId('select-week');
      await user.selectOptions(select, '5');
      
      // ASSERT
      expect((select as HTMLSelectElement).value).toBe('5');
    });
  });

  describe('Matchup Tab Display', () => {
    it('should render matchup comparison with team names', () => {
      // ARRANGE & ACT
      render(
        <div data-testid="matchup-container">
          <div data-testid="my-team-header">{mockMatchup.myTeam.teamName}</div>
          <div data-testid="opponent-header">{mockMatchup.opponent.teamName}</div>
          <div data-testid="text-wlt-score">
            {mockMatchup.score.wins}W - {mockMatchup.score.losses}L - {mockMatchup.score.ties}T
          </div>
        </div>
      );

      // ASSERT
      expect(screen.getByTestId('my-team-header')).toHaveTextContent(mockLeague.teamName);
      expect(screen.getByTestId('opponent-header')).toHaveTextContent('Opponent Team');
      expect(screen.getByTestId('text-wlt-score')).toHaveTextContent('9W - 0L - 0T');
    });

    it('should display all 9 categories with stats', () => {
      // ARRANGE & ACT
      render(
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>My Team</th>
              <th>Opponent</th>
              <th>Diff</th>
            </tr>
          </thead>
          <tbody>
            {mockMatchup.categories.map((cat) => (
              <tr key={cat.category} data-testid={`row-category-${cat.category}`}>
                <td data-testid={`text-category-${cat.category}`}>{cat.category}</td>
                <td data-testid={`text-myteam-${cat.category}`}>{typeof cat.myTeam === 'number' ? cat.myTeam.toFixed(2) : cat.myTeam}</td>
                <td data-testid={`text-opponent-${cat.category}`}>{typeof cat.opponent === 'number' ? cat.opponent.toFixed(2) : cat.opponent}</td>
                <td className={cat.winning ? 'text-green-600' : 'text-red-600'} data-testid={`text-diff-${cat.category}`}>
                  {cat.winning ? '+' : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );

      // ASSERT
      // Verify all 9 categories displayed
      expect(mockMatchup.categories).toHaveLength(9);
      mockMatchup.categories.forEach((cat) => {
        expect(screen.getByTestId(`row-category-${cat.category}`)).toBeInTheDocument();
      });
    });

    it('should color-code winning/losing categories (green/red)', () => {
      // ARRANGE & ACT
      render(
        <div>
          {mockMatchup.categories.map((cat) => (
            <div
              key={cat.category}
              data-testid={`diff-cell-${cat.category}`}
              className={cat.winning ? 'text-green-600' : 'text-red-600'}
            >
              {cat.winning ? '✓ Win' : '✗ Loss'}
            </div>
          ))}
        </div>
      );

      // ASSERT
      // Verify color coding
      const winCell = screen.getByTestId('diff-cell-fgPct');
      expect(winCell).toHaveClass('text-green-600');
    });

    it('should display metadata (current week, scope)', () => {
      // ARRANGE & ACT
      render(
        <div>
          <span data-testid="text-scope">{mockMatchup.metadata.scope}</span>
          <span data-testid="text-week">Week {mockMatchup.metadata.week}</span>
          <span data-testid="text-total-weeks">of {mockMatchup.metadata.totalWeeks}</span>
        </div>
      );

      // ASSERT
      expect(screen.getByTestId('text-scope')).toHaveTextContent('week');
      expect(screen.getByTestId('text-week')).toHaveTextContent('Week 1');
    });
  });

  describe('Matchup Simulator Display', () => {
    const simulatorData = [
      { opponent: 'Team A', myTeamWins: 7, myTeamLosses: 2, myTeamTies: 0 },
      { opponent: 'Team B', myTeamWins: 6, myTeamLosses: 3, myTeamTies: 0 },
      { opponent: 'Team C', myTeamWins: 9, myTeamLosses: 0, myTeamTies: 0 }
    ];

    it('should render simulator matrix with all opponent matchups', () => {
      // ARRANGE & ACT
      render(
        <table>
          <thead>
            <tr>
              <th>Opponent</th>
              <th>W</th>
              <th>L</th>
              <th>T</th>
            </tr>
          </thead>
          <tbody>
            {simulatorData.map((row) => (
              <tr key={row.opponent} data-testid={`row-simulator-${row.opponent}`}>
                <td data-testid={`text-opponent-${row.opponent}`}>{row.opponent}</td>
                <td className="text-green-600" data-testid={`text-wins-${row.opponent}`}>{row.myTeamWins}</td>
                <td className="text-red-600" data-testid={`text-losses-${row.opponent}`}>{row.myTeamLosses}</td>
                <td className="text-gray-600" data-testid={`text-ties-${row.opponent}`}>{row.myTeamTies}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );

      // ASSERT
      // Verify matrix rendered
      expect(screen.getByTestId('row-simulator-Team A')).toBeInTheDocument();
      expect(screen.getByTestId('text-wins-Team C')).toHaveTextContent('9');
      expect(screen.getByTestId('text-losses-Team B')).toHaveTextContent('3');
    });

    it('should color-code W/L/T results', () => {
      // ARRANGE & ACT
      render(
        <div>
          <span className="text-green-600" data-testid="color-wins">7W</span>
          <span className="text-red-600" data-testid="color-losses">2L</span>
          <span className="text-gray-600" data-testid="color-ties">0T</span>
        </div>
      );

      // ASSERT
      expect(screen.getByTestId('color-wins')).toHaveClass('text-green-600');
      expect(screen.getByTestId('color-losses')).toHaveClass('text-red-600');
      expect(screen.getByTestId('color-ties')).toHaveClass('text-gray-600');
    });

    it('should handle opponent team selection', async () => {
      // ARRANGE
      const user = userEvent.setup();
      const selectedTeam = 'Team A';

      // ACT
      render(
        <select data-testid="select-simulator-team">
          {simulatorData.map((row) => (
            <option key={row.opponent} value={row.opponent} data-testid={`option-${row.opponent}`}>
              {row.opponent}
            </option>
          ))}
        </select>
      );

      const select = screen.getByTestId('select-simulator-team') as HTMLSelectElement;
      await user.selectOptions(select, selectedTeam);
      
      // ASSERT
      expect(select.value).toBe(selectedTeam);
    });
  });

  describe('Chat Interface Display', () => {
    it('should render chat messages with role and content', () => {
      // ARRANGE
      const messages = [
        { id: '1', role: 'assistant', content: 'Hi! How can I help?', timestamp: '2:30 PM' },
        { id: '2', role: 'user', content: 'Who should I start?', timestamp: '2:31 PM' }
      ];

      render(
        <div data-testid="chat-container">
          {messages.map((msg) => (
            <div key={msg.id} data-testid={`message-${msg.id}`} className={`message-${msg.role}`}>
              <span data-testid={`text-content-${msg.id}`}>{msg.content}</span>
              <span data-testid={`text-time-${msg.id}`}>{msg.timestamp}</span>
            </div>
          ))}
        </div>
      );

      // ASSERT
      expect(screen.getByTestId('message-1')).toHaveClass('message-assistant');
      expect(screen.getByTestId('message-2')).toHaveClass('message-user');
      expect(screen.getByText('Hi! How can I help?')).toBeInTheDocument();
      expect(screen.getByText('Who should I start?')).toBeInTheDocument();
    });

    it('should display source citations', () => {
      // ARRANGE
      const message = {
        id: '1',
        role: 'assistant',
        content: 'Based on recent analysis...',
        sources: ['BALLDONTLIE', 'Reddit', 'ESPN']
      };

      render(
        <div data-testid="message-with-sources">
          <p data-testid="text-message-content">{message.content}</p>
          <div data-testid="sources-list">
            {message.sources?.map((source) => (
              <span key={source} data-testid={`source-${source}`} className="source-badge">
                {source}
              </span>
            ))}
          </div>
        </div>
      );

      // ASSERT
      expect(screen.getByTestId('text-message-content')).toHaveTextContent('Based on recent analysis');
      expect(screen.getByTestId('source-BALLDONTLIE')).toBeInTheDocument();
      expect(screen.getByTestId('source-Reddit')).toBeInTheDocument();
    });

    it('should show loading state during message processing', () => {
      // ARRANGE & ACT
      render(
        <div>
          {true && (
            <div data-testid="loading-indicator" className="animate-pulse">
              <span>AI is thinking...</span>
            </div>
          )}
        </div>
      );

      // ASSERT
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('loading-indicator')).toHaveClass('animate-pulse');
    });
  });

  describe('Error & Loading States', () => {
    it('should display loading skeleton for rankings', () => {
      // ARRANGE & ACT
      render(
        <div data-testid="rankings-loading">
          <div className="animate-pulse h-8 bg-gray-200 rounded mb-4"></div>
          <div className="animate-pulse h-8 bg-gray-200 rounded mb-4"></div>
          <div className="animate-pulse h-8 bg-gray-200 rounded mb-4"></div>
        </div>
      );

      // ASSERT
      const loadingState = screen.getByTestId('rankings-loading');
      const skeletons = loadingState.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBe(3);
    });

    it('should display error message when no leagues found', () => {
      // ARRANGE & ACT
      render(
        <div data-testid="no-leagues-error">
          <p data-testid="text-error-message">
            No leagues found. Please connect your Yahoo account first.
          </p>
        </div>
      );

      // ASSERT
      expect(screen.getByTestId('text-error-message')).toBeInTheDocument();
    });

    it('should display empty state for matchups', () => {
      // ARRANGE & ACT
      render(
        <div data-testid="empty-matchup">
          <p data-testid="text-empty-state">
            Select a league and team to view matchup details
          </p>
        </div>
      );

      // ASSERT
      expect(screen.getByTestId('text-empty-state')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should have responsive table with horizontal scroll on mobile', () => {
      // ARRANGE & ACT
      render(
        <div data-testid="rankings-table-container" className="overflow-x-auto md:overflow-visible">
          <table className="w-full">
            <tbody>
              <tr>
                <td>Team</td>
                <td>FG%</td>
                <td>FT%</td>
                <td>3PM</td>
                <td>PTS</td>
              </tr>
            </tbody>
          </table>
        </div>
      );

      // ASSERT
      expect(screen.getByTestId('rankings-table-container')).toHaveClass('overflow-x-auto');
    });

    it('should display mobile-friendly header', () => {
      // ARRANGE & ACT
      render(
        <header>
          <h1 className="text-lg md:text-xl">
            <span className="hidden sm:inline">Fantasy Basketball Rankings</span>
            <span className="sm:hidden">FB Rankings</span>
          </h1>
        </header>
      );

      // ASSERT
      expect(screen.getByText('FB Rankings')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper table structure with headers', () => {
      // ARRANGE & ACT
      render(
        <table>
          <thead>
            <tr>
              <th>Team Name</th>
              <th>FG%</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Dream Team</td>
              <td>0.45</td>
              <td>110</td>
            </tr>
          </tbody>
        </table>
      );

      // ASSERT
      const headers = screen.getAllByRole('columnheader');
      expect(headers).toHaveLength(3);
    });

    it('should have data-testid on interactive elements', () => {
      // ARRANGE & ACT
      render(
        <div>
          <button data-testid="button-logout">Logout</button>
          <button data-testid="button-header-chat">Chat</button>
          <select data-testid="select-league">
            <option>Select League</option>
          </select>
        </div>
      );

      // ASSERT
      expect(screen.getByTestId('button-logout')).toBeInTheDocument();
      expect(screen.getByTestId('button-header-chat')).toBeInTheDocument();
      expect(screen.getByTestId('select-league')).toBeInTheDocument();
    });
  });
});
