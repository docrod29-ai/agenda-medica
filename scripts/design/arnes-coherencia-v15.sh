#!/usr/bin/env bash
# ARNÉS DE COHERENCIA DE PRODUCTO (V15-FINAL-COHERENCE-001) — siembra base +
# RTC-30 + cita por delante + medicamentos en nota firmada + next start +
# la matriz de coherencia a 1440×900 y 390×844.
#
# ── POR QUÉ LAS CUATRO SIEMBRAS, Y NO MENOS ────────────────────────────────
#
# Son las mismas cuatro del banco de flujos, y por las mismas razones — que
# aquí se vuelven MÁS estrictas, no menos, porque esta matriz compara
# superficies entre sí y una superficie mal sembrada no sale «vacía»: sale
# DISTINTA de sus hermanas, y eso se lee como defecto de coherencia.
#
#  · `sembrar-capturas.mjs` — la identidad, los pacientes y las notas.
#  · `sembrar-rtc30.mjs` — inventario de farmacia; sin él `/operaciones` se
#    mide sin una de sus tres fuentes de excepción.
#  · `sembrar-cita-por-delante-v15.mjs` — el héroe NOW de Hoy sólo se pinta si
#    queda una cita por delante en la hora del CONSULTORIO. Sin esto, Hoy se
#    mediría sin su acción primaria y la matriz publicaría «Hoy: 0 primarias»
#    como si fuera un defecto de jerarquía.
#  · `sembrar-receta-en-nota-firmada-v15.mjs` — ninguna nota de la siembra base
#    lleva medicamentos, y `/receta/<pac>/<nota>` sin medicamentos no es la
#    pantalla que se quiere medir.
#
# Uso: node_modules/.bin/firebase emulators:exec --only auth,firestore \
#        --project demo-nexusmed-test "bash scripts/design/arnes-coherencia-v15.sh"
set -euo pipefail

export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099

echo '── 1/6 siembra sintética base ──'
node scripts/design/sembrar-capturas.mjs

echo '── 2/6 siembra extra RTC-30 (inventario de farmacia) ──'
node scripts/design/sembrar-rtc30.mjs

echo '── 3/6 cita por delante (para que Hoy tenga héroe NOW a cualquier hora) ──'
node scripts/design/sembrar-cita-por-delante-v15.mjs

echo '── 4/6 medicamentos en una nota firmada (para que /receta tenga qué pintar) ──'
node scripts/design/sembrar-receta-en-nota-firmada-v15.mjs

echo '── 5/6 next start (build de producción previo) ──'
# Un next-server huérfano de una corrida anterior sigue dueño del :3000 y sirve
# el build VIEJO contra un `.next` recién sobrescrito. Ya pasó; se limpia antes.
pkill -f 'next-server' 2>/dev/null || true
sleep 1
npx next start --port 3000 >/tmp/next-v15-coherencia.log 2>&1 &
NEXT_PID=$!
trap 'kill $NEXT_PID 2>/dev/null || true; pkill -f "next-server" 2>/dev/null || true' EXIT

for i in $(seq 1 120); do
  if curl -sf -o /dev/null http://localhost:3000/login; then break; fi
  if ! kill -0 $NEXT_PID 2>/dev/null; then echo 'next start murió'; tail -30 /tmp/next-v15-coherencia.log; exit 1; fi
  sleep 1
done
curl -sf -o /dev/null http://localhost:3000/login || { echo 'next start nunca respondió'; tail -30 /tmp/next-v15-coherencia.log; exit 1; }
echo 'next start listo'

echo '── 6/6 la matriz de coherencia (1440×900 y 390×844) ──'
node "${1:-scripts/design/medir-coherencia-de-producto-v15.mjs}"
