# Contributing to Voxa

Thank you for helping build accessible AAC tooling. A few ground rules:

## Before You Code

1. Read the [PRD](./PRD.md) and [Accessibility Standards](./docs/accessibility.md).
2. AAC changes affect real communicators — prefer small, reviewable PRs.
3. Never reduce touch target sizes below 1 cm without explicit SLP sign-off in the issue.

## Development

```bash
corepack enable
pnpm install
pnpm dev:web
pnpm typecheck
pnpm test
```

Health endpoints used by Kubernetes probes (`/api/health` on web, `/health` on API) have unit tests under `apps/web` and `apps/api`.

For deployment changes, see [Enclii Deployment](./deploy/ENCLII.md).

## Pull Request Checklist

- [ ] Typecheck and tests pass (includes probe health tests in `apps/web` and `apps/api`)
- [ ] Accessibility: axe scan clean on touched flows (when UI changes)
- [ ] Motor-planning / GLP changes reviewed against `docs/linguistic-framework.md`
- [ ] No secrets or PHI in fixtures

## Code of Conduct

Be respectful. Many contributors and users live with communication disabilities — assume good intent and optimize for clarity.

## License

By contributing, you agree your contributions are licensed under the Apache License 2.0.
