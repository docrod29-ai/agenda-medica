/**
 * «INTERVALO DE AGENDA: 5 MINUTOS» — y la agenda iba de 30 en 30.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Configuración ofrecía un selector «Intervalo de agenda (min)» con 5, 10, 15,
 * 20 y 30. El generador de huecos, en cambio, hacía:
 *
 *     const interval = Math.max(intervaloMinutos ?? 10, duracionSegura)
 *
 * Ese `max` venía de un defecto histórico real —intervalo 10 con citas de 30
 * daba huecos cada 10 minutos, o sea tres pacientes citados sobre la misma
 * media hora— y lo cerraba bien. Pero convertía el selector en una perilla que
 * casi nunca podía ganar: cualquier duración clínica normal (20, 30, 40 min) es
 * mayor que cualquier intervalo ofrecido. El médico leía «5 minutos» en su
 * pantalla y su agenda iba de 30 en 30.
 *
 * Y cuando SÍ ganaba era peor: con intervalo 30 y citas de 20, la agenda perdía
 * un hueco por hora sin que nada explicara por qué.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * El dueño mandó la captura del selector (7-sep-2026) diciendo «quiero quitar el
 * intervalo de tiempo». Al ir a quitarlo se vio que llevaba tiempo sin hacer
 * nada de lo que decía.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * El paso de la agenda ES la duración del tipo de cita. Una sola fuente, la que
 * el médico piensa de verdad, y el defecto histórico queda cerrado por
 * construcción: si el paso es la duración, dos huecos seguidos no se solapan
 * nunca. `intervaloMinutos` se conserva en el tipo y en los respaldos —hay
 * documentos vivos que lo traen— pero ya no gobierna nada.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · Las duraciones en sí: qué debe durar una primera vez es criterio del
 *   médico, no de este archivo.
 * · Los otros frenos del generador (jornada > 14 h, festivos, horas pasadas,
 *   descansos). Viven en `availability.test.ts` y siguen ahí.
 * · La agenda del médico individual (`horario-medico.ts`), que puede traer su
 *   propio horario: aquí se mira la del consultorio.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getAvailableSlots } from '@/lib/availability'
import type { ClinicConfig } from '@/types'

const RAIZ = process.cwd()
const leer = (p: string) => readFileSync(resolve(RAIZ, p), 'utf8')
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const dia = { activo: true, inicio: '09:00', fin: '13:00' }
const cfg = (over: Partial<ClinicConfig> = {}): ClinicConfig => ({
  diasFestivos: [],
  zonaHoraria: 'America/Mexico_City',
  horario: {
    lunes: dia, martes: dia, miercoles: dia, jueves: dia, viernes: dia,
    sabado: { activo: false, inicio: '09:00', fin: '13:00' },
    domingo: { activo: false, inicio: '09:00', fin: '13:00' },
  },
  ...over,
} as unknown as ClinicConfig)

const LUNES = '2026-08-03'

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-01T15:00:00Z')) })
afterEach(() => { vi.useRealTimers() })

describe('El paso de la agenda es la duración de la cita', () => {
  /**
   * AL REVÉS. Con el `Math.max` viejo, un intervalo de 30 le ganaba a una cita
   * de 20 y esta jornada de 4 h daba 8 huecos en vez de 12: el médico perdía
   * cuatro pacientes al día por una perilla que no sabía que existía.
   */
  it('un intervalo mayor que la cita ya NO borra huecos', () => {
    const slots = getAvailableSlots(LUNES, 20, [], cfg({ intervaloMinutos: 30 } as Partial<ClinicConfig>))
    expect(slots).toEqual([
      '09:00', '09:20', '09:40', '10:00', '10:20', '10:40',
      '11:00', '11:20', '11:40', '12:00', '12:20', '12:40',
    ])
  })

  it('el intervalo guardado da igual: manda la duración, valga lo que valga', () => {
    const conIntervalos = [5, 10, 15, 20, 30].map(
      i => getAvailableSlots(LUNES, 30, [], cfg({ intervaloMinutos: i } as Partial<ClinicConfig>)),
    )
    for (const slots of conIntervalos) {
      expect(slots).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30'])
    }
  })

  it('y sin intervalo guardado sale exactamente lo mismo', () => {
    expect(getAvailableSlots(LUNES, 30, [], cfg())).toEqual(
      getAvailableSlots(LUNES, 30, [], cfg({ intervaloMinutos: 5 } as Partial<ClinicConfig>)),
    )
  })

  /**
   * El defecto histórico que justificaba el `max` sigue cerrado — ahora por
   * construcción, no por una comparación: si el paso ES la duración, dos huecos
   * consecutivos no pueden solaparse.
   */
  it('ningún hueco empieza antes de que acabe el anterior', () => {
    for (const duracion of [15, 20, 30, 45, 60]) {
      const slots = getAvailableSlots(LUNES, duracion, [], cfg({ intervaloMinutos: 5 } as Partial<ClinicConfig>))
      const enMinutos = slots.map(h => { const [a, b] = h.split(':').map(Number); return a * 60 + b })
      for (let i = 1; i < enMinutos.length; i++) {
        expect(enMinutos[i] - enMinutos[i - 1], `duración ${duracion}`).toBeGreaterThanOrEqual(duracion)
      }
    }
  })
})

describe('La perilla se retiró de la pantalla y de las DOS rutas que generan huecos', () => {
  it('Configuración ya no ofrece «Intervalo de agenda»', () => {
    const pantalla = leer('src/app/(dashboard)/configuracion/page.tsx')
    expect(pantalla).not.toContain('cfg-intervalo-de-agenda-min')
    expect(sinComentarios(pantalla)).not.toContain("upd('intervaloMinutos')")
  })

  it('ni el panel ni el portal público leen ya el intervalo guardado', () => {
    // Si una de las dos lo leyera y la otra no, el portal ofrecería huecos que
    // el panel no tiene. Es el mismo par que ya se desincronizó antes.
    for (const ruta of ['src/lib/availability.ts', 'src/app/api/public/availability/[clinicId]/route.ts']) {
      expect(sinComentarios(leer(ruta)), ruta).not.toContain('config.intervaloMinutos')
      expect(sinComentarios(leer(ruta)), ruta).not.toContain('cfg.intervaloMinutos')
    }
  })

  it('el preview del horario cuenta con el mismo paso que la agenda real', () => {
    // Un preview que use otro paso miente sobre cuántos pacientes caben en el día.
    const pantalla = sinComentarios(leer('src/app/(dashboard)/configuracion/page.tsx'))
    expect(pantalla).toContain('const intervalo = duracionDefault')
  })
})
