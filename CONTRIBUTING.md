# Contributing to Voxa

Thank you for helping build accessible AAC tooling. A few ground rules:

## Before You Code

1. Read [what ships today](./docs/capabilities.md), the [Accessibility Standards](./docs/accessibility.md) and [AGENTS.md](./AGENTS.md) (invariants and guards). The [PRD](./PRD.md) is the long-term target, not the current state.
2. AAC changes affect real communicators — prefer small, reviewable PRs.
3. Never reduce touch target sizes below 1 cm without explicit SLP sign-off in the issue.

## Development

Node.js 22 and pnpm 9 (Corepack):

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev:web
pnpm guards && pnpm test:guards
pnpm turbo typecheck
pnpm test
```

Test files are discovered: any `*.test.*` file under a package's `src/` runs as soon as it exists (do not list files in `package.json`; the test-discovery guard fails if you do). API tests must not share state through `apps/api/data/`; the test preload gives every test process its own `VOXA_DATA_DIR`. See [AGENTS.md](./AGENTS.md) for the invariants and the guards.

Health endpoints used by Kubernetes probes (`/api/health` on web, `/health` on API) have unit tests under `apps/web` and `apps/api`.

For deployment changes, see [Enclii Deployment](./docs/deploy/ENCLII.md).

## Pull Request Checklist

- [ ] Guards, typecheck and tests pass (`pnpm guards`, `pnpm turbo typecheck`, `pnpm test`)
- [ ] Accessibility: axe scan clean on touched flows (when UI changes)
- [ ] Motor-planning / GLP changes reviewed against `docs/linguistic-framework.md`
- [ ] No secrets or PHI in fixtures
- [ ] Public text (README, docs, catalogs) claims only what `main` does; anything pending clinical review says so

## Code of Conduct

Be respectful. Many contributors and users live with communication disabilities — assume good intent and optimize for clarity.

## License

By contributing, you agree your contributions are licensed under the Apache License 2.0.
