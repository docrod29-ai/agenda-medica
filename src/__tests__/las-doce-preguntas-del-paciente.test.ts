/**
 * GOLDEN — LA ÚNICA REGLA DEL REPOSITORIO QUE NO SE PODÍA CORRER.
 *
 * ── QUÉ FALTABA ──────────────────────────────────────────────────────────────
 *
 * `.claude/rules/patient-facing-ai.md` §7 dice, literal:
 *
 *   «Las doce del §0 de V9 son **fixture permanente** en `evals/patient-ai/`.
 *    No son ejemplos: son la puerta. Un cambio en la IA del paciente que no las
 *    corra no está terminado.»
 *
 * **`evals/patient-ai/` no existía.** La regla llevaba escrita desde que se abrió
 * V9, y era la única del repositorio que no se podía ejecutar.
 *
 * Una compuerta que no existe no falla nunca, y una que no falla nunca no es una
 * compuerta. Y lo peor no es la cobertura que faltaba: es que se podía cambiar la
 * IA de cara al paciente y **decir con toda honestidad que se pasaron todas las
 * compuertas**.
 *
 * ── POR QUÉ LA PUERTA PRUEBA EL SERVIDOR Y NO UN PROMPT ─────────────────────
 *
 * La misma regla, §3: *«Si una ruta lo permite y sólo el prompt lo impide, está
 * mal construida. La prohibición vive en el servidor, no en la instrucción.»*
 *
 * Así que los casos se corren contra los módulos **deterministas**. Una compuerta
 * que dependiera de que el modelo se porte bien mediría el humor del modelo, no
 * el producto, y saldría distinta cada vez.
 *
 * ── LA ASIMETRÍA QUE ESTA PUERTA VIGILA EN LAS DOS DIRECCIONES ──────────────
 *
 * Es fácil escribir un clasificador que escale TODO y presumir de que no se le
 * escapa una urgencia. Ése es peor que el que no escala: contestar el 911 a
 * «agéndame para mañana» rompe el canal y —lo que de verdad cuesta— **le enseña
 * al paciente a ignorar el aviso el día que sea de verdad**.
 *
 * Por eso la mitad de los casos comprueban que algo **NO** se clasifique como
 * urgencia. Un fixture que sólo tuviera urgencias se pasaría devolviendo
 * siempre `URGENT_REVIEW_REQUIRED`.
 *
 * ── QUÉ NO CUBRE, DECLARADO — Y ES LA PARTE HONESTA ─────────────────────────
 *
 * · **No prueba lo que el modelo redacta.** Prueba lo que el sistema hace antes
 *   de dejarle redactar. Evaluar la redacción es WS-12 y sigue abierto.
 * · **No cubre las cinco clases de respuesta.** Hoy el código implementa de
 *   verdad `URGENT_REVIEW_REQUIRED`; las otras cuatro
 *   (`ANSWER_FROM_APPROVED_PLAN`, `EDUCATIONAL_EXPLANATION`,
 *   `ADMINISTRATIVE_ACTION`, `ESCALATE_TO_CLINICIAN`) están en el tipo y **no
 *   tienen clasificador**. Este golden lo COMPRUEBA y lo declara, en vez de
 *   fingir cobertura: un caso verde sobre una clase sin implementación sería el
 *   verde falso que esta puerta existe para impedir.
 * · **No prueba las rutas del portal.** El alcance del token y el aislamiento
 *   tienen sus propias suites (`portal-alcance`, `portal-limite-de-tasa`).
 * · **Cero PHI.** Todos los textos son sintéticos.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { urgenciaDelMensaje, CLASES_RESPUESTA_PACIENTE } from '@/lib/paciente/urgencia'

interface Caso {
  id: string
  texto: string
  esperado: 'urgente' | 'no_urgente'
  motivo?: string
  porQue: string
  prohibido?: string
}

const RUTA = 'evals/patient-ai/casos.json'
const fixture = JSON.parse(readFileSync(RUTA, 'utf8')) as { casos: Caso[]; porQue: string; comoCrece: string }

describe('LA PUERTA EXISTE (§7) — y una que no existe no falla nunca', () => {
  it('el fixture permanente está en el sitio que la regla nombra', () => {
    expect(existsSync(RUTA), `${RUTA} es el sitio que exige .claude/rules/patient-facing-ai.md §7`).toBe(true)
  })

  it('trae al menos las DOCE de V9', () => {
    const deV9 = fixture.casos.filter(c => c.id.startsWith('v9-'))
    expect(deV9.length, 'las doce del §0 no son ejemplos: son la puerta').toBeGreaterThanOrEqual(12)
  })

  it('y dice cómo crece, porque un fixture que no crece se queda viejo', () => {
    expect(fixture.comoCrece).toContain('fixture permanente')
    expect(fixture.comoCrece).toContain('reproducción')
  })

  it('cada caso explica POR QUÉ está: un caso sin origen se borra en seis meses', () => {
    for (const c of fixture.casos) {
      expect(c.porQue.length, `${c.id} sin porqué`).toBeGreaterThan(30)
    }
  })

  it('los identificadores no se repiten', () => {
    const ids = fixture.casos.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('LAS URGENCIAS SE VEN (§6)', () => {
  const urgentes = fixture.casos.filter(c => c.esperado === 'urgente')

  it('hay urgencias en el fixture', () => {
    expect(urgentes.length).toBeGreaterThan(0)
  })

  it.each(urgentes.map(c => [c.id, c] as const))('%s', (_id, c) => {
    const u = urgenciaDelMensaje(c.texto)
    expect(u, `«${c.texto}» tenía que escalar. ${c.porQue}`).not.toBeNull()
    expect(u?.clase).toBe('URGENT_REVIEW_REQUIRED')
    if (c.motivo) expect(u?.motivo, `motivo de ${c.id}`).toBe(c.motivo)
  })
})

describe('Y LO QUE NO ES URGENCIA, NO SE TRATA COMO TAL', () => {
  /**
   * La mitad del fixture. Un clasificador que escale todo se pasaría un fixture
   * de sólo urgencias, y sería peor que el que no escala: enseña al paciente a
   * ignorar el aviso.
   */
  const normales = fixture.casos.filter(c => c.esperado === 'no_urgente')

  it('hay suficientes casos NO urgentes: si no, la puerta se pasa escalando todo', () => {
    expect(normales.length).toBeGreaterThanOrEqual(urgentesMenos(fixture))
  })

  it.each(normales.map(c => [c.id, c] as const))('%s', (_id, c) => {
    expect(
      urgenciaDelMensaje(c.texto),
      `«${c.texto}» NO es una urgencia del §6. ${c.porQue}`,
    ).toBeNull()
  })
})

function urgentesMenos(f: { casos: Caso[] }): number {
  // Al menos tantos «no urgentes» como urgentes: la puerta tiene que poder
  // fallar en las dos direcciones.
  return f.casos.filter(c => c.esperado === 'urgente').length
}

describe('LO QUE ESTA PUERTA NO CUBRE, COMPROBADO EN VEZ DE SUPUESTO', () => {
  it('las cinco clases existen en el tipo…', () => {
    expect(CLASES_RESPUESTA_PACIENTE).toContain('ANSWER_FROM_APPROVED_PLAN')
    expect(CLASES_RESPUESTA_PACIENTE).toContain('EDUCATIONAL_EXPLANATION')
    expect(CLASES_RESPUESTA_PACIENTE).toContain('ADMINISTRATIVE_ACTION')
    expect(CLASES_RESPUESTA_PACIENTE).toContain('ESCALATE_TO_CLINICIAN')
    expect(CLASES_RESPUESTA_PACIENTE).toContain('URGENT_REVIEW_REQUIRED')
    expect(CLASES_RESPUESTA_PACIENTE.length, 'cinco clases, y ninguna sexta').toBe(5)
  })

  it('…CUATRO tienen clasificador determinista, y la quinta se declara', () => {
    /**
     * ── ESTE CASO DECÍA «SÓLO UNA», Y LA DECLARACIÓN CADUCÓ ──────────────────
     *
     * Cuando se escribió, el código implementaba `URGENT_REVIEW_REQUIRED` y
     * nada más; este caso lo COMPROBABA en vez de fingir cobertura, y dejaba
     * dicho que «el día que alguien las implemente, este caso le recordará que
     * aquí hay sitio esperándolas».
     *
     * Llegó ese día: `PATIENT-AI-001` añade `pregunta-del-paciente.ts` con las
     * otras tres. La declaración se ACTUALIZA, no se borra — y sigue siendo una
     * comprobación, no una promesa: se lee el fuente y se exige que emita
     * exactamente las cuatro que dice emitir.
     */
    const motor = readFileSync('src/lib/paciente/pregunta-del-paciente.ts', 'utf8')
    for (const clase of ['ANSWER_FROM_APPROVED_PLAN', 'ADMINISTRATIVE_ACTION', 'ESCALATE_TO_CLINICIAN', 'URGENT_REVIEW_REQUIRED']) {
      expect(motor, `${clase} tiene que tener una rama que la devuelva`).toContain(`clase: '${clase}'`)
    }
    // La quinta sigue sin implementación, y sigue siendo lo honesto: explicar en
    // palabras más simples es el nivel 9 del §1, y aquí no hay modelo.
    expect(motor).not.toContain("clase: 'EDUCATIONAL_EXPLANATION'")
    expect(motor).toContain('CLASES_QUE_ESTE_MOTOR_NO_EMITE')
  })

  it('y el README lo dice, para que nadie lea esta suite como cobertura completa', () => {
    const readme = readFileSync('evals/patient-ai/README.md', 'utf8')
    expect(readme).toContain('No cubre las cinco clases de respuesta')
    expect(readme).toContain('La prohibición vive en el servidor')
  })
})
