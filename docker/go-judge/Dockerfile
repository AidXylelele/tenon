# syntax=docker/dockerfile:1

FROM criyle/go-judge:v1.13.3@sha256:97bec66d054e4d844e0ad29dfdd5c79ef3d09efba25b06dd58643a6e99918dcd AS go-judge

FROM node:26.13.1-trixie-slim@sha256:e6bedef217677b276c591795e169840edd9096dbf13f29df8ef8d1856b8820bc
RUN apt-get update \
 && apt-get install --yes --no-install-recommends python3=3.13.* \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /opt
COPY --from=go-judge /opt/go-judge /opt/mount.yaml /opt/
# Runs as root: go-judge builds each sandbox from namespaces and cgroups (compose.yaml grants privileged).
# go-judge takes its token only from ES_AUTH_TOKEN, so the entrypoint reads it from ES_AUTH_TOKEN_FILE.
EXPOSE 5050
ENTRYPOINT ["/bin/sh", "-ec", "ES_AUTH_TOKEN=\"$(cat \"$ES_AUTH_TOKEN_FILE\")\"; test -n \"$ES_AUTH_TOKEN\"; export ES_AUTH_TOKEN; exec /opt/go-judge -http-addr 0.0.0.0:5050 -release"]
