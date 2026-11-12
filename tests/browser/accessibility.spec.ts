import {
  accessibilityViolations,
  openAccount,
  openScreen,
  setScenario,
  signIn,
  useTheme,
  expect,
  test,
} from "./support";

test.beforeEach(async () => {
  await setScenario("ok");
});

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    test("League has no WCAG 2.1 AA violations", async ({ page }) => {
      await useTheme(page, theme);
      await signIn(page);
      await page.getByLabel("Time period").selectOption("1");
      await expect(page.getByTestId(/^row-ranking-/)).toHaveCount(14);
      await expect(page.getByRole("status", { name: "Loading" })).toHaveCount(0);

      expect(await accessibilityViolations(page)).toEqual([]);
    });

    test("Account has no WCAG 2.1 AA violations", async ({ page }) => {
      await useTheme(page, theme);
      await signIn(page);
      const dialog = await openAccount(page);
      await dialog.getByRole("button", { name: "Delete account" }).click();
      await expect(dialog.getByRole("alertdialog")).toBeVisible();

      expect(await accessibilityViolations(page)).toEqual([]);
    });

    for (const day of ["Today", "Yesterday", "Week"] as const) {
      test(`Matchup ${day} has no WCAG 2.1 AA violations`, async ({ page }) => {
        await useTheme(page, theme);
        await signIn(page, "a", "Matchup");
        await page
          .getByRole("navigation", { name: "Day" })
          .getByRole("link", { name: day })
          .click();
        await expect(page.getByRole("status", { name: "Loading" })).toHaveCount(0);

        expect(await accessibilityViolations(page)).toEqual([]);
      });
    }

    test("Players has no WCAG 2.1 AA violations", async ({ page }) => {
      await useTheme(page, theme);
      await signIn(page, "a", "Matchup");
      await openScreen(page, "Players");
      await expect(page.getByTestId("players-list")).toBeVisible();

      expect(await accessibilityViolations(page)).toEqual([]);
    });
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
