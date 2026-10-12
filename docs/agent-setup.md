# Disposable worker setup

The supported recipe is the versioned [Agent setup workflow](../.github/workflows/agent-setup.yml): an ephemeral Ubuntu 24.04 runner, Node 24.21.0 from `.nvmrc`, npm 11.17.0 from `packageManager`, a dedicated Linux Docker engine, outbound package/container downloads and permission to install Chromium system dependencies. GitHub supplies Docker and passwordless system-package installation on that runner. This is a supported runtime recipe, not a claim that the mutable hosted runner image is bit-for-bit immutable.

Start from a fresh checkout, without `.env.local`. Provision the prerequisites, then run:

```text
npm run agent:setup
```

Setup checks the runtime, package manager, Docker and this checkout's ports before changing anything. It installs the lockfile and Chromium dependencies, builds, starts this checkout's own Supabase stack, applies migrations, seeds synthetic managers and checks health plus a synthetic sign-in against the exact source commit. Every child command has a timeout; the app and stand-in stop after the smoke check, and the stack is stopped without a backup. A setup that refuses early (wrong platform, toolchain or a busy port) changes nothing. `.agent/setup.json` records sanitized versions, commands and results. No hosted identity or app secret is needed. Downloads need network access; no real Yahoo call occurs.

Run the same command again to reproduce setup. The workflow demonstrates clean and repeat runs and retains both reports. A failed command, unsupported platform, inaccessible Docker engine or occupied port is an error, never a skipped pass. Browser system dependencies require host permission; use the provisioned runner rather than silently omitting them.

After setup, `npm run dev` starts the long-running disposable app separately.

Like every local-stack command, setup uses this checkout's own stack and ports ("Several workspaces" in the [README](../README.md)), so several workers can share a Docker host. It refuses to touch a stack whose ports are held by another checkout's containers; never stop or delete another checkout's stack to get past that. On a disposable worker, destroying the worker removes its stack. On a reused host, `npm run workspace` and `docker ps --filter name=pikachubball` show which stacks exist.

Node and npm updates must update the recipe and pass clean/repeat evidence. This command does not grant platform administration or production authority. See the [remote development contract](remote-development.md).
