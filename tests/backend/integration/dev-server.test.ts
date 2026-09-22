import { spawn, type ChildProcess } from "child_process";
import net from "net";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Boots the real development server the way `npm run dev` does: tsx loads
// server/index.ts, vite.config.ts and server/config/vite.ts as CommonJS
// (package.json "type": "commonjs"), where import.meta.dirname is undefined.
// Unit tests run as ESM and cannot see that failure mode.

const projectRoot = path.resolve(__dirname, "../../..");
const tsxBin = path.join(projectRoot, "node_modules", ".bin", "tsx");

let server: ChildProcess | undefined;
let baseUrl: string;
let output = "";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() =>
        typeof address === "object" && address
          ? resolve(address.port)
          : reject(new Error("could not allocate a port")),
      );
    });
  });
}

function waitForListening(child: ChildProcess, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`dev server did not start:\n${output}`)),
      timeoutMs,
    );
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      if (output.includes("serving on port")) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`dev server exited with code ${code}:\n${output}`));
    });
  });
}

beforeAll(async () => {
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(tsxBin, ["server/index.ts"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: "development",
      PORT: String(port),
      APP_ORIGIN: `http://localhost:${port}`,
      ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic-test-key",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForListening(server, 60_000);
}, 70_000);

afterAll(() => {
  server?.kill("SIGTERM");
});

describe("development server (CommonJS runtime)", () => {
  it("serves the transformed client shell", async () => {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain('<div id="root">');
    expect(html).toMatch(/src="\/src\/main\.tsx\?v=[^"]+"/);
  });

  it("serves client modules through the Vite middleware", async () => {
    const response = await fetch(`${baseUrl}/src/main.tsx`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("javascript");
  });

  it("keeps API routes on the Express handler", async () => {
    const response = await fetch(`${baseUrl}/api/auth/me`);

    expect(response.status).toBe(401);
    expect(output).not.toMatch(/ERR_INVALID_ARG_TYPE/);
  });
});
