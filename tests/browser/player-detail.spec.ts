import {
  MY_TEAM,
  accessibilityViolations,
  openScreen,
  setScenario,
  signIn,
  useTheme,
  expect,
  test,
} from "./support";
import type { Page } from "@playwright/test";

test.beforeEach(async () => {
  await setScenario("ok");
});

const MY_COLUMN = `column-${MY_TEAM}`;

/** From lg Matchup shows the details in a panel, not a sheet: matchup-desktop.spec.ts covers it. */
const PHONE = { tag: "@phone" };

/** Opens a player's detail from a list and waits for its stats. */
async function openPlayer(page: Page, list: string, name: string) {
  await page
    .getByTestId(list)
    .getByRole("button", { name: new RegExp(name) })
    .click();
  const sheet = page.getByRole("dialog", { name });
  await expect(sheet.getByTestId("player-detail-stats")).toBeVisible();
  return sheet;
}

test(
  "opens an injured player from Matchup with today's tag and every category",
  PHONE,
  async ({ page }) => {
    await signIn(page, "a", "Matchup");

    const roster = page.getByTestId(MY_COLUMN);
    await expect(roster.getByRole("link", { name: /GTD, Ankle/ })).toBeVisible();
    const sheet = await openPlayer(page, MY_COLUMN, "Casey Knoll");
    await expect(sheet.getByRole("rowheader")).toHaveCount(9);
    await expect(sheet.getByRole("link", { name: /GTD, Ankle/ })).toHaveAttribute(
      "href",
      /sports\.yahoo\.com\/nba\/players\/\d+\/$/
    );
    await expect(sheet.getByRole("region", { name: "Recent games" })).toBeVisible();

    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
);

test("puts focus back on the player's row when the sheet closes", PHONE, async ({ page }) => {
  await signIn(page, "a", "Matchup");
  const row = page.getByTestId(MY_COLUMN).getByRole("button", { name: /Casey Knoll/ });

  await row.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Casey Knoll" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(row).toBeFocused();
});

test("shows no game today for a player whose team is off", PHONE, async ({ page }) => {
  await signIn(page, "a", "Matchup");

  const sheet = await openPlayer(page, MY_COLUMN, "Devon Knoll");
  await expect(sheet.getByTestId("player-detail-status-today")).toHaveText("No game");
});

test("never shows the injury tag on yesterday's view", PHONE, async ({ page }) => {
  await signIn(page, "a", "Matchup");
  await page
    .getByRole("navigation", { name: "Day" })
    .getByRole("link", { name: "Yesterday" })
    .click();

  const roster = page.getByTestId(MY_COLUMN);
  await expect(roster.getByRole("listitem")).toHaveCount(13);
  await expect(roster.getByTestId("injury-tag")).toHaveCount(0);
  const sheet = await openPlayer(page, MY_COLUMN, "Casey Knoll");
  await expect(sheet.getByTestId("injury-tag")).toHaveCount(0);
});

test("opens an available player from Players", async ({ page }) => {
  await signIn(page, "a", "Players");

  const first = page.getByTestId("players-list").getByRole("button").first();
  const name = (await first.textContent()) ?? "";
  await first.click();
  const sheet = page.getByRole("dialog", { name });
  await expect(sheet.getByTestId("player-detail-stats")).toBeVisible();
  await expect(sheet.getByRole("rowheader")).toHaveCount(9);
});

for (const theme of ["light", "dark"] as const) {
  test(
    `the player detail has no WCAG 2.1 AA violations in the ${theme} theme`,
    PHONE,
    async ({ page }) => {
      await useTheme(page, theme);
      await signIn(page, "a", "Matchup");
      await openPlayer(page, MY_COLUMN, "Casey Knoll");

      expect(await accessibilityViolations(page)).toEqual([]);
    }
  );
}

test("Players with the detail open has no WCAG 2.1 AA violations", async ({ page }) => {
  await signIn(page, "a", "Matchup");
  await openScreen(page, "Players");
  await page.getByTestId("players-list").getByRole("button").first().click();
  await expect(page.getByTestId("player-detail-stats")).toBeVisible();

  expect(await accessibilityViolations(page)).toEqual([]);
});
