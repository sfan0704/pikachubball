import { expect, test } from "@playwright/test";
import { TABS, accessibilityViolations, openTab, setScenario, signIn, useTheme } from "./support";

test.beforeEach(async () => {
  await setScenario("ok");
});

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    for (const tab of TABS) {
      test(`${tab} has no WCAG 2.1 AA violations`, async ({ page }) => {
        await useTheme(page, theme);
        await signIn(page);
        await page.getByLabel("Time period").selectOption("1");
        await openTab(page, tab);
        await expect(page.getByRole("status", { name: "Loading" })).toHaveCount(0);

        expect(await accessibilityViolations(page)).toEqual([]);
      });
    }
  });
}

test("the check fails on an accessibility problem", async ({ page }) => {
  await signIn(page);
  await page.evaluate(() => {
    const unnamed = document.createElement("button");
    document.body.append(unnamed);
  });

  const violations = await accessibilityViolations(page);

  expect(violations.join("\n")).toContain("button-name");
});
