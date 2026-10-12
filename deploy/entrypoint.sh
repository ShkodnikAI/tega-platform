#!/bin/sh
# Starts the Metalogos server on 127.0.0.1:8080 and Caddy on $PORT (Render sets PORT, default 10000).
# If either process exits, the container exits so Render restarts it.
set -eu
export PORT="${PORT:-10000}"
mlog serve /app/site/main.mlog &
MLOG_PID=$!
caddy run --config /etc/caddy/Caddyfile --adapter caddyfile &
CADDY_PID=$!
trap 'kill $MLOG_PID $CADDY_PID 2>/dev/null' TERM INT
while kill -0 $MLOG_PID 2>/dev/null && kill -0 $CADDY_PID 2>/dev/null; do sleep 2; done
kill $MLOG_PID $CADDY_PID 2>/dev/null || true
exit 1
