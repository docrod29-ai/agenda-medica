/**
 * GOLDEN — el lado del DICTADO leía la negación como se escribe, no como se
 * contesta.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `negaciones.ts` nació el 3-ago (REG-158) para que lo que el paciente negó no
 * acabara de diagnóstico. REG-192 reparó el lado de la NOTA —se miraba sólo la
 * primera aparición, y «plasma» contaba como «asma»—. El lado del DICTADO se
 * quedó como estaba, y ahí había tres fallos, los tres reproducidos con el motor
 * real antes de tocar una línea:
 *
 *  1. **La negación con muletilla se perdía entera.** «Pues no», «fíjese que
 *     no», «que yo sepa, no», «para nada», «uy no» → `condicionesNegadas`
 *     devolvía `[]`. Es el caso del 3-ago con una palabra delante: el paciente
 *     contesta que no y la nota le pone la crónica. La variante «que yo sepa no»
 *     estaba declarada y **la coma** la rompía.
 *
 *  2. **No saber se registraba como negar.** «No sé», «no me acuerdo», «no me
 *     han checado» empiezan por «no», así que entraban como negación y
 *     `corregirCertezaPorNegacion` marcaba la condición `descartado` — que es
 *     una AFIRMACIÓN de ausencia. Un paciente con diabetes sin diagnosticar
 *     contesta exactamente así. Regla 4 de `clinical-safety.md` rota dentro del
 *     módulo que la cita en su cabecera.
 *
 *  3. **El negador se aplicaba a la FRASE ENTERA.** `NIEGA_EN_LINEA.test(frase)`
 *     daba por negada cualquier crónica nombrada en una oración que contuviera
 *     un negador: «Niega tabaquismo, tiene diabetes en tratamiento» dejaba la
 *     diabetes por negada. Una crónica activa desaparecía del panel de entidades
 *     porque la frase negaba otra cosa. El más caro de los tres.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Punto C2/C3 del plan de la auditoría del 6-ago («faltan negadores del habla
 * real»). Lo primero fue **refutarlo**: C2 decía que «No padece diabetes» salía
 * como antecedente positivo, y es falso — `no\s+padece` estaba en la expresión
 * desde el primer día. Los tres de arriba salieron de correr el motor.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * **No se toca el vocabulario para arreglar esto.** En el momento de este
 * arreglo, nota y dictado todavía compartían un mismo regex de negación para
 * dos preguntas distintas, y ensancharlo ya había fabricado una vez una
 * negación que el paciente no dijo — «para descartar diabetes», REG-192. Aquí
 * se reutiliza tal cual y se le cambia el **alcance**: anclado en `$`, el
 * negador tiene que estar pegado al término, con un puente de palabras vacías
 * que cualquier palabra con contenido corta. (El regex compartido se separó
 * después, en `DISCULPA_EN_LA_NOTA` / `NIEGA_EN_EL_DICTADO`, resolviendo C-6 —
 * pero el alcance por adyacencia que arregla este golden sigue haciendo falta
 * del lado del dictado con o sin esa separación.)
 *
 * Y en la respuesta se quita la muletilla primero y se exige después un núcleo
 * negativo, en vez de alargar la lista de negaciones.
 *
 * ── QUÉ **NO** CUBRE ─────────────────────────────────────────────────────────
 *
 * - **El lado de la NOTA no se toca.** «Negó diabetes» (con acento), «Sin
 *   diabetes», «No es diabético» y «DM2 (-)» siguen sin contar como disculpa y
 *   siguen disparando el aviso contra una nota que dice lo mismo que el dictado.
 *   Está reproducido y anotado como decisión del dueño (C-6-bis): qué frases
 *   adicionales cuentan como disculpa en una nota es vocabulario clínico.
 * - **No avisa de que el paciente no sabe.** «No sé» deja de contar como
 *   negación; la condición se queda como la puso el extractor. Que la duda
 *   llegue a la pantalla es otra pieza (C-8).
 * - **Hedges fuera**: «creo que no», «casi no» siguen sin contar como negación.
 *   Del lado seguro, que es no negar de más.
 * - **`CRONICAS` es vocabulario, no criterio**: lo que no está en la lista no se
 *   vigila; no se da por bueno.
 * - **Sin separación de voces** no se sabe quién contestó: si el acompañante
 *   contesta por el paciente, aquí no se distingue.
 */
import { describe, it, expect } from 'vitest'
import {
  condicionesNegadas, contradicciones, corregirCertezaPorNegacion, esRespuestaNegativa,
  POR_QUE_NO_SABER_NO_ES_NEGAR, POR_QUE_EL_NEGADOR_NO_ALCANZA_A_TODA_LA_FRASE,
} from '@/lib/expediente/negaciones'

const negadas = (t: string) => condicionesNegadas(t).map(x => x.condicion)

const NOTA_QUE_AFIRMA = 'Paciente con Diabetes mellitus tipo 2 en tratamiento.'

describe('FALLO 1 · la negación llega con muletilla delante', () => {
  for (const dictado of [
    '¿Padece diabetes? Pues no.',
    '¿Padece diabetes? Fíjese que no.',
    '¿Padece diabetes? Pues fíjese que no.',
    '¿Tiene diabetes? Que yo sepa, no.',
    '¿Es diabético? Para nada.',
    '¿Tiene diabetes? Uy no.',
    '¿Tiene diabetes? Mmm no.',
    '¿Padece diabetes? Bueno, no.',
    '¿Padece diabetes? No, doctor.',
    '¿Padece diabetes? Ninguna.',
  ]) {
    it(`«${dictado.split('?')[1].trim()}» es un no`, () => {
      expect(negadas(dictado)).toContain('diabetes')
      // Y llega hasta el final: si la nota la afirma, se contradice.
      expect(contradicciones(condicionesNegadas(dictado), NOTA_QUE_AFIRMA)).toHaveLength(1)
    })
  }

  it('la coma de «que yo sepa, no» no puede cambiar el sentido', () => {
    // La variante vieja estaba escrita sin coma y sólo funcionaba sin ella. Una
    // coma es un artefacto de transcripción, no un hecho clínico.
    expect(esRespuestaNegativa('Que yo sepa, no')).toBe(true)
    expect(esRespuestaNegativa('Que yo sepa no')).toBe(true)
  })

  it('la muletilla sola no niega nada: hace falta el núcleo', () => {
    expect(esRespuestaNegativa('Pues sí, desde hace diez años')).toBe(false)
    expect(esRespuestaNegativa('Pues mi mamá sí')).toBe(false)
    expect(esRespuestaNegativa('Bueno, me la controlo con dieta')).toBe(false)
  })

  it('el silencio no es una negación', () => {
    expect(esRespuestaNegativa('')).toBe(false)
    expect(negadas('¿Padece diabetes?')).toEqual([])
  })
})

describe('FALLO 2 · el que no sabe no está negando (regla 4)', () => {
  for (const respuesta of [
    'No sé.', 'Pues no sé.', 'No me acuerdo.', 'No estoy seguro.',
    'No me han checado.', 'No me lo han revisado.',
  ]) {
    it(`«${respuesta}» no es una negación`, () => {
      expect(esRespuestaNegativa(respuesta)).toBe(false)
      expect(negadas(`¿Padece diabetes? ${respuesta}`)).toEqual([])
    })
  }

  it('y por tanto NO reclasifica la condición a descartado', () => {
    // Éste es el daño concreto: `descartado` es una afirmación de ausencia, y el
    // paciente sólo dijo que no lo sabe.
    const n = condicionesNegadas('¿Padece diabetes? No sé, nunca me la han checado.')
    const { conditions, corregidas } = corregirCertezaPorNegacion(
      [{ texto: 'diabetes mellitus tipo 2', certeza: 'confirmado' }], n,
    )
    expect(conditions[0].certeza).toBe('confirmado')
    expect(corregidas).toEqual([])
  })

  it('negar en parte tampoco es negar', () => {
    expect(esRespuestaNegativa('No siempre')).toBe(false)
    expect(esRespuestaNegativa('No del todo')).toBe(false)
  })

  it('pero un «no» limpio sigue reclasificando, que es para lo que existe', () => {
    const n = condicionesNegadas('¿Padece diabetes? Pues no.')
    const { conditions, corregidas } = corregirCertezaPorNegacion(
      [{ texto: 'diabetes mellitus tipo 2', certeza: 'confirmado' }], n,
    )
    expect(conditions[0].certeza).toBe('descartado')
    expect(corregidas).toHaveLength(1)
  })
})

describe('FALLO 4 · el «no» de arranque que en realidad es un SÍ (REG-200)', () => {
  /**
   * ── CÓMO SE DESCUBRIÓ ──────────────────────────────────────────────────────
   *
   * Sondeando el motor real de esta misma rama, 7-ago-2026, mientras se
   * comprobaba qué quedaba vivo de C2/C3. `esRespuestaNegativa` devolvía `true`
   * para «No pues sí, desde hace años».
   *
   * ── POR QUÉ ES DE LOS CAROS ────────────────────────────────────────────────
   *
   * Es la familia de «no sé» (FALLO 2), pero un escalón peor: allí el paciente
   * decía que no lo sabía y se le fabricaba una ausencia; aquí el paciente
   * AFIRMA la enfermedad en la misma frase y se le da la vuelta. La condición
   * sale reclasificada a `descartado` —una afirmación de ausencia— sobre una
   * crónica que el paciente acaba de reconocer, y los antecedentes se arrastran
   * a todas las notas siguientes.
   */
  for (const respuesta of ['No pues sí, desde hace años.', 'No, sí tengo.', 'No, sí padezco.', 'No pos sí.']) {
    it(`«${respuesta}» NO es una negación`, () => {
      expect(esRespuestaNegativa(respuesta)).toBe(false)
      expect(negadas(`¿Padece diabetes? ${respuesta}`)).toEqual([])
    })
  }

  it('no reclasifica a descartado una diabetes que el paciente acaba de afirmar', () => {
    const n = condicionesNegadas('¿Padece diabetes? No pues sí, desde hace años.')
    const { conditions, corregidas } = corregirCertezaPorNegacion(
      [{ texto: 'diabetes mellitus tipo 2', certeza: 'confirmado' }], n,
    )
    expect(conditions[0].certeza).toBe('confirmado')
    expect(corregidas).toEqual([])
  })

  it('y el «no» que sí niega no se toca', () => {
    // El guardián al revés: si esto cae, el arreglo apagó la negación en vez de
    // afinarla, y volvemos al caso del 3-ago.
    for (const r of ['No.', 'No, ninguna.', 'Pues no, doctor.', 'No, gracias a Dios.']) {
      expect(esRespuestaNegativa(r), r).toBe(true)
    }
    expect(negadas('¿Padece diabetes? No, ninguna.')).toContain('diabetes')
  })

  it('lo que cuesta queda declarado, no escondido', () => {
    /**
     * El núcleo llega sin acentos, así que «sí» y «si» se confunden: «No, si yo
     * nunca he tenido nada» es una negación enfática y deja de contar como tal.
     * Se pierde un aviso —el sesgo declarado del módulo—; al revés se fabricaría
     * el negativo, que es el daño que esta guardia viene a impedir.
     */
    expect(esRespuestaNegativa('No, si yo nunca he tenido nada.')).toBe(false)
  })
})

describe('FALLO 3 · el negador alcanza al término de al lado, no a la frase', () => {
  for (const frase of [
    'Niega tabaquismo, tiene diabetes en tratamiento.',
    'Tiene diabetes y no tiene fiebre.',
    'No tiene fiebre pero sí tiene diabetes.',
    'Paciente sin antecedentes de tabaquismo, con diabetes de 10 años.',
  ]) {
    it(`«${frase}» deja la diabetes en pie`, () => {
      expect(negadas(frase)).toEqual([])
    })
  }

  it('lo que SÍ está pegado al término se sigue negando', () => {
    // El comportamiento que existía y no puede perderse.
    expect(negadas('Niega diabetes.')).toEqual(['diabetes'])
    expect(negadas('No tiene diabetes.')).toEqual(['diabetes'])
    expect(negadas('Sin antecedentes de diabetes.')).toEqual(['diabetes'])
  })

  it('la enumeración hereda el negador de su cabeza', () => {
    expect(negadas('Niega diabetes e hipertensión arterial.'))
      .toEqual(expect.arrayContaining(['diabetes', 'hipertensión arterial']))
    expect(negadas('Niega diabetes, hipertensión y dislipidemia.'))
      .toEqual(expect.arrayContaining(['diabetes', 'hipertensión arterial', 'dislipidemia']))
  })

  it('pero la herencia se corta en cuanto hay algo más que una conjunción', () => {
    expect(negadas('Niega diabetes, tiene hipertensión arterial.')).toEqual(['diabetes'])
    expect(negadas('Niega diabetes y presenta hipertensión arterial.')).toEqual(['diabetes'])
  })

  it('un negador dentro de la PREGUNTA no contesta por el paciente', () => {
    // A «¿no tiene diabetes?» se puede contestar que sí.
    expect(negadas('¿No tiene diabetes? Sí tengo, desde hace años.')).toEqual([])
    expect(negadas('¿No tiene diabetes? No.')).toContain('diabetes')
  })

  it('«para descartar diabetes» sigue sin fabricar una negación', () => {
    // La regresión que pagó REG-192: un diferencial abierto quedaba escrito como
    // `descartado`. La adyacencia lo apaga sola — el infinitivo rompe la
    // frontera de palabra de `descarta` — pero se sella para que se note si
    // alguien vuelve a ensanchar el vocabulario.
    expect(negadas('Vamos a solicitar HbA1c para descartar diabetes.')).toEqual([])
  })

  it('«plasma» sigue sin ser «asma» en el dictado', () => {
    // La frontera de palabra de REG-192 vale para los dos lados: el dictado usa
    // ahora el mismo `apariciones()` que la nota.
    expect(negadas('Niega glucosa en plasma venoso alterada.')).toEqual([])
  })
})

describe('EL CASO DEL 3-AGO SIGUE PROTEGIDO', () => {
  it('«¿Enfermedades crónicas como diabetes o presión alta? No.» niega las dos', () => {
    const n = negadas('¿Enfermedades crónicas como diabetes o presión alta? No.')
    expect(n).toContain('diabetes')
    expect(n).toContain('hipertensión arterial')
  })
})

describe('EL PORQUÉ VIAJA CON EL CÓDIGO', () => {
  it('la razón de que no saber no sea negar cita la regla 4', () => {
    expect(POR_QUE_NO_SABER_NO_ES_NEGAR).toMatch(/ausencia de dato no es dato de ausencia/i)
  })
  it('la razón del alcance dice que NO se toca el vocabulario compartido', () => {
    expect(POR_QUE_EL_NEGADOR_NO_ALCANZA_A_TODA_LA_FRASE).toMatch(/tabaquismo/i)
    expect(POR_QUE_EL_NEGADOR_NO_ALCANZA_A_TODA_LA_FRASE).toMatch(/vocabulario/i)
  })
})
