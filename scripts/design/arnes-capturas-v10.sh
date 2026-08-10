#!/usr/bin/env bash
# ARNÉS DE CAPTURAS V10 — emuladores + siembra + next dev + playwright.
#
# Uso:  node_modules/.bin/firebase emulators:exec --only auth,firestore \
#         --project demo-nexusmed-test "bash scripts/design/arnes-capturas-v10.sh [capturas|axe]"
#
# El argumento elige el paso 3: `capturas` (default) fotografía el golden flow;
# `axe` corre la línea base de accesibilidad (scripts/design/axe-v10.mjs).
#
# `emulators:exec` (nunca `emulators:start` — prohibido en este repo, ver
# docs/testing/emulador-multitenant.md) levanta Auth+Firestore, corre esto y
# apaga todo al salir. Nada toca la nube: proyecto demo-*, hosts de emulador.
set -euo pipefail

export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099

echo '── 1/3 siembra sintética ──'
node scripts/design/sembrar-demo-v10.mjs

echo '── 2/3 next start (build de producción: sin overlay de dev y con el rendimiento real) ──'
# Requiere `npm run build` previo con el mismo .env.local (las NEXT_PUBLIC_* se
# hornean al compilar). El arnés jamás despliega este build: es sólo local.
npx next start --port 3000 >/tmp/next-dev-v10.log 2>&1 &
NEXT_PID=$!
trap 'kill $NEXT_PID 2>/dev/null || true' EXIT

for i in $(seq 1 120); do
  if curl -sf -o /dev/null http://localhost:3000/login; then break; fi
  if ! kill -0 $NEXT_PID 2>/dev/null; then echo 'next dev murió'; tail -30 /tmp/next-dev-v10.log; exit 1; fi
  sleep 1
done
curl -sf -o /dev/null http://localhost:3000/login || { echo 'next dev nunca respondió'; tail -30 /tmp/next-dev-v10.log; exit 1; }
echo 'next dev listo'

MODO="${1:-capturas}"
echo "── 3/3 ${MODO} ──"
case "$MODO" in
  capturas) node scripts/design/capturas-v10.mjs ;;
  axe)      node scripts/design/axe-v10.mjs ;;
  *) echo "modo desconocido: $MODO (usa capturas|axe)"; exit 1 ;;
esac
