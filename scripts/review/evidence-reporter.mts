// Writes the review evidence summary: summary.json for tools, summary.md for
// people (and the CI job summary). Paths are relative to the evidence folder.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import { workspace } from "../workspace.mts";
import { parseRecord } from "./lifecycle.mts";

interface Flow {
  readonly title: string;
  readonly project: string;
  readonly status: string;
  readonly screenshots: string[];
  readonly browserErrors: string[];
}

/** Collects each flow's outcome, screenshots and browser errors, then writes the summary. */
export default class EvidenceReporter implements Reporter {
  private readonly flows: Flow[] = [];

  constructor(private readonly options: { outputDir: string }) {}

  onTestEnd(test: TestCase, result: TestResult): void {
    const errors = result.attachments.find((attachment) => attachment.name === "browser-errors");
    this.flows.push({
      title: test.titlePath().slice(3).join(" › "),
      project: test.parent.project()?.name ?? "",
      status: result.status,
      screenshots: result.attachments
        .filter((attachment) => attachment.name === "screenshot" && attachment.path)
        .map((attachment) => relative(this.options.outputDir, attachment.path ?? "")),
      browserErrors: errors?.body ? errors.body.toString("utf8").split("\n") : [],
    });
  }

  onEnd(result: FullResult): void {
    const ws = workspace();
    const file = join(ws.workdir, "review.json");
    const record = existsSync(file) ? parseRecord(readFileSync(file, "utf8")) : undefined;
    const summary = {
      url: record?.url ?? "no review running",
      commit: record?.commit ?? "unknown",
      workspace: ws.projectId,
      outcome: result.status,
      flows: this.flows,
    };
    mkdirSync(this.options.outputDir, { recursive: true });
    writeFileSync(
      join(this.options.outputDir, "summary.json"),
      `${JSON.stringify(summary, null, 2)}\n`
    );
    writeFileSync(join(this.options.outputDir, "summary.md"), markdown(summary));
  }
}

function markdown(summary: {
  url: string;
  commit: string;
  outcome: string;
  flows: Flow[];
}): string {
  const passed = summary.flows.filter((flow) => flow.status === "passed").length;
  const lines = [
    `### Review evidence: ${summary.outcome === "passed" ? "passed" : "FAILED"}`,
    "",
    `Commit \`${summary.commit}\` · ${summary.url} (loopback, synthetic users) · ${passed} of ${summary.flows.length} flows passed`,
    "",
    "| Flow | Size | Result | Browser errors |",
    "| --- | --- | --- | --- |",
    ...summary.flows.map(
      (flow) =>
        `| ${flow.title} | ${flow.project} | ${flow.status} | ${flow.browserErrors.length || ""} |`
    ),
    "",
    "Screenshots for every flow, and traces for failures, are in this artifact; open `report/index.html`.",
  ];
  const errors = summary.flows.filter((flow) => flow.browserErrors.length > 0);
  if (errors.length > 0) {
    lines.push("", "#### Browser errors", "");
    for (const flow of errors)
      lines.push(`- ${flow.title} (${flow.project}): ${flow.browserErrors.join("; ")}`);
  }
  return `${lines.join("\n")}\n`;
}
