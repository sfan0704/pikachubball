import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";

const eslint = new ESLint({ cwd: process.cwd() });

/** Lints a snippet as if it were the given existing file, returning the rule ids that fired as errors. */
async function errorsFor(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  console.log(
    filePath,
    JSON.stringify(result.messages.map((m) => [m.ruleId, m.severity, m.message.slice(0, 80)]))
  );
  return result.messages
    .filter((message) => message.severity === 2)
    .map((message) => message.ruleId ?? "parse");
}

describe("import boundaries", () => {
  it("lets shared/domain import only from itself", async () => {
    expect(
      await errorsFor("shared/domain/league.ts", "import { z } from 'zod';\nexport const a = z;\n")
    ).toEqual(["no-restricted-imports"]);
    expect(
      await errorsFor(
        "shared/domain/league.ts",
        "import fs from 'node:fs';\nexport const a = fs;\n"
      )
    ).toEqual(["no-restricted-imports"]);
    expect(
      await errorsFor(
        "shared/domain/league.ts",
        "import { CATEGORIES } from './stats';\nexport const a = CATEGORIES;\n"
      )
    ).toEqual([]);
  });

  it("lets shared/api import only shared/domain and zod", async () => {
    expect(
      await errorsFor("shared/api/errors.ts", "import { z } from 'zod';\nexport const a = z;\n")
    ).toEqual([]);
    expect(
      await errorsFor(
        "shared/api/errors.ts",
        "import { CATEGORIES } from '../domain';\nexport const a = CATEGORIES;\n"
      )
    ).toEqual([]);
    expect(
      await errorsFor(
        "shared/api/errors.ts",
        "import express from 'express';\nexport const a = express;\n"
      )
    ).toEqual(["no-restricted-imports"]);
    expect(
      await errorsFor(
        "shared/api/errors.ts",
        "import { env } from '../../server/app';\nexport const a = env;\n"
      )
    ).toEqual(["no-restricted-imports"]);
  });

  it("keeps the client from importing server code", async () => {
    expect(
      await errorsFor(
        "client/src/lib/utils.ts",
        "import { createApp } from '../../../server/app';\nexport const a = createApp;\n"
      )
    ).toEqual(["no-restricted-imports"]);
    expect(
      await errorsFor(
        "client/src/lib/utils.ts",
        "import { CATEGORIES } from '@shared/domain';\nexport const a = CATEGORIES;\n"
      )
    ).toEqual([]);
  });

  it("keeps the server from importing client code", async () => {
    expect(
      await errorsFor(
        "server/app.ts",
        "import { cn } from '../client/src/lib/utils';\nexport const a = cn;\n"
      )
    ).toEqual(["no-restricted-imports"]);
  });
});

describe("promises and size limits where the target layout applies", () => {
  it("fails an unawaited promise in shared code", async () => {
    const code = "async function load() { return 1; }\nexport function run() {\n  load();\n}\n";
    expect(await errorsFor("shared/domain/league.ts", code)).toContain(
      "@typescript-eslint/no-floating-promises"
    );
  });

  it("fails a function over 60 lines and a branchy function in shared code", async () => {
    const longBody = Array.from({ length: 62 }, (_, i) => `  noop(${i});`).join("\n");
    expect(
      await errorsFor(
        "shared/domain/league.ts",
        `declare function noop(n: number): void;\nexport function big() {\n${longBody}\n}\n`
      )
    ).toContain("max-lines-per-function");

    const branches = Array.from({ length: 11 }, (_, i) => `  if (n === ${i}) return ${i};`).join(
      "\n"
    );
    expect(
      await errorsFor(
        "shared/domain/league.ts",
        `export function branchy(n: number) {\n${branches}\n  return -1;\n}\n`
      )
    ).toContain("complexity");
  });

  it("only warns for the same code elsewhere", async () => {
    const longBody = Array.from({ length: 62 }, (_, i) => `  noop(${i});`).join("\n");
    expect(
      await errorsFor(
        "server/app.ts",
        `declare function noop(n: number): void;\nexport function big() {\n${longBody}\n}\n`
      )
    ).toEqual([]);
  });
});
