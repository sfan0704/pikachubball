import type { Locator, Page } from "@playwright/test";
import { accessibilityViolations, setScenario, signIn, useTheme, expect, test } from "./support";

/**
 * Players from md and lg (FAN-153): the filters in a toolbar, the cards as
 * table rows under one header, and from lg the details panel beside the list.
 */
test.use({ timezoneId: "America/New_York" });

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };
const TAG = { tag: "@desktop" };

test.beforeEach(async () => {
  await setScenario("ok");
});

function rows(page: Page): Locator {
  return page.getByTestId("players-list").getByRole("listitem");
}

function toolbarGroup(page: Page, name: string): Locator {
  return page.getByRole("group", { name });
}

/** The panel beside the list: a region named by the player it shows. */
function panel(page: Page): Locator {
  return page.locator("section[data-testid=player-detail]");
}

/** Opens Players and waits for the page, its averages and the panel's stats. */
async function openPlayers(page: Page) {
  await signIn(page, "a", "Players");
  await expect(rows(page)).toHaveCount(25);
  await expect(rows(page).first().getByTestId("player-averages")).not.toContainText("—");
  await expect(panel(page).getByTestId("player-detail-stats")).toBeVisible();
}

function nameButton(row: Locator): Locator {
  return row.getByRole("button").first();
}

async function sidewaysOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

/** The API calls the page made, without the host, sorted and deduplicated. */
function recordApiCalls(page: Page): () => string[] {
  const calls = new Set<string>();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/leagues/")) {
      calls.add(`${url.pathname}${url.search}`);
    }
  });
  return () => [...calls].sort();
}

test(
  "from lg the panel shows the first player until one is picked, and the picked row is marked",
  TAG,
  async ({ page }) => {
    await openPlayers(page);
    const first = nameButton(rows(page).first());
    const firstName = (await first.textContent()) ?? "";
    await expect(page.getByRole("region", { name: firstName })).toBeVisible();
    await expect(first).toHaveAttribute("aria-current", "true");
    await expect(page).toHaveURL(/\/players$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const third = nameButton(rows(page).nth(2));
    const thirdName = (await third.textContent()) ?? "";
    await third.click();
    await expect(page.getByRole("region", { name: thirdName })).toBeVisible();
    await expect(third).toHaveAttribute("aria-current", "true");
    await expect(page.locator("[aria-current=true]")).toHaveCount(1);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
);

test(
  "each toolbar filter narrows the list, Clear resets them, and an empty page drops the panel",
  TAG,
  async ({ page }) => {
    await openPlayers(page);
    await expect(page.getByRole("button", { name: /^Filters/ })).toBeHidden();

    // In the fixture DEN and MIA play tonight and tomorrow; PHX plays only tomorrow.
    await page.getByLabel("NBA team").selectOption("PHX");
    await expect(rows(page).first()).toContainText("PHX");
    await toolbarGroup(page, "Schedule").getByRole("button", { name: "Tonight" }).click();
    await expect(page.getByText("No players on this page match these filters.")).toBeVisible();
    await expect(panel(page)).toHaveCount(0);
    await toolbarGroup(page, "Schedule").getByRole("button", { name: "Any day" }).click();

    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByLabel("NBA team")).toHaveValue("");
    await expect(rows(page)).toHaveCount(25);

    await toolbarGroup(page, "Position").getByRole("button", { name: "C", exact: true }).click();
    await expect
      .poll(async () => {
        const lists = await rows(page).getByTestId("player-positions").allTextContents();
        return lists.length > 0 && lists.every((list) => list.split(", ").includes("C"));
      })
      .toBe(true);
    await toolbarGroup(page, "Position").getByRole("button", { name: "All" }).click();
    await expect(rows(page)).toHaveCount(25);

    await page.getByLabel("Games left").selectOption("1");
    for (const text of await rows(page).getByTestId("games-left").allTextContents()) {
      expect(Number.parseInt(text, 10)).toBeGreaterThanOrEqual(1);
    }
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByLabel("Games left")).toHaveValue("0");
  }
);

test(
  "the list, search, stats period and sort work from the toolbar, keeping the panel in step",
  TAG,
  async ({ page }) => {
    await openPlayers(page);

    await toolbarGroup(page, "List").getByRole("button", { name: "Owned", exact: true }).click();
    await expect(rows(page).first().getByTestId("ownership")).toHaveText(/^Team \d+$/);
    const owned = (await nameButton(rows(page).first()).textContent()) ?? "";
    await expect(page.getByRole("region", { name: owned })).toBeVisible();
    await toolbarGroup(page, "List").getByRole("button", { name: "Not owned" }).click();

    await page.getByRole("searchbox", { name: "Search players" }).fill("Rivers 30");
    await expect(rows(page)).toHaveCount(1);
    await expect(page.getByRole("region", { name: "Rivers 30" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Search players" }).fill("");
    await expect(rows(page)).toHaveCount(25);

    await toolbarGroup(page, "Stats").getByRole("button", { name: "Last 7" }).click();
    await expect(page.getByTestId("players-count")).toContainText("last 7 days per game");
    await toolbarGroup(page, "Stats").getByRole("button", { name: "Season" }).click();

    await page.getByLabel("Sort by").selectOption({ label: "PTS" });
    const points = await rows(page)
      .getByTestId("player-averages")
      .evaluateAll((lists) =>
        lists.map((list) => Number(list.querySelectorAll("dd")[3]?.textContent))
      );
    expect(points).toEqual([...points].sort((a, b) => b - a));
    const top = (await nameButton(rows(page).first()).textContent()) ?? "";
    await expect(page.getByRole("region", { name: top })).toBeVisible();
  }
);

test(
  "a row shows the same numbers as the phone's card for the same player",
  TAG,
  async ({ page }) => {
    await openPlayers(page);
    const row = rows(page).nth(3);
    const key = await row.getAttribute("data-testid");
    const readout = async () =>
      page.getByTestId(key ?? "").evaluate((item) => ({
        averages: [...item.querySelectorAll("dd")].map((cell) => cell.textContent),
        rostered: item.querySelector("[data-testid=rostered] b")?.textContent,
        gamesLeft: item.querySelector("[data-testid=games-left]")?.textContent,
      }));
    const wide = await readout();
    expect(wide.averages).toHaveLength(9);

    await page.setViewportSize(PHONE);
    await expect(
      page
        .getByTestId(key ?? "")
        .getByTestId("player-averages")
        .locator("dt")
        .first()
    ).toBeVisible();
    expect(await readout()).toEqual(wide);
  }
);

test(
  "the calls at 1280 are the phone's for the same URL, the details included, page by page",
  TAG,
  async ({ browser }) => {
    const callsAt = async (viewport: typeof PHONE) => {
      const page = await browser.newPage({ viewport, timezoneId: "America/New_York" });
      const calls = recordApiCalls(page);
      await signIn(page, "a", "Players");
      await expect(rows(page)).toHaveCount(25);
      if (viewport === PHONE) {
        // The phone shows the first player's details once they are tapped; the panel shows them unasked.
        await nameButton(rows(page).first()).click();
      }
      await expect(page.getByTestId("player-detail-stats")).toBeVisible();
      await expect(page.getByRole("status", { name: "Loading" })).toHaveCount(0);
      if (viewport === PHONE) {
        await page.getByRole("button", { name: "Close" }).click();
      }
      await page.getByRole("button", { name: "Next 25" }).click();
      await expect(page.getByTestId("players-range")).toContainText("Players 26–44");
      await expect(rows(page).first().getByTestId("player-averages")).not.toContainText("—");
      if (viewport === PHONE) {
        await nameButton(rows(page).first()).click();
      }
      await expect(page.getByTestId("player-detail-stats")).toBeVisible();
      await expect(page.getByRole("status", { name: "Loading" })).toHaveCount(0);
      const made = calls();
      await page.close();
      return made;
    };
    expect(await callsAt(DESKTOP)).toEqual(await callsAt(PHONE));
  }
);

test("narrowing to a phone with no player picked opens no sheet", TAG, async ({ page }) => {
  await openPlayers(page);
  await page.setViewportSize(PHONE);
  await expect(panel(page)).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Filters/ })).toBeVisible();
});

test("between md and lg a picked player opens in the right-hand drawer", TAG, async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await signIn(page, "a", "Players");
  await expect(rows(page)).toHaveCount(25);
  await expect(panel(page)).toHaveCount(0);

  const first = nameButton(rows(page).first());
  const name = (await first.textContent()) ?? "";
  await first.click();
  const drawer = page.getByRole("dialog", { name });
  await expect(drawer.getByTestId("player-detail-stats")).toBeVisible();
  // Wait out the slide-in: the drawer ends flush with the window's right edge.
  await expect
    .poll(async () => {
      const box = await drawer.boundingBox();
      return box && Math.round(box.x + box.width);
    })
    .toBe(900);
});

test(
  "long names truncate with the full name kept, and the page never scrolls sideways from 320 to 1920",
  TAG,
  async ({ page }) => {
    await openPlayers(page);
    for (const name of await rows(page)
      .getByRole("button")
      .evaluateAll((buttons) =>
        buttons.map((button) => [button.textContent, button.getAttribute("title")])
      )) {
      expect(name[1]).toBe(name[0]);
    }
    for (const width of [320, 390, 768, 900, 1099, 1100, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(rows(page)).toHaveCount(25);
      expect(await sidewaysOverflow(page), `at ${width}px`).toBeLessThanOrEqual(0);
    }
  }
);

test(
  "keyboard reaches the toolbar, sort and rows in reading order with a focus ring",
  TAG,
  async ({ page }) => {
    await openPlayers(page);
    const search = page.getByRole("searchbox", { name: "Search players" });
    const order = [
      search,
      toolbarGroup(page, "List").getByRole("button").first(),
      toolbarGroup(page, "List").getByRole("button").last(),
      toolbarGroup(page, "Schedule").getByRole("button").first(),
    ];
    await search.focus();
    for (const [index, target] of order.entries()) {
      if (index > 0) {
        await page.keyboard.press("Tab");
      }
      await expect(target).toBeFocused();
    }
    const after = [
      toolbarGroup(page, "Schedule").getByRole("button").last(),
      toolbarGroup(page, "Position").getByRole("button").first(),
    ];
    await after[0].focus();
    await page.keyboard.press("Tab");
    await expect(after[1]).toBeFocused();
    for (const label of ["NBA team", "Games left"]) {
      await page.getByLabel(label).focus();
      await expect(page.getByLabel(label)).toBeFocused();
    }
    await page.getByLabel("Games left").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Clear" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(toolbarGroup(page, "Stats").getByRole("button").first()).toBeFocused();
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press("Tab");
    }
    await expect(page.getByLabel("Sort by")).toBeFocused();
    await page.keyboard.press("Tab");
    const first = nameButton(rows(page).first());
    await expect(first).toBeFocused();
    const ring = await rows(page)
      .first()
      .evaluate((row) => {
        const button = row.querySelector("button");
        return button?.ownerDocument.defaultView?.getComputedStyle(button, "::after").boxShadow;
      });
    expect(ring).toMatch(/rgb.* 0px 0px 0px 2px/);

    await nameButton(rows(page).nth(1)).focus();
    await page.keyboard.press("Enter");
    await expect(nameButton(rows(page).nth(1))).toHaveAttribute("aria-current", "true");
  }
);

for (const width of [1280, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(
      `at ${width}px Players with its panel has no WCAG 2.1 AA violations (${theme})`,
      TAG,
      async ({ page }) => {
        await useTheme(page, theme);
        await page.setViewportSize({ width, height: 900 });
        await openPlayers(page);
        expect(await accessibilityViolations(page)).toEqual([]);
      }
    );
  }
}

test("at 900px Players has no WCAG 2.1 AA violations, drawer open", TAG, async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await signIn(page, "a", "Players");
  await expect(rows(page).first().getByTestId("player-averages")).not.toContainText("—");
  expect(await accessibilityViolations(page)).toEqual([]);
  await nameButton(rows(page).first()).click();
  await expect(page.getByTestId("player-detail-stats")).toBeVisible();
  expect(await accessibilityViolations(page)).toEqual([]);
});

test(
  "ten categories make the list scroll sideways inside its card, never the page",
  TAG,
  async ({ page }) => {
    await setScenario("ok", undefined, "12x10");
    try {
      await openPlayers(page);
      await expect(page.getByText("PF", { exact: true }).first()).toBeVisible();
      const scroller = page.getByTestId("players-list").locator("xpath=../..");
      const sizes = await scroller.evaluate((box) => ({
        scroll: box.scrollWidth,
        client: box.clientWidth,
      }));
      expect(sizes.scroll).toBeGreaterThan(sizes.client);
      expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
      expect(await accessibilityViolations(page)).toEqual([]);
    } finally {
      await setScenario("ok");
    }
  }
);
