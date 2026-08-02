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
  collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc, runTransaction,
} from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { celdaSegura } from '@/lib/csv-seguro'
import { instanteMX, sumarDiasISO, fechaISOLocal, TZ_DEFAULT, zonaActiva } from '@/lib/timezone'
import { elegirMedicoCanonico, type MedicoDelCobro } from '@/lib/finanzas/medico-del-cobro'

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
function limitesDelDia(desde: string, hasta: string, tz: string = TZ_DEFAULT): { ini: string; fin: string } {
  return {
    ini: instanteMX(desde, '00:00', tz).toISOString(),
    fin: instanteMX(sumarDiasISO(hasta, 1), '00:00', tz).toISOString(),
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
  | 'membresia'  // cuota de una membresía recurrente del paciente
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
  membresia: 'Membresía',
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
  /**
   * Médico que atendió (para multi-doctor).
   *
   * CANÓNICO desde v853: siempre el id del documento en `doctors` cuando se
   * pudo resolver. Antes llegaba el id de `doctors` desde Citas y el `uid` desde
   * Consulta, y el reparto de comisiones —que agrupa por este campo— partía al
   * mismo médico en dos filas.
   */
  medicoId?: string
  medicoNombre?: string
  /** Quién cobró, según la sesión. Aparte del id del consultorio. */
  medicoUid?: string
  /**
   * Cómo se resolvió `medicoId`. `sin-resolver` significa que NO se pudo
   * atribuir con certeza — y eso se dice, en vez de dejarlo indistinguible.
   */
  medicoIdResuelto?: 'directo' | 'por-uid' | 'por-correo' | 'sin-resolver'
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
  /**
   * Nombre de quien anuló, sellado al anular.
   *
   * `canceladoPor` es un uid, y un uid no le dice nada a la persona que cuadra
   * la caja: el control de una anulación es poder preguntarle a alguien, y para
   * eso hace falta un nombre. Es lo mismo que ya hacía la cortesía con
   * `exentoPorNombre`.
   */
  canceladoPorNombre?: string
  canceladoEn?: string
  /** Notas */
  notas?: string
  createdAt: string
  creadoPor: string
  /**
   * Tipo de transacción (REG-015). Hoy solo se emite 'PAYMENT'. Devolución,
   * nota de crédito y ajuste serán tipos propios con traza a la operación
   * original — NO montos negativos, que descuadran el corte sin dejar rastro.
   */
  tipo?: 'PAYMENT' | 'REFUND' | 'CREDIT' | 'ADJUSTMENT'
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
  /**
   * Firestore RECHAZA los campos `undefined` (lanza «Unsupported field value:
   * undefined»). Un cobro SUELTO desde Finanzas (sin cita, sin paciente) traía
   * citaId/pacienteId/pacienteNombre en undefined → addDoc fallaba SIEMPRE.
   * Auditoría 2026-07 (P1). Se limpian los undefined antes de escribir.
   */
  const limpio = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))

  /**
   * ═══ AUTOR E IMPORTE SELLADOS EN EL ORIGEN (REG-015) ═══
   *
   * El autor lo ponía CADA LLAMADOR, y de forma inconsistente: unos mandaban el
   * correo y otros el uid. Un cobro podía quedar atribuido a alguien que no lo
   * hizo, y el identificador ni siquiera era comparable entre registros.
   *
   * Decisión del médico dueño: `createdBy` = UID autenticado, validado además
   * por la regla de Firestore (`creadoPor == request.auth.uid`), de modo que el
   * navegador no pueda declarar un autor distinto. Lo que mande el llamador se
   * IGNORA a propósito.
   */
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('No hay sesión: un cobro no puede registrarse sin autor autenticado.')

  /**
   * El monto NO puede ser negativo. Un negativo simulando una devolución
   * descuadra el corte en silencio y no deja rastro de qué se devolvió: las
   * devoluciones son su propio tipo de transacción, con traza a la operación
   * original (REFUND/CREDIT/ADJUSTMENT), no un signo menos.
   */
  const monto = Number((limpio as { monto?: unknown }).monto)
  if (!Number.isFinite(monto) || monto < 0) {
    throw new Error(`Monto inválido (${String((limpio as { monto?: unknown }).monto)}): debe ser un número ≥ 0. Para una devolución usa una operación de reembolso, no un monto negativo.`)
  }

  /**
   * UN SOLO IDENTIFICADOR DE MÉDICO, RESUELTO AQUÍ Y NO EN CADA PANTALLA.
   *
   * Cobrando desde Citas llegaba el id del documento de `doctors`; cobrando al
   * cerrar la Consulta llegaba el `uid` de la sesión. El reparto de comisiones
   * agrupa por `medicoId`, así que el mismo médico salía DOS VECES y media
   * comisión se pagaba al 0 %.
   *
   * Se resuelve en el ORIGEN —igual que ya se sella el autor— porque arreglarlo
   * en cada llamador es garantizar que el próximo llamador lo vuelva a romper.
   * Si falla la lectura de médicos, se deja el cobro tal como venía: perder un
   * cobro por no poder normalizar su médico sería peor que la inconsistencia.
   */
  let medicoResuelto: MedicoDelCobro = { medicoId: (limpio as { medicoId?: string }).medicoId, como: 'sin-resolver' }
  try {
    const { getDoctors } = await import('@/lib/firestore')
    const doctores = await getDoctors(clinicId)
    medicoResuelto = elegirMedicoCanonico({
      medicoIdEntrante: (limpio as { medicoId?: string }).medicoId,
      uid,
      email: auth.currentUser?.email ?? undefined,
      doctores,
    })
  } catch { /* se conserva lo que venía */ }

  const payload = {
    ...(limpio as Record<string, unknown>),
    ...(medicoResuelto.medicoId ? { medicoId: medicoResuelto.medicoId } : {}),
    ...(medicoResuelto.medicoNombre ? { medicoNombre: medicoResuelto.medicoNombre } : {}),
    /**
     * CÓMO se resolvió. Es lo que permite auditar el reparto sin adivinar: un
     * `sin-resolver` en la ficha dice que ese cobro NO pudo atribuirse con
     * certeza, en vez de dejarlo indistinguible de los demás.
     */
    medicoIdResuelto: medicoResuelto.como,
    /** El uid de quien cobró, aparte del id del consultorio. */
    medicoUid: uid,
    monto,
    /** Tipo de transacción. Hoy solo se emiten pagos; REFUND/CREDIT/ADJUSTMENT
     *  son su propia unidad (requieren traza a la operación original). */
    tipo: 'PAYMENT' as const,
    fecha: isoFecha,
    dia,
    mes,
    folio: generarFolio(),
    createdAt: isoFecha,
    creadoPor: uid,   // sellado aquí; se ignora lo que traiga `data`
    cancelado: false,
  } as unknown as Omit<Cobro, 'id'>

  /**
   * IDEMPOTENCIA POR CITA (anti-doble-cobro).
   *
   * El único candado previo era ocultar el botón "Cobrar" cuando la cita ya tenía
   * `cobroId`. Pero ese id se escribía DESPUÉS de crear el cobro, así que dos
   * actores sobre la misma cita (asistente en Citas + médico en Consulta, dos
   * pestañas, o doble clic antes del re-render) creaban DOS cobros; el corte de
   * caja los sumaba ambos y el neto del día no cuadraba contra la caja física.
   *
   * Con cita, la creación del cobro y la reserva del `cobroId` en la cita ocurren
   * en UNA transacción: si la cita ya tiene cobro, se aborta y se devuelve el id
   * existente (no se crea otro). Sin cita (cobro suelto) se mantiene el addDoc.
   */
  if (data.citaId) {
    const citaRef = doc(db, 'clinics', clinicId, 'appointments', data.citaId)
    const cobroRef = doc(COL(clinicId))  // id pre-generado para usarlo en la tx
    const esAbono = data.concepto === 'abono'
    const idFinal = await runTransaction(db, async (tx) => {
      const citaSnap = await tx.get(citaRef)
      const cita = citaSnap.exists() ? (citaSnap.data() as { cobroId?: string; cobroExento?: boolean }) : undefined
      // No se cobra una cita marcada como CORTESÍA: primero hay que quitar la cortesía.
      if (cita?.cobroExento) throw new Error('Esta cita está marcada como cortesía. Quita la cortesía antes de cobrar.')
      // ABONO (pago parcial): NO marca la cita como saldada ni bloquea — puede haber
      // varios abonos y la cita sigue "por cobrar" hasta el pago de cierre. Antes el
      // abono ponía cobroId y la cita desaparecía del worklist con saldo pendiente.
      if (!esAbono && cita?.cobroId) return cita.cobroId   // ya hay cobro de cierre → idempotente
      tx.set(cobroRef, payload)
      // Solo se marca la cita si EXISTE: si se borró entre abrir el modal y cobrar,
      // `tx.update` sobre un doc inexistente lanza NOT_FOUND y abortaría la tx →
      // el cobro se perdería. Mejor registrar el cobro aunque la cita ya no esté.
      if (!esAbono && citaSnap.exists()) tx.update(citaRef, { cobroId: cobroRef.id, cobradoEn: isoFecha })
      return cobroRef.id
    })
    return idFinal
  }

  const ref = await addDoc(COL(clinicId), payload)
  return ref.id
}

/**
 * EXENTAR de cobro (cortesía): el médico/asistente decide NO cobrar esta cita.
 *
 * Es una decisión deliberada y AUDITADA (quién, cuándo, por qué), no un cobro de
 * $0 que ensucie el corte de caja. Idempotente y a prueba de carreras:
 *  - Si la cita YA tiene un cobro real, NO se puede marcar cortesía (primero anula).
 *  - Si ya está exenta, no hace nada.
 * Marca la cita atendida (si no está en un estado más avanzado), oculta el botón
 * "Cobrar" y la saca de cuentas por cobrar. Reversible con `quitarExencion`.
 */
export async function exentarCobro(
  clinicId: string,
  citaId: string,
  motivo: string,
  autorUid: string,
  autorNombre: string,
): Promise<void> {
  const m = (motivo || '').trim()
  if (!m) throw new Error('La cortesía (no cobrar) requiere un motivo.')
  if (!autorUid) throw new Error('No se pudo identificar quién autoriza la cortesía.')
  const citaRef = doc(db, 'clinics', clinicId, 'appointments', citaId)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(citaRef)
    if (!snap.exists()) throw new Error('La cita no existe.')
    const c = snap.data() as { cobroId?: string; cobroExento?: boolean; estado?: string }
    if (c.cobroId) throw new Error('Esta cita ya tiene un cobro. Anúlalo antes de marcarla como cortesía.')
    if (c.cobroExento) return // ya exenta → idempotente
    const avanzados = ['atendida', 'finalizada', 'pagada']
    tx.update(citaRef, {
      cobroExento: true,
      exentoMotivo: m,
      exentoPor: autorUid,
      exentoPorNombre: autorNombre || '',
      exentoEn: new Date().toISOString(),
      ...(c.estado && avanzados.includes(c.estado) ? {} : { estado: 'atendida' }),
    })
  })
}

/** Revertir la cortesía (vuelve a aparecer el botón "Cobrar"). Auditable. */
export async function quitarExencion(clinicId: string, citaId: string): Promise<void> {
  await updateDoc(doc(db, 'clinics', clinicId, 'appointments', citaId), {
    cobroExento: false,
    exentoMotivo: '',
    exentoPor: '',
    exentoPorNombre: '',
    exentoEn: '',
  })
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
  autorNombre = '',
): Promise<void> {
  const m = (motivo || '').trim()
  if (!m) throw new Error('La anulación de un cobro requiere un motivo.')
  if (!autorUid) throw new Error('No se pudo identificar quién anula el cobro.')
  const cobroRef = doc(COL(clinicId), cobroId)
  /**
   * ATÓMICO: anular el cobro y LIBERAR la cita van en la misma transacción. Antes
   * eran dos writes sueltos con `.catch` en el segundo: si el 2º fallaba, el cobro
   * quedaba anulado pero `cita.cobroId` seguía puesto → el botón "Cobrar" oculto y
   * fuera de "Por cobrar", mientras el corte la mostraba pendiente. Silencioso.
   */
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(cobroRef)
    if (!snap.exists()) throw new Error('El cobro no existe.')
    const citaId = snap.data()?.citaId as string | undefined
    tx.update(cobroRef, {
      cancelado: true,
      motivoCancelacion: m,
      canceladoPor: autorUid,
      // El nombre, además del uid: quien cuadra la caja necesita saber a quién
      // preguntarle, y un uid no es una persona.
      canceladoPorNombre: (autorNombre || '').trim(),
      canceladoEn: new Date().toISOString(),
    })
    if (citaId) {
      /**
       * SÓLO SE LIBERA LA CITA SI EL COBRO ANULADO ES EL QUE LA TENÍA TOMADA.
       *
       * Antes se limpiaba `cobroId` con sólo ver que el cobro apuntara a esa
       * cita, sin comprobar que fuera EL MISMO. Y los abonos apuntan a la cita
       * pero NO reservan `cobroId` (a propósito: un pago parcial no la salda).
       *
       * Camino real: el paciente abona $300, luego paga $500 de cierre
       * (`cobroId = A`). Si se anula el abono por un error de captura, la cita
       * perdía el vínculo con A: reaparecía el botón «Cobrar», volvía a cuentas
       * por cobrar, y se le podía cobrar otra vez una consulta ya saldada.
       *
       * La lectura va dentro de la transacción, así que si otro cobro toma la
       * cita mientras tanto, Firestore reintenta con el valor nuevo.
       */
      const citaRef = doc(db, 'clinics', clinicId, 'appointments', citaId)
      const citaSnap = await tx.get(citaRef)
      if (citaSnap.exists() && citaSnap.data()?.cobroId === cobroId) {
        // Liberar la cita: reaparece el botón "Cobrar" y sale de "Por cobrar".
        tx.update(citaRef, { cobroId: '', cobradoEn: '' })
      }
    }
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
 *
 * LA ZONA POR OMISIÓN ES LA DEL CONSULTORIO, NO UNA CONSTANTE.
 *
 * El default era `TZ_DEFAULT` (la constante de Ciudad de México). Corte de caja
 * sí pasaba la zona real; Finanzas no la pasaba en ninguna de sus cinco
 * llamadas. Resultado en Tijuana (UTC-8): la ventana de «Hoy» de Finanzas iba de
 * las 22:00 de ayer a las 22:00 de hoy, mientras la etiqueta del día usaba la
 * zona publicada — dos pantallas con dos totales distintos para el mismo día, y
 * los cobros de la última hora de consulta cayendo al día siguiente en una.
 *
 * `zonaActiva()` es la zona publicada del consultorio, con la constante como
 * último recurso. Quien quiera otra la sigue pudiendo pasar.
 */
export async function listarCobros(
  clinicId: string,
  desde: string,
  hasta: string,
  incluirCancelados = false,
  tz: string = zonaActiva(),
): Promise<Cobro[]> {
  const { ini, fin } = limitesDelDia(desde, hasta, tz)
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

/**
 * Todos los cobros de UNA cita, incluidos los anulados.
 *
 * Los anulados vienen a propósito: sin ellos no se puede distinguir «nadie ha
 * pagado» de «el cobro se anuló», y esas dos situaciones piden cosas distintas
 * —una cobrar, la otra averiguar qué pasó—.
 *
 * Es una consulta por `citaId`, no por rango de fechas: un abono de hace tres
 * semanas tiene que aparecer cuando el paciente vuelve a pagar hoy. Filtrar por
 * el día habría escondido exactamente el saldo que se quiere enseñar.
 */
export async function cobrosDeCita(clinicId: string, citaId: string): Promise<Cobro[]> {
  if (!clinicId || !citaId) return []
  const snap = await getDocs(query(COL(clinicId), where('citaId', '==', citaId)))
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Cobro))
}

/** Último día de un mes YYYY-MM, en formato YYYY-MM-DD. */
function ultimoDiaDelMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  return `${mes}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
}

/** Cobros de un mes completo (YYYY-MM) */
// Misma razón que `listarCobros`: la zona por omisión es la del consultorio.
export async function cobrosDelMes(clinicId: string, mes: string, tz: string = zonaActiva()): Promise<Cobro[]> {
  // Por instante, no por la etiqueta `mes` (misma razón que `limitesDelDia`).
  const { ini, fin } = limitesDelDia(`${mes}-01`, ultimoDiaDelMes(mes), tz)
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
    CONCEPTO_LABEL[c.concepto] ?? String(c.concepto ?? ''),
    csv(c.descripcion ?? ''),
    csv(c.patientNombre ?? ''),
    csv(c.medicoNombre ?? ''),
    /**
     * UNA ETIQUETA QUE FALTA NO PUEDE TUMBAR LA EXPORTACIÓN ENTERA.
     *
     * Esto era `METODO_LABEL[c.metodo].replace(...)`. El webhook del anticipo
     * escribía `metodo: 'tarjeta'`, que NO existe en el catálogo, así que la
     * búsqueda daba `undefined` y el `.replace` lanzaba TypeError: cualquier
     * periodo que contuviera un anticipo en línea NO SE PODÍA DESCARGAR — y ése
     * es justo el archivo que se le manda al contador.
     *
     * El origen ya está arreglado (ahora escribe 'stripe'), pero los cobros
     * viejos con 'tarjeta' siguen en la base: sin esta guarda, el contador
     * seguiría sin poder bajar los meses pasados.
     */
    (METODO_LABEL[c.metodo] ?? String(c.metodo ?? 'otro')).replace(/[💵💳🏦📃]/g, '').trim(),
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
