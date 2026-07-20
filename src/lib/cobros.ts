/**
 * Registro de cobros del consultorio — núcleo del módulo financiero.
 *
 * Cada cobro vive en clinics/{clinicId}/cobros/{cobroId} y queda ligado a:
 *  - Una cita (si aplica)
 *  - Un paciente
 *  - Un médico (para reportes por doctor cuando hay multi-doctor)
 *
 * Los cobros son INMUTABLES una vez registrados (registro contable, anti-fraude).
 * Para corregir un error → registrar un cobro negativo (refund/ajuste).
 */
import {
  collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { celdaSegura } from '@/lib/csv-seguro'
import { instanteMX, sumarDiasISO, fechaISOLocal } from '@/lib/timezone'

/**
 * Límites de un día LOCAL del consultorio, en instantes UTC.
 *
 * EL BUG QUE CIERRA: `dia` se guardaba como día UTC. En México (UTC-6) eso
 * significa que un cobro de las 19:00 del lunes quedaba archivado como MARTES.
 * Al cerrar la caja el lunes por la noche —que es cuando se cierra— los cobros
 * de la tarde ya no aparecían: el dinero estaba en el cajón pero no en el corte.
 * Y las citas sí se consultan por hora local, así que el corte comparaba dos
 * días distintos y las consultas de la tarde salían como "atendida y no cobrada".
 *
 * Se filtra por `fecha` (el instante completo) y no por `dia`, y eso arregla
 * también LO YA GUARDADO: el instante siempre fue correcto, lo que estaba mal
 * era la etiqueta derivada. Sin migración y sin tocar un solo cobro histórico.
 */
function limitesDelDia(desde: string, hasta: string): { ini: string; fin: string } {
  return {
    ini: instanteMX(desde, '00:00').toISOString(),
    fin: instanteMX(sumarDiasISO(hasta, 1), '00:00').toISOString(),
  }
}

export type MetodoPago =
  | 'efectivo'
  | 'tarjeta_debito'
  | 'tarjeta_credito'
  | 'transferencia'
  | 'cheque'
  | 'stripe'
  | 'mercado_pago'
  | 'otro'

export const METODO_LABEL: Record<MetodoPago, string> = {
  efectivo: '💵 Efectivo',
  tarjeta_debito: '💳 Tarjeta débito',
  tarjeta_credito: '💳 Tarjeta crédito',
  transferencia: '🏦 Transferencia',
  cheque: '📃 Cheque',
  stripe: 'Stripe',
  mercado_pago: 'Mercado Pago',
  otro: 'Otro',
}

export type ConceptoCobro =
  | 'consulta'
  | 'estudio'
  | 'procedimiento'
  | 'teleconsulta'
  | 'medicamento'
  | 'material'
  | 'paquete'
  | 'abono'      // pago parcial de un saldo
  | 'reembolso'  // monto negativo
  | 'otro'

export const CONCEPTO_LABEL: Record<ConceptoCobro, string> = {
  consulta: 'Consulta',
  estudio: 'Estudio',
  procedimiento: 'Procedimiento',
  teleconsulta: 'Teleconsulta',
  medicamento: 'Medicamento',
  material: 'Material',
  paquete: 'Paquete',
  abono: 'Abono a saldo',
  reembolso: 'Reembolso',
  otro: 'Otro',
}

export interface Cobro {
  id?: string
  /** Fecha + hora del cobro (ISO) */
  fecha: string
  /** Día del cobro YYYY-MM-DD (para queries por rango y agrupación) */
  dia: string
  /** Mes del cobro YYYY-MM (para reportes mensuales) */
  mes: string
  /** Monto en MXN (positivo = ingreso, negativo = reembolso) */
  monto: number
  metodo: MetodoPago
  concepto: ConceptoCobro
  descripcion?: string
  /** Cita vinculada si aplica */
  citaId?: string
  /** Paciente */
  patientId?: string
  patientNombre?: string
  /** Médico que atendió (para multi-doctor) */
  medicoId?: string
  medicoNombre?: string
  /** Folio interno auto-generado */
  folio?: string
  /** Referencia externa (autorización de tarjeta, nro de transferencia, etc.) */
  referenciaExterna?: string
  /** Si emitiste factura SAT, su UUID */
  facturaUuid?: string
  /** ¿Está cancelado? (no se borra, solo se marca) */
  cancelado?: boolean
  motivoCancelacion?: string
  /** Quién y cuándo anuló — obligatorio al cancelar (auditoría anti-fraude). */
  canceladoPor?: string
  canceladoEn?: string
  /** Notas */
  notas?: string
  createdAt: string
  creadoPor: string
}

const COL = (clinicId: string) => collection(db, 'clinics', clinicId, 'cobros')

/** Genera folio único corto basado en timestamp */
function generarFolio(): string {
  return `CB-${Date.now().toString(36).toUpperCase().slice(-7)}`
}

export async function registrarCobro(
  clinicId: string,
  data: Omit<Cobro, 'id' | 'fecha' | 'dia' | 'mes' | 'createdAt' | 'folio'>,
): Promise<string> {
  const fecha = new Date()
  const isoFecha = fecha.toISOString()
  /**
   * `dia`/`mes` en hora LOCAL del consultorio, no UTC: un cobro de las 19:00 del
   * lunes es del LUNES. Ya nadie filtra por estos campos —las consultas van por
   * `fecha`, ver `limitesDelDia`— pero se guardan bien porque se leen a ojo en
   * la ficha del cobro y en los exports.
   */
  const dia = fechaISOLocal(fecha)
  const mes = dia.slice(0, 7)
  const payload: Omit<Cobro, 'id'> = {
    ...data,
    fecha: isoFecha,
    dia,
    mes,
    folio: generarFolio(),
    createdAt: isoFecha,
    cancelado: false,
  }
  const ref = await addDoc(COL(clinicId), payload)
  return ref.id
}

/**
 * Anular un cobro. No se borra: se marca, con QUIÉN y CUÁNDO.
 *
 * El autor y la fecha no son opcionales — las Firestore Rules ahora los exigen,
 * y con razón: sin ellos una anulación es dinero que se esfuma del corte sin
 * nadie a quien preguntar. El motivo tampoco puede ir vacío.
 */
export async function cancelarCobro(
  clinicId: string,
  cobroId: string,
  motivo: string,
  autorUid: string,
): Promise<void> {
  const m = (motivo || '').trim()
  if (!m) throw new Error('La anulación de un cobro requiere un motivo.')
  if (!autorUid) throw new Error('No se pudo identificar quién anula el cobro.')
  await updateDoc(doc(COL(clinicId), cobroId), {
    cancelado: true,
    motivoCancelacion: m,
    canceladoPor: autorUid,
    canceladoEn: new Date().toISOString(),
  })
}

/** Marcar cobro con factura SAT */
export async function vincularFactura(
  clinicId: string,
  cobroId: string,
  facturaUuid: string,
): Promise<void> {
  await updateDoc(doc(COL(clinicId), cobroId), { facturaUuid })
}

/**
 * Lista cobros de un rango de fechas (YYYY-MM-DD).
 * Excluye cancelados por default — para reportes "limpios".
 */
export async function listarCobros(
  clinicId: string,
  desde: string,
  hasta: string,
  incluirCancelados = false,
): Promise<Cobro[]> {
  const { ini, fin } = limitesDelDia(desde, hasta)
  const q = query(
    COL(clinicId),
    where('fecha', '>=', ini),
    where('fecha', '<', fin),
    orderBy('fecha', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as Cobro))
    .filter(c => incluirCancelados || !c.cancelado)
}

/** Último día de un mes YYYY-MM, en formato YYYY-MM-DD. */
function ultimoDiaDelMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  return `${mes}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
}

/** Cobros de un mes completo (YYYY-MM) */
export async function cobrosDelMes(clinicId: string, mes: string): Promise<Cobro[]> {
  // Por instante, no por la etiqueta `mes` (misma razón que `limitesDelDia`).
  const { ini, fin } = limitesDelDia(`${mes}-01`, ultimoDiaDelMes(mes))
  const q = query(
    COL(clinicId),
    where('fecha', '>=', ini),
    where('fecha', '<', fin),
    orderBy('fecha', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as Cobro))
    .filter(c => !c.cancelado)
}

// ───────────── Agregaciones para reportes ─────────────

export interface ResumenMes {
  totalIngresos: number
  totalCobros: number
  ticketPromedio: number
  porMetodo: Record<MetodoPago, { monto: number; n: number }>
  porConcepto: Record<ConceptoCobro, { monto: number; n: number }>
  porMedico: Record<string, { nombre: string; monto: number; n: number }>
  porDia: { dia: string; monto: number; n: number }[]
  topPacientes: { nombre: string; monto: number; n: number }[]
  /** Conteo REAL de pacientes únicos (topPacientes está truncado a 10). */
  pacientesUnicos: number
}

export function agregarResumen(cobros: Cobro[]): ResumenMes {
  const inicial: ResumenMes = {
    totalIngresos: 0,
    totalCobros: cobros.length,
    ticketPromedio: 0,
    porMetodo: {} as Record<MetodoPago, { monto: number; n: number }>,
    porConcepto: {} as Record<ConceptoCobro, { monto: number; n: number }>,
    porMedico: {},
    porDia: [],
    topPacientes: [],
    pacientesUnicos: 0,
  }

  const porDiaMap = new Map<string, { monto: number; n: number }>()
  const porPacienteMap = new Map<string, { nombre: string; monto: number; n: number }>()

  for (const c of cobros) {
    inicial.totalIngresos += c.monto

    if (!inicial.porMetodo[c.metodo]) inicial.porMetodo[c.metodo] = { monto: 0, n: 0 }
    inicial.porMetodo[c.metodo].monto += c.monto
    inicial.porMetodo[c.metodo].n += 1

    if (!inicial.porConcepto[c.concepto]) inicial.porConcepto[c.concepto] = { monto: 0, n: 0 }
    inicial.porConcepto[c.concepto].monto += c.monto
    inicial.porConcepto[c.concepto].n += 1

    if (c.medicoId && c.medicoNombre) {
      if (!inicial.porMedico[c.medicoId]) {
        inicial.porMedico[c.medicoId] = { nombre: c.medicoNombre, monto: 0, n: 0 }
      }
      inicial.porMedico[c.medicoId].monto += c.monto
      inicial.porMedico[c.medicoId].n += 1
    }

    /**
     * El día del bucket se DERIVA del instante, no se lee de la etiqueta `c.dia`.
     * Los cobros anteriores a este cambio la tienen en UTC y los nuevos en hora
     * del consultorio; mezclarlas partiría en dos la gráfica por día justo en la
     * frontera de las 18:00. El instante es el mismo dato en ambos casos.
     */
    const clave = fechaISOLocal(new Date(c.fecha))
    const dia = porDiaMap.get(clave) ?? { monto: 0, n: 0 }
    dia.monto += c.monto
    dia.n += 1
    porDiaMap.set(clave, dia)

    if (c.patientId && c.patientNombre) {
      const p = porPacienteMap.get(c.patientId) ?? { nombre: c.patientNombre, monto: 0, n: 0 }
      p.monto += c.monto
      p.n += 1
      porPacienteMap.set(c.patientId, p)
    }
  }

  inicial.ticketPromedio = cobros.length > 0 ? inicial.totalIngresos / cobros.length : 0
  inicial.porDia = Array.from(porDiaMap.entries())
    .map(([dia, v]) => ({ dia, ...v }))
    .sort((a, b) => a.dia.localeCompare(b.dia))
  inicial.pacientesUnicos = porPacienteMap.size
  inicial.topPacientes = Array.from(porPacienteMap.values())
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 10)

  return inicial
}

/** Convierte cobros a CSV para descargar (compatible con Excel) */
export function cobrosACSV(cobros: Cobro[]): string {
  const header = [
    'Folio', 'Fecha', 'Concepto', 'Descripción',
    'Paciente', 'Médico', 'Método', 'Monto MXN',
    'Cita ID', 'Factura UUID', 'Referencia externa', 'Notas',
  ].join(',')
  const rows = cobros.map(c => [
    c.folio ?? '',
    c.fecha,
    CONCEPTO_LABEL[c.concepto],
    csv(c.descripcion ?? ''),
    csv(c.patientNombre ?? ''),
    csv(c.medicoNombre ?? ''),
    METODO_LABEL[c.metodo].replace(/[💵💳🏦📃]/g, '').trim(),
    c.monto.toFixed(2),
    c.citaId ?? '',
    c.facturaUuid ?? '',
    csv(c.referenciaExterna ?? ''),
    csv(c.notas ?? ''),
  ].join(','))
  return [header, ...rows].join('\n')
}

// Delega en celdaSegura: además de comillas, neutraliza inyección de fórmulas
// (un paciente/médico llamado "=cmd|..." ejecutaba la fórmula al abrir el CSV).
function csv(s: string): string {
  return celdaSegura(s)
}

/** Format MXN (sin localStorage dependency para SSR safety) */
export function fmtMXN(n: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
}
