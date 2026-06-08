# GHCR public visibility (org admin)

Required for **M3 full web GA** — removes temporary Kyverno `PolicyException` files in `k8s/*/signature-policyexception.yaml`.

## Packages

| Package | GHCR path | GitHub API slug |
|---------|-----------|-----------------|
| voxa-api | `ghcr.io/madfam-org/voxa/voxa-api` | `voxa%2Fvoxa-api` |
| voxa-web | `ghcr.io/madfam-org/voxa/voxa-web` | `voxa%2Fvoxa-web` |

## Prerequisites

- GitHub org **Owner** or **Admin** on `madfam-org`
- CLI token with `read:packages` and `write:packages` (or use GitHub UI)

```bash
gh auth refresh -s read:packages,write:packages
```

## Option A — Script

```bash
./scripts/deploy/make-ghcr-packages-public.sh
./scripts/deploy/make-ghcr-packages-public.sh --check
```

If the script returns **404 Package not found**, the packages may live under a different org path or the token lacks package scope — use Option B or C.

## Option C — GitHub Actions (repo `workflow_dispatch`)

After merging `.github/workflows/ghcr-public.yml`:

```bash
gh workflow run ghcr-public.yml --repo madfam-org/voxa
gh run watch --repo madfam-org/voxa
```

Uses `GITHUB_TOKEN` with `packages: write`. Org owners may still need to allow this in **Settings → Actions → General** if visibility changes are denied.

## Option B — GitHub UI

1. Open https://github.com/orgs/madfam-org/packages
2. Select **voxa-api** → Package settings → **Change visibility** → **Public**
3. Repeat for **voxa-web**

## After packages are public

```bash
git rm k8s/production/signature-policyexception.yaml k8s/staging/signature-policyexception.yaml
# Remove resource lines from k8s/production/kustomization.yaml and k8s/staging/kustomization.yaml
git commit -m "chore(k8s): remove Kyverno PolicyException after GHCR public"
git push origin main
```

Verify Argo apps `voxa-services` and `voxa-staging-services` stay **Synced / Healthy**.

## Checklist

- [ ] Both packages public
- [ ] PolicyException YAML removed
- [ ] Argo sync green on prod + staging

See [GA_ROADMAP.md](./GA_ROADMAP.md) Phase 2 and [GA_CHECKLIST.md](./GA_CHECKLIST.md).
