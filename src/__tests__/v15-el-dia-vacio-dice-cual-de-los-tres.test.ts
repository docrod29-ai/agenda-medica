/**
 * La agenda vacía dice CUÁL de los tres vacíos es — y el gesto va con la causa.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `/citas` pintaba el mismo estado vacío en tres situaciones distintas:
 *
 *   1. el día está libre de verdad,
 *   2. el día TIENE citas y un filtro las esconde,
 *   3. hay filtro puesto y además el día está libre.
 *
 * Decía siempre «No hay citas para este filtro · Cambia de fecha o de médico,
 * o agenda una nueva cita», con la ilustración de agenda vacía y un primario
 * «Nueva cita».
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Leyendo `filtered` para otra cosa: la lista se estrecha por CUATRO cosas
 * —fecha, estado, búsqueda y médico— y el mensaje del vacío no miraba
 * ninguna. Y al bajar al cierre del riel apareció la contradicción escrita:
 * el comentario dice «el riel no muere en el vacío: apunta al día siguiente»
 * y la condición era `filtered.length > 0`, así que el puntero al día
 * siguiente **desaparecía exactamente el día vacío** — el único en que «el
 * que viene tiene 6» es la información que hace falta.
 *
 * ── POR QUÉ NO ES COSMÉTICA ─────────────────────────────────────────────────
 *
 * El caso 2 ya mordió a este producto por otro sitio, y está escrito en
 * `useFiltroMedico`: un filtro guardado en el navegador apuntando a un médico
 * dado de baja dejaba la agenda vacía TODOS LOS DÍAS, y el selector ni
 * siquiera se dibujaba con un solo médico activo — no había control en
 * pantalla para quitarlo. Aquello se reparó en el origen; el MENSAJE seguía
 * sin poder distinguir «no hay» de «no se ven».
 *
 * Es la regla 4 de seguridad clínica dicha en la pantalla: **ausencia de filas
 * no es ausencia de citas.** Y el gesto va con la causa — ofrecer «Nueva cita»
 * sobre un día que ya tiene seis escondidas invita justo al error del que el
 * mensaje avisa.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Con la conducta vieja —un solo mensaje para los tres casos— fallan los casos
 * 1, 2, 3 y 5: el título no nombraría las citas escondidas, el gesto seguiría
 * siendo «Nueva cita» y no habría puntero al día siguiente. El caso 6 es el
 * guardián de conexión: si la pantalla deja de consumir el módulo, la decisión
 * puede quedar bien y no llegar a ninguna pantalla.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No decide qué citas debe esconder un filtro.** Sólo qué se DICE cuando
 *   las esconde.
 * · No cubre el estado de ERROR de carga: ése ya tenía su distinción («no se
 *   pudieron leer» ≠ «no hay») y no se tocó.
 * · No mide la pantalla. Que el mensaje en línea no pese más que las filas que
 *   sustituye es el arnés, no esta prueba.
 * · No cubre el resto de estados vacíos del producto (RTC-30 sigue abierto en
 *   las demás pantallas): éste se pagó porque su vacío MIENTE, no porque sea
 *   genérico.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { describirAgendaVacia, enumerarEsMx } from '@/lib/agenda/vacio-de-la-agenda'

/** Las cabeceras CITAN el texto viejo para explicarlo; sólo se mira el código. */
const sinComentarios = (s: string) => s
  .split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

describe('el día vacío dice cuál de los tres vacíos es', () => {
  it('1 · con citas escondidas por un filtro, lo DICE y las cuenta', () => {
    const v = describirAgendaVacia({
      citasDelDia: 6,
      filtrosActivos: ['un médico'],
      citasDelDiaSiguiente: 3,
      etiquetaDelDia: 'Hoy',
    })
    expect(v.clase).toBe('ocultas-por-filtro')
    expect(v.titulo).toContain('6 citas')
    expect(v.titulo).toMatch(/esconde/)
    expect(v.descripcion).toContain('un médico')
  })

  it('2 · y entonces NO ofrece agendar encima: ofrece quitar el filtro', () => {
    /**
     * El día ya tiene citas que el médico no está viendo. Un primario
     * «Nueva cita» ahí invita al error del que el propio mensaje avisa.
     */
    const v = describirAgendaVacia({
      citasDelDia: 6,
      filtrosActivos: ['estado «Canceladas»'],
      citasDelDiaSiguiente: 3,
      etiquetaDelDia: 'Hoy',
    })
    expect(v.gesto).toEqual({ quitarFiltro: true, nuevaCita: false, diaSiguiente: false })
  })

  it('3 · el día libre de verdad apunta al día siguiente — el vacío es cuando MÁS falta', () => {
    /**
     * El cierre del riel («el riel no muere en el vacío») vivía dentro de la
     * rama CON filas. El puntero desaparecía justo el día en que sirve.
     */
    const v = describirAgendaVacia({
      citasDelDia: 0,
      filtrosActivos: [],
      citasDelDiaSiguiente: 6,
      etiquetaDelDia: 'jueves 14 de agosto',
    })
    expect(v.clase).toBe('dia-libre')
    /*
      EL DÍA NO SE REPITE. La primera versión titulaba «Jueves 14 de agosto:
      sin citas agendadas.» — y la captura enseñó que la cabecera ya lo dice
      dos veces encima. El título guarda su sitio para la NOTICIA.
    */
    expect(v.titulo).toBe('Sin citas agendadas.')
    expect(v.descripcion).toBe('El día siguiente tiene 6.')
    expect(v.gesto).toEqual({ quitarFiltro: false, nuevaCita: true, diaSiguiente: true })
  })

  it('4 · sin nada el día siguiente, no inventa un destino al que ir', () => {
    const v = describirAgendaVacia({
      citasDelDia: 0,
      filtrosActivos: [],
      citasDelDiaSiguiente: 0,
      etiquetaDelDia: 'Mañana',
    })
    expect(v.descripcion).toBe('El día siguiente tampoco tiene.')
    expect(v.gesto.diaSiguiente).toBe(false)
  })

  it('5 · con filtro puesto y día libre, dice que el filtro NO esconde nada', () => {
    /**
     * El tercer caso. Sin esta frase el médico se queda sin saber si lo que
     * ve es el día o su propio filtro — y ésa es exactamente la duda que
     * dejó la agenda vacía «todos los días» del caso de `useFiltroMedico`.
     */
    const v = describirAgendaVacia({
      citasDelDia: 0,
      filtrosActivos: ['un médico', 'la búsqueda «gómez»'],
      citasDelDiaSiguiente: 2,
      etiquetaDelDia: 'Hoy',
    })
    expect(v.clase).toBe('dia-libre')
    expect(v.descripcion).toContain('El filtro no esconde ninguna.')
    expect(v.gesto.nuevaCita).toBe(true)
  })

  it('6 · y la pantalla CONSUME la decisión — no la reimplementa al lado', () => {
    /**
     * «Escrito y sin conectar»: un módulo que decide bien y una pantalla que
     * sigue pintando su propio texto son dos fuentes de verdad, y la que ve
     * el médico es la que no se prueba.
     */
    const pagina = readFileSync(join(process.cwd(), 'src/app/(dashboard)/citas/page.tsx'), 'utf8')
    expect(pagina).toContain("from '@/lib/agenda/vacio-de-la-agenda'")
    expect(pagina).toContain('describirAgendaVacia({')
    expect(pagina).toContain("vacio.clase === 'ocultas-por-filtro'")
    expect(pagina).toContain('vacio.gesto.diaSiguiente')
    /*
      El texto viejo no puede seguir PINTÁNDOSE — pero sí citándose. Dos
      comentarios lo entrecomillan para explicar de dónde viene: el de esta
      rebanada y el del estado de error, que se escribió el día que se
      descubrió que un fallo de red se veía igual que un día libre. Un
      guardián que prohibiera la cadena a secas borraría la historia que hace
      entendible el arreglo, así que se miran sólo las líneas de CÓDIGO.
    */
    expect(sinComentarios(pagina)).not.toContain('No hay citas para este filtro')
  })

  it('7 · los filtros se enumeran en español, no con comas de máquina', () => {
    expect(enumerarEsMx([])).toBe('')
    expect(enumerarEsMx(['un médico'])).toBe('un médico')
    expect(enumerarEsMx(['a', 'b'])).toBe('a y b')
    expect(enumerarEsMx(['a', 'b', 'c'])).toBe('a, b y c')
  })
})
