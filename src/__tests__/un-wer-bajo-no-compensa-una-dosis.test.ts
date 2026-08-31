/**
 * GOLDEN — el WER cuenta palabras; la consulta se juega en cuatro de ellas.
 *
 * ── QUÉ FALTABA ─────────────────────────────────────────────────────────────
 *
 * `TR-VOZ.error-clinicamente-pesado`, con el hueco escrito en el censo: «Un WER
 * genérico bajo no compensa un error de dosis, unidad, negación o lateralidad.
 * Falta el análisis ponderado sobre consulta larga.»
 *
 * Y el número lo enseña: en la consulta sintética de 532 palabras, cambiar
 * «setenta y cinco microgramos» por «setenta y cinco miligramos» da un WER de
 * **0,188 %**. Publicado así, ese motor sale excelente. La levotiroxina va
 * multiplicada por mil.
 *
 * ── POR QUÉ NO SE PONDERA, QUE ERA LA SALIDA OBVIA ──────────────────────────
 *
 * Dar más peso a los errores graves falla por dos sitios. El primero: **qué
 * peso** vale una dosis frente a una lateralidad es una decisión clínica, y un
 * número inventado aquí acaba en una diapositiva como si alguien lo hubiera
 * firmado.
 *
 * El segundo ya estaba escrito en `politica-critica.ts` desde antes: *«No existe
 * umbral de similitud que haga esa sustitución aceptable: está prohibida, **no
 * penalizada**.»* Un peso es una penalización, y una penalización **se compensa
 * con volumen**: bastan suficientes frases buenas para que la media vuelva a ser
 * bonita. Meter un error de dosis dentro de un promedio es autorizar que se
 * compense.
 *
 * Así que no hay un número. Hay tres cuentas que no se suman, y se aprueba con
 * cero en dos de ellas.
 *
 * ── LOS TRES DEFECTOS QUE SALIERON AL CORRERLO ──────────────────────────────
 *
 * Los tres aparecieron ejecutando el módulo contra frases de verdad **antes** de
 * escribir esta prueba, que es la lección que dejó REG-402. Los tres habrían
 * pasado una revisión de código.
 *
 * 1. **La negación volteada salía aprobada.** El primer intento reusaba
 *    `condicionesNegadas`, que responde «¿esta FRASE contiene una negación y una
 *    condición?». Con «paciente niega diabetes y niega hipertensión» → «paciente
 *    TIENE diabetes y niega hipertensión», la frase transcrita todavía contiene
 *    un «niega» —el de la hipertensión— así que las dos versiones daban la misma
 *    lista y el volteo no se veía. Reutilizar un motor canónico no basta: hay
 *    que comprobar que contesta la pregunta que se le hace.
 * 2. **«microgramos» no era «mcg».** Los pares prohibidos conocen los símbolos, y
 *    un médico dicta palabras. El clasificador estaba ciego justo donde ocurre el
 *    dictado. Se arregla clasificando sobre el texto ya normalizado por el
 *    pipeline — no con una lista nueva de unidades habladas.
 * 3. **«metformina» → «meropenem» era ordinario.** El vocabulario de términos
 *    críticos que se usaba —`criticosGlobales()`— son **35 siglas de UCI** y ni
 *    un nombre de fármaco. Un módulo que pesa errores clínicos y no reconoce los
 *    fármacos del consultorio no pesa nada: no fallaba, aprobaba. Ahora sale de
 *    `medical-vocabulary`, que ya existía y ya alimenta al corrector — 1 964
 *    términos en vez de 35.
 * 4. **Un error contado dos veces.** «40 mg» → «400 mg» salía como corrimiento de
 *    decimal Y como cifra perdida. Inflar la cuenta de críticos importa cuando la
 *    cuenta ES el resultado.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Se aprueba con **cero críticos y cero sin clasificar**. La tercera cuenta es la
 * que hace honesto al módulo: si «no sé qué es esto» no reprobara, saldría tanto
 * más limpio cuanto menos supiera reconocer.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No mide con un proveedor real.** El gold es el corpus sintético del árbol;
 *   la consulta larga contra un reconocedor de verdad sigue siendo
 *   `TR-VOZ.consulta-larga`, bloqueada por presupuesto y no por falta de esto.
 * · **No sustituye al WER**, que se sigue calculando en crudo para poder
 *   compararlo con `docs/voice/WER-MEDIDO.json`.
 * · **No distingue dos fármacos.** Afirmar que dos términos críticos son dos
 *   fármacos exige un catálogo. Cae en «sin clasificar», que reprueba igual.
 * · **No fija ningún umbral de WER**: cuánto se tolera de un motor que se
 *   entiende mal, pero no es peligroso, lo decide el dueño.
 * · **No ve quién habló**, ni la intención de orden, ni el momento.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  leerConsulta, pesarSustitucion, LO_QUE_NO_SE_VIGILA,
  POR_QUE_NO_SE_PONDERA, POR_QUE_SIN_CLASIFICAR_REPRUEBA, cuantosTerminosVigila,
} from '@/lib/asr/lo-que-pesa-de-un-error'

/**
 * LA CONSULTA LARGA: el corpus sintético que ya vivía en el árbol.
 *
 * Doce diálogos que ponen a prueba negación, temporalidad, dosis, unidades,
 * lateralidad, alergia y acompañante — exactamente las clases que se clasifican
 * aquí. Es sintético, como exige la regla de datos: cero pacientes reales.
 */
const GUION = 'synthetic-data/dialogos-consulta/GUION.jsonl'
const CONSULTA_LARGA = readFileSync(GUION, 'utf8').trim().split('\n')
  .map(l => (JSON.parse(l) as { turnos: { texto: string }[] }).turnos.map(t => t.texto).join(' '))
  .join(' ')

describe('la consulta larga: un WER de laboratorio y una dosis por mil', () => {
  it('el gold es largo de verdad, no tres frases', () => {
    /* Con veinte palabras, cualquier error mueve el WER lo suficiente para
       verse. El defecto de esta unidad SÓLO existe a longitud de consulta. */
    expect(CONSULTA_LARGA.trim().split(/\s+/).length).toBeGreaterThan(400)
  })

  it('CONTROL: contra sí misma no hay ni un crítico ni un sin clasificar', () => {
    /**
     * El caso que impide que todo lo demás sea trivial. Un clasificador que
     * marcara ruido sobre 532 palabras de diálogo normal reprobaría siempre, y
     * entonces «reprueba» no significaría nada.
     */
    const r = leerConsulta(CONSULTA_LARGA, CONSULTA_LARGA)
    expect(r.wer).toBe(0)
    expect(r.criticos).toEqual([])
    expect(r.sinClasificar).toEqual([])
    expect(r.aprobada).toBe(true)
  })

  it('AL REVÉS: un solo cambio de unidad da un WER excelente y REPRUEBA', () => {
    /**
     * El corazón del requisito. 0,19 % de WER —mejor que cualquier motor
     * publicado— y la levotiroxina multiplicada por mil.
     */
    const conError = CONSULTA_LARGA.replace('Setenta y cinco microgramos', 'Setenta y cinco miligramos')
    expect(conError, 'el corpus cambió: la frase inyectada ya no existe').not.toBe(CONSULTA_LARGA)

    const r = leerConsulta(CONSULTA_LARGA, conError)
    expect(r.wer).toBeLessThan(0.005)
    expect(r.aprobada).toBe(false)
    expect(r.criticos).toHaveLength(1)
    expect(r.criticos[0].clase).toBe('cambio_unidad')
    expect(r.criticos[0].consecuencia).toMatch(/MIL/)
  })

  it('y la palabra dictada cuenta como el símbolo, que era el defecto 2', () => {
    /* «microgramos» no es «mcg» para `PARES_PROHIBIDOS`, y un médico dicta
       palabras. Sin normalizar, el caso de arriba salía aprobado. */
    expect(leerConsulta('levotiroxina setenta y cinco microgramos al día',
      'levotiroxina setenta y cinco miligramos al día').aprobada).toBe(false)
  })
})

describe('cada clase que el Dr. declaró se reconoce', () => {
  const reprueba = (gold: string, oido: string) => leerConsulta(gold, oido)

  it('el par prohibido, en las dos direcciones', () => {
    expect(pesarSustitucion('mg', 'mcg').clase).toBe('cambio_unidad')
    expect(pesarSustitucion('mcg', 'mg').clase).toBe('cambio_unidad')
    expect(pesarSustitucion('derecha', 'izquierda').clase).toBe('cambio_lateralidad')
  })

  it('el decimal corrido se distingue de la dosis cambiada', () => {
    /* Un factor de diez exacto tiene clase propia porque tiene causa propia: el
       reconocedor pegó un cero, no oyó otro número. */
    expect(pesarSustitucion('40', '400').clase).toBe('corrimiento_decimal')
    expect(pesarSustitucion('40', '60').clase).toBe('cambio_dosis')
  })

  it('la cifra que se CAE del texto, que no es una sustitución', () => {
    /**
     * `sustituciones()` descarta los tramos desiguales a propósito. Un borrado
     * no es una sustitución, así que el error más caro que existe —la dosis que
     * desaparece— es invisible para el alineador. Por eso se cuentan las cifras.
     */
    const r = reprueba('furosemida 40 mg cada 12 horas', 'furosemida mg cada 12 horas')
    expect(r.aprobada).toBe(false)
    expect(r.criticos.some(c => c.clase === 'cambio_dosis' && c.oido === '')).toBe(true)
  })

  it('y NO se cuenta dos veces cuando además hubo sustitución', () => {
    /* Defecto 3. Inflar la cuenta importa cuando la cuenta es el resultado. */
    const r = reprueba('furosemida 40 mg cada 12 horas', 'furosemida 400 mg cada 12 horas')
    expect(r.criticos).toHaveLength(1)
  })

  it('la negación que se pierde — el defecto 1, que salía aprobado', () => {
    /**
     * AL REVÉS del primer intento: con `condicionesNegadas`, esto daba
     * `aprobada: true` porque la frase transcrita conserva el otro «niega».
     */
    const r = reprueba('paciente niega diabetes y niega hipertension',
      'paciente tiene diabetes y niega hipertension')
    expect(r.aprobada).toBe(false)
    expect(r.criticos.some(c => c.clase === 'volteo_negacion')).toBe(true)
  })

  it('y la negación que se INVENTA, que borra un antecedente real', () => {
    /* Los dos sentidos importan: perder un «niega» inventa una enfermedad,
       añadirlo borra una que existe. */
    const r = reprueba('el paciente tiene diabetes', 'el paciente niega diabetes')
    expect(r.criticos.some(c => c.clase === 'volteo_negacion')).toBe(true)
  })

  it('el «no» que se cae va a «sin clasificar», no a crítico', () => {
    /**
     * «niega» sólo aparece negando algo; «no» aparece en cualquier frase. Contar
     * el «no» suelto como volteo fabricaría críticos falsos, y fabricar una
     * negación es peor que perderla. Reprueba igual — pero no afirma lo que no
     * consta.
     */
    const r = reprueba('no sé si le duele', 'sé si le duele')
    expect(r.aprobada).toBe(false)
    expect(r.criticos.filter(c => c.clase === 'volteo_negacion')).toHaveLength(0)
    expect(r.sinClasificar.length).toBeGreaterThan(0)
  })
})

describe('lo que NO se marca de más', () => {
  it('un cambio de palabra corriente es ordinario y no reprueba', () => {
    /* Si «el» → «la» reprobara, la lectura sería inservible y se apagaría — que
       es como muere una compuerta que grita siempre. */
    const r = leerConsulta('el paciente refiere dolor abdominal de tres dias',
      'la paciente refiere dolor abdominal de tres dias')
    expect(r.aprobada).toBe(true)
    expect(r.ordinarios).toBeGreaterThan(0)
    expect(r.wer).toBeGreaterThan(0)
  })

  it('y una transcripción perfecta aprueba con WER cero', () => {
    const t = 'se indica furosemida 40 mg cada 12 horas'
    const r = leerConsulta(t, t)
    expect(r.wer).toBe(0)
    expect(r.aprobada).toBe(true)
  })

  it('el vocabulario son los fármacos de verdad, no 35 siglas de UCI', () => {
    /**
     * DEFECTO 3, medido. Con `criticosGlobales()` solo eran 35 términos, todos
     * de UCI, y «metformina» → «meropenem» salía ordinario. La cuenta se
     * comprueba desde fuera porque un vocabulario que encoge en silencio deja de
     * vigilar sin que nada se ponga rojo.
     */
    expect(cuantosTerminosVigila()).toBeGreaterThan(1_000)
    expect(pesarSustitucion('metformina', 'meropenem').peso).toBe('sin_clasificar')
    expect(pesarSustitucion('losartan', 'olanzapina').peso).toBe('sin_clasificar')
  })

  it('no se afirma «sustitución de fármaco» sin catálogo para afirmarlo', () => {
    /* Señalar de menos, nunca de más: lo que sí se puede decir es que no se da
       por bueno, y para eso está «sin clasificar». */
    const r = pesarSustitucion('metformina', 'meropenem')
    expect(r.clase).not.toBe('sustitucion_farmaco')
    expect(r.peso).toBe('sin_clasificar')
  })
})

describe('no hay un número, y ésa es la decisión', () => {
  it('«sin clasificar» reprueba, o el módulo tendría un incentivo perverso', () => {
    /**
     * Sin esto, cuanto menos supiera reconocer, más limpio saldría todo. Es la
     * regla 4 de seguridad clínica aplicada a una métrica.
     */
    const r = leerConsulta('levotiroxina 75 mcg', 'levotiroxina 75 metformina')
    expect(r.criticos).toHaveLength(0)
    expect(r.sinClasificar.length).toBeGreaterThan(0)
    expect(r.aprobada, 'un «no sé» dejó pasar la lectura').toBe(false)
    expect(POR_QUE_SIN_CLASIFICAR_REPRUEBA).toMatch(/Ausencia de dato no es dato de ausencia/)
  })

  it('la razón de no ponderar está escrita, y dice lo de la compensación', () => {
    expect(POR_QUE_NO_SE_PONDERA).toMatch(/se compensa con volumen/)
    expect(POR_QUE_NO_SE_PONDERA).toMatch(/PROHIBIDOS, no penalizados/)
  })

  it('y el módulo no contiene ninguna tabla de pesos', () => {
    /**
     * El caso que evita la recaída. Alguien pedirá «un solo número para la
     * diapositiva», y un `Record<clase, number>` aquí sería exactamente la
     * media que la política prohíbe.
     */
    const src = readFileSync('src/lib/asr/lo-que-pesa-de-un-error.ts', 'utf8')
    expect(src).not.toMatch(/PESOS\s*[:=]/)
    expect(src).not.toMatch(/Record<ClaseErrorCritico,\s*number>/)
  })

  it('el WER se sigue calculando en CRUDO, para poder compararlo', () => {
    /**
     * Calcularlo sobre el texto normalizado daría un número más bonito y ya no
     * comparable con lo publicado. Aquí se ve: la diferencia es una palabra
     * hablada contra su símbolo, que en crudo cuenta y normalizada no.
     */
    const r = leerConsulta('levotiroxina setenta y cinco microgramos', 'levotiroxina 75 mcg')
    expect(r.wer).toBeGreaterThan(0)
  })
})

describe('lo que esta lectura declara que no vigila', () => {
  it('está escrito, y nombra la sustitución de fármaco y el hablante', () => {
    /* Regla 5 de seguridad clínica: que falte un término significa que ese caso
       NO se vigila, no que se dé por bueno. Declararlo es la mitad del trato. */
    expect(LO_QUE_NO_SE_VIGILA.length).toBeGreaterThanOrEqual(4)
    expect(LO_QUE_NO_SE_VIGILA.join(' ')).toMatch(/fármaco/)
    expect(LO_QUE_NO_SE_VIGILA.join(' ')).toMatch(/Quién habló/)
    expect(LO_QUE_NO_SE_VIGILA.join(' ')).toMatch(/ORDER_INTENT/)
  })

  it('y el corpus que se usa es sintético, no de un paciente', () => {
    expect(GUION.startsWith('synthetic-data/')).toBe(true)
  })
})
