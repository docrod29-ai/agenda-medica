/**
 * Asignación de camas — núcleo PURO, append-only.
 *
 * Unidad ICU-002c. Sin Firestore, sin reloj: entra un arreglo, sale una
 * proyección. El instante siempre llega por parámetro.
 *
 * ── QUÉ ARREGLA ──────────────────────────────────────────────────────────────
 *
 * `Internamiento.cama` es un STRING y la unión cama↔paciente se hacía comparando
 * texto (`mismaCama(i.cama, cama.etiqueta)`). Consecuencias medidas en ICU-001:
 * no había historia de traslados —quedaban como texto libre dentro de
 * `movimientos[].detalle`—, ni forma de reservar una cama antes de que llegue el
 * paciente, ni manera de saber quién ocupó una cama la semana pasada.
 *
 * ── LA REGLA DEL CHARTER (§1) ────────────────────────────────────────────────
 *
 *   «La cama NO identifica al paciente. La estancia identifica al episodio
 *    clínico. La cama es una localización temporal.»
 *
 * Por eso una asignación es un HECHO con inicio y fin, no un campo que se
 * sobrescribe. Cambiar de cama CIERRA la asignación anterior y ABRE otra; las
 * dos quedan.
 *
 * ── COMPATIBILIDAD ───────────────────────────────────────────────────────────
 *
 * `Internamiento.cama` NO se borra. Durante la transición conviven, y
 * `camaVigenteDe` prefiere la asignación con respaldo al string. Es el patrón
 * que funcionó en REG-014 con la firma médica, y es lo que permite revertir con
 * una sola orden.
 */

import type { BedAssignment, MotivoAsignacion } from '@/types/hospital'

/** Una asignación está VIGENTE mientras no tenga `hasta`. */
export function estaVigente(a: BedAssignment): boolean {
  return a.hasta === undefined || a.hasta === null || a.hasta === ''
}

/** ¿La asignación cubre el instante dado? */
export function cubre(a: BedAssignment, instanteIso: string): boolean {
  const t = Date.parse(instanteIso)
  const desde = Date.parse(a.desde)
  if (Number.isNaN(t) || Number.isNaN(desde) || t < desde) return false
  if (estaVigente(a)) return true
  const hasta = Date.parse(a.hasta as string)
  return Number.isNaN(hasta) ? true : t < hasta
}

/** ¿Se solapan dos asignaciones? Semiabierto [desde, hasta): tocarse no solapa. */
export function seSolapan(a: BedAssignment, b: BedAssignment): boolean {
  const aDesde = Date.parse(a.desde), bDesde = Date.parse(b.desde)
  if (Number.isNaN(aDesde) || Number.isNaN(bDesde)) return false
  const aHasta = estaVigente(a) ? Infinity : Date.parse(a.hasta as string)
  const bHasta = estaVigente(b) ? Infinity : Date.parse(b.hasta as string)
  return aDesde < bHasta && bDesde < aHasta
}

export interface ConflictoCama {
  camaId: string
  a: string
  b: string
  motivo: 'solape' | 'dos_vigentes'
}

/**
 * Conflictos de ocupación: dos pacientes en la misma cama a la vez.
 *
 * Se DETECTA en vez de impedirse en el tipo, porque los datos pueden llegar de
 * una importación o de dos pestañas a la vez. Un conflicto tiene que ser
 * visible, no silencioso.
 */
export function conflictos(asignaciones: readonly BedAssignment[]): ConflictoCama[] {
  const porCama = new Map<string, BedAssignment[]>()
  for (const a of asignaciones) {
    const l = porCama.get(a.camaId)
    if (l) l.push(a); else porCama.set(a.camaId, [a])
  }

  const salida: ConflictoCama[] = []
  for (const [camaId, lista] of porCama) {
    // Una reserva no ocupa: puede convivir con la estancia que aún no termina.
    const ocupan = lista.filter(a => a.motivo !== 'reserva' && a.motivo !== 'egreso')
    for (let i = 0; i < ocupan.length; i++) {
      for (let j = i + 1; j < ocupan.length; j++) {
        if (!seSolapan(ocupan[i], ocupan[j])) continue
        const dosVigentes = estaVigente(ocupan[i]) && estaVigente(ocupan[j])
        salida.push({
          camaId, a: ocupan[i].id, b: ocupan[j].id,
          motivo: dosVigentes ? 'dos_vigentes' : 'solape',
        })
      }
    }
  }
  return salida
}

/**
 * La cama que ocupa un internamiento en un instante.
 *
 * @param camaLegado el `Internamiento.cama` (string). Se usa SÓLO si no hay
 *   ninguna asignación aplicable — es el respaldo que permite convivir con los
 *   episodios anteriores a esta unidad sin migrarlos.
 */
export function camaVigenteDe(
  asignaciones: readonly BedAssignment[],
  instanteIso: string,
  camaLegado?: string,
): { camaId: string; fuente: 'asignacion' | 'legado' } | null {
  const aplicables = asignaciones
    .filter(a => a.motivo !== 'reserva' && a.motivo !== 'egreso' && cubre(a, instanteIso))
    .sort((x, y) => Date.parse(y.desde) - Date.parse(x.desde))

  const ganadora = aplicables[0]
  if (ganadora !== undefined) return { camaId: ganadora.camaId, fuente: 'asignacion' }
  if (camaLegado !== undefined && camaLegado.trim() !== '') {
    return { camaId: camaLegado, fuente: 'legado' }
  }
  return null
}

/** Historia de camas de un internamiento, en orden cronológico. */
export function historialCamas(asignaciones: readonly BedAssignment[]): BedAssignment[] {
  return [...asignaciones].sort((a, b) => Date.parse(a.desde) - Date.parse(b.desde))
}

/**
 * Traslado: cierra la asignación vigente y abre la nueva.
 *
 * Devuelve el PAR (cierre + apertura) para que quien escriba lo haga en una sola
 * transacción. No muta la entrada: el cierre es una copia con `hasta`.
 *
 * Que el `hasta` de la vieja sea EXACTAMENTE el `desde` de la nueva es
 * deliberado: con el intervalo semiabierto no hay solape ni hueco, y el paciente
 * nunca aparece en dos camas ni en ninguna.
 */
export function trasladar(
  vigente: BedAssignment,
  destino: { id: string; camaId: string; por: string },
  instanteIso: string,
  motivo: MotivoAsignacion = 'traslado',
): { cierre: BedAssignment; apertura: BedAssignment } {
  if (!estaVigente(vigente)) {
    throw new Error('trasladar: la asignación de origen ya está cerrada')
  }
  if (Date.parse(instanteIso) < Date.parse(vigente.desde)) {
    throw new Error('trasladar: el traslado no puede ser anterior al inicio de la asignación')
  }
  const cierre: BedAssignment = { ...vigente, hasta: instanteIso }
  const apertura: BedAssignment = {
    id: destino.id,
    camaId: destino.camaId,
    desde: instanteIso,
    motivo,
    por: destino.por,
    ...(vigente.icuStayId !== undefined ? { icuStayId: vigente.icuStayId } : {}),
  }
  return { cierre, apertura }
}

/** Ocupantes de una cama en un instante (debería ser 0 o 1; más = conflicto). */
export function ocupantesDe(
  asignaciones: readonly BedAssignment[],
  camaId: string,
  instanteIso: string,
): BedAssignment[] {
  return asignaciones.filter(
    a => a.camaId === camaId && a.motivo !== 'reserva' && a.motivo !== 'egreso' && cubre(a, instanteIso),
  )
}

/** ¿Hay una reserva vigente sobre esta cama? Habilita el flujo B del charter. */
export function reservaVigenteDe(
  asignaciones: readonly BedAssignment[],
  camaId: string,
  instanteIso: string,
): BedAssignment | null {
  return asignaciones.find(
    a => a.camaId === camaId && a.motivo === 'reserva' && cubre(a, instanteIso),
  ) ?? null
}
