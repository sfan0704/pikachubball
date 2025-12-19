# Yahoo Fantasy Sports API Documentation

**Generated from actual API responses** - This documentation is based on real API calls made to Yahoo Fantasy Sports API.
No assumptions were made - everything documented here comes from successful API responses.

**Generated:** 2025-12-11T17:15:19.505Z
**League Used:** Latest NBA League (2025 season)
**Total API Calls Analyzed:** 24

---

## Table of Contents

1. [API Structure Overview](#api-structure-overview)
2. [User & Game Endpoints](#user--game-endpoints)
3. [League Endpoints](#league-endpoints)
4. [Team Endpoints](#team-endpoints)
5. [Player Endpoints](#player-endpoints)
6. [Common Patterns](#common-patterns)
7. [Data Extraction Examples](#data-extraction-examples)

---

## API Structure Overview

### Root Structure

All Yahoo Fantasy Sports API responses follow this structure:

```json
{
  "fantasy_content": {
    "xml:lang": "en-US",
    "yahoo:uri": "/fantasy/v2/...",
    // ... resource data ...
    "time": "...",
    "copyright": "...",
    "refresh_rate": "60"
  }
}
```

**Key Observations:**
- All responses are wrapped in `fantasy_content` object
- `yahoo:uri` shows the endpoint that was called
- Response includes timing and copyright information

---

## User & Game Endpoints

### games

**Endpoint:** `/fantasy/v2/users;use_login=1/games`

**Response File:** `01-get-user-games-raw.json`

**Structure:**
```json
{
  "fantasy_content": {
    "users": "..."
  }
}
```

**Key Observations:**
- Numeric string keys pattern at fantasy_content.users: uses "0", "1", etc. with "count" property
- Array found at path: fantasy_content.users.0.user
- Yahoo array pattern detected at fantasy_content.users.0.user: [0] = properties, [1] = subresources

---

### games/leagues

**Endpoint:** `/fantasy/v2/users;use_login=1/games/leagues`

**Response File:** `02-get-all-user-leagues-raw.json`

**Structure:**
```json
{
  "fantasy_content": {
    "users": "..."
  }
}
```

**Key Observations:**
- Numeric string keys pattern at fantasy_content.users: uses "0", "1", etc. with "count" property
- Array found at path: fantasy_content.users.0.user
- Yahoo array pattern detected at fantasy_content.users.0.user: [0] = properties, [1] = subresources

---

## League Endpoints

### draftresults

**Endpoint:** `/fantasy/v2/league/{league_key}/draftresults`

**Response File:** `01-nba-2025-draftresults-raw.json`

**Response Structure:**

```json
{
  "fantasy_content": {
    "league": [
      { /* Properties: league_key, name, current_week, etc. */ },
      { /* Subresources: draftresults */ }
    ]
  }
}

```

**League Properties Available:**
- `league_key`: string = "466.l.29849"
- `league_id`: string = "29849"
- `name`: string = "皮卡丘打籃球 season 3"
- `url`: string
- `logo_url`: string
- `draft_status`: string = "postdraft"
- `num_teams`: number
- `edit_key`: string = "2025-12-11"
- `weekly_deadline`: string = "intraday"
- `roster_type`: string = "date"
- `league_update_timestamp`: string = "1765443166"
- `scoring_type`: string = "head"
- `league_type`: string = "private"
- `renew`: string = "454_83660"
- `renewed`: string = ""
- `felo_tier`: string = "silver"
- `is_highscore`: boolean
- `matchup_week`: number
- `iris_group_chat_id`: string = ""
- `short_invitation_url`: string

**Subresource Structure:**
```json
{
  "draft_results": {
    "0": {
      "draft_result": {
        "pick": 1,
        "round": 1,
        "cost": 88,
        "team_key": "466.l.29849.t.9",
        "player_key": "466.p.5352"
      }
    },
    "1": {
      "draft_result": {
        "pick": 2,
        "round": 1,
        "cost": 37,
        "team_key": "466.l.29849.t.1",
        "player_key": "466.p.4612"
      }
    },
    "2": {
      "draft_result": {
        "pick": 3,
        "round": 1,
        "cost": 86,
        "team_key": "466.l.29849.t.2",
        "player_key": "466.p.10094"
      }
    },
    "3": {
      "draft_result": {
        "pick": 4,
        "round": 1,
        "cost": 69,
        "team_key": "466.l.29849.t.11",
        "player_key": "466.p.5185"
      }
    },
    "4": {
      "draft_result": {
        "pick": 5,
        "round": 1,
        "cost": 74,
        "team_key": "466.l.29849.t.12",
        "player_key": "466.p.6014"
      }
    },
    "5": {
      "draft_result": {
        "pick": 6,
     
```

**Key Observations:**
- Array found at path: fantasy_content.league
- Yahoo array pattern detected at fantasy_content.league: [0] = properties, [1] = subresources

---

### players (status=FA)

**Endpoint:** `/fantasy/v2/league/{league_key}/players;status=FA`

**Response File:** `01-nba-2025-freeagents-raw.json`

**Response Structure:**

```json
{
  "fantasy_content": {
    "league": [
      { /* Properties: league_key, name, current_week, etc. */ },
      { /* Subresources: players */ }
    ]
  }
}

```

**League Properties Available:**
- `league_key`: string = "466.l.29849"
- `league_id`: string = "29849"
- `name`: string = "皮卡丘打籃球 season 3"
- `url`: string
- `logo_url`: string
- `draft_status`: string = "postdraft"
- `num_teams`: number
- `edit_key`: string = "2025-12-11"
- `weekly_deadline`: string = "intraday"
- `roster_type`: string = "date"
- `league_update_timestamp`: string = "1765443166"
- `scoring_type`: string = "head"
- `league_type`: string = "private"
- `renew`: string = "454_83660"
- `renewed`: string = ""
- `felo_tier`: string = "silver"
- `is_highscore`: boolean
- `matchup_week`: number
- `iris_group_chat_id`: string = ""
- `short_invitation_url`: string

**Subresource Structure:**
```json
{
  "players": {
    "0": {
      "player": [
        [
          {
            "player_key": "466.p.3930"
          },
          {
            "player_id": "3930"
          },
          {
            "name": {
              "full": "Chris Paul",
              "first": "Chris",
              "last": "Paul",
              "ascii_first": "Chris",
              "ascii_last": "Paul"
            }
          },
          {
            "url": "https://sports.yahoo.com/nba/players/3930"
          },
          {
            "status": "NA",
            "status_full": "Not Active"
          },
          {
            "injury_note": "Coach's Decision"
          },
          {
            "editorial_player_key": "nba.p.3930"
          },
          {
            "editorial_team_key": "nba.t.12"
          },
          {
            "editorial_team_full_name": "LA Clippers"
          },
          {
            "editorial_team_abbr": "LAC"
          },
          {
            "editorial_team_url": "htt
```

**Key Observations:**
- Array found at path: fantasy_content.league
- Yahoo array pattern detected at fantasy_content.league: [0] = properties, [1] = subresources

---

### metadata

**Endpoint:** `/fantasy/v2/league/{league_key}/metadata`

**Response File:** `01-nba-2025-metadata-raw.json`

**Response Structure:**

```json
{
  "fantasy_content": {
    "league": [
      { /* Properties: league_key, name, current_week, etc. */ },
      { /* Subresources: metadata */ }
    ]
  }
}

```

**League Properties Available:**
- `league_key`: string = "466.l.29849"
- `league_id`: string = "29849"
- `name`: string = "皮卡丘打籃球 season 3"
- `url`: string
- `logo_url`: string
- `draft_status`: string = "postdraft"
- `num_teams`: number
- `edit_key`: string = "2025-12-11"
- `weekly_deadline`: string = "intraday"
- `roster_type`: string = "date"
- `league_update_timestamp`: string = "1765443166"
- `scoring_type`: string = "head"
- `league_type`: string = "private"
- `renew`: string = "454_83660"
- `renewed`: string = ""
- `felo_tier`: string = "silver"
- `is_highscore`: boolean
- `matchup_week`: number
- `iris_group_chat_id`: string = ""
- `short_invitation_url`: string

**Key Observations:**
- Array found at path: fantasy_content.league

---

### players

**Endpoint:** `/fantasy/v2/league/{league_key}/players`

**Response File:** `01-nba-2025-players-raw.json`

**Response Structure:**

```json
{
  "fantasy_content": {
    "league": [
      { /* Properties: league_key, name, current_week, etc. */ },
      { /* Subresources: players */ }
    ]
  }
}

```

**League Properties Available:**
- `league_key`: string = "466.l.29849"
- `league_id`: string = "29849"
- `name`: string = "皮卡丘打籃球 season 3"
- `url`: string
- `logo_url`: string
- `draft_status`: string = "postdraft"
- `num_teams`: number
- `edit_key`: string = "2025-12-11"
- `weekly_deadline`: string = "intraday"
- `roster_type`: string = "date"
- `league_update_timestamp`: string = "1765443166"
- `scoring_type`: string = "head"
- `league_type`: string = "private"
- `renew`: string = "454_83660"
- `renewed`: string = ""
- `felo_tier`: string = "silver"
- `is_highscore`: boolean
- `matchup_week`: number
- `iris_group_chat_id`: string = ""
- `short_invitation_url`: string

**Subresource Structure:**
```json
{
  "players": {
    "0": {
      "player": [
        [
          {
            "player_key": "466.p.3704"
          },
          {
            "player_id": "3704"
          },
          {
            "name": {
              "full": "LeBron James",
              "first": "LeBron",
              "last": "James",
              "ascii_first": "LeBron",
              "ascii_last": "James"
            }
          },
          {
            "url": "https://sports.yahoo.com/nba/players/3704"
          },
          {
            "editorial_player_key": "nba.p.3704"
          },
          {
            "editorial_team_key": "nba.t.13"
          },
          {
            "editorial_team_full_name": "Los Angeles Lakers"
          },
          {
            "editorial_team_abbr": "LAL"
          },
          {
            "editorial_team_url": "https://sports.yahoo.com/nba/teams/la-lakers/"
          },
          {
            "is_keeper": {
              "status": false,
              "cost": fa
```

**Key Observations:**
- Array found at path: fantasy_content.league
- Yahoo array pattern detected at fantasy_content.league: [0] = properties, [1] = subresources

---

### scoreboard

**Endpoint:** `/fantasy/v2/league/{league_key}/scoreboard`

**Response File:** `01-nba-2025-scoreboard-raw.json`

**Response Structure:**

```json
{
  "fantasy_content": {
    "league": [
      { /* Properties: league_key, name, current_week, etc. */ },
      { /* Subresources: scoreboard */ }
    ]
  }
}

```

**League Properties Available:**
- `league_key`: string = "466.l.29849"
- `league_id`: string = "29849"
- `name`: string = "皮卡丘打籃球 season 3"
- `url`: string
- `logo_url`: string
- `draft_status`: string = "postdraft"
- `num_teams`: number
- `edit_key`: string = "2025-12-11"
- `weekly_deadline`: string = "intraday"
- `roster_type`: string = "date"
- `league_update_timestamp`: string = "1765443166"
- `scoring_type`: string = "head"
- `league_type`: string = "private"
- `renew`: string = "454_83660"
- `renewed`: string = ""
- `felo_tier`: string = "silver"
- `is_highscore`: boolean
- `matchup_week`: number
- `iris_group_chat_id`: string = ""
- `short_invitation_url`: string

**Subresource Structure:**
```json
{
  "scoreboard": {
    "0": {
      "matchups": {
        "0": {
          "matchup": {
            "0": {
              "teams": {
                "0": {
                  "team": [
                    [
                      {
                        "team_key": "466.l.29849.t.1"
                      },
                      {
                        "team_id": "1"
                      },
                      {
                        "name": "Amen Giddey"
                      },
                      [],
                      {
                        "url": "https://basketball.fantasysports.yahoo.com/nba/29849/1"
                      },
                      {
                        "team_logos": [
                          {
                            "team_logo": {
                              "size": "large",
                              "url": "https://yahoofantasysports-res.cloudinary.com/image/upload/t_s192sq/fantasy-logos/d04437c7cbf446cab7cd2f941fd75ac57f77d3bf905
```

**Key Observations:**
- Array found at path: fantasy_content.league
- Yahoo array pattern detected at fantasy_content.league: [0] = properties, [1] = subresources

---

### scoreboard (week=1)

**Endpoint:** `/fantasy/v2/league/{league_key}/scoreboard;week=1`

**Response File:** `01-nba-2025-scoreboard-week1-raw.json`

**Response Structure:**

```json
{
  "fantasy_content": {
    "league": [
      { /* Properties: league_key, name, current_week, etc. */ },
      { /* Subresources: scoreboard */ }
    ]
  }
}

```

**League Properties Available:**
- `league_key`: string = "466.l.29849"
- `league_id`: string = "29849"
- `name`: string = "皮卡丘打籃球 season 3"
- `url`: string
- `logo_url`: string
- `draft_status`: string = "postdraft"
- `num_teams`: number
- `edit_key`: string = "2025-12-11"
- `weekly_deadline`: string = "intraday"
- `roster_type`: string = "date"
- `league_update_timestamp`: string = "1765443166"
- `scoring_type`: string = "head"
- `league_type`: string = "private"
- `renew`: string = "454_83660"
- `renewed`: string = ""
- `felo_tier`: string = "silver"
- `is_highscore`: boolean
- `matchup_week`: number
- `iris_group_chat_id`: string = ""
- `short_invitation_url`: string

**Subresource Structure:**
```json
{
  "scoreboard": {
    "0": {
      "matchups": {
        "0": {
          "matchup": {
            "0": {
              "teams": {
                "0": {
                  "team": [
                    [
                      {
                        "team_key": "466.l.29849.t.1"
                      },
                      {
                        "team_id": "1"
                      },
                      {
                        "name": "Amen Giddey"
                      },
                      [],
                      {
                        "url": "https://basketball.fantasysports.yahoo.com/nba/29849/1"
                      },
                      {
                        "team_logos": [
                          {
                            "team_logo": {
                              "size": "large",
                              "url": "https://yahoofantasysports-res.cloudinary.com/image/upload/t_s192sq/fantasy-logos/d04437c7cbf446cab7cd2f941fd75ac57f77d3bf905
```

**Key Observations:**
- Array found at path: fantasy_content.league
- Yahoo array pattern detected at fantasy_content.league: [0] = properties, [1] = subresources

---

### settings

**Endpoint:** `/fantasy/v2/league/{league_key}/settings`

**Response File:** `01-nba-2025-settings-raw.json`

**Response Structure:**

```json
{
  "fantasy_content": {
    "league": [
      { /* Properties: league_key, name, current_week, etc. */ },
      { /* Subresources: settings */ }
    ]
  }
}

```

**League Properties Available:**
- `league_key`: string = "466.l.29849"
- `league_id`: string = "29849"
- `name`: string = "皮卡丘打籃球 season 3"
- `url`: string
- `logo_url`: string
- `draft_status`: string = "postdraft"
- `num_teams`: number
- `edit_key`: string = "2025-12-11"
- `weekly_deadline`: string = "intraday"
- `roster_type`: string = "date"
- `league_update_timestamp`: string = "1765443166"
- `scoring_type`: string = "head"
- `league_type`: string = "private"
- `renew`: string = "454_83660"
- `renewed`: string = ""
- `felo_tier`: string = "silver"
- `is_highscore`: boolean
- `matchup_week`: number
- `iris_group_chat_id`: string = ""
- `short_invitation_url`: string

**Subresource Structure:**
```json
{
  "settings": [
    {
      "draft_type": "live",
      "is_auction_draft": "1",
      "scoring_type": "head",
      "is_highscore": false,
      "invite_permission": "all",
      "uses_playoff": "1",
      "has_playoff_consolation_games": true,
      "playoff_start_week": "20",
      "uses_playoff_reseeding": 0,
      "uses_lock_eliminated_teams": 1,
      "num_playoff_teams": "8",
      "num_playoff_consolation_teams": 0,
      "has_multiweek_championship": 0,
      "waiver_type": "FR",
      "waiver_rule": "all",
      "uses_faab": "1",
      "draft_time": "1758463200",
      "draft_pick_time": "60",
      "post_draft_players": "W",
      "max_teams": "14",
      "waiver_time": "1",
      "trade_end_date": "2026-03-05",
      "trade_ratify_type": "vote",
      "trade_reject_time": "2",
      "player_pool": "ALL",
      "cant_cut_list": "yahoo",
      "draft_together": 0,
      "sendbird_channel_url": "d76c9ff2d5a9a898af12110168dbd74d",
      "roster_positions": [
        {
       
```

**Key Observations:**
- Array found at path: fantasy_content.league
- Yahoo array pattern detected at fantasy_content.league: [0] = properties, [1] = subresources

---

### standings

**Endpoint:** `/fantasy/v2/league/{league_key}/standings`

**Response File:** `01-nba-2025-standings-raw.json`

**Response Structure:**

```json
{
  "fantasy_content": {
    "league": [
      { /* Properties: league_key, name, current_week, etc. */ },
      { /* Subresources: standings */ }
    ]
  }
}

```

**League Properties Available:**
- `league_key`: string = "466.l.29849"
- `league_id`: string = "29849"
- `name`: string = "皮卡丘打籃球 season 3"
- `url`: string
- `logo_url`: string
- `draft_status`: string = "postdraft"
- `num_teams`: number
- `edit_key`: string = "2025-12-11"
- `weekly_deadline`: string = "intraday"
- `roster_type`: string = "date"
- `league_update_timestamp`: string = "1765443166"
- `scoring_type`: string = "head"
- `league_type`: string = "private"
- `renew`: string = "454_83660"
- `renewed`: string = ""
- `felo_tier`: string = "silver"
- `is_highscore`: boolean
- `matchup_week`: number
- `iris_group_chat_id`: string = ""
- `short_invitation_url`: string

**Subresource Structure:**
```json
{
  "standings": [
    {
      "teams": {
        "0": {
          "team": [
            [
              {
                "team_key": "466.l.29849.t.11"
              },
              {
                "team_id": "11"
              },
              {
                "name": "西雅圖公鹿"
              },
              [],
              {
                "url": "https://basketball.fantasysports.yahoo.com/nba/29849/11"
              },
              {
                "team_logos": [
                  {
                    "team_logo": {
                      "size": "large",
                      "url": "https://yahoofantasysports-res.cloudinary.com/image/upload/t_s192sq/fantasy-logos/1fbad44a8e9daefc62698c2f5ed00a90e6cba59899ed83e04ac98659e7667965.jpg"
                    }
                  }
                ]
              },
              {
                "previous_season_team_rank": 4
              },
              [],
              {
                "waiver_priority": 3
              }
```

**Key Observations:**
- Array found at path: fantasy_content.league
- Yahoo array pattern detected at fantasy_content.league: [0] = properties, [1] = subresources

---

### teams

**Endpoint:** `/fantasy/v2/league/{league_key}/teams`

**Response File:** `01-nba-2025-teams-raw.json`

**Response Structure:**

```json
{
  "fantasy_content": {
    "league": [
      { /* Properties: league_key, name, current_week, etc. */ },
      { /* Subresources: teams */ }
    ]
  }
}

```

**League Properties Available:**
- `league_key`: string = "466.l.29849"
- `league_id`: string = "29849"
- `name`: string = "皮卡丘打籃球 season 3"
- `url`: string
- `logo_url`: string
- `draft_status`: string = "postdraft"
- `num_teams`: number
- `edit_key`: string = "2025-12-11"
- `weekly_deadline`: string = "intraday"
- `roster_type`: string = "date"
- `league_update_timestamp`: string = "1765443166"
- `scoring_type`: string = "head"
- `league_type`: string = "private"
- `renew`: string = "454_83660"
- `renewed`: string = ""
- `felo_tier`: string = "silver"
- `is_highscore`: boolean
- `matchup_week`: number
- `iris_group_chat_id`: string = ""
- `short_invitation_url`: string

**Subresource Structure:**
```json
{
  "teams": {
    "0": {
      "team": [
        [
          {
            "team_key": "466.l.29849.t.1"
          },
          {
            "team_id": "1"
          },
          {
            "name": "Amen Giddey"
          },
          [],
          {
            "url": "https://basketball.fantasysports.yahoo.com/nba/29849/1"
          },
          {
            "team_logos": [
              {
                "team_logo": {
                  "size": "large",
                  "url": "https://yahoofantasysports-res.cloudinary.com/image/upload/t_s192sq/fantasy-logos/d04437c7cbf446cab7cd2f941fd75ac57f77d3bf9057d76471ccd669a7120d11.jpg"
                }
              }
            ]
          },
          {
            "previous_season_team_rank": 1
          },
          [],
          {
            "waiver_priority": 1
          },
          {
            "faab_balance": "81"
          },
          {
            "number_of_moves": 29
          },
          {
            "number_of_tr
```

**Key Observations:**
- Array found at path: fantasy_content.league
- Yahoo array pattern detected at fantasy_content.league: [0] = properties, [1] = subresources

---

### transactions

**Endpoint:** `/fantasy/v2/league/{league_key}/transactions`

**Response File:** `01-nba-2025-transactions-raw.json`

**Response Structure:**

```json
{
  "fantasy_content": {
    "league": [
      { /* Properties: league_key, name, current_week, etc. */ },
      { /* Subresources: transactions */ }
    ]
  }
}

```

**League Properties Available:**
- `league_key`: string = "466.l.29849"
- `league_id`: string = "29849"
- `name`: string = "皮卡丘打籃球 season 3"
- `url`: string
- `logo_url`: string
- `draft_status`: string = "postdraft"
- `num_teams`: number
- `edit_key`: string = "2025-12-11"
- `weekly_deadline`: string = "intraday"
- `roster_type`: string = "date"
- `league_update_timestamp`: string = "1765443166"
- `scoring_type`: string = "head"
- `league_type`: string = "private"
- `renew`: string = "454_83660"
- `renewed`: string = ""
- `felo_tier`: string = "silver"
- `is_highscore`: boolean
- `matchup_week`: number
- `iris_group_chat_id`: string = ""
- `short_invitation_url`: string

**Subresource Structure:**
```json
{
  "transactions": {
    "0": {
      "transaction": [
        {
          "transaction_key": "466.l.29849.tr.447",
          "transaction_id": "447",
          "type": "drop",
          "status": "successful",
          "timestamp": "1765465601"
        },
        {
          "players": {
            "0": {
              "player": [
                [
                  {
                    "player_key": "466.p.6704"
                  },
                  {
                    "player_id": "6704"
                  },
                  {
                    "name": {
                      "full": "Ochai Agbaji",
                      "first": "Ochai",
                      "last": "Agbaji",
                      "ascii_first": "Ochai",
                      "ascii_last": "Agbaji"
                    }
                  },
                  {
                    "editorial_team_abbr": "TOR"
                  },
                  {
                    "display_position": "SG,SF"
        
```

**Key Observations:**
- Array found at path: fantasy_content.league
- Yahoo array pattern detected at fantasy_content.league: [0] = properties, [1] = subresources

---

## Team Endpoints

### matchups

**Endpoint:** `/fantasy/v2/team/{team_key}/matchups`

**Response File:** `10-03-team-3-matchups-raw.json`

**Response Structure:**

```json
{
  "fantasy_content": {
    "team": [
      [ /* Array of property objects */ ],
      { /* Subresources */ }
    ]
  }
}

```

**Team Properties (from team[0] array):**
- `team[0][0].team_key`: string
- `team[0][1].team_id`: string
- `team[0][2].name`: string
- `team[0][4].url`: string
- `team[0][5].team_logos`: object
- `team[0][6].previous_season_team_rank`: number
- `team[0][8].waiver_priority`: number
- `team[0][9].faab_balance`: string

**Subresources (team[1]):**
```json
{
  "matchups": {
    "0": {
      "matchup": {
        "0": {
          "teams": {
            "0": {
              "team": [
                [
                  {
                    "team_key": "466.l.29849.t.3"
                  },
                  {
                    "team_id": "3"
                  },
                  {
                    "name": "JC醫🐲"
                  },
                  [],
                  {
                    "url": "https://basketball.fantasysports.yahoo.com/nba/29849/3"
                  },
                  {
                    "team_logos": [
                      {
                        "team_logo": {
                          "size": "large",
                          "url": "https://s.yimg.com/ep/cx/blendr/v2/image-dog-1-png_1726867419738.png"
                        }
                      }
                    ]
                  },
                  {
                    "previous_season_team_rank": 13
                  },
                  [],
                  {
                    "waiver_priority": 12
                  },
                  {
                    "faab_balance": "57"
                  },
                  {
                    "number_of_moves": 34
                  },
                  {
                    "number_of_trades": "1"
                  },
                  {
                    "roster_adds": {
                      "coverage_type": "week",
                      "coverage_value": 8,
          
```

**Key Observations:**
- Array found at path: fantasy_content.team
- Yahoo array pattern detected at fantasy_content.team: [0] = properties, [1] = subresources
- Array found at path: fantasy_content.team[0]
- Yahoo array pattern detected at fantasy_content.team[0]: [0] = properties, [1] = subresources

---

### roster

**Endpoint:** `/fantasy/v2/team/{team_key}/roster`

**Response File:** `10-03-team-3-roster-raw.json`

**Response Structure:**

```json
{
  "fantasy_content": {
    "team": [
      [ /* Array of property objects */ ],
      { /* Subresources */ }
    ]
  }
}

```

**Team Properties (from team[0] array):**
- `team[0][0].team_key`: string
- `team[0][1].team_id`: string
- `team[0][2].name`: string
- `team[0][4].url`: string
- `team[0][5].team_logos`: object
- `team[0][6].previous_season_team_rank`: number
- `team[0][8].waiver_priority`: number
- `team[0][9].faab_balance`: string

**Subresources (team[1]):**
```json
{
  "roster": {
    "0": {
      "players": {
        "0": {
          "player": [
            [
              {
                "player_key": "466.p.5842"
              },
              {
                "player_id": "5842"
              },
              {
                "name": {
                  "full": "Derrick White",
                  "first": "Derrick",
                  "last": "White",
                  "ascii_first": "Derrick",
                  "ascii_last": "White"
                }
              },
              {
                "url": "https://sports.yahoo.com/nba/players/5842"
              },
              {
                "editorial_player_key": "nba.p.5842"
              },
              {
                "editorial_team_key": "nba.t.2"
              },
              {
                "editorial_team_full_name": "Boston Celtics"
              },
              {
                "editorial_team_abbr": "BOS"
              },
              {
                "editorial_team_url": "https://sports.yahoo.com/nba/teams/boston/"
              },
              {
                "is_keeper": {
                  "status": false,
                  "cost": false,
                  "kept": false
                }
              },
              {
                "uniform_number": "9"
              },
              {
                "display_position": "PG,SG"
              },
              {
                "headshot": {
                  "url": "https://s.yimg.com/iu/ap
```

**Key Observations:**
- Array found at path: fantasy_content.team
- Yahoo array pattern detected at fantasy_content.team: [0] = properties, [1] = subresources
- Array found at path: fantasy_content.team[0]
- Yahoo array pattern detected at fantasy_content.team[0]: [0] = properties, [1] = subresources

---

### roster (week=1)

**Endpoint:** `/fantasy/v2/team/{team_key}/roster;week=1`

**Response File:** `10-03-team-3-roster-week1-raw.json`

**Response Structure:**

```json
{
  "fantasy_content": {
    "team": [
      [ /* Array of property objects */ ],
      { /* Subresources */ }
    ]
  }
}

```

**Team Properties (from team[0] array):**
- `team[0][0].team_key`: string
- `team[0][1].team_id`: string
- `team[0][2].name`: string
- `team[0][4].url`: string
- `team[0][5].team_logos`: object
- `team[0][6].previous_season_team_rank`: number
- `team[0][8].waiver_priority`: number
- `team[0][9].faab_balance`: string

**Subresources (team[1]):**
```json
{
  "roster": {
    "0": {
      "players": {
        "0": {
          "player": [
            [
              {
                "player_key": "466.p.6721"
              },
              {
                "player_id": "6721"
              },
              {
                "name": {
                  "full": "Andrew Nembhard",
                  "first": "Andrew",
                  "last": "Nembhard",
                  "ascii_first": "Andrew",
                  "ascii_last": "Nembhard"
                }
              },
              {
                "url": "https://sports.yahoo.com/nba/players/6721"
              },
              {
                "editorial_player_key": "nba.p.6721"
              },
              {
                "editorial_team_key": "nba.t.11"
              },
              {
                "editorial_team_full_name": "Indiana Pacers"
              },
              {
                "editorial_team_abbr": "IND"
              },
              {
                "editorial_team_url": "https://sports.yahoo.com/nba/teams/indiana/"
              },
              {
                "is_keeper": {
                  "status": false,
                  "cost": false,
                  "kept": false
                }
              },
              {
                "uniform_number": "2"
              },
              {
                "display_position": "PG,SG"
              },
              {
                "headshot": {
                  "url": "https://s.yimg.c
```

**Key Observations:**
- Array found at path: fantasy_content.team
- Yahoo array pattern detected at fantasy_content.team: [0] = properties, [1] = subresources
- Array found at path: fantasy_content.team[0]
- Yahoo array pattern detected at fantasy_content.team[0]: [0] = properties, [1] = subresources

---

### stats (type=season)

**Endpoint:** `/fantasy/v2/team/{team_key}/stats;type=season`

**Response File:** `10-03-team-3-stats-season-raw.json`

**Response Structure:**

```json
{
  "fantasy_content": {
    "team": [
      [ /* Array of property objects */ ],
      { /* Subresources */ }
    ]
  }
}

```

**Team Properties (from team[0] array):**
- `team[0][0].team_key`: string
- `team[0][1].team_id`: string
- `team[0][2].name`: string
- `team[0][4].url`: string
- `team[0][5].team_logos`: object
- `team[0][6].previous_season_team_rank`: number
- `team[0][8].waiver_priority`: number
- `team[0][9].faab_balance`: string

**Subresources (team[1]):**
```json
{
  "team_stats": {
    "coverage_type": "season",
    "season": "2025",
    "stats": [
      {
        "stat": {
          "stat_id": "9004003",
          "value": "1644/3447"
        }
      },
      {
        "stat": {
          "stat_id": "5",
          "value": ".477"
        }
      },
      {
        "stat": {
          "stat_id": "9007006",
          "value": "720/925"
        }
      },
      {
        "stat": {
          "stat_id": "8",
          "value": ".778"
        }
      },
      {
        "stat": {
          "stat_id": "10",
          "value": "551"
        }
      },
      {
        "stat": {
          "stat_id": "12",
          "value": "4559"
        }
      },
      {
        "stat": {
          "stat_id": "15",
          "value": "1698"
        }
      },
      {
        "stat": {
          "stat_id": "16",
          "value": "1005"
        }
      },
      {
        "stat": {
          "stat_id": "17",
          "value": "282"
        }
      },
      {
        "stat": {
          "stat_id": "18",
          "value": "210"
        }
      },
      {
        "stat": {
          "stat_id": "19",
          "value": "505"
        }
      }
    ]
  },
  "team_points": {
    "coverage_type": "season",
    "season": "2025",
    "total": ""
  }
}
```

**Key Observations:**
- Array found at path: fantasy_content.team
- Yahoo array pattern detected at fantasy_content.team: [0] = properties, [1] = subresources
- Array found at path: fantasy_content.team[0]
- Yahoo array pattern detected at fantasy_content.team[0]: [0] = properties, [1] = subresources

---

### stats

**Endpoint:** `/fantasy/v2/team/{team_key}/stats`

**Response File:** `test-team-stats-date-raw.json`

**Response Structure:**

```json
{
  "fantasy_content": {
    "team": [
      [ /* Array of property objects */ ],
      { /* Subresources */ }
    ]
  }
}

```

**Team Properties (from team[0] array):**
- `team[0][0].team_key`: string
- `team[0][1].team_id`: string
- `team[0][2].name`: string
- `team[0][4].url`: string
- `team[0][5].team_logos`: object
- `team[0][6].previous_season_team_rank`: number
- `team[0][8].waiver_priority`: number
- `team[0][9].faab_balance`: string

**Subresources (team[1]):**
```json
{
  "team_stats": {
    "coverage_type": "date",
    "date": "2025-12-11",
    "stats": [
      {
        "stat": {
          "stat_id": "9004003",
          "value": "-/-"
        }
      },
      {
        "stat": {
          "stat_id": 5,
          "value": "-"
        }
      },
      {
        "stat": {
          "stat_id": "9007006",
          "value": "-/-"
        }
      },
      {
        "stat": {
          "stat_id": 8,
          "value": "-"
        }
      },
      {
        "stat": {
          "stat_id": 10,
          "value": "-"
        }
      },
      {
        "stat": {
          "stat_id": 12,
          "value": "-"
        }
      },
      {
        "stat": {
          "stat_id": 15,
          "value": "-"
        }
      },
      {
        "stat": {
          "stat_id": 16,
          "value": "-"
        }
      },
      {
        "stat": {
          "stat_id": 17,
          "value": "-"
        }
      },
      {
        "stat": {
          "stat_id": 18,
          "value": "-"
        }
      },
      {
        "stat": {
          "stat_id": 19,
          "value": "-"
        }
      }
    ]
  }
}
```

**Key Observations:**
- Array found at path: fantasy_content.team
- Yahoo array pattern detected at fantasy_content.team: [0] = properties, [1] = subresources
- Array found at path: fantasy_content.team[0]
- Yahoo array pattern detected at fantasy_content.team[0]: [0] = properties, [1] = subresources

---

## Player Endpoints

### metadata

**Endpoint:** `/fantasy/v2/player/{player_key}/metadata`

**Response File:** `test-player-info-raw.json`

**Response Structure:**

```json
{
  "fantasy_content": {
    "player": [
      [ /* Array of property objects */ ],
      { /* Subresources: stats, etc. */ }
    ]
  }
}

```

**Key Observations:**
- Array found at path: fantasy_content.player
- Array found at path: fantasy_content.player[0]
- Yahoo array pattern detected at fantasy_content.player[0]: [0] = properties, [1] = subresources

---

### stats (type=lastmonth)

**Endpoint:** `/fantasy/v2/player/{player_key}/stats;type=lastmonth`

**Response File:** `test-player-stats-lastmonth-raw.json`

**Response Structure:**

```json
{
  "fantasy_content": {
    "player": [
      [ /* Array of property objects */ ],
      { /* Subresources: stats, etc. */ }
    ]
  }
}

```

**Key Observations:**
- Array found at path: fantasy_content.player
- Yahoo array pattern detected at fantasy_content.player: [0] = properties, [1] = subresources
- Array found at path: fantasy_content.player[0]
- Yahoo array pattern detected at fantasy_content.player[0]: [0] = properties, [1] = subresources

---

### stats (type=week)

**Endpoint:** `/fantasy/v2/player/{player_key}/stats;type=week`

**Response File:** `test-player-stats-lastweek-raw.json`

**Response Structure:**

```json
{
  "fantasy_content": {
    "player": [
      [ /* Array of property objects */ ],
      { /* Subresources: stats, etc. */ }
    ]
  }
}

```

**Key Observations:**
- Array found at path: fantasy_content.player
- Yahoo array pattern detected at fantasy_content.player: [0] = properties, [1] = subresources
- Array found at path: fantasy_content.player[0]
- Yahoo array pattern detected at fantasy_content.player[0]: [0] = properties, [1] = subresources

---

### stats

**Endpoint:** `/fantasy/v2/player/{player_key}/stats`

**Response File:** `test-player-stats-season-raw.json`

**Response Structure:**

```json
{
  "fantasy_content": {
    "player": [
      [ /* Array of property objects */ ],
      { /* Subresources: stats, etc. */ }
    ]
  }
}

```

**Key Observations:**
- Array found at path: fantasy_content.player
- Yahoo array pattern detected at fantasy_content.player: [0] = properties, [1] = subresources
- Array found at path: fantasy_content.player[0]
- Yahoo array pattern detected at fantasy_content.player[0]: [0] = properties, [1] = subresources

---

### stats (type=week;week=1)

**Endpoint:** `/fantasy/v2/player/{player_key}/stats;type=week;week=1`

**Response File:** `test-player-stats-week1-raw.json`

**Response Structure:**

```json
{
  "fantasy_content": {
    "player": [
      [ /* Array of property objects */ ],
      { /* Subresources: stats, etc. */ }
    ]
  }
}

```

**Key Observations:**
- Array found at path: fantasy_content.player
- Array found at path: fantasy_content.player[0]
- Yahoo array pattern detected at fantasy_content.player[0]: [0] = properties, [1] = subresources

---

## Common Patterns

### 1. Array Structure Pattern

Yahoo API uses arrays where:
- `[0]` contains properties (array of objects, each object has one property)
- `[1]` contains subresources (object with nested data)

**Example from League Settings:**
```json
{
  "fantasy_content": {
    "league": [
      [
        { "league_key": "466.l.29849" },
        { "league_id": "29849" },
        { "name": "..." },
        { "current_week": 8 },
        // ... more property objects
      ],
      {
        "settings": [ /* settings data */ ]
      }
    ]
  }
}

```

### 2. Numeric String Keys Pattern

Collections use numeric string keys (`"0"`, `"1"`, etc.) instead of arrays:

```json
{
  "teams": {
    "0": { "team": [...] },
    "1": { "team": [...] },
    "count": 14
  }
}

```

### 3. Property Objects Pattern

Properties are stored as individual objects in an array:

```json
[
  { "team_key": "466.l.29849.t.3" },
  { "team_id": "3" },
  { "name": "JC醫🐲" },
  [],  // Empty arrays are used as placeholders
  { "url": "..." }
]

```

## Data Extraction Examples

### Extracting League Current Week

```typescript
const settings = await client.getRawApiResponse(`/league/${leagueKey}/settings`);
const currentWeek = settings?.fantasy_content?.league?.[0]?.current_week;
// Note: league[0] is an object, not an array

```

### Extracting Team Keys from Standings

```typescript
const standings = await client.getRawApiResponse(`/league/${leagueKey}/standings`);
const teams = standings?.fantasy_content?.league?.[1]?.standings?.[0]?.teams;
const teamKeys: string[] = [];
const teamIndexKeys = Object.keys(teams).filter(key => key !== "count" && !isNaN(Number(key)));
for (const teamIndexKey of teamIndexKeys) {
  const teamData = teams[teamIndexKey];
  const teamProps = Array.isArray(teamData.team[0]) ? teamData.team[0] : [teamData.team[0]];
  const teamKeyObj = teamProps.find((prop: any) => prop?.team_key);
  if (teamKeyObj?.team_key) {
    teamKeys.push(teamKeyObj.team_key);
  }
}

```

### Extracting Player Keys from Roster

```typescript
const roster = await client.getRawApiResponse(`/team/${teamKey}/roster`);
const rosterData = roster?.fantasy_content?.team;
const playerKeys: string[] = [];
if (Array.isArray(rosterData) && rosterData[1]?.roster) {
  const rosterObj = rosterData[1].roster;
  const positionKeys = Object.keys(rosterObj).filter(key => key !== "count" && !isNaN(Number(key)));
  for (const positionKey of positionKeys) {
    const positionData = rosterObj[positionKey];
    if (positionData?.players) {
      const players = positionData.players;
      const playerIndexKeys = Object.keys(players).filter(key => key !== "count" && !isNaN(Number(key)));
      for (const playerIndexKey of playerIndexKeys) {
        const playerData = players[playerIndexKey];
        if (playerData?.player && Array.isArray(playerData.player) && playerData.player[0]) {
          const playerProps = Array.isArray(playerData.player[0]) ? playerData.player[0] : [playerData.player[0]];
          const playerKeyObj = playerProps.find((prop: any) => prop?.player_key);
          if (playerKeyObj?.player_key) {
            playerKeys.push(playerKeyObj.player_key);
          }
        }
      }
    }
  }
}

```

