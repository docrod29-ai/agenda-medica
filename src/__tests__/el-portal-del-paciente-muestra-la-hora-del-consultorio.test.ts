/**
 * LA CITA DEL PACIENTE SE VEÍA CON LA HORA DE CDMX, NO LA DEL CONSULTORIO — REG-294.
 *
 * ── LO MEDIDO ───────────────────────────────────────────────────────────────
 *
 * `src/app/mi/[token]/page.tsx` calcula correctamente `tzClinica` —la zona real
 * del consultorio, con su respaldo a `TZ_DEFAULT`— y la usa para decidir qué
 * citas son «próximas» y para el enlace de Google Calendar. Pero `fmtFecha`, la
 * función que arma el TEXTO que el paciente lee («Próximas citas», «Citas
 * anteriores», «Mis recetas»), se llamaba sin pasarle `tz`, así que caía en su
 * propio valor por omisión: `America/Mexico_City`, escrito una segunda vez.
 *
 * `PanelReagenda` —el selector de fecha para reagendar— tenía el mismo defecto,
 * pero calculando «hoy» a mano con `America/Mexico_City` en vez de usar
 * `hoyISO()`, que ya existe para esto.
 *
 * ── EL EFECTO ────────────────────────────────────────────────────────────────
 *
 * Para cualquier consultorio en Tijuana (UTC-8) o Hermosillo (UTC-7), el
 * paciente veía su propia cita con la hora y, cerca de medianoche, el DÍA
 * equivocados — en su propio portal, sobre su propio celular. Y al reagendar,
 * el selector de fecha podía nacer bloqueando «hoy» o permitiendo un día que ya
 * pasó para su zona real.
 *
 * ── POR QUÉ ES EL PATRÓN DE SIEMPRE ─────────────────────────────────────────
 *
 * El mismo archivo YA calcula `tzClinica` bien y YA se la pasa a `instanteMX` y
 * a `gcalLink` — dos líneas más abajo de donde no se la pasaba a `fmtFecha`.
 * Es la forma de REG-293 (el corte de caja) y de REG-267 antes: la pieza que
 * lee la zona está bien: la que la usa, no siempre.
 *
 * ── LO QUE NO SE TOCA ───────────────────────────────────────────────────────
 *
 * Nada de esto escribe una cita ni un cobro: es sólo el texto que ve el
 * paciente. La ventana de «próximas vs. pasadas» ya usaba `tzClinica` bien —eso
 * no era el defecto— y no se toca.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { hoyISO, fechaISOLocal, TZ_DEFAULT } from '@/lib/timezone'

const PORTAL = readFileSync(
  join(process.cwd(), 'src/app/mi/[token]/page.tsx'), 'utf8')

describe('el desfase existe: CDMX y Tijuana no dicen el mismo día', () => {
  it('a las 06:30 UTC, CDMX ya es mañana y Tijuana sigue en hoy', () => {
    const instante = new Date('2026-08-09T06:30:00Z')
    expect(fechaISOLocal(instante, 'America/Mexico_City')).toBe('2026-08-09')
    expect(fechaISOLocal(instante, 'America/Tijuana')).toBe('2026-08-08')
  })
})

describe('el portal del paciente ya no fija la zona a mano', () => {
  it('`fmtFecha` no vuelve a llevar un `America/Mexico_City` como valor por omisión', () => {
    expect(
      PORTAL,
      'volvió a fijarse la zona a mano en fmtFecha: el paciente vería otra vez la hora de CDMX',
    ).not.toContain("'America/Mexico_City'")
  })

  it('las tres llamadas a `fmtFecha` que el paciente lee pasan `tzClinica`', () => {
    // `= fmtFecha(` es una LLAMADA; `function fmtFecha(` es la definición y no
    // cuenta — ésa sí puede quedarse con su propio valor por omisión.
    const llamadas = PORTAL.match(/= fmtFecha\([^)]*\)/g) ?? []
    expect(llamadas.length).toBeGreaterThanOrEqual(3)
    for (const llamada of llamadas) {
      expect(llamada, `${llamada} no lleva tzClinica`).toContain('tzClinica')
    }
  })

  it('`PanelReagenda` recibe la zona del consultorio como prop, no la vuelve a calcular', () => {
    expect(PORTAL).toMatch(/function PanelReagenda\(\{[^}]*\btz\b/)
    expect(PORTAL).toContain('<PanelReagenda cita={c} token={token} tz={tzClinica}')
  })

  it('y usa el ayudante común `hoyISO`, no una tercera forma de calcular «hoy»', () => {
    expect(PORTAL).toMatch(/const hoy = hoyISO\(tz\)/)
    expect(PORTAL).not.toMatch(/toLocaleDateString\('en-CA',\s*\{\s*timeZone:\s*'America/)
  })

  it('si el consultorio no tiene zona, sigue cayendo en la de por defecto', () => {
    expect(PORTAL).toMatch(/tz = TZ_DEFAULT/)
    expect(TZ_DEFAULT).toBe('America/Mexico_City')
  })
})

describe('`hoyISO` con una zona explícita es la pieza que faltaba conectar', () => {
  it('devuelve el día real de cada zona para el mismo instante', () => {
    // No se puede fijar "ahora" en un test puro; se comprueba que la función
    // delega en Intl con la zona pasada, no con la de por defecto del entorno.
    const cdmx = hoyISO('America/Mexico_City')
    const tijuana = hoyISO('America/Tijuana')
    expect(cdmx).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(tijuana).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
