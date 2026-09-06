/**
 * LO QUE EL PIPELINE LE CAMBIÓ AL DICTADO SE VE Y SE DESHACE — TAMBIÉN EN LA
 * CONSULTA (D-001, Panel de Lujo 2026-09).
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `CambiosCifrasPanel` y `CorreccionesPanel` se apagaban a sí mismos con un
 * `if (pathname.startsWith('/consulta/')) return null`. La consulta SÍ los
 * montaba —con su `onRevertir` cableado— y el componente se negaba a pintarse:
 * en la consulta ambulatoria, que es el grueso del producto, las correcciones
 * automáticas de cifras, unidades, siglas y fármacos se aplicaban sobre el
 * dictado del médico sin que pudiera verlas ni deshacerlas.
 *
 * Esta misma prueba EXIGÍA ese comportamiento («GP4/GP12 — provenance sí,
 * plumbing técnico no»), así que el defecto estaba sellado: es el caso de manual
 * de una compuerta que acaba certificando el arreglo equivocado.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Auditor D (diseño/UX), hallazgo D-001, P1; equipo rojo confirmado. `git log -S`
 * sitúa el filtro en un commit de trabajo autónomo (118ce84, #390) y NO hay
 * ninguna fila en `agent-state/DECISION_LOG.md` ni en `V10_DECISION_LOG.md` que
 * lo respalde: no era una decisión del dueño, era una suposición.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * Se confundió «no dar trabajo de depuración al médico» con «no enseñarle lo
 * que le cambiaron». La primera se resuelve con jerarquía —el panel llega
 * plegado, con su conteo, y sólo se abre solo cuando algún cambio toca una
 * cifra—; la segunda no se resuelve escondiendo.
 *
 * ── REGLA ───────────────────────────────────────────────────────────────────
 *
 * clinical-safety §3 y REVERSIBILIDAD de `design-system.md`: toda corrección
 * automática es visible y reversible, sin excepción por ruta. Y el propio
 * módulo que produce los cambios lo tiene escrito (`src/lib/asr/cambios-visibles.ts`):
 * «la de cifras y unidades es la que toca dosis. Eso se enseña, y él decide».
 *
 * ── TIPO DE PRUEBA ──────────────────────────────────────────────────────────
 *
 * CONTRATO TEXTUAL sobre los dos componentes y la pantalla. Se prueba al revés
 * en el mismo archivo: si alguien vuelve a meter un `return null` por ruta, o
 * quita el `onRevertir` con el que la consulta los monta, esto se pone rojo.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * No cubre el DOM (los componentes no se montan aquí) ni que el `onRevertir`
 * devuelva el texto exacto al estado previo. No cubre las correcciones que el
 * médico hace con «Corregir con IA», que ya tienen su propio deshacer. No cubre
 * el sesgo de vocabulario previo a transcribir: eso no es una corrección sobre
 * texto, y por tanto no hay «antes» que enseñar.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const cifras = readFileSync(join(root, 'src/components/CambiosCifrasPanel.tsx'), 'utf8')
const correcciones = readFileSync(join(root, 'src/components/CorreccionesPanel.tsx'), 'utf8')
const consulta = readFileSync(join(root, 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

describe('Consultorio — la corrección automática se ve y se deshace', () => {
  it.each([
    ['cifras/unidades/siglas', cifras],
    ['correcciones léxicas', correcciones],
  ])('%s no se apaga por la ruta en la que está', (_nombre, source) => {
    expect(source).not.toContain('usePathname')
    expect(source).not.toContain("pathname.startsWith('/consulta/')")
  })

  it.each([
    ['cifras/unidades/siglas', cifras],
    ['correcciones léxicas', correcciones],
  ])('%s ofrece deshacer cada cambio, con el antes y el después a la vista', (_nombre, source) => {
    expect(source).toContain('onRevertir')
    expect(source).toMatch(/Deshacer/)
  })

  it('la consulta los monta con su deshacer cableado al texto del editor', () => {
    expect(consulta).toMatch(/<CambiosCifrasPanel[\s\S]{0,400}onRevertir/)
    expect(consulta).toMatch(/<CorreccionesPanel[\s\S]{0,400}onRevertir/)
    expect(consulta).toContain('voz.setTranscripcion')
  })

  it('la calma se conserva con jerarquía, no escondiendo: el panel de cifras llega plegado salvo que toque una dosis', () => {
    expect(cifras).toContain('cuantosTocanCifra')
    expect(cifras).toMatch(/abierto = plegado\?\.lista === cambios \? plegado\.abierto : conCifra > 0/)
    expect(correcciones).toMatch(/useState\(false\)/)   // las léxicas llegan cerradas
  })

  it('la ambigüedad clínicamente material conserva su canal contextual (no se sustituye uno por otro)', () => {
    expect(consulta).toContain('motivosDictado')
    expect(consulta).toContain('textosDeMotivos')
    expect(consulta).toContain('Conviene confirmar antes de firmar:')
  })
})
