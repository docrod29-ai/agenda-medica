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
import {
  claseSegura, mensajeDeEscalacion, POR_QUE_EL_SUELO_ES_ESCALAR, POR_QUE_EL_BOT_NO_USA_EL_SUELO,
  POR_QUE_NO_SE_CLASIFICA_LO_ADMINISTRATIVO, LO_QUE_NO_SE_CLASIFICA,
} from '@/lib/paciente/hay-que-escalar'

interface Caso {
  id: string
  texto: string
  esperado: 'urgente' | 'no_urgente'
  motivo?: string
  porQue: string
  prohibido?: string
  /** La clase del §2. Obligatoria desde REG-542: «una respuesta sin clase es un defecto». */
  clase: string
  /** Qué motor la decidió. `suelo` = ninguno la reclamó y se escala. */
  comoSeDecide: 'urgencia' | 'escalacion' | 'suelo'
  motivoEscalacion?: string
  porQueSuelo?: string
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

  it('EL FIXTURE SÓLO CRECE — su propio trinquete', () => {
    /**
     * Añadido en REG-542, y hacía falta.
     *
     * El sello de `invariantes-clinicos.json` cuenta los `it(` declarados a
     * principio de línea: los casos que salen de recorrer el fixture con un
     * `for` cuentan como uno. Así que encoger `casos.json` no lo habría notado
     * el trinquete de cobertura — y el propio fixture dice, con estas palabras,
     * que «un caso NO se borra por parecer trivial».
     *
     * El número sólo puede SUBIR. Si un caso se fusiona legítimamente, se baja
     * este número **y se escribe la razón**, igual que en el trinquete de lint.
     */
    expect(fixture.casos.length, 'el fixture sólo crece: no se borra un caso por parecer trivial')
      .toBeGreaterThanOrEqual(24)
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

/**
 * ── LA SEGUNDA CLASE, AÑADIDA EN REG-542 ────────────────────────────────────
 *
 * Hasta aquí la puerta sólo comprobaba urgente / no urgente, y «no urgente» dice
 * lo que un mensaje NO es, no lo que es: «¿puedo tomarme el doble?» y «no veo
 * los horarios en la página» salían iguales.
 *
 * El §2 no admite eso: «toda respuesta se clasifica ANTES de redactarse, y la
 * clase se guarda con la respuesta. Una respuesta sin clase es un defecto, no un
 * caso raro».
 */
describe('CADA CASO TIENE SU CLASE (§2), Y SE COMPRUEBA', () => {
  const casos = fixture.casos

  it('los dieciocho declaran su clase y cómo se decide', () => {
    /* Sin esto el fixture podría crecer con casos sin clase, y la puerta los
       daría por buenos: exactamente el defecto que el §2 nombra. */
    const sinClase = casos.filter(c => !c.clase || !c.comoSeDecide).map(c => c.id)
    expect(sinClase, 'un caso sin clase no es un caso').toEqual([])
  })

  it('y el clasificador devuelve la que el fixture declara', () => {
    const fallan = casos
      .map(c => ({ c, r: claseSegura(c.texto) }))
      .filter(({ c, r }) => r.clase !== c.clase || r.comoSeDecidio !== c.comoSeDecide)
      .map(({ c, r }) => `${c.id}: esperaba ${c.clase}/${c.comoSeDecide}, dio ${r.clase}/${r.comoSeDecidio}`)
    expect(fallan).toEqual([])
  })

  it('y cuando escala, por el MOTIVO declarado — «se escaló» sin decir por qué no se audita', () => {
    const fallan = casos
      .filter(c => c.motivoEscalacion)
      .map(c => ({ c, r: claseSegura(c.texto) }))
      .filter(({ c, r }) => r.escalacion?.motivo !== c.motivoEscalacion)
      .map(({ c, r }) => `${c.id}: esperaba ${c.motivoEscalacion}, dio ${r.escalacion?.motivo ?? '—'}`)
    expect(fallan).toEqual([])
  })

  it('LA ASIMETRÍA, otra vez: nada de lo administrativo se coló como urgencia', () => {
    /**
     * El suelo escala, y eso SOBRE-escala mientras no exista el motor
     * administrativo. Lo que no puede pasar es que sobre-escale hacia ARRIBA:
     * un «agéndame para mañana» clasificado como urgencia es el 911 por una
     * cita, y eso le enseña al paciente a ignorar el aviso del día que importe.
     */
    const delSuelo = casos.filter(c => c.comoSeDecide === 'suelo')
    expect(delSuelo.length, 'si no hay ninguno, esta comprobación no comprueba nada').toBeGreaterThan(0)
    for (const c of delSuelo) {
      expect(claseSegura(c.texto).clase, c.id).not.toBe('URGENT_REVIEW_REQUIRED')
    }
  })

  it('y los del suelo dicen POR QUÉ están ahí, en vez de esconderlo', () => {
    for (const c of casos.filter(x => x.comoSeDecide === 'suelo')) {
      expect(c.porQueSuelo, c.id).toMatch(/ADMINISTRATIVE_ACTION/)
    }
  })

  it('la urgencia sigue ganando: no se reimplementó, se llama', () => {
    const src = readFileSync('src/lib/paciente/hay-que-escalar.ts', 'utf8')
    expect(src).toContain('urgenciaDelMensaje(texto)')
    /* Dos detectores de urgencia serían dos criterios sobre el mismo hecho. */
    expect(src).not.toMatch(/dolor torac/)
  })

  it('y el bot ESCALA de verdad: la prohibición vive en el servidor (§3)', () => {
    /**
     * La mitad que faltaba. Sin esto, el clasificador sería un módulo escrito y
     * probado que no corre en el camino del paciente — la familia que este
     * repositorio persigue, y que ya me cazó una vez en REG-540.
     *
     * Y va DESPUÉS de la urgencia en el fuente, que es el orden del §6.
     */
    const bot = readFileSync('src/app/api/whatsapp/webhook/route.ts', 'utf8')
    expect(bot).toMatch(/const escalacion = escalacionDelMensaje\(text\)/)
    expect(bot).toMatch(/await send\(from, mensajeDeEscalacion\(escalacion\.motivo, telConsultorio\)\)/)
    expect(bot.indexOf('const urgencia = urgenciaDelMensaje(text)'))
      .toBeLessThan(bot.indexOf('const escalacion = escalacionDelMensaje(text)'))
    /* Y usa las reglas NOMBRADAS, no el suelo: el suelo mandaría al médico un
       «agéndame para mañana» y dejaría el bot de citas muerto. */
    expect(bot).not.toMatch(/claseSegura\(/)
    expect(POR_QUE_EL_BOT_NO_USA_EL_SUELO).toMatch(/dejaría el producto muerto/)
  })

  it('al escalar, el bot le dice al paciente que NO cambie nada por su cuenta', () => {
    /* Alguien que pregunta «¿puedo tomarme el doble?» y no recibe respuesta
       puede tomárselo igual. El silencio no es una respuesta segura. */
    const m = mensajeDeEscalacion('cambio_de_dosis', '55 1234 5678')
    expect(m).toMatch(/no cambie nada de su tratamiento por su cuenta/i)
    expect(m).toMatch(/lo tiene que ver su médico/i)
    /* Y NO le dice qué hacer con su tratamiento: eso sería el §3 al revés. */
    expect(m).not.toMatch(/\bmg\b|\bdosis de\b|tome |no tome /i)
  })

  it('nunca devuelve «sin clase»: el suelo es escalar, y eso es el §1, no un invento', () => {
    for (const t of ['', '   ', 'hola', 'asdfgh', '¿el consultorio abre los sábados?']) {
      const r = claseSegura(t)
      expect(CLASES_RESPUESTA_PACIENTE, JSON.stringify(t)).toContain(r.clase)
      expect(r.clase, JSON.stringify(t)).toBe('ESCALATE_TO_CLINICIAN')
    }
    expect(POR_QUE_EL_SUELO_ES_ESCALAR).toMatch(/la escalación es el producto/)
  })
})

describe('LO QUE ESTA PUERTA NO CUBRE, COMPROBADO EN VEZ DE SUPUESTO', () => {
  it('las cinco clases existen en el tipo…', () => {
    expect(CLASES_RESPUESTA_PACIENTE).toContain('ANSWER_FROM_APPROVED_PLAN')
    expect(CLASES_RESPUESTA_PACIENTE).toContain('EDUCATIONAL_EXPLANATION')
    expect(CLASES_RESPUESTA_PACIENTE).toContain('ADMINISTRATIVE_ACTION')
    expect(CLASES_RESPUESTA_PACIENTE).toContain('ESCALATE_TO_CLINICIAN')
    expect(CLASES_RESPUESTA_PACIENTE).toContain('URGENT_REVIEW_REQUIRED')
    expect(CLASES_RESPUESTA_PACIENTE.length, 'cinco clases, y ninguna sexta').toBe(5)
  })

  it('…y sólo DOS tienen clasificador determinista hoy', () => {
    /**
     * ACTUALIZADO EN REG-542, que añadió la segunda: `ESCALATE_TO_CLINICIAN`.
     *
     * Se sigue comprobando a propósito. Fingir cobertura de las otras TRES sería
     * el verde falso que esta puerta existe para impedir — y el día que alguien
     * las implemente, este caso le recordará que aquí hay sitio esperándolas.
     */
    const fuentes = ['src/lib/paciente/urgencia.ts', 'src/lib/paciente/hay-que-escalar.ts']
      .map(f => readFileSync(f, 'utf8')).join('\n')
    for (const clase of ['ANSWER_FROM_APPROVED_PLAN', 'EDUCATIONAL_EXPLANATION', 'ADMINISTRATIVE_ACTION']) {
      // Aparecen en la lista de clases, pero nada las DEVUELVE.
      expect(fuentes, clase).not.toContain(`clase: '${clase}'`)
    }
    expect(fuentes).toContain("clase: 'URGENT_REVIEW_REQUIRED'")
    expect(fuentes).toContain("clase: 'ESCALATE_TO_CLINICIAN'")
  })

  it('y las tres que faltan están declaradas con QUÉ les falta', () => {
    expect(LO_QUE_NO_SE_CLASIFICA.join(' ')).toMatch(/PatientVisitPackage liberado/)
    expect(LO_QUE_NO_SE_CLASIFICA.join(' ')).toMatch(/umbral lo fija el médico/)
    expect(POR_QUE_NO_SE_CLASIFICA_LO_ADMINISTRATIVO).toMatch(/el error caro va en una sola dirección/)
  })

  it('y el README lo dice, para que nadie lea esta suite como cobertura completa', () => {
    const readme = readFileSync('evals/patient-ai/README.md', 'utf8')
    expect(readme).toContain('No cubre las cinco clases de respuesta')
    expect(readme).toContain('La prohibición vive en el servidor')
  })
})
