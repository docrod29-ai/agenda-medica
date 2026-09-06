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
  collection, addDoc, getDocs, query, where, orderBy, limit, doc, updateDoc, runTransaction,
} from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { celdaSegura } from '@/lib/csv-seguro'
import { instanteMX, sumarDiasISO, fechaISOLocal, TZ_DEFAULT, zonaActiva } from '@/lib/timezone'
import { elegirMedicoCanonico, type MedicoDelCobro } from '@/lib/finanzas/medico-del-cobro'
import { idIdempotente } from '@/lib/idempotencia'
import { logAudit } from '@/lib/expediente/audit-log'

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
/**
 * Topes de las dos lecturas que preguntan por un cobro concreto.
 *
 * No son cifras clínicas: son cotas de escala, y están puestas muy por encima
 * de lo que ocurre en un consultorio real. Lo que impiden es que un defecto de
 * datos convierta una pregunta puntual en una lectura de la colección entera.
 */
const TOPE_HUELLAS_IGUALES = 25
const TOPE_DEVOLUCIONES_POR_COBRO = 50

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
  /** REFUND/CREDIT: el cobro que devuelve. La traza a la operación original. */
  cobroOriginalId?: string
  motivoReembolso?: string
  /** REFUND: ¿con esta devolución queda devuelto todo el cobro original? */
  reembolsoTotal?: boolean
  /** Nombre de quien registró, sellado (para el CSV y el corte). */
  creadoPorNombre?: string
  /** RT-005: huella de la intención, estable entre dispositivos. */
  huella?: string
  /** Cobros en línea: el PaymentIntent de Stripe (hilo del reembolso). */
  stripePaymentIntentId?: string
  /** REFUND automático al que no se le encontró su cobro original. */
  huerfano?: boolean
}

const COL = (clinicId: string) => collection(db, 'clinics', clinicId, 'cobros')

/**
 * Folio corto para leer a ojo: base36 del instante + dos caracteres al azar.
 *
 * ASC-014: sólo con el instante, dos equipos cobrando en el MISMO milisegundo
 * repetían folio. El sufijo al azar lo evita sin contador en transacción. El
 * folio no es el id del documento: el id sigue siendo la identidad.
 */
function generarFolio(prefijo: 'CB' | 'RB' = 'CB'): string {
  const azar = Math.random().toString(36).slice(2, 4).toUpperCase().padEnd(2, '0')
  return `${prefijo}-${Date.now().toString(36).toUpperCase().slice(-7)}${azar}`
}

export interface OpcionesCobro {
  /**
   * El nombre de ESTE intento de cobro (`claveDeIntento()`). Quien cobra la
   * acuña al enviar y la conserva hasta que el cobro quede registrado: los
   * reintentos la repiten, y por eso convergen al mismo documento.
   *
   * Ver `lib/idempotencia.ts` para por qué el id que sale de ella lleva el
   * consultorio dentro.
   */
  claveIdempotencia?: string
  /**
   * RT-005: el médico o la asistente ya vio el aviso «hay un cobro igual de
   * hoy» y confirmó que ESTE es otro distinto (un segundo abono legítimo del
   * mismo importe, por ejemplo). Sin esta marca, un cobro con la misma huella
   * que otro vivo del día se rechaza con `CobroPosiblementeDuplicado`.
   */
  esOtroDistinto?: boolean
  /**
   * Estado actual de la cita según la pantalla. Sólo para no RETROCEDER un
   * estado más avanzado (finalizada/pagada) a «atendida» al cobrar; la
   * transacción lee además el estado real.
   */
  estadoActual?: string
}

/**
 * Lo que devuelve `registrarCobroDetallado`: el id y, sobre todo, si el cobro
 * YA EXISTÍA (otro dispositivo, otra pestaña) y por tanto NO se registró nada.
 *
 * ── ASC-009 (Panel de Lujo 2026-09, P2) ──────────────────────────────────────
 * `registrarCobro` devolvía sólo el id, así que el modal no podía distinguir
 * «registré tu cobro» de «ya había uno y te devuelvo el suyo»: enseñaba
 * «Cobro registrado: $X» con el importe tecleado aunque no hubiera registrado
 * nada, y encima reescribía `cobradoEn` con la hora del intento fallido.
 */
export interface ResultadoCobro {
  id: string
  /** `true` = no se escribió nada: la cita ya tenía este cobro (o el intento ya se había aplicado). */
  yaExistia: boolean
  /** El cobro que ya estaba, cuando se pudo leer. */
  cobroExistente?: { id: string; monto?: number; folio?: string; fecha?: string }
  /** Qué candado lo detuvo. */
  porQue?: 'mismo-intento' | 'cita-ya-cobrada'
}

/**
 * RT-005: ya hay un cobro VIVO de hoy con la misma huella (misma cita o
 * paciente, mismo concepto, mismo importe). No se decide solo: se pregunta.
 */
export class CobroPosiblementeDuplicado extends Error {
  constructor(public readonly existente: { id: string; monto: number; folio?: string; fecha: string; concepto?: string }) {
    super(
      `Ya hay un cobro igual registrado hoy (${existente.folio ?? existente.id}, ${fmtMXN(existente.monto)}` +
      `${existente.fecha ? ` a las ${horaLocal(existente.fecha)}` : ''}). ¿Es otro distinto?`,
    )
    this.name = 'CobroPosiblementeDuplicado'
  }
}

/**
 * LA HUELLA DE LA INTENCIÓN, ESTABLE ENTRE DISPOSITIVOS — RT-005.
 *
 * La clave de intento (`claveDeIntento`) nombra la intención dentro de UNA
 * pestaña; en otra pestaña u otro dispositivo es distinta, así que un abono y
 * un cobro suelto se registraban dos veces si los cobraban dos personas a la
 * vez (ataque del equipo rojo, Panel de Lujo 2026-09). La huella nombra la
 * intención con lo que es igual desde cualquier sitio: la cita (o el
 * paciente), el concepto, el importe en centavos y el día local del
 * consultorio. No es un candado que decida solo —el segundo abono legítimo del
 * mismo importe existe—: es lo que permite PREGUNTAR.
 */
export function huellaDeCobro(d: { citaId?: string; patientId?: string; concepto: string; monto: number; dia: string }): string {
  const sujeto = d.citaId ? `cita:${d.citaId}` : d.patientId ? `pac:${d.patientId}` : 'suelto'
  return `${sujeto}|${d.concepto}|${Math.round(d.monto * 100)}|${d.dia}`
}

function horaLocal(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: zonaActiva() })
  } catch { return '' }
}

/**
 * Compatibilidad: los llamadores que sólo quieren el id siguen funcionando.
 * Los que necesitan saber si de verdad se registró usan `registrarCobroDetallado`.
 */
export async function registrarCobro(
  clinicId: string,
  data: Omit<Cobro, 'id' | 'fecha' | 'dia' | 'mes' | 'createdAt' | 'folio'>,
  opciones: OpcionesCobro = {},
): Promise<string> {
  return (await registrarCobroDetallado(clinicId, data, opciones)).id
}

export async function registrarCobroDetallado(
  clinicId: string,
  data: Omit<Cobro, 'id' | 'fecha' | 'dia' | 'mes' | 'createdAt' | 'folio'>,
  opciones: OpcionesCobro = {},
): Promise<ResultadoCobro> {
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
   * existente (no se crea otro). Sin cita y sin clave de intento (cobro suelto de
   * un llamador automático) se mantiene el addDoc — ver el bloque de abajo.
   */
  /**
   * ═══ GOLDEN PATH 9 — EL AGUJERO QUE DEJABA ABIERTO EL CANDADO DE ARRIBA ═══
   *
   * El candado por cita cubre EL COBRO QUE SALDA, y sólo ése. Quedaban fuera
   * las dos vías por las que también entra dinero:
   *
   *   · el ABONO (pago parcial) — a propósito NO reserva `cita.cobroId`, para
   *     que la cita siga «por cobrar» por el saldo. Sin más defensa, un doble
   *     toque o un reintento tras un timeout aparente registraba DOS abonos de
   *     $500 por un solo billete de $500 en el cajón;
   *   · el COBRO SUELTO (sin cita) — iba por `addDoc` directo, que fabrica un
   *     id nuevo en cada llamada. Dos por definición.
   *
   * Y el candado por cita tampoco cubre el reintento del cobro que salda cuando
   * la cita YA NO EXISTE (se borró entre abrir el modal y cobrar): esa rama
   * registra el cobro sin poder marcar nada, así que el segundo intento
   * registraba otro.
   *
   * Lo que faltaba era un nombre para la INTENCIÓN. Con `claveIdempotencia` el
   * id del cobro se deriva de esa clave y del consultorio, así que el reintento
   * apunta al MISMO documento: se lee dentro de la transacción y, si ya está, se
   * devuelve su id sin reescribirlo — un cobro es un registro contable y no se
   * pisa jamás, ni con los mismos datos.
   *
   * Sin clave, el comportamiento es exactamente el de antes (llamadores
   * automáticos como membresías, que ya tienen su propia idempotencia).
   */
  const idDeterminista = opciones.claveIdempotencia
    ? idIdempotente(clinicId, 'cobro', opciones.claveIdempotencia)
    : null

  const esAbono = data.concepto === 'abono'
  /**
   * RT-005 — LA HUELLA SE COMPRUEBA SÓLO DONDE EL CANDADO POR CITA NO LLEGA:
   * el abono y el cobro suelto. El cobro que salda una cita ya tiene su
   * candado (`cita.cobroId`) y no necesita preguntar. La lectura va fuera de
   * la transacción a propósito: no es un candado, es una pregunta, y la
   * respuesta («es otro distinto») viene con `esOtroDistinto`.
   */
  const huella = huellaDeCobro({ citaId: data.citaId, patientId: data.patientId, concepto: String(data.concepto), monto, dia })
  if ((esAbono || !data.citaId) && !opciones.esOtroDistinto) {
    /**
     * Acotada, y aquí acotar es seguro: la pregunta es «¿existe ya uno vivo
     * igual?», y más resultados sólo pueden reforzar el sí. La huella lleva el
     * DÍA dentro, así que en un día no puede haber decenas del mismo cobro
     * exacto; el tope está muy por encima de lo posible y sólo impide que una
     * huella repetida por un defecto acabe leyendo la colección entera.
     */
    const iguales = await getDocs(query(COL(clinicId), where('huella', '==', huella), limit(TOPE_HUELLAS_IGUALES)))
    const vivo = iguales.docs
      .map(d => ({ id: d.id, ...(d.data() as Partial<Cobro>) }))
      .find(c => !c.cancelado && c.id !== idDeterminista)
    if (vivo) {
      throw new CobroPosiblementeDuplicado({
        id: vivo.id, monto: Number(vivo.monto) || 0, folio: vivo.folio, fecha: vivo.fecha ?? '', concepto: vivo.concepto,
      })
    }
  }
  const payloadConHuella = { ...payload, huella } as Omit<Cobro, 'id'>

  if (data.citaId) {
    const citaRef = doc(db, 'clinics', clinicId, 'appointments', data.citaId)
    const cobroRef = idDeterminista
      ? doc(COL(clinicId), idDeterminista)
      : doc(COL(clinicId))  // id pre-generado para usarlo en la tx
    return await runTransaction(db, async (tx): Promise<ResultadoCobro> => {
      const citaSnap = await tx.get(citaRef)
      // Se lee ANTES de cualquier escritura (Firestore lo exige) y antes de
      // decidir nada: si este intento ya quedó registrado, no hay cobro nuevo
      // que hacer ni cita que volver a marcar.
      if (idDeterminista && (await tx.get(cobroRef)).exists()) {
        return { id: cobroRef.id, yaExistia: true, porQue: 'mismo-intento' }
      }
      const cita = citaSnap.exists() ? (citaSnap.data() as { cobroId?: string; cobroExento?: boolean; estado?: string }) : undefined
      // No se cobra una cita marcada como CORTESÍA: primero hay que quitar la cortesía.
      if (cita?.cobroExento) throw new Error('Esta cita está marcada como cortesía. Quita la cortesía antes de cobrar.')
      // ABONO (pago parcial): NO marca la cita como saldada ni bloquea — puede haber
      // varios abonos y la cita sigue "por cobrar" hasta el pago de cierre. Antes el
      // abono ponía cobroId y la cita desaparecía del worklist con saldo pendiente.
      if (!esAbono && cita?.cobroId) {
        // Ya hay cobro de cierre → idempotente. Se LEE el existente (todavía
        // antes de escribir) para poder decirle a quien cobra qué había.
        const existente = await tx.get(doc(COL(clinicId), cita.cobroId))
        const e = existente.exists() ? (existente.data() as Partial<Cobro>) : {}
        return {
          id: cita.cobroId, yaExistia: true, porQue: 'cita-ya-cobrada',
          cobroExistente: { id: cita.cobroId, monto: e.monto, folio: e.folio, fecha: e.fecha },
        }
      }
      tx.set(cobroRef, payloadConHuella)
      /**
       * LA CITA SE MARCA AQUÍ, EN LA MISMA ESCRITURA ATÓMICA — ASC-003.
       *
       * `cobroId`/`cobradoEn` los escribía también el modal, con un
       * `updateAppointment` suelto DESPUÉS del cobro: un update que cualquier
       * miembro puede hacer desde la consola con un `cobroId` inventado y que
       * hace desaparecer una deuda sin cobro real. La regla de `appointments`
       * (SEGURIDAD) sólo puede exigir «cobroId apunta a un cobro que existe en
       * esta misma escritura» si el cobro y la marca viajan juntos. Y «cobrar
       * cierra la consulta» (estado → atendida) va en el mismo sitio por la
       * misma razón: si viaja aparte, se olvida.
       *
       * Solo se marca la cita si EXISTE: si se borró entre abrir el modal y
       * cobrar, `tx.update` sobre un doc inexistente lanza NOT_FOUND y
       * abortaría la tx → el cobro se perdería.
       */
      if (citaSnap.exists()) {
        const avanzados = ['atendida', 'finalizada', 'pagada']
        const estadoReal = cita?.estado ?? opciones.estadoActual
        tx.update(citaRef, {
          ...(esAbono ? {} : { cobroId: cobroRef.id, cobradoEn: isoFecha }),
          ...(estadoReal && avanzados.includes(estadoReal) ? {} : { estado: 'atendida' }),
        })
      }
      return { id: cobroRef.id, yaExistia: false }
    })
  }

  if (idDeterminista) {
    const cobroRef = doc(COL(clinicId), idDeterminista)
    return await runTransaction(db, async (tx): Promise<ResultadoCobro> => {
      if ((await tx.get(cobroRef)).exists()) return { id: cobroRef.id, yaExistia: true, porQue: 'mismo-intento' }
      tx.set(cobroRef, payloadConHuella)
      return { id: cobroRef.id, yaExistia: false }
    })
  }

  const ref = await addDoc(COL(clinicId), payloadConHuella)
  return { id: ref.id, yaExistia: false }
}

/**
 * DEVOLUCIÓN DE VENTANILLA — la unidad REFUND que REG-015 dejó declarada.
 *
 * ── ASC-012 / PL-D5 (Panel de Lujo 2026-09) ──────────────────────────────────
 * El concepto «Reembolso» y la fila `reembolsos` del corte existían sin que
 * nadie pudiera emitir uno: el selector lo filtraba, el monto negativo se
 * rechazaba en el origen y la única salida era la anulación, que además no
 * funcionaba (ASC-001). Decisión por omisión: construir la unidad, porque
 * `estado-cobro.ts` y el corte ya la consumían.
 *
 * Un REFUND es un documento PROPIO en `cobros`, con `monto` POSITIVO (lo que
 * salió), `tipo: 'REFUND'` y `cobroOriginalId` con traza al cobro que
 * devuelve. Nunca un signo menos: un negativo descuadra el corte sin dejar
 * rastro de qué se devolvió. No puede devolverse más de lo que entró.
 *
 * El cobro original NO se anula: se cobró de verdad y se devolvió de verdad;
 * las dos cosas quedan en el libro. Si la devolución es total y ese cobro
 * tenía tomada la cita, la cita se libera en la misma transacción.
 */
export async function registrarReembolso(
  clinicId: string,
  d: { cobroOriginalId: string; monto: number; metodo: MetodoPago; motivo: string; autorNombre?: string },
  opciones: OpcionesCobro = {},
): Promise<string> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('No hay sesión: una devolución no puede registrarse sin autor autenticado.')
  const motivo = (d.motivo || '').trim()
  if (!motivo) throw new Error('La devolución requiere un motivo.')
  const monto = Number(d.monto)
  if (!Number.isFinite(monto) || monto <= 0) throw new Error('El importe a devolver debe ser mayor que cero.')
  const originalRef = doc(COL(clinicId), d.cobroOriginalId)
  /**
   * Lo ya devuelto de ESE cobro, para no devolver de más. Lectura fuera de la
   * transacción: acota, no cierra; el tope duro es el importe del original.
   *
   * La cota se pide con UNO DE MÁS a propósito. Truncar esta lista en silencio
   * subestimaría lo ya devuelto y dejaría devolver por encima del original:
   * dinero. Así que si llegan más de las que caben, no se calcula un total
   * incompleto — se para y se dice.
   */
  const previas = await getDocs(query(
    COL(clinicId),
    where('cobroOriginalId', '==', d.cobroOriginalId),
    limit(TOPE_DEVOLUCIONES_POR_COBRO + 1),
  ))
  if (previas.size > TOPE_DEVOLUCIONES_POR_COBRO) {
    throw new Error(
      `Este cobro ya tiene más de ${TOPE_DEVOLUCIONES_POR_COBRO} devoluciones registradas. ` +
      'No puedo sumar lo ya devuelto sin arriesgarme a devolver de más: revísalo a mano.',
    )
  }
  const yaDevuelto = previas.docs
    .map(x => x.data() as Partial<Cobro>)
    .filter(x => !x.cancelado && String(x.tipo) === 'REFUND')
    .reduce((s, x) => s + (Number(x.monto) || 0), 0)

  const fecha = new Date()
  const iso = fecha.toISOString()
  const dia = fechaISOLocal(fecha)
  const refundRef = opciones.claveIdempotencia
    ? doc(COL(clinicId), idIdempotente(clinicId, 'cobro', opciones.claveIdempotencia))
    : doc(COL(clinicId))

  return await runTransaction(db, async (tx) => {
    const original = await tx.get(originalRef)
    if (!original.exists()) throw new Error('El cobro que quieres devolver no existe.')
    if ((await tx.get(refundRef)).exists()) return refundRef.id
    const o = original.data() as Partial<Cobro>
    if (o.cancelado) throw new Error('Ese cobro está anulado: no hay nada que devolver.')
    if (String(o.tipo ?? 'PAYMENT') !== 'PAYMENT') throw new Error('Sólo se devuelve un cobro (pago), no otra devolución.')
    const tope = Math.round(((Number(o.monto) || 0) - yaDevuelto) * 100) / 100
    if (monto > tope + 0.005) {
      throw new Error(`No se puede devolver ${fmtMXN(monto)}: de ese cobro de ${fmtMXN(Number(o.monto) || 0)} quedan ${fmtMXN(Math.max(0, tope))} por devolver.`)
    }
    const citaRef = o.citaId ? doc(db, 'clinics', clinicId, 'appointments', o.citaId) : null
    const citaSnap = citaRef ? await tx.get(citaRef) : null
    const total = Math.round((yaDevuelto + monto) * 100) / 100 >= (Number(o.monto) || 0)

    tx.set(refundRef, {
      tipo: 'REFUND',
      cobroOriginalId: d.cobroOriginalId,
      monto,
      metodo: d.metodo,
      concepto: 'reembolso',
      descripcion: motivo,
      motivoReembolso: motivo,
      ...(o.citaId ? { citaId: o.citaId } : {}),
      ...(o.patientId ? { patientId: o.patientId } : {}),
      ...(o.patientNombre ? { patientNombre: o.patientNombre } : {}),
      ...(o.medicoId ? { medicoId: o.medicoId } : {}),
      ...(o.medicoNombre ? { medicoNombre: o.medicoNombre } : {}),
      medicoUid: uid,
      fecha: iso, dia, mes: dia.slice(0, 7),
      folio: generarFolio('RB'),
      reembolsoTotal: total,
      createdAt: iso,
      creadoPor: uid,
      creadoPorNombre: (d.autorNombre || '').trim(),
      cancelado: false,
    })
    if (total && citaRef && citaSnap?.exists() && citaSnap.data()?.cobroId === d.cobroOriginalId) {
      tx.update(citaRef, { cobroId: '', cobradoEn: '', reembolsadoEn: iso, reembolsoCobroId: refundRef.id })
    }
    return refundRef.id
  }).catch(e => { throw errorLegible(e, 'registrar la devolución') })
}

/**
 * Cuánto ENTRA (o sale) con este movimiento, con signo. Un REFUND/CREDIT se
 * guarda con monto positivo y resta; un monto negativo heredado también resta.
 * Es la ÚNICA definición del signo: corte, resumen y comisiones la comparten.
 */
export function montoEfectivo(c: Pick<Cobro, 'monto' | 'tipo'>): number {
  const t = String(c.tipo ?? 'PAYMENT')
  const m = Number(c.monto) || 0
  return t === 'REFUND' || t === 'CREDIT' ? -Math.abs(m) : m
}

/** ¿Es un movimiento de salida (devolución o nota de crédito)? */
export function esDevolucion(c: Pick<Cobro, 'monto' | 'tipo'>): boolean {
  return montoEfectivo(c) < 0
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

/**
 * Un sello de cortesía ya retirado. Se CONSERVA en `historialCortesia` de la
 * cita: la autorización original y su retiro, con quién y por qué en los dos
 * sentidos.
 */
export interface SelloCortesiaRetirada {
  motivo: string
  autorizoPor: string
  autorizoPorNombre: string
  autorizadaEn: string
  retiradaPor: string
  retiradaPorNombre: string
  retiradaMotivo: string
  retiradaEn: string
}

/**
 * Revertir la cortesía (vuelve a aparecer el botón "Cobrar").
 *
 * ── ASC-004 (Panel de Lujo 2026-09) ──────────────────────────────────────────
 *
 * Esto era un `updateDoc` que ponía `cobroExento:false` y VACIABA `exentoMotivo`,
 * `exentoPor`, `exentoPorNombre` y `exentoEn`. Sin motivo, sin autor y sin
 * bitácora: el reverso exacto del hueco que cerró REG-003, con el agravante de
 * que borraba el sello original. Marcar cortesía, cobrar en efectivo por fuera,
 * quitar la cortesía, volver a marcarla con otro motivo — y la primera
 * autorización desaparecía.
 *
 * Ahora es simétrico a `exentarCobro`: motivo y autor obligatorios, el sello
 * original se conserva en `historialCortesia`, el retiro queda sellado en
 * `exencionRetirada*`, y se deja asiento en la bitácora desde aquí (no desde el
 * llamador, para que ningún llamador futuro lo olvide).
 *
 * Los parámetros nuevos son opcionales EN EL TIPO para no romper la compilación
 * del llamador de Citas (archivo de otra rebanada), pero obligatorios EN TIEMPO
 * DE EJECUCIÓN: sin motivo no se escribe nada.
 */
export async function quitarExencion(
  clinicId: string,
  citaId: string,
  motivo?: string,
  autorUid?: string,
  autorNombre = '',
): Promise<void> {
  const m = (motivo || '').trim()
  if (!m) throw new Error('Para quitar la cortesía hay que escribir el motivo.')
  if (!autorUid) throw new Error('No se pudo identificar quién quita la cortesía.')
  const citaRef = doc(db, 'clinics', clinicId, 'appointments', citaId)
  let patientId: string | undefined
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(citaRef)
    if (!snap.exists()) throw new Error('La cita no existe.')
    const c = snap.data() as {
      cobroExento?: boolean; exentoMotivo?: string; exentoPor?: string; exentoPorNombre?: string
      exentoEn?: string; historialCortesia?: SelloCortesiaRetirada[]; pacienteId?: string
    }
    patientId = c.pacienteId
    if (!c.cobroExento) return  // ya no está exenta → idempotente
    const en = new Date().toISOString()
    const sello: SelloCortesiaRetirada = {
      motivo: c.exentoMotivo ?? '',
      autorizoPor: c.exentoPor ?? '',
      autorizoPorNombre: c.exentoPorNombre ?? '',
      autorizadaEn: c.exentoEn ?? '',
      retiradaPor: autorUid,
      retiradaPorNombre: (autorNombre || '').trim(),
      retiradaMotivo: m,
      retiradaEn: en,
    }
    tx.update(citaRef, {
      cobroExento: false,
      // Los campos VIVOS se vacían para que ninguna pantalla enseñe «autorizó X»
      // sobre una cita que ya no es cortesía; el sello se conserva abajo.
      exentoMotivo: '',
      exentoPor: '',
      exentoPorNombre: '',
      exentoEn: '',
      exencionRetiradaMotivo: m,
      exencionRetiradaPor: autorUid,
      exencionRetiradaPorNombre: (autorNombre || '').trim(),
      exencionRetiradaEn: en,
      historialCortesia: [...(Array.isArray(c.historialCortesia) ? c.historialCortesia : []), sello],
    })
  }).catch(e => { throw errorLegible(e, 'quitar la cortesía') })
  // Bitácora inmutable (best-effort), con el mismo evento que la cortesía y la
  // acción marcada: así una consulta de la bitácora enseña ida y vuelta juntas.
  logAudit({
    evento: 'cobro_exento', clinicId, patientId,
    meta: { citaId, accion: 'retirada', motivo: m },
  }).catch(() => {})
}

/**
 * Traduce un error del SDK de Firestore a una frase que una persona entiende.
 * Los errores que lanzamos nosotros (sin `code`) pasan tal cual: ya hablan.
 */
function errorLegible(e: unknown, accion: string): Error {
  const code = (e as { code?: unknown })?.code
  if (e instanceof Error && typeof code !== 'string') return e
  if (code === 'permission-denied') return new Error(`No tienes permiso para ${accion}.`)
  if (code === 'unavailable' || code === 'deadline-exceeded') {
    return new Error(`Sin conexión con el servidor: no se pudo ${accion}. Inténtalo de nuevo.`)
  }
  return new Error(`No se pudo ${accion}; inténtalo de nuevo.`)
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
    /**
     * ═══ TODAS LAS LECTURAS ANTES DE TODAS LAS ESCRITURAS — ASC-001 (P0) ═══
     *
     * Aquí se escribía el cobro y DESPUÉS, dentro del `if (citaId)`, se leía
     * la cita. El SDK de Firestore rechaza toda transacción que lea tras
     * escribir («Firestore transactions require all reads to be executed
     * before all writes»), así que anular un cobro ligado a una cita fallaba
     * SIEMPRE, con el mensaje crudo del SDK en el toast, y como `delete` está
     * prohibido por reglas, un cobro equivocado no se podía corregir por
     * ninguna vía. Panel de Lujo 2026-09, AS-cobros; el equipo rojo lo subió a
     * P0 porque el fallo era determinista y nada ejercitaba la transacción.
     *
     * `registrarCobro` ya seguía la regla («se lee ANTES de cualquier
     * escritura»); ésta no la siguió. Ahora las dos lecturas van primero.
     */
    const snap = await tx.get(cobroRef)
    if (!snap.exists()) throw new Error('El cobro no existe.')
    const citaId = snap.data()?.citaId as string | undefined
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
    const citaRef = citaId ? doc(db, 'clinics', clinicId, 'appointments', citaId) : null
    const citaSnap = citaRef ? await tx.get(citaRef) : null

    tx.update(cobroRef, {
      cancelado: true,
      motivoCancelacion: m,
      canceladoPor: autorUid,
      // El nombre, además del uid: quien cuadra la caja necesita saber a quién
      // preguntarle, y un uid no es una persona.
      canceladoPorNombre: (autorNombre || '').trim(),
      canceladoEn: new Date().toISOString(),
    })
    if (citaRef && citaSnap?.exists() && citaSnap.data()?.cobroId === cobroId) {
      // Liberar la cita: reaparece el botón "Cobrar" y sale de "Por cobrar".
      tx.update(citaRef, { cobroId: '', cobradoEn: '' })
    }
  }).catch(e => { throw errorLegible(e, 'anular el cobro') })
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

/** Clave de la fila «Sin atribuir» de `porMedico` (cobros sin `medicoId`). */
export const SIN_ATRIBUIR = 'sin-atribuir'

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

  /**
   * Un REFUND (ASC-012) RESTA de todo lo que suma: total, método, concepto,
   * médico, día y paciente. Se guarda con monto positivo y tipo propio, así que
   * el signo lo pone `montoEfectivo`, la única definición que hay.
   */
  let nPagos = 0
  for (const c of cobros) {
    const m = montoEfectivo(c)
    if (!esDevolucion(c)) nPagos += 1
    inicial.totalIngresos += m

    if (!inicial.porMetodo[c.metodo]) inicial.porMetodo[c.metodo] = { monto: 0, n: 0 }
    inicial.porMetodo[c.metodo].monto += m
    inicial.porMetodo[c.metodo].n += 1

    if (!inicial.porConcepto[c.concepto]) inicial.porConcepto[c.concepto] = { monto: 0, n: 0 }
    inicial.porConcepto[c.concepto].monto += m
    inicial.porConcepto[c.concepto].n += 1

    /**
     * POR MÉDICO SE AGRUPA POR `medicoId`, CON NOMBRE DE RESPALDO — ASC-016.
     *
     * Esto exigía `medicoId && medicoNombre`: un cobro con médico pero sin
     * nombre (el webhook lo escribe así cuando la cita no lo trae) se caía del
     * desglose mientras Comisiones sí lo contaba. Dos pantallas, dos totales
     * para el mismo médico. Ahora se agrupa igual que `calcularComisiones`
     * (por id, «Médico sin nombre» de respaldo, el nombre más reciente gana) y
     * los cobros sin médico van a «Sin atribuir», para que el desglose SUME el
     * total en vez de perder filas en silencio.
     */
    const claveMedico = c.medicoId || SIN_ATRIBUIR
    if (!inicial.porMedico[claveMedico]) {
      inicial.porMedico[claveMedico] = {
        nombre: c.medicoId ? (c.medicoNombre || 'Médico sin nombre') : 'Sin atribuir', monto: 0, n: 0,
      }
    }
    if (c.medicoId && c.medicoNombre) inicial.porMedico[claveMedico].nombre = c.medicoNombre
    inicial.porMedico[claveMedico].monto += m
    inicial.porMedico[claveMedico].n += 1

    /**
     * El día del bucket se DERIVA del instante, no se lee de la etiqueta `c.dia`.
     * Los cobros anteriores a este cambio la tienen en UTC y los nuevos en hora
     * del consultorio; mezclarlas partiría en dos la gráfica por día justo en la
     * frontera de las 18:00. El instante es el mismo dato en ambos casos.
     */
    const clave = fechaISOLocal(new Date(c.fecha))
    const dia = porDiaMap.get(clave) ?? { monto: 0, n: 0 }
    dia.monto += m
    dia.n += 1
    porDiaMap.set(clave, dia)

    if (c.patientId && c.patientNombre) {
      const p = porPacienteMap.get(c.patientId) ?? { nombre: c.patientNombre, monto: 0, n: 0 }
      p.monto += m
      p.n += 1
      porPacienteMap.set(c.patientId, p)
    }
  }

  // El ticket promedio es de los PAGOS: una devolución no es un ticket.
  inicial.ticketPromedio = nPagos > 0
    ? cobros.filter(c => !esDevolucion(c)).reduce((s, c) => s + montoEfectivo(c), 0) / nPagos
    : 0
  inicial.porDia = Array.from(porDiaMap.entries())
    .map(([dia, v]) => ({ dia, ...v }))
    .sort((a, b) => a.dia.localeCompare(b.dia))
  inicial.pacientesUnicos = porPacienteMap.size
  inicial.topPacientes = Array.from(porPacienteMap.values())
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 10)

  return inicial
}

export interface OpcionesCSV {
  /** Zona del consultorio para «Día» y «Hora». Por omisión, la publicada. */
  tz?: string
  /** uid → nombre del equipo, para la columna «Cobró». */
  nombrePorUid?: Readonly<Record<string, string>>
}

/**
 * Quién registró el cobro, para leerlo una persona. Nunca un correo.
 * Los automáticos se dicen por su nombre; un uid sin traducción se recorta
 * pero se enseña, porque un hueco se lee como «nadie».
 */
export function quienCobro(
  c: Pick<Cobro, 'creadoPor' | 'creadoPorNombre' | 'medicoUid'>,
  nombrePorUid: Readonly<Record<string, string>> = {},
): string {
  const sellado = (c.creadoPorNombre ?? '').trim()
  if (sellado) return sellado
  const uid = (c.creadoPor || c.medicoUid || '').trim()
  if (!uid) return 'sin autor registrado'
  if (uid === 'stripe:anticipo') return 'Stripe (anticipo en línea)'
  if (uid === 'stripe:reembolso') return 'Stripe (reembolso en línea)'
  const resuelto = (nombrePorUid[uid] ?? '').trim()
  if (resuelto) return resuelto
  return `usuario ${uid.slice(0, 6)}…`
}

/**
 * Convierte cobros a CSV para descargar (compatible con Excel).
 *
 * ── ASC-014 (Panel de Lujo 2026-09) ──────────────────────────────────────────
 * El archivo «para el contador» llevaba la fecha en ISO UTC crudo, no decía
 * quién cobró ni el tipo de movimiento, y EXCLUÍA los anulados sin avisarlo.
 * Ahora: día y hora en la zona del consultorio (además del instante ISO,
 * que sigue siendo el dato), tipo, estado (vivo / anulado con motivo y quién),
 * quién cobró, y los anulados SE EXPORTAN marcados: quien los quiera fuera
 * filtra una columna; quien no sepa que existen no puede filtrar nada.
 */
export function cobrosACSV(cobros: Cobro[], opciones: OpcionesCSV = {}): string {
  const tz = opciones.tz ?? zonaActiva()
  const header = [
    'Folio', 'Día (consultorio)', 'Hora', 'Fecha ISO', 'Tipo', 'Estado', 'Concepto', 'Descripción',
    'Paciente', 'Médico', 'Cobró', 'Método', 'Monto MXN',
    'Cita ID', 'Cobro original', 'Factura UUID', 'Referencia externa', 'Notas', 'Motivo de anulación', 'Anuló',
  ].join(',')
  const rows = cobros.map(c => [
    c.folio ?? '',
    diaLocalDe(c.fecha, tz),
    horaLocalDe(c.fecha, tz),
    c.fecha,
    TIPO_LABEL[String(c.tipo ?? 'PAYMENT')] ?? String(c.tipo),
    c.cancelado ? 'anulado' : 'vivo',
    CONCEPTO_LABEL[c.concepto] ?? String(c.concepto ?? ''),
    csv(c.descripcion ?? ''),
    csv(c.patientNombre ?? ''),
    csv(c.medicoNombre ?? ''),
    csv(quienCobro(c, opciones.nombrePorUid)),
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
    // Con signo: una devolución sale negativa para que la columna SUME sola.
    montoEfectivo(c).toFixed(2),
    c.citaId ?? '',
    c.cobroOriginalId ?? '',
    c.facturaUuid ?? '',
    csv(c.referenciaExterna ?? ''),
    csv(c.notas ?? ''),
    csv(c.cancelado ? (c.motivoCancelacion ?? '') : ''),
    csv(c.cancelado ? quienAnuloEnCSV(c, opciones.nombrePorUid) : ''),
  ].join(','))
  return [header, ...rows].join('\n')
}

const TIPO_LABEL: Record<string, string> = {
  PAYMENT: 'Pago', REFUND: 'Devolución', CREDIT: 'Nota de crédito', ADJUSTMENT: 'Ajuste',
}

function quienAnuloEnCSV(c: Cobro, nombrePorUid: Readonly<Record<string, string>> = {}): string {
  const sellado = (c.canceladoPorNombre ?? '').trim()
  if (sellado) return sellado
  const uid = (c.canceladoPor ?? '').trim()
  if (!uid) return 'sin autor registrado'
  return (nombrePorUid[uid] ?? '').trim() || `usuario ${uid.slice(0, 6)}…`
}

/** Día local del consultorio (YYYY-MM-DD) de un instante ISO; vacío si no es fecha. */
export function diaLocalDe(iso: string, tz: string = zonaActiva()): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : fechaISOLocal(d, tz)
}

/** Hora local del consultorio (HH:mm) de un instante ISO; vacío si no es fecha. */
export function horaLocalDe(iso: string, tz: string = zonaActiva()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(d)
}

/** «5 sep 2026, 21:32» en la zona del consultorio — para las filas de Finanzas (ASC-008). */
export function fechaConHoraDelConsultorio(iso: string, tz: string = zonaActiva()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
  }).format(d)
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
