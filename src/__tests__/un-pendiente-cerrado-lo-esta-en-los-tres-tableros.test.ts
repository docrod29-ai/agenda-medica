/**
 * UN PENDIENTE CERRADO LO ESTÁ EN LOS TRES TABLEROS — V9 · DESIGN-SYSTEM-001.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El 8-ago-2026 se cerraron los tres P0 de audio de V9. El commit que lo
 * anotaba (`d22fbfd`) lo dice en su propio mensaje:
 *
 *     «Se marcan donde V9 los declaró abiertos, no sólo en el ledger: un
 *      pendiente que se cierra en un sitio y sigue abierto en otro es la misma
 *      forma de REG-267.»
 *
 * Y tocó dos archivos: `CURRENT_ITERATION.md` y `CURRENT_PRODUCT_DESIGN_AUDIT.md`.
 *
 * **No tocó `agent-state/BACKLOG.json`** — que es justo el archivo que la
 * directiva V9 §3 nombra como el backlog priorizado del programa, y el único
 * que una sesión nueva puede leer con un `grep` para saber qué queda. Al día
 * siguiente, la primera pregunta de la sesión —«¿qué está abierto?»— se
 * contestó con tres P0 falsos, ya reparados y desplegados desde v1158/v1161.
 *
 * El commit que avisaba del defecto lo cometió mientras lo describía.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Al reanudar V9 el 9-ago: `BACKLOG.json` decía `pendiente` para
 * `PATIENT-AUDIO-001` y el código ya tenía el arreglo
 * (`borrarChunks(clave, recoveryBase)` en `useGrabacionAudio.ts:1651`). Se
 * comprobó contra el árbol, no contra el tablero.
 *
 * ── LA CAUSA RAÍZ QUE SE ATACA ──────────────────────────────────────────────
 *
 * El mismo estado clínico —«esto está cerrado»— vive escrito a mano en tres
 * sitios, y cerrarlo en los tres es un acto voluntario que se puede olvidar.
 * Es la familia `depende_de_recordar`, y la respuesta de esta casa ya está
 * escrita: lo derivable se deriva, y lo que no se puede derivar **se cruza**.
 *
 * Aquí no se puede derivar (el criterio de cierre es humano), así que se cruza:
 * si un tablero dice CERRADO, el backlog no puede decir pendiente.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Dos, y la segunda importa tanto como la primera:
 *
 * 1. **Contradicción = fallo.** Un `CERRADO` en cualquier tablero obliga al
 *    backlog.
 * 2. **El silencio no cierra nada.** Que un tablero no mencione un elemento no
 *    dice nada sobre él — «ausencia de dato no es dato de ausencia», regla 4 de
 *    seguridad clínica, que aquí vale igual. Sólo se comparan afirmaciones.
 *
 * Y una tercera sobre la evidencia: un elemento marcado `cerrado` tiene que
 * traer **con qué**. Sin evidencia no está cerrado, igual que en el loop una
 * unidad sin SHA no está cerrada.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - No comprueba que el arreglo exista de verdad. Comprueba que los tableros
 *   **no se contradigan**. Tres tableros pueden mentir a coro.
 * - No caza el caso inverso —arreglado en el código y abierto en los tres
 *   tableros—, que es lo que pasó aquí antes de este guardián. Para eso hace
 *   falta leer el código, y eso no se deriva.
 * - Sólo lee los dos tableros de V9 que hoy usan la palabra `CERRADO` junto al
 *   identificador. Un tablero nuevo que invente otra forma de decirlo no se
 *   vigila: es vocabulario, no criterio, y se declara aquí.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = process.cwd()

/** Los tableros de prosa donde V9 declara el estado de sus elementos. */
const TABLEROS = [
  'agent-state/CURRENT_ITERATION.md',
  'docs/design/CURRENT_PRODUCT_DESIGN_AUDIT.md',
]

type Item = { id: string; prioridadV9?: string; estado?: string; cierre?: { fecha?: string; evidencia?: string[] } }

const backlog = JSON.parse(readFileSync(join(RAIZ, 'agent-state/BACKLOG.json'), 'utf8')) as { items: Item[] }
const deV9 = backlog.items.filter(i => i.prioridadV9)

/**
 * Identificadores que un tablero declara CERRADOS. Pura sobre el texto, para
 * poder probarla al revés.
 */
export function idsCerradosEn(texto: string, ids: string[]): Set<string> {
  const cerrados = new Set<string>()
  for (const linea of texto.split('\n')) {
    if (!/\bCERRAD[AO]\b/i.test(linea)) continue
    for (const id of ids) if (linea.includes(id)) cerrados.add(id)
  }
  return cerrados
}

describe('los tableros de V9 no se contradicen', () => {
  const ids = deV9.map(i => i.id)

  it('hay elementos de V9 que comparar (si no, este guardián no prueba nada)', () => {
    expect(ids.length).toBeGreaterThan(10)
  })

  for (const tablero of TABLEROS) {
    it(`lo que ${tablero} da por CERRADO, el backlog no lo llama pendiente`, () => {
      const texto = readFileSync(join(RAIZ, tablero), 'utf8')
      const cerradosAlli = idsCerradosEn(texto, ids)
      const contradicciones = [...cerradosAlli].filter(
        id => deV9.find(i => i.id === id)?.estado !== 'cerrado',
      )
      expect(
        contradicciones,
        `${tablero} los declara cerrados y BACKLOG.json no. Ciérralos también ahí.`,
      ).toEqual([])
    })
  }

  it('todo elemento cerrado trae evidencia — sin ella no está cerrado', () => {
    const sinEvidencia = deV9
      .filter(i => i.estado === 'cerrado')
      .filter(i => !i.cierre?.fecha || !(i.cierre.evidencia?.length))
      .map(i => i.id)
    expect(sinEvidencia, 'añade `cierre: { fecha, evidencia: [...] }`').toEqual([])
  })

  it('AL REVÉS: una línea que cierra un identificador se detecta', () => {
    const tablero = '| 1 | **Volver a grabar borra el audio** | **CERRADO v1158 (REG-283)** — `PATIENT-AUDIO-001` |'
    expect([...idsCerradosEn(tablero, ['PATIENT-AUDIO-001', 'A11Y-GATE-001'])]).toEqual(['PATIENT-AUDIO-001'])
  })

  it('AL REVÉS: mencionar un identificador SIN cerrarlo no lo cierra', () => {
    // «Ausencia de dato no es dato de ausencia»: el silencio no afirma nada, y
    // una mención tampoco. Si esto fallara, el guardián inventaría cierres.
    const tablero = '**4. Luego `DESIGN-THEME-001`**, empezando por `@theme inline`.'
    expect([...idsCerradosEn(tablero, ['DESIGN-THEME-001'])]).toEqual([])
  })
})
