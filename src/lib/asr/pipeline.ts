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

import { type CambioTranscripcion } from '@/lib/expediente/medical-vocabulary'
import { corregirVigilado, cambiosDescartados, alertasDe, type AlertaDictado } from '@/lib/asr/corrector-vigilado'
import { verificar, type Violacion } from '@/lib/asr/guardian-sustituciones'
import { normalizar, type CambioNormalizacion } from '@/lib/asr/normalizacion'
import { normalizarSiglas, type CambioSigla } from '@/lib/asr/siglas'
import type { MotivoConfirmacion } from '@/lib/asr/politica-critica'
import { contradiccionesDeLateralidad, type ContradiccionDeLado } from '@/lib/asr/lateralidad'
import {
  dictaminarSujetoDelDictado,
  type DictamenSujetoDelDictado,
  type OtroPaciente,
} from '@/lib/asr/sujeto-del-dictado'
import type { IdentidadDelPaciente } from '@/lib/asr/aprendizaje'

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
  /**
   * Correcciones LÉXICAS aplicadas (fármacos mal transcritos, etc.).
   *
   * Se exponen porque la consulta las enseña y deja deshacerlas: una corrección
   * que el médico no puede ver ni revertir es una edición que alguien le hizo a
   * su dictado sin decírselo.
   */
  cambiosLexicos: CambioTranscripcion[]
  /**
   * Lo que el corrector QUISO cambiar y el guardián le tiró.
   *
   * Cuando el guardián revierte, `cambiosLexicos` viene vacío —correcto: no se
   * anuncia como hecha una corrección que no se aplicó—, pero entonces el
   * médico no ve NADA, y no se entera de que sobre su dictado se intentó una
   * corrección y se rechazó. «Nada cambia en silencio» (regla 3) vale también
   * para lo que no cambió: saber que el guardián frenó algo es lo que le dice
   * dónde volver a escuchar.
   */
  cambiosDescartados: CambioTranscripcion[]
  cambiosNormalizacion: CambioNormalizacion[]
  cambiosSiglas: CambioSigla[]
  /** Lo que hay que enseñarle al médico. */
  alertas: AlertaDictado[]
  /**
   * Contradicciones de lado DENTRO del dictado (MO-001/MO-002): la misma región
   * con los dos lados, o «perdón / corrijo» junto a un lado. Van aparte de las
   * violaciones porque no las produjo ninguna etapa: las dijo el médico.
   */
  contradiccionesDeLado: ContradiccionDeLado[]
  /**
   * ¿De quién es este dictado? (B-013). `undefined` cuando el llamador no pasó
   * la identidad del expediente abierto: entonces NO se comprueba, y eso es
   * distinto de haber comprobado y no haber encontrado nada.
   */
  sujeto?: DictamenSujetoDelDictado
  /** Gate de ambigüedad: por qué hay que preguntarle. Vacío = no hay que preguntar. */
  motivos: MotivoConfirmacion[]
  requiereConfirmacion: boolean
}

/**
 * Pasa un transcript por todas las etapas posteriores al reconocedor.
 *
 * La conversión del Voice Engine a Clinical Truth NO ocurre aquí: pertenece a la
 * frontera de integración de Consultorio. Mantenerla separada evita que un pipeline
 * de texto puro fabrique o transporte autoridad clínica que no posee.
 *
 * @param crudo lo que devolvió el ASR, sin tocar.
 * @param contexto identidad del expediente ABIERTO y otros pacientes plausibles
 *   (la agenda del día, los atendidos recientes). Opcional: sin él la compuerta
 *   de sujeto no corre, y su ausencia se nota porque `sujeto` viene `undefined`.
 */
export function procesarTranscript(
  crudo: string,
  contexto?: { pacienteAbierto?: IdentidadDelPaciente; otrosPacientes?: readonly OtroPaciente[] },
): ResultadoPipeline {
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

  // ── 5-bis. Lateralidad contradictoria en el propio dictado ─────────────
  // El corrector no toca «derecho» ni «izquierdo», así que el motivo de
  // lateralidad sólo podía salir de una etapa que nunca lo producía. Aquí se
  // mira lo que el médico DIJO: dos lados para la misma región, o una
  // retractación. No se decide cuál vale; se pregunta.
  const contradiccionesDeLado = contradiccionesDeLateralidad(texto)
  if (contradiccionesDeLado.length > 0) motivos.add('lateralidad_contradictoria')

  // ── 5-ter. ¿De quién es este dictado? (B-013) ──────────────────────────
  // Un laboratorio no se archiva por tener un expediente abierto: se compara el
  // nombre y se pregunta. Un dictado sí se archivaba. Aquí se compara igual.
  //
  // Sólo corre cuando el llamador dice a QUIÉN tiene abierto: sin eso no hay
  // con qué comparar, y `sujeto` se queda `undefined` para que se vea que no se
  // comprobó. Ausencia de comprobación no es comprobación en verde.
  //
  // Se PREGUNTA, no se bloquea: `sin_nombre` —el caso normal, porque la mayoría
  // de las consultas no dicen el apellido en voz alta— no levanta ningún motivo.
  const sujeto = contexto?.pacienteAbierto
    ? dictaminarSujetoDelDictado(texto, contexto.pacienteAbierto, contexto.otrosPacientes ?? [])
    : undefined
  if (sujeto?.veredicto === 'nombra_a_otro') motivos.add('paciente_nombrado_no_coincide')

  const alertas: AlertaDictado[] = [
    ...alertasDe(vig),
    ...roto.map((v): AlertaDictado => ({
      tipo: 'sustitucion',
      titulo: `La normalización alteró «${v.antes}»`,
      detalle: `${v.mensaje} Se conservó el texto anterior a esa etapa.`,
    })),
    ...(sujeto?.veredicto === 'nombra_a_otro'
      ? [{
        tipo: 'sustitucion' as const,
        titulo: 'El dictado nombra a otro paciente',
        detalle: `${sujeto.texto} Confirma de quién es esta consulta antes de archivarla.`,
      }]
      : []),
    ...contradiccionesDeLado.map((c): AlertaDictado => ({
      tipo: 'lateralidad',
      titulo: c.region
        ? `Se dictaron ${c.lados.length > 1 ? 'los dos lados' : 'un lado con corrección'} para ${c.region}`
        : 'Se dictó una corrección de lado',
      detalle: `«${c.frase}». Se conserva el último dictado (${c.ultima}); confirma el lado antes de firmar.`,
    })),
  ]

  return {
    texto,
    crudo,
    trazas,
    violaciones: [...vig.violaciones, ...roto],
    // Si el guardián revirtió, `vig.cambios` ya viene vacío: no se anuncian como
    // hechas correcciones que no se aplicaron.
    cambiosLexicos: vig.cambios,
    cambiosDescartados: cambiosDescartados(vig),
    cambiosNormalizacion: num.cambios,
    cambiosSiglas: sig.cambios,
    contradiccionesDeLado,
    sujeto,
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
