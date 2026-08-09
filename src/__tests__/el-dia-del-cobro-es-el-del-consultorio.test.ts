/**
 * EL DÍA DE UN COBRO ES EL DEL CONSULTORIO, NO EL DE CDMX — REG-293.
 *
 * ── LO MEDIDO ───────────────────────────────────────────────────────────────
 *
 * El webhook de Stripe calculaba el día del cobro con la zona **escrita a
 * mano**:
 *
 *     new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' })
 *
 * Y de ese `dia` cuelgan el campo `dia` y el `mes` del cobro — **los que filtra
 * el corte de caja**.
 *
 * A las 06:30 UTC, Ciudad de México dice **9 de agosto** y Tijuana dice **8**.
 * Un cobro a las 11:30 de la noche en Baja California se sellaba con la fecha
 * del **día siguiente**: caía en el corte del día que no era, y en el cambio de
 * mes, en el mes que no era.
 *
 * ── POR QUÉ ES EL PATRÓN DE SIEMPRE ─────────────────────────────────────────
 *
 * El consultorio **ya tiene** su `zonaHoraria` configurada, hay un módulo
 * `timezone.ts` entero para esto, y `clinicId` estaba a mano en esa misma
 * función. De catorce sitios que nombran la zona, **éste era el único que la
 * fijaba sin leer nunca la del consultorio**.
 *
 * Se arregló en la PANTALLA del corte de caja y quedó vivo en el lado que
 * **escribe**. Es la forma de REG-267: reparado en un sitio, vivo en el de al
 * lado — y el que quedó vivo es el que deja el dato guardado para siempre.
 *
 * ── LO QUE NO SE TOCA ───────────────────────────────────────────────────────
 *
 * Los cobros **ya guardados** conservan su día. Recalcularlos aquí sería
 * reescribir cortes de caja que el dueño ya cerró y cuadró, y eso no lo decide
 * un arreglo de software.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { fechaISOLocal, TZ_DEFAULT } from '@/lib/timezone'

const WEBHOOK = readFileSync(
  join(process.cwd(), 'src/app/api/stripe/webhook/route.ts'), 'utf8')

describe('el desfase existe y es de un día entero', () => {
  /**
   * El caso concreto: 06:30 UTC. Son las 12:30 de la madrugada en Ciudad de
   * México y todavía las 23:30 del día anterior en Tijuana.
   */
  const instante = new Date('2026-08-09T06:30:00Z')

  it('Ciudad de México y Tijuana NO dicen el mismo día', () => {
    expect(fechaISOLocal(instante, 'America/Mexico_City')).toBe('2026-08-09')
    expect(fechaISOLocal(instante, 'America/Tijuana')).toBe('2026-08-08')
  })

  it('y en el cambio de mes eso mueve el cobro de mes', () => {
    /** 06:30 UTC del 1 de septiembre son las 23:30 del 31 de agosto en Tijuana. */
    const finDeMes = new Date('2026-09-01T06:30:00Z')
    expect(fechaISOLocal(finDeMes, 'America/Mexico_City').slice(0, 7)).toBe('2026-09')
    expect(fechaISOLocal(finDeMes, 'America/Tijuana').slice(0, 7)).toBe('2026-08')
  })
})

describe('el webhook ya no fija la zona a mano', () => {
  it('no queda ningún `America/Mexico_City` escrito', () => {
    expect(
      WEBHOOK,
      'volvió a fijarse la zona a mano: el día del cobro dejaría de ser el del consultorio',
    ).not.toContain('America/Mexico_City')
  })

  it('lee la `zonaHoraria` del consultorio', () => {
    expect(WEBHOOK).toContain('zonaHoraria')
  })

  it('y usa el ayudante común, no una tercera forma de formatear', () => {
    /**
     * Tres maneras de calcular «qué día es» en el mismo repositorio acaban
     * discrepando. Es la lección que ya costó el partidor de alergias, seis
     * copias.
     */
    expect(WEBHOOK).toMatch(/fechaISOLocal\(ahora, tzClinica\)/)
  })

  it('si el consultorio no la tiene configurada, cae en la de por defecto', () => {
    /**
     * Sin este respaldo, un consultorio sin zona rompería el registro del cobro
     * — y perder el dato es peor que tenerlo con la zona de la capital.
     */
    expect(WEBHOOK).toMatch(/TZ_DEFAULT/)
    expect(TZ_DEFAULT).toBe('America/Mexico_City')
  })

  it('y si la lectura falla, tampoco se cae: se usa la de por defecto', () => {
    /** Un cobro no puede perderse porque no se pudo leer el consultorio. */
    expect(WEBHOOK).toMatch(/catch \{ return TZ_DEFAULT \}/)
  })
})

describe('lo que este arreglo NO hace, dicho en vez de dejarlo creer', () => {
  it('no recalcula los cobros ya guardados', () => {
    /**
     * Conservan su día. Recalcularlos sería reescribir cortes de caja que el
     * dueño ya cerró y cuadró — y eso no lo decide un arreglo de software.
     */
    expect(WEBHOOK).not.toMatch(/recalcul|migrar.*cobros/i)
  })
})
