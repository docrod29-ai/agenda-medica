/**
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * MEDIDO en navegador el 1-sep-2026 a las 18:08 (hora del consultorio), con las
 * ocho citas del día ya pasadas:
 *
 *   pintadas a peso completo ................. 6 de 8
 *   atenuadas ................................ 2 — y por ESTADO (atendida,
 *                                              cancelada), no por hora
 *   que aún ofrecían «Iniciar consulta» o
 *   «Confirmar» como acción primaria ......... 6
 *
 * El riel es una línea de tiempo con el marcador de AHORA siempre visible, y R1
 * dice que ese marcador separa «lo pasado (atenuado) de lo que viene». Sin la
 * atenuación, el riel contesta «aquí hay ocho cosas que hacer» cuando el día ya
 * terminó y ninguna es la siguiente.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * Todo lo demás estaba construido: el marcador existe, la hoja ya atenuaba
 * `hecho` y `cerrado` por token —su comentario hasta lo explicaba— y la fila
 * RECIBÍA `ahoraHHMM` del padre.
 *
 * Pero `ahoraHHMM` estaba en el TIPO de props y **no se desestructuraba**: el
 * padre lo mandaba, el tipo lo declaraba, y la firma lo tiraba al suelo. No es
 * que no se usara: era imposible usarlo. Y `momentoDeCita` mapeaba estado →
 * momento sin recibir el reloj nunca.
 *
 * Es «escrito y sin conectar» en la pieza que decide qué momento es cada cita,
 * dentro de una pantalla cuyo tema ES el tiempo.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Una cita cuya hora pasó y que nadie atendió ni canceló es `pasado`: ni
 * `hecho` —nadie la atendió— ni `cerrado` —nadie la canceló—. Se atenúa como lo
 * pasado y su nodo se dibuja en ámbar, porque «pasó sin resolverse» no puede
 * leerse como «listo»: son las filas que hay que reconciliar al cerrar el día.
 *
 * Y **sólo aplica al día de hoy**: en otro día «pasado» lo es todo o nada, y
 * atenuar la agenda entera de ayer no le dice nada a nadie.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · La acción primaria NO cambia: el médico sigue pudiendo iniciar una consulta
 *   tarde o cobrar una visita de la mañana. Cambia el peso visual, no lo que se
 *   puede hacer — y por eso esta prueba no toca `accionPrimaria`.
 * · No mide la pantalla: que las seis filas se atenúen se comprobó en navegador
 *   y vive en la bitácora del carril. Aquí se fija la REGLA.
 * · No decide qué hacer con una cita pasada sin resolver. Sólo la distingue.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PAGINA = readFileSync(
  join(__dirname, '..', 'app', '(dashboard)', 'citas', 'page.tsx'), 'utf8',
)
const CSS = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8')

/** La misma regla que aplica la pantalla. */
function momento(
  estado: string, hora: string, ahoraHHMM: string | null, esHoy: boolean,
): string {
  if (['cancelada', 'no-asistio', 'reagendada'].includes(estado)) return 'cerrado'
  if (['atendida', 'finalizada', 'pagada'].includes(estado)) return 'hecho'
  if (estado === 'en-consulta') return 'ahora'
  if (estado === 'en-sala') return 'espera'
  if (esHoy && ahoraHHMM && hora < ahoraHHMM) return 'pasado'
  return 'proximo'
}

describe('el riel mira el reloj, no sólo el estado', () => {
  it('el caso REAL: confirmada a las 09:00, son las 18:08', () => {
    expect(momento('confirmada', '09:00', '18:08', true)).toBe('pasado')
  })

  it('la misma cita antes de su hora sigue siendo lo que viene', () => {
    expect(momento('confirmada', '09:00', '08:30', true)).toBe('proximo')
  })

  it('pasar de hora NO la convierte en «hecha»: nadie la atendió', () => {
    expect(momento('confirmada', '09:00', '18:08', true)).not.toBe('hecho')
  })

  it('ni en «cerrada»: nadie la canceló', () => {
    expect(momento('confirmada', '09:00', '18:08', true)).not.toBe('cerrado')
  })

  it('el estado sigue mandando sobre la hora cuando dice algo más fuerte', () => {
    // Atendida a las 09:00 sigue siendo «hecho», no «pasado».
    expect(momento('atendida', '09:00', '18:08', true)).toBe('hecho')
    expect(momento('cancelada', '09:00', '18:08', true)).toBe('cerrado')
    // Y una que está EN CONSULTA aunque empezara tarde es el ahora.
    expect(momento('en-consulta', '09:00', '18:08', true)).toBe('ahora')
    expect(momento('en-sala', '09:00', '18:08', true)).toBe('espera')
  })

  it('otro día que no es hoy no se atenúa: allí «pasado» lo es todo o nada', () => {
    expect(momento('confirmada', '09:00', '18:08', false)).toBe('proximo')
  })

  it('sin reloj no se inventa un momento', () => {
    expect(momento('confirmada', '09:00', null, true)).toBe('proximo')
  })

  /** LA CONEXIÓN: lo que fallaba era que el dato no llegaba a la función. */
  it('la fila DESESTRUCTURA `ahoraHHMM`, no sólo lo declara en el tipo', () => {
    const firma = PAGINA.slice(PAGINA.indexOf('function RielEntrada({'), PAGINA.indexOf('function RielEntrada({') + 700)
    expect(firma).toMatch(/appt, paciente, config, esHoy, ahoraHHMM,/)
  })

  it('y la comparación con la hora existe DE VERDAD en la función', () => {
    /*
     * ESTE CASO FALTABA, Y SIN ÉL LA PRUEBA NO SERVÍA.
     *
     * Los casos de conducta de arriba usan una COPIA local de la regla. Al
     * probarla al revés borrando la comparación del producto, los diez casos
     * siguieron en verde: la copia seguía contestando bien mientras la pantalla
     * volvía a ignorar el reloj.
     *
     * Es el defecto que este carril lleva encontrando toda la sesión, ahora en
     * mi propia prueba: un guardián que comprueba su recuerdo de la regla en vez
     * de la regla. Éste mira la función real, y busca la FAMILIA —comparar la
     * hora de la cita contra `ahoraHHMM`— no una ortografía.
     */
    const cuerpo = PAGINA.slice(
      PAGINA.indexOf('function momentoDeCita('),
      PAGINA.indexOf('function momentoDeCita(') + 1400,
    )
    const comparaLaHora = cuerpo
      .split('\n')
      .some(l => /ahoraHHMM/.test(l) && /[<>]/.test(l) && /fechaHora|hora/i.test(l))
    expect(comparaLaHora,
      '`momentoDeCita` volvió a decidir el momento sin comparar la hora de la cita '
      + 'contra `ahoraHHMM`. El riel es una línea de tiempo: sin esa comparación, '
      + 'una cita de las 09:00 sigue pintándose como «lo que viene» a las 18:08.',
    ).toBe(true)
    expect(cuerpo).toContain("return 'pasado'")
  })

  it('y `momentoDeCita` recibe el reloj', () => {
    expect(PAGINA).toMatch(/function momentoDeCita\(\s*appt: Appointment,\s*ahoraHHMM: string \| null,\s*esHoy: boolean,/)
    expect(PAGINA).toMatch(/momentoDeCita\(appt, ahoraHHMM, esHoy\)/)
  })

  it('la hoja atenúa lo pasado y dibuja su nodo distinto de «hecho»', () => {
    expect(CSS).toMatch(/\[data-momento='pasado'\] \.riel-nombre/)
    /*
     * Se mira el BLOQUE de la regla, no una ventana de N caracteres.
     * La primera versión pedía `amber` dentro de los 160 caracteres siguientes
     * al selector, y se puso en rojo cuando el arreglo del contraste añadió un
     * comentario en medio: el guardián falló por la LONGITUD DE UN COMENTARIO,
     * no por el estilo. Un guardián que se rompe al documentar el porqué empuja
     * a no documentarlo.
     */
    const i = CSS.indexOf("[data-momento='pasado'] .riel-nodo::before")
    const bloque = CSS.slice(i, CSS.indexOf('}', i))
    expect(bloque).toMatch(/amber/)
  })
})
