/**
 * PIPELINE CLÍNICO DE DICTADO — el orquestador.
 *
 * El flujo que pidió el Dr., de principio a fin:
 *
 *   audio
 *     → ASR primario                      · fuera de aquí (rutas /api/expediente)
 *     → detección de especialidad/contexto · lexicon.ts    ┐ ANTES de transcribir
 *     → lexicón médico dinámico            · lexicon.ts    ┘
 *     → corrección léxica + guardián       · corrector-vigilado.ts
 *     → normalización de cifras y unidades · normalizacion.ts
 *     → normalización de siglas            · siglas.ts
 *     → protección de negación             · guardian-sustituciones.ts
 *     → protección de lateralidad          · guardian-sustituciones.ts
 *     → verificación de entidades críticas · aquí
 *     → gate de ambigüedad                 · aquí
 *     → transcript final
 *
 * Las dos primeras etapas van **antes** de llamar al reconocedor: son el
 * vocabulario que se le manda. Las demás trabajan sobre lo que devolvió.
 *
 * ── LAS DOS COSAS QUE HACE EL ORQUESTADOR Y NADIE MÁS ────────────────────────
 *
 * **Vuelve a pasar el guardián al final.** Las etapas de normalización también
 * pueden equivocarse, y son código nuevo. Comparar el texto que salió del
 * guardián contra el texto final detecta que la normalización se comió una sigla
 * crítica, una negación o el lado. Un guardián que sólo mira una etapa protege
 * una etapa.
 *
 * **Decide si hay que preguntar.** Es el gate de ambigüedad: junta lo que
 * encontró cada etapa y lo traduce a los motivos declarados por el Dr. en
 * `MOTIVOS_CONFIRMACION`. Cuando hay uno, la interfaz pregunta — no adivina.
 *
 * Módulo PURO. El crudo nunca se borra.
 */

import { corregirVigilado, alertasDe, type AlertaDictado } from '@/lib/asr/corrector-vigilado'
import { verificar, type Violacion } from '@/lib/asr/guardian-sustituciones'
import { normalizar, type CambioNormalizacion } from '@/lib/asr/normalizacion'
import { normalizarSiglas, type CambioSigla } from '@/lib/asr/siglas'
import type { MotivoConfirmacion } from '@/lib/asr/politica-critica'

export interface EtapaTexto {
  /** Nombre de la etapa, para poder auditar dónde cambió qué. */
  etapa: 'crudo' | 'corregido' | 'cifras-y-unidades' | 'siglas'
  texto: string
}

export interface ResultadoPipeline {
  /** El texto que debe mostrarse y guardarse. */
  texto: string
  /** El transcript tal cual llegó del reconocedor. NUNCA se descarta. */
  crudo: string
  /** El texto después de cada etapa, para auditoría. */
  trazas: EtapaTexto[]
  /** Correcciones léxicas descartadas por tocar algo que no debían. */
  violaciones: Violacion[]
  cambiosNormalizacion: CambioNormalizacion[]
  cambiosSiglas: CambioSigla[]
  /** Lo que hay que enseñarle al médico. */
  alertas: AlertaDictado[]
  /** Gate de ambigüedad: por qué hay que preguntarle. Vacío = no hay que preguntar. */
  motivos: MotivoConfirmacion[]
  requiereConfirmacion: boolean
}

/**
 * Pasa un transcript por todas las etapas posteriores al reconocedor.
 *
 * @param crudo lo que devolvió el ASR, sin tocar.
 */
export function procesarTranscript(crudo: string): ResultadoPipeline {
  const trazas: EtapaTexto[] = [{ etapa: 'crudo', texto: crudo }]

  // ── 1. Corrección léxica, con el guardián delante ───────────────────────
  const vig = corregirVigilado(crudo)
  trazas.push({ etapa: 'corregido', texto: vig.corregido })

  // ── 2. Cifras y unidades ────────────────────────────────────────────────
  const num = normalizar(vig.corregido)
  trazas.push({ etapa: 'cifras-y-unidades', texto: num.texto })

  // ── 3. Siglas ───────────────────────────────────────────────────────────
  const sig = normalizarSiglas(num.texto)
  trazas.push({ etapa: 'siglas', texto: sig.texto })

  // ── 4. Verificación de entidades críticas ───────────────────────────────
  // El guardián, otra vez, sobre el tramo que él no vigiló. Aquí NO se revierte
  // al crudo: si la normalización rompió algo, lo correcto es volver al texto
  // que ya había pasado el guardián, no tirar también la corrección léxica.
  //
  // Que la normalización AÑADA cifras es lo normal —«dos» se vuelve «2»— y el
  // guardián no marca las que aparecen, sólo las que desaparecen. Así que
  // cualquier violación que salga aquí es real.
  const post = verificar(vig.corregido, sig.texto)
  const roto = post.violaciones
  const texto = roto.length > 0 ? vig.corregido : sig.texto

  // ── 5. Gate de ambigüedad ───────────────────────────────────────────────
  const motivos = new Set<MotivoConfirmacion>()
  for (const v of [...vig.violaciones, ...post.violaciones]) {
    if (v.clase === 'volteo_negacion') motivos.add('negacion_incierta')
    else if (v.clase === 'cambio_lateralidad') motivos.add('lateralidad_incierta')
    else if (v.clase === 'cambio_unidad' || v.clase === 'cambio_dosis'
      || v.clase === 'corrimiento_decimal') motivos.add('dosis_o_unidad_ambigua')
    else if (v.clase === 'sustitucion_farmaco') motivos.add('dos_o_mas_farmacos_plausibles')
    else motivos.add('sigla_de_modo_o_dispositivo_incierta')
  }
  if (vig.dosisRotas.length > 0) motivos.add('dosis_o_unidad_ambigua')

  const alertas: AlertaDictado[] = [
    ...alertasDe(vig),
    ...roto.map((v): AlertaDictado => ({
      tipo: 'sustitucion',
      titulo: `La normalización alteró «${v.antes}»`,
      detalle: `${v.mensaje} Se conservó el texto anterior a esa etapa.`,
    })),
  ]

  return {
    texto,
    crudo,
    trazas,
    violaciones: [...vig.violaciones, ...roto],
    cambiosNormalizacion: num.cambios,
    cambiosSiglas: sig.cambios,
    alertas,
    motivos: [...motivos],
    requiereConfirmacion: motivos.size > 0,
  }
}

export const POR_QUE_SE_VUELVE_A_VERIFICAR =
  'La normalización de cifras, unidades y siglas también puede equivocarse, y es ' +
  'código nuevo. El guardián se pasa otra vez al final, comparando contra el texto ' +
  'que él ya había aprobado: si una etapa posterior se come una sigla crítica, una ' +
  'negación o el lado del paciente, se vuelve a ese texto. Un guardián que sólo ' +
  'mira una etapa protege una etapa.'
