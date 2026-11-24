# syntax=docker/dockerfile:1

FROM ghcr.io/pnpm/pnpm:12.23.0@sha256:349c846c6c9dab76b2f6fbf4b2df14d5a8c9b2a0fce92fc7e5c2eec3f437e801 AS deps
ENV CI=true HUSKY=0
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
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
CMD ["--import", "./dist/frameworks/instrumentation.js", "dist/frameworks/main.js"]
