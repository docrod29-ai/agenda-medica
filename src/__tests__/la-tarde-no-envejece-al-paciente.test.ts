/**
 * LA TARDE NO ENVEJECE AL PACIENTE — el día que se cuenta es el del
 * consultorio, no el de UTC.
 *
 * ── QUÉ FALLABA Y CÓMO SE DESCUBRIÓ ─────────────────────────────────────────
 *
 * Midiendo `/pacientes` en el navegador el 2-sep a las 18:11 hora del
 * consultorio. Rosalía, **atendida ese mismo día a las 08:00**, salía en la
 * lista como «visto ayer», y en Reactivación como «Hace 1 día».
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * `ultimaVezVisto` restaba INSTANTES:
 *
 *     const dias = Math.floor((ahoraMs - Date.parse(iso)) / 86_400_000)
 *
 * `ultimaCita` es una FECHA a secas —`fechaHora.slice(0, 10)`, «2026-09-02»— y
 * `Date.parse` de una fecha sin hora es medianoche **UTC**. En México (UTC−6),
 * a partir de las 18:00 hora local ya es el día siguiente en UTC: la resta da
 * más de 24 h y el paciente de esta mañana pasa a «visto ayer».
 *
 * O sea: **todas las tardes, a partir de las seis, el producto envejecía un día
 * a todo el que se hubiera atendido ese día.** Y la tarde es justo cuando el
 * médico repasa la jornada.
 *
 * Es el mismo defecto que vaciaba Finanzas y el corte de caja al caer la tarde,
 * y que allí ya está documentado y arreglado con las mismas palabras: **el día
 * del consultorio no es el día UTC**.
 *
 * ── POR QUÉ LA PRUEBA QUE HABÍA NO LO VIO ───────────────────────────────────
 *
 * Porque medía una forma del dato que nadie envía. El caso 7 de
 * `v15-rtc15-la-lista-dice-algo-clinico` le pasaba marcas de tiempo ISO
 * completas (`new Date(AHORA - DIA).toISOString()`), y lo que la lista manda es
 * `p.ultimaCita`: una fecha de diez caracteres, sin hora y sin zona. Con hora
 * completa la resta de instantes acierta; sin ella, no.
 *
 * Familia «el dato tiene que LLEGAR», en su variante de prueba: el guardián
 * existía, corría y comprobaba una entrada que la producción no produce.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Se cuentan **días de calendario del consultorio**: los dos extremos se llevan
 * al día local (`fechaISOLocal`, que ya es de quien es) y se restan las fechas,
 * no los instantes. Una fecha de diez caracteres ya ES un día del consultorio y
 * se usa tal cual.
 *
 * Probado al revés: con la resta de instantes, los casos 1 y 2 fallan.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Sólo `ultimaVezVisto`. Otros sitios que resten fechas siguen sin vigilar
 *   aquí; quien los busca es `timezone-sitios`.
 * · **Sólo la zona del consultorio por defecto.** `fijarZonaConsultorio` no
 *   publica fuera del navegador —lo dice su propio código— así que estos casos
 *   no pueden probar un consultorio en otra zona. Que la cuenta sea la del
 *   consultorio y no la de UTC sí queda probado; que funcione en Madrid, no.
 * · No cubre el cambio de horario de verano dentro del intervalo contado: un
 *   intervalo de 800 días cruza varios, y la cuenta se hace sobre fechas ya
 *   normalizadas, así que el salto de una hora no la mueve — pero no hay caso
 *   que lo fije.
 * · No mide la pantalla: que la lista pinte lo que esta función devuelve lo
 *   dice el navegador.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { ultimaVezVisto } from '@/lib/pacientes/estado-clinico'
import { limpiarZonaConsultorio, zonaActiva } from '@/lib/timezone'

/** 2 de septiembre de 2026, 18:11 en Ciudad de México = 3 de septiembre 00:11 UTC. */
const LA_TARDE_DEL_2 = Date.parse('2026-09-03T00:11:00Z')
const DIA = 86_400_000

describe('la tarde no envejece al paciente', () => {
  afterEach(() => { limpiarZonaConsultorio() })

  it('0 · estos casos corren en la zona del consultorio', () => {
    /**
     * `fijarZonaConsultorio` sólo publica en el navegador —lo dice su código— y
     * aquí no hay ventana, así que la zona es la de por defecto. Se comprueba
     * en vez de suponerse: si `TZ_DEFAULT` cambiara, los casos de abajo dejarían
     * de medir lo que dicen medir y no se notaría.
     */
    expect(zonaActiva()).toBe('America/Mexico_City')
  })

  it('1 · a las 18:11 del consultorio, quien se atendió esa mañana está «visto hoy»', () => {
    // Lo que manda la lista: una FECHA, no una marca de tiempo.
    expect(ultimaVezVisto('2026-09-02', LA_TARDE_DEL_2)).toBe('visto hoy')
  })

  it('2 · y el del día anterior sigue siendo «visto ayer», no «hace 2 días»', () => {
    expect(ultimaVezVisto('2026-09-01', LA_TARDE_DEL_2)).toBe('visto ayer')
  })

  it('3 · la mañana no se rompió al arreglar la tarde', () => {
    // 2 de septiembre, 09:00 en México = 15:00 UTC. Mismo día por los dos lados.
    const laManana = Date.parse('2026-09-02T15:00:00Z')
    expect(ultimaVezVisto('2026-09-02', laManana)).toBe('visto hoy')
    expect(ultimaVezVisto('2026-09-01', laManana)).toBe('visto ayer')
  })

  it('5 · sigue hablando en días, meses y años', () => {
    expect(ultimaVezVisto('2026-08-28', LA_TARDE_DEL_2)).toBe('visto hace 5 días')
    expect(ultimaVezVisto('2026-06-24', LA_TARDE_DEL_2)).toBe('visto hace 2 meses')
    expect(ultimaVezVisto('2024-06-25', LA_TARDE_DEL_2)).toBe('visto hace 2 años')
  })

  it('6 · una marca de tiempo completa sigue valiendo', () => {
    // No todo lo que llega es una fecha corta: el expediente guarda instantes.
    expect(ultimaVezVisto(new Date(LA_TARDE_DEL_2 - 2 * DIA).toISOString(), LA_TARDE_DEL_2))
      .toBe('visto hace 2 días')
  })

  it('7 · sin fecha no se inventa «nunca visto», y el futuro no es «visto»', () => {
    // Ausencia de dato no es dato de ausencia: puede ser un expediente migrado.
    expect(ultimaVezVisto(undefined, LA_TARDE_DEL_2)).toBeNull()
    expect(ultimaVezVisto('no es una fecha', LA_TARDE_DEL_2)).toBeNull()
    // Una cita futura es agenda, no historia.
    expect(ultimaVezVisto('2026-09-10', LA_TARDE_DEL_2)).toBeNull()
  })
})
