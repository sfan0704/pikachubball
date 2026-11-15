import type { Page } from "@playwright/test";
import {
  accessibilityViolations,
  openScreen,
  setScenario,
  signIn,
  useTheme,
  expect,
  test,
} from "./support";

// The app's breakpoints (docs/target-state.md, Responsive layout).
const MD = 768;
const LG = 1100;
const HEIGHT = 800;
const SCREENS = ["Matchup", "Players", "League"] as const;

test.beforeEach(async () => {
  await setScenario("ok");
});

function screenNav(page: Page) {
  return page.getByRole("navigation", { name: "Screens" });
}

/** Where the screen tabs sit: the header's bar, or a bar on the viewport's bottom edge. */
async function navPlacement(page: Page): Promise<"header" | "bottom"> {
  const nav = await screenNav(page).boundingBox();
  const header = await page.getByTestId("app-header").boundingBox();
  if (!nav || !header) {
    throw new Error("the screen tabs or the header are not on the page");
  }
  if (nav.y >= header.y && nav.y + nav.height <= header.y + header.height) {
    return "header";
  }
  expect(nav.y + nav.height).toBe(page.viewportSize()?.height);
  return "bottom";
}

test("the screen tabs move between the bottom bar and the top bar at the md breakpoint, with no reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: MD - 1, height: HEIGHT });
  await signIn(page, "a", "Players");
  const url = page.url();
  await page.evaluate(() => {
    document.documentElement.dataset.notReloaded = "true";
  });
  expect(await navPlacement(page)).toBe("bottom");

  await page.setViewportSize({ width: MD, height: HEIGHT });
  expect(await navPlacement(page)).toBe("header");
  await expect(screenNav(page)).toHaveCount(1);
  await expect(screenNav(page).getByRole("link", { name: "Players" })).toHaveAttribute(
    "aria-current",
    "page"
  );

  await page.setViewportSize({ width: MD - 1, height: HEIGHT });
  expect(await navPlacement(page)).toBe("bottom");
  expect(page.url()).toBe(url);
  expect(await page.evaluate(() => document.documentElement.dataset.notReloaded)).toBe("true");
});

for (const width of [1280, 1440]) {
  test(`at ${width}px the top bar reads league, tabs, freshness, period, Account, with the current tab underlined`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: HEIGHT });
    await signIn(page, "a", "Matchup");
    const header = page.getByTestId("app-header");
    await expect(header.getByTestId("freshness")).toBeVisible();
    const parts = [
      header.getByRole("heading", { name: "Test League" }),
      screenNav(page).getByRole("link", { name: "Matchup" }),
      screenNav(page).getByRole("link", { name: "Players" }),
      screenNav(page).getByRole("link", { name: "League" }),
      header.getByTestId("freshness"),
      header.getByTestId("header-context"),
      header.getByRole("button", { name: "Account" }),
    ];
    const boxes = await Promise.all(parts.map((part) => part.boundingBox()));
    const lefts = boxes.map((box) => box?.x ?? Number.NaN);
    expect(lefts).toEqual([...lefts].sort((a, b) => a - b));
    expect(new Set(boxes.map((box) => box && Math.round(box.y + box.height / 2))).size).toBe(1);

    const headerBox = await header.boundingBox();
    const underline = screenNav(page).locator("[aria-current=page] > span").first();
    await expect(underline).toHaveCSS("background-color", "rgb(245, 197, 24)");
    const underlineBox = await underline.boundingBox();
    expect(underlineBox && headerBox && underlineBox.y + underlineBox.height).toBe(
      headerBox && headerBox.y + headerBox.height - 1
    );
    const main = await page.locator("main").evaluate((element) => {
      const box = element.getBoundingClientRect();
      return {
        width: box.width,
        left: box.left,
        right: element.ownerDocument.documentElement.clientWidth - box.right,
      };
    });
    expect(main.width).toBeLessThanOrEqual(1280);
    expect(main.left).toBe(main.right);
  });
}

test("no width from 320 to 1920px scrolls the page sideways, on any screen", async ({ page }) => {
  await signIn(page, "a", "Matchup");
  for (const screen of SCREENS) {
    await openScreen(page, screen);
    await expect(page.getByRole("status", { name: "Loading" })).toHaveCount(0);
    for (const width of [320, 390, MD - 1, MD, 900, LG - 1, LG, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: HEIGHT });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(overflow, `${screen} at ${width}px`).toBeLessThanOrEqual(0);
    }
    await page.setViewportSize({ width: 1280, height: HEIGHT });
  }
});

for (const width of [390, 1280]) {
  test(`at ${width}px Matchup's sticky block stays flush under the header`, async ({ page }) => {
    await page.setViewportSize({ width, height: HEIGHT });
    await signIn(page, "a", "Matchup");
    await expect(page.getByRole("status", { name: "Loading" })).toHaveCount(0);
    const headerBox = await page.getByTestId("app-header").boundingBox();
    await page.mouse.wheel(0, 600);
    await expect
      .poll(async () => (await page.getByTestId("matchup-top").boundingBox())?.y)
      .toBe(headerBox && headerBox.y + headerBox.height);
  });
}

test("keyboard reaches the tabs in order, with a focus ring, and the current tab is announced", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: HEIGHT });
  await signIn(page, "a", "Matchup");
  const tabs = screenNav(page).getByRole("link");
  await expect(tabs).toHaveText(["Matchup", "Players", "League"]);

  await tabs.first().focus();
  for (const name of ["Players", "League"]) {
    await page.keyboard.press("Tab");
    const focused = screenNav(page).getByRole("link", { name });
    await expect(focused).toBeFocused();
    expect(
      await focused.evaluate(
        (link) => link.ownerDocument.defaultView?.getComputedStyle(link).boxShadow
      )
    ).toMatch(/rgb.* 0px 0px 0px 2px/);
  }
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/league/);
  await expect(screenNav(page).getByRole("link", { name: "League" })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(screenNav(page).locator("[aria-current]")).toHaveCount(1);
});

// 1280 is covered by accessibility.spec.ts in the desktop project.
for (const width of [900]) {
  for (const theme of ["light", "dark"] as const) {
    test(`at ${width}px every screen has no WCAG 2.1 AA violations (${theme})`, async ({
      page,
    }) => {
      await useTheme(page, theme);
      await page.setViewportSize({ width, height: HEIGHT });
      await signIn(page, "a", "Matchup");
      for (const screen of SCREENS) {
        await openScreen(page, screen);
        await expect(page.getByRole("status", { name: "Loading" })).toHaveCount(0);
        expect(await accessibilityViolations(page), screen).toEqual([]);
      }
    });
  }
}
