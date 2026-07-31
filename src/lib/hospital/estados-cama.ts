/**
 * ESTADOS DE CAMA — charter §2, con el flujo de rotación decidido por el Dr.
 *
 * ── LA DECISIÓN (2026-07-30) ─────────────────────────────────────────────────
 *
 * El default seguro **no** es dejar pasar `ocupada → libre`. Tras alta o
 * traslado, el flujo es:
 *
 *     ocupada → limpieza (terminal) → lista (confirmada) → libre
 *
 * y **nunca** `ocupada → libre` por omisión. El Dr. lo fundamenta en las
 * recomendaciones de CDC sobre limpieza y desinfección terminal tras traslado o
 * egreso, con énfasis en UCI y en precauciones basadas en transmisión; la
 * decisión y su fundamento están en `docs/clinical-decisions/estados-cama.md`.
 *
 * Cada hospital **puede** configurarlo (`PoliticaCamas`), pero el default de
 * NexusMED es la limpieza terminal requerida. Un default permisivo se vuelve la
 * práctica real del 90 % de las unidades porque nadie cambia lo que ya funciona.
 *
 * ── EL OVERRIDE EXISTE, PERO DEJA HUELLA ─────────────────────────────────────
 *
 * Una UCI llena a las 3 de la mañana necesita poder saltarse el paso. Por eso
 * hay override de emergencia — pero **sólo** para usuario autorizado, **con
 * motivo**, y devolviendo un `RegistroOverride` que el llamador tiene que
 * guardar. Un override silencioso es peor que no tenerlo: convierte la política
 * en decorado.
 *
 * ── LO QUE ESTE MÓDULO NO CODIFICA ───────────────────────────────────────────
 *
 * Productos, tiempos de contacto, protocolos de desinfección y qué precauciones
 * exigen `limpieza_aislamiento`. Eso es configuración de control de infecciones
 * del hospital, no una constante universal.
 *
 * ── EL DEFECTO QUE CERRÓ ─────────────────────────────────────────────────────
 *
 * `ESTADOS_CAMA_NO_DISPONIBLE` existía en los tipos y **no lo usaba nadie**: el
 * tablero sumaba a «camas libres» las camas en limpieza, mantenimiento o
 * bloqueadas. Quien lee «4 libres» y sólo puede usar 1 decide un ingreso sobre
 * un número que no existe.
 *
 * Módulo PURO.
 */

import type { EstadoCama } from '@/types/hospital'
import { ESTADOS_CAMA_NO_DISPONIBLE } from '@/types/hospital'

// ═══════════════════════════════════════════════════════════════════════
// Política de rotación de cama — configurable, con default SEGURO
// ═══════════════════════════════════════════════════════════════════════

export interface PoliticaCamas {
  /** Tras alta o traslado, la cama NO pasa directo a libre. */
  requiereLimpiezaTerminalAlEgreso: boolean
  /** La limpieza la confirma personal autorizado antes de que la cama quede lista. */
  requiereConfirmacionLimpieza: boolean
  /** Se permite saltarse el flujo en emergencia. */
  permiteOverrideEmergencia: boolean
  /** El override exige motivo escrito. */
  exigeMotivoOverride: boolean
}

/**
 * Default de NexusMED. **Todo en `true`.**
 *
 * Decisión del Dr. (2026-07-30): un hospital puede desactivarlo, pero el default
 * del producto es el seguro.
 */
export const POLITICA_CAMAS_SEGURA: PoliticaCamas = {
  requiereLimpiezaTerminalAlEgreso: true,
  requiereConfirmacionLimpieza: true,
  permiteOverrideEmergencia: true,
  exigeMotivoOverride: true,
}

// ═══════════════════════════════════════════════════════════════════════
// Disponibilidad
// ═══════════════════════════════════════════════════════════════════════

export type Disponibilidad =
  /** Puede recibir a cualquier paciente. */
  | 'disponible'
  /** Hay un paciente dentro. */
  | 'ocupada'
  /** Libre, pero apartada para alguien. NO cuenta como libre. */
  | 'reservada'
  /** Puede recibir, pero sólo a quien cumpla una condición clínica. */
  | 'condicionada'
  /** No puede recibir a nadie. */
  | 'no_disponible'

export interface EstadoDisponibilidad {
  disponibilidad: Disponibilidad
  /** Por qué. Siempre presente: un número de capacidad sin explicación no se audita. */
  motivo: string
}

/**
 * Qué significa el estado de la cama para la capacidad.
 *
 * @param hayOcupante si el censo dice que hay un paciente dentro. Manda sobre el
 *   estado guardado: el estado es una etiqueta, el ocupante es un hecho.
 */
export function disponibilidad(estado: EstadoCama, hayOcupante = false): EstadoDisponibilidad {
  if (hayOcupante) {
    return { disponibilidad: 'ocupada', motivo: 'Hay un internamiento activo en esta cama.' }
  }
  switch (estado) {
    case 'ocupada':
      return { disponibilidad: 'ocupada', motivo: 'Marcada como ocupada.' }
    case 'reservada':
      return {
        disponibilidad: 'reservada',
        motivo: 'Apartada para un ingreso previsto: no se le puede asignar otro paciente.',
      }
    case 'aislamiento':
      return {
        disponibilidad: 'condicionada',
        motivo: 'Designada para aislamiento: sólo puede recibir a quien lo requiera. ' +
          'Quién lo requiere es criterio médico.',
      }
    case 'limpieza':
      return { disponibilidad: 'no_disponible', motivo: 'Pendiente de limpieza terminal.' }
    case 'limpieza_aislamiento':
      return {
        disponibilidad: 'no_disponible',
        motivo: 'En limpieza de aislamiento: el proceso puede exigir pasos adicionales ' +
          'que define el control de infecciones del hospital.',
      }
    case 'mantenimiento':
      return { disponibilidad: 'no_disponible', motivo: 'Fuera de servicio por mantenimiento.' }
    case 'bloqueada':
      return { disponibilidad: 'no_disponible', motivo: 'Bloqueada por decisión de la unidad.' }
    case 'lista':
      return {
        disponibilidad: 'disponible',
        motivo: 'Limpieza terminal confirmada: puede recibir paciente. Falta liberarla ' +
          'en el tablero para que deje de figurar como recién rotada.',
      }
    case 'libre':
      return { disponibilidad: 'disponible', motivo: 'Libre.' }
  }
}

/** ¿Se le puede asignar un paciente CUALQUIERA ahora mismo? */
export function puedeRecibir(estado: EstadoCama, hayOcupante = false): boolean {
  return disponibilidad(estado, hayOcupante).disponibilidad === 'disponible'
}

// ═══════════════════════════════════════════════════════════════════════
// Conteo — para que el tablero deje de mentir
// ═══════════════════════════════════════════════════════════════════════

export interface ConteoCamas {
  total: number
  ocupadas: number
  /** Libres de verdad: asignables ahora a cualquiera. */
  disponibles: number
  reservadas: number
  condicionadas: number
  noDisponibles: number
}

/**
 * Cuenta camas por disponibilidad real.
 *
 * `disponibles` NO incluye reservadas, condicionadas ni fuera de servicio: es el
 * número sobre el que se decide un ingreso, y tiene que ser el número que de
 * verdad se puede usar.
 */
export function contarCamas(
  camas: readonly { estado: EstadoCama; hayOcupante?: boolean }[],
): ConteoCamas {
  const c: ConteoCamas = {
    total: camas.length, ocupadas: 0, disponibles: 0,
    reservadas: 0, condicionadas: 0, noDisponibles: 0,
  }
  for (const cama of camas) {
    switch (disponibilidad(cama.estado, cama.hayOcupante ?? false).disponibilidad) {
      case 'ocupada': c.ocupadas++; break
      case 'disponible': c.disponibles++; break
      case 'reservada': c.reservadas++; break
      case 'condicionada': c.condicionadas++; break
      case 'no_disponible': c.noDisponibles++; break
    }
  }
  return c
}

// ═══════════════════════════════════════════════════════════════════════
// Transiciones
// ═══════════════════════════════════════════════════════════════════════

/**
 * Transiciones con sentido estructural: qué cambios de estado describen algo
 * que pasa en la realidad. Lo que la POLÍTICA permite o bloquea se decide
 * aparte, en `transicionar`.
 */
export const TRANSICIONES: Record<EstadoCama, readonly EstadoCama[]> = {
  libre: ['ocupada', 'reservada', 'limpieza', 'bloqueada', 'mantenimiento', 'aislamiento'],
  ocupada: ['limpieza', 'limpieza_aislamiento', 'libre'],
  reservada: ['ocupada', 'libre', 'bloqueada'],
  limpieza: ['lista', 'libre', 'mantenimiento', 'bloqueada'],
  limpieza_aislamiento: ['lista', 'libre', 'mantenimiento', 'bloqueada'],
  lista: ['libre', 'ocupada', 'reservada', 'bloqueada', 'mantenimiento'],
  bloqueada: ['libre', 'mantenimiento', 'limpieza'],
  mantenimiento: ['libre', 'bloqueada', 'limpieza'],
  aislamiento: ['ocupada', 'limpieza_aislamiento', 'limpieza', 'libre'],
}

/** El flujo estándar de rotación tras alta o traslado. */
export const FLUJO_ROTACION: readonly EstadoCama[] = ['ocupada', 'limpieza', 'lista', 'libre']

export interface RegistroOverride {
  desde: EstadoCama
  hacia: EstadoCama
  por: string
  motivo: string
  enIso: string
  /** Qué regla se saltó. Se guarda para que la auditoría no tenga que deducirla. */
  politicaOmitida: string
}

export interface ContextoTransicion {
  /** Quién la hace. Sin esto no hay pista de auditoría. */
  por?: string
  /** El usuario tiene permiso de override de emergencia. */
  autorizado?: boolean
  /** Se está pidiendo explícitamente saltarse la política. */
  overrideEmergencia?: boolean
  motivo?: string
  enIso?: string
}

export interface ResultadoTransicion {
  permitida: boolean
  motivo: string
  /** Presente sólo si se permitió por override. **Hay que guardarlo.** */
  auditoria?: RegistroOverride
}

/**
 * Qué regla de la política bloquea este paso. `null` si ninguna.
 *
 * Se expone para que la pantalla pueda explicar el bloqueo sin repetir la lógica.
 */
export function bloqueoDePolitica(
  desde: EstadoCama, hacia: EstadoCama, politica: PoliticaCamas,
): string | null {
  if (desde === 'ocupada' && hacia === 'libre' && politica.requiereLimpiezaTerminalAlEgreso) {
    return 'Tras alta o traslado la cama pasa por limpieza terminal antes de quedar ' +
      'libre. El flujo es ocupada → limpieza → lista → libre.'
  }
  const enLimpieza = desde === 'limpieza' || desde === 'limpieza_aislamiento'
  if (enLimpieza && hacia === 'libre' && politica.requiereConfirmacionLimpieza) {
    return 'La limpieza la confirma personal autorizado: la cama pasa a «Limpia y ' +
      'lista» y desde ahí se libera.'
  }
  return null
}

/**
 * ¿Se puede pasar de un estado a otro con esta política?
 *
 * @param ctx sólo hace falta para pedir un override de emergencia.
 */
export function transicionar(
  desde: EstadoCama,
  hacia: EstadoCama,
  politica: PoliticaCamas,
  ctx: ContextoTransicion = {},
): ResultadoTransicion {
  if (desde === hacia) return { permitida: true, motivo: 'Sin cambio.' }

  if (!TRANSICIONES[desde].includes(hacia)) {
    return { permitida: false, motivo: `No hay paso de «${desde}» a «${hacia}».` }
  }

  const bloqueo = bloqueoDePolitica(desde, hacia, politica)
  if (bloqueo === null) return { permitida: true, motivo: `De «${desde}» a «${hacia}».` }

  if (!ctx.overrideEmergencia) {
    return { permitida: false, motivo: bloqueo }
  }
  if (!politica.permiteOverrideEmergencia) {
    return { permitida: false, motivo: `${bloqueo} Esta unidad no permite override de emergencia.` }
  }
  if (ctx.autorizado !== true) {
    return { permitida: false, motivo: `${bloqueo} El override de emergencia requiere un usuario autorizado.` }
  }
  const motivo = (ctx.motivo ?? '').trim()
  if (politica.exigeMotivoOverride && motivo === '') {
    return { permitida: false, motivo: `${bloqueo} El override de emergencia exige un motivo escrito.` }
  }
  const por = (ctx.por ?? '').trim()
  if (por === '') {
    return { permitida: false, motivo: `${bloqueo} No consta quién hace el override: no habría pista de auditoría.` }
  }
  const enIso = ctx.enIso ?? ''
  if (Number.isNaN(Date.parse(enIso))) {
    return { permitida: false, motivo: `${bloqueo} El override necesita la fecha en que se hizo.` }
  }

  return {
    permitida: true,
    motivo: `Override de emergencia de «${desde}» a «${hacia}».`,
    auditoria: { desde, hacia, por, motivo, enIso, politicaOmitida: bloqueo },
  }
}

/**
 * ÚNICA forma de que una cama quede «limpia y lista».
 *
 * Exige quién y cuándo — misma razón que la revisión del handoff: la regla vive
 * en la función, no en un comentario que se ignora.
 */
export function confirmarLimpieza(
  desde: EstadoCama, por: string, enIso: string,
): { estado: EstadoCama; confirmadaPor: string; confirmadaEn: string } {
  if (desde !== 'limpieza' && desde !== 'limpieza_aislamiento') {
    throw new Error(`confirmarLimpieza: la cama no está en limpieza (está en «${desde}»)`)
  }
  if (por.trim() === '') {
    throw new Error('confirmarLimpieza: exige personal identificado que la confirme')
  }
  if (Number.isNaN(Date.parse(enIso))) {
    throw new Error(`confirmarLimpieza: fecha inválida «${enIso}»`)
  }
  return { estado: 'lista', confirmadaPor: por, confirmadaEn: enIso }
}

/** Estados alcanzables desde uno dado SIN override. Es lo que ofrece la pantalla. */
export function siguientes(desde: EstadoCama, politica: PoliticaCamas): EstadoCama[] {
  return TRANSICIONES[desde].filter(h => transicionar(desde, h, politica).permitida)
}

/**
 * Comprobación de coherencia con el tipo: los estados que este módulo declara
 * `no_disponible` son exactamente los de `ESTADOS_CAMA_NO_DISPONIBLE`, salvo
 * `ocupada`, que allí se lista y aquí tiene bucket propio.
 *
 * Se exporta para que un caso del golden la ejecute: si alguien añade un estado
 * a un lado y no al otro, la capacidad y el tipo empiezan a discrepar.
 */
export function coherenteConElTipo(): boolean {
  const declarados = new Set(ESTADOS_CAMA_NO_DISPONIBLE)
  for (const e of Object.keys(TRANSICIONES) as EstadoCama[]) {
    const d = disponibilidad(e).disponibilidad
    const esperado = d === 'no_disponible' || d === 'ocupada'
    if (declarados.has(e) !== esperado) return false
  }
  return true
}
