/**
 * MOTOR DE DOSIFICACIÓN — selecciona la regla, no la inventa.
 *
 * Implementa el `claude_contract` del dataset del Dr., en su orden:
 *
 *   contexto → entradas obligatorias → indicación y gravedad → rama renal/RRT
 *   → escalar de peso → infusión → reglas duras → dosis + fuente + fecha
 *
 * ── LA REGLA QUE ORDENA TODO EL MÓDULO ───────────────────────────────────────
 *
 * Su propio documento lo dice y aquí es literal: **si falta una entrada o el
 * contexto no coincide, se devuelve `SPECIALIST_REVIEW`. Nunca se inventa un
 * número.** No hay interpolación, no hay analogía con otro fármaco, no hay
 * «la mitad de la dosis normal» para diálisis.
 *
 * Ese último caso no es hipotético: está en sus reglas duras porque es un error
 * que se comete —«RRT no equivale a CrCl <10»— y porque un anúrico en CVVHD
 * puede necesitar VARIOS GRAMOS al día mientras la rama de «<10» lo
 * infradosifica gravemente.
 *
 * ── QUÉ DEVUELVE ─────────────────────────────────────────────────────────────
 *
 * El **texto literal** de la regla que aplica, con sus fuentes, la versión del
 * dataset y la fecha de verificación. No una cifra recalculada: la cifra es la
 * que el dataset trae, y el motor sólo decide cuál de las cuatro reglas
 * corresponde a este paciente.
 *
 * Módulo PURO.
 */

import {
  DATASET, buscarFarmaco, fuentesDe, AVISO_SIN_VALIDAR,
  type FarmacoDosis, type EstadoValidacion,
} from '@/lib/dosing/dataset'

/* ════════════════════════════════════════════════════════════════════════
   Entradas
   ════════════════════════════════════════════════════════════════════════ */

/** Modalidad de reemplazo renal. `desconocida` NO es `ninguna`. */
export type ModalidadRRT =
  | 'ninguna' | 'IHD' | 'SLED_PIRRT' | 'CVVH' | 'CVVHD' | 'CVVHDF' | 'desconocida'

/** De qué peso se habla. Sin esto no hay dosis en mg/kg: regla dura global. */
export type EscalarPeso = 'TBW' | 'IBW' | 'AdjBW' | 'no_documentado'

export interface ContextoPaciente {
  /** Nombre del fármaco, en inglés o en español. */
  farmaco: string
  /** Indicación clínica, en las palabras del médico. */
  indicacion?: string
  gravedad?: 'no_grave' | 'grave' | 'choque'
  pesoKg?: number
  escalarPeso?: EscalarPeso
  /** Cockcroft-Gault en mL/min. NO se acepta eGFR en su lugar: regla dura. */
  crClMlMin?: number
  /** ¿La función renal se está moviendo? Una AKI inestable invalida la rama fija. */
  renalInestable?: boolean
  rrt?: ModalidadRRT
  /** Efluente en L/h. Obligatorio en algunos fármacos (cefiderocol). */
  efluenteCrrtLh?: number
  organismo?: string
  micMgL?: number
  /** ¿Es una neumonía? Lo pregunta la regla dura de la daptomicina. */
  esNeumonia?: boolean
  /** ¿Hay sedación y ventilación aseguradas? Lo exige el bloqueador neuromuscular. */
  sedacionYVentilacionAseguradas?: boolean
}

/* ════════════════════════════════════════════════════════════════════════
   Salida
   ════════════════════════════════════════════════════════════════════════ */

export type EstadoRegla = 'CLEAR' | 'BLOCKED' | 'SPECIALIST_REVIEW'

export interface Recomendacion {
  farmaco: string | null
  indicacion: string | null
  /** Qué datos del paciente se usaron de verdad. Para la auditoría. */
  entradasUsadas: Record<string, string | number | boolean>
  /** El texto LITERAL de la regla que aplica. Nunca reescrito. */
  reglaAplicada: string | null
  /** Qué rama se eligió y por qué. */
  rama: 'estándar' | 'renal' | 'reemplazo_renal' | 'cuidado_crítico' | 'ninguna'
  porQueEsaRama: string
  monitoreo: string | null
  /** Reglas duras disparadas: bloquean o mandan a revisión. */
  bloqueos: string[]
  /** Lo que falta para poder decidir. Vacío = no falta nada. */
  faltantes: string[]
  estado: EstadoRegla
  validacion: EstadoValidacion
  avisoValidacion: string
  fuentes: { id: string; titulo: string | null; url: string | null; verificado: string | null }[]
  versionDataset: string
  fechaVerificacion: string
}

/* ════════════════════════════════════════════════════════════════════════
   Reglas duras
   ════════════════════════════════════════════════════════════════════════ */

const n = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/**
 * Comprueba las reglas duras que se pueden decidir con los datos del contexto.
 *
 * Las 12 globales del dataset son prosa dirigida a una persona; aquí se
 * implementan las que tienen una condición comprobable. Las demás viajan como
 * texto en la salida, porque **una regla que el motor no puede comprobar sigue
 * siendo una regla** y esconderla sería peor que no tenerla.
 */
function reglasDuras(f: FarmacoDosis, c: ContextoPaciente): { bloqueos: string[]; falta: string[] } {
  const bloqueos: string[] = []
  const falta: string[] = []
  const nombre = n(f.drug)

  // ── Daptomicina y neumonía. Es un BLOQUEO, no un aviso. ─────────────────
  if (nombre.startsWith('daptomycin')) {
    if (c.esNeumonia === true) {
      bloqueos.push('BLOQUEO: la daptomicina NO se usa para neumonía — el surfactante '
        + 'pulmonar la inactiva. Regla dura del dataset.')
    } else if (c.esNeumonia === undefined) {
      falta.push('¿es una neumonía? La daptomicina tiene un bloqueo para esa indicación')
    }
  }

  // ── mg/kg sin peso documentado ni escalar. ──────────────────────────────
  const esPorKg = /mg\/kg/i.test(f.dose_rule) || /mg\/kg/i.test(f.critical_care_rule)
  if (esPorKg) {
    if (c.pesoKg === undefined) falta.push('peso documentado en kg (la regla es en mg/kg)')
    if (!c.escalarPeso || c.escalarPeso === 'no_documentado') {
      falta.push('escalar de peso explícito: TBW, IBW o AdjBW')
    }
  }

  // ── RRT no es CrCl <10. ─────────────────────────────────────────────────
  if (c.rrt === 'desconocida') {
    falta.push('modalidad de reemplazo renal: IHD, SLED/PIRRT o CVVH/CVVHD/CVVHDF '
      + '(el reemplazo renal NO equivale a CrCl <10)')
  }

  // ── Efluente obligatorio donde el fármaco lo exige. ─────────────────────
  if (/effluent rate/i.test(f.hard_stops) && enRRTContinua(c.rrt) && c.efluenteCrrtLh === undefined) {
    falta.push('tasa de efluente de la CRRT en L/h (este fármaco no admite una dosis única de CRRT)')
  }

  // ── AKI inestable: la rama fija es provisional. ─────────────────────────
  if (c.renalInestable === true) {
    bloqueos.push('REVISIÓN: la función renal está inestable. Una dosis por franja fija '
      + 'es PROVISIONAL — se exige reevaluar la función renal y revisión de farmacia, '
      + 'infectología o UCI.')
  }

  // ── Bloqueador neuromuscular sin sedación asegurada. ────────────────────
  if (/neuromuscular/i.test(f.class) || nombre === 'rocuronium') {
    if (c.sedacionYVentilacionAseguradas !== true) {
      bloqueos.push('BLOQUEO: un bloqueador neuromuscular exige sedación y analgesia '
        + 'adecuadas y soporte ventilatorio confirmados. Regla dura del dataset.')
    }
  }

  return { bloqueos, falta }
}

const enRRTContinua = (m?: ModalidadRRT) =>
  m === 'CVVH' || m === 'CVVHD' || m === 'CVVHDF'

/* ════════════════════════════════════════════════════════════════════════
   Selección de rama
   ════════════════════════════════════════════════════════════════════════ */

interface Rama { rama: Recomendacion['rama']; texto: string; porQue: string }

/**
 * Elige QUÉ regla del fármaco aplica. En el orden del contrato: primero el
 * reemplazo renal, después la función renal, después el contexto crítico.
 *
 * El reemplazo renal va PRIMERO porque es el que más se equivoca: quien está en
 * CVVHD no se dosifica por su CrCl.
 */
function elegirRama(f: FarmacoDosis, c: ContextoPaciente): Rama {
  if (c.rrt && c.rrt !== 'ninguna' && c.rrt !== 'desconocida' && f.rrt_rule.trim()) {
    return {
      rama: 'reemplazo_renal', texto: f.rrt_rule,
      porQue: `El paciente está en ${c.rrt}. La rama de reemplazo renal manda sobre la `
        + 'de función renal: el filtro elimina fármaco y el CrCl ya no describe el aclaramiento.',
    }
  }
  if (c.gravedad === 'choque' && f.critical_care_rule.trim()) {
    return {
      rama: 'cuidado_crítico', texto: f.critical_care_rule,
      porQue: 'Contexto de choque: aplica la regla de paciente crítico del dataset.',
    }
  }
  if (c.crClMlMin !== undefined && f.renal_rule.trim()
      && !/no renal dose table/i.test(f.renal_rule)) {
    return {
      rama: 'renal', texto: `${f.dose_rule}\n\n${f.renal_rule}`,
      porQue: `Ajuste por función renal (CrCl ${c.crClMlMin} mL/min).`,
    }
  }
  return {
    rama: 'estándar', texto: f.dose_rule,
    porQue: 'Sin reemplazo renal ni contexto crítico declarados: regla estándar.',
  }
}

/* ════════════════════════════════════════════════════════════════════════
   Entrada pública
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Devuelve la regla de dosificación que aplica a este paciente.
 *
 * @param c contexto clínico. Lo que falte se declara, no se supone.
 * @returns la recomendación. `estado` dice si se puede usar:
 *   `CLEAR` regla encontrada y sin bloqueos · `BLOCKED` una regla dura lo impide
 *   · `SPECIALIST_REVIEW` falta un dato o no hay coincidencia exacta.
 */
export function recomendar(c: ContextoPaciente): Recomendacion {
  const base = {
    versionDataset: DATASET.version,
    fechaVerificacion: DATASET.release_date,
    validacion: 'sin_validar' as EstadoValidacion,
    avisoValidacion: AVISO_SIN_VALIDAR,
  }

  const f = buscarFarmaco(c.farmaco)
  if (!f) {
    return {
      ...base, farmaco: null, indicacion: c.indicacion ?? null,
      entradasUsadas: { farmaco: c.farmaco },
      reglaAplicada: null, rama: 'ninguna',
      porQueEsaRama: 'El fármaco no está en el dataset.',
      monitoreo: null, bloqueos: [],
      faltantes: [`«${c.farmaco}» no está entre los ${DATASET.drugs.length} fármacos del `
        + 'dataset. NO se deduce de otro parecido: cada fármaco tiene su farmacocinética, '
        + 'su aclaramiento por filtro y su objetivo PK/PD.'],
      estado: 'SPECIALIST_REVIEW', fuentes: [],
    }
  }

  const { bloqueos, falta } = reglasDuras(f, c)
  const rama = elegirRama(f, c)

  const entradasUsadas: Record<string, string | number | boolean> = { farmaco: f.drug }
  if (c.indicacion) entradasUsadas.indicacion = c.indicacion
  if (c.gravedad) entradasUsadas.gravedad = c.gravedad
  if (c.pesoKg !== undefined) entradasUsadas.pesoKg = c.pesoKg
  if (c.escalarPeso) entradasUsadas.escalarPeso = c.escalarPeso
  if (c.crClMlMin !== undefined) entradasUsadas.crClMlMin = c.crClMlMin
  if (c.rrt) entradasUsadas.rrt = c.rrt
  if (c.efluenteCrrtLh !== undefined) entradasUsadas.efluenteCrrtLh = c.efluenteCrrtLh
  if (c.micMgL !== undefined) entradasUsadas.micMgL = c.micMgL
  if (c.organismo) entradasUsadas.organismo = c.organismo

  // Un BLOQUEO gana sobre todo lo demás; después, lo que falta.
  const bloqueado = bloqueos.some(b => b.startsWith('BLOQUEO'))
  const estado: EstadoRegla = bloqueado ? 'BLOCKED'
    : (falta.length > 0 || bloqueos.length > 0) ? 'SPECIALIST_REVIEW'
    : 'CLEAR'

  return {
    ...base,
    farmaco: f.drug,
    indicacion: c.indicacion ?? null,
    entradasUsadas,
    // Un bloqueo NO enseña la dosis: enseñar el número y decir «pero no» es
    // invitar a que alguien lea sólo el número.
    reglaAplicada: bloqueado ? null : rama.texto,
    rama: bloqueado ? 'ninguna' : rama.rama,
    porQueEsaRama: bloqueado ? 'Una regla dura impide dosificar en este contexto.' : rama.porQue,
    monitoreo: f.monitoring || null,
    bloqueos: [...bloqueos, ...(f.hard_stops ? [f.hard_stops] : [])],
    faltantes: falta,
    estado,
    fuentes: fuentesDe(f).map(({ id, fuente }) => ({
      id,
      titulo: fuente?.title ?? null,
      url: fuente?.url ?? null,
      verificado: fuente?.verified ?? null,
    })),
  }
}

export const POR_QUE_NO_CALCULA =
  'El motor elige CUÁL de las cuatro reglas del fármaco aplica y devuelve su ' +
  'texto literal. No recalcula la cifra: la cifra es la del dataset. Y si falta ' +
  'un dato o el contexto no coincide, devuelve SPECIALIST_REVIEW en lugar de un ' +
  'número — que es lo que el propio contrato del Dr. exige.'
