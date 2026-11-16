import type { Locator, Page } from "@playwright/test";
import {
  MY_TEAM,
  accessibilityViolations,
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

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.viewport);
}

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  if (!found) {
    throw new Error("the element is not on the page");
  }
  return found;
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
      box(page.getByTestId("matchup-header")),
      box(page.getByRole("navigation", { name: "Day" })),
      box(totals),
      box(panel(page)),
      box(players),
    ]);
    expect(days.y).toBeGreaterThan(score.y + score.height - 1);
    expect(grid.y).toBeGreaterThan(days.y + days.height - 1);
    expect(details.y).toBeGreaterThan(grid.y + grid.height - 1);
    expect(details.x).toBe(grid.x);
    expect(columns.x).toBeGreaterThan(grid.x + grid.width);
    expect(columns.y).toBe(grid.y);
    // Both teams side by side inside the right-hand card.
    const [mine, theirs] = await Promise.all([
      box(page.getByTestId(MY_COLUMN)),
      box(players.locator('[data-testid^="column-"]').nth(1)),
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
    box(page.getByRole("region", { name: "Team totals" })),
    box(page.getByRole("region", { name: "Players side by side" })),
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
      .poll(async () => Math.round((await box(drawer)).x + (await box(drawer)).width))
      .toBe(900);
  }
);

test(
  "requests the same data at 1280 px as a phone showing the same player",
  DESKTOP,
  async ({ page }) => {
    const requested = (target: Page) => {
      const paths = new Set<string>();
      target.on("request", (request) => {
        const url = new URL(request.url());
        if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/dev/")) {
          paths.add(`${request.method()} ${url.pathname}${url.search}`);
        }
      });
      return paths;
    };

    const desktop = requested(page);
    await signIn(page, "a", "Matchup");
    await expect(panel(page).getByTestId("player-detail-stats")).toBeVisible();
    const shown = await panelName(page).textContent();
    await page.waitForLoadState("networkidle");

    const phonePage = await page
      .context()
      .browser()
      ?.newPage({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
      });
    if (!phonePage) {
      throw new Error("could not open a second page");
    }
    const phone = requested(phonePage);
    await signIn(phonePage, "a", "Matchup");
    await phonePage
      .getByTestId(MY_COLUMN)
      .getByRole("button", { name: `${shown}: open player detail` })
      .click();
    await expect(phonePage.getByRole("dialog").getByTestId("player-detail-stats")).toBeVisible();
    await phonePage.waitForLoadState("networkidle");
    await phonePage.close();

    expect([...desktop].sort()).toEqual([...phone].sort());
  }
);

test("has no sideways page scroll from 320 to 1920 px", DESKTOP, async ({ page }) => {
  await signIn(page, "a", "Matchup");
  await expect(page.getByTestId(MY_COLUMN)).toBeVisible();
  for (const width of [320, 390, 768, 900, 1099, 1100, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByTestId("totals-grid")).toBeVisible();
    await expectNoHorizontalScroll(page);
  }
});

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
      await expectNoHorizontalScroll(page);
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
