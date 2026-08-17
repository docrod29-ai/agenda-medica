#!/usr/bin/env bash
# ARNÉS RTC-30 (4ª aplicación) — siembra base + siembra extra + next start + medición.
#
# Igual que `arnes-breakpoints-v15.sh`, con un paso más: la siembra extra de
# RTC-30, que añade inventario de farmacia y pacientes sin volver SIN tocar los
# recuentos del consultorio base de los que dependen los otros arneses.
#
# Uso: node_modules/.bin/firebase emulators:exec --only auth,firestore \
#        --project demo-nexusmed-test "bash scripts/design/arnes-rtc30-v15.sh"
set -euo pipefail

export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099

echo '── 1/4 siembra sintética base ──'
node scripts/design/sembrar-capturas.mjs

echo '── 2/4 siembra extra RTC-30 ──'
node scripts/design/sembrar-rtc30.mjs

echo '── 3/4 next start (build de producción previo) ──'
# Un next-server huérfano de una corrida anterior sigue dueño del :3000 y sirve
# el build VIEJO contra un `.next` recién sobrescrito: chunks con hash
# desconocido, CSS 404, y la app se mide DESNUDA. Ya pasó; se limpia antes.
pkill -f 'next-server' 2>/dev/null || true
sleep 1
npx next start --port 3000 >/tmp/next-v15-rtc30.log 2>&1 &
NEXT_PID=$!
# `kill $NEXT_PID` sólo mata al envoltorio de npx; el hijo queda vivo.
trap 'kill $NEXT_PID 2>/dev/null || true; pkill -f "next-server" 2>/dev/null || true' EXIT

for i in $(seq 1 120); do
  if curl -sf -o /dev/null http://localhost:3000/login; then break; fi
  if ! kill -0 $NEXT_PID 2>/dev/null; then echo 'next start murió'; tail -30 /tmp/next-v15-rtc30.log; exit 1; fi
  sleep 1
done
curl -sf -o /dev/null http://localhost:3000/login || { echo 'next start nunca respondió'; tail -30 /tmp/next-v15-rtc30.log; exit 1; }
echo 'next start listo'

echo '── 4/4 medición ──'
node scripts/design/verificar-rtc30-v15.mjs "${1:-docs/design/capturas/v15-rtc30}"
