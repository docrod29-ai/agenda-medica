import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarMiembro } from '@/lib/auth-server'
import type { Appointment } from '@/types'

/**
 * Alta de cita ATÓMICA (dashboard/asistente). Reemplaza el addDoc del cliente:
 * re-chequea el conflicto y escribe en una transacción → cierra la carrera
 * check-then-write si dos miembros agendan el mismo hueco a la vez.
 *
 * Requiere ser MIEMBRO de la clínica. Devuelve { id }.
 * Conflicto MÉDICO-AWARE (igual que el booking público): si la cita trae medicoId,
 * solo choca con citas del mismo médico; si no (modal), choca contra todas. Así
 * cada path conserva su comportamiento actual, solo que ahora es atómico.
 */
export async function POST(req: NextRequest) {
  let body: { clinicId?: string; appointment?: Omit<Appointment, 'id'>; reagendarId?: string; sobreagendarMotivo?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
  }
  const { clinicId, appointment, reagendarId } = body
  if (!clinicId || !appointment?.fechaHora) {
    return NextResponse.json({ error: 'Faltan datos de la cita' }, { status: 400 })
  }

  const acc = await verificarMiembro(req, clinicId)
  if (!acc.ok) return acc.response

  /**
   * ALLOWLIST anti mass-assignment (auditoría P2). Antes se persistía `{ ...appointment }`
   * crudo: un miembro (incluida una asistente de rol bajo) podía inyectar campos que
   * NO le corresponden a esta vía — cobro/cortesía (`cobroExento`, `cobradoEn`,
   * `cobroId`, `exento*`), banderas de recordatorio, confirmación del paciente, o el
   * estado de sync de Google. Esos flujos tienen su propio endpoint auditado. Aquí
   * solo se aceptan los campos de AGENDAMIENTO; la identidad de autoría la fija el
   * servidor desde la sesión, no el cliente.
   */
  const CAMPOS_CITA = [
    'pacienteId', 'pacienteNombre', 'pacienteTelefono', 'fechaHora', 'duracion',
    'tipo', 'motivo', 'estado', 'origen', 'medicoNombre', 'medicoId', 'lugar',
    'notasInternas', 'consentimientoMensajes', 'doctorId', 'branchId',
  ] as const
  /**
   * SOBREAGENDAR: LO QUE EL CHARTER PEDÍA Y NO EXISTÍA.
   *
   * «Doble reserva accidental = BLOQUEAR. Anulación manual autorizada =
   * permitida + auditada.» De esa pareja sólo estaba la primera mitad: el
   * empalme se rechazaba SIEMPRE, sin vía autorizada.
   *
   * Y eso no evita el sobreagendamiento, lo esconde: llega una urgencia a las
   * 10:00 y esa hora está ocupada, así que el médico acaba escribiendo «10:05»
   * a mano en el campo libre, o cancelando la otra cita sin dejar rastro de
   * quién ni por qué. El empalme ocurre igual y el sistema no se entera.
   *
   * El motivo ESCRITO es lo que separa «autorizado» de «accidental»: nadie
   * teclea una justificación por error. Se guarda en la cita y va a la
   * bitácora, así que después se puede preguntar quién sobreagendó y por qué.
   */
  /**
   * SOBREAGENDAR ES DEL MÉDICO, NO DE TODO EL MOSTRADOR (decisión del dueño).
   *
   * Poner una cita encima de otra decide que un paciente esperará y que la
   * consulta se comprimirá: es una decisión sobre el tiempo clínico, no sobre
   * la agenda. Quien la toma es quien va a atender.
   *
   * La asistente sigue viendo el choque y la razón por la que no puede
   * saltárselo — no se le esconde el botón sin explicación, que es como se
   * aprende a rodear un sistema.
   */
  const motivoSobreagenda = String(body.sobreagendarMotivo ?? '').trim().slice(0, 200)
  const esMedico = acc.role === 'medico' || acc.role === 'admin'
  const quiereSobreagendar = motivoSobreagenda.length >= 5 && esMedico
  if (motivoSobreagenda.length >= 5 && !esMedico) {
    return NextResponse.json({
      error: 'Sólo el médico puede agendar encima de otra cita. Pídeselo y él lo autoriza desde su sesión.',
    }, { status: 403 })
  }

  const limpia: Record<string, unknown> = {}
  for (const k of CAMPOS_CITA) {
    const v = (appointment as Record<string, unknown>)[k]
    if (v !== undefined) limpia[k] = v
  }

  const fecha = appointment.fechaHora.slice(0, 10)
  const hora = appointment.fechaHora.slice(11, 16)
  const duracion = appointment.duracion || 30
  const medicoId = appointment.medicoId
  const now = new Date().toISOString()
  const apptsCol = adminDb.collection('clinics').doc(clinicId).collection('appointments')

  const [h, m] = hora.split(':').map(Number)
  const start = h * 60 + m
  const end = start + duracion

  /**
   * DÍA Y HORARIO: se valida en el SERVIDOR, como ya hacía el booking público.
   *
   * Aquí no se validaba nada de esto, así que desde el panel se podía agendar en
   * domingo, en festivo o fuera del horario — el modal sustituye el desplegable de
   * horas por un campo libre justo cuando no hay huecos, que es exactamente el
   * caso de un día no laborable.
   */
  const cfgSnap = await adminDb.collection('clinics').doc(clinicId).collection('config').doc('main').get()
  const cfg = cfgSnap.data()
  if (cfg) {
    /**
     * HORARIO POR MÉDICO, no solo el de la clínica.
     *
     * Cada médico puede tener su propio horario/duraciones (subcolección
     * `doctors`). El modal genera los huecos con ESE horario, pero aquí se validaba
     * solo contra `config/main`: si el doctor trabaja un día que la clínica marca
     * inactivo (o más tarde que ella), el servidor rechazaba con 409 una cita que
     * el modal sí ofrecía. Se carga el doc del médico y sus campos pisan a los de
     * la clínica (fallback a `main` si el médico no define alguno).
     */
    let cfgEfectiva = cfg as unknown as import('@/types').ClinicConfig
    if (medicoId) {
      const docSnap = await adminDb.collection('clinics').doc(clinicId).collection('doctors').doc(medicoId).get()
      const doc = docSnap.data()
      if (doc) {
        cfgEfectiva = {
          ...cfgEfectiva,
          horario: doc.horario ?? cfgEfectiva.horario,
          duraciones: doc.duraciones ?? cfgEfectiva.duraciones,
          intervaloMinutos: doc.intervaloMinutos ?? cfgEfectiva.intervaloMinutos,
          zonaHoraria: doc.zonaHoraria ?? cfgEfectiva.zonaHoraria,
        }
      }
    }
    const { getDaySchedule, validarHorarioDia } = await import('@/lib/availability')
    const schedule = getDaySchedule(fecha, cfgEfectiva)
    if (!schedule) {
      return NextResponse.json({ error: 'Ese día el consultorio no da servicio' }, { status: 409 })
    }
    const vh = validarHorarioDia(schedule.inicio, schedule.fin)
    if (!vh.valido || start < vh.startMin || end > vh.endMin) {
      return NextResponse.json({ error: `Fuera del horario de ese día (${schedule.inicio}–${schedule.fin})` }, { status: 409 })
    }

    /**
     * LOS BLOQUEOS TAMBIÉN SE VALIDAN AQUÍ, NO SÓLO EN EL NAVEGADOR.
     *
     * Quien comprobaba vacaciones, ausencias y quirófano era el modal, con la
     * lista de bloqueos que cargó AL ABRIRSE. El borde era asimétrico: el
     * booking público sí lo verifica en el servidor; el panel no.
     *
     * El caso que lo rompe no es raro: la asistente deja el modal abierto, el
     * médico crea un bloqueo por cirugía, y veinte minutos después la asistente
     * guarda encima del quirófano con el servidor diciendo que sí.
     *
     * Se responde 409 con el mismo lenguaje que el portal público, para que el
     * mensaje diga qué pasó y no «error».
     */
    const bloquesSnap = await adminDb.collection('clinics').doc(clinicId).collection('time_blocks').get()
    const bloques = bloquesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as unknown as import('@/lib/time-blocks-core').TimeBlock[]
    if (bloques.length) {
      const { estaBloqueado } = await import('@/lib/time-blocks-core')
      const tzClinica = (cfgEfectiva.zonaHoraria as string) || (await import('@/lib/timezone')).TZ_DEFAULT
      const bloque = estaBloqueado(appointment.fechaHora, bloques, medicoId, tzClinica)
      if (bloque) {
        return NextResponse.json({ error: `Ese horario está bloqueado (${bloque.motivo || bloque.tipo || 'ausencia'})` }, { status: 409 })
      }
    }
  }

  const CONFLICTO = Symbol('conflicto')
  let id = ''
  try {
    // Centinela por médico+día: la transacción lo LEE y lo ESCRIBE, forzando a
    // Firestore a serializar dos reservas simultáneas del mismo día (una query
    // dentro de la tx NO bloquea inserciones fantasma por sí sola). El perdedor
    // reintenta, re-consulta y ya ve la cita del ganador → detecta el conflicto.
    /**
     * UN CENTINELA POR DÍA, no por médico+día.
     *
     * La llave era `{medicoId || 'sin'}_{fecha}`, pero la lógica de conflicto dice
     * que una cita SIN medicoId choca contra las de TODOS los médicos. Es decir:
     * la reserva "sin médico" quería serializarse contra todos y sin embargo
     * tomaba un documento centinela distinto al de cada uno — dos transacciones
     * que debían competir no se veían entre sí.
     *
     * Con un centinela por día se serializa de más (dos reservas del mismo día
     * para médicos distintos se ponen en fila), pero es CORRECTO. Dos reservas
     * simultáneas del mismo día son raras; un empalme deja a un paciente sin
     * atención.
     */
    const diaRef = adminDb.collection('clinics').doc(clinicId).collection('slot_locks').doc(fecha)
    await adminDb.runTransaction(async (tx) => {
      await tx.get(diaRef)  // read: fija la versión del día para la serialización
      const snap = await tx.get(
        apptsCol.where('fechaHora', '>=', `${fecha} 00:00`).where('fechaHora', '<=', `${fecha} 23:59`)
      )
      let conflicto = false
      snap.forEach(d => {
        const a = d.data()
        if (['cancelada', 'reagendada', 'no-asistio'].includes(a.estado)) return
        if (d.id === reagendarId) return   // la propia cita que se está moviendo
        if (medicoId && a.medicoId && a.medicoId !== medicoId) return
        const [ah, am] = (a.fechaHora?.slice(11, 16) || '00:00').split(':').map(Number)
        const aStart = ah * 60 + am
        const aEnd = aStart + (a.duracion ?? 30)
        if (start < aEnd && end > aStart) conflicto = true
      })
      if (conflicto && !quiereSobreagendar) throw CONFLICTO
      if (conflicto) {
        // Queda EN LA CITA, no sólo en la bitácora: quien la abra mañana tiene
        // que ver que se puso encima de otra y por qué.
        limpia.sobreagendada = true
        limpia.sobreagendadaMotivo = motivoSobreagenda
        limpia.sobreagendadaPor = acc.uid
        limpia.sobreagendadaEn = now
      }

      tx.set(diaRef, { ultimaReserva: now }, { merge: true })  // write: invalida la tx concurrente
      if (reagendarId) {
        // REAGENDAR por la misma vía transaccional. Antes la edición iba por
        // `updateAppointment` directo desde el navegador: sin transacción, sin
        // re-chequeo en servidor y sin tocar el centinela, así que mover una cita
        // encima de otra no competía siquiera con las altas nuevas. Dos personas
        // podían dejar dos pacientes en el mismo horario sin ningún aviso.
        const ref = apptsCol.doc(reagendarId)
        tx.set(ref, { ...limpia, updatedAt: now, updatedPor: acc.uid }, { merge: true })
        id = reagendarId
      } else {
        const ref = apptsCol.doc()
        tx.set(ref, { ...limpia, createdAt: now, updatedAt: now, creadoPor: acc.uid, updatedPor: acc.uid })
        id = ref.id
      }
    })
  } catch (e) {
    if (e === CONFLICTO) {
      // `sobreagendable` le dice a la pantalla que existe una salida autorizada,
      // en vez de dejar al usuario contra un muro.
      return NextResponse.json({ error: 'Ese horario ya está ocupado.', sobreagendable: esMedico }, { status: 409 })
    }
    throw e
  }
  return NextResponse.json({ id, sobreagendada: quiereSobreagendar })
}
