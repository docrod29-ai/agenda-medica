/**
 * GOLDEN — un `loading` que llega a la vista y nadie pinta es un hueco tratado
 * como dato.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `/calendario` calcula `loading` con `useAppointments` y se lo pasa a sus tres
 * vistas —`WeekView`, `DayView`, `MonthView`—. Las tres lo declaraban en su
 * firma y en su tipo, y **ninguna lo usaba en el cuerpo**. El prop estaba
 * escrito, pasado y sin conectar.
 *
 * Consecuencia, medida con la red ralentizada a propósito: una **semana entera
 * dibujada y completamente vacía**, con sus columnas, sus horas y su línea del
 * ahora — y ni una palabra de que las citas venían de camino. Idéntica a «no
 * tienes ninguna cita».
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Mirando la columna del encargo que nadie había medido: los estados de carga.
 * Una sonda retrasa 1,6 s todo lo que pide datos, espera al ARMAZÓN —no a los
 * datos— y fotografía ese instante. `/calendario` salió con «armazón, sin
 * señal»: título puesto, rejilla puesta, cero indicación de carga.
 *
 * ── POR QUÉ IMPORTA MÁS DE LO QUE PARECE ────────────────────────────────────
 *
 * Es la **regla 4 de seguridad clínica dicha en lenguaje de interfaz**: ausencia
 * de dato no es dato de ausencia. Una rejilla vacía que significa «todavía no sé»
 * y se lee «no hay nada» es un hueco presentado como dato — la familia que este
 * repositorio ya tiene nombrada.
 *
 * Y el daño es real: el médico mira su semana de un vistazo, la ve libre y
 * planifica sobre eso.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Si una pantalla recibe el hecho de que está cargando, tiene que **decirlo**.
 * No basta con aceptarlo como prop: mientras dure, el hueco lleva su aviso, y
 * quien no lo ve lo recibe por `aria-busy`.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Quitando el aviso del lienzo de la agenda, este caso cae. Y sobre el producto
 * vivo, `npm run arnes:estado-de-carga` marca `/calendario` como «HUECO SIN
 * DECLARAR» — se comprobó quitando el arreglo y volviéndolo a poner.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No comprueba que el aviso se vea**, ni dónde, ni cuánto dura. Eso es del
 *   arnés, que lo mide sobre el navegador con la red lenta.
 * · **No busca este defecto en otras pantallas.** Aquí se vigila la agenda,
 *   que es donde se encontró y donde un hueco leído como dato hace más daño.
 *   El barrido general de las 15 rutas vive en el arnés, no en CI, porque
 *   necesita navegador.
 * · No dice nada del estado VACÍO de verdad (datos llegados y ninguno) ni del
 *   de ERROR: son otros dos estados y otras dos sondas.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CAL = readFileSync(join('src', 'app', '(dashboard)', 'calendario', 'page.tsx'), 'utf8')

describe('la agenda dice que está cargando en vez de parecer vacía', () => {
  it('el lienzo de la agenda anuncia la carga a quien mira', () => {
    // Sin comentarios: la explicación de arriba nombra `loading` y `aria-busy`,
    // y un caso que se satisface con su propia prosa no comprueba nada. Ya pasó
    // en esta rama (unidad 49).
    const codigo = CAL.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    expect(
      codigo,
      'la agenda ya no pinta nada cuando `loading` es cierto: una rejilla vacía ' +
      'vuelve a ser indistinguible de una semana sin citas',
    ).toMatch(/\{loading && \(/)
  })

  it('y lo anuncia también a quien no lo ve', () => {
    const codigo = CAL.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    expect(codigo, 'sin `aria-busy` el lector de pantalla no sabe que faltan datos')
      .toMatch(/aria-busy=\{loading/)
    expect(codigo, 'el aviso tiene que llegar como región viva')
      .toMatch(/role="status"/)
  })

  it('las tres vistas siguen recibiendo `loading` — si deja de llegar, no hay nada que pintar', () => {
    // El defecto original NO era que faltara el prop: era que llegaba y se
    // ignoraba. Si un día alguien lo quita de las firmas «porque no se usa»,
    // este caso lo dice antes de que el aviso se quede sin fuente.
    for (const vista of ['WeekView', 'DayView', 'MonthView']) {
      const i = CAL.indexOf(`function ${vista}(`)
      expect(i, `${vista} desapareció`).toBeGreaterThan(-1)
      expect(CAL.slice(i, i + 400), `${vista} dejó de recibir \`loading\``).toContain('loading')
    }
  })
})
