import type { Cobro, MetodoPago } from './cobros'
import { METODO_LABEL } from './cobros'
import type { Appointment, AppointmentStatus } from '@/types'

/**
 * Núcleo puro para la operación económica (Lote 7): corte de caja de un día/rango,
 * cuentas por cobrar (atendidas sin cobro) y embudo agendadas→atendidas→cobradas.
 * Sin efectos secundarios; todo cálculo sobre cobros y citas ya cargados.
 */

/* ─── Corte de caja ─── */
export interface CorteCaja {
  ingresos: number       // suma de cobros positivos (activos)
  reembolsos: number     // suma de montos negativos (≤ 0)
  neto: number           // ingresos + reembolsos
  nCobros: number        // # de movimientos activos
  efectivo: number       // neto en efectivo (lo que debe haber en caja física)
  porMetodo: { metodo: MetodoPago; label: string; monto: number; n: number }[]
}

/** Considera solo cobros NO cancelados. */
export function corteDeCaja(cobros: Cobro[]): CorteCaja {
  const activos = cobros.filter(c => !c.cancelado)
  const porMetodoMap = new Map<MetodoPago, { monto: number; n: number }>()
  let ingresos = 0, reembolsos = 0, efectivo = 0
  for (const c of activos) {
    if (c.monto >= 0) ingresos += c.monto
    else reembolsos += c.monto
    if (c.metodo === 'efectivo') efectivo += c.monto
    const m = porMetodoMap.get(c.metodo) ?? { monto: 0, n: 0 }
    m.monto += c.monto; m.n += 1
    porMetodoMap.set(c.metodo, m)
  }
  const porMetodo = Array.from(porMetodoMap.entries())
    .map(([metodo, v]) => ({ metodo, label: METODO_LABEL[metodo], ...v }))
    .sort((a, b) => b.monto - a.monto)
  return { ingresos, reembolsos, neto: ingresos + reembolsos, nCobros: activos.length, efectivo, porMetodo }
}

/* ─── Embudo agendadas → atendidas → cobradas ─── */
const ATENDIDAS: AppointmentStatus[] = ['atendida', 'finalizada', 'pagada']
const NO_CUENTAN: AppointmentStatus[] = ['cancelada', 'reagendada', 'solicitada']

export interface Embudo {
  agendadas: number
  atendidas: number
  noAsistio: number
  cobradas: number       // citas atendidas con al menos un cobro activo vinculado
  montoCobrado: number
  tasaAsistencia: number // atendidas / agendadas (0-1)
  tasaCobro: number      // cobradas / atendidas (0-1)
}

/**
 * citaId con un cobro que SALDA la consulta.
 *
 * Un `abono` es, por definición, un pago PARCIAL: queda saldo pendiente. Antes
 * cualquier monto positivo sacaba la cita de "cuentas por cobrar", así que abonar
 * $200 de una consulta de $800 la daba por cobrada al 100% y los $600 restantes
 * no se reclamaban en ningún lado. Ahora un abono NO salda: la cita sigue
 * apareciendo como pendiente hasta que se registre el cobro de cierre con un
 * concepto que no sea "abono". Se prefiere sobre-reportar pendiente —que a lo
 * sumo hace que alguien pregunte— antes que perder un saldo en silencio.
 */
function citasConCobro(cobros: Cobro[]): Set<string> {
  const s = new Set<string>()
  for (const c of cobros) {
    if (!c.cancelado && c.monto > 0 && c.citaId && c.concepto !== 'abono') s.add(c.citaId)
  }
  return s
}

export function embudoCobro(citas: Appointment[], cobros: Cobro[]): Embudo {
  const conCobro = citasConCobro(cobros)
  // agendadas = citas reales (excluye canceladas/reagendadas/solo-solicitadas)
  const agendables = citas.filter(c => !NO_CUENTAN.includes(c.estado))
  const atendidas = agendables.filter(c => ATENDIDAS.includes(c.estado))
  const noAsistio = citas.filter(c => c.estado === 'no-asistio').length
  const cobradas = atendidas.filter(c => conCobro.has(c.id))
  // El dinero cobrado SÍ incluye los abonos: entró a caja aunque no salde la cita.
  // (La cita sigue contando como no cobrada arriba; son dos preguntas distintas:
  //  cuánto entró vs. qué consultas quedan por saldar.)
  const montoCobrado = cobros
    .filter(c => !c.cancelado && c.monto > 0 && c.citaId && atendidas.some(a => a.id === c.citaId))
    .reduce((s, c) => s + c.monto, 0)
  return {
    agendadas: agendables.length,
    atendidas: atendidas.length,
    noAsistio,
    cobradas: cobradas.length,
    montoCobrado,
    tasaAsistencia: agendables.length ? atendidas.length / agendables.length : 0,
    tasaCobro: atendidas.length ? cobradas.length / atendidas.length : 0,
  }
}

/* ─── Cuentas por cobrar (atendidas sin cobro) ─── */
export interface CuentaPorCobrar {
  citaId: string
  paciente: string
  fechaHora: string
  medico?: string
  tipo?: string
}

export function cuentasPorCobrar(citas: Appointment[], cobros: Cobro[]): CuentaPorCobrar[] {
  const conCobro = citasConCobro(cobros)
  return citas
    // Excluye las EXENTAS (cortesía): el médico decidió no cobrarlas, no son deuda.
    .filter(c => ATENDIDAS.includes(c.estado) && !conCobro.has(c.id) && !c.cobroExento)
    .map(c => ({
      citaId: c.id,
      paciente: c.pacienteNombre,
      fechaHora: c.fechaHora,
      medico: c.medicoNombre,
      tipo: c.tipo,
    }))
    .sort((a, b) => b.fechaHora.localeCompare(a.fechaHora))
}
