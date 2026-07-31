/**
 * CORRECTOR VIGILADO — el corrector léxico de siempre, con el guardián delante.
 *
 * ── POR QUÉ ENVUELVE Y NO REEMPLAZA ──────────────────────────────────────────
 *
 * `corregirTranscripcion()` funciona: une lo que Whisper parte («em pagli
 * flozina» → «empagliflozina»), arregla confusiones medidas en el corpus y
 * expande siglas. Tirarlo para poner un pipeline nuevo sería cambiar algo que
 * sirve por algo sin medir.
 *
 * Lo que le faltaba no era capacidad: era **alguien que mirara su salida**. El
 * corrector ya anotaba cada cambio en `cambios[]` — y nadie los leía, así que
 * durante meses se comió dosis en producción sin que nada avisara (REG-065).
 *
 * Esto es ese alguien. Misma entrada, misma salida, más un veredicto.
 *
 * ── CONTRATO ─────────────────────────────────────────────────────────────────
 *
 * `corregido` es lo que debe usarse: la corrección si pasó el guardián, y el
 * **texto crudo** si no pasó. `crudo` siempre está disponible — nunca se borra el
 * transcript original, es la regla nº 5 del paquete del Dr.
 *
 * Módulo PURO.
 */

import {
  corregirTranscripcion,
  type CambioTranscripcion, type ResultadoCorreccion,
} from '@/lib/expediente/medical-vocabulary'
import { verificar, type Violacion } from '@/lib/asr/guardian-sustituciones'
import { dosisSinNumero, type DosisRota } from '@/lib/uci/dosis-sin-numero'

export interface ResultadoVigilado extends ResultadoCorreccion {
  /** El transcript tal cual llegó del reconocedor. NUNCA se descarta. */
  crudo: string
  /** Lo que el corrector había propuesto, aunque se haya revertido. */
  propuesto: string
  /** `true` si el guardián descartó la corrección. */
  revertido: boolean
  violaciones: Violacion[]
  /** Unidades de dosis que se quedaron sin cantidad delante. */
  dosisRotas: DosisRota[]
  /** La pantalla debe pedirle confirmación al médico. */
  requiereConfirmacion: boolean
}

/**
 * Corrige y vigila.
 *
 * @param texto lo que devolvió el reconocedor.
 */
export function corregirVigilado(texto: string): ResultadoVigilado {
  const { corregido, cambios } = corregirTranscripcion(texto)
  const v = verificar(texto, corregido)

  // La dosis sin número se busca en el texto QUE SE VA A USAR: si el guardián
  // revirtió, el que importa es el crudo.
  const dosisRotas = dosisSinNumero(v.texto)

  return {
    corregido: v.texto,
    // Si se revirtió, los cambios no se aplicaron: no se anuncian como hechos.
    cambios: v.revertido ? [] : cambios,
    crudo: texto,
    propuesto: corregido,
    revertido: v.revertido,
    violaciones: v.violaciones,
    dosisRotas,
    requiereConfirmacion: v.requiereConfirmacion || dosisRotas.length > 0,
  }
}

/**
 * Lo que hay que enseñarle al médico, ya aplanado.
 *
 * La pantalla no debe razonar sobre clases de error ni sobre estructuras: recibe
 * una lista de avisos con título y explicación, y los muestra.
 */
export interface AlertaDictado {
  tipo: 'sustitucion' | 'dosis-sin-cantidad'
  titulo: string
  detalle: string
}

export function alertasDe(r: ResultadoVigilado): AlertaDictado[] {
  return [
    ...r.violaciones.map((v): AlertaDictado => ({
      tipo: 'sustitucion',
      titulo: v.despues === '—'
        ? `Se descartó una corrección que borraba «${v.antes}»`
        : `Se descartó una corrección: «${v.antes}» → «${v.despues}»`,
      detalle: `${v.mensaje} Se conservó lo que usted dictó; revise esa parte.`,
    })),
    ...r.dosisRotas.map((d): AlertaDictado => ({
      tipo: 'dosis-sin-cantidad',
      titulo: `Falta la cantidad en «${d.antes} ${d.unidad}»`,
      detalle: d.mensaje,
    })),
  ]
}

/** Los cambios que el corrector propuso y el guardián tiró. Para auditoría. */
export function cambiosDescartados(r: ResultadoVigilado): CambioTranscripcion[] {
  if (!r.revertido) return []
  return corregirTranscripcion(r.crudo).cambios
}

export const POR_QUE_VIGILADO =
  'El corrector léxico no se reemplaza: se vigila. Cada corrección se compara ' +
  'contra el texto crudo y se descarta si toca una cifra, una unidad, una sigla ' +
  'crítica, una negación o la lateralidad. El transcript crudo nunca se borra.'
