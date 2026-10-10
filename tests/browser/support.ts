import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const LEAGUE = "466.l.100000";
export const MY_TEAM = `${LEAGUE}.t.11`;
export const TABS = ["rankings", "heatmap", "matchup", "compare", "roster", "account"] as const;

const STANDIN = `http://127.0.0.1:${process.env.E2E_STANDIN_PORT ?? 5096}`;

/** Signs in as a seeded manager through the local-only shortcut and lands on the league page. */
export async function signIn(page: Page, user: "a" | "b" = "a"): Promise<void> {
  await page.goto(`/api/dev/login?user=${user}`);
  await expect(page.getByRole("heading", { name: "Test League" })).toBeVisible();
}

/** Tells the Yahoo stand-in how to answer from now on. */
export async function setScenario(scenario: string, times?: number): Promise<void> {
  const response = await fetch(`${STANDIN}/__scenario`, {
    method: "POST",
    body: JSON.stringify({ scenario, times }),
  });
  expect(response.ok).toBe(true);
}

export async function openTab(page: Page, tab: (typeof TABS)[number]): Promise<void> {
  await page.getByRole("tab", { name: tab }).click();
  await expect(page.getByRole("tabpanel")).toBeVisible();
}

/** Makes the page start in the given theme. */
export async function useTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
}

/** The WCAG 2.1 A and AA problems axe finds on the page as it is now, colour contrast included. */
export async function accessibilityViolations(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return result.violations.map((violation) => {
    const examples = violation.nodes
      .slice(0, 3)
      .map((node) => `${node.target.join(" ")} ${node.any[0]?.message ?? ""}`.trim());
    return `${violation.id} (${violation.nodes.length}): ${violation.help}\n    ${examples.join("\n    ")}`;
  });
}
