import type { Locator, Page } from "@playwright/test";
import {
  boxOf,
  sidewaysOverflow,
  MY_TEAM,
  accessibilityViolations,
  newPageAtTestTime,
  setScenario,
  signIn,
  useTheme,
  expect,
  test,
} from "./support";

/**
 * Matchup from the lg breakpoint (FAN-152): score card and day bar across the
 * top, the totals grid with the player details panel under it on the left, and
 * both teams' players on the right. The phone layout is covered by matchup.spec.ts.
 */
const DESKTOP = { tag: "@desktop" };
const MY_COLUMN = `column-${MY_TEAM}`;

test.beforeEach(async () => {
  await setScenario("ok");
});

function panel(page: Page): Locator {
  return page.getByTestId("player-panel");
}

/** The panel's heading: the player it shows. */
function panelName(page: Page): Locator {
  return panel(page).getByRole("heading", { level: 2 });
}

/** Every row marked as the one the panel shows. */
function pickedRows(page: Page): Locator {
  return page.locator('[data-testid="player-columns"] button[aria-current="true"]');
}

/** The first counted player in your column, as its row names them. */
async function topOfMyColumn(page: Page): Promise<string> {
  const label = await page
    .getByTestId(MY_COLUMN)
    .getByTestId("counted-players")
    .getByRole("button")
    .first()
    .getAttribute("aria-label");
  return (label ?? "").replace(/: open player detail$/, "");
}

async function expectPanelShows(page: Page, name: string): Promise<void> {
  await expect(panelName(page)).toHaveText(name);
  await expect(panel(page).getByTestId("player-detail-stats")).toBeVisible();
  await expect(pickedRows(page)).toHaveCount(1);
  await expect(pickedRows(page)).toHaveAccessibleName(`${name}: open player detail`);
}

test(
  "lays out the score and days on top, totals and details on the left, players on the right",
  DESKTOP,
  async ({ page }) => {
    await signIn(page, "a", "Matchup");
    const totals = page.getByRole("region", { name: "Team totals" });
    const players = page.getByRole("region", { name: "Players side by side" });
    await expect(totals.getByTestId("totals-grid")).toBeVisible();
    await expect(panel(page)).toBeVisible();

    const [score, days, grid, details, columns] = await Promise.all([
      boxOf(page.getByTestId("matchup-header")),
      boxOf(page.getByRole("navigation", { name: "Day" })),
      boxOf(totals),
      boxOf(panel(page)),
      boxOf(players),
    ]);
    expect(days.y).toBeGreaterThan(score.y + score.height - 1);
    expect(grid.y).toBeGreaterThan(days.y + days.height - 1);
    expect(details.y).toBeGreaterThan(grid.y + grid.height - 1);
    expect(details.x).toBe(grid.x);
    expect(columns.x).toBeGreaterThan(grid.x + grid.width);
    expect(columns.y).toBe(grid.y);
    // Both teams side by side inside the right-hand card.
    const [mine, theirs] = await Promise.all([
      boxOf(page.getByTestId(MY_COLUMN)),
      boxOf(players.locator('[data-testid^="column-"]').nth(1)),
    ]);
    expect(theirs.x).toBeGreaterThan(mine.x);
    expect(theirs.y).toBe(mine.y);
    // A panel on the page, not a sheet over it.
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
);

test(
  "with no one picked, the panel shows the category's top contributor without changing the URL",
  DESKTOP,
  async ({ page }) => {
    await signIn(page, "a", "Matchup");
    await expect(page.getByTestId("counted-players").first()).toBeVisible();
    await expectPanelShows(page, await topOfMyColumn(page));
    await expect(page).toHaveURL(/\/matchup\/today$/);
  }
);

test(
  "picking a player shows them in the panel and outlines their row",
  DESKTOP,
  async ({ page }) => {
    await signIn(page, "a", "Matchup");
    await page
      .getByTestId(MY_COLUMN)
      .getByRole("button", { name: /Casey Knoll/ })
      .click();
    await expectPanelShows(page, "Casey Knoll");
    await expect(panel(page).getByRole("rowheader")).toHaveCount(9);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/matchup\/today$/);
  }
);

test(
  "picking a category re-sorts the columns and the panel follows the new top contributor",
  DESKTOP,
  async ({ page }) => {
    await signIn(page, "a", "Matchup");
    const grid = page.getByTestId("totals-grid");
    const unpicked = grid.locator('button[aria-pressed="false"]');
    for (const index of [0, 1]) {
      await unpicked.nth(index).click();
      await expect(page.getByTestId("columns-title")).toHaveText(
        new RegExp(`^${(await grid.locator('button[aria-pressed="true"]').textContent()) ?? ""}`)
      );
      await expectPanelShows(page, await topOfMyColumn(page));
    }

    // A picked player stays in the panel while they are still listed.
    await page
      .getByTestId(MY_COLUMN)
      .getByRole("button", { name: /Casey Knoll/ })
      .click();
    await unpicked.first().click();
    await expectPanelShows(page, "Casey Knoll");
  }
);

test("changing the day keeps the panel in step with the board", DESKTOP, async ({ page }) => {
  await signIn(page, "a", "Matchup");
  await page
    .getByTestId(MY_COLUMN)
    .getByRole("button", { name: /Casey Knoll/ })
    .click();
  await expectPanelShows(page, "Casey Knoll");
  const days = page.getByRole("navigation", { name: "Day" });

  await days.getByRole("link", { name: "Yesterday" }).click();
  await expect(page.getByTestId(MY_COLUMN).getByRole("listitem")).toHaveCount(13);
  await expectPanelShows(page, "Casey Knoll");
  await expect(panel(page).getByTestId("injury-tag")).toHaveCount(0);

  // Week cards don't open details on the phone, so Week has no panel either.
  await days.getByRole("link", { name: "Week" }).click();
  await expect(page.getByTestId(MY_COLUMN)).toBeVisible();
  await expect(panel(page)).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const [grid, columns] = await Promise.all([
    boxOf(page.getByRole("region", { name: "Team totals" })),
    boxOf(page.getByRole("region", { name: "Players side by side" })),
  ]);
  expect(columns.x).toBeGreaterThan(grid.x + grid.width);
});

test(
  "between md and lg the details open in the right-hand drawer, and phone width with no one picked shows no sheet",
  DESKTOP,
  async ({ page }) => {
    await signIn(page, "a", "Matchup");
    await expect(panel(page)).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("totals-grid")).toBeVisible();
    await expect(panel(page)).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.setViewportSize({ width: 900, height: 800 });
    await page
      .getByTestId(MY_COLUMN)
      .getByRole("button", { name: /Casey Knoll/ })
      .click();
    const drawer = page.getByRole("dialog", { name: "Casey Knoll" });
    await expect(drawer.getByTestId("player-detail-stats")).toBeVisible();
    // Once it has slid in, it sits against the window's right edge.
    await expect
      .poll(async () => Math.round((await boxOf(drawer)).x + (await boxOf(drawer)).width))
      .toBe(900);
  }
);

test(
  "from md the opponent picker keeps its own width instead of filling the score card",
  DESKTOP,
  async ({ page }) => {
    await signIn(page, "a", "Matchup");
    for (const width of [900, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      const picker = await boxOf(page.getByLabel("Opponent"));
      expect(picker.width, `at ${width}px`).toBeLessThanOrEqual(260);
    }
  }
);

test(
  "requests the same data at 1280 px as a phone showing the same player",
  DESKTOP,
  async ({ page, browser }) => {
    // Each endpoint with every player it was asked about. While the opponent's
    // roster loads, a page may first ask for your players alone and then for
    // both teams; whether that first request happens depends on timing, so
    // requests are compared by endpoint and players, not one by one.
    const requested = (target: Page) => {
      const endpoints = new Map<string, Set<string>>();
      target.on("request", (request) => {
        const url = new URL(request.url());
        if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/dev/")) {
          const players = url.searchParams.get("players")?.split(",") ?? [];
          url.searchParams.delete("players");
          const endpoint = `${request.method()} ${url.pathname}${url.search}`;
          const asked = endpoints.get(endpoint) ?? new Set<string>();
          players.forEach((player) => asked.add(player));
          endpoints.set(endpoint, asked);
        }
      });
      return endpoints;
    };
    const sorted = (endpoints: Map<string, Set<string>>) =>
      [...endpoints].map(([endpoint, players]) => [endpoint, [...players].sort()]).sort();

    const desktop = requested(page);
    await signIn(page, "a", "Matchup");
    await expect(panel(page).getByTestId("player-detail-stats")).toBeVisible();
    const shown = await panelName(page).textContent();
    await page.waitForLoadState("networkidle");

    const phonePage = await newPageAtTestTime(browser, {
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    const phone = requested(phonePage);
    await signIn(phonePage, "a", "Matchup");
    await phonePage
      .getByTestId(MY_COLUMN)
      .getByRole("button", { name: `${shown}: open player detail` })
      .click();
    await expect(phonePage.getByRole("dialog").getByTestId("player-detail-stats")).toBeVisible();
    await phonePage.waitForLoadState("networkidle");
    await phonePage.close();

    expect(sorted(desktop)).toEqual(sorted(phone));
  }
);

test(
  "a failed week table shows its error above the score and in the panel, and one retry clears both",
  DESKTOP,
  async ({ page }) => {
    await signIn(page, "a", "Matchup");
    await setScenario("unavailable");
    await page.reload();
    await expect(page.getByTestId("matchup-top").getByRole("alert")).toBeVisible();
    await expect(panel(page).getByRole("alert")).toBeVisible();
    await expect(page.getByTestId(MY_COLUMN)).toBeVisible();

    await setScenario("ok");
    await page.getByTestId("matchup-top").getByRole("button", { name: "Try again" }).click();
    await expect(page.getByTestId("totals-grid")).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(panel(page).getByTestId("player-detail-stats")).toBeVisible();
  }
);

test(
  "every row and control is reachable by keyboard, with a visible focus ring",
  DESKTOP,
  async ({ page }) => {
    await signIn(page, "a", "Matchup");
    await expect(page.getByTestId("counted-players").first()).toBeVisible();
    const rows = await page
      .getByTestId("player-columns")
      .getByRole("button", { name: /open player detail/ })
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label") ?? ""));
    await page.getByTestId("totals-grid").getByRole("button").first().focus();
    const order: string[] = [];
    while (order.at(-1) !== rows.at(-1) && order.length < 150) {
      const focused = await page.evaluate(() => {
        const element = document.activeElement;
        return element instanceof HTMLElement && element !== document.body
          ? {
              label: element.getAttribute("aria-label") ?? element.textContent ?? "",
              ring: window.getComputedStyle(element).boxShadow,
              inPanel: element.closest("[data-testid=player-panel]") !== null,
            }
          : null;
      });
      expect(focused, `focus after ${order.at(-1)}`).not.toBeNull();
      if (focused === null) {
        break;
      }
      expect(focused.ring, `focus ring on ${focused.label}`).not.toBe("none");
      order.push(focused.inPanel ? "panel" : focused.label);
      await page.keyboard.press("Tab");
    }
    // The grid, then the panel, then every player in column order.
    const reached = order.filter((label) => label.endsWith("open player detail"));
    expect(reached).toEqual(rows);
    expect(order.indexOf(rows[0])).toBeGreaterThan(order.lastIndexOf("panel"));
  }
);

test(
  "follows a league's ten categories without pushing the page sideways",
  DESKTOP,
  async ({ page }) => {
    await setScenario("ok", undefined, "12x10");
    try {
      await signIn(page, "a", "Matchup");
      await expect(page.getByTestId("totals-grid").getByRole("button")).toHaveCount(10);
      await page.getByTestId("totals-grid").getByRole("button", { name: /^PF,/ }).click();
      await expect(page.getByTestId("columns-title")).toHaveText("PF · Today");
      await expectPanelShows(page, await topOfMyColumn(page));
      await expect(panel(page).getByRole("rowheader")).toHaveCount(10);
      expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
    } finally {
      await setScenario("ok");
    }
  }
);

for (const theme of ["light", "dark"] as const) {
  test(
    `Matchup with the details panel has no WCAG 2.1 AA violations in the ${theme} theme`,
    DESKTOP,
    async ({ page }) => {
      await useTheme(page, theme);
      await signIn(page, "a", "Matchup");
      await expect(panel(page).getByTestId("player-detail-stats")).toBeVisible();
      expect(await accessibilityViolations(page)).toEqual([]);
    }
  );
}
