#!/usr/bin/env bash
# ARNÉS DEL ENCUENTRO (V15-ITERATION16) — siembra base + siembra RTC-30 +
# next start + medición del encuentro.
#
# Por qué no reutiliza `arnes-rtc30-v15.sh`: ése fija su medidor en el paso 4
# (`verificar-rtc30-v15.mjs`) y su acta la consumen otras corridas. Y por qué no
# reutiliza `arnes-breakpoints-v15.sh`: ése siembra SÓLO la base, y sin la
# siembra de RTC-30 no hay inventario de farmacia — con lo que `/operaciones`
# se mediría sin una de sus tres fuentes y su excepción de existencias no
# existiría. Las dos siembras juntas son lo que hace falta aquí.
#
# Uso: node_modules/.bin/firebase emulators:exec --only auth,firestore \
#        --project demo-nexusmed-test \
#        "bash scripts/design/arnes-encuentro-v15.sh <antes|despues>"
set -euo pipefail

export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099

echo '── 1/4 siembra sintética base ──'
node scripts/design/sembrar-capturas.mjs

echo '── 2/4 siembra extra RTC-30 (inventario de farmacia) ──'
node scripts/design/sembrar-rtc30.mjs

echo '── 3/4 next start (build de producción previo) ──'
# Un next-server huérfano de una corrida anterior sigue dueño del :3000 y sirve
# el build VIEJO contra un `.next` recién sobrescrito. Ya pasó; se limpia antes.
pkill -f 'next-server' 2>/dev/null || true
sleep 1
npx next start --port 3000 >/tmp/next-v15-encuentro.log 2>&1 &
NEXT_PID=$!
trap 'kill $NEXT_PID 2>/dev/null || true; pkill -f "next-server" 2>/dev/null || true' EXIT

for i in $(seq 1 120); do
  if curl -sf -o /dev/null http://localhost:3000/login; then break; fi
  if ! kill -0 $NEXT_PID 2>/dev/null; then echo 'next start murió'; tail -30 /tmp/next-v15-encuentro.log; exit 1; fi
  sleep 1
done
curl -sf -o /dev/null http://localhost:3000/login || { echo 'next start nunca respondió'; tail -30 /tmp/next-v15-encuentro.log; exit 1; }
echo 'next start listo'

echo '── 4/4 medición del encuentro ──'
node scripts/design/medir-encuentro-v29.mjs "${1:-antes}"
