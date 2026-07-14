import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Guardián de afirmaciones públicas (COPY_AND_CLAIMS).
 *
 * Escanea el copy orientado al cliente para que no reaparezcan afirmaciones
 * engañosas: nombres de competidores, adopción implícita cuando el producto es
 * nuevo, cumplimiento normativo declarado como certificación, controles de
 * seguridad no verificados presentados como listos, o absolutos ("100% seguro").
 * Es una red de regresión: si alguien vuelve a introducir uno, el test falla.
 */

const ARCHIVOS = [
  'src/app/page.tsx',
  'src/lib/planes-ia.ts',
  'src/app/demo/page.tsx',
  'src/app/precios/page.tsx',
]

const leer = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

// Solo la parte de copy visible (excluye comentarios de bloque /** */ y // …),
// para no marcar notas internas de código como el margen "garantizado".
function copyVisible(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
}

describe('claims-guard (copy público sin afirmaciones engañosas)', () => {
  const textos = ARCHIVOS.map(a => ({ a, t: copyVisible(leer(a)) }))

  it('no menciona competidores por nombre', () => {
    const comp = /doctoralia|nimbo|\bhuli\b|medesk|saludtools|agendapro/i
    for (const { a, t } of textos) expect(comp.test(t), `competidor en ${a}`).toBe(false)
  })

  it('no implica adopción existente ("médicos que ya…")', () => {
    const adopcion = /médicos que ya (automatizaron|usan|confían)|únete a (miles|cientos|los médicos que)/i
    for (const { a, t } of textos) expect(adopcion.test(t), `adopción implícita en ${a}`).toBe(false)
  })

  it('no presenta la NOM-004 como certificación (solo alineación/orientación)', () => {
    // Prohibido "cumple(mos) la NOM-004" / "certificado NOM-004"; permitido "orientada/alineada a…".
    const cert = /(cumpl\w*|certificad\w*)\s+(con\s+)?(la\s+)?NOM[-\s]?004/i
    for (const { a, t } of textos) expect(cert.test(t), `NOM-004 como certificación en ${a}`).toBe(false)
  })

  it('no declara respaldos/PITR como ya listos (deben mostrarse "en activación")', () => {
    // La frase antigua afirmaba PITR como entregado.
    const pitrListo = /respaldos con recuperación a un punto en el tiempo\.\s+Los detalles/i
    for (const { a, t } of textos) expect(pitrListo.test(t), `PITR declarado listo en ${a}`).toBe(false)
  })

  it('no usa absolutos de seguridad ("100% seguro", "totalmente seguro", "infalible")', () => {
    const abs = /100\s*%\s*seguro|totalmente seguro|infalible|imposible de hackear|inviolable/i
    for (const { a, t } of textos) expect(abs.test(t), `absoluto de seguridad en ${a}`).toBe(false)
  })
})
