/**
 * Corredor de la 4ª rebanada de V15-PERF-001: los tres arneses contra UN mismo
 * next start (el arnés de breakpoints mata el servidor en su trap de salida,
 * así que encadenarlos con && dejaba a los dos últimos sin servidor).
 * Vive como .mjs porque el arnés invoca `node "$MEDIDOR"`.
 */
import { spawnSync } from 'node:child_process'

const scripts = [
  'scripts/design/verificar-dictado-diferido-v15.mjs',
  'scripts/design/atribuir-js-consulta-v15.mjs',
  'scripts/design/medir-perf-v15.mjs',
]
for (const s of scripts) {
  console.log(`\n════ ${s} ════`)
  const r = spawnSync('node', [s], { stdio: 'inherit' })
  if (r.status !== 0) process.exit(r.status ?? 1)
}
