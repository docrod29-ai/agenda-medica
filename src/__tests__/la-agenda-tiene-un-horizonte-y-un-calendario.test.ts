/**
 * GOLDEN — la agenda sabe hasta cuándo llega, y sabe qué días existen.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * **1 · Fechas que no existen, atendidas como si existieran.**
 *
 * Las tres rutas que validaban algo usaban `/^\d{4}-\d{2}-\d{2}$/` — forma, no
 * calendario. `2027-02-30` la pasa. Y `new Date('2027-02-30T12:00:00')` no
 * falla: DESBORDA al 2 de marzo. Medido antes del arreglo, con un horario de
 * 09:00 a 14:00 cada 30 min:
 *
 *     2027-02-30 → JS 2027-03-02 → schedule=sí → 10 huecos
 *     2027-02-31 → JS 2027-03-03 → schedule=sí → 10 huecos
 *     2026-04-31 → JS 2026-05-01 → schedule=sí → 10 huecos
 *     0000-01-01 → JS 0000-01-01 → schedule=sí → 10 huecos
 *
 * O sea: la cita se validaba contra el horario, la bandera de activo y los
 * festivos de OTRO día, y se guardaba con la fecha imposible. El chequeo de
 * solapes consulta `fechaHora >= '2027-02-30 00:00'`, así que no chocaba con
 * las citas reales del 2 de marzo — **doble reserva sobre el mismo hueco**— y
 * la cita no aparecía en la vista de ningún día.
 *
 * **2 · No había techo, y las superficies no se ponían de acuerdo.**
 *
 *     9999-12-31 → schedule=sí → 10 huecos
 *
 * `/api/appointments` (médico y asistente) no miraba la fecha en absoluto: se
 * limitaba a `fechaHora.slice(0, 10)`. El POST de reserva pública y el portal
 * sólo miraban la forma. Y `GET /api/public/availability` sí tenía un tope de
 * un año… que el POST de reserva **no aplicaba**: la disponibilidad se negaba a
 * OFRECER un hueco a tres años y el endpoint de reserva lo ACEPTABA con una
 * petición directa. Es la lección que ese archivo ya tiene escrita dos veces,
 * para los descansos y para los bloqueos.
 *
 * Además, ese tope contestaba `200 { ok: true, slots: [] }`: para el navegador,
 * indistinguible de un día lleno o cerrado.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Buscando el máximo de la agenda para comprobar 2050-12-31. No había ninguno,
 * en ninguna superficie. Al sondear fechas lejanas apareció lo otro.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Familia «el sistema se contradice a sí mismo»: cinco entradas de fecha, cinco
 * criterios distintos, y ninguno completo. Una comprobación de forma se lee
 * como una comprobación de validez, y nadie vuelve a mirarla.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - No decide si el consultorio ABRE ese día: eso es `getDaySchedule`, con su
 *   horario, sus festivos y sus bloqueos. Una fecha válida puede estar cerrada.
 * - No decide si la fecha ya pasó: eso depende de la zona del consultorio y
 *   vive en `instanteMX`, donde ya estaba.
 * - No prueba las rutas HTTP de punta a punta —eso necesita emuladores— sino
 *   el motor único por el que ahora pasan todas, más un barrido de fuente que
 *   comprueba que cada una lo llama.
 */
import { describe, it, expect } from 'vitest'
import {
  FECHA_MAXIMA_AGENDA, FECHA_MINIMA_AGENDA, DIAS_VENTANA_RESERVA_PUBLICA,
  validarFechaDeAgenda, validarFechaHoraDeAgenda, esFechaDeAgendaValida,
  dentroDeLaVentanaPublica,
} from '@/lib/agenda/horizonte'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('el techo es 2050-12-31, y se rechaza lo que lo pasa', () => {
  it('2050-12-31 se acepta — es el último día de la agenda', () => {
    expect(FECHA_MAXIMA_AGENDA).toBe('2050-12-31')
    expect(validarFechaDeAgenda('2050-12-31')).toEqual({ ok: true, fecha: '2050-12-31' })
  })

  it('el día siguiente ya no', () => {
    const r = validarFechaDeAgenda('2051-01-01')
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.motivo).toBe('despues-del-techo')
    expect(r.ok === false && r.mensaje).toContain('2050-12-31')
  })

  it('y nada de lo que hay más allá', () => {
    for (const f of ['2051-06-15', '2099-12-31', '9999-12-31']) {
      expect(esFechaDeAgendaValida(f), `${f} debería rechazarse`).toBe(false)
    }
  })

  it('las fechas representativas del recorrido se aceptan', () => {
    // Los años que pide la certificación, cada uno con su forma de ser raro.
    for (const f of ['2027-03-15', '2030-06-20', '2040-02-29', '2050-01-01', '2050-12-31']) {
      expect(validarFechaDeAgenda(f), `${f} debería aceptarse`).toEqual({ ok: true, fecha: f })
    }
  })

  it('2040 es bisiesto y 2039 no — sin tabla de bisiestos propia', () => {
    expect(esFechaDeAgendaValida('2040-02-29')).toBe(true)
    expect(esFechaDeAgendaValida('2039-02-29')).toBe(false)
    // 2100 no es bisiesto (regla del siglo). Cae fuera del techo igualmente,
    // pero el motivo tiene que ser el correcto si algún día el techo sube.
    expect(validarFechaDeAgenda('2100-02-29').ok).toBe(false)
  })
})

describe('las fechas que no existen se rechazan — el defecto que doblaba reservas', () => {
  const IMPOSIBLES = ['2027-02-30', '2027-02-31', '2026-04-31', '2027-06-31', '2027-13-01', '2027-00-10', '2050-12-32', '2027-01-00']
  for (const f of IMPOSIBLES) {
    it(f, () => {
      const r = validarFechaDeAgenda(f)
      expect(r.ok, `${f} pasó la puerta`).toBe(false)
      // El motivo importa: «no existe» no es lo mismo que «mal escrita».
      expect(r.ok === false && r.motivo).toBe('inexistente')
    })
  }

  it('y la forma sola NO las habría cazado — ésa era la trampa', () => {
    // Prueba al revés: se ejecuta la comprobación vieja y se ve que aprueba.
    const formaVieja = /^\d{4}-\d{2}-\d{2}$/
    expect(formaVieja.test('2027-02-30')).toBe(true)
    // Y que JavaScript la desborda al día siguiente del mes siguiente.
    expect(new Date('2027-02-30T12:00:00').getUTCDate()).not.toBe(30)
  })

  it('el suelo también existe: un tecleo de año no crea una cita del año 0', () => {
    expect(FECHA_MINIMA_AGENDA).toBe('2000-01-01')
    const r = validarFechaDeAgenda('0000-01-01')
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.motivo).toBe('antes-del-suelo')
  })

  it('lo que no tiene forma de fecha se rechaza por forma, no por calendario', () => {
    for (const basura of ['', '  ', 'mañana', '2027/02/15', '27-02-15', null, undefined, 42, {}]) {
      const r = validarFechaDeAgenda(basura)
      expect(r.ok).toBe(false)
      expect(r.ok === false && r.motivo).toBe('forma')
    }
  })
})

describe('`YYYY-MM-DD HH:MM`, que es como viaja fechaHora', () => {
  it('acepta y devuelve la cadena normalizada', () => {
    const r = validarFechaHoraDeAgenda('  2050-12-31 09:30  ')
    expect(r.ok).toBe(true)
    expect(r.ok && r.fechaHora).toBe('2050-12-31 09:30')
    expect(r.ok && r.fecha).toBe('2050-12-31')
  })

  it('rechaza el día imposible aunque la hora sea perfecta', () => {
    expect(validarFechaHoraDeAgenda('2027-02-30 09:00').ok).toBe(false)
  })

  it('rechaza lo que pasa del techo', () => {
    expect(validarFechaHoraDeAgenda('2051-01-01 09:00').ok).toBe(false)
  })

  it('rechaza una hora imposible', () => {
    for (const s of ['2030-01-01 24:00', '2030-01-01 09:60', '2030-01-01 9:00', '2030-01-01T09:00', '2030-01-01']) {
      expect(validarFechaHoraDeAgenda(s).ok, `${s} pasó`).toBe(false)
    }
  })
})

describe('la ventana del portal público es la misma para ofrecer y para aceptar', () => {
  const HOY = '2026-08-29'

  it('hoy cabe, y el último día del año también', () => {
    expect(dentroDeLaVentanaPublica(HOY, HOY).ok).toBe(true)
    expect(dentroDeLaVentanaPublica('2027-08-29', HOY).ok).toBe(true)
  })

  it('un día más allá del año, no — y lo DICE', () => {
    const r = dentroDeLaVentanaPublica('2027-08-30', HOY)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.motivo).toBe('fuera-de-ventana')
    // Antes esto era un 200 con `slots: []`: indistinguible de un día lleno.
    expect(r.ok === false && r.mensaje).toContain('2027-08-29')
  })

  it('lo pasado se rechaza con su propio motivo', () => {
    const r = dentroDeLaVentanaPublica('2026-08-28', HOY)
    expect(r.ok === false && r.motivo).toBe('pasado')
  })

  it('la ventana es de un año', () => {
    expect(DIAS_VENTANA_RESERVA_PUBLICA).toBe(365)
  })
})

describe('no se pregeneran fechas', () => {
  it('el módulo no cría una lista de días', () => {
    /**
     * El horizonte llega a 2050: enumerarlo serían ~9 000 cadenas vivas para
     * contestar una comparación de texto. `YYYY-MM-DD` ordena igual como texto
     * que como fecha, así que el techo se comprueba con `>`.
     */
    const src = leer('src', 'lib', 'agenda', 'horizonte.ts')
    const codigo = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
    // Lo que se prohíbe es ENUMERAR un rango, no usar `.map` sobre las tres
    // partes de una fecha: sin bucle y sin acumulador no se puede construir
    // una lista de días.
    expect(codigo).not.toMatch(/for\s*\(|while\s*\(|\.push\(|Array\.from|new Array/)
    // Y ningún array de cadenas con pinta de fecha.
    expect(codigo).not.toMatch(/\[\s*'\d{4}-/)
    // Y el techo se compara como texto, que es la razón de que no haga falta.
    expect(codigo).toContain('s > FECHA_MAXIMA_AGENDA')
  })
})

describe('las cinco entradas de fecha pasan por la MISMA puerta', () => {
  const ENTRADAS: Array<[string, string]> = [
    ['src/app/api/appointments/route.ts', 'validarFechaHoraDeAgenda'],
    ['src/app/api/public/booking/route.ts', 'validarFechaDeAgenda'],
    ['src/app/api/public/availability/[clinicId]/route.ts', 'validarFechaDeAgenda'],
    ['src/app/api/portal/route.ts', 'validarFechaHoraDeAgenda'],
  ]
  for (const [ruta, fn] of ENTRADAS) {
    it(ruta, () => {
      const src = leer(ruta)
      expect(src).toContain('@/lib/agenda/horizonte')
      /**
       * SE MIRA LA LLAMADA, NO EL `import`.
       *
       * Esta prueba se escribió primero con un `toContain(fn)` a secas, y al
       * probarla al revés —quitando la validación de `/api/appointments`— pasó
       * en verde: la línea del `import` bastaba para satisfacerla. Es la
       * familia «escrito y sin conectar» colándose dentro del guardián que
       * existe para cazarla. Se quitan los `import` antes de mirar.
       */
      const sinImports = src.replace(/^\s*import[^\n]*$/gm, '')
      expect(sinImports, `${ruta} importa la puerta única pero no la llama`).toContain(`${fn}(`)
    })
  }

  it('el POST de reserva pública aplica la MISMA ventana que ofrece el GET', () => {
    // El agujero exacto: el GET se negaba a ofrecer y el POST aceptaba igual.
    for (const ruta of ['src/app/api/public/booking/route.ts', 'src/app/api/public/availability/[clinicId]/route.ts']) {
      expect(leer(ruta), `${ruta} sin la ventana pública`).toContain('dentroDeLaVentanaPublica')
    }
  })

  it('la ventana se mide contra el día DE LA CLÍNICA, no el del servidor', () => {
    /**
     * En Vercel el proceso corre en UTC: a partir de las 18:00 en México el
     * servidor ya está en el día siguiente y la ventana se corría un día.
     */
    for (const ruta of ['src/app/api/public/booking/route.ts', 'src/app/api/public/availability/[clinicId]/route.ts']) {
      expect(leer(ruta)).toMatch(/dentroDeLaVentanaPublica\([^)]*hoyISO\(/)
    }
  })

  it('los campos de fecha de la interfaz no ofrecen lo que el servidor rechaza', () => {
    const PANTALLAS = [
      'src/app/(dashboard)/citas/page.tsx',
      'src/components/AppointmentModal.tsx',
      'src/app/mi/[token]/page.tsx',
      'src/app/(dashboard)/lista-espera/page.tsx',
    ]
    for (const ruta of PANTALLAS) {
      expect(leer(ruta), `${ruta} sin tope de fecha`).toContain('max={FECHA_MAXIMA_AGENDA}')
    }
  })
})
