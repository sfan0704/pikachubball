# Disposable worker setup

The supported recipe is the versioned [Agent setup workflow](../.github/workflows/agent-setup.yml): an ephemeral Ubuntu 24.04 runner, Node 24.21.0 from `.nvmrc`, npm 11.17.0 from `packageManager`, a dedicated Linux Docker engine, outbound package/container downloads and permission to install Chromium system dependencies. GitHub supplies Docker and passwordless system-package installation on that runner. This is a supported runtime recipe, not a claim that the mutable hosted runner image is bit-for-bit immutable.

Start from a fresh checkout, without `.env.local`. Provision the prerequisites, then run:

```text
npm run agent:setup
```

Setup checks the runtime, package manager, Docker, ports and stack ownership before mutation. It installs the lockfile and Chromium dependencies, builds, applies migrations, seeds synthetic managers and checks health plus authenticated synthetic sign-in against the exact source commit. Every child command has a timeout; the app and stand-in stop after smoke validation, and the owned database stack is stopped without a backup. `.agent/setup.json` records sanitized versions, commands and results. No hosted identity or app secret is needed. Downloads need network access; no real Yahoo call occurs.

Run the same command again to reproduce setup. The workflow demonstrates clean and repeat runs and retains both reports. A failed command, unsupported platform, inaccessible Docker engine or occupied port is an error, never a skipped pass. Browser system dependencies require host permission; use the provisioned runner rather than silently omitting them.

After setup, `npm run dev` starts the long-running disposable app separately. Existing development commands still have their original shared-stack behavior until CAR-125; do not run them concurrently on the same Docker host.

Setup reserves the fixed stack with the Docker volume `pikachubball_agent_owner`, labeled with a hash of the checkout's canonical path. It refuses any existing unowned basketball stack or a marker for another checkout. Use one fresh Docker host per worker until CAR-125 introduces concurrent namespaces. Never delete someone else's marker to bypass this guard. On a disposable worker, destroying the worker removes its marker and services. A reused host requires its owner to verify no other checkout uses the stack before manually cleaning stale resources.

Node and npm updates must update the recipe and pass clean/repeat evidence. This command does not grant platform administration or production authority. See the [remote development contract](remote-development.md).
