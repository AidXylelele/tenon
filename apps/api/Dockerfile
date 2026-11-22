# syntax=docker/dockerfile:1

FROM ghcr.io/pnpm/pnpm:12.8.1@sha256:44cfd11d75b901dc7a83a16812d9134e4bf9d82f6b0eb28af6d666ebbf0fb4fb AS deps
ENV CI=true HUSKY=0
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
    pnpm fetch --store-dir /var/cache/pnpm

FROM deps AS build
COPY package.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
    pnpm install --filter api... --offline --frozen-lockfile --store-dir /var/cache/pnpm
RUN pnpm --filter api... run build
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
    pnpm --filter api --prod deploy /prod/api --store-dir /var/cache/pnpm \
 && pnpm --filter api deploy /prod/migrate --store-dir /var/cache/pnpm

FROM gcr.io/distroless/nodejs26-debian13:nonroot@sha256:1d736cf8b5716c07a245301f92717143215d248fd55771ee1936ef4b3302e531 AS node
WORKDIR /app
ENV NODE_ENV=production
USER 65532:65532
ENTRYPOINT ["/nodejs/bin/node"]

FROM node AS migrate
COPY --from=build /prod/migrate ./
COPY apps/api/drizzle.config.ts ./
COPY apps/api/src/frameworks/di/env.schema.ts ./src/frameworks/di/
CMD ["node_modules/drizzle-kit/bin.cjs", "migrate"]

FROM node AS runtime
COPY --from=build /prod/api ./
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "if (process.env.HTTP === 'off') process.exit(0); fetch('http://127.0.0.1:3000/api/v1/health/ready').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["--import", "./dist/frameworks/instrumentation.js", "dist/frameworks/main.js"]
