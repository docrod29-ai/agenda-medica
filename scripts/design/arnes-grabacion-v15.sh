#!/usr/bin/env bash
# ARNÉS DEL CICLO DE GRABACIÓN (V15-ITERATION16) — siembra + next start +
# recorrido real del grabador con dispositivo de audio falso.
#
# Uso: node_modules/.bin/firebase emulators:exec --only auth,firestore \
#        --project demo-nexusmed-test "bash scripts/design/arnes-grabacion-v15.sh"
set -euo pipefail

export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099

echo '── 1/3 siembra ──'
node scripts/design/sembrar-capturas.mjs
node scripts/design/sembrar-rtc30.mjs

echo '── 2/3 next start ──'
pkill -f 'next-server' 2>/dev/null || true
sleep 1
npx next start --port 3000 >/tmp/next-v15-grabacion.log 2>&1 &
NEXT_PID=$!
trap 'kill $NEXT_PID 2>/dev/null || true; pkill -f "next-server" 2>/dev/null || true' EXIT

for i in $(seq 1 120); do
  if curl -sf -o /dev/null http://localhost:3000/login; then break; fi
  if ! kill -0 $NEXT_PID 2>/dev/null; then echo 'next start murió'; tail -30 /tmp/next-v15-grabacion.log; exit 1; fi
  sleep 1
done
curl -sf -o /dev/null http://localhost:3000/login || { echo 'next start nunca respondió'; exit 1; }
echo 'next start listo'

echo '── 3/3 ciclo de grabación ──'
node scripts/design/medir-grabacion-v15.mjs
