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
  /**
   * Consultas de CORTESÍA: el médico decidió no cobrarlas, con su motivo y su
   * autor. No son deuda ni descuido, y por eso salen del denominador de la tasa
   * de cobro — pero se cuentan aparte, que es distinto de esconderlas.
   */
  cortesias: number
  montoCobrado: number
  tasaAsistencia: number // atendidas / agendadas (0-1)
  /** cobradas / (atendidas − cortesías): de lo que SÍ tocaba cobrar. */
  tasaCobro: number
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
/**
 * ¿ESTA CITA YA ESTÁ SALDADA?
 *
 * `citasConCobro` sólo ve los cobros que se le pasan, y el corte carga **los del
 * día**. Un anticipo pagado el viernes para la cita del lunes no está en ese
 * conjunto: la consulta salía el lunes en «cuentas por cobrar» y bajaba la tasa
 * de cobro, aunque el dinero ya había entrado.
 *
 * La cita misma lleva `cobroId`, que sólo se escribe con un cobro de CIERRE —un
 * abono no lo pone, a propósito—, así que es la respuesta que no depende de qué
 * día se esté mirando. Y al anular un cobro se limpia, así que no se queda
 * afirmando un pago que ya no existe.
 */
function estaSaldada(cita: Appointment, conCobro: ReadonlySet<string>): boolean {
  return conCobro.has(cita.id) || !!(cita as { cobroId?: string }).cobroId
}

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
  const cobradas = atendidas.filter(c => estaSaldada(c, conCobro))
  /**
   * LA CORTESÍA NO ES UNA COBRANZA FALLIDA.
   *
   * `cuentasPorCobrar` ya las excluía —«el médico decidió no cobrarlas, no son
   * deuda»—, pero la TASA DE COBRO seguía contándolas en el denominador: una
   * consulta de cortesía no está saldada, así que bajaba el porcentaje
   * exactamente igual que una que se olvidaron de cobrar.
   *
   * O sea que la pantalla castigaba una decisión deliberada y la presentaba con
   * la misma cara que un descuido. Ahora salen del denominador y se cuentan
   * aparte: la tasa responde «de lo que SÍ tocaba cobrar, cuánto se cobró».
   */
  const cortesias = atendidas.filter(c => c.cobroExento && !estaSaldada(c, conCobro))
  const cobrables = atendidas.length - cortesias.length
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
    cortesias: cortesias.length,
    montoCobrado,
    tasaAsistencia: agendables.length ? atendidas.length / agendables.length : 0,
    tasaCobro: cobrables > 0 ? cobradas.length / cobrables : 0,
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
    .filter(c => ATENDIDAS.includes(c.estado) && !estaSaldada(c, conCobro) && !c.cobroExento)
    .map(c => ({
      citaId: c.id,
      paciente: c.pacienteNombre,
      fechaHora: c.fechaHora,
      medico: c.medicoNombre,
      tipo: c.tipo,
    }))
    .sort((a, b) => b.fechaHora.localeCompare(a.fechaHora))
}


/* ─── Cortesías del día: la decisión que nadie veía ─── */

/**
 * `exentarCobro` guarda con todo cuidado QUIÉN autorizó la cortesía, CUÁNDO y
 * POR QUÉ — «es una decisión deliberada y AUDITADA, no un cobro de $0 que
 * ensucie el corte de caja», dice su comentario.
 *
 * Y esos tres campos no los leía **ninguna pantalla**. El corte de caja ni
 * siquiera mencionaba las cortesías: diez pacientes atendidos, ocho cobrados,
 * dos de cortesía, y la caja mostraba ocho sin rastro de los otros dos. Quien
 * cuadra el dinero no podía distinguir «dos cortesías que autorizó el doctor» de
 * «dos consultas que a alguien se le olvidó cobrar» — que es justo la diferencia
 * entre un control y un hueco.
 */
export interface CortesiaDelDia {
  citaId: string
  paciente: string
  fechaHora: string
  medico?: string
  motivo: string
  /** Nombre de quien la autorizó; vacío si el registro es anterior a que se guardara. */
  autorizadaPor: string
  autorizadaEn: string
}

export function cortesiasDelDia(citas: Appointment[]): CortesiaDelDia[] {
  return citas
    .filter(c => ATENDIDAS.includes(c.estado) && c.cobroExento)
    .map(c => {
      const x = c as Appointment & {
        exentoMotivo?: string; exentoPorNombre?: string; exentoEn?: string
      }
      return {
        citaId: c.id,
        paciente: c.pacienteNombre,
        fechaHora: c.fechaHora,
        medico: c.medicoNombre,
        // Sin motivo NO se inventa uno: `exentarCobro` lo exige, así que un vacío
        // aquí es un registro viejo, y decirlo es mejor que dejar el hueco mudo.
        motivo: (x.exentoMotivo ?? '').trim() || 'Sin motivo registrado',
        autorizadaPor: (x.exentoPorNombre ?? '').trim(),
        autorizadaEn: x.exentoEn ?? '',
      }
    })
    .sort((a, b) => b.fechaHora.localeCompare(a.fechaHora))
}

export const POR_QUE_LA_CORTESIA_SE_ENSEÑA =
  'Porque una consulta que no se cobra a propósito y una que se quedó sin cobrar ' +
  'se ven igual en la caja si nadie las separa. El sistema ya guardaba quién la ' +
  'autorizó, cuándo y por qué; sólo faltaba enseñarlo.'
