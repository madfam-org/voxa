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
COPY apps/web/package.json ./apps/web/
COPY packages/access/package.json ./packages/access/
COPY packages/ai/package.json ./packages/ai/
COPY packages/core/package.json ./packages/core/
COPY packages/i18n/package.json ./packages/i18n/
COPY packages/obf/package.json ./packages/obf/
COPY packages/symbols/package.json ./packages/symbols/
COPY packages/sync/package.json ./packages/sync/
COPY packages/ui/package.json ./packages/ui/
COPY packages/vocabulary/package.json ./packages/vocabulary/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/ ./
COPY . .
ARG NEXT_PUBLIC_API_URL=https://voxa-api.madfam.io
ARG NEXT_PUBLIC_BASE_URL=https://voxa.madfam.io
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}
RUN pnpm turbo build --filter=@voxa/web

FROM mirror.gcr.io/library/node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# No package managers in the shipped image. The runtime only runs `node`
# (CMD below starts the Next.js standalone server; the k8s probes are HTTP and
# the preStop hook is /bin/sleep). npm, corepack and yarn come with the base
# image and vendor their own dependency trees, which image scanners report as
# installed packages. The checks fail the build if any of them survives.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg \
  && for tool in npm npx corepack yarn yarnpkg pnpm; do \
       if command -v "$tool" >/dev/null 2>&1; then echo "$tool is still in the runtime image" >&2; exit 1; fi; \
     done \
  && if [ -n "$(ls -A /usr/local/lib/node_modules 2>/dev/null)" ]; then \
       ls -A /usr/local/lib/node_modules >&2; echo "global node_modules is not empty" >&2; exit 1; \
     fi

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Build identity: the commit this image was built from. The deploy workflows
# pass GIT_SHA=<github.sha>; the health endpoint serves it as `build`, so a
# deploy check can prove the new image is the one answering. Never empty.
ARG GIT_SHA=unknown
ENV GIT_SHA=${GIT_SHA:-unknown}

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
