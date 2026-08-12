#!/usr/bin/env bash
# ARNÉS — radiografía de breakpoints §23 (V15-MOBILE-001, 7ª rebanada).
# Mismo patrón que arnes-capturas-v10.sh: emulators:exec + siembra +
# next start (build de producción previo) + medición playwright.
#
# Uso: node_modules/.bin/firebase emulators:exec --only auth,firestore \
#        --project demo-nexusmed-test "bash scripts/design/arnes-breakpoints-v15.sh [script]"
set -euo pipefail

export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099

echo '── 1/3 siembra sintética ──'
node scripts/design/sembrar-capturas.mjs

echo '── 2/3 next start (build de producción previo) ──'
npx next start --port 3000 >/tmp/next-v15-breakpoints.log 2>&1 &
NEXT_PID=$!
trap 'kill $NEXT_PID 2>/dev/null || true' EXIT

for i in $(seq 1 120); do
  if curl -sf -o /dev/null http://localhost:3000/login; then break; fi
  if ! kill -0 $NEXT_PID 2>/dev/null; then echo 'next start murió'; tail -30 /tmp/next-v15-breakpoints.log; exit 1; fi
  sleep 1
done
curl -sf -o /dev/null http://localhost:3000/login || { echo 'next start nunca respondió'; tail -30 /tmp/next-v15-breakpoints.log; exit 1; }
echo 'next start listo'

MEDIDOR="${1:-scripts/design/medir-breakpoints-v15.mjs}"
echo "── 3/3 ${MEDIDOR} ──"
node "$MEDIDOR" "${2:-}"
