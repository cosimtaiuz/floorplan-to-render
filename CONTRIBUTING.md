# Contributing

Thanks for taking an interest in the project. Issues and pull requests are
welcome.

## Getting set up

You need **Node.js 20.9+** and **pnpm**. The repo is pnpm-only: it has a
committed `pnpm-lock.yaml` and a pinned `packageManager` field, so npm, yarn and
bun will either fail or silently resolve a different dependency tree.

```bash
pnpm install
cp .env.example .env.local   # then set OPENAI_API_KEY
pnpm dev
```

You only need an OpenAI key to exercise the two model calls. Everything else,
including the whole test suite, runs without one.

## Before opening a pull request

Run the same four checks CI runs:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm format` fixes formatting in place. If a check fails in CI but passed
locally, make sure you ran it on a clean tree — `pnpm typecheck` generates route
types first, so it needs no build to have happened.

## How the code is organised

`app/` holds routes and nothing else. Everything else lives in a feature folder
split by role:

- `components/` — React UI.
- `store/` — Zustand state.
- `types/` — shared client/server contracts.
- `lib/` — framework-free helpers. No React, no Next, no `window` where it can
  be avoided. This is where testable logic belongs.
- `server/` — server-only modules. Every file starts with `import "server-only"`.

Two rules are worth stating explicitly because breaking them is a security
change rather than a style one:

1. Secrets are read only in route handlers and `server/` modules.
2. Upstream error text is logged, never returned to the client.

See [SECURITY.md](SECURITY.md) for the reasoning.

## Tests

Tests use [Vitest](https://vitest.dev) and live next to the code as
`*.test.ts`. Run `pnpm test`, or `pnpm test:watch` while working.

The suite covers the framework-free modules in `features/floorplan/lib/`, which
is where a silent bug is most expensive: bad geometry or a malformed image size
is only discovered by spending a real API call. If you add logic that can be
expressed as a pure function, put it in `lib/` and test it there rather than
embedding it in a component or a route.

Components and the 3D harness are not unit tested. They need a real browser to
tell you anything true, so they are verified by hand.

## Style

Formatting is Prettier's, enforced in CI; don't hand-format around it. Beyond
that, match the surrounding code. The codebase leans on comments that explain
_why_ a piece of code is the way it is, particularly where a constraint comes
from outside (an API limit, a browser quirk, a model behaviour). Those are worth
keeping and extending.

## Commit messages

Write a short imperative subject line and, where the change is not obvious, a
body explaining the reasoning. No particular format is required.

## Scope

This repository is the floorplan tool. The hosted product's marketing site and
sign-up flow are not part of it, and pull requests adding product-specific
branding or analytics are likely to be declined.
