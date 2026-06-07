# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/access/package.json ./packages/access/
COPY packages/ai/package.json ./packages/ai/
COPY packages/core/package.json ./packages/core/
COPY packages/obf/package.json ./packages/obf/
COPY packages/sync/package.json ./packages/sync/
COPY packages/vocabulary/package.json ./packages/vocabulary/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/ ./
COPY . .
RUN pnpm turbo build --filter=@voxa/api
RUN pnpm deploy --filter=@voxa/api --prod /prod/api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nodejs

COPY --from=builder --chown=nodejs:nodejs /prod/api/ ./

USER nodejs
EXPOSE 8080

CMD ["node", "dist/index.js"]
