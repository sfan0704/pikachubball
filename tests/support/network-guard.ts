import { setupServer } from "msw/node";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * Fails any test that reaches the real network. Loopback requests pass
 * through so in-process servers (supertest) keep working; tests mock every
 * other call through `server.use(...)` or module mocks.
 */
export const networkGuard = setupServer();

export function startNetworkGuard(): void {
  networkGuard.listen({
    onUnhandledRequest(request, print) {
      if (LOOPBACK_HOSTS.has(new URL(request.url).hostname)) {
        return;
      }
      print.error();
      throw new Error(`Unmocked network request in a test: ${request.method} ${request.url}`);
    },
  });
}
