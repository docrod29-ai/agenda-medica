#!/usr/bin/env bash
# ARNÉS — el control que NAVEGA (V15-A11Y-001, rebanada «el botón que navega»).
#
# Igual que arnes-breakpoints-v15.sh, con UNA diferencia: siembra además una
# cita por delante de la hora del consultorio, para que el héroe NOW de Hoy se
# pinte a cualquier hora del día. Sin eso, una corrida de madrugada UTC —de
# noche en México— audita una pantalla SIN su control primario, y el reloj de
# la máquina acaba decidiendo qué se mide.
#
# No se toca el arnés compartido: añadir una cita ahí movería los números de
# todas las demás actas.
#
# Uso: node_modules/.bin/firebase emulators:exec --only auth,firestore \
#        --project demo-nexusmed-test "bash scripts/design/arnes-boton-que-navega-v15.sh [antes|despues]"
set -euo pipefail

export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099

echo '── 1/3 siembra sintética (base + cita por delante) ──'
node scripts/design/sembrar-capturas.mjs
node scripts/design/sembrar-cita-por-delante-v15.mjs

echo '── 2/3 next start (build de producción previo) ──'
# Un next-server huérfano de una corrida anterior seguiría sirviendo el build
# VIEJO desde el :3000 (la lección del fantasma de entrega de nx-stat-grid).
pkill -f 'next-server' 2>/dev/null || true
sleep 1
npx next start --port 3000 >/tmp/next-v15-boton-que-navega.log 2>&1 &
NEXT_PID=$!
trap 'kill $NEXT_PID 2>/dev/null || true; pkill -f "next-server" 2>/dev/null || true' EXIT

for i in $(seq 1 120); do
  if curl -sf -o /dev/null http://localhost:3000/login; then break; fi
  if ! kill -0 $NEXT_PID 2>/dev/null; then echo 'next start murió'; tail -30 /tmp/next-v15-boton-que-navega.log; exit 1; fi
  sleep 1
done
curl -sf -o /dev/null http://localhost:3000/login || { echo 'next start nunca respondió'; tail -30 /tmp/next-v15-boton-que-navega.log; exit 1; }
echo 'next start listo'

echo "── 3/3 medir-boton-que-navega-v15.mjs ${1:-antes} ──"
node scripts/design/medir-boton-que-navega-v15.mjs "${1:-antes}"
