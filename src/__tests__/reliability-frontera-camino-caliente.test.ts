/**
 * GOLDEN — LA FRONTERA ENTRE EL CAMINO CALIENTE Y EL TRABAJO DE FONDO.
 *
 * ── QUÉ SE VIGILA ────────────────────────────────────────────────────────────
 *
 * #310 y #320 (Gate 3) exigen que «ningún trabajo secundario congele la
 * consulta». Esa frase, suelta, no se puede comprobar: cada módulo decide por su
 * cuenta si su cosa es urgente. `src/lib/reliability/clases-de-trabajo.ts` la
 * convierte en una tabla, y esta prueba recorre la tabla.
 *
 * ── CÓMO SE DESCUBRIÓ QUE HACÍA FALTA ────────────────────────────────────────
 *
 * Inventariando el camino caliente para #310: `POST /api/appointments` —que es
 * camino caliente— lee la colección `time_blocks` ENTERA y consulta la
 * configuración del médico antes de escribir. Nadie había declarado en ningún
 * sitio que esa ruta fuese interactiva y que por tanto no pudiera hacer eso. La
 * declaración faltaba, así que la regla no existía.
 *
 * ── LA REGLA QUE HACE ESTO SEGURO ────────────────────────────────────────────
 *
 * Sólo `hot:firmar-nota` puede bloquear al médico, porque decir «firmado» sin
 * que lo esté es una mentira medicolegal. Todo lo demás degrada.
 *
 * ── LO QUE ESTA PRUEBA **NO** CUBRE ──────────────────────────────────────────
 *
 * No comprueba que el código de la aplicación USE estas clases: hoy la tabla es
 * el contrato y el cableado a las rutas es el handoff a #306 (ver
 * `docs/reliability/HANDOFF-306.md`). Una clase declarada y no cableada sigue
 * siendo una promesa; esta prueba sólo garantiza que la promesa es coherente.
 * Tampoco comprueba los NÚMEROS de `tiempoMaximoMs`: son presupuestos de
 * diseño, no SLO medidos, y no hay medición contra la que contrastarlos.
 */
import { describe, it, expect } from 'vitest'
import {
  PRESUPUESTOS, esCaminoCaliente, presupuestoDe, clasesQueViolanLaFrontera,
  type ClaseDeTrabajo,
} from '@/lib/reliability/clases-de-trabajo'

describe('frontera camino caliente / trabajo asíncrono', () => {
  it('ninguna clase asíncrona puede bloquear al médico', () => {
    expect(clasesQueViolanLaFrontera()).toEqual([])
  })

  it('AL REVÉS: si una clase asíncrona se marcara como bloqueante, el guardián lo caza', () => {
    // Se mete el defecto a propósito sobre una copia: si `clasesQueViolanLaFrontera`
    // sólo mirase las `hot:`, esta comprobación pasaría en verde con el fallo vivo.
    const conDefecto = { ...PRESUPUESTOS, 'async:whatsapp': { ...PRESUPUESTOS['async:whatsapp'], puedeBloquearAlMedico: true } }
    const violan = (Object.keys(conDefecto) as ClaseDeTrabajo[])
      .filter(c => !esCaminoCaliente(c) && conDefecto[c].puedeBloquearAlMedico)
    expect(violan).toEqual(['async:whatsapp'])
  })

  it('firmar es el ÚNICO bloqueo legítimo del camino caliente', () => {
    const bloquean = (Object.keys(PRESUPUESTOS) as ClaseDeTrabajo[]).filter(c => PRESUPUESTOS[c].puedeBloquearAlMedico)
    expect(bloquean).toEqual(['hot:firmar-nota'])
  })

  it('editar la nota no admite ni un reintento: es teclado, no red', () => {
    expect(presupuestoDe('hot:editar-nota').reintentosMaximos).toBe(0)
    expect(presupuestoDe('hot:editar-nota').tiempoMaximoMs).toBeLessThanOrEqual(100)
  })

  it('toda clase declarada explica POR QUÉ está donde está', () => {
    for (const clase of Object.keys(PRESUPUESTOS) as ClaseDeTrabajo[]) {
      expect(PRESUPUESTOS[clase].porQue.length, `${clase} sin justificación`).toBeGreaterThan(20)
    }
  })

  it('una clase sin presupuesto NO recibe un techo inventado: revienta', () => {
    // Devolver un valor por defecto convertiría un olvido en una cifra
    // inventada, que es exactamente lo que #310 prohíbe.
    expect(() => presupuestoDe('hot:inexistente' as ClaseDeTrabajo)).toThrow(/sin presupuesto declarado/)
  })

  it('el prefijo clasifica sin ambigüedad', () => {
    for (const clase of Object.keys(PRESUPUESTOS) as ClaseDeTrabajo[]) {
      expect(esCaminoCaliente(clase)).toBe(clase.startsWith('hot:'))
    }
  })
})
