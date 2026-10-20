# Disposable worker setup

The supported recipe is the versioned [Agent setup workflow](../.github/workflows/agent-setup.yml): an ephemeral Ubuntu 24.04 runner, Node 24.21.0 from `.nvmrc`, npm 11.17.0 from `packageManager`, a dedicated Linux Docker engine, outbound package/container downloads and permission to install Chromium system dependencies. GitHub supplies Docker and passwordless system-package installation on that runner. This is a supported runtime recipe, not a claim that the mutable hosted runner image is bit-for-bit immutable.

Start from a fresh checkout, without `.env.local`. Provision the prerequisites, then run:

```text
npm run agent:setup
```

Setup checks the runtime, package manager, Docker and this checkout's ports before changing anything. It installs the lockfile and Chromium dependencies, builds, starts this checkout's own Supabase stack, applies migrations, seeds synthetic managers and checks health plus a synthetic sign-in against the exact source commit. Every child command has a timeout; the app and stand-in stop after the smoke check, and the stack is stopped without a backup. A setup that refuses early (wrong platform, toolchain or a busy port) changes nothing. `.agent/setup.json` records sanitized versions, commands and results. No hosted identity or app secret is needed. Downloads need network access; children get the worker's proxy settings (`HTTPS_PROXY`, `NO_PROXY`, `NODE_EXTRA_CA_CERTS`) and `PLAYWRIGHT_BROWSERS_PATH`, so Chromium downloads through a proxied worker's egress and lands where the browser checks look. No real Yahoo call occurs.

Run the same command again to reproduce setup. The workflow demonstrates clean and repeat runs and retains both reports. A failed command, unsupported platform, inaccessible Docker engine or occupied port is an error, never a skipped pass. Browser system dependencies require host permission; use the provisioned runner rather than silently omitting them.

After setup, `npm run dev` starts the long-running disposable app separately.

Like every local-stack command, setup uses this checkout's own stack and ports ("Several workspaces" in the [README](../README.md)), so several workers can share a Docker host. It refuses to touch a stack whose ports are held by another checkout's containers; never stop or delete another checkout's stack to get past that. On a disposable worker, destroying the worker removes its stack. On a reused host, `npm run workspace` and `docker ps --filter name=pikachubball` show which stacks exist.

Node and npm updates must update the recipe and pass clean/repeat evidence. This command does not grant platform administration or production authority. See the [remote development contract](remote-development.md).

## Cloud sessions

Claude Code and Codex cloud sessions start with the same command, which knows nothing about either provider:

```text
npm run session:setup
```

It does the light, always-safe part and is safe on a laptop too. It checks the pinned Node (`.nvmrc`) and npm (`packageManager`); a different Node major is used only when nvm can provide the pinned version, and otherwise setup refuses and names the version to install. A different npm major is refused. When setup got Node from nvm, it installs the pinned npm into that nvm-managed Node (cloud images ship a newer npm, which `agent:setup` refuses and which skips dependency install scripts), and a second run finds it already there. It never changes any other npm: with the running Node, a different npm version is only a warning, since `agent:setup` needs it exactly. It then runs `npm ci` unless `node_modules` already matches `package-lock.json`, so a second run installs nothing. When Docker is installed but its daemon isn't running and setup runs as root (a cloud container, where nothing else starts it), setup starts `dockerd` in the background, writing its output to `dockerd.log` in the temporary directory. When no `dockerd` runs it first removes `/var/run/docker.pid`, which a resumed container keeps from its last daemon and which stops `dockerd` starting when that PID has been reused; a laptop's Docker is left alone. It ends with which validate profiles can run here and which are left to CI. It never starts a stack (with Docker present it points to `npm run agent:setup`), never reads hosted configuration, and makes no hosted or Yahoo calls. When it had to get Node from nvm, `--path-file <file>` adds that Node to `PATH` in a file the host's later shells source; without it, setup says to run `nvm use`.

Each provider has a thin adapter that only calls the command; a unit test (`tests/backend/unit/dev/session-setup.test.ts`) fails if an adapter does more.

| Setting | Claude Code | Codex |
| --- | --- | --- |
| Where setup lives | The SessionStart hook in [`.claude/settings.json`](../.claude/settings.json), in this repository | The environment's setup script, pasted from below; Codex doesn't read it from the repository |
| Network | Trusted (the default) | Default; internet is on for setup and off for the agent by default, so every install happens in setup |
| Environment variables and secrets | None | None |
| Node | The image's default Node is 22; the hook gets 24 through nvm and passes `$CLAUDE_ENV_FILE`, so the session's shells use it | Choose Node 24 for the environment, so the agent's shell has it |

The Codex setup script:

<!-- codex-setup -->
```text
npm run session:setup
```

The Claude Code cloud image has the Docker engine, which setup starts, so the `database` profile runs there once the environment's allowed domains include `pkg-containers.githubusercontent.com`: Supabase then pulls its images from ghcr.io, since Docker Hub and public.ecr.aws refuse that container's pulls. The `browser` profile also needs `cdn.playwright.dev`, because the image's Chromium is older than this repository's Playwright; `npm run agent:setup` installs the right one, and setup's summary says so rather than leaving browser to CI. Codex runs no Docker. Whatever a session can't run here (`npm run validate -- iterate` while working) runs in CI on the pull request. The *Agent setup* workflow runs `session:setup` twice on a clean runner and fails unless the second run installs nothing.
