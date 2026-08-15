/**
 * El expediente lleno no puede decir que está vacío — y el aviso valía en una
 * sola dirección.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `/expediente` filtra la historia en tres pestañas —Todas · Consulta ·
 * Hospital— y arrancaba en **Consulta**. Tenía un aviso escrito a propósito
 * para no engañar:
 *
 *     «Sin notas de consultorio · Este paciente solo tiene notas de
 *      hospitalización. Cambia a la pestaña "Hospital" para verlas.»
 *
 * Pero existía SÓLO para `filtro === 'consulta'`. En la pestaña **Hospital**,
 * un paciente con doce notas de consultorio y ningún internamiento caía en el
 * vacío general:
 *
 *     «Sin notas todavía. La primera consulta que firmes aparece aquí.»
 *
 * Un expediente lleno diciendo que está vacío — exactamente lo que la rama
 * hermana existía para impedir, y la misma familia que REG-314 pagó en
 * `/citas`: ausencia de filas no es ausencia de datos.
 *
 * ── Y HABÍA UN SEGUNDO DEFECTO, MÁS CALLADO ─────────────────────────────────
 *
 * El filtro y el aviso preguntaban «¿es hospitalaria?» con reglas DISTINTAS:
 *
 *     filtro:  !!n.internamientoId || ['ingreso','evolucion','egreso']
 *     aviso:                          ['ingreso','evolucion','egreso']
 *
 * El propio comentario del filtro advierte que postop, anestesia y
 * consentimiento cuelgan de un internamiento y van a Hospital. Con la regla
 * pobre del aviso, un paciente cuyas notas de hospital fueran todas `postop`
 * contaba como hospitalaria para FILTRAR y no para AVISAR: la pestaña Consulta
 * decía «sin notas» sin mandar a ninguna parte. Dos respuestas a la misma
 * pregunta.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Midiendo RTC-30 en las tres pantallas que quedaban (`/nota`,
 * `/cumplimiento/retencion`, `/expediente`) para ver si había algo que pagar.
 * Las dos primeras se refutaron. En la tercera, el vacío ya estaba bien
 * resuelto —línea, no héroe, con su razón escrita— y el defecto no era el peso
 * del bloque sino QUÉ dice: al leer la condición se vio que sólo cubría una de
 * las dos pestañas.
 *
 * ── EL ARREGLO ──────────────────────────────────────────────────────────────
 *
 * Un solo predicado `esHospitalaria`, usado por el filtro y por el aviso; y la
 * decisión del vacío delegada en `describirVacioDeUnaLista`, que ya codifica
 * la regla («todo vacío dice cuántos hay FUERA de lo que se está mirando, y el
 * gesto sale de la CAUSA»). Escribirla aquí a mano habría sido su quinta copia.
 *
 * El error de carga conserva su héroe y pasa PRIMERO: con la lectura caída no
 * se sabe cuántas notas hay, así que ningún recuento sería cierto.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * El caso 2 es la asimetría: con la conducta vieja, un paciente sólo-consulta
 * mirando Hospital recibía `registro-vacio` («Sin notas todavía») en vez de
 * `ocultos-por-restriccion`. El caso 4 es el predicado: con la regla pobre, la
 * nota `postop` con `internamientoId` no contaba y el aviso no aparecía.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No mide la pantalla.** Que el aviso en línea no pese más que las filas
 *   que sustituye ya lo midió la rebanada de RTC-30 que lo puso en línea.
 * · No decide qué nota pertenece a qué pestaña: eso es `esHospitalaria`, y
 *   este guardián sólo exige que la respuesta sea UNA.
 * · No cubre `/hospitalizacion`: ALPHA tras bandera, y su vacío es decisión
 *   visual del dueño.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { describirVacioDeUnaLista, contar } from '@/lib/ui/vacio-de-una-lista'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const PAGINA = 'src/app/(dashboard)/expediente/[patientId]/page.tsx'

/** La misma regla que la pantalla, reproducida aquí para poder probarla. */
const esHospitalaria = (n: { internamientoId?: string; tipo: string }) =>
  !!n.internamientoId || ['ingreso', 'evolucion', 'egreso'].includes(n.tipo)

/** Lo que la pantalla le pasa al módulo, con el mismo cálculo. */
const vacioDe = (
  notas: { internamientoId?: string; tipo: string }[],
  filtro: 'todas' | 'consulta' | 'hospital',
) => {
  const fuera = notas.filter(n => (filtro === 'hospital' ? !esHospitalaria(n) : esHospitalaria(n)))
  return describirVacioDeUnaLista({
    total: notas.length,
    sustantivo: ['nota', 'notas'],
    restricciones: filtro === 'todas' || fuera.length === 0 ? [] : [{
      id: 'ambito',
      frase: `${fuera.length === notas.length ? 'todas' : contar(fuera.length, ['nota', 'notas'])}`
        + ` ${fuera.length === 1 ? 'está' : 'están'} en la pestaña «${filtro === 'hospital' ? 'Consulta' : 'Hospital'}»`,
      gesto: filtro === 'hospital' ? 'Ver notas de Consulta' : 'Ver notas de Hospital',
    }],
    registroVacio: {
      titulo: 'Sin notas todavía.',
      descripcion: 'La primera consulta que firmes aparece aquí.',
      gesto: 'Crear primera nota',
    },
  })
}

describe('el expediente lleno no dice que está vacío', () => {
  it('1 · sin ninguna nota, el vacío ES la historia: héroe y alta', () => {
    const v = vacioDe([], 'consulta')
    expect(v.clase).toBe('registro-vacio')
    expect(v.variante).toBe('hero')
    expect(v.titulo).toBe('Sin notas todavía.')
    expect(v.gestos.map(g => g.id)).toEqual(['alta'])
  })

  it('2 · EN HOSPITAL con notas de consultorio, lo dice y manda a la otra pestaña', () => {
    /**
     * La asimetría. Con la conducta vieja esto caía en «Sin notas todavía» —
     * un expediente con doce notas diciendo que no tiene ninguna.
     */
    const notas = Array.from({ length: 12 }, () => ({ tipo: 'seguimiento' }))
    const v = vacioDe(notas, 'hospital')
    expect(v.clase).toBe('ocultos-por-restriccion')
    expect(v.titulo).toContain('12 notas')
    expect(v.descripcion).toContain('Consulta')
    expect(v.gestos.map(g => g.etiqueta)).toEqual(['Ver notas de Consulta'])
    // Y NUNCA el gesto de alta: crear encima de lo que un filtro esconde
    // es invitar al duplicado.
    expect(v.gestos.map(g => g.id)).not.toContain('alta')
  })

  it('3 · en Consulta con notas de hospital, el aviso que ya existía sigue', () => {
    const v = vacioDe([{ tipo: 'ingreso' }, { tipo: 'evolucion' }], 'consulta')
    expect(v.clase).toBe('ocultos-por-restriccion')
    expect(v.descripcion).toContain('Hospital')
    expect(v.gestos.map(g => g.etiqueta)).toEqual(['Ver notas de Hospital'])
  })

  it('4 · la nota `postop` de un internamiento cuenta — el aviso usa la regla BUENA', () => {
    /**
     * El segundo defecto. Con la regla pobre (sólo la lista de tipos) esta
     * nota no contaba como hospitalaria, así que la pestaña Consulta decía
     * «sin notas» sin mandar a ninguna parte — mientras el filtro sí la
     * mandaba a Hospital.
     */
    const notas = [{ tipo: 'nota_postoperatoria', internamientoId: 'int-1' }]
    expect(esHospitalaria(notas[0])).toBe(true)
    const v = vacioDe(notas, 'consulta')
    expect(v.clase).toBe('ocultos-por-restriccion')
    expect(v.gestos.map(g => g.etiqueta)).toEqual(['Ver notas de Hospital'])
  })

  it('5 · y la pantalla usa UN predicado y CONSUME la decisión', () => {
    /**
     * «Escrito y sin conectar»: la regla puede quedar perfecta en el módulo y
     * la pantalla seguir pintando su propio texto.
     */
    const s = leer(PAGINA)
    expect(s).toContain("from '@/lib/ui/vacio-de-una-lista'")
    expect(s).toContain('const esHospitalaria =')
    expect(s).toContain('describirVacioDeUnaLista({')
    expect(s).toContain('vacioDeLaHistoria.titulo')
    // La condición vieja, que sólo miraba una pestaña y con la regla pobre.
    expect(s).not.toContain("filtro === 'consulta' && notas.some(")
    // Y el fallo de lectura sigue distinguiéndose de «no hay» (regla 4).
    expect(s).toContain('No pudimos cargar el expediente')
  })
})
