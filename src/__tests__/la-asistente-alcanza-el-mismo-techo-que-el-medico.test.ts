/**
 * GOLDEN — el portal del asistente llega al mismo sitio que el resto de la agenda.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El portal del asistente navega por meses con dos flechas, y su tope estaba
 * escrito a mano:
 *
 *     const MAX_MES_OFFSET = 12
 *
 * Eso hacía de esa pantalla un **tercer** horizonte, sin decirlo:
 *
 *   · techo de la plataforma      2050-12-31   (`FECHA_MAXIMA_AGENDA`)
 *   · ventana del portal público  365 días     (`DIAS_VENTANA_RESERVA_PUBLICA`)
 *   · portal del asistente        12 meses     ← inventado ahí
 *
 * Y la misma asistente, en la pantalla de `citas` de al lado, tiene un campo de
 * fecha con `max="2050-12-31"`. Dos superficies para la misma persona, dos
 * alcances distintos, y ninguna que explicara el suyo: pedirle una cita a
 * dieciocho meses era imposible en una pantalla y trivial en la otra.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Recorriendo el alta de la asistente en un navegador real para completar el
 * camino de punta a punta. La flecha ▶ se apagaba en agosto de 2027.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Un número redondo escrito a mano donde había que preguntar por el techo.
 * Familia «el sistema se contradice a sí mismo»: dos partes correctas por
 * separado, y el fallo viviendo en el hueco entre las dos.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - No mide cuántos clics hacen falta para llegar. Son 292, medidos en
 *   navegador: el tope ya es verdadero, pero saltar de año sigue sin existir.
 *   Es una carencia de interfaz declarada, no un defecto de este arreglo.
 * - No comprueba que el mes se pinte bien; eso está en las capturas.
 */
import { describe, it, expect } from 'vitest'
import { mesesHastaElTecho, FECHA_MAXIMA_AGENDA, esFechaDeAgendaValida } from '@/lib/agenda/horizonte'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const ASISTENTE = leer('src/app/(dashboard)/asistente/page.tsx')
const sinImports = (s: string) => s.replace(/^\s*import[^\n]*$/gm, '')

describe('los meses hasta el techo se calculan, no se inventan', () => {
  it('desde el mes del techo quedan cero', () => {
    expect(mesesHastaElTecho('2050-12-01')).toBe(0)
    expect(mesesHastaElTecho('2050-12-31')).toBe(0)
  })

  it('cuenta meses de calendario, no días', () => {
    expect(mesesHastaElTecho('2050-11-01')).toBe(1)
    expect(mesesHastaElTecho('2049-12-01')).toBe(12)
    expect(mesesHastaElTecho('2026-08-29')).toBe((2050 - 2026) * 12 + (12 - 8))
  })

  it('nunca es negativo — una fecha pasada el techo no abre la flecha al revés', () => {
    expect(mesesHastaElTecho('2051-06-01')).toBe(0)
    expect(mesesHastaElTecho('2099-01-01')).toBe(0)
  })

  it('el último mes alcanzable es el del techo, y el siguiente ya no es válido', () => {
    expect(FECHA_MAXIMA_AGENDA).toBe('2050-12-31')
    expect(esFechaDeAgendaValida('2050-12-31')).toBe(true)
    expect(esFechaDeAgendaValida('2051-01-01')).toBe(false)
  })
})

describe('el portal del asistente pregunta por el techo en vez de suponerlo', () => {
  it('no queda el 12 escrito a mano', () => {
    const codigo = sinImports(ASISTENTE).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
    expect(codigo, 'volvió el tope inventado').not.toMatch(/MAX_MES_OFFSET\s*=\s*12\b/)
    expect(codigo).toContain('mesesHastaElTecho(')
  })

  it('y tampoco ofrece días que el servidor va a rechazar', () => {
    // El generador del mes recorta por HOY y por el techo, no sólo por hoy.
    expect(sinImports(ASISTENTE)).toContain('esFechaDeAgendaValida(iso)')
  })

  it('la pantalla de citas de al lado sigue teniendo el mismo techo', () => {
    // Es la comparación que delataba la contradicción.
    expect(leer('src/app/(dashboard)/citas/page.tsx')).toContain('max={FECHA_MAXIMA_AGENDA}')
  })
})
