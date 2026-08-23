/**
 * LÍMITES DE GASTO — y la línea que no cruzan.
 *
 * #313 §H. El presupuesto puede elegir ENTRE candidatos que ya cumplen el piso
 * de calidad. No puede admitir a uno que no lo cumple. Esa frase es la
 * invariante entera de este módulo y está probada al revés.
 *
 * ── POR QUÉ HACE FALTA DECIRLO TAN FUERTE ────────────────────────────────────
 *
 * Porque la degradación por costo es la forma más silenciosa de bajar la
 * seguridad clínica. No rompe ninguna prueba, no lanza ningún error, y produce
 * exactamente el mismo producto con un modelo peor — el médico no se entera, y
 * el que decidió tampoco, porque lo decidió un umbral en un archivo de
 * finanzas.
 *
 * El repositorio ya tiene una degradación así, y es LEGÍTIMA porque es
 * comercial y visible: `TOPE_ECONOMICO` de `planes-ia.ts` baja a Haiku cuando
 * se acaban los créditos. Lo que aquí se prohíbe es que ese mecanismo pueda
 * atravesar un piso de calidad de una tarea de alta consecuencia.
 *
 * Este módulo NO lleva la cuenta del dinero: eso es `cost-ledger.ts` y
 * `cartera-server.ts`, que ya existen y ya reservan créditos por operación.
 * Aquí sólo se traduce «cómo va el mes» a «qué política de elección aplicar».
 *
 * Módulo PURO.
 */
import type { NivelRiesgo } from '@/lib/ia/router/tareas'

/**
 * Cómo va el gasto. Todo se pasa: este módulo no lee ni el reloj ni la base.
 *
 * Los topes son `null` cuando no están configurados, y `null` **no es cero ni
 * es infinito**: es «no hay tope declarado», y entonces no hay conflicto de
 * presupuesto que resolver. Un tope inventado aquí apagaría la IA de un
 * consultorio por un número que nadie puso.
 */
export interface EstadoPresupuesto {
  /** USD gastados en el periodo. */
  gastoUsd: number
  /** Tope de USD del periodo. `null` = sin tope declarado. */
  topeUsd: number | null
  /** Intentos fallidos consecutivos de esta misma operación. */
  reintentos: number
  /** Tope de reintentos. `null` = sin tope declarado. */
  topeReintentos: number | null
  /** Proporción (0..1) de operaciones que acabaron en segunda opinión. */
  tasaSegundaOpinion: number
  /** Tope de esa proporción. `null` = sin tope declarado. */
  topeTasaSegundaOpinion: number | null
  /**
   * ¿Se detectó un cambio de precio del proveedor no reconciliado?
   *
   * Lo levanta quien compara `TARIFAS.consultado` con la página del proveedor.
   * Aquí sólo se consume: el router no navega a ningún sitio.
   */
  precioCambiadoSinReconciliar?: boolean
}

/** Qué hacer con el presupuesto, sin tocar jamás el piso de calidad. */
export type PoliticaPresupuesto =
  /** Elegir por el criterio normal: mínimo suficiente. */
  | 'normal'
  /** Preferir el más barato de LOS QUE CUMPLEN, y no escalar por muestreo. */
  | 'preferir_barato'
  /** Sólo lo imprescindible: nada de segunda opinión por muestreo ni por incertidumbre débil. */
  | 'solo_lo_esencial'

export type SenalPresupuesto =
  | 'tope_gasto_superado'
  | 'gasto_cerca_del_tope'
  | 'reintentos_excesivos'
  | 'segunda_opinion_excesiva'
  | 'precio_de_proveedor_cambiado'

export interface VeredictoPresupuesto {
  politica: PoliticaPresupuesto
  senales: SenalPresupuesto[]
  /** Frase para el tablero del dueño. Nunca para el médico. */
  resumen: string
}

/**
 * Fracción del tope a partir de la cual se considera «cerca».
 *
 * De MÉTODO, no clínico: sólo cambia el orden de preferencia entre candidatos
 * que ya pasaron la compuerta. Se declara como constante para que se vea que es
 * una elección y no una ley.
 */
export const FRACCION_AVISO = 0.8

export function evaluarPresupuesto(e: EstadoPresupuesto): VeredictoPresupuesto {
  const senales: SenalPresupuesto[] = []

  const superado = e.topeUsd != null && e.gastoUsd >= e.topeUsd
  const cerca = !superado && e.topeUsd != null && e.gastoUsd >= e.topeUsd * FRACCION_AVISO
  if (superado) senales.push('tope_gasto_superado')
  if (cerca) senales.push('gasto_cerca_del_tope')
  if (e.topeReintentos != null && e.reintentos > e.topeReintentos) senales.push('reintentos_excesivos')
  if (e.topeTasaSegundaOpinion != null && e.tasaSegundaOpinion > e.topeTasaSegundaOpinion) {
    senales.push('segunda_opinion_excesiva')
  }
  if (e.precioCambiadoSinReconciliar) senales.push('precio_de_proveedor_cambiado')

  const politica: PoliticaPresupuesto =
    superado || senales.includes('reintentos_excesivos') ? 'solo_lo_esencial'
    : cerca || senales.includes('segunda_opinion_excesiva') || senales.includes('precio_de_proveedor_cambiado')
      ? 'preferir_barato'
      : 'normal'

  return {
    politica, senales,
    resumen: senales.length === 0
      ? 'Gasto dentro de lo previsto.'
      : `Señales activas: ${senales.join(', ')}. La política pasa a «${politica}» y NO cambia el piso de calidad de ninguna tarea.`,
  }
}

/**
 * ¿Puede esta política evitar una segunda opinión OPCIONAL?
 *
 * Sólo las opcionales — muestreo y, con el presupuesto agotado, la
 * incertidumbre débil. La petición explícita del médico, el conflicto y la
 * validación fallida NO se pueden ahorrar: son las que existen porque algo ya
 * salió mal.
 */
export function puedeAhorrarSegundaOpinionOpcional(p: PoliticaPresupuesto): boolean {
  return p !== 'normal'
}

/**
 * LA FUNCIÓN QUE DEJA LA INVARIANTE ESCRITA EN CÓDIGO.
 *
 * Devuelve siempre `false`. No es un hueco por rellenar: es la respuesta, y
 * existe como función con nombre para que cualquiera que en el futuro quiera
 * «degradar por presupuesto» encuentre aquí el sitio donde se dijo que no, y
 * la prueba que lo comprueba. Un comentario se borra; una función con una
 * prueba al revés, no.
 */
export function elPresupuestoPuedeBajarElPiso(_p: PoliticaPresupuesto, _r: NivelRiesgo): false {
  return false
}

/**
 * Qué se le dice al médico cuando el presupuesto limita algo.
 *
 * #313 §K: estados FUNCIONALES, nunca modelos, ni tokens, ni presupuesto. El
 * médico no tiene que enterarse de la contabilidad del consultorio a mitad de
 * una consulta, y menos con la palabra «presupuesto» delante de un paciente.
 */
export function estadoParaElMedico(p: PoliticaPresupuesto): 'disponible' | 'capacidad_limitada' {
  return p === 'solo_lo_esencial' ? 'capacidad_limitada' : 'disponible'
}

export const POR_QUE_EL_PRESUPUESTO_NUNCA_BAJA_EL_PISO =
  'Porque la degradación por costo es la forma más silenciosa de bajar la ' +
  'seguridad clínica: no rompe ninguna prueba, no lanza ningún error, y ' +
  'produce el mismo producto con un modelo peor. El médico no se entera, y el ' +
  'que lo decidió tampoco, porque lo decidió un umbral en un archivo de ' +
  'finanzas. Si no queda ningún candidato que cumpla, la respuesta es un fallo ' +
  'explícito — nunca el más barato de los insuficientes.'
