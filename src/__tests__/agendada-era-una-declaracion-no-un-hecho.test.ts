/**
 * GOLDEN — «agendada» era lo que alguien declaró, no lo que el calendario decía.
 *
 * ── QUÉ FALLABA (WS-11.estados-del-cierre) ──────────────────────────────────
 *
 * REG-404 añadió `agendada` como estado VIVO y arregló algo grave: antes el
 * pendiente de seguimiento se **cerraba** al crear la cita, así que agendar
 * contaba como haber visto al paciente y un no-show no reabría nada.
 *
 * Quedó la otra mitad, y el censo la nombraba con precisión: **`agendada` es lo
 * que alguien declaró, no lo que el calendario dice.** `TareaClinica` no tenía
 * un solo campo que apuntara a la cita — el botón decía «Ya quedó agendada» y
 * guardaba una palabra.
 *
 * Consecuencia: si esa cita se cancela, se reagenda, o el paciente no viene, el
 * pendiente se queda en `agendada` —el worklist lo agrupa en
 * `esperando_paciente`— **para siempre**. No hay a quién esperar. El seguimiento
 * se evapora en silencio, que es exactamente lo contrario de lo que promete este
 * eje.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Leyendo el `queFalta` contra el árbol: `grep citaId src/lib/tareas-clinicas`
 * no devolvía nada, y `cambiarEstado(clinicId, tarea, 'agendada')` no recibía ni
 * guardaba ninguna referencia.
 *
 * ── POR QUÉ HACÍA FALTA UN CAMPO, Y NO SÓLO UN CRUCE ────────────────────────
 *
 * Sin `citaId` no hay cruce posible. Casar por paciente y fecha sería adivinar
 * cuál de sus citas es, y un paciente con dos controles el mismo mes tendría dos
 * candidatas indistinguibles. Es el patrón de REG-570: el identificador lo acuña
 * quien hace la acción y viaja con ella, **en su propio campo** — meterlo en
 * `origenId` sería un campo haciendo dos trabajos, que es REG-566.
 *
 * ── LA REGLA QUE ESTO PROTEGE ───────────────────────────────────────────────
 *
 * **Ausencia de dato no es dato de ausencia.** Una tarea anterior a este campo,
 * o una cita que no se pudo leer, salen `no_consta` — nunca «la cita ya no
 * está». Y la lectura del calendario que falla no pinta nada, en vez de pintar
 * una alarma sobre un hecho que nadie comprobó.
 *
 * ── LO QUE NO SE HIZO, Y POR QUÉ ────────────────────────────────────────────
 *
 * **La tarea no se mueve sola.** Qué hacer cuando el paciente no vino —cuánto se
 * espera, si escala, a quién— es política clínica del médico, está declarada en
 * `LA_PREGUNTA_PARA_EL_DUENO`, y moverla por nuestra cuenta sería el defecto que
 * REG-404 cerró, con el signo cambiado.
 *
 * **Las tareas viejas no se reescriben.** Se les exige `citaId` a las
 * transiciones NUEVAS; inventarles una cita a las que ya están en `agendada`
 * sería fabricar el dato que este arreglo existe para tener de verdad.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Si una cita `reagendada` tiene otra NUEVA detrás.** Se sabe que la que el
 *   pendiente nombraba dejó de existir; que exista otra no lo dice este dato.
 * · **Los pendientes que no son de seguimiento.**
 * · **Que la cita sea del mismo paciente que la tarea**: se compara el
 *   identificador que la tarea guardó, y quien lo guardó es quien agendó.
 * · **No es una prueba de navegador.** Se comprueba la lógica, la puerta del
 *   cambio de estado y que la pantalla lo pida y lo pinte en el fuente — no que
 *   el píxel salga ni que el modal atrape el foco.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  loQueElCalendarioDice, citasQueHayQueLeer, TOPE_CITAS_A_LEER,
  POR_QUE_HACE_FALTA_EL_ID, POR_QUE_NO_SE_MUEVE_LA_TAREA,
  LA_PREGUNTA_PARA_EL_DUENO, LO_QUE_NO_SE_VIGILA,
  type TareaLeible,
} from '@/lib/tareas-clinicas/lo-que-el-calendario-dice'

const leer = (r: string) => readFileSync(resolve(process.cwd(), r), 'utf8')
const MODELO = leer('src/lib/tareas-clinicas/modelo.ts')
const FIRESTORE = leer('src/lib/tareas-clinicas/firestore.ts')
const PANTALLA = leer('src/app/(dashboard)/pendientes/page.tsx')

const AGENDADA: TareaLeible = { estado: 'agendada', citaId: 'cita-1' }

describe('qué dice el calendario de un pendiente declarado agendado', () => {
  it('la cita sigue en pie: la declaración se sostiene, y no se dice nada', () => {
    const l = loQueElCalendarioDice(AGENDADA, { id: 'cita-1', estado: 'confirmada' })
    expect({ v: l.veredicto, pide: l.pideAtencion, frase: l.frase })
      .toEqual({ v: 'coincide', pide: false, frase: '' })
  })

  it('la cita se canceló: el seguimiento sigue pendiente y hay que mirarlo', () => {
    const l = loQueElCalendarioDice(AGENDADA, { id: 'cita-1', estado: 'cancelada' })
    expect(l.veredicto).toBe('la_cita_ya_no_esta')
    expect(l.pideAtencion).toBe(true)
    expect(l.frase).toMatch(/sigue pendiente/)
  })

  it('la cita se movió: la que el pendiente nombraba ya no existe', () => {
    /* `reagendada` es el caso que más se pierde: hay «una cita» en la agenda,
       pero no ES la que el pendiente señalaba. */
    expect(loQueElCalendarioDice(AGENDADA, { id: 'cita-1', estado: 'reagendada' }).veredicto)
      .toBe('la_cita_ya_no_esta')
  })

  it('el paciente no vino: el pendiente NO estaba esperando a nadie', () => {
    const l = loQueElCalendarioDice(AGENDADA, { id: 'cita-1', estado: 'no-asistio' })
    expect(l.veredicto).toBe('el_paciente_no_vino')
    expect(l.pideAtencion).toBe(true)
  })

  it('el paciente ya vino: el pendiente tampoco está esperando', () => {
    for (const estado of ['en-consulta', 'atendida', 'finalizada', 'pagada'] as const) {
      expect(loQueElCalendarioDice(AGENDADA, { id: 'cita-1', estado }).veredicto, estado)
        .toBe('el_paciente_ya_vino')
    }
  })
})

describe('ausencia de dato no es dato de ausencia', () => {
  it('una tarea SIN citaId sale `no_consta` y no pide nada', () => {
    /* Son las anteriores a este campo. Marcarlas sería ruido sobre un hecho que
       nadie comprobó, y enseñaría a ignorar el aviso que sí importa. */
    const l = loQueElCalendarioDice({ estado: 'agendada' }, undefined)
    expect({ v: l.veredicto, pide: l.pideAtencion }).toEqual({ v: 'no_consta', pide: false })
  })

  it('una cita que no se pudo leer también, y NO «la cita ya no está»', () => {
    const l = loQueElCalendarioDice(AGENDADA, undefined)
    expect(l.veredicto).toBe('no_consta')
    expect(l.veredicto).not.toBe('la_cita_ya_no_esta')
  })

  it('si llegó OTRA cita, se prefiere callar antes que opinar sobre la equivocada', () => {
    expect(loQueElCalendarioDice(AGENDADA, { id: 'otra', estado: 'cancelada' }).veredicto)
      .toBe('no_consta')
  })

  it('una tarea que no está `agendada` no se juzga', () => {
    expect(loQueElCalendarioDice({ estado: 'en_curso', citaId: 'cita-1' }, { id: 'cita-1', estado: 'cancelada' }).veredicto)
      .toBe('no_consta')
  })

  it('`pideAtencion` separa lo que hay que mirar de lo que no', () => {
    /**
     * Aquí vivía `pidenAtencion(ls)`, un ayudante que escribí y que **nadie
     * llamaba**: lo cazó el trinquete de conexión (`los-motores-llegan-al-medico`)
     * al subir las huérfanas de 39 a 40. Es la familia que este bucle lleva toda
     * la semana cerrando, cometida por mí mismo. Se borró la función; la
     * distinción que hacía falta ya la lleva cada lectura.
     */
    const mirar = [
      loQueElCalendarioDice(AGENDADA, { id: 'cita-1', estado: 'confirmada' }),
      loQueElCalendarioDice(AGENDADA, { id: 'cita-1', estado: 'no-asistio' }),
      loQueElCalendarioDice({ estado: 'agendada' }, undefined),
    ].filter(l => l.pideAtencion)
    expect(mirar.map(l => l.veredicto)).toEqual(['el_paciente_no_vino'])
  })
})

describe('la lectura del calendario está acotada', () => {
  it('sólo se leen las citas de tareas `agendada` CON identificador', () => {
    expect(citasQueHayQueLeer([
      { estado: 'agendada', citaId: 'a' },
      { estado: 'agendada' },              // vieja: no hay nada que leer
      { estado: 'en_curso', citaId: 'b' }, // no está agendada
    ])).toEqual(['a'])
  })

  it('sin repetir: dos pendientes sobre la misma cita son una lectura', () => {
    expect(citasQueHayQueLeer([
      { estado: 'agendada', citaId: 'a' },
      { estado: 'agendada', citaId: 'a' },
    ])).toEqual(['a'])
  })

  it('y con tope, porque es la pantalla que el médico más visita', () => {
    const muchas: TareaLeible[] = Array.from({ length: 200 }, (_, i) => ({ estado: 'agendada', citaId: `c${i}` }))
    expect(citasQueHayQueLeer(muchas)).toHaveLength(TOPE_CITAS_A_LEER)
  })
})

describe('el campo y su puerta', () => {
  it('`citaId` vive en su propio campo, no dentro de `origenId`', () => {
    expect(MODELO).toMatch(/citaId\?: string/)
    /* Un campo haciendo dos trabajos es REG-566, y está dicho ahí. */
    expect(MODELO).toMatch(/REG-566/)
  })

  it('no se puede declarar «agendada» sin decir a qué cita', () => {
    expect(FIRESTORE).toMatch(/nuevo === 'agendada' && !String\(extra\.citaId \?\? ''\)\.trim\(\)/)
    expect(FIRESTORE).toMatch(/exige decir a qué cita/)
  })

  it('y cuando se declara, el identificador se GUARDA', () => {
    /* Sin esta línea la puerta pediría el dato y lo tiraría, que es el defecto
       de REG-579 montado sobre la puerta que lo impide. */
    expect(FIRESTORE).toMatch(/if \(nuevo === 'agendada'\) patch\.citaId = String\(extra\.citaId\)\.trim\(\)/)
  })
})

describe('y llega a la pantalla — las dos mitades', () => {
  it('el botón manda a elegir una cita en vez de declarar', () => {
    expect(PANTALLA).toMatch(/if \(paso\.estado === 'agendada'\) return onAgendar\(t\)/)
    expect(PANTALLA).toMatch(/¿A qué cita quedó agendado\?/)
  })

  it('sin citas futuras se DICE, en vez de dejar marcar a ciegas', () => {
    expect(PANTALLA).toMatch(/no tiene ninguna cita futura/)
  })

  it('el veredicto se pinta como texto visible en la tarjeta', () => {
    expect(PANTALLA).toMatch(/loQueElCalendarioDice\(t, t\.citaId \? cita : undefined\)/)
    expect(PANTALLA).toMatch(/\{calendario\.frase\}<\/span>/)
    expect(PANTALLA).toMatch(/calendario\.pideAtencion && \(/)
  })
})

describe('lo que este módulo declara que NO decide', () => {
  it('no mueve la tarea, y deja la pregunta escrita para el médico', () => {
    expect(POR_QUE_NO_SE_MUEVE_LA_TAREA).toMatch(/política clínica/)
    expect(LA_PREGUNTA_PARA_EL_DUENO).toMatch(/^NEEDS_CLINICAL_REVIEW/)
    expect(LA_PREGUNTA_PARA_EL_DUENO).toMatch(/venceEn/)
  })

  it('y declara por qué el identificador era imprescindible y qué no vigila', () => {
    expect(POR_QUE_HACE_FALTA_EL_ID).toMatch(/adivinar cuál de sus citas/)
    expect(LO_QUE_NO_SE_VIGILA.join(' ')).toMatch(/reagendada/)
    expect(LO_QUE_NO_SE_VIGILA.join(' ')).toMatch(/no_consta/)
  })
})
