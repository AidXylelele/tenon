# syntax=docker/dockerfile:1

FROM ghcr.io/pnpm/pnpm:12.8.1@sha256:44cfd11d75b901dc7a83a16812d9134e4bf9d82f6b0eb28af6d666ebbf0fb4fb AS deps
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

FROM gcr.io/distroless/nodejs26-debian13:nonroot@sha256:ffa8a7545403036c94ec76674b5dbac2d425af2d679147cdf3e30180071487b7 AS node
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
