import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";

export { expect };

/**
 * Every browser test, with the page's console errors, uncaught exceptions and
 * failed or 5xx requests attached as "browser-errors" when there are any. Only
 * the message, method, path and status are kept: never headers, cookies or bodies.
 */
export const test = base.extend<{ browserErrors: void }>({
  browserErrors: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(`console: ${message.text()}`);
      });
      page.on("pageerror", (error) => errors.push(`exception: ${error.message}`));
      page.on("requestfailed", (request) =>
        errors.push(`request failed: ${request.method()} ${new URL(request.url()).pathname}`)
      );
      page.on("response", (response) => {
        if (response.status() >= 500) {
          const request = response.request();
          errors.push(
            `HTTP ${response.status()}: ${request.method()} ${new URL(response.url()).pathname}`
          );
        }
      });
      await use();
      if (errors.length > 0) {
        await testInfo.attach("browser-errors", {
          body: errors.join("\n"),
          contentType: "text/plain",
        });
      }
    },
    { auto: true },
  ],
});

export const LEAGUE = "466.l.100000";
export const MY_TEAM = `${LEAGUE}.t.11`;
export const TABS = ["rankings", "heatmap", "matchup", "compare", "roster", "account"] as const;

/** This workspace's stand-in; playwright.config.mts sets the port. */
function standIn(): string {
  const port = process.env.E2E_STANDIN_PORT;
  if (!port) {
    throw new Error(
      "E2E_STANDIN_PORT is unset; run the browser tests through playwright.config.mts"
    );
  }
  return `http://127.0.0.1:${port}`;
}

/** Signs in as a seeded manager through the local-only shortcut and lands on the league page. */
export async function signIn(page: Page, user: "a" | "b" = "a"): Promise<void> {
  await page.goto(`/api/dev/login?user=${user}`);
  await expect(page.getByRole("heading", { name: "Test League" })).toBeVisible();
}

/** Tells the Yahoo stand-in how to answer from now on. */
export async function setScenario(scenario: string, times?: number): Promise<void> {
  const response = await fetch(`${standIn()}/__scenario`, {
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
