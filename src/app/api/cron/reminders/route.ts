import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { randomUUID } from 'node:crypto'
import { adminDb } from '@/lib/firebase-admin'
import { Appointment, ClinicConfig } from '@/types'
import { sendWhatsApp as sendWA } from '@/lib/whatsapp-send'
import { enviarProactivo } from '@/lib/whatsapp/proactivo'
import { entradasVencidas, resolverEntrada, reprogramarEntrada } from '@/lib/whatsapp/outbox'
import { normalizarTelefonoWa } from '@/lib/whatsapp/telefono'
import { instanteMX, hoyISO, sumarDiasISO, ahoraMinutosDelDia, TZ_DEFAULT } from '@/lib/timezone'
import { dondeEsLaCita, esTeleconsulta } from '@/lib/telesalud/donde-es'
import { crearTokenPaciente } from '@/lib/patient-token'
import { registrarLatido } from '@/lib/ops/latido'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * SIN ESTO, VERCEL LE DABA EL TIEMPO POR OMISIÓN.
 *
 * Este cron recorre TODOS los consultorios activos y manda WhatsApp por cada
 * cita. Cuando se acababa el tiempo dejaban de recibir recordatorios siempre los
 * mismos —los del final de la lista— y la ruta respondía 200: sin error visible,
 * y el consultorio se enteraba porque sus pacientes no llegaban.
 */
export const maxDuration = 300

const ESTADOS_POST_VISITA = ['atendida', 'finalizada', 'pagada']

/**
 * Crea una solicitud de reseña (server-side) y devuelve el link a enviar.
 * Mirror de reviews.crearSolicitudResena pero con adminDb (sin client SDK).
 */
async function crearSolicitudResenaAdmin(origin: string, clinicId: string, appt: Appointment): Promise<string> {
  const token = randomUUID().replace(/-/g, '')
  const now = new Date()
  await adminDb.collection('clinic_review_requests').doc(token).set({
    token, clinicId,
    citaId: appt.id,
    pacienteId: appt.pacienteId,
    pacienteNombre: appt.pacienteNombre,
    medicoNombre: appt.medicoNombre,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 30 * 86400_000).toISOString(),
    used: false,
  })
  return `${origin.replace(/\/$/, '')}/resena/${token}`
}

function buildWhatsAppMessage(
  template: string,
  data: {
    paciente: string
    fecha: string
    hora: string
    medico: string
    clinica: string
    direccion: string
    telefono: string
  }
): string {
  return template
    .replace(/\{paciente\}/g, data.paciente)
    .replace(/\{fecha\}/g, data.fecha)
    .replace(/\{hora\}/g, data.hora)
    .replace(/\{medico\}/g, data.medico)
    .replace(/\{clinica\}/g, data.clinica)
    .replace(/\{direccion\}/g, data.direccion)
    .replace(/\{telefono\}/g, data.telefono)
}

function formatDateES(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Thin wrapper — uses per-clinic credentials from whatsapp-send.ts.
 *  proactivo:true → respeta el opt-out del contacto y agrega el pie "Responda BAJA…". */
async function sendWhatsApp(phone: string, message: string, _config: ClinicConfig, clinicId: string): Promise<boolean> {
  const { ok } = await sendWA(clinicId, phone, message, { proactivo: true })
  return ok
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  // Fail-CLOSED: en producción SIN CRON_SECRET configurado el endpoint NO corre
  // (antes era fail-open: sin secreto, cualquiera podía disparar el cron). El Dr.
  // debe setear CRON_SECRET en Vercel (Vercel lo manda como Bearer al cron).
  if (!CRON_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'CRON_SECRET no configurado (fail-closed)' }, { status: 503 })
    }
  } else if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const arranqueCron = Date.now()
  try {
    const now = new Date()
    const totals = { sent: 0, failed: 0, skipped: 0, clinics: 0 }

    // ── Get all active clinics ────────────────────────────────
    const clinicsSnap = await adminDb.collection('clinics')
      .where('status', 'in', ['active', 'trial'])
      .get()

    for (const clinicDoc of clinicsSnap.docs) {
      const clinicId = clinicDoc.id
      totals.clinics++

      try {
        const configSnap = await adminDb
          .collection('clinics').doc(clinicId)
          .collection('config').doc('main').get()

        if (!configSnap.exists) continue

        const config = configSnap.data() as ClinicConfig
        /**
         * ZONA DEL CONSULTORIO, una sola vez y para TODO el bloque.
         *
         * Aquí estaba el defecto de la auditoría del 26-jul en su forma más clara:
         * tres líneas más abajo `instanteMX` SÍ recibía `config.zonaHoraria`, y
         * `hoyISO(tzClinica)` justo debajo NO — así que la misma iteración mezclaba la zona
         * del consultorio con America/Mexico_City. Para Hermosillo (UTC-7) o
         * Tijuana (UTC-8) eso corre el recordatorio 1-2 h, y en silencio: nadie ve
         * un error, sólo un mensaje que llega a deshora.
         */
        const tzClinica = config.zonaHoraria || TZ_DEFAULT
        /**
         * Las HORAS DE SILENCIO se calculan POR CONSULTORIO.
         *
         * Estaba fuera del bucle, así que un solo valor —el de la zona por
         * omisión— decidía si «ya es hora de no molestar» para TODAS las clínicas
         * a la vez. Un consultorio en Tijuana recibía la ventana de silencio de
         * la Ciudad de México, con 2 h de desfase.
         */
        const minMx = ahoraMinutosDelDia(tzClinica)
        if (!config.recordatorio24h && !config.recordatorioMismoDia && !config.resenaAutomatica) continue

        // Config de plantillas HSM de la clínica (whatsapp.plantillas) para la
        // decisión texto vs. plantilla fuera de la ventana de 24 h (WA-1).
        const waConfig = clinicDoc.data()?.whatsapp as {
          plantillas?: Record<string, { name?: string; lang?: string }>
          silencio?: { activo?: boolean; inicio?: string; fin?: string }
          topeDiarioProactivo?: number
        } | undefined

        // ── Get appointments for this clinic ─────────────────
        /**
         * ACOTADO POR FECHA — antes leía el HISTÓRICO COMPLETO, 24 veces al día.
         *
         * La consulta filtraba por estado y nada más: sin cota de fecha, sin
         * `limit`. O sea que cada ejecución del cron descargaba **todas las citas
         * que ha tenido esa clínica desde que existe**, para mirar las de hoy y
         * mañana.
         *
         * Y las clínicas se recorren en serie. Cuando el tiempo de la función se
         * acaba, dejan de recibir recordatorios **siempre las mismas** —las del
         * final de la lista— sin un solo error visible: el cron responde 200 y el
         * consultorio se entera porque sus pacientes no llegan.
         *
         * El rango va sobre `fechaHora` A SOLAS y el estado se filtra en memoria:
         * así basta el índice automático de un campo. Combinar el rango con el
         * `in` de estado exigiría un índice compuesto, y desplegar índices es una
         * operación aparte que puede borrar los que no estén declarados.
         *
         * Es el mismo patrón que la consulta de auto-reseña ya usa 130 líneas
         * más abajo. Estaba escrito, en este archivo, y esta consulta no lo usaba.
         */
        const desdeVentana = `${hoyISO(tzClinica)} 00:00`
        const hastaVentana = `${sumarDiasISO(hoyISO(tzClinica), 1)} 23:59`
        const snap = await adminDb
          .collection('clinics').doc(clinicId)
          .collection('appointments')
          .where('fechaHora', '>=', desdeVentana)
          .where('fechaHora', '<=', hastaVentana)
          .get()

        // 'recordatorio-enviado' DEBE incluirse: al mandar el aviso de 24 h una
        // cita 'confirmada' pasa a ese estado; sin él, salía del conjunto y nunca
        // recibía el recordatorio de mismo día.
        const ESTADOS_RECORDABLES = ['confirmada', 'pendiente-confirmar', 'solicitada', 'recordatorio-enviado']
        const appointments = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Appointment))
          .filter(a => ESTADOS_RECORDABLES.includes(a.estado))

        /**
         * `{donde}` EN LUGAR DE `{direccion}`, Y `{cierre}` EN LUGAR DE «Te esperamos».
         *
         * Estas plantillas se escribieron cuando todas las citas eran
         * presenciales: a un paciente de TELECONSULTA le llegaba la dirección
         * del consultorio y «te esperamos», sin el enlace de la sala por ningún
         * lado. En el mejor caso llama para preguntar; en el peor conduce hasta
         * allá. Lo decide `lib/telesalud/donde-es.ts`, por tipo de cita.
         */
        const template24h =
          `Hola {paciente} 👋\n\nTe recordamos que tienes una cita *mañana* con {medico}.\n\n📅 {fecha}\n🕐 {hora}\n{clinicaLinea}{donde}\n\n¿Confirmas tu asistencia? Responde *SÍ* para confirmar o *NO* para cancelar.\n\nConsultorio: {telefono}`

        const templateSameDay =
          `Buenos días {paciente} ☀️\n\nHoy tienes tu cita con {medico}:\n\n🕐 {hora}\n{clinicaLinea}{donde}\n\n{cierre} Cualquier duda: {telefono}`

        for (const appt of appointments) {
          if (!appt.consentimientoMensajes) { totals.skipped++; continue }
          const phone = appt.pacienteTelefono
          if (!phone) { totals.skipped++; continue }

          const apptDate = appt.fechaHora.slice(0, 10)
          const apptHour = appt.fechaHora.slice(11, 16)
          // Instante REAL de la cita en hora MX (no en la zona del servidor)
          const apptDateObj = instanteMX(apptDate, apptHour, tzClinica)
          const diffHours = (apptDateObj.getTime() - now.getTime()) / (1000 * 60 * 60)

          /**
           * EL ENLACE DE LA SALA — éste es el mensaje que lo prometía.
           *
           * `dondeEsLaCita` sólo emite el enlace si le llega el token del
           * paciente, y ningún llamador se lo daba: la confirmación decía
           * «recibirás el enlace por este medio antes de tu cita», el
           * recordatorio decía lo mismo, y el enlace no llegaba nunca. Este cron
           * es el único que corre ANTES de la cita (ventana de hoy y mañana), así
           * que es aquí donde la promesa se cumple o no se cumple.
           *
           * Alcance `agenda`, no `clinico`: este enlace viaja por WhatsApp y se
           * reenvía. Deja entrar a la sala y a la agenda del paciente; los
           * documentos clínicos firmados siguen exigiendo un enlace emitido por
           * un médico (`/api/telesalud/token`). Mismo criterio que
           * `/api/portal/link`.
           *
           * Nace con la VERSIÓN vigente del expediente: cuando alguien revoca los
           * enlaces de ese paciente, el contador sube y éste cae con los demás.
           *
           * Sólo se firma para una videoconsulta: a una cita presencial no le
           * hace falta y emitir credenciales que nadie usa es ampliar la
           * superficie por nada. Sin `pacienteId` no hay a quién atarlo, y un
           * enlace sin titular es justo el que la sala rechaza con 404.
           */
          let tokenSala = ''
          if (esTeleconsulta(appt.tipo) && appt.pacienteId) {
            /**
             * TODO EL BLOQUE VA EN try/catch, y no es por costumbre.
             *
             * `crearTokenPaciente` LANZA si falta `PORTAL_PACIENTE_SECRET`. El
             * `try` de este bucle está a nivel de CONSULTORIO, así que una
             * variable de entorno mal puesta no dejaría a un paciente sin enlace:
             * dejaría a ese consultorio entero sin recordatorios, presenciales
             * incluidos, y con un 200 en la respuesta del cron.
             *
             * Un recordatorio sin enlace sigue avisando de la cita. Ningún
             * recordatorio no avisa de nada. Se degrada por lo primero.
             */
            try {
              let versionPortal = 0
              try {
                const pacSnap = await adminDb.collection('clinics').doc(clinicId)
                  .collection('patients').doc(appt.pacienteId).get()
                versionPortal = Number((pacSnap.data() as { portalTokenVersion?: number } | undefined)?.portalTokenVersion ?? 0)
              } catch { /* sin versión conocida se emite la 0: una revocación posterior lo corta igual */ }
              tokenSala = crearTokenPaciente(clinicId, appt.pacienteId, undefined, 'agenda', versionPortal)
            } catch (e) {
              // Sin token no se inventa un enlace: `dondeEsLaCita` dirá que llega
              // aparte, que es la verdad. Y queda dicho POR QUÉ, sin PHI.
              safeLog.warn('[reminders] no se pudo firmar el enlace de teleconsulta:', String(e))
              tokenSala = ''
            }
          }

          const lugar = dondeEsLaCita({
            tipo: appt.tipo,
            citaId: appt.id,
            clinicId,
            direccion: config.direccion,
            googleMapsUrl: config.googleMapsUrl,
            baseUrl: process.env.NEXT_PUBLIC_APP_URL,
            tokenPaciente: tokenSala,
          })
          const msgData = {
            paciente: appt.pacienteNombre,
            fecha: formatDateES(apptDate),
            hora: apptHour,
            // El médico de LA CITA, no el titular de la clínica (multi-médico).
            medico: appt.medicoNombre || config.nombreMedico || 'el médico',
            clinica: config.nombreClinica,
            // El nombre del consultorio tampoco va en una videoconsulta: sobra y
            // sugiere que hay que ir.
            clinicaLinea: lugar.esVideo ? '' : `📍 ${config.nombreClinica ?? ''}\n`,
            donde: lugar.lineas.join('\n'),
            cierre: lugar.cierre,
            direccion: config.direccion || '',
            telefono: config.whatsappConsultorio || config.telefonoAdmin,
          }

          // 24h reminder (window: 23–26h before)
          if (config.recordatorio24h && !appt.recordatorio24hEnviado && diffHours >= 23 && diffHours <= 26) {
            const { resultado } = await enviarProactivo(clinicId, phone, {
              clave: 'recordatorio24h', datos: msgData, ahoraMs: now.getTime(), waConfig, minutosDelDiaMx: minMx, fechaHoyMx: hoyISO(tzClinica),
              textoLibre: buildWhatsAppMessage(template24h, msgData),
            })
            if (resultado === 'enviado') {
              await adminDb.collection('clinics').doc(clinicId)
                .collection('appointments').doc(appt.id).update({
                  recordatorio24hEnviado: true,
                  estado: appt.estado === 'confirmada' ? 'recordatorio-enviado' : appt.estado,
                  updatedAt: now.toISOString(),
                })
              /**
               * EL «SÍ» DEL PACIENTE TIENE QUE LLEGAR A ALGÚN SITIO.
               *
               * El mensaje dice, con estas palabras, «Responde SÍ para confirmar
               * o NO para cancelar» — y no había NADA que lo implementara: sin
               * sesión previa el bot caía en el saludo y contestaba el menú de
               * bienvenida. El paciente confirmaba y su cita seguía sin
               * confirmar; decía NO queriendo cancelar y la cita seguía viva
               * ocupando el hueco.
               *
               * Se deja la sesión esperando esa respuesta, con la cita concreta.
               * `merge: true` para no pisar una conversación en curso más que en
               * lo necesario.
               */
              await adminDb.collection('clinics').doc(clinicId)
                .collection('bot_sessions').doc(normalizarTelefonoWa(phone))
                .set({
                  telefono: normalizarTelefonoWa(phone),
                  estado: 'confirmando_cita',
                  /**
                   * `cancelarSolo: ''` NO sobra.
                   *
                   * `merge: true` funde los mapas anidados, así que una bandera
                   * de un diálogo de cancelación ABANDONADO sobrevivía aquí — y
                   * el «SÍ» del paciente a este recordatorio le cancelaba la
                   * cita en vez de confirmarla. Escribirla vacía la neutraliza.
                   */
                  datos: { citaId: appt.id, fecha: apptDate, hora: apptHour, cancelarSolo: '' },
                  lastMessageAt: now.toISOString(),
                  createdAt: now.toISOString(),
                }, { merge: true })
                .catch(() => { /* el recordatorio ya salió: esto no puede tumbarlo */ })
              totals.sent++
            } else if (resultado === 'fallo') { totals.failed++ }
            else { totals.skipped++ } // omitido (sin plantilla fuera de ventana) / optout
            continue
          }

          // Same-day reminder (window: 1–4h before)
          if (config.recordatorioMismoDia && !appt.recordatorioMismoDiaEnviado && diffHours >= 1 && diffHours <= 4) {
            const { resultado } = await enviarProactivo(clinicId, phone, {
              clave: 'recordatorioMismoDia', datos: msgData, ahoraMs: now.getTime(), waConfig, minutosDelDiaMx: minMx, fechaHoyMx: hoyISO(tzClinica),
              textoLibre: buildWhatsAppMessage(templateSameDay, msgData),
            })
            if (resultado === 'enviado') {
              await adminDb.collection('clinics').doc(clinicId)
                .collection('appointments').doc(appt.id).update({
                  recordatorioMismoDiaEnviado: true,
                  updatedAt: now.toISOString(),
                })
              totals.sent++
            } else if (resultado === 'fallo') { totals.failed++ }
            else { totals.skipped++ }
          }
        }

        // ── Auto-reseña tras la visita (opt-in por clínica) ──
        if (config.resenaAutomatica) {
          const origin = req.nextUrl.origin
          // Acotar por fecha (~4 días) → desigualdad de un solo campo (índice automático,
          // sin índice compuesto). El estado se filtra en código.
          const desdeStr = `${sumarDiasISO(hoyISO(tzClinica), -4)} 00:00`
          const postSnap = await adminDb
            .collection('clinics').doc(clinicId)
            .collection('appointments')
            .where('fechaHora', '>=', desdeStr)
            .get()
          for (const d of postSnap.docs) {
            const a = { id: d.id, ...d.data() } as Appointment & { resenaSolicitada?: boolean }
            if (!ESTADOS_POST_VISITA.includes(a.estado)) continue
            if (a.resenaSolicitada) continue
            if (!a.consentimientoMensajes || !a.pacienteTelefono) { totals.skipped++; continue }
            // Solo citas terminadas hace 2–72h (no spamear histórico viejo)
            const fin = instanteMX(a.fechaHora.slice(0, 10), a.fechaHora.slice(11, 16), tzClinica)
            const horas = (now.getTime() - fin.getTime()) / 3_600_000
            if (horas < 2 || horas > 72) continue
            try {
              const link = await crearSolicitudResenaAdmin(origin, clinicId, a)
              const nombre = (a.pacienteNombre || '').split(' ')[0]
              const msg = `Hola ${nombre} 🙏 ¿Nos ayudas con una reseña de tu consulta con ${config.nombreMedico || 'el médico'}? Solo toma 30 segundos:\n${link}`
              const ok = await sendWhatsApp(a.pacienteTelefono, msg, config, clinicId)
              // Marcar siempre (un intento) para no spamear ante fallos transitorios
              await adminDb.collection('clinics').doc(clinicId)
                .collection('appointments').doc(a.id).update({ resenaSolicitada: true, updatedAt: now.toISOString() })
              if (ok) totals.sent++; else totals.failed++
            } catch { totals.failed++ }
          }
        }

        // ── Drenar la cola de reintentos (outbox/DLQ) de esta clínica ──
        for (const e of await entradasVencidas(clinicId, now.getTime())) {
          const { resultado } = await enviarProactivo(clinicId, e.to, {
            clave: e.clave, datos: e.datos, textoLibre: e.textoLibre,
            waConfig, ahoraMs: now.getTime(), minutosDelDiaMx: minMx, fechaHoyMx: hoyISO(tzClinica),
          })
          if (resultado === 'enviado' || resultado === 'optout' || resultado === 'omitido') {
            // Si la oferta de lista de espera se reenvió con éxito, recrear la sesión
            // `esperando_lista` (el handler inline la crea, pero el drenado no): sin
            // ella el "SÍ" del paciente cae al menú y el hueco se pierde.
            const sesion = resultado === 'enviado' && e.clave === 'listaEspera'
              ? (e.meta?.sesionListaEspera as { telefono?: string; nombre?: string; slotFecha?: string; slotHora?: string; tipo?: string; waitlistId?: string; pacienteId?: string } | undefined)
              : undefined
            if (sesion?.telefono) {
              const nowIso = now.toISOString()
              await adminDb.collection('clinics').doc(clinicId).collection('bot_sessions').doc(sesion.telefono).set({
                telefono: sesion.telefono,
                estado: 'esperando_lista',
                datos: {
                  nombre: sesion.nombre || '', slotFecha: sesion.slotFecha || '', slotHora: sesion.slotHora || '',
                  tipo: sesion.tipo || 'seguimiento', waitlistId: sesion.waitlistId || '', pacienteId: sesion.pacienteId || '',
                },
                lastMessageAt: nowIso, createdAt: nowIso,
              }, { merge: true }).catch(() => {})
              if (sesion.waitlistId) {
                await adminDb.collection('clinics').doc(clinicId).collection('waitlist').doc(sesion.waitlistId)
                  .update({ estado: 'contactado' }).catch(() => {})
              }
            }
            await resolverEntrada(clinicId, e.id) // resuelto o inalcanzable por config → sacar de la cola
            if (resultado === 'enviado') totals.sent++
          } else if (resultado === 'fallo') {
            await reprogramarEntrada(clinicId, e, now.getTime()) // backoff o dead-letter
          }
          // 'silencio' / 'tope': dejar en la cola, se reintenta en el próximo ciclo
        }
      } catch (clinicErr) {
        safeLog.error(`[Cron] Error for clinic ${clinicId}:`, clinicErr)
      }
    }

    /**
     * EL LATIDO, EN LAS DOS SALIDAS.
     *
     * Nada registraba que este cron corriera. Si dejara de dispararse una semana
     * entera, la única señal sería que los pacientes no llegan. Ahora el
     * vigilante lo mira desde fuera.
     */
    await registrarLatido('reminders', {
      ok: true, duracionMs: Date.now() - arranqueCron,
      detalle: { enviados: totals.sent, fallidos: totals.failed, consultorios: totals.clinics },
    })
    return NextResponse.json({ ok: true, ...totals })
  } catch (err) {
    safeLog.error('Reminders cron error:', err)
    await registrarLatido('reminders', {
      ok: false, duracionMs: Date.now() - arranqueCron,
      error: err instanceof Error ? err.message : 'error',
    })
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
