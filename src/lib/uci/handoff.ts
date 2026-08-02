/**
 * ICU HANDOFF — charter §36.
 *
 *   «Generar ICU HANDOFF con: identificación · problemas activos · soportes ·
 *    cambios · pendientes · contingencias · dispositivos.
 *
 *    **Siempre revisado por médico.**»
 *
 * ── LA REGLA VIVE EN EL TIPO, NO EN UN COMENTARIO ────────────────────────────
 *
 * Un handoff nace `BORRADOR` y **no hay forma de construirlo `REVISADO`**: sólo
 * `marcarRevisado()` cambia el estado, y exige quién y cuándo. Un comentario que
 * dijera «recuerda revisarlo» se ignora; un tipo que no te deja, no.
 *
 * Esto importa más aquí que en cualquier otro módulo: el handoff es el documento
 * que se lee cuando el que conoce al paciente **ya se fue**. Un error que pase el
 * cambio de turno se propaga a un equipo que no tiene con quién contrastarlo.
 *
 * ── LO QUE ARMA Y LO QUE NO ──────────────────────────────────────────────────
 *
 * ARMA, de datos reales que ya existen: identificación, soportes activos
 * (`ICUStay`), cambios (`morning-brief`), pendientes (`metas-diarias`) y
 * dispositivos.
 *
 * **NO INVENTA** dos secciones:
 *  · **problemas activos** — la lista de problemas es una síntesis clínica, no
 *    un volcado de diagnósticos;
 *  · **contingencias** — «si la MAP baja de X, hacer Y» es un plan que redacta
 *    el médico. Sugerirlas sería dar indicación terapéutica.
 *
 * Las dos van vacías **y declaradas como vacías**, con el motivo. Un hueco en un
 * handoff se lee como «no hay nada», y en «contingencias» eso es peligroso.
 *
 * Módulo PURO.
 */

import type { SoporteActivo } from '@/types/hospital'

export type EstadoHandoff = 'BORRADOR' | 'REVISADO'

/** Una sección que no se pudo llenar, con el porqué. Nunca se calla. */
export interface SeccionAusente {
  seccion: string
  motivo: string
}

export interface Handoff {
  /** Nace BORRADOR. Sólo `marcarRevisado` lo cambia. */
  estado: EstadoHandoff
  generadoEn: string

  // ── Identificación ──
  pacienteId: string
  cama: string | null
  diaUci: number | null
  diaVm: number | null

  // ── De datos reales ──
  soportes: SoporteActivo[]
  cambios: string[]
  pendientes: string[]
  dispositivos: string[]

  // ── Del médico, nunca del sistema ──
  problemasActivos: string[]
  contingencias: string[]

  /** Todo lo que quedó vacío y por qué. */
  ausentes: SeccionAusente[]

  revisadoPor?: string
  revisadoEn?: string
}

export interface EntradaHandoff {
  pacienteId: string
  generadoEn: string
  cama?: string | null
  diaUci?: number | null
  diaVm?: number | null
  soportes?: readonly SoporteActivo[]
  /** Ya redactados por `morning-brief`. */
  cambios?: readonly string[]
  /** Ya redactados por `metas-diarias`. */
  pendientes?: readonly string[]
  dispositivos?: readonly string[]
  /** Sólo si el médico los escribió. */
  problemasActivos?: readonly string[]
  contingencias?: readonly string[]
}

export const MOTIVO_PROBLEMAS_VACIOS =
  'La lista de problemas activos la redacta el médico: es una síntesis clínica, ' +
  'no un volcado de diagnósticos. El sistema no la propone.'

export const MOTIVO_CONTINGENCIAS_VACIAS =
  'Las contingencias («si la MAP baja de X, hacer Y») son un plan terapéutico ' +
  'que redacta el médico. Sugerirlas sería dar indicación de tratamiento.'

/**
 * Arma el handoff. **Siempre nace BORRADOR.**
 *
 * Cada sección vacía se declara en `ausentes` con su motivo, distinguiendo «no
 * se documentó» de «no lo propone el sistema». En un handoff, un hueco silencioso
 * se lee como «no hay nada».
 */
/**
 * Secciones que HOY no tienen quién las alimente en la aplicación.
 *
 * No es lo mismo «se revisó y no hay» que «el sistema no lo sabe». La tarjeta
 * imprimía «No hay dispositivos invasivos registrados» en un paciente con
 * catéter central y ventilador, porque nadie escribe esa sección — y eso, en una
 * entrega de turno, se lee como una afirmación clínica del que entrega.
 */
export type SeccionSinFuente = 'pendientes' | 'dispositivos' | 'cambios' | 'soportes'

const MOTIVO_SIN_FUENTE =
  'El sistema todavía no registra esta sección: NO significa que no haya. ' +
  'Pregúntalo en la entrega.'

export function construirHandoff(e: EntradaHandoff, sinFuente: readonly SeccionSinFuente[] = []): Handoff {
  if (Number.isNaN(Date.parse(e.generadoEn))) {
    throw new Error(`construirHandoff: fecha inválida «${e.generadoEn}»`)
  }

  const ausentes: SeccionAusente[] = []
  const anota = (seccion: string, motivo: string) => ausentes.push({ seccion, motivo })

  const soportes = [...(e.soportes ?? [])]
  const cambios = [...(e.cambios ?? [])]
  const pendientes = [...(e.pendientes ?? [])]
  const dispositivos = [...(e.dispositivos ?? [])]
  const problemasActivos = [...(e.problemasActivos ?? [])]
  const contingencias = [...(e.contingencias ?? [])]

  /**
   * Una sección declarada SIN FUENTE nunca afirma ausencia: dice que el sistema
   * no la sabe. Afirmar «no hay dispositivos invasivos» sobre una sección que
   * nadie escribe es poner en boca del que entrega algo que no comprobó.
   */
  const noSabe = new Set<string>(sinFuente)
  const motivoDe = (seccion: SeccionSinFuente, siHayFuente: string) =>
    noSabe.has(seccion) ? MOTIVO_SIN_FUENTE : siHayFuente

  if (soportes.length === 0) anota('soportes', motivoDe('soportes', 'No hay soportes activos registrados en la estancia.'))
  if (cambios.length === 0) anota('cambios', motivoDe('cambios', 'No hay cambios documentados en la ventana del reporte.'))
  if (pendientes.length === 0) anota('pendientes', motivoDe('pendientes', 'No hay metas incumplidas ni tareas abiertas.'))
  if (dispositivos.length === 0) anota('dispositivos', motivoDe('dispositivos', 'No hay dispositivos invasivos registrados.'))
  if (problemasActivos.length === 0) anota('problemas activos', MOTIVO_PROBLEMAS_VACIOS)
  if (contingencias.length === 0) anota('contingencias', MOTIVO_CONTINGENCIAS_VACIAS)

  if (e.cama == null) anota('cama', 'No hay asignación de cama vigente.')
  if (e.diaUci == null) anota('día de UCI', 'No se pudo calcular: falta la fecha de ingreso a UCI.')
  if (e.diaVm == null && soportes.includes('vm_invasiva')) {
    anota('día de ventilación', 'El paciente está en ventilación invasiva pero no consta el día de inicio.')
  }

  return {
    estado: 'BORRADOR',
    generadoEn: e.generadoEn,
    pacienteId: e.pacienteId,
    cama: e.cama ?? null,
    diaUci: e.diaUci ?? null,
    diaVm: e.diaVm ?? null,
    soportes, cambios, pendientes, dispositivos,
    problemasActivos, contingencias,
    ausentes,
  }
}

/**
 * ÚNICA forma de que un handoff quede `REVISADO`.
 *
 * No muta el original: devuelve una copia. Así el borrador que se generó queda
 * como estaba y la revisión es un hecho aparte, con su autor.
 */
export function marcarRevisado(h: Handoff, por: string, enIso: string): Handoff {
  if (por.trim() === '') {
    throw new Error('marcarRevisado: la revisión exige un médico identificado (charter §36)')
  }
  if (Number.isNaN(Date.parse(enIso))) {
    throw new Error(`marcarRevisado: fecha inválida «${enIso}»`)
  }
  return { ...h, estado: 'REVISADO', revisadoPor: por, revisadoEn: enIso }
}

/**
 * ¿Se puede entregar el turno con esto?
 *
 * Sólo si un médico lo revisó. Que falten secciones NO lo impide —un paciente
 * puede no tener dispositivos— pero que nadie lo haya leído, sí.
 */
export function listoParaEntregar(h: Handoff): { listo: boolean; motivo?: string } {
  if (h.estado !== 'REVISADO') {
    return { listo: false, motivo: 'El handoff no ha sido revisado por un médico (charter §36).' }
  }
  return { listo: true }
}

/** Secciones que el MÉDICO tiene que escribir antes de entregar. */
export function loQueFaltaDelMedico(h: Handoff): string[] {
  const faltan: string[] = []
  if (h.problemasActivos.length === 0) faltan.push('problemas activos')
  if (h.contingencias.length === 0) faltan.push('contingencias')
  return faltan
}
