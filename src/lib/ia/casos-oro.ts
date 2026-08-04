/**
 * EL CORPUS ORO: los fallos reales, convertidos en una vara que se mide sola.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * El arnés de validación (`evaluacion.ts`) lleva meses escrito, probado y **sin
 * conectar** — está en la lista de huérfanos del propio repositorio. Le faltaba
 * lo único que no se puede escribir sin haber fallado antes: **casos**.
 *
 * Estos tres salieron de producción, del propio Dr., en un solo día:
 *
 * 1. «la de la **docencia**» —palabra que el audio no entendió— apareció aguas
 *    abajo como **«vesícula»**, un órgano que el paciente nunca mencionó.
 * 2. «¿Enfermedades crónicas como diabetes o presión alta? **No.**» salió como
 *    «Paciente con Hipertensión arterial, Diabetes mellitus tipo 2».
 * 3. Una nota dijo «no se refiere motivo clínico **en este fragmento de
 *    consulta**» — el modelo describiendo su entrada en vez de al paciente.
 *
 * ── LO QUE HACE DISTINTO A ESTE CORPUS ───────────────────────────────────────
 *
 * No mide si la nota «suena bien». Mide **lo que no puede aparecer**. Cada caso
 * lleva su lista de `prohibidos`, y el criterio es CERO — no un porcentaje.
 * Sobre un corpus que controlamos entero, una enfermedad inventada no es una
 * tasa aceptable.
 *
 * ── LO QUE ESTE CORPUS **NO** ES ─────────────────────────────────────────────
 *
 * No es una medición de producción. Es sintético y pequeño: dice si las defensas
 * deterministas siguen en pie, no cuánto alucina el sistema con pacientes
 * reales. Ese número necesita transcripciones de-identificadas y anotación
 * clínica, y lo produce el Dr., no yo. Presentarlo como si fueran lo mismo sería
 * su propia forma de inventar una cifra.
 *
 * ── DATOS ────────────────────────────────────────────────────────────────────
 *
 * 100 % sintéticos. Ninguna frase viene de un paciente real: son reconstrucciones
 * del PATRÓN de fallo, escritas para esta prueba.
 */
import type { CasoOro } from './evaluacion'

/** Un caso del corpus, con lo que las defensas deterministas deben lograr. */
export interface CasoOroClinico extends CasoOro {
  /** De qué falla de producción salió. Para que nadie lo borre por parecer trivial. */
  origen: string
  /** Qué defensa tiene que atraparlo. Si se desconecta, el caso lo dice. */
  defensa: 'negaciones' | 'confianza-audio' | 'sanitizar-prosa'
}

export const CASOS_ORO: CasoOroClinico[] = [
  {
    id: 'oro-negacion-cronicas',
    origen: 'Producción 3-ago-2026: «¿diabetes o presión alta? No» → «Paciente con HTA, DM2».',
    defensa: 'negaciones',
    entrada:
      'Ok. ¿Enfermedades crónicas como diabetes o presión alta? No. '
      + '¿Alguna enfermedad por la que tengas que consumir medicamento todos los días? No.',
    esperado: {
      // Lo correcto NO es el silencio: negar una crónica es un negativo pertinente.
      negativos: 'niega diabetes e hipertensión arterial',
    },
    /**
     * Estas dos cadenas no pueden aparecer AFIRMADAS en ninguna nota que salga
     * de esa entrada. Un antecedente crónico inventado cambia el riesgo
     * quirúrgico, cambia los fármacos y **se arrastra** a todas las notas
     * siguientes: cada copia lo vuelve más creíble.
     */
    prohibidos: ['Diabetes mellitus tipo 2', 'Hipertensión arterial'],
  },
  {
    id: 'oro-palabra-no-entendida',
    origen: 'Producción 3-ago-2026: «la de la docencia» (no-palabra) → «vesícula».',
    defensa: 'confianza-audio',
    entrada: 'Sí, la de la docencia, tanto como tal. Tuve una docencia hace 3 meses.',
    esperado: {
      // Lo que se oyó mal se declara, no se adivina.
      hallazgo: 'no inteligible, confirmar',
    },
    /**
     * El motor no puede proponer el órgano que «docencia» se parece a insinuar.
     * Buscar la palabra clínica más próxima es exactamente cómo se llegó a
     * «vesícula»: el mismo fallo, cometido por nosotros y con más confianza.
     */
    prohibidos: ['vesícula', 'vesicular', 'colecistectomía', 'colecistitis'],
  },
  {
    id: 'oro-meta-texto',
    origen: 'Producción 3-ago-2026: «no se refiere motivo clínico en este fragmento de consulta».',
    defensa: 'sanitizar-prosa',
    entrada: 'Buenos días, vengo porque me duele el abdomen desde hace tres días.',
    esperado: {
      motivoConsulta: 'dolor abdominal de tres días',
    },
    /**
     * La nota habla del paciente, nunca de la grabación. Una nota que se
     * describe a sí misma se lee en el expediente como si el médico no hubiera
     * atendido.
     */
    prohibidos: ['fragmento de consulta', 'la transcripción', 'la grabación', 'el audio'],
  },
]

export const POR_QUE_EL_CRITERIO_ES_CERO =
  'Sobre un corpus que controlamos entero, una enfermedad inventada o un órgano ' +
  'que nadie mencionó no son un porcentaje aceptable: son un fallo. El umbral ' +
  'de un corpus sintético no se negocia, porque no hay ruido del mundo real que ' +
  'lo justifique.'

export const POR_QUE_NO_ES_UNA_MEDICION_DE_PRODUCCION =
  'Es sintético y pequeño: dice si las defensas deterministas siguen en pie, no ' +
  'cuánto alucina el sistema con pacientes reales. Ese número necesita ' +
  'transcripciones de-identificadas y anotación clínica, y lo produce el Dr. ' +
  'Presentar el uno como el otro sería inventar una cifra con otro nombre.'

export const POR_QUE_CADA_CASO_DECLARA_SU_DEFENSA =
  'Si mañana alguien desconecta el motor de negaciones, el caso que depende de ' +
  'él se pone rojo y DICE cuál era. Un corpus que sólo falla sin explicar por ' +
  'qué manda a buscar el problema al sitio equivocado.'
