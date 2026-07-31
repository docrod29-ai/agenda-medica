/**
 * Sella la HUELLA de cada motor junto a su versión.
 *
 * A6 de la auditoría maestra: seis motores cambiaron de lógica sin subir su
 * `_VERSION` —incluido el fix P0 de gasometría—, así que no se puede saber qué
 * versión calculó una nota vieja. Subirlas a mano una vez no arregla nada:
 * vuelve a pasar a la siguiente sesión.
 *
 * Esto lo convierte en un guardián: se guarda el hash del archivo junto a su
 * versión, y el test se pone rojo cuando el archivo cambia y la versión no.
 *
 * Uso: npx tsx scripts/sellar-motores-uci.ts   (tras subir las versiones a mano)
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const DIR = 'src/lib/uci'
const DESTINO = 'src/lib/uci/motores-sellados.json'

const sello: Record<string, { version: string; huella: string }> = {}
for (const f of readdirSync(DIR).filter(x => x.endsWith('.ts'))) {
  const src = readFileSync(join(DIR, f), 'utf8')
  const m = src.match(/export const (\w*VERSION) = '([\d.]+)'/)
  if (!m) continue
  sello[f] = {
    version: m[2],
    huella: createHash('sha256').update(src).digest('hex').slice(0, 16),
  }
}
writeFileSync(DESTINO, JSON.stringify(sello, null, 2) + '\n')
console.log(`\n  ${Object.keys(sello).length} motores sellados en ${DESTINO}\n`)
for (const [f, v] of Object.entries(sello)) console.log(`  ${f.padEnd(24)} v${v.version}`)
