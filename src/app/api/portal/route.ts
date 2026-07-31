import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { verificarTokenPaciente } from '@/lib/patient-token'
import { getAvailableSlots } from '@/lib/availability'
import type { Appointment, ClinicConfig } from '@/types'
import type { NotaMedica } from '@/types/expediente'

/**
 * API del Portal del Paciente (magic-link, sin contraseña).
 * POST con { action, token, ... }. El token (HMAC) ata la sesión a UN paciente
 * de UNA clínica; toda lectura/escritura se filtra por ese patientId.
 *
 * Acciones: session | confirmar | cancelar | slots | reagendar
 */

const MIN_HORAS_DEFECTO = 24

function horasHasta(fechaHora: string): number {
  // fechaHora = 'YYYY-MM-DD HH:mm' en hora de México (UTC-6, sin DST)
  const t = new Date(fechaHora.replace(' ', 'T') + ':00-06:00').getTime()
  return (t - Date.now()) / 3_600_000
}

const TERMINALES = new Set(['atendida', 'finalizada', 'cancelada', 'no-asistio', 'reagendada'])

async function leerCitasPaciente(clinicId: string, patientId: string): Promise<Appointment[]> {
  const snap = await adminDb
    .collection('clinics').doc(clinicId)
    .collection('appointments')
    .where('pacienteId', '==', patientId)
    .get()
  /**
   * LISTA BLANCA, no `...spread` del documento.
   *
   * Se devolvía la cita CRUDA al paciente. Entre sus campos viaja
   * `notasInternas`, que el propio tipo describe como "notas del dueño sobre este
   * cliente (no visibles al cliente)": ahí es donde el consultorio anota que
   * alguien es moroso o conflictivo, o una sospecha clínica todavía no
   * comunicada. La interfaz del portal solo pintaba un subconjunto, así que no
   * se veía — pero estaba en el JSON, a un DevTools de distancia.
   *
   * También se iban `cobroId`, `cobradoEn`, `googleCalendarEventId` y quién creó
   * o modificó la cita, que son datos internos del consultorio.
   *
   * Se enumera lo que el paciente SÍ puede ver. Con `spread`, cualquier campo
   * nuevo que se añada a la cita mañana se filtraría solo.
   */
  return snap.docs.map(d => {
    const a = d.data() as Appointment
    return {
      id: d.id,
      fechaHora: a.fechaHora,
      duracion: a.duracion,
      tipo: a.tipo,
      motivo: a.motivo,
      estado: a.estado,
      medicoId: a.medicoId,
      medicoNombre: a.medicoNombre,
      pacienteId: a.pacienteId,
      pacienteNombre: a.pacienteNombre,
      confirmadoPaciente: a.confirmadoPaciente,
    } as Appointment
  })
}

async function leerConfig(clinicId: string): Promise<ClinicConfig | null> {
  const snap = await adminDb.collection('clinics').doc(clinicId).collection('config').doc('main').get()
  return snap.exists ? (snap.data() as ClinicConfig) : null
}

async function leerCita(clinicId: string, citaId: string): Promise<Appointment | null> {
  const snap = await adminDb.collection('clinics').doc(clinicId).collection('appointments').doc(citaId).get()
  return snap.exists ? ({ id: snap.id, ...(snap.data() as Omit<Appointment, 'id'>) }) : null
}

export async function POST(req: NextRequest) {
  let body: { action?: string; token?: string; citaId?: string; fecha?: string; nuevaFechaHora?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
  }

  const sesion = verificarTokenPaciente(body.token)
  if (!sesion) {
    return NextResponse.json({ error: 'Enlace inválido o vencido' }, { status: 401 })
  }
  const { clinicId, patientId, alcance } = sesion

  // Helper: asegura que la cita pertenezca a este paciente
  const citaDelPaciente = async (citaId?: string): Promise<Appointment | NextResponse> => {
    if (!citaId) return NextResponse.json({ error: 'Falta la cita' }, { status: 400 })
    const cita = await leerCita(clinicId, citaId)
    if (!cita || cita.pacienteId !== patientId) {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
    }
    return cita
  }

  try {
    switch (body.action) {
      case 'session': {
        const [citas, config] = await Promise.all([leerCitasPaciente(clinicId, patientId), leerConfig(clinicId)])
        const paciente = citas[0]?.pacienteNombre ?? ''
        return NextResponse.json({
          paciente,
          clinica: config ? {
            nombre: config.nombreClinica || config.nombreMedico || 'Consultorio',
            medico: config.nombreMedico || '',
            telefono: config.whatsappConsultorio || config.telefonoAdmin || '',
            direccion: config.direccion || '',
          } : null,
          minHoras: (config as { politicaCancelacionHoras?: number } | null)?.politicaCancelacionHoras ?? MIN_HORAS_DEFECTO,
          anticipo: config?.anticipoLink ? { link: config.anticipoLink, monto: config.anticipoMonto ?? 0 } : null,
          citas: citas.sort((a, b) => a.fechaHora.localeCompare(b.fechaHora)),
        })
      }

      case 'confirmar': {
        const cita = await citaDelPaciente(body.citaId)
        if (cita instanceof NextResponse) return cita
        if (TERMINALES.has(cita.estado)) {
          return NextResponse.json({ error: 'Esta cita ya no puede confirmarse' }, { status: 409 })
        }
        await adminDb.collection('clinics').doc(clinicId).collection('appointments').doc(cita.id).update({
          confirmadoPaciente: true,
          fechaConfirmacion: new Date().toISOString(),
          estado: 'confirmada',
          updatedAt: new Date().toISOString(),
          updatedPor: 'paciente',
        })
        return NextResponse.json({ ok: true })
      }

      case 'cancelar': {
        const cita = await citaDelPaciente(body.citaId)
        if (cita instanceof NextResponse) return cita
        if (TERMINALES.has(cita.estado)) {
          return NextResponse.json({ error: 'Esta cita ya no puede cancelarse' }, { status: 409 })
        }
        const config = await leerConfig(clinicId)
        const minHoras = (config as { politicaCancelacionHoras?: number } | null)?.politicaCancelacionHoras ?? MIN_HORAS_DEFECTO
        if (horasHasta(cita.fechaHora) < minHoras) {
          return NextResponse.json({ error: `Cancelación en línea hasta ${minHoras}h antes. Llama al consultorio.` }, { status: 422 })
        }
        await adminDb.collection('clinics').doc(clinicId).collection('appointments').doc(cita.id).update({
          estado: 'cancelada',
          updatedAt: new Date().toISOString(),
          updatedPor: 'paciente',
        })
        return NextResponse.json({ ok: true })
      }

      case 'slots': {
        const cita = await citaDelPaciente(body.citaId)
        if (cita instanceof NextResponse) return cita
        if (!body.fecha) return NextResponse.json({ error: 'Falta la fecha' }, { status: 400 })
        const config = await leerConfig(clinicId)
        if (!config) return NextResponse.json({ slots: [] })
        // Necesitamos TODAS las citas de la clínica ese día para detectar conflictos
        const snapDia = await adminDb.collection('clinics').doc(clinicId).collection('appointments')
          .where('fechaHora', '>=', `${body.fecha} 00:00`)
          .where('fechaHora', '<=', `${body.fecha} 23:59`)
          .get()
        const citasDia = snapDia.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Appointment, 'id'>) }))
        const slots = getAvailableSlots(body.fecha, cita.duracion || 30, citasDia, config, cita.id, [], cita.medicoId)
        return NextResponse.json({ slots })
      }

      case 'reagendar': {
        const cita = await citaDelPaciente(body.citaId)
        if (cita instanceof NextResponse) return cita
        if (TERMINALES.has(cita.estado)) {
          return NextResponse.json({ error: 'Esta cita ya no puede reagendarse' }, { status: 409 })
        }
        const config = await leerConfig(clinicId)
        const minHoras = (config as { politicaCancelacionHoras?: number } | null)?.politicaCancelacionHoras ?? MIN_HORAS_DEFECTO
        if (horasHasta(cita.fechaHora) < minHoras) {
          return NextResponse.json({ error: `Reagenda en línea hasta ${minHoras}h antes. Llama al consultorio.` }, { status: 422 })
        }
        if (!body.nuevaFechaHora || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(body.nuevaFechaHora)) {
          return NextResponse.json({ error: 'Horario inválido' }, { status: 400 })
        }
        const nuevaFechaHora = body.nuevaFechaHora
        const fecha = nuevaFechaHora.slice(0, 10)
        const hhmm = nuevaFechaHora.slice(11, 16)
        const dayQuery = adminDb.collection('clinics').doc(clinicId).collection('appointments')
          .where('fechaHora', '>=', `${fecha} 00:00`)
          .where('fechaHora', '<=', `${fecha} 23:59`)
        const citaRef = adminDb.collection('clinics').doc(clinicId).collection('appointments').doc(cita.id)

        // Transacción: re-leer el día y escribir de forma atómica (sin carrera check-then-write)
        const CONFLICTO = Symbol('conflicto')
        try {
          // Centinela por día, igual que /api/appointments, el booking público y
          // el bot. Sin él esta transacción no se serializaba contra ninguno de los
          // otros tres caminos, que dependen justo de ese documento.
          const diaRef = adminDb.collection('clinics').doc(clinicId).collection('slot_locks').doc(fecha)
          await adminDb.runTransaction(async (tx) => {
            await tx.get(diaRef)
            const snapDia = await tx.get(dayQuery)
            const citasDia = snapDia.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Appointment, 'id'>) }))
            if (config) {
              const libres = getAvailableSlots(fecha, cita.duracion || 30, citasDia, config, cita.id, [], cita.medicoId)
              if (!libres.includes(hhmm)) throw CONFLICTO
            }
            tx.set(diaRef, { ultimaReserva: new Date().toISOString() }, { merge: true })
            tx.update(citaRef, {
              fechaHora: nuevaFechaHora,
              estado: 'pendiente-confirmar',
              confirmadoPaciente: false,
              recordatorio24hEnviado: false,
              recordatorioMismoDiaEnviado: false,
              updatedAt: new Date().toISOString(),
              updatedPor: 'paciente',
            })
          })
        } catch (e) {
          if (e === CONFLICTO) return NextResponse.json({ error: 'Ese horario ya no está disponible' }, { status: 409 })
          throw e
        }
        /**
         * Google Calendar: la cita vieja se quedaba viva y nadie se enteraba.
         *
         * El paciente reagenda de martes a jueves desde su enlace: Nexus dice
         * jueves y el calendario del consultorio —y el del paciente, si está
         * invitado— sigue diciendo martes.
         *
         * NO se sincroniza desde aquí a propósito. El token de Google está guardado
         * POR USUARIO (`googleTokens/{uid}`), y quien reagenda es el paciente: no
         * hay forma de saber cuál de los médicos conectó ese calendario, y escribir
         * en el equivocado sería peor que no escribir. Adivinar con el dueño de la
         * clínica funcionaría solo si fue él quien lo conectó.
         *
         * Se marca como DESINCRONIZADA, que es la verdad, para que el panel pueda
         * mostrarlo y el médico lo arregle con un clic desde su sesión.
         */
        if (cita.googleCalendarEventId) {
          await citaRef.update({ googleCalendarSyncStatus: 'desincronizado' }).catch(() => {})
        }
        return NextResponse.json({ ok: true })
      }

      case 'documentos': {
        /**
         * E0-06 — ESTA es la acción que devuelve secreto médico (diagnósticos y
         * medicamentos de notas firmadas), y por eso exige alcance `clinico`.
         *
         * Sin este gate, el token que /api/portal/link devuelve al navegador de
         * CUALQUIER miembro —incluida la asistente, a quien firestore.rules mantiene
         * fuera de `patients/{id}/notas`— servía para leer el expediente por API.
         * Es el mismo agujero que ya se cerró en /api/telesalud/token.
         *
         * Fail-closed deliberado: los tokens de 30 días que ya circulan no traen
         * alcance, se degradan a `agenda` y pierden esta pestaña. Se resuelve
         * reenviando el enlace desde la sesión del médico.
         */
        if (alcance !== 'clinico') {
          return NextResponse.json(
            { error: 'Pide a tu médico el acceso a tus recetas.' },
            { status: 403 },
          )
        }
        // Recetas del paciente: derivadas de sus notas FIRMADAS con medicamentos.
        const snap = await adminDb
          .collection('clinics').doc(clinicId)
          .collection('patients').doc(patientId)
          .collection('notas')
          .where('estado', '==', 'firmada')
          .get()
        const docs = snap.docs
          .map(d => ({ id: d.id, ...(d.data() as Omit<NotaMedica, 'id'>) }))
          .filter(n => Array.isArray(n.medicamentos) && n.medicamentos.length > 0)
          .map(n => ({
            id: n.id,
            fecha: n.fechaConsulta,
            medico: n.firma?.nombreMedico ?? '',
            diagnostico: (n.diagnosticos ?? []).map(dx => dx.descripcion).filter(Boolean).join(', '),
            medicamentos: n.medicamentos ?? [],
          }))
          .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
        return NextResponse.json({ documentos: docs })
      }

      default:
        return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 })
    }
  } catch (e) {
    safeLog.error('[portal] error', e)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
