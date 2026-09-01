#!/usr/bin/env bash
# ARNÉS GP-FINAL — el recorrido completo, de una sola orden.
#
# Levanta emuladores, siembra, construye, arranca y recorre el consultorio como
# médico y como paciente, más los escenarios de tortura. Deja tres actas en
# `docs/audit/gp-final/`.
#
# ── POR QUÉ NO REUTILIZA `arnes-flujos-v15.sh` ──────────────────────────────
#
# Aquél mide DIEZ FLUJOS de pantalla con su propio medidor y su propia acta, que
# consumen otras unidades. Esto no mide pantallas: recorre el consultorio de
# punta a punta y necesita además un SEGUNDO consultorio (sin él, «tenant
# equivocado = P0» no se puede ni intentar) y el estado devuelto a cero entre
# corridas. Las siembras que ya existen se reutilizan enteras; sólo se añade lo
# que falta.
#
# Uso:
#   bash scripts/golden-path/arnes-gp-final.sh
#
# Variables:
#   GP_MINUTOS    ciclos de trabajo de la consulta larga (por defecto 16)
#   GP_CHROMIUM   ruta al Chromium ya instalado
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RAIZ"

# Proyecto `demo-*`: el SDK se niega a hablar con un proyecto real. Es el mismo
# candado anti-producción del resto de los arneses.
export NEXT_PUBLIC_FIREBASE_EMULATORS=1
export NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-nexusmed-test
export NEXT_PUBLIC_FIREBASE_API_KEY=arnes-gp-final
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=localhost
export NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-nexusmed-test.appspot.com
export NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
export NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:arnesgpfinal
export FIREBASE_ADMIN_PROJECT_ID=demo-nexusmed-test
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
# Secreto SINTÉTICO, sólo para firmar los enlaces del arnés.
export PORTAL_PACIENTE_SECRET=${PORTAL_PACIENTE_SECRET:-arnes-gp-final-secreto-sintetico-no-produccion}

echo '── 1/6 siembras que ya existían ──'
node scripts/design/sembrar-capturas.mjs
node scripts/design/sembrar-rtc30.mjs
node scripts/design/sembrar-cita-por-delante-v15.mjs
node scripts/design/sembrar-receta-en-nota-firmada-v15.mjs

echo '── 2/6 siembra GP-FINAL (segundo consultorio + estado a cero) ──'
node scripts/golden-path/sembrar-gp-final.mjs

echo '── 3/6 build de producción (es lo que publica Vercel) ──'
npm run build

echo '── 4/6 next start ──'
# Un next-server huérfano sigue dueño del :3000 y sirve el build VIEJO contra un
# `.next` recién sobrescrito. Ya pasó en otros arneses; se limpia antes.
pkill -f 'next-server' 2>/dev/null || true
sleep 1
npx next start --port 3000 >/tmp/next-gp-final.log 2>&1 &
trap 'pkill -f "next-server" 2>/dev/null || true' EXIT
for _ in $(seq 1 180); do curl -sf -o /dev/null http://localhost:3000/login && break; sleep 1; done
curl -sf -o /dev/null http://localhost:3000/login || { echo 'next start nunca respondió'; tail -30 /tmp/next-gp-final.log; exit 1; }

echo '── 5/6 recorrido médico y de paciente ──'
node scripts/golden-path/recorrer-medico.mjs
node scripts/golden-path/sembrar-gp-final.mjs >/dev/null
node scripts/golden-path/recorrer-paciente.mjs

echo '── 6/6 tortura ──'
node scripts/golden-path/sembrar-gp-final.mjs >/dev/null
node scripts/golden-path/tortura.mjs

echo
echo 'Actas en docs/audit/gp-final/. Un P0 en cualquiera de las tres detiene el release.'
