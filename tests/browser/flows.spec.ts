import {
  LEAGUE,
  MY_TEAM,
  openAccount,
  openScreen,
  setScenario,
  signIn,
  expect,
  test,
} from "./support";

test.beforeEach(async () => {
  await setScenario("ok");
});

test("signs in with a seeded manager and shows the league rankings", async ({ page }) => {
  await signIn(page);

  await expect(page.getByTestId(/^row-ranking-/)).toHaveCount(14);
  await expect(page.getByTestId(`row-ranking-${MY_TEAM}`)).toContainText("(you)");
  await expect(page).toHaveURL(new RegExp(`/leagues/${LEAGUE}/teams/${MY_TEAM}/season$`));
});

test("opens on Matchup and keeps the screen and day through refresh and back", async ({ page }) => {
  const base = `/leagues/${LEAGUE}/teams/${MY_TEAM}`;
  await signIn(page, "a", "Matchup");
  await expect(page.getByTestId("player-columns").getByRole("listitem")).toHaveCount(26);

  const days = page.getByRole("navigation", { name: "Day" });
  await days.getByRole("link", { name: "Yesterday" }).click();
  await expect(page).toHaveURL(`${base}/matchup/yesterday`);
  await page.reload();
  await expect(days.getByRole("link", { name: "Yesterday" })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(page.getByTestId("player-columns")).toBeVisible();

  await days.getByRole("link", { name: "Week" }).click();
  await expect(page.getByLabel("Week")).toHaveValue("5");

  await openScreen(page, "Players");
  await expect(page).toHaveURL(`${base}/players`);
  await expect(page.getByTestId("players-list").getByRole("listitem")).toHaveCount(25);
  await page.reload();
  await expect(page.getByTestId("players-list")).toBeVisible();

  await openScreen(page, "League");
  await expect(page).toHaveURL(`${base}/season`);
  await expect(page.getByTestId(/^row-ranking-/)).toHaveCount(14);

  await page.goBack();
  await expect(page).toHaveURL(`${base}/players`);
  await page.goBack();
  await expect(page).toHaveURL(`${base}/matchup/week`);
  await page.goBack();
  await expect(page).toHaveURL(`${base}/matchup/yesterday`);
  await expect(days.getByRole("link", { name: "Yesterday" })).toHaveAttribute(
    "aria-current",
    "page"
  );
});

test("keeps the selection in the URL: a deep link, another period, and back", async ({ page }) => {
  await signIn(page);

  await page.goto(`/leagues/${LEAGUE}/teams/${MY_TEAM}/current`);
  await expect(page.getByLabel("Period")).toHaveValue("current");

  await page.getByLabel("Period").selectOption("1");
  await expect(page).toHaveURL(/\/1$/);
  await expect(page.getByTestId(/^row-ranking-/)).toHaveCount(14);

  await page.goBack();
  await expect(page.getByLabel("Period")).toHaveValue("current");
});

test("shows League as the board alone, with no view tabs", async ({ page }) => {
  await signIn(page);

  await expect(page.getByTestId("card-league-rankings")).toBeVisible();
  await expect(page.getByRole("tablist")).toHaveCount(0);
  await expect(page.getByRole("tab")).toHaveCount(0);
});

test("asks before disconnecting Yahoo from the header, and disconnects once confirmed", async ({
  page,
}) => {
  // The removal itself is answered here so the seeded manager keeps its Yahoo
  // connection for the other tests; the API's own tests cover what it removes.
  const removals: string[] = [];
  await page.route("**/api/me/yahoo", async (route) => {
    removals.push(route.request().method());
    await route.fulfill({ json: { revokedAtYahoo: true } });
  });
  await signIn(page);
  const dialog = await openAccount(page);

  await dialog.getByRole("button", { name: "Disconnect Yahoo" }).click();
  const confirmation = dialog.getByRole("alertdialog");
  await expect(confirmation).toContainText("revokes this app's access at Yahoo");
  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(confirmation).toBeHidden();
  expect(removals).toEqual([]);

  await dialog.getByRole("button", { name: "Disconnect Yahoo" }).click();
  await confirmation.getByRole("button", { name: "Disconnect Yahoo" }).click();
  await expect(dialog.getByRole("status")).toContainText("Yahoo disconnected.");
  expect(removals).toEqual(["DELETE"]);
});

test("asks before deleting the account from the header, and deletes once confirmed", async ({
  page,
}) => {
  const removals: string[] = [];
  await page.route("**/api/me", async (route) => {
    if (route.request().method() !== "DELETE") {
      return route.fallback();
    }
    removals.push("DELETE");
    await route.fulfill({ json: { revokedAtYahoo: true } });
  });
  await signIn(page);
  const dialog = await openAccount(page);

  await dialog.getByRole("button", { name: "Delete account" }).click();
  const confirmation = dialog.getByRole("alertdialog");
  await expect(confirmation).toContainText("It can't be undone");
  await confirmation.getByRole("button", { name: "Cancel" }).click();
  expect(removals).toEqual([]);

  await dialog.getByRole("button", { name: "Delete account" }).click();
  // The page leaves for the sign-in page; the manager still exists here, so it comes back.
  const leaving = page.waitForRequest((request) => new URL(request.url()).pathname === "/auth");
  await confirmation.getByRole("button", { name: "Delete my account" }).click();
  await leaving;
  expect(removals).toEqual(["DELETE"]);
});

test("keeps the table on screen and offers a retry when Yahoo stops answering", async ({
  page,
}) => {
  await signIn(page);
  await expect(page.getByTestId(/^row-ranking-/)).toHaveCount(14);
  await setScenario("unavailable");

  await page.getByRole("button", { name: "Refresh from Yahoo" }).click();

  await expect(page.getByRole("alert")).toContainText("Yahoo isn't responding");
  await expect(page.getByTestId(/^row-ranking-/)).toHaveCount(14);

  await setScenario("ok");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("alert")).toBeHidden();
});

test("refreshes an expired Yahoo token on its own", async ({ page }) => {
  await setScenario("unauthorized");

  await signIn(page);

  await expect(page.getByTestId(/^row-ranking-/)).toHaveCount(14);
});

test("never scrolls the page sideways; only the stat tables do", async ({ page }) => {
  await signIn(page);

  await expect(page.getByTestId(/^row-ranking-/)).toHaveCount(14);
  const leagueOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(leagueOverflow, "page overflows sideways on League").toBeLessThanOrEqual(0);
  for (const screen of ["Matchup", "Players"] as const) {
    await openScreen(page, screen);
    await expect(page.getByRole("status", { name: "Loading" })).toHaveCount(0);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow, `page overflows sideways on ${screen}`).toBeLessThanOrEqual(0);
  }
});
