# syntax=docker/dockerfile:1

FROM ghcr.io/pnpm/pnpm:12.8.1@sha256:44cfd11d75b901dc7a83a16812d9134e4bf9d82f6b0eb28af6d666ebbf0fb4fb AS deps
ENV CI=true HUSKY=0
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
    pnpm fetch --store-dir /var/cache/pnpm

FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
    pnpm install --filter web... --offline --frozen-lockfile --store-dir /var/cache/pnpm
RUN --mount=type=cache,id=next,target=/app/apps/web/.next/cache \
    pnpm --filter web... run build

FROM gcr.io/distroless/nodejs26-debian13:nonroot@sha256:1d736cf8b5716c07a245301f92717143215d248fd55771ee1936ef4b3302e531
WORKDIR /app
ENV NODE_ENV=production PORT=3001 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
USER 65532:65532
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:3001/sign-in').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
ENTRYPOINT ["/nodejs/bin/node"]
CMD ["apps/web/server.js"]
