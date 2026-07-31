/**
 * GUARDIÁN — un motor no cambia de lógica sin cambiar de versión.
 *
 * A6 de la auditoría maestra: seis motores de UCI cambiaron sin subir su
 * `_VERSION`, incluido el fix P0 de gasometría. La consecuencia no es de estilo:
 * una nota firmada guarda la versión del motor que la calculó, y si dos lógicas
 * distintas comparten el mismo número, **no se puede saber qué cuenta produjo
 * una nota vieja**. En una revisión clínica eso es la diferencia entre poder
 * explicar un valor y no poder.
 *
 * Subir las versiones a mano una vez no lo arregla: vuelve a pasar. Esto lo
 * convierte en un gate.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import sellado from '@/lib/uci/motores-sellados.json'

const DIR = 'src/lib/uci'
const SELLO = sellado as Record<string, { version: string; huella: string }>

const motoresEnDisco = (): Record<string, { version: string; huella: string; src: string }> => {
  const out: Record<string, { version: string; huella: string; src: string }> = {}
  for (const f of readdirSync(DIR).filter(x => x.endsWith('.ts'))) {
    const src = readFileSync(join(DIR, f), 'utf8')
    const m = src.match(/export const (\w*VERSION) = '([\d.]+)'/)
    if (!m) continue
    out[f] = { version: m[2], huella: createHash('sha256').update(src).digest('hex').slice(0, 16), src }
  }
  return out
}

describe('A6 · un motor no cambia sin cambiar de versión', () => {
  const disco = motoresEnDisco()

  it('el guardián encuentra motores de verdad (si no, pasaría vacío)', () => {
    expect(Object.keys(disco).length).toBeGreaterThanOrEqual(18)
  })

  it('todo motor que cambió subió su versión', () => {
    /**
     * Para arreglar un rojo aquí: sube la `_VERSION` del motor que tocaste y
     * corre `npx tsx scripts/sellar-motores-uci.ts`. Re-sellar SIN subir la
     * versión es exactamente lo que este caso existe para impedir.
     */
    const mudos: string[] = []
    for (const [f, d] of Object.entries(disco)) {
      const s = SELLO[f]
      if (!s) continue                       // motor nuevo: lo cubre el caso de abajo
      if (d.huella !== s.huella && d.version === s.version) mudos.push(`${f} (sigue en v${d.version})`)
    }
    expect(mudos, `motores cambiados sin subir versión: ${mudos.join(', ')}`).toEqual([])
  })

  it('un motor nuevo entra al sello, no se queda fuera en silencio', () => {
    const fuera = Object.keys(disco).filter(f => !SELLO[f])
    expect(fuera, `sin sellar: ${fuera.join(', ')}`).toEqual([])
  })

  it('y un motor no desaparece del sello sin que nadie lo note', () => {
    // Si se borra un archivo, el sello se queda apuntando a algo que ya no está.
    const fantasmas = Object.keys(SELLO).filter(f => !disco[f])
    expect(fantasmas, `sellados pero ya no existen: ${fantasmas.join(', ')}`).toEqual([])
  })
})
