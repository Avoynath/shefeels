#!/usr/bin/env bash
# Post-deploy warmup helper
# Usage: ./scripts/post_deploy_warmup.sh <base_url> [warmup_token]
# Example: ./scripts/post_deploy_warmup.sh https://api.example.com mytoken

set -euo pipefail
BASE_URL=${1:-http://127.0.0.1:8000}
WARMUP_TOKEN=${2:-}

echo "Warming up ${BASE_URL}..."

# call /internal/warmup (if token provided, send header)
if [ -n "${WARMUP_TOKEN}" ]; then
  echo "Calling /internal/warmup with token"
  curl -fsS -X POST "${BASE_URL}/internal/warmup" -H "X-Warmup-Token: ${WARMUP_TOKEN}" || true
else
  echo "Calling /internal/warmup without token (must be local)"
  curl -fsS -X POST "${BASE_URL}/internal/warmup" || true
fi

# fetch /bootstrap a few times to prime caches and measure latency
for i in 1 2 3 4 5; do
  echo -n "bootstrap attempt ${i}: "
  curl -fsS -w "\nHTTP %{http_code} - %{time_total}s\n" "${BASE_URL}/bootstrap" -o /dev/null || true
  sleep 0.2
done

echo "Done."
