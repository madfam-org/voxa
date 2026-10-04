# syntax=docker/dockerfile:1

# Base image: node:22-alpine (Node 22.23.3), pinned to its multi-arch index digest
# (resolved 2026-10-04; Docker Hub and mirror.gcr.io serve the same digest). It is
# pulled through mirror.gcr.io, Google's mirror of the Docker Hub official images,
# because GitHub-hosted runners share egress IPs and Docker Hub rate-limits
# anonymous pulls per IP. To update: resolve the new node:22-alpine index digest
# and replace it in every FROM line of both Dockerfiles.

FROM mirror.gcr.io/library/node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/access/package.json ./packages/access/
COPY packages/ai/package.json ./packages/ai/
COPY packages/core/package.json ./packages/core/
COPY packages/import-adapters/package.json ./packages/import-adapters/
COPY packages/obf/package.json ./packages/obf/
COPY packages/symbols/package.json ./packages/symbols/
COPY packages/sync/package.json ./packages/sync/
COPY packages/vocabulary/package.json ./packages/vocabulary/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/ ./
COPY . .
RUN pnpm turbo build --filter=@voxa/api
RUN pnpm deploy --filter=@voxa/api --prod /prod/api

FROM mirror.gcr.io/library/node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nodejs

# No package managers in the shipped image. The runtime only runs `node`
# (CMD below; the k8s probes are HTTP and the preStop hook is /bin/sleep, and
# the API applies its migrations in-process with drizzle-orm). npm, corepack and
# yarn come with the base image and vendor their own dependency trees, which
# image scanners report as installed packages. The checks fail the build if any
# of them survives.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg \
  && for tool in npm npx corepack yarn yarnpkg pnpm; do \
       if command -v "$tool" >/dev/null 2>&1; then echo "$tool is still in the runtime image" >&2; exit 1; fi; \
     done \
  && if [ -n "$(ls -A /usr/local/lib/node_modules 2>/dev/null)" ]; then \
       ls -A /usr/local/lib/node_modules >&2; echo "global node_modules is not empty" >&2; exit 1; \
     fi

COPY --from=builder --chown=nodejs:nodejs /prod/api/ ./
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/drizzle ./drizzle

# Build identity: the commit this image was built from. The deploy workflows
# pass GIT_SHA=<github.sha>; the health endpoint serves it as `build`, so a
# deploy check can prove the new image is the one answering. Never empty.
ARG GIT_SHA=unknown
ENV GIT_SHA=${GIT_SHA:-unknown}

USER nodejs
EXPOSE 8080

CMD ["node", "dist/index.js"]
