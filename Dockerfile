# TEGA PLUS site: Metalogos server behind Caddy, one container (for Render).
# mlog requires glibc >= 2.39 and libssl3 -> Ubuntu 24.04 base.
FROM caddy:2 AS caddy

FROM ubuntu:24.04
ARG MLOG_VERSION=v0.30.1
ARG MLOG_SHA256=22f64215348738776066bf3d1dd0b3795fa4f27607d7f99abddcf58c6e015bc3

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl libssl3 \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL -o /usr/local/bin/mlog \
    "https://github.com/ShkodnikAI/Metalogos-/releases/download/${MLOG_VERSION}/mlog-linux-x86_64" \
 && echo "${MLOG_SHA256}  /usr/local/bin/mlog" | sha256sum -c - \
 && chmod +x /usr/local/bin/mlog

COPY --from=caddy /usr/bin/caddy /usr/local/bin/caddy

RUN useradd --system --create-home --home-dir /app tega \
 && mkdir -p /data /srv/static && chown tega:tega /data
WORKDIR /app
COPY site/ /app/site/
COPY static/ /srv/static/
COPY deploy/Caddyfile.render /etc/caddy/Caddyfile
COPY deploy/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV METALOGOS_DATA_DIR=/data
USER tega
EXPOSE 10000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
