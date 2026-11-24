# syntax=docker/dockerfile:1

FROM golang:1.27.3-trixie@sha256:af1bfc2614ebb1dbd31af514b78740fd678850e76498762b425ecee4c5c6ea80 AS go-judge
WORKDIR /src
RUN git clone --depth 1 --branch v1.13.3 https://github.com/criyle/go-judge.git . \
 && go get golang.org/x/net@v0.62.0 \
 && go mod tidy \
 && CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o /opt/go-judge ./cmd/go-judge \
 && cp mount.yaml /opt/mount.yaml

FROM node:26.13.1-trixie-slim@sha256:e6bedef217677b276c591795e169840edd9096dbf13f29df8ef8d1856b8820bc
RUN apt-get update \
 && apt-get install --yes --no-install-recommends python3=3.13.* \
 && apt-get install --yes --only-upgrade zlib1g \
 && rm -rf /var/lib/apt/lists/* /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
 && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
WORKDIR /opt
COPY --from=go-judge /opt/go-judge /opt/mount.yaml /opt/
# Runs as root: go-judge builds each sandbox from namespaces and cgroups (compose.yaml grants privileged).
# go-judge takes its token only from ES_AUTH_TOKEN, so the entrypoint reads it from ES_AUTH_TOKEN_FILE.
EXPOSE 5050
ENTRYPOINT ["/bin/sh", "-ec", "ES_AUTH_TOKEN=\"$(cat \"$ES_AUTH_TOKEN_FILE\")\"; test -n \"$ES_AUTH_TOKEN\"; export ES_AUTH_TOKEN; exec /opt/go-judge -http-addr 0.0.0.0:5050 -release"]
