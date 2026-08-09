/**
 * CORPUS ORO DEL MOTOR DE TEMPORALIDAD (EVAL-002).
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * El motor de `src/lib/expediente/temporalidad.ts` se construyó entre la v1027 y
 * la v1030 y hasta hoy sus únicos casos eran **los que escribió quien lo
 * escribió**. Una defensa medida sólo contra la cabeza de su autor no se sabe si
 * protege o si estorba: los ejemplos salen de las mismas reglas que se están
 * probando, así que pasan por construcción.
 *
 * Este corpus se redactó **antes de volver a mirar las expresiones regulares**,
 * a partir de cómo se dicta de verdad en la consulta mexicana. Por eso encontró
 * lo que encontró (REG-268): seis formas de decir el pasado que el motor no
 * cazaba, y —lo que importa más— una forma de decir el PRESENTE que marcaba como
 * pasado.
 *
 * ── DATOS 100 % SINTÉTICOS ───────────────────────────────────────────────────
 *
 * Frases inventadas, sin paciente, sin nombre, sin fecha real. Regla 2 de la
 * carta operativa y `.claude/rules/data-privacy.md`: ni en pruebas, ni en
 * fixtures, ni en corpus de evaluación.
 *
 * ── CÓMO SE AMPLÍA ───────────────────────────────────────────────────────────
 *
 * Cada frase nueva se añade **con su etiqueta puesta a mano**, nunca con la que
 * devuelva el motor. Un corpus que se etiqueta con la salida del sistema medido
 * sólo sabe decir que el sistema no ha cambiado.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · Es corpus de **texto**, no de audio: no mide lo que el reconocedor oyó mal.
 * · Es de frase suelta. La frase con dos padecimientos en tiempos distintos
 *   («tuvo neumonía hace tres años y tiene diabetes») queda fuera: el motor
 *   trabaja por oración y etiquetarla exigiría decidir por padecimiento, que es
 *   otro motor y otra decisión.
 * · No cubre el futuro más allá de un caso testigo: en el futuro no hay nada que
 *   corregir.
 * · No mide el vocabulario — que falte un padecimiento es un hueco declarado en
 *   el módulo, no un fallo de temporalidad.
 */

/** Una frase del corpus con la etiqueta que le puso una persona. */
export interface CasoTemporal {
  frase: string
  /** Qué familia de la gramática representa — para leer los fallos agrupados. */
  familia: string
}

/**
 * Frases que un lector humano lee en PASADO.
 *
 * Agrupadas por la marca gramatical que lo dice, que es lo que el motor mira.
 */
export const CORPUS_PASADO: readonly CasoTemporal[] = [
  // El pretérito y el copretérito — la forma más directa.
  { frase: 'Tuvo neumonía hace tres años.', familia: 'pretérito' },
  { frase: 'Padeció dengue en 2019.', familia: 'pretérito' },
  { frase: 'Sufrió una trombosis venosa profunda después de un viaje largo.', familia: 'pretérito' },
  { frase: 'Tenía asma de niño.', familia: 'copretérito' },
  { frase: 'Presentó hemorragia digestiva en el 2020.', familia: 'pretérito' },
  { frase: 'Hace un año tuvo pancreatitis.', familia: 'pretérito' },
  { frase: 'Hace un mes tuvo cistitis.', familia: 'pretérito' },
  { frase: 'Anteriormente tuvo epilepsia.', familia: 'pretérito' },
  { frase: 'En el pasado tuvo hepatitis.', familia: 'pretérito' },

  // La voz pasiva, que es como se cuenta lo que le hicieron en un hospital.
  { frase: 'Fue operado de apendicectomía a los quince años.', familia: 'pasiva' },
  { frase: 'Fue hospitalizada por COVID en 2021.', familia: 'pasiva' },
  { frase: 'Fue diagnosticado de tuberculosis hace diez años.', familia: 'pasiva' },
  { frase: 'Fue intervenida de la vesícula el año pasado.', familia: 'pasiva' },

  // El infinitivo compuesto — «refiere haber tenido», dictado de interrogatorio.
  { frase: 'Refiere haber tenido tuberculosis hace diez años.', familia: 'infinitivo compuesto' },
  { frase: 'De la infancia recuerda haber padecido hepatitis.', familia: 'infinitivo compuesto' },
  { frase: 'Niega haber sufrido un evento vascular cerebral.', familia: 'infinitivo compuesto' },

  // Lo que le quitaron o lo que se le quitó.
  { frase: 'Le operaron de la vesícula hace dos años.', familia: 'resuelto' },
  { frase: 'Ya se le quitó la infección urinaria.', familia: 'resuelto' },
  { frase: 'Le extirparon un tumor maligno en 2017.', familia: 'resuelto' },

  // La marca de cuándo, sin verbo que la acompañe.
  { frase: 'Cáncer hace cinco años.', familia: 'marca de tiempo' },
  { frase: 'Tuberculosis en 2018.', familia: 'marca de tiempo' },
  { frase: 'Epilepsia años atrás.', familia: 'marca de tiempo' },
  { frase: 'Neumonía el invierno pasado.', familia: 'marca de tiempo' },
  { frase: 'Pancreatitis hace un mes.', familia: 'marca de tiempo' },
  { frase: 'Le dio COVID el año pasado.', familia: 'marca de tiempo' },
  { frase: 'Se fracturó la cadera el año pasado.', familia: 'marca de tiempo' },
  { frase: 'Cistitis la semana pasada, ya tratada.', familia: 'marca de tiempo' },
  { frase: 'Dengue el verano pasado.', familia: 'marca de tiempo' },
  { frase: 'Apendicectomía a los veinte años.', familia: 'marca de tiempo' },
  { frase: 'Fractura de tobillo a los 12 años.', familia: 'marca de tiempo' },

  // La edad de la vida en que pasó.
  { frase: 'Asma de niño.', familia: 'edad de la vida' },
  { frase: 'Convulsiones en la infancia.', familia: 'edad de la vida' },
  { frase: 'Hepatitis de la infancia.', familia: 'edad de la vida' },
  { frase: 'Tuberculosis en la juventud.', familia: 'edad de la vida' },
]

/**
 * Frases que un lector humano lee en PRESENTE — las que el motor NO debe marcar.
 *
 * Ésta es la mitad que de verdad importa. Un aviso que salta donde no debe se
 * acaba ignorando, y con él se ignoran los que sí importan: el motor sólo puede
 * señalar de menos, nunca de más.
 */
export const CORPUS_PRESENTE: readonly CasoTemporal[] = [
  // La trampa original: «desde hace» trae marca de tiempo y es presente.
  { frase: 'Desde hace tres años tiene diabetes.', familia: 'desde hace' },
  { frase: 'Desde 2019 tiene hipotiroidismo.', familia: 'desde hace' },
  { frase: 'Padece diabetes desde los treinta años.', familia: 'desde hace' },
  { frase: 'Hipertensión arterial desde hace una década.', familia: 'desde hace' },

  // Los adverbios que dicen que sigue.
  { frase: 'Sigue con hipertensión arterial.', familia: 'adverbio de continuidad' },
  { frase: 'Todavía tiene asma.', familia: 'adverbio de continuidad' },
  { frase: 'Actualmente cursa con neumonía.', familia: 'adverbio de continuidad' },
  { frase: 'Persiste la infección urinaria.', familia: 'adverbio de continuidad' },
  { frase: 'Hoy en día sigue con EPOC.', familia: 'adverbio de continuidad' },
  { frase: 'Continúa con dislipidemia.', familia: 'adverbio de continuidad' },
  { frase: 'En la actualidad permanece con datos de insuficiencia cardiaca.', familia: 'adverbio de continuidad' },

  // Lo que está bajo tratamiento o control: es de ahora.
  { frase: 'Está en tratamiento por tuberculosis.', familia: 'en control' },
  { frase: 'Tiene diabetes en control con metformina.', familia: 'en control' },

  /**
   * EL PADECIMIENTO ACTUAL, contado con su fecha de inicio.
   *
   * Ésta es la familia que destapó el falso positivo de REG-268 y es, con
   * diferencia, la más frecuente de toda la consulta: el motivo de consulta
   * SIEMPRE se dicta con cuánto lleva. «Hace tres días» es la duración de lo que
   * el paciente tiene HOY, no la fecha de algo que ya pasó.
   */
  { frase: 'Hace tres días inició con fiebre y tiene neumonía.', familia: 'padecimiento actual' },
  { frase: 'Tiene neumonía desde hace una semana.', familia: 'padecimiento actual' },
  { frase: 'Presenta infección urinaria de tres días de evolución.', familia: 'padecimiento actual' },
  { frase: 'Hace cinco días presenta disuria y tiene cistitis.', familia: 'padecimiento actual' },
  { frase: 'Cursa con dengue de cuatro días de evolución.', familia: 'padecimiento actual' },
  { frase: 'Hace dos semanas comenzó la tos y tiene bronconeumonía.', familia: 'padecimiento actual' },
  { frase: 'Está con pancreatitis desde hace 48 horas.', familia: 'padecimiento actual' },
  { frase: 'Hace un mes tiene hipertensión mal controlada.', familia: 'padecimiento actual' },

  // El futuro: no hay nada que corregir.
  { frase: 'Lo van a operar de la vesícula el mes que entra.', familia: 'futuro' },
  { frase: 'Se programará cirugía de cadera.', familia: 'futuro' },
]

/**
 * Cuántos casos tiene el corpus, para que un recorte accidental se vea.
 *
 * Un corpus del que desaparece la mitad sigue pasando en verde y deja de medir:
 * es el mismo fallo que el trinquete de voz que no encuentra sus datos
 * (EVAL-003). Aquí el conteo va escrito y la prueba lo compara.
 */
export const TAMANO_ESPERADO = { pasado: 34, presente: 23 } as const
