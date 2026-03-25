#!/usr/bin/env bash
# Warmup script to call the app a few times to populate DB connections and caches.
# Usage: ./warmup.sh http://localhost:8000

set -euo pipefail
URL=${1:-http://localhost:8000}

# a few attempts with short delays
for i in 1 2 3 4 5; do
  echo "Warmup attempt $i against $URL/ping"
  curl -sS --max-time 5 "$URL/ping" || true
  sleep 1
done

# Optionally check readiness endpoint
if curl -sS --max-time 2 "$URL/ready" >/dev/null 2>&1; then
  echo "App ready"
else
  echo "App not ready yet"
fi
