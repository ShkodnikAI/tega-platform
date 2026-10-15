# TEGA PLUS site: Metalogos server behind Caddy, one container (for Render).
# mlog requires glibc >= 2.39 and libssl3 -> Ubuntu 24.04 base.
FROM caddy:2 AS caddy

FROM ubuntu:24.04
ARG MLOG_VERSION=v0.32.0
ARG MLOG_SHA256=dd8164b747aa99cb953d3f7a29e084ba38d432df376aa2f05cfd2187e2bc59a2

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl libssl3 \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL -o /usr/local/bin/mlog \
    "https://github.com/ShkodnikAI/Metalogos-/releases/download/${MLOG_VERSION}/mlog-linux-x86_64" \
 && echo "${MLOG_SHA256}  /usr/local/bin/mlog" | sha256sum -c - \
 && chmod +x /usr/local/bin/mlog

COPY --from=caddy /usr/bin/caddy /usr/local/bin/caddy
# The official image sets file capabilities (cap_net_bind_service) on caddy; Render's runtime rejects
# exec of such a binary ("Operation not permitted"). We listen on $PORT (>1024), so a plain copy
# without extended attributes is enough.
RUN cp --no-preserve=all /usr/local/bin/caddy /tmp/caddy.plain \
 && mv -f /tmp/caddy.plain /usr/local/bin/caddy \
 && chmod 755 /usr/local/bin/caddy

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
