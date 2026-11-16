import { MY_TEAM, setScenario, signIn, expect, test } from "./support";

/**
 * A Matchup player card opens its player wherever it is clicked (FAN-157): in
 * the sheet on a phone, in the panel from lg. The injury tag keeps its own link.
 */
const MY_COLUMN = `column-${MY_TEAM}`;

test.beforeEach(async () => {
  await setScenario("ok");
});

test("clicking a card away from the name opens that player", async ({ page }) => {
  await signIn(page, "a", "Matchup");
  const card = page
    .getByTestId(MY_COLUMN)
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "Jordan Knoll: open player detail" }) });
  await expect(card).toBeVisible();
  // Not the top contributor, which the lg panel shows before any pick.
  // The value at the card's right edge, well away from the name.
  const box = await card.boundingBox();
  if (box === null) {
    throw new Error("The card has no layout box");
  }
  await card.click({ position: { x: box.width - 12, y: box.height / 2 } });

  const wide = (page.viewportSize()?.width ?? 0) >= 1100;
  const details = wide
    ? page.getByTestId("player-panel")
    : page.getByRole("dialog", { name: "Jordan Knoll" });
  await expect(details.getByRole("heading", { name: "Jordan Knoll" })).toBeVisible();
  await expect(details.getByTestId("player-detail-stats")).toBeVisible();
  if (wide) {
    await expect(card.getByRole("button", { name: /open player detail/ })).toHaveAttribute(
      "aria-current",
      "true"
    );
  }
});

test("the injury tag on a card stays on top of the card's click area", async ({ page }) => {
  await signIn(page, "a", "Matchup");
  const tag = page.getByTestId(MY_COLUMN).getByTestId("injury-tag").first();
  await expect(tag).toBeVisible();
  // Clicking would open Yahoo in a new tab, so check what the pointer would hit.
  const hit = await tag.evaluate((element) => {
    element.scrollIntoView({ block: "center" });
    const box = element.getBoundingClientRect();
    const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return top !== null && element.contains(top);
  });
  expect(hit).toBe(true);
});
