# syntax=docker/dockerfile:1.7
# The sandbox for `run: script` and `run: shell` (FR-012): go-judge with Node.js and Python 3 in its rootfs.
# Processes get no network, a read-only /usr, /bin and /lib, and tmpfs work directories (mount.yaml).

FROM criyle/go-judge:v1.13.3@sha256:97bec66d054e4d844e0ad29dfdd5c79ef3d09efba25b06dd58643a6e99918dcd AS go-judge

FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20
RUN apt-get update \
 && apt-get install --yes --no-install-recommends python3 \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /opt
COPY --from=go-judge /opt/go-judge /opt/mount.yaml /opt/
EXPOSE 5050
ENTRYPOINT ["/opt/go-judge", "-http-addr", "0.0.0.0:5050", "-release"]
