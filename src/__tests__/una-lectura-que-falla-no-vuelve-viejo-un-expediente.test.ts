/**
 * GOLDEN — una lectura que falla no puede volver viejo y vacío un expediente.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Barriendo el panel con la pregunta que dejó abierta el arreglo del contador
 * de `/citas`: **¿qué pantalla apaga el «cargando» después de un fallo que
 * nadie ve?** Tres candidatas; dos de ellas (`/resenas`, `/membresias`) eran
 * falsos positivos de mi propio barrido —el vacío ya iba detrás del `loading`—
 * y se comprobaron leyendo, no arreglando.
 *
 * La tercera no lo era.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `/cumplimiento/retencion` es la pantalla de la NOM-004 5.7: dice qué
 * expedientes superaron los cinco años desde el último acto médico. Cargaba las
 * notas de cada paciente y, si esa lectura fallaba, hacía esto:
 *
 *     catch { return evaluarRetencion(p, [], p.ultimaCita) }
 *
 * `[]` no es «falló la lectura»: es **«este paciente no tiene notas»**. Y el
 * motor, que no tenía forma de distinguirlo, calculaba con eso.
 *
 * Las consecuencias se suman en la misma fila:
 *
 *  · Sin notas, la fecha del último acto cae hasta `ultimaCita` o `createdAt`.
 *    Un paciente al que se le sigue escribiendo pero cuyas citas no se llevan
 *    aquí queda fechado **el día en que se dio de alta** — y a los cinco años
 *    de eso sale marcado en rojo como «>5 años».
 *  · `notasFirmadas` valía 0, y la fila **ocultaba** la insignia de notas
 *    (`notasFirmadas > 0 &&`). El expediente aparecía sin conservar nada.
 *
 * O sea: la lectura que falló hacía parecer el expediente **a la vez viejo y
 * vacío**, que son justo las dos señales que invitan a archivarlo. Y el módulo
 * dice de sí mismo, en su cabecera, para qué sirve: conservar, archivar o
 * **anonimizar**.
 *
 * Silencioso, además: el `catch` estaba vacío. Ni un `console.error`.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * Regla 4 de seguridad clínica, en una pantalla legal: **ausencia de dato no es
 * dato de ausencia**. Y la 2: un motor que no puede calcular **lo dice**, no
 * estima. `null` es «no se pudo leer»; `[]` es «no tiene». Nunca lo mismo.
 *
 * Un veredicto que sale de un hueco es peor que no tener veredicto: el segundo
 * se ve, el primero no.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Devolviendo el `[]` original en el `catch` de la página, cae el caso que
 * comprueba el cableado. Quitando la rama `notas === null` del motor, caen los
 * cuatro casos de conducta — y el primero enseña el defecto entero: el mismo
 * paciente pasa de `no_evaluable` a `vencido` sin que nada del expediente haya
 * cambiado.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No prueba la pantalla renderizada: el caso de la página es un escáner de
 *   fuente sobre el cableado (`null`, no `[]`) y sobre los techos de espera.
 * · No juzga los umbrales de la NOM (5 años, 4½): son política y no los toca
 *   este carril.
 * · No juzga los valores de los techos de espera.
 * · El barrido cubrió las pantallas del panel que pintan un vacío y apagan un
 *   «cargando». **No declara buenas** las que no aparecen aquí.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { evaluarRetencion, listarPacientesPorRevisar } from '@/lib/retencion'
import type { Patient } from '@/types'
import type { NotaMedica } from '@/types/expediente'

const haceAnios = (n: number) => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - n)
  return d.toISOString()
}

/**
 * Paciente sintético. Se dio de alta hace seis años y NO tiene citas
 * registradas en este sistema — el caso real de quien se lleva por notas.
 */
const PACIENTE = { id: 'p-sintetico', nombre: 'Paciente Sintético', createdAt: haceAnios(6) } as unknown as Patient

/** Una nota reciente: el acto médico que la lectura fallida no llegó a ver. */
const NOTA_RECIENTE = [{
  id: 'n1', fechaConsulta: haceAnios(0), estado: 'firmada',
}] as unknown as NotaMedica[]

describe('el motor distingue «no tiene» de «no se pudo leer»', () => {
  it('EL DEFECTO: con `[]` el expediente sale VENCIDO — con `null`, sin veredicto', () => {
    // Mismo paciente, mismo día, misma base de datos. Lo único que cambia es si
    // la lectura de sus notas funcionó.
    const conHueco = evaluarRetencion(PACIENTE, [], undefined)
    expect(conHueco.estado, 'esto es lo que veía el médico').toBe('vencido')

    const sinInventar = evaluarRetencion(PACIENTE, null, undefined)
    expect(sinInventar.estado).toBe('no_evaluable')
    expect(sinInventar.diasDesdeUltimoActo).toBeNull()
    expect(sinInventar.ultimoActo).toBeNull()
  })

  it('«sin evaluar» tampoco finge cero notas firmadas', () => {
    // Con 0, la fila escondía la insignia y el expediente parecía no conservar
    // nada. `null` es lo que permite decir «no se pudo contar».
    expect(evaluarRetencion(PACIENTE, null).notasFirmadas).toBeNull()
    expect(evaluarRetencion(PACIENTE, []).notasFirmadas).toBe(0)
  })

  it('cuando las notas SÍ llegan, el veredicto es el de siempre', () => {
    // Sin este caso, devolver `no_evaluable` a todo pasaría los anteriores.
    const r = evaluarRetencion(PACIENTE, NOTA_RECIENTE, undefined)
    expect(r.estado).toBe('vigente')
    expect(r.notasFirmadas).toBe(1)
    expect(r.diasDesdeUltimoActo).not.toBeNull()
  })

  it('un expediente que de verdad superó los 5 años se sigue marcando', () => {
    const viejo = evaluarRetencion(PACIENTE, [], haceAnios(6))
    expect(viejo.estado).toBe('vencido')
  })
})

describe('lo que no se pudo evaluar no se esconde', () => {
  it('va en la lista por revisar, y va PRIMERO', () => {
    const vencido = evaluarRetencion(PACIENTE, [], haceAnios(7))
    const sinEvaluar = evaluarRetencion(PACIENTE, null)
    const vigente = evaluarRetencion(PACIENTE, NOTA_RECIENTE)

    const r = listarPacientesPorRevisar([vencido, vigente, sinEvaluar])

    expect(r.map(e => e.estado)).toEqual(['no_evaluable', 'vencido'])
  })

  it('no contamina los totales de vencidos ni de cercanos', () => {
    // Es la otra mitad: aparecer en la lista sin sumar a un total que no le
    // corresponde. Si sumara, el médico leería expedientes vencidos que no lo
    // están — el defecto al revés, y también inventado.
    const evs = [evaluarRetencion(PACIENTE, null), evaluarRetencion(PACIENTE, NOTA_RECIENTE)]
    expect(evs.filter(e => e.estado === 'vencido')).toHaveLength(0)
    expect(evs.filter(e => e.estado === 'cercano')).toHaveLength(0)
  })
})

describe('la pantalla está cableada a eso, y no se queda cargando para siempre', () => {
  const RUTA = 'src/app/(dashboard)/cumplimiento/retencion/page.tsx'
  const fuente = () => readFileSync(RUTA, 'utf8')

  it('el barrido mira código de verdad', () => {
    expect(fuente()).toContain('evaluarRetencion')
  })

  it('el `catch` de las notas pasa `null`, no `[]`', () => {
    const s = fuente()
    expect(s).toContain('evaluarRetencion(p, null, p.ultimaCita)')
    expect(s, 'volvió el hueco tratado como dato').not.toContain('evaluarRetencion(p, [], p.ultimaCita)')
  })

  it('las lecturas tienen techo y el «cargando» se apaga pase lo que pase', () => {
    // Sin red, una lectura de Firestore NO rechaza: se queda pendiente. Sin
    // techo, el `finally` no corre y «Evaluando expedientes…» se queda fijo.
    const s = fuente()
    expect(s).toContain('conTiempoLimite(')
    expect(s).toMatch(/finally\s*\{\s*\n?\s*setLoading\(false\)/)
  })

  it('un fallo de carga NO se cuenta como «ningún paciente requiere acción»', () => {
    // La respuesta tranquilizadora es la que este fallo no puede dar.
    const s = fuente()
    expect(s).toContain('setFalloCarga')
    expect(s).toMatch(/porque falló la\s*\n?\s*lectura/)
  })
})
