/**
 * CLINICAL DOSE RESOLVER — capa 2 del motor V4.
 *
 * Es la función que sustituye a `if (dose > drug.maxDose)`:
 *
 *     resolveDoseRule({ drug, route, formulation, indication, infectionSite,
 *                       organism, mic, renalFunction, hepaticFunction, weight,
 *                       age, dialysis, crrt, dosingStrategy })
 *
 * ── LO QUE HACE Y LO QUE DELIBERADAMENTE NO HACE ─────────────────────────────
 *
 * **Sí hace:** aplicar las doce reglas del dataset de forma determinista. Decide
 * qué datos EXIGE cada caso antes de que nadie mire una cifra, y devuelve las
 * cuatro capas de dosis con su texto verificado y sus fuentes.
 *
 * **No hace:** convertir la prosa clínica en números. «eGFR 30-49: 2 g q8h;
 * 15-29: 2 g q12h; <15: 1 g q12h» se entrega tal cual. Un fallo de parseo aquí
 * no produce un error visible: produce una dosis distinta que se ve igual de
 * segura que la correcta, y no hay forma de que el médico lo note.
 *
 * ── LA REGLA QUE MÁS TRABAJO HACE ────────────────────────────────────────────
 *
 * `RULE_CRRT_NO_GENERIC`: **la pauta de CrCl <10 no es la pauta de CRRT.** De
 * los 49 fármacos, la mayoría dice literalmente «No automatic CRRT rule». Un
 * motor que ante un anúrico en CVVHDF cayera a la fila de «insuficiencia renal
 * grave» daría una dosis plausible, ordenada y baja — y estaría infradosificando
 * al enfermo más grave de la unidad, que además es el que menos margen tiene.
 * Aquí eso sale como `SPECIALIST_REVIEW`, que es incómodo y es correcto.
 *
 * Módulo PURO.
 */

import {
  buscarFarmaco, candidatos, estaPendiente, type FarmacoV3,
} from '@/lib/antimicrobianos/v4/catalogo'
import type { ContextoResolucion } from '@/lib/antimicrobianos/v4/kernel'
import type { PeticionDosis, Pauta, ReglaDosis } from '@/lib/antimicrobianos/v4/tipos'

export interface Resolucion {
  /** El fármaco del catálogo verificado, si se identificó sin ambigüedad. */
  farmaco: FarmacoV3 | null
  /** Las cuatro capas. No se fusionan. */
  reglaDosis: ReglaDosis
  /** El texto de ajuste que aplica a ESTE paciente (renal, TRR, ARC). */
  ajustes: readonly { que: string; texto: string }[]
  /** Lo que hay que aportar antes de poder resolver. Alimenta al kernel. */
  exige: readonly string[]
  /** Avisos que no bloquean pero que el médico tiene que leer. */
  avisos: readonly { regla: string; texto: string }[]
  /** Si no se pudo resolver, por qué — en una frase accionable. */
  noResuelve?: string
  /** Alternativas cuando el nombre era ambiguo. */
  candidatos?: readonly string[]
  /** Lo que el kernel necesita para juzgar una cifra. */
  contexto: ContextoResolucion
}

const pauta = (texto: string, fuentes: readonly string[]): Pauta | undefined =>
  texto && texto.trim() ? { texto: texto.trim(), fuentes } : undefined

/**
 * ¿Esta entrada trae la dosis de ficha y la de guía metidas en el mismo texto?
 *
 * Se detecta por lo que el propio texto declara: nombra una fuente regulatoria
 * Y una guía en la misma cadena. Es una comprobación de INTEGRIDAD del dato, no
 * un intento de separarlos.
 */
export function fusionadas(f: FarmacoV3): boolean {
  const t = `${f.label_regimen ?? ''}`
  return /\b(fda|label)\b/i.test(t) && /\b(idsa|guideline|guidance)\b/i.test(t)
}

/**
 * Resuelve la regla de dosis para este paciente y este contexto.
 *
 * El orden de las comprobaciones es el orden en que se pierde la seguridad: si
 * no se sabe QUÉ fármaco es, nada de lo demás importa.
 */
export function resolveDoseRule(p: PeticionDosis): Resolucion {
  const vacia: ReglaDosis = {}
  const nombre = (p.farmaco ?? '').trim()

  // 1. ¿Qué fármaco es? Con dos candidatos no se elige por el motor.
  const f = buscarFarmaco(nombre)
  if (!f) {
    const alt = candidatos(nombre).map(c => c.drug)
    if (estaPendiente(nombre)) {
      return {
        farmaco: null, reglaDosis: vacia, ajustes: [], exige: [], avisos: [],
        noResuelve: `«${nombre}» está declarado pendiente de verificar en el dataset. No hay regla ejecutable todavía.`,
        candidatos: alt,
        contexto: { exige: ['regla verificada para este fármaco'] },
      }
    }
    return {
      farmaco: null, reglaDosis: vacia, ajustes: [], exige: [], avisos: [],
      noResuelve: alt.length > 1
        ? `«${nombre}» es ambiguo. Precisa cuál: ${alt.join(', ')}.`
        : `No hay una regla verificada para «${nombre}».`,
      candidatos: alt,
      contexto: { exige: ['regla verificada para este fármaco'] },
    }
  }

  const exige: string[] = []
  const avisos: { regla: string; texto: string }[] = []
  const ajustes: { que: string; texto: string }[] = []
  const fuentes = f.source_ids

  /* ── RULE_SOURCE_SEPARATION: las cuatro capas, sin fusionar ─────────────── */
  const reglaDosis: ReglaDosis = {
    label: pauta(f.label_regimen, fuentes),
    guideline: pauta(f.guideline_regimen, fuentes),
  }
  if (f.label_regimen && f.guideline_regimen && f.label_regimen.trim() !== f.guideline_regimen.trim()) {
    avisos.push({
      regla: 'RULE_SOURCE_SEPARATION',
      texto: 'La pauta de la ficha y la de guía difieren. Se muestran las dos con su contexto; no se fusionan.',
    })
  }
  /**
   * El dataset V3 todavía no cumple su propia regla dura.
   *
   * `RULE_SOURCE_SEPARATION` exige guardar la dosis de ficha y la de guía en
   * campos SEPARADOS. En once de las cuarenta y nueve entradas están fusionadas
   * en una sola cadena —«FDA label: 2.5 g q8h en 2 h; IDSA AMR sugiere 2.5 g q8h
   * en 3 h»— y el mismo texto está copiado en los dos campos. Entre ellas están
   * ceftazidima/avibactam y ceftriaxona, que son justo los dos ejemplos con los
   * que se pidió este motor.
   *
   * El motor NO lo arregla partiendo la frase: separar «2 h» de «3 h» a base de
   * regex es exactamente el parseo con consecuencia clínica que este módulo
   * evita. Lo que hace es DECIRLO, para que la separación la haga quien verifica
   * los datos. Callarlo sería peor que el defecto: la app afirmaría que respeta
   * una regla que su fuente no respeta.
   */
  if (fusionadas(f)) {
    avisos.push({
      regla: 'RULE_SOURCE_SEPARATION',
      texto: 'ATENCIÓN: en esta entrada la pauta de ficha y la de guía vienen fusionadas en un solo texto. '
        + 'Léelas completas: el motor no puede separarlas sin interpretar, y no va a interpretar una dosis.',
    })
  }

  /* ── Un fármaco que no está listo no dosifica solo ──────────────────────── */
  if (f.auto_dose_status !== 'READY') {
    avisos.push({
      regla: 'RULE_HUMAN_OVERSIGHT',
      texto: `Este fármaco está marcado «${f.auto_dose_status}» en el dataset: la pauta se muestra pero no se resuelve automáticamente.`,
    })
  }
  if (!f.source_ids || f.source_ids.length === 0) {
    avisos.push({
      regla: 'RULE_HUMAN_OVERSIGHT',
      texto: 'La entrada no declara fuentes. No se puede mostrar de dónde sale la pauta.',
    })
  }

  /* ── RULE_WEIGHT ────────────────────────────────────────────────────────── */
  const necesitaPeso = /mg\/kg|per kg|\/kg/i.test(f.core_regimen + f.label_regimen + f.guideline_regimen)
  if (necesitaPeso && !(p.paciente?.pesoKg && p.paciente.pesoKg > 0)) {
    exige.push('peso documentado en kg')
  }

  /* ── RULE_RENAL_ESTIMATOR: no se sustituye un estimador por otro ────────── */
  const r = p.paciente?.renal
  const usaEgfr = /egfr/i.test(f.renal_adjustment)
  const usaCrcl = /crcl|cockcroft/i.test(f.renal_adjustment)
  if (f.renal_adjustment && f.renal_adjustment.trim()) {
    ajustes.push({ que: 'renal', texto: f.renal_adjustment })
    if (!r || (r.crcl === undefined && r.egfr === undefined)) {
      exige.push('función renal (CrCl o eGFR según la fuente)')
    } else if (usaEgfr && r.egfr === undefined && r.crcl !== undefined) {
      avisos.push({
        regla: 'RULE_RENAL_ESTIMATOR',
        texto: 'La fuente ajusta por eGFR y sólo se aportó CrCl. No se convierte en silencio: aporta el eGFR o valida la equivalencia.',
      })
    } else if (usaCrcl && r.crcl === undefined && r.egfr !== undefined) {
      avisos.push({
        regla: 'RULE_RENAL_ESTIMATOR',
        texto: 'La fuente ajusta por CrCl (Cockcroft-Gault) y sólo se aportó eGFR. No se convierte en silencio.',
      })
    }
  }

  /* ── RULE_UNSTABLE_AKI ──────────────────────────────────────────────────── */
  if (r?.trayectoria === 'deteriorando' || r?.trayectoria === 'mejorando' || (r?.akiEstadio ?? 0) > 0) {
    avisos.push({
      regla: 'RULE_UNSTABLE_AKI',
      texto: 'La función renal está cambiando: no se mantiene la dosis desde un CrCl único de estado estable. Reevaluar con frecuencia.',
    })
  }

  /* ── RULE_ARC ───────────────────────────────────────────────────────────── */
  if (r?.aclaramientoAumentado || (r?.crcl !== undefined && r.crcl >= 130)) {
    ajustes.push({ que: 'aclaramiento aumentado', texto: f.arc })
    avisos.push({
      regla: 'RULE_ARC',
      texto: /no automatic/i.test(f.arc)
        ? 'Aclaramiento aumentado: este fármaco no declara modificación automática por ARC. El umbral es específico de cada fármaco.'
        : 'Aclaramiento aumentado: ver el ajuste declarado.',
    })
  }

  /* ── RULE_RRT_INPUTS y RULE_CRRT_NO_GENERIC ─────────────────────────────── */
  const trr = p.paciente?.trr
  if (trr?.activa) {
    const esContinua = trr.modalidad !== undefined && ['CVVH', 'CVVHD', 'CVVHDF'].includes(trr.modalidad)
    if (!trr.modalidad) exige.push('modalidad de TRR (IHD / SLED / CVVH / CVVHD / CVVHDF)')
    if (esContinua) {
      if (trr.efluente === undefined) exige.push('efluente efectivo (mL/h)')
      if (trr.funcionRenalResidual === undefined) exige.push('función renal residual')
      if (trr.horasSinTratamiento === undefined) exige.push('horas de parada del circuito en 24 h')
      ajustes.push({ que: 'CRRT', texto: f.crrt })
      /**
       * Aquí es donde un motor descuidado hace daño: caer a la fila de CrCl <10.
       * Da una dosis plausible y baja, y el enfermo que la recibe es el que menos
       * margen tiene.
       */
      if (/no automatic crrt rule/i.test(f.crrt)) {
        avisos.push({
          regla: 'RULE_CRRT_NO_GENERIC',
          texto: 'Este fármaco NO declara regla automática de CRRT. La pauta de CrCl <10 no sirve de sustituto: requiere valoración con evidencia específica del fármaco.',
        })
        exige.push('regla de CRRT específica del fármaco (valoración de especialista)')
      }
    } else {
      ajustes.push({ que: 'diálisis', texto: f.ihd })
    }
  }

  /* ── RULE_MIC_CONTEXT y RULE_AST_VERSION ────────────────────────────────── */
  const m = p.microbiologia
  if (m?.cmi !== undefined) {
    if (!m.estandarAST || !m.versionAST) {
      avisos.push({
        regla: 'RULE_AST_VERSION',
        texto: 'Hay CMI sin declarar el estándar y su versión (CLSI M100 Ed36 o EUCAST v16.1). Los estándares no se mezclan.',
      })
    }
    if (m.cmiOperador && m.cmiOperador !== '=') {
      avisos.push({
        regla: 'RULE_MIC_CONTEXT',
        texto: `La CMI viene censurada («${m.cmiOperador}${m.cmi}»): el valor real está fuera del rango medido y no se puede tratar como un número exacto.`,
      })
    }
  }

  /* ── RULE_TDM ───────────────────────────────────────────────────────────── */
  if (/vancomycin|amikacin|gentamicin|tobramycin|plazomicin/i.test(f.drug)) {
    ajustes.push({ que: 'TDM', texto: f.tdm_pkpd })
    avisos.push({
      regla: 'RULE_TDM',
      texto: 'La monitorización de concentraciones forma parte de la regla de dosificación, no es un dato opcional.',
    })
  }

  /* ── RULE_BETA_LACTAM_INFUSION ──────────────────────────────────────────── */
  if (p.paciente?.sepsisOChoque && /cephalosporin|carbapenem|penicillin|beta-lactam|monobactam/i.test(f.class)) {
    avisos.push({
      regla: 'RULE_BETA_LACTAM_INFUSION',
      texto: 'En sepsis o choque séptico, la infusión prolongada de betalactámicos está respaldada por evidencia aleatorizada.',
    })
  }

  /**
   * `origen` es lo que el kernel usa para clasificar una dosis por encima de lo
   * habitual. Se deriva de la estrategia PEDIDA, no de la magnitud: es la
   * diferencia entre «optimización PK/PD» y «sobredosis».
   */
  const origen: ContextoResolucion['origen'] =
    p.estrategia === 'infusion_extendida' || p.estrategia === 'infusion_continua' || p.estrategia === 'guiada_por_tdm'
      ? 'pkpd'
      : p.estrategia === 'dosis_alta' ? 'guideline' : 'label'

  return {
    farmaco: f,
    reglaDosis,
    ajustes,
    exige: [...new Set(exige)],
    avisos,
    contexto: {
      fuentes,
      nivelVerificacion: f.verification_tier,
      origen,
      exige: [...new Set(exige)],
      // Los límites NO se derivan de la prosa: quien los tenga que cargar es
      // quien verifique el dataset. Sin ellos el kernel responde UNKNOWN, que es
      // la respuesta correcta mientras no existan.
    },
  }
}

export const POR_QUE_LA_PROSA_NO_SE_PARSEA =
  'Convertir «eGFR 30-49: 2 g q8h; 15-29: 2 g q12h» en números es parseo, y un ' +
  'fallo de parseo aquí no produce un error visible: produce una dosis distinta ' +
  'que en pantalla se ve igual de segura que la correcta. El texto verificado se ' +
  'entrega íntegro y la estructura sólo se emite cuando la lectura es inequívoca.'
