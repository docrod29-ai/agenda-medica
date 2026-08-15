/**
 * LA LISTA DE PACIENTES VACÍA — QUÉ SE ESTÁ MIRANDO, QUÉ HAY FUERA Y EL GESTO.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `/pacientes` tenía CUATRO estados vacíos y tres de ellos eran un párrafo
 * gris centrado a 40px, escrito a mano en el sitio, sin componente y sin
 * ningún control:
 *
 *     «Sin resultados para “x”.»
 *     «Aún no hay pacientes con citas recientes. Usa **Todos A-Z** o busca…»
 *     «Ningún paciente con inasistencias o cancelaciones.»
 *
 * Los tres comparten el mismo defecto, y no es de estilo: **ninguno dice que
 * la lista NO está vacía.** Con 128 expedientes dentro, el chip «Con alerta»
 * pinta una pantalla en blanco indistinguible de un consultorio recién
 * abierto. Es la misma familia que REG-314 acaba de pagar en `/citas` —
 * ausencia de FILAS no es ausencia de expedientes, la regla 4 de seguridad
 * clínica dicha en la pantalla.
 *
 * Y el de «Recientes», que es la vista POR DEFECTO, mandaba a buscar un
 * control en NEGRITA («Usa **Todos A-Z**») en vez de ofrecerlo: §24 falla un
 * control interactivo que no es un `<button>`, y esto ni siquiera era un
 * control — era una instrucción para ir a buscar uno.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Contando los estados vacíos de las seis superficies de §29 para cerrar
 * RTC-30 («un patrón decidido UNA vez»). Hoy y Expediente ya estaban
 * convertidos; al abrir `/pacientes` —la pantalla más visitada del producto
 * según RTC-31— aparecieron tres a mano en el mismo archivo.
 *
 * ── LO QUE APARECIÓ AL MIRARLO, Y NO ERA DE INTERFAZ ────────────────────────
 *
 * Buscar y no encontrar es el momento exacto en que nace un expediente
 * repetido. `buscarPosiblesDuplicados` —que sabe que «López García, María» y
 * «María López García» son la misma persona— se consultaba SÓLO dentro del
 * formulario de alta, es decir, después de que el médico ya decidió crear. En
 * la búsqueda, que es donde se hace la misma pregunta ANTES, nadie lo
 * llamaba. La capacidad existía y no llegaba al sitio donde hacía falta:
 * «el dato tiene que LLEGAR», la familia de REG-160/167/170.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. Un vacío dice **cuántos expedientes hay fuera de lo que se está
 *    mirando**. Sin ese número no se distingue «no hay» de «no se ven».
 * 2. El gesto sale de la CAUSA: filtro puesto → quitarlo; búsqueda sin
 *    coincidencias → limpiarla; registro vacío → crear el primero.
 * 3. **Sólo el registro entero vacío ofrece «Nuevo paciente».** Ofrecer crear
 *    sobre una lista que SÍ tiene expedientes escondidos invita al duplicado
 *    — es la misma decisión que REG-314 tomó al no ofrecer «Nueva cita» sobre
 *    un día con seis citas escondidas por un filtro.
 * 4. Sólo ese caso conserva el héroe ilustrado (RTC-30): el vacío de un bloque
 *    no pesa más que el trabajo que tiene al lado.
 *
 * Probado al revés: con los tres párrafos grises de vuelta caen los casos 8 y
 * 9; con `nuevoPaciente: true` en cualquier clase que no sea `sin-expedientes`
 * cae el 6; sin la llamada al módulo de duplicados cae el 10.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No mide píxeles ni el peso del bloque en pantalla: eso está en
 *   `docs/design/capturas/v15-lista-vacia-pacientes/`.
 * · **No cubre el rescate cuando el nombre está abreviado**: «Ma Guadalupe
 *   Hernández» contra «María Guadalupe Hernández» da 0.67 y el umbral
 *   declarado del producto es 0.8, así que no se ofrece. Se deja como está a
 *   propósito: bajar el umbral aquí sería inventar un criterio distinto del
 *   que usa el resto del producto para decidir si dos nombres son la misma
 *   persona.
 * · No cubre el resto de estados vacíos del producto (lista de espera,
 *   farmacia, cumplimiento, reactivación): RTC-30 sigue abierto ahí.
 * · No juzga si el médico ACIERTA al abrir el parecido — eso es suyo, y el
 *   producto no junta ni borra nada solo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { describirListaVacia } from '@/lib/pacientes/vacio-de-la-lista'
import { buscarPosiblesDuplicados } from '@/lib/pacientes/duplicados'

const PANTALLA = readFileSync(join(process.cwd(), 'src/app/(dashboard)/pacientes/page.tsx'), 'utf8')

/** Sólo el código: los comentarios de esta pantalla CITAN las frases muertas. */
const soloCodigo = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ')
const CODIGO = soloCodigo(PANTALLA)

/**
 * Y SIN LOS `import`. El caso 10 pasó en verde con la llamada BORRADA porque
 * el identificador seguía escrito en la línea del import — el instrumento leía
 * una declaración donde tenía que leer un uso. Misma ceguera que
 * `grafo-de-dependencias` lleva escrita, cazada aquí probando al revés: una
 * reversión que no pone el caso en rojo es un caso que no prueba nada.
 */
const SIN_IMPORTS = CODIGO.replace(/^import[\s\S]*?from\s+'[^']*'$/gm, ' ')

const base = { totalExpedientes: 6, busqueda: '', chip: 'recientes' as const, parecidos: 0 }

describe('el vacío de /pacientes dice qué hay fuera', () => {
  it('1 · sin ningún expediente el vacío ES la pantalla: héroe y crear el primero', () => {
    const v = describirListaVacia({ ...base, totalExpedientes: 0 })
    expect(v.clase).toBe('sin-expedientes')
    expect(v.variante).toBe('hero')
    expect(v.gesto.nuevoPaciente).toBe(true)
  })

  it('2 · la búsqueda sin coincidencias dice cuántos expedientes hay, y no es un héroe', () => {
    const v = describirListaVacia({ ...base, busqueda: 'Zenaida Quiroz' })
    expect(v.clase).toBe('busqueda-sin-coincidencias')
    expect(v.variante).toBe('linea')
    // El número es la mitad que faltaba: «Sin resultados» describe la consulta,
    // no el registro.
    expect(v.titulo).toContain('6 expedientes')
    expect(v.titulo).toContain('Zenaida Quiroz')
    expect(v.gesto.limpiarBusqueda).toBe(true)
  })

  it('3 · con parecidos se enseñan, y se dice POR QUÉ importa abrirlos', () => {
    const v = describirListaVacia({ ...base, busqueda: 'Esparsa Joaquin', parecidos: 2 })
    expect(v.enseñarParecidos).toBe(true)
    expect(v.descripcion).toContain('parte su historial')
    // Sin parecidos no se pinta la cabecera de «se parecen» sobre cero filas.
    expect(describirListaVacia({ ...base, busqueda: 'Esparsa Joaquin' }).enseñarParecidos).toBe(false)
  })

  it('4 · el chip «Con alerta» vacío dice que se miraron todos', () => {
    const v = describirListaVacia({ ...base, chip: 'alerta' })
    expect(v.clase).toBe('ocultos-por-el-chip')
    expect(v.descripcion).toContain('6 expedientes')
    expect(v.gesto.verTodos).toBe(true)
  })

  it('5 · «Recientes» vacío ofrece el control, no manda a buscarlo', () => {
    const v = describirListaVacia({ ...base, chip: 'recientes' })
    expect(v.descripcion).toContain('6 expedientes')
    expect(v.gesto.verTodos).toBe(true)
  })

  it('6 · NINGÚN vacío con expedientes dentro ofrece crear uno nuevo', () => {
    /**
     * La regla de REG-314 aplicada aquí. Ofrecer «Nuevo paciente» sobre una
     * lista que tiene 6 expedientes escondidos por un chip —o sobre una
     * búsqueda que no casó por un dedazo— es ofrecer justo el gesto que parte
     * un historial en dos.
     */
    const conGente = [
      describirListaVacia({ ...base, chip: 'recientes' }),
      describirListaVacia({ ...base, chip: 'alerta' }),
      describirListaVacia({ ...base, busqueda: 'Zenaida' }),
      describirListaVacia({ ...base, busqueda: 'Zenaida', parecidos: 3 }),
    ]
    for (const v of conGente) expect(v.gesto.nuevoPaciente, v.clase).toBe(false)
    // Y sólo ese caso conserva el héroe (RTC-30).
    for (const v of conGente) expect(v.variante, v.clase).toBe('linea')
  })

  it('7 · con un solo expediente habla en singular', () => {
    const v = describirListaVacia({ ...base, totalExpedientes: 1, chip: 'alerta' })
    expect(v.descripcion).toContain('1 expediente.')
    expect(v.descripcion).not.toContain('expedientes')
  })
})

describe('la decisión LLEGA a la pantalla', () => {
  it('8 · la pantalla consume el módulo y ya no escribe sus vacíos a mano', () => {
    expect(CODIGO).toContain('describirListaVacia')
    // Los tres párrafos grises, muertos.
    expect(CODIGO).not.toContain('Sin resultados para')
    expect(CODIGO).not.toContain('Aún no hay pacientes con citas recientes')
    expect(CODIGO).not.toContain('Ningún paciente con inasistencias')
  })

  it('9 · el camino a «Todos A-Z» es un botón, no una palabra en negrita', () => {
    expect(CODIGO).not.toContain('<strong>Todos A-Z</strong>')
    expect(CODIGO).toContain('Ver todos A-Z')
  })

  it('10 · la lista pregunta por los parecidos, no sólo el formulario de alta', () => {
    /**
     * El defecto era éste: el módulo existía y la búsqueda no lo llamaba. Se
     * comprueba que la llamada está en el cuerpo de la PÁGINA (antes de que
     * empiece el componente del formulario), no sólo dentro de él.
     */
    const inicioDelFormulario = SIN_IMPORTS.indexOf('function PatientModal')
    expect(inicioDelFormulario).toBeGreaterThan(0)
    const cuerpoDeLaPagina = SIN_IMPORTS.slice(0, inicioDelFormulario)
    expect(cuerpoDeLaPagina).toContain('buscarPosiblesDuplicados')
    // Y el formulario CONSERVA la suya: esta rebanada añade un sitio donde se
    // pregunta, no mueve el que ya avisaba antes de guardar.
    expect(SIN_IMPORTS.slice(inicioDelFormulario)).toContain('buscarPosiblesDuplicados')
  })
})

describe('el rescate caza lo que la búsqueda por subcadena NO puede cazar', () => {
  /**
   * CONDUCTUAL sobre el módulo real. Si esto sólo comprobara que se llama a
   * `buscarPosiblesDuplicados`, no probaría nada: lo que hay que demostrar es
   * que el caso que hoy termina en «Sin resultados» —y en un expediente
   * repetido— sale rescatado.
   */
  const padron = [
    { id: 'a', nombre: 'Joaquín Esparza Villarreal', telefono: '+52 55 5555 0103', edad: 36 },
    { id: 'b', nombre: 'Catalina Ibarra Fuentes', telefono: '+52 55 5555 0104', edad: 79 },
    { id: 'c', nombre: 'Luz María Cervantes Ochoa', telefono: '+52 55 5555 0106', edad: 51 },
  ]

  /** La búsqueda de la pantalla: normaliza acentos y compara subcadenas. */
  const buscaLaPantalla = (q: string) => {
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return padron.filter(p => norm(p.nombre).includes(norm(q.trim())))
  }

  it('11 · el dedazo y el orden cambiado: la búsqueda falla, el rescate encuentra', () => {
    for (const termino of ['Esparsa Joaquin Villareal', 'Villarreal Esparza, Joaquín']) {
      expect(buscaLaPantalla(termino), termino).toHaveLength(0)
      const rescatados = buscarPosiblesDuplicados({ nombre: termino }, padron)
      expect(rescatados.map(r => r.paciente.id), termino).toEqual(['a'])
    }
  })

  it('12 · y no rescata a cualquiera: un nombre que no está no trae a nadie', () => {
    expect(buscarPosiblesDuplicados({ nombre: 'Zenaida Quiroz Bermúdez' }, padron)).toHaveLength(0)
  })
})
