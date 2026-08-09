/**
 * EL DIÁLOGO QUE LE BORRÓ EL PLAN AL DR. — REG-195.
 *
 * ── LO QUE PASÓ, CON SUS PALABRAS ────────────────────────────────────────────
 *
 * «tengo el plan hecho, borro medicamentos y me borras el plan de la nota y ya
 * la firmé y ya se perdió».
 *
 * ── LA CAUSA ─────────────────────────────────────────────────────────────────
 *
 * Al pulsar Firmar, si la IA había marcado líneas con `[IA — no dictado]`, salía
 * un diálogo ofreciendo «Quitarlas y firmar». **El plan es justamente lo que la
 * IA redacta**, porque el médico no dicta el plan palabra por palabra: lo dicta
 * en prosa y el sistema lo estructura.
 *
 * El diálogo fallaba en las TRES mitades a la vez:
 *
 * 1. **No decía QUÉ iba a quitar.** «3 líneas que no dictaste» no deja ver que
 *    una de ellas es el plan de abordaje entero.
 * 2. **No se podía deshacer.** El `snapshotUndo` existía desde hacía versiones
 *    y este camino no lo usaba.
 * 3. **«Quitarlas y firmar» NO FIRMABA** — hace `return`. El médico pulsa
 *    creyendo que cierra la nota, se le borra el plan, la nota sigue abierta, y
 *    al volver a pulsar firmar la firma **sin el plan**.
 *
 * Las tres juntas son cómo se pierde una nota entera sin un solo error en
 * pantalla.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { lineasSugeridas, sugerenciasPendientes, MARCA_SUGERENCIA } from '@/lib/expediente/sugerencias-ia'

const page = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8',
)

const secciones = [
  { key: 'planAbordajeDx', label: 'Plan de abordaje diagnóstico',
    value: `Solicitar PFH de control.\n${MARCA_SUGERENCIA} Reintroducción escalonada con control a las 72 h.` },
  { key: 'planTratamiento', label: 'Plan de tratamiento',
    value: `${MARCA_SUGERENCIA} Rifampicina 300 mg cada 24 h por una semana.` },
  { key: 'padecimientoActual', label: 'Padecimiento actual', value: 'Cuadro de tres meses.' },
]

describe('ahora se ve QUÉ se va a quitar', () => {
  it('lista las líneas sugeridas, no sólo cuántas', () => {
    expect(lineasSugeridas(secciones)).toHaveLength(2)
  })

  it('cada una lleva delante la sección a la que pertenece', () => {
    // «Plan de tratamiento: …» dice mucho más que el texto suelto: es lo que
    // permite ver que se está a punto de borrar el plan.
    const l = lineasSugeridas(secciones)
    expect(l[0]).toContain('Plan de abordaje diagnóstico:')
    expect(l[1]).toContain('Plan de tratamiento:')
  })

  it('sin la marca dentro del texto', () => {
    for (const l of lineasSugeridas(secciones)) {
      expect(l).not.toContain(MARCA_SUGERENCIA)
    }
  })

  it('lo que el médico escribió a mano no aparece', () => {
    expect(lineasSugeridas(secciones).join(' ')).not.toContain('Cuadro de tres meses')
    expect(lineasSugeridas(secciones).join(' ')).not.toContain('Solicitar PFH')
  })

  it('sin sugerencias, no hay nada que enseñar', () => {
    expect(lineasSugeridas([{ label: 'x', value: 'texto normal' }])).toEqual([])
    expect(sugerenciasPendientes([{ value: 'texto normal' }])).toBe(0)
  })
})

describe('el diálogo dice la verdad', () => {
  it('enseña las líneas antes de borrarlas', () => {
    expect(page).toContain('lineasSugeridas(secciones)')
  })

  it('el botón ya no promete firmar, porque no firma', () => {
    // Decía «Quitarlas y firmar» y hacía `return`. El médico creía haber
    // cerrado la nota.
    expect(page).not.toContain("confirmar: 'Quitarlas y firmar'")
    expect(page).toContain("confirmar: 'Quitarlas'")
  })

  it('y avisa de que se puede deshacer', () => {
    expect(page).toContain('PUEDES DESHACERLO')
  })
})

describe('se puede deshacer, que es lo que faltaba', () => {
  it('guarda el estado antes de quitar', () => {
    const i = page.indexOf("setSecciones(prev => resolverSugerencias(prev, 'quitar'))")
    expect(i).toBeGreaterThan(0)
    const antes = page.slice(Math.max(0, i - 400), i)
    expect(antes).toContain('setSnapshotUndo({ resumen, secciones, diagnosticos, medicamentos, signos })')
  })

  it('y el botón de deshacer repone las secciones', () => {
    expect(page).toContain('setSecciones(snapshotUndo.secciones)')
  })
})
