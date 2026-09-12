/**
 * ¿ESTE CASO PIDE EL MOTOR MÁXIMO? — señales DETERMINISTAS, sin modelo (D-062).
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * La nota tiene dos trabajos: ORDENAR lo dictado (extracción, que Sonnet hace
 * igual que Opus a la quinta parte del costo) y RAZONAR el caso difícil
 * (diferencial, coherencia de dosis), donde sí pesa el modelo grande. Pagar
 * razonamiento máximo en una subsecuente de control es pagar inteligencia
 * que no se usa; negárselo a la primera vez con ocho fármacos es escatimar
 * donde importa.
 *
 * El médico no elige motor (D-047): el servidor lo decide. Y lo decide con
 * lo que el parser clínico ya extrae —medicamentos, comorbilidades, tipo de
 * consulta, antibióticos y patógenos—, no con otra llamada a un modelo.
 *
 * ── REGLA DE VOCABULARIO, NO DE CRITERIO ─────────────────────────────────────
 *
 * Que ninguna señal se dispare significa «no se detectó complejidad», NO «el
 * caso es simple». El parser ve fármacos y comorbilidades de su diccionario;
 * un caso complejo dicho con palabras que no están en él se queda en
 * Estándar. Eso es señalar de menos, que es el error barato: la nota sale
 * igual de bien ordenada y el médico puede pedir la segunda opinión.
 *
 * Los umbrales son de ENRUTADO, no clínicos: no deciden nada sobre el
 * paciente, sólo cuánto cómputo se le dedica a redactar su nota.
 */
import type { TipoNota } from '@/types/expediente'
import { parsearTranscripcion, extraerAntibioticosYPatogenos } from './parser-clinico'

export interface SenalesComplejidad {
  /** Fármacos del diccionario preoperatorio del parser (corto a propósito: losartán, estatinas, anticoagulantes…). */
  medicamentos: number
  /** Menciones de una dosis con unidad («500 mg», «10 ml», «20 UI»): no dependen de ningún diccionario. */
  dosisMencionadas: number
  comorbilidades: number
  primeraVez: boolean
  infectologia: boolean
  antimicrobianos: number
  patogenos: number
}

export interface Complejidad {
  compleja: boolean
  /** Por qué se escaló, en palabras que se pueden enseñar al médico. */
  motivos: string[]
  senales: SenalesComplejidad
}

/** Umbrales de enrutado. Cambiarlos aquí cambia cuánto cuesta la nota, no lo que dice. */
export const UMBRALES = {
  /** El diccionario del parser es preoperatorio y corto; tres de esos ya es un paciente con varios frentes. */
  medicamentos: 3,
  /** Cinco dosis con unidad en un dictado es polifarmacia, diga el diccionario lo que diga. */
  dosisMencionadas: 5,
  comorbilidadesEnPrimeraVez: 3,
  antimicrobianosEnInfectologia: 2,
} as const

/** «500 mg», «0.5 mg», «10 ml», «20 UI», «40 mcg». Sólo cuenta; no interpreta. */
const DOSIS_CON_UNIDAD = /\b\d+(?:[.,]\d+)?\s?(?:mg|mcg|µg|ug|g|ml|mL|ui|UI)\b/g

export function contarDosis(texto: string): number {
  return (texto.match(DOSIS_CON_UNIDAD) ?? []).length
}

const TIPOS_PRIMERA_VEZ: readonly string[] = ['historia_clinica', 'primera_vez']

export function esInfectologia(especialidad?: string | null): boolean {
  return /infectolog/i.test(especialidad ?? '')
}

export function evaluarComplejidad(
  transcripcion: string,
  tipo?: TipoNota | string | null,
  especialidad?: string | null,
): Complejidad {
  const texto = (transcripcion ?? '').trim()
  const r = parsearTranscripcion(texto, tipo as TipoNota | undefined)
  const ab = texto ? extraerAntibioticosYPatogenos(texto) : { antibioticos: [], patogenos: [] }
  const senales: SenalesComplejidad = {
    medicamentos: r.medicamentos.length,
    dosisMencionadas: contarDosis(texto),
    comorbilidades: r.comorbilidades.length,
    primeraVez: TIPOS_PRIMERA_VEZ.includes(String(tipo ?? '')),
    infectologia: esInfectologia(especialidad),
    antimicrobianos: ab.antibioticos.length,
    patogenos: ab.patogenos.length,
  }
  const motivos: string[] = []
  if (senales.medicamentos >= UMBRALES.medicamentos || senales.dosisMencionadas >= UMBRALES.dosisMencionadas) {
    motivos.push(`polifarmacia: ${senales.medicamentos} fármacos conocidos y ${senales.dosisMencionadas} dosis en el dictado`)
  }
  if (senales.primeraVez && senales.comorbilidades >= UMBRALES.comorbilidadesEnPrimeraVez) {
    motivos.push(`primera vez con ${senales.comorbilidades} comorbilidades`)
  }
  if (senales.infectologia && senales.antimicrobianos + senales.patogenos >= UMBRALES.antimicrobianosEnInfectologia) {
    motivos.push('caso de infectología con antimicrobianos o patógenos nombrados')
  }
  return { compleja: motivos.length > 0, motivos, senales }
}
