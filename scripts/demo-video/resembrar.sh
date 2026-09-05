#!/usr/bin/env bash
# Vuelve a dejar el consultorio sintético como al principio (antes de cada grabación).
set -euo pipefail
cd "$(dirname "$0")/../.."
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
npm run -s arnes:sembrar | grep -E "✓|✗"
node scripts/carril-excelencia/sembrar-reserva.mjs | tail -1
npx tsx scripts/demo-video/sembrar-extra.ts | tail -1
