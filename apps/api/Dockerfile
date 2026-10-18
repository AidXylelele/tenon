# syntax=docker/dockerfile:1.7
# Build context: repository root (docker build -f apps/api/Dockerfile .).

# --- base: pnpm with the pinned Node runtime ---------------------------------
FROM ghcr.io/pnpm/pnpm:12.8.1@sha256:44cfd11d75b901dc7a83a16812d9134e4bf9d82f6b0eb28af6d666ebbf0fb4fb AS base
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
FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:59c479c9b8c123e66047315c968aa2d35e31ae5149c856e4110a79c8b3563f0b AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build --chown=65532:65532 /prod/api/ ./
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:3000/api/v1/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
ENTRYPOINT ["/nodejs/bin/node", "--enable-source-maps", "--import", "./dist/instrumentation.js", "dist/main.js"]
