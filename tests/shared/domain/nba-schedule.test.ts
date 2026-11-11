import { describe, expect, it } from "vitest";
import { scheduleByTeam, teamSchedule, type ScheduledGame } from "../../../shared/domain";

const WEEK = { start: "2026-11-09", end: "2026-11-15" };
const NEW_YORK = "America/New_York";
const LOS_ANGELES = "America/Los_Angeles";

/** Lakers-style schedule: Tuesday 10:30 pm Eastern (7:30 pm Pacific), Wednesday 7:30 pm Eastern, Saturday. */
const GAMES: ScheduledGame[] = [
  { date: "2026-11-09", state: { tipOff: "2026-11-10T00:00:00Z" } },
  { date: "2026-11-10", state: { tipOff: "2026-11-11T03:30:00Z" } },
  { date: "2026-11-11", state: { tipOff: "2026-11-12T00:30:00Z" } },
  { date: "2026-11-14", state: { tipOff: "2026-11-15T01:00:00Z" } },
  { date: "2026-11-16", state: { tipOff: "2026-11-17T00:30:00Z" } },
];

function at(iso: string, timeZone: string) {
  return { now: Date.parse(iso), timeZone, week: WEEK };
}

describe("schedule filters", () => {
  it("finds tonight, tomorrow and a back-to-back from tip-off in the viewer's time zone", () => {
    expect(teamSchedule(GAMES, at("2026-11-10T20:00:00Z", NEW_YORK))).toEqual({
      tonight: true,
      tomorrow: true,
      backToBack: true,
      gamesLeftThisWeek: 3,
    });
  });

  it("moves to the next day at midnight Eastern for a New York viewer", () => {
    const before = teamSchedule(GAMES, at("2026-11-11T04:59:00Z", NEW_YORK));
    const after = teamSchedule(GAMES, at("2026-11-11T05:01:00Z", NEW_YORK));
    // Tuesday's late tip-off is 10:30 pm Eastern, so it is still tonight just before midnight.
    expect(before).toMatchObject({ tonight: true, tomorrow: true, backToBack: true });
    expect(after).toMatchObject({ tonight: true, tomorrow: false, backToBack: false });
  });

  it("keeps a Pacific viewer on their own evening after midnight Eastern", () => {
    // 11:30 pm Tuesday Pacific is 2:30 am Wednesday Eastern; the 7:30 pm Pacific game is still tonight.
    const late = teamSchedule(GAMES, at("2026-11-11T07:30:00Z", LOS_ANGELES));
    expect(late).toMatchObject({ tonight: true, tomorrow: true, backToBack: true });
    const afterMidnight = teamSchedule(GAMES, at("2026-11-11T08:01:00Z", LOS_ANGELES));
    expect(afterMidnight).toMatchObject({ tonight: true, tomorrow: false, backToBack: false });
  });

  it("dates a game by its Pacific tip-off, so a 4:30 pm Pacific start on Wednesday is not Tuesday", () => {
    const tuesdayEvening = teamSchedule(GAMES, at("2026-11-11T03:00:00Z", LOS_ANGELES));
    expect(tuesdayEvening.tonight).toBe(true);
    expect(tuesdayEvening.tomorrow).toBe(true);
  });

  it("counts games left from today's Eastern date to the end of the scoring week", () => {
    expect(teamSchedule(GAMES, at("2026-11-09T15:00:00Z", NEW_YORK)).gamesLeftThisWeek).toBe(4);
    expect(teamSchedule(GAMES, at("2026-11-12T15:00:00Z", NEW_YORK)).gamesLeftThisWeek).toBe(1);
    expect(teamSchedule(GAMES, at("2026-11-15T15:00:00Z", NEW_YORK)).gamesLeftThisWeek).toBe(0);
  });

  it("counts the whole week when the week hasn't started yet", () => {
    const sunday = { now: Date.parse("2026-11-08T15:00:00Z"), timeZone: NEW_YORK, week: WEEK };
    expect(teamSchedule(GAMES, sunday).gamesLeftThisWeek).toBe(4);
  });

  it("says an idle team plays neither night", () => {
    expect(teamSchedule([], at("2026-11-10T20:00:00Z", NEW_YORK))).toEqual({
      tonight: false,
      tomorrow: false,
      backToBack: false,
      gamesLeftThisWeek: 0,
    });
  });

  it("maps every listed team and leaves unlisted teams unknown", () => {
    const map = scheduleByTeam(
      [
        { nbaTeam: "LAL", games: GAMES },
        { nbaTeam: "BOS", games: [] },
      ],
      at("2026-11-10T20:00:00Z", NEW_YORK)
    );
    expect(map.get("LAL")?.backToBack).toBe(true);
    expect(map.get("BOS")?.tonight).toBe(false);
    expect(map.has("PHX")).toBe(false);
  });
});
