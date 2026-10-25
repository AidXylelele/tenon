# syntax=docker/dockerfile:1.7
# Build context: repository root (docker build -f apps/api/Dockerfile .).

# --- base: pnpm with the pinned Node runtime ---------------------------------
FROM ghcr.io/pnpm/pnpm:12.15.0@sha256:d6148daf3ad2af8fa4ecd1aa06db73da32b2e37f63088987eea2fb375ee7f320 AS base
ENV CI=true HUSKY=0
RUN pnpm runtime set node 24.21.0 -g
WORKDIR /app

# --- deps: the dependency layer depends only on the lockfile ------------------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
    pnpm fetch --store-dir /var/cache/pnpm

# --- build: compile and assemble the production tree --------------------------
FROM deps AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
    pnpm install --filter api... --offline --frozen-lockfile --store-dir /var/cache/pnpm
RUN pnpm --filter api run build
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
    pnpm --filter api --prod deploy /prod/api --store-dir /var/cache/pnpm

# --- runtime: distroless, non-root, runtime files only ------------------------
FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:9eeb7f5887d0e239e78264b06f7f11d2e14be534050481803a9e4728fcdd278e AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build --chown=65532:65532 /prod/api/ ./
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:3000/api/v1/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
ENTRYPOINT ["/nodejs/bin/node", "--enable-source-maps", "--import", "./dist/instrumentation.js", "dist/main.js"]
