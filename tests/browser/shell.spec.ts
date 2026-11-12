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

test("every screen sits in the mockup's shell: header with league, period and freshness, tabs at the bottom", async ({
  page,
}) => {
  await signIn(page, "a", "Matchup");
  const header = page.getByTestId("app-header");
  const nav = page.getByRole("navigation", { name: "Screens" });

  await expect(header.getByRole("heading", { name: "Test League" })).toBeVisible();
  await expect(header.getByTestId("header-context")).toHaveText(/^Week \d+ · /);
  await expect(header.getByTestId("freshness")).toBeVisible();
  const navBox = await nav.boundingBox();
  const viewport = page.viewportSize();
  expect(navBox && viewport && navBox.y + navBox.height).toBe(viewport?.height);

  await openScreen(page, "Players");
  await expect(header.getByTestId("text-freshness")).toBeVisible();

  await openScreen(page, "League");
  await expect(header.getByTestId("text-updated")).toBeVisible();
  await expect(header.getByTestId("header-context")).toHaveText("This week");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  ).toBeLessThanOrEqual(0);

  await page.reload();
  await expect(nav.getByRole("link", { name: "League" })).toHaveAttribute("aria-current", "page");
});

test("theme and sign-out live in the Account dialog", async ({ page }) => {
  await signIn(page);
  const dialog = await openAccount(page);

  await dialog.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await dialog.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/auth$/);
});

for (const theme of ["light", "dark"] as const) {
  test(`the shell has no WCAG 2.1 AA violations (${theme})`, async ({ page }) => {
    await useTheme(page, theme);
    await signIn(page, "a", "Matchup");
    await expect(page.getByTestId("app-header").getByTestId("freshness")).toBeVisible();

    expect(await accessibilityViolations(page)).toEqual([]);
  });
}
