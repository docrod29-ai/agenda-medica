import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import admin, { adminDb } from '@/lib/firebase-admin'
import { puedeTocarDesdeElPortal, MENSAJE_ESTADO_NO_TOCABLE } from '@/lib/portal/estados'
import { sincronizarCitaDelPortal, estadoDeSync } from '@/lib/calendario/sincronizar-servidor'
import { ofrecerHuecoLiberado } from '@/lib/whatsapp/ofrecer-hueco'
import { avisarAlConsultorio, telefonoDelConsultorio } from '@/lib/whatsapp/avisar-consultorio'
import { limpiarRespuestas, tieneContenido } from '@/lib/portal/formulario-previo'
import { verificarTokenPaciente, tokenVigente } from '@/lib/patient-token'
import { limitarOResponder } from '@/lib/rate-limit'
import { getAvailableSlots } from '@/lib/availability'
import { ocupadoEnGoogle } from '@/lib/calendario/ocupado-servidor'
import { instanteMX, TZ_DEFAULT } from '@/lib/timezone'
import type { Appointment, ClinicConfig } from '@/types'
import type { TimeBlock } from '@/lib/time-blocks-core'
import type { NotaMedica } from '@/types/expediente'

/**
 * API del Portal del Paciente (magic-link, sin contraseña).
 * POST con { action, token, ... }. El token (HMAC) ata la sesión a UN paciente
 * de UNA clínica; toda lectura/escritura se filtra por ese patientId.
 *
 * Acciones: session | confirmar | cancelar | slots | reagendar | formulario | documentos
 */

const MIN_HORAS_DEFECTO = 24

/**
 * EL OFFSET DEL CONSULTORIO, NO UN -06:00 QUEMADO.
 *
 * Este cálculo decide si el paciente todavía llega a la política de «reagenda
 * hasta 24 h antes». Con el offset fijo, un consultorio en Tijuana (UTC-8)
 * cerraba la puerta dos horas antes de lo que debía, y en Cancún (UTC-5, y es
 * mercado real) dos horas después. El resto del repo ya usa `instanteMX`.
 */
function horasHasta(fechaHora: string, tz: string): number {
  const s = String(fechaHora ?? '')
  const t = instanteMX(s.slice(0, 10), s.slice(11, 16), tz).getTime()
  return (t - Date.now()) / 3_600_000
}



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

/**
 * LOS BLOQUEOS DEL CONSULTORIO, QUE ESTA RUTA IGNORABA.
 *
 * `getAvailableSlots` recibía `[]` como lista de bloqueos en los dos sitios que
 * calculan huecos aquí. Era la ÚNICA vía de escritura de citas que no consultaba
 * `time_blocks` en ningún punto: el médico bloqueaba la semana por vacaciones y
 * un paciente con su enlace se reagendaba al miércoles, confirmado y sin aviso.
 */
async function leerBloques(clinicId: string): Promise<TimeBlock[]> {
  const snap = await adminDb.collection('clinics').doc(clinicId).collection('time_blocks').get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as unknown as TimeBlock[]
}

/**
 * LOS BLOQUEOS DEL DÍA, INCLUIDO LO QUE EL MÉDICO TIENE EN GOOGLE.
 *
 * ── EL HUECO QUE QUEDABA ─────────────────────────────────────────────────────
 *
 * El panel del consultorio, el booking público y el bot de WhatsApp ya
 * descontaban el calendario personal del médico. El **reagendado del paciente
 * desde su enlace** no: miraba sólo las citas de NexusMED y los bloqueos
 * capturados a mano.
 *
 * Así que el paciente que movía su cita del martes al jueves podía caer justo
 * encima de la cirugía que el médico tiene apuntada en su Google Calendar. Y
 * peor que reservar encima: la reserva **se aceptaba** —el reagendado no falla,
 * confirma— y el consultorio se enteraba el jueves.
 *
 * Va en los DOS sitios a propósito. Enseñar el hueco y rechazarlo al confirmar
 * es un formulario que miente; validarlo sin ofrecerlo bien es ofrecer horas que
 * no existen. Los dos caminos tienen que ver lo mismo.
 *
 * ── Y SE CONSULTA FUERA DE LA TRANSACCIÓN ────────────────────────────────────
 *
 * Una transacción de Firestore puede reintentarse; una llamada de red dentro se
 * repetiría con ella. Los bloqueos se traen antes y entran ya resueltos.
 */
async function bloquesDelDia(
  clinicId: string, fecha: string, medicoId: string | undefined,
  cfg: { zonaHoraria?: string; googleCalendarId?: string } | null,
): Promise<TimeBlock[]> {
  const locales = await leerBloques(clinicId)
  const g = await ocupadoEnGoogle(clinicId, medicoId, fecha, {
    zonaHoraria: cfg?.zonaHoraria, googleCalendarId: cfg?.googleCalendarId,
  })
  if (g.fallo) {
    // Nunca se esconde el día entero por un fallo de red: se sigue como antes y
    // queda dicho, porque un hueco ofrecido de más se nota y un día en blanco
    // sin explicación no.
    safeLog.warn(`[portal] ${clinicId} ${fecha}: no se pudo leer el Google Calendar del médico; los huecos NO lo tienen en cuenta.`)
  }
  return [...locales, ...g.bloqueos]
}

async function leerCita(clinicId: string, citaId: string): Promise<Appointment | null> {
  const snap = await adminDb.collection('clinics').doc(clinicId).collection('appointments').doc(citaId).get()
  return snap.exists ? ({ id: snap.id, ...(snap.data() as Omit<Appointment, 'id'>) }) : null
}

export async function POST(req: NextRequest) {
  let body: {
    action?: string; token?: string; citaId?: string; fecha?: string; nuevaFechaHora?: string
    /** Formulario previo a la consulta (P-019): lo escribe el paciente. */
    respuestas?: unknown
  }
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

  /**
   * LÍMITE DE TASA — el token viaja por WhatsApp y puede reenviarse o filtrarse.
   *
   * Todas las demás rutas del paciente (telesalud/sala, public/booking) frenan
   * el abuso con `limitarOResponder`; ésta, que puede leer, cancelar y mover
   * la agenda entera del consultorio con el mismo enlace, no tenía nada. Una
   * clave por token —no por IP— porque es la sesión del paciente la que hay
   * que acotar, y un enlace filtrado puede llegar desde cualquier IP.
   */
  const limite = await limitarOResponder(`portal:${clinicId}:${patientId}`, 40, 600,
    'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.')
  if (limite) return limite

  /**
   * ¿SIGUE VIGENTE ESTE ENLACE?
   *
   * La firma y la caducidad no bastaban: no había forma de invalidar un enlace
   * ya emitido —teléfono perdido, número reciclado, mensaje reenviado— y la
   * única salida era esperar a que caducara. El expediente lleva ahora un
   * contador; subirlo tumba de golpe todos los enlaces anteriores.
   *
   * Si la lectura falla se deja pasar: dejar al paciente fuera de su propia
   * agenda por un mal minuto de Firestore es peor que el riesgo que esto acota,
   * y la firma y la caducidad siguen protegiendo.
   */
  try {
    const pSnap = await adminDb.collection('clinics').doc(clinicId).collection('patients').doc(patientId).get()
    const vPaciente = (pSnap.data() as { portalTokenVersion?: number } | undefined)?.portalTokenVersion
    if (!tokenVigente(sesion.version, vPaciente)) {
      return NextResponse.json({ error: 'Este enlace ya no es válido. Pídele uno nuevo al consultorio.' }, { status: 401 })
    }
  } catch { /* ver arriba */ }

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
          // La sala de teleconsulta se abre con `/teleconsulta/{citaId}?c={clinicId}`,
          // y el portal no tenía el clinicId: por eso el paciente no tenía puerta
          // de entrada a su videoconsulta. No es un dato sensible — ya viaja en la
          // URL pública de reserva.
          clinicId,
          clinica: config ? {
            nombre: config.nombreClinica || config.nombreMedico || 'Consultorio',
            medico: config.nombreMedico || '',
            telefono: config.whatsappConsultorio || config.telefonoAdmin || '',
            direccion: config.direccion || '',
          } : null,
          minHoras: (config as { politicaCancelacionHoras?: number } | null)?.politicaCancelacionHoras ?? MIN_HORAS_DEFECTO,
          // La pantalla del paciente también decide «próximas vs pasadas» con una
          // hora de pared: sin la zona del consultorio lo hacía con -06:00 fijo.
          zonaHoraria: config?.zonaHoraria || TZ_DEFAULT,
          anticipo: config?.anticipoLink ? { link: config.anticipoLink, monto: config.anticipoMonto ?? 0 } : null,
          citas: citas.sort((a, b) => a.fechaHora.localeCompare(b.fechaHora)),
        })
      }

      case 'confirmar': {
        const cita = await citaDelPaciente(body.citaId)
        if (cita instanceof NextResponse) return cita
        if (!puedeTocarDesdeElPortal(cita, { permiteCobrada: true })) {
          return NextResponse.json({ error: MENSAJE_ESTADO_NO_TOCABLE }, { status: 409 })
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
        if (!puedeTocarDesdeElPortal(cita)) {
          return NextResponse.json({ error: MENSAJE_ESTADO_NO_TOCABLE }, { status: 409 })
        }
        const config = await leerConfig(clinicId)
        const minHoras = (config as { politicaCancelacionHoras?: number } | null)?.politicaCancelacionHoras ?? MIN_HORAS_DEFECTO
        if (horasHasta(cita.fechaHora, config?.zonaHoraria || TZ_DEFAULT) < minHoras) {
          return NextResponse.json({ error: `Cancelación en línea hasta ${minHoras}h antes. Llama al consultorio.` }, { status: 422 })
        }
        await adminDb.collection('clinics').doc(clinicId).collection('appointments').doc(cita.id).update({
          estado: 'cancelada',
          updatedAt: new Date().toISOString(),
          updatedPor: 'paciente',
        })

        /**
         * TRES COSAS QUE NO PASABAN CUANDO CANCELABA EL PACIENTE.
         *
         * La cancelación desde el portal mutaba el estado y ahí terminaba:
         *
         *  · el hueco quedaba libre y NO se le ofrecía a nadie —la oferta vivía
         *    detrás de `verificarMiembro`, así que sólo el consultorio podía
         *    dispararla y esta cancelación es justo la que nadie del equipo ve—;
         *  · no quedaba asiento en la bitácora, pese a mutar el estado con
         *    `updatedPor: 'paciente'` (trazabilidad NOM-024); el alta pública sí
         *    lo escribe, así que eran dos caminos con dos criterios;
         *  · y el consultorio no se enteraba hasta mirar la agenda.
         *
         * Nada de esto puede tumbar la cancelación: el paciente ya la pidió y
         * ya está hecha.
         */
        /**
         * Y EL EVENTO DE GOOGLE, QUE SE QUEDABA VIVO.
         *
         * Cancelar en Nexus dejaba el evento en el calendario del médico: él ve
         * ocupada una hora que ya está libre, no se la ofrece a nadie, y si el
         * paciente estaba invitado sigue con el recordatorio de una cita que ya
         * canceló. Es la cara opuesta del mismo hueco que el reagendado.
         *
         * Sin vínculo médico ↔ calendario no se toca nada: el estado queda en
         * `error` y el médico lo resuelve desde su sesión, donde sí hay token.
         */
        if (cita.googleCalendarEventId) {
          const r = await sincronizarCitaDelPortal(clinicId, cita, 'borrar', config)
          const estado = estadoDeSync(r)
          if (estado) {
            await adminDb.collection('clinics').doc(clinicId).collection('appointments')
              .doc(cita.id).update({ googleCalendarSyncStatus: estado }).catch(() => {})
          }
        }

        void adminDb.collection('clinics').doc(clinicId).collection('audit_log').add({
          evento: 'cita_cancelada_portal',
          clinicId, patientId, citaId: cita.id,
          timestamp: new Date().toISOString(),
          meta: { fechaHora: cita.fechaHora, tipo: cita.tipo, medicoId: cita.medicoId ?? '', origen: 'portal-paciente' },
        }).catch(() => { /* la bitácora no puede tumbar el derecho del paciente */ })

        void ofrecerHuecoLiberado(clinicId, {
          fecha: cita.fechaHora.slice(0, 10),
          hora: cita.fechaHora.slice(11, 16),
          tipo: cita.tipo,
          duracion: cita.duracion,
          // Sin médico, el hueco de una doctora se le ofrecería a quien espera
          // con otro: el mismo fallo que ya se reparó en el modal de citas.
          medicoId: cita.medicoId,
        }).catch(() => { /* ídem */ })

        /**
         * Y cuenta como cancelación del paciente.
         *
         * `cancelacionCount` alimenta el badge de riesgo de no-show y el CRM, y
         * el menú de Citas SÍ lo incrementa (`lib/agenda/contadores-paciente`).
         * Cancelando desde el enlace —el camino que el paciente usa cuando de
         * verdad no va a venir— no se incrementaba nunca: el motor de riesgo veía
         * a un paciente impecable.
         */
        void adminDb.collection('clinics').doc(clinicId).collection('patients').doc(patientId).update({
          cancelacionCount: admin.firestore.FieldValue.increment(1),
          updatedAt: new Date().toISOString(),
        }).catch(() => { /* el contador no puede tumbar la cancelación */ })

        /**
         * Y SE LE AVISA AL CONSULTORIO.
         *
         * v863 dejó el asiento en la bitácora y la oferta del hueco a la lista de
         * espera, pero el consultorio seguía enterándose sólo si miraba la agenda:
         * un paciente que cancela a las 11 de la noche desaparecía de la lista del
         * día siguiente sin que nadie lo supiera. El bot ya avisa de sus
         * cancelaciones; este camino no.
         */
        void avisarAlConsultorio(
          clinicId,
          telefonoDelConsultorio(config),
          [
            `🔔 *Cancelación desde el portal*`,
            ``,
            `👤 ${cita.pacienteNombre ?? ''}`,
            `📅 ${cita.fechaHora}`,
            ``,
            `El hueco ya se ofreció a la lista de espera.`,
          ].join('\n'),
          'cancelacion-portal',
        )

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
        const bloquesSlots = await bloquesDelDia(clinicId, body.fecha, cita.medicoId, config)
        const slots = getAvailableSlots(body.fecha, cita.duracion || 30, citasDia, config, cita.id, bloquesSlots, cita.medicoId)
        return NextResponse.json({ slots })
      }

      case 'reagendar': {
        const cita = await citaDelPaciente(body.citaId)
        if (cita instanceof NextResponse) return cita
        // Reagendar mueve el hueco: la misma lista blanca que confirmar, y
        // tampoco se toca una cita ya cobrada — mover dinero de día es del
        // consultorio, no del paciente.
        if (!puedeTocarDesdeElPortal(cita)) {
          return NextResponse.json({ error: MENSAJE_ESTADO_NO_TOCABLE }, { status: 409 })
        }
        const config = await leerConfig(clinicId)
        const minHoras = (config as { politicaCancelacionHoras?: number } | null)?.politicaCancelacionHoras ?? MIN_HORAS_DEFECTO
        if (horasHasta(cita.fechaHora, config?.zonaHoraria || TZ_DEFAULT) < minHoras) {
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
        /**
         * SIN CONFIGURACIÓN NO SE REAGENDA.
         *
         * El `if (config)` de más abajo dejaba pasar la escritura SIN validar
         * nada cuando la lectura de config fallaba o el documento no existía:
         * el hueco se aceptaba tal cual llegó del navegador. Un fallo de lectura
         * no puede convertirse en «cualquier hora vale».
         */
        if (!config) {
          return NextResponse.json({ error: 'No se pudo leer el horario del consultorio. Intenta de nuevo o llama al consultorio.' }, { status: 503 })
        }
        const bloques = await bloquesDelDia(clinicId, fecha, cita.medicoId, config)

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
            const libres = getAvailableSlots(fecha, cita.duracion || 30, citasDia, config, cita.id, bloques, cita.medicoId)
            if (!libres.includes(hhmm)) throw CONFLICTO
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
         * invitado— seguía diciendo martes.
         *
         * ANTES no se sincronizaba a propósito, y el motivo estaba escrito aquí:
         * el token vive en `googleTokens/{uid}` y quien reagenda es el paciente,
         * así que no había forma de saber cuál de los médicos conectó ese
         * calendario. **Ese motivo dejó de ser cierto**: v875 empezó a escribir
         * el vínculo `doctors/{id}.uid`, v899 lo rellenó para los que ya estaban
         * conectados, y desde v876 la disponibilidad pública ya LEE el freebusy
         * con él. Ahora se usa el mismo vínculo para escribir.
         *
         * Sigue sin adivinarse nada: sin vínculo no se toca ningún calendario y
         * la cita queda marcada, que es la verdad. Y esto no puede tumbar el
         * reagendado — ya está hecho en Nexus, que es la fuente de verdad.
         */
        if (cita.googleCalendarEventId) {
          const r = await sincronizarCitaDelPortal(
            clinicId,
            { ...cita, fechaHora: nuevaFechaHora },
            'mover',
            config,
          )
          const estado = estadoDeSync(r)
          if (estado) await citaRef.update({ googleCalendarSyncStatus: estado }).catch(() => {})
        }

        // Reagendar TAMBIÉN libera un hueco —el viejo— y también hay que dejar
        // rastro de quién movió qué. Mismo criterio que cancelar.
        void adminDb.collection('clinics').doc(clinicId).collection('audit_log').add({
          evento: 'cita_reagendada_portal',
          clinicId, patientId, citaId: cita.id,
          timestamp: new Date().toISOString(),
          meta: { de: cita.fechaHora, a: nuevaFechaHora, tipo: cita.tipo, medicoId: cita.medicoId ?? '', origen: 'portal-paciente' },
        }).catch(() => {})

        void ofrecerHuecoLiberado(clinicId, {
          fecha: cita.fechaHora.slice(0, 10),
          hora: cita.fechaHora.slice(11, 16),
          tipo: cita.tipo,
          duracion: cita.duracion,
          medicoId: cita.medicoId,
        }).catch(() => {})

        /**
         * Y AL CONSULTORIO — que aquí importa MÁS que en una cancelación.
         *
         * La cita no desapareció: se movió. Quien tenga impresa o memorizada la
         * lista del día sigue esperando a este paciente a la hora vieja, y a la
         * hora nueva le llega alguien que «no estaba». La cancelación al menos
         * deja un hueco visible; un reagendado silencioso deja dos errores.
         *
         * Además la cita vuelve a `pendiente-confirmar`, así que hay que
         * confirmarla de nuevo — y nadie sabía que había que hacerlo.
         */
        void avisarAlConsultorio(
          clinicId,
          telefonoDelConsultorio(config),
          [
            `🔔 *Cita movida desde el portal*`,
            ``,
            `👤 ${cita.pacienteNombre ?? ''}`,
            `📅 Antes: ${cita.fechaHora}`,
            `📅 Ahora: ${nuevaFechaHora}`,
            ``,
            `Quedó en *pendiente de confirmar*. El hueco viejo ya se ofreció a la lista de espera.`,
          ].join('\n'),
          'reagenda-portal',
        )

        return NextResponse.json({ ok: true })
      }

      /**
       * FORMULARIO PREVIO A LA CONSULTA (P-019).
       *
       * Lo escribe el paciente en su casa, con calma, y NO toca el expediente:
       * se guarda en su propia subcolección marcado como dicho por él. Si
       * escribiera en `patient.alergias`, un «no» suyo borraría una alergia a
       * penicilina documentada — y de ese campo dependen la compuerta de la
       * receta y el cruce de la nota. Ver `lib/portal/formulario-previo.ts`.
       */
      case 'formulario': {
        const respuestas = limpiarRespuestas(body.respuestas)
        if (!tieneContenido(respuestas)) {
          return NextResponse.json({ error: 'No hay nada que guardar.' }, { status: 400 })
        }
        const ahora = new Date().toISOString()
        // Uno por PACIENTE, reescribible: el paciente puede corregir lo que puso
        // hasta que entre a consulta. Si se guardara uno por envío, el médico
        // tendría que adivinar cuál es el bueno.
        await adminDb.collection('clinics').doc(clinicId)
          .collection('patients').doc(patientId)
          .collection('formularios_previos').doc('actual')
          .set({ respuestas, enviadoEn: ahora, origen: 'paciente' }, { merge: false })

        void adminDb.collection('clinics').doc(clinicId).collection('audit_log').add({
          evento: 'formulario_previo_enviado',
          clinicId, patientId, timestamp: ahora,
          meta: { campos: Object.keys(respuestas), origen: 'portal-paciente' },
        }).catch(() => {})

        /**
         * Y SE LE AVISA AL CONSULTORIO — el mismo hueco que v887 cerró para las
         * citas, y que yo volví a abrir en v889.
         *
         * El paciente escribe lo suyo la noche antes y el médico sólo lo ve si
         * abre la consulta y mira la tarjeta. Un formulario que llega el día
         * antes con «soy alérgico a la penicilina» merece que alguien lo sepa
         * ANTES de que el paciente esté sentado enfrente.
         *
         * No viaja el contenido: es dato de salud y WhatsApp es un canal
         * externo. Sólo que llegó y de quién — lo demás se lee en el expediente,
         * donde está protegido.
         */
        void avisarAlConsultorio(
          clinicId,
          telefonoDelConsultorio(await leerConfig(clinicId)),
          [
            `📝 *Un paciente llenó su información previa*`,
            ``,
            `👤 ${(await leerCitasPaciente(clinicId, patientId))[0]?.pacienteNombre ?? 'Paciente del portal'}`,
            ``,
            `Lo escribió antes de su consulta. Ábrelo en su expediente: NO viaja por aquí porque son datos de salud.`,
          ].join('\n'),
          'formulario-previo',
        )

        return NextResponse.json({ ok: true, enviadoEn: ahora })
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
