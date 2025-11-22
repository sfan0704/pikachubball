/**
 * Fixture data representing actual Yahoo Fantasy API responses
 * Used to mock MCP client responses in tests
 */

export const mockLeagueSettings = {
  fantasy_content: {
    league: [
      {
        league_key: "466.l.12345",
        name: "Test Fantasy League",
        season: "2024",
        current_week: 5,
        end_week: 20,
      },
      {
        settings: [
          {
            stat_categories: {
              stats: [
                { stat: { stat_id: 5, name: "FG%" } },
                { stat: { stat_id: 8, name: "FT%" } },
                { stat: { stat_id: 10, name: "3PTM" } },
                { stat: { stat_id: 12, name: "PTS" } },
                { stat: { stat_id: 15, name: "REB" } },
                { stat: { stat_id: 16, name: "AST" } },
                { stat: { stat_id: 17, name: "ST" } },
                { stat: { stat_id: 18, name: "BLK" } },
                { stat: { stat_id: 19, name: "TO" } },
              ],
            },
          },
        ],
      },
    ],
  },
};

export const mockStandings = {
  fantasy_content: {
    league: [
      {
        league_key: "466.l.12345",
        name: "Test Fantasy League",
        current_week: 5,
        end_week: 20,
      },
      {
        standings: [
          {
            teams: {
              count: 3,
              "0": {
                team: [
                  [
                    { team_key: "466.l.12345.t.1" },
                    { name: "Team Alpha" },
                    { managers: [{ manager: { nickname: "Manager One" } }] },
                  ],
                  {
                    team_stats: {
                      stats: [
                        { stat: { stat_id: "5", value: "0.475" } },
                        { stat: { stat_id: "8", value: "0.825" } },
                        { stat: { stat_id: "9004003", value: "380/800" } },
                        { stat: { stat_id: "9007006", value: "165/200" } },
                        { stat: { stat_id: "10", value: "95" } },
                        { stat: { stat_id: "12", value: "1020" } },
                        { stat: { stat_id: "15", value: "425" } },
                        { stat: { stat_id: "16", value: "280" } },
                        { stat: { stat_id: "17", value: "85" } },
                        { stat: { stat_id: "18", value: "65" } },
                        { stat: { stat_id: "19", value: "120" } },
                      ],
                    },
                  },
                ],
              },
              "1": {
                team: [
                  [
                    { team_key: "466.l.12345.t.2" },
                    { name: "Team Beta" },
                    { managers: [{ manager: { nickname: "Manager Two" } }] },
                  ],
                  {
                    team_stats: {
                      stats: [
                        { stat: { stat_id: "5", value: "0.468" } },
                        { stat: { stat_id: "8", value: "0.810" } },
                        { stat: { stat_id: "9004003", value: "360/770" } },
                        { stat: { stat_id: "9007006", value: "162/200" } },
                        { stat: { stat_id: "10", value: "88" } },
                        { stat: { stat_id: "12", value: "980" } },
                        { stat: { stat_id: "15", value: "410" } },
                        { stat: { stat_id: "16", value: "295" } },
                        { stat: { stat_id: "17", value: "78" } },
                        { stat: { stat_id: "18", value: "58" } },
                        { stat: { stat_id: "19", value: "115" } },
                      ],
                    },
                  },
                ],
              },
              "2": {
                team: [
                  [
                    { team_key: "466.l.12345.t.3" },
                    { name: "Team Gamma" },
                    { managers: [{ manager: { nickname: "Manager Three" } }] },
                  ],
                  {
                    team_stats: {
                      stats: [
                        { stat: { stat_id: "5", value: "0.455" } },
                        { stat: { stat_id: "8", value: "0.795" } },
                        { stat: { stat_id: "9004003", value: "350/770" } },
                        { stat: { stat_id: "9007006", value: "159/200" } },
                        { stat: { stat_id: "10", value: "78" } },
                        { stat: { stat_id: "12", value: "945" } },
                        { stat: { stat_id: "15", value: "445" } },
                        { stat: { stat_id: "16", value: "265" } },
                        { stat: { stat_id: "17", value: "72" } },
                        { stat: { stat_id: "18", value: "72" } },
                        { stat: { stat_id: "19", value: "125" } },
                      ],
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    ],
  },
};

export const mockScoreboard = {
  fantasy_content: {
    league: [
      {
        league_key: "466.l.12345",
        current_week: 5,
        end_week: 20,
      },
      {
        scoreboard: [
          {
            matchups: {
              count: 1,
              "0": {
                matchup: {
                  "0": {
                    teams: {
                      count: 2,
                      "0": {
                        team: [
                          [
                            { team_key: "466.l.12345.t.1" },
                            { name: "Team Alpha" },
                          ],
                          {
                            team_stats: {
                              stats: [
                                { stat: { stat_id: "5", value: "0.475" } },
                                { stat: { stat_id: "8", value: "0.825" } },
                                { stat: { stat_id: "9004003", value: "76/160" } },
                                { stat: { stat_id: "9007006", value: "33/40" } },
                                { stat: { stat_id: "10", value: "19" } },
                                { stat: { stat_id: "12", value: "204" } },
                                { stat: { stat_id: "15", value: "85" } },
                                { stat: { stat_id: "16", value: "56" } },
                                { stat: { stat_id: "17", value: "17" } },
                                { stat: { stat_id: "18", value: "13" } },
                                { stat: { stat_id: "19", value: "24" } },
                              ],
                            },
                          },
                        ],
                      },
                      "1": {
                        team: [
                          [
                            { team_key: "466.l.12345.t.2" },
                            { name: "Team Beta" },
                          ],
                          {
                            team_stats: {
                              stats: [
                                { stat: { stat_id: "5", value: "0.468" } },
                                { stat: { stat_id: "8", value: "0.810" } },
                                { stat: { stat_id: "9004003", value: "72/154" } },
                                { stat: { stat_id: "9007006", value: "32/40" } },
                                { stat: { stat_id: "10", value: "17" } },
                                { stat: { stat_id: "12", value: "193" } },
                                { stat: { stat_id: "15", value: "82" } },
                                { stat: { stat_id: "16", value: "59" } },
                                { stat: { stat_id: "17", value: "15" } },
                                { stat: { stat_id: "18", value: "11" } },
                                { stat: { stat_id: "19", value: "23" } },
                              ],
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    ],
  },
};
