/**
 * GOLDEN — un seguimiento agendado sigue pendiente hasta que el paciente venga.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El pendiente «Agendar el seguimiento» nace cuando el médico pone fecha de
 * control. Su único camino era:
 *
 *     solicitada → en_curso → completada → cerrada
 *
 * Es decir: **se cerraba al crear la cita.** Agendar contaba como haber visto al
 * paciente.
 *
 * Y entonces, si el paciente no venía —no-show, la cita se movió y nadie la
 * volvió a poner, el recordatorio no salió—, **nada lo reabría y nada lo echaba
 * en falta**. El control que el médico pidió no ocurría, el pendiente estaba
 * cerrado, y el sistema decía que el trabajo estaba hecho porque nadie le
 * preguntó nunca al calendario.
 *
 * Es la misma forma de fallo que REG-501 cerró del otro lado —que el resultado
 * EXISTIERA contaba como que alguien lo había leído— aplicada a la otra punta
 * del ciclo: que la cita EXISTA cuenta como que el paciente vino.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * **Una intención no es un resultado.** Agendar es una intención; el encuentro
 * es el resultado. `agendada` es un estado **vivo**: el pendiente sigue en el
 * worklist hasta que el encuentro pase o alguien decida que ya no aplica.
 *
 * ── POR QUÉ NO SE PUEDE SALTAR DE `agendada` A `cerrada` ────────────────────
 *
 * Porque cerrar es la constancia de que alguien REVISÓ, y desde «hay una cita
 * puesta» no hay nada que revisar todavía. Ese atajo es exactamente el que
 * convertía agendar en haber atendido, y dejarlo abierto habría hecho el estado
 * nuevo decorativo.
 *
 * ── POR QUÉ NO HACE FALTA UNA CATEGORÍA NUEVA EN EL WORKLIST ────────────────
 *
 * Antes no había forma de distinguirlos: la tarea se cerraba al agendar, así que
 * **todo `seguimiento` vivo estaba, por definición, sin agendar**. Con el estado
 * nuevo, lo que se espera de un seguimiento ya agendado no es una acción del
 * consultorio sino que el paciente venga — que es `esperando_paciente`, la
 * categoría que ya existía. Inventar una octava habría sido añadir modelo sin
 * añadir información.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No comprueba el calendario.** Nadie verifica que exista una cita de
 *   verdad: `agendada` es lo que alguien DECLARÓ, no lo que el calendario dice.
 *   Cruzarlo con `appointments` es la rebanada siguiente y queda nombrada.
 * · **No cierra el pendiente cuando el paciente viene.** Sigue haciendo falta
 *   que alguien marque «el paciente vino»; lo que cambia es que ahora hay un
 *   estado donde esperar en vez de una tarea cerrada de más.
 * · **No cubre el no-show.** Que una cita pasada sin encuentro reabra o escale
 *   exige decidir cuánto se espera, y eso es del médico.
 * · **Sólo el seguimiento tiene el paso extra.** Un estudio pendiente o una
 *   receta por entregar siguen igual: meterles un paso que no significa nada
 *   para ellos sería alargar el camino sin decir nada.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  puedeTransicionar, estaViva, type TareaClinica,
} from '@/lib/tareas-clinicas/modelo'
import { siguientePaso } from '@/lib/tareas-clinicas/por-que-esta-aqui'
import { estadoDeAccion } from '@/lib/tareas-clinicas/estado-de-accion'

const SEGUIMIENTO = {
  id: 't1', tipo: 'seguimiento' as const, titulo: 'Agendar el seguimiento',
  prioridad: 'normal' as const, creadaEn: '2026-08-01T09:00:00.000Z',
  venceEn: '2026-11-01T09:00:00.000Z', origen: 'nota',
}
const AHORA = Date.parse('2026-08-30T09:00:00.000Z')

describe('un seguimiento agendado sigue vivo', () => {
  it('AL REVÉS: antes se cerraba al agendar, y el camino lo permitía de un salto', () => {
    /**
     * El defecto, escrito como el camino que lo hacía posible. `en_curso →
     * completada` sigue existiendo para los demás tipos; lo que cambió es que el
     * seguimiento ya no lo ofrece como paso siguiente.
     */
    expect(siguientePaso({ ...SEGUIMIENTO, estado: 'en_curso' })?.estado).toBe('agendada')
    expect(siguientePaso({ ...SEGUIMIENTO, estado: 'en_curso' })?.texto).toMatch(/agendada/i)
  })

  it('y `agendada` es un estado VIVO — no desaparece del worklist', () => {
    /* Si no lo fuera, el estado nuevo sería el mismo cierre con otro nombre. */
    expect(estaViva({ estado: 'agendada' })).toBe(true)
  })

  it('la consulta de tareas vivas lo incluye', () => {
    /**
     * «El dato tiene que LLEGAR»: un estado vivo que la consulta no pide no
     * existe para la pantalla, y el pendiente volvería a desvanecerse — con más
     * código encima.
     */
    const FIRESTORE = readFileSync('src/lib/tareas-clinicas/firestore.ts', 'utf8')
    expect(FIRESTORE).toMatch(/'solicitada', 'aceptada', 'en_curso', 'agendada', 'completada'/)
  })

  it('desde `agendada` el paso siguiente es que el paciente vino', () => {
    expect(siguientePaso({ ...SEGUIMIENTO, estado: 'agendada' })?.estado).toBe('completada')
    expect(siguientePaso({ ...SEGUIMIENTO, estado: 'agendada' })?.texto).toMatch(/vino/i)
  })
})

describe('no hay atajo de «hay cita» a «revisado»', () => {
  it('de `agendada` NO se puede saltar a `cerrada`', () => {
    /**
     * El caso que impide que el estado nuevo sea decorativo. Cerrar es la
     * constancia de que alguien revisó; desde «hay una cita puesta» no hay nada
     * que revisar todavía.
     */
    const v = puedeTransicionar('agendada', 'cerrada')
    expect(v.permitido).toBe(false)
  })

  it('pero sí se puede volver a agendar, o cancelar', () => {
    /* La cita se movió y nadie la repuso; o el control dejó de aplicar. Las dos
       pasan, y cerrar el camino las convertiría en tareas zombis. */
    expect(puedeTransicionar('agendada', 'en_curso').permitido).toBe(true)
    expect(puedeTransicionar('agendada', 'cancelada').permitido).toBe(true)
    expect(puedeTransicionar('agendada', 'completada').permitido).toBe(true)
  })

  it('y lo terminal sigue siendo terminal', () => {
    expect(puedeTransicionar('cerrada', 'agendada').permitido).toBe(false)
    expect(puedeTransicionar('cancelada', 'agendada').permitido).toBe(false)
  })
})

describe('el worklist deja de pedir que se agende lo que ya está agendado', () => {
  it('un seguimiento sin agendar necesita agendarse', () => {
    const t = { ...SEGUIMIENTO, estado: 'solicitada' as const } as TareaClinica
    expect(estadoDeAccion(t, AHORA)).toBe('necesita_agendar')
  })

  it('y uno agendado pasa a esperar al paciente', () => {
    /**
     * No hace falta una octava categoría: lo que se espera ya no es una acción
     * del consultorio sino que el paciente venga, y `esperando_paciente` es
     * exactamente eso. Inventar una nueva sería añadir modelo sin información.
     */
    const t = { ...SEGUIMIENTO, estado: 'agendada' as const } as TareaClinica
    expect(estadoDeAccion(t, AHORA)).toBe('esperando_paciente')
  })

  it('lo vencido sigue ganando a todo', () => {
    /* Una cita que ya pasó y sigue `agendada` es lo que hay que mirar, no algo
       que espera tranquilamente. */
    const t = { ...SEGUIMIENTO, estado: 'agendada' as const, venceEn: '2026-08-01T09:00:00.000Z' } as TareaClinica
    expect(estadoDeAccion(t, AHORA)).toBe('vencida')
  })
})

describe('los demás tipos no cambian de camino', () => {
  it('un estudio pendiente va directo a «ya se hizo»', () => {
    /**
     * Meterle un paso que no significa nada para él alargaría el camino sin
     * decir nada — y un worklist que cuesta se abandona.
     */
    const estudio = { ...SEGUIMIENTO, tipo: 'estudio_pendiente' as const, estado: 'en_curso' as const }
    expect(siguientePaso(estudio)?.estado).toBe('completada')
  })

  it('y una receta por entregar, igual', () => {
    const receta = { ...SEGUIMIENTO, tipo: 'receta_por_entregar' as const, estado: 'en_curso' as const }
    expect(siguientePaso(receta)?.estado).toBe('completada')
  })
})
