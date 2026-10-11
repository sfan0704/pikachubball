import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { workspace, workspaceConfig } from "../../../../scripts/workspace.mts";

const TRACKED = readFileSync("supabase/config.toml", "utf8");

describe("workspace", () => {
  it("gives the same checkout the same identity every time", () => {
    expect(workspace("/work/a")).toEqual(workspace("/work/a"));
  });

  it("gives different checkouts different stack names", () => {
    expect(workspace("/work/a").projectId).not.toBe(workspace("/work/b").projectId);
    expect(workspace("/work/a").projectId).toMatch(/^pikachubball-[0-9a-f]{8}$/);
  });

  it("keeps a checkout's ports distinct, and away from the defaults and browser-blocked ports", () => {
    for (const root of ["/work/a", "/work/b", "/home/runner/work/pikachubball/pikachubball"]) {
      const ports = Object.values(workspace(root).ports);

      expect(new Set(ports).size).toBe(ports.length);
      for (const port of ports) {
        expect((port >= 20000 && port < 22000) || (port >= 40000 && port < 42000)).toBe(true);
        expect(port).not.toBe(10080);
        expect([5000, 5070, 5090, 5096, 54321, 54322]).not.toContain(port);
      }
    }
  });

  it("gives checkouts in different slots non-overlapping port blocks", () => {
    const roots = Array.from({ length: 200 }, (_, i) => `/work/checkout-${i}`);
    const bySlot = new Map(roots.map((root) => [workspace(root).slot, workspace(root)]));
    const used = [...bySlot.values()].flatMap((ws) => Object.values(ws.ports));

    expect(new Set(used).size).toBe(used.length);
  });
});

describe("workspaceConfig", () => {
  const ws = workspace("/work/a");
  const config = workspaceConfig(ws, TRACKED);

  it("names the stack after the workspace and keeps the tracked settings", () => {
    expect(config).toContain(`project_id = "${ws.projectId}"`);
    expect(config).not.toContain('project_id = "pikachubball"');
    expect(config).toContain('schemas = ["public"]');
  });

  it("puts the ports into existing tables without repeating them, and adds the rest", () => {
    expect(config.match(/^\[api\]$/gm)).toHaveLength(1);
    expect(config).toMatch(new RegExp(`\\[api\\]\\nport = ${ws.ports.supabaseApi}\\n`));
    expect(config).toMatch(new RegExp(`\\[db\\]\\nport = ${ws.ports.supabaseDb}\\n`));
    for (const table of ["db.pooler", "studio", "inbucket", "analytics", "edge_runtime"]) {
      expect(config.match(new RegExp(`^\\[${table.replace(".", "\\.")}\\]$`, "gm"))).toHaveLength(
        1
      );
    }
  });
});
