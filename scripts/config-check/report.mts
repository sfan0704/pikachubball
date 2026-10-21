import { appendFileSync } from "node:fs";
import type { Result } from "./contracts.mts";

/** Prints check names and outcomes, and adds them to the Actions job summary when there is one. */
export function printReport(title: string, results: readonly Result[]): void {
  const report = results.map((r) => `${r.outcome.padEnd(11)} ${r.check}`).join("\n");
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## ${title}\n\n\`\`\`text\n${report}\n\`\`\`\n`
    );
  }
}
