#!/usr/bin/env bash
# ARNÉS DE FLUJOS CLÍNICOS (V15-WORKFLOW-BENCHMARK-001) — siembra base +
# siembra RTC-30 + cita por delante + next start + banco de los diez flujos.
#
# ── POR QUÉ NO REUTILIZA NINGUNO DE LOS ARNESES QUE YA HAY ──────────────────
#
#  · `arnes-encuentro-v15.sh` y `arnes-axe-v15.sh` fijan su medidor en el paso
#    4 y sus actas las consumen otras corridas.
#  · `arnes-breakpoints-v15.sh` siembra SÓLO la base: sin `sembrar-rtc30.mjs`
#    no hay inventario de farmacia y `/operaciones` se mediría sin una de sus
#    tres fuentes — o sea, WF-09 mediría una pantalla sin excepciones.
#  · `arnes-boton-que-navega-v15.sh` sí siembra la cita por delante, pero mide
#    otra cosa y su acta es de otra unidad.
#
# Las TRES siembras juntas son lo que este banco necesita, y ninguna de las que
# existen las junta. Por qué la tercera hace falta: el héroe NOW de Hoy sólo se
# pinta si queda una cita por delante en la hora del CONSULTORIO
# (America/Mexico_City), no la del contenedor. Una corrida de madrugada UTC
# mediría WF-01 sin la acción primaria de la pantalla y no lo diría — el mismo
# defecto de instrumento que ya se cazó en `medir-boton-que-navega-v15.mjs`.
#
# Uso: node_modules/.bin/firebase emulators:exec --only auth,firestore \
#        --project demo-nexusmed-test "bash scripts/design/arnes-flujos-v15.sh"
set -euo pipefail

export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099

echo '── 1/6 siembra sintética base ──'
node scripts/design/sembrar-capturas.mjs

echo '── 2/6 siembra extra RTC-30 (inventario de farmacia) ──'
node scripts/design/sembrar-rtc30.mjs

echo '── 3/6 cita por delante (para que Hoy tenga héroe NOW a cualquier hora) ──'
node scripts/design/sembrar-cita-por-delante-v15.mjs

# WF-05 recorre ENCUENTRO → RECETA → VUELTA, y ese camino lo abre
# `ComoCerrarLaConsulta`, que sólo ofrece receta si la nota FIRMADA trae
# medicamentos. Ninguna nota de la siembra base los trae (todas van con
# `medicamentos: []`), así que sin esto WF-05 no se puede recorrer — y no por
# el producto, sino por el corpus.
echo '── 4/6 medicamentos en una nota firmada (para que WF-05 tenga receta) ──'
node scripts/design/sembrar-receta-en-nota-firmada-v15.mjs

echo '── 5/6 next start (build de producción previo) ──'
# Un next-server huérfano de una corrida anterior sigue dueño del :3000 y sirve
# el build VIEJO contra un `.next` recién sobrescrito. Ya pasó; se limpia antes.
pkill -f 'next-server' 2>/dev/null || true
sleep 1
npx next start --port 3000 >/tmp/next-v15-flujos.log 2>&1 &
NEXT_PID=$!
trap 'kill $NEXT_PID 2>/dev/null || true; pkill -f "next-server" 2>/dev/null || true' EXIT

for i in $(seq 1 120); do
  if curl -sf -o /dev/null http://localhost:3000/login; then break; fi
  if ! kill -0 $NEXT_PID 2>/dev/null; then echo 'next start murió'; tail -30 /tmp/next-v15-flujos.log; exit 1; fi
  sleep 1
done
curl -sf -o /dev/null http://localhost:3000/login || { echo 'next start nunca respondió'; tail -30 /tmp/next-v15-flujos.log; exit 1; }
echo 'next start listo'

echo '── 6/6 banco de los diez flujos (1440×900 y 390×844) ──'
node "${1:-scripts/design/medir-flujos-clinicos-v15.mjs}"
