import { NextRequest, NextResponse } from 'next/server'
import { errorAlCliente } from '@/lib/security/error-al-cliente'
import { safeLog } from '@/lib/security/sanitize'
import { randomUUID } from 'node:crypto'
import { adminDb } from '@/lib/firebase-admin'
import { Appointment, ClinicConfig } from '@/types'
import { enviarProactivo } from '@/lib/whatsapp/proactivo'
import {
  entradasVencidas, resolverEntrada, reprogramarEntrada, contarMuertas,
} from '@/lib/whatsapp/outbox'
import { normalizarTelefonoWa, analizarTelefonoWa } from '@/lib/whatsapp/telefono'
import { registrarNoEntregado } from '@/lib/whatsapp/no-entregados'
import {
  CAMPOS_RECORDATORIO, reservaReciente, motivoDeResultado, esTransitorio, falloParaLaCita,
  type ClaveRecordatorio, type MotivoNoEnviado,
} from '@/lib/whatsapp/recordatorio-idempotente'
import { textoRecordatorio24h, textoRecordatorioMismoDia, textoSolicitudResena, type DatosRecordatorio } from '@/lib/whatsapp/texto-recordatorio'
import { puedeEscribir } from '@/lib/finanzas/paywall-prueba'
import { instanteMX, hoyISO, sumarDiasISO, ahoraMinutosDelDia, TZ_DEFAULT } from '@/lib/timezone'
import { dondeEsLaCita, esTeleconsulta } from '@/lib/telesalud/donde-es'
import { crearTokenPaciente } from '@/lib/patient-token'
import { registrarLatido } from '@/lib/ops/latido'
import { correlacionDeTrabajo } from '@/lib/observabilidad/correlacion'

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

function formatDateES(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
}

export async function GET(req: NextRequest) {
  /* REG-566 — la traza de ESTA ejecución, acuñada al arrancar: un trabajo de
     fondo no nace de un navegador, así que no acepta la que le manden. */
  const correlacion = correlacionDeTrabajo()
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
    /**
     * `pausadas` y `muertas` (REG-397) son la señal de la cola, no del envío.
     *
     * `pausadas` = entradas que no se intentaron porque el PROVEEDOR estaba
     * caído (REG-391). Sin contarlas, una caída de Meta se ve exactamente igual
     * que una tarde tranquila: `sent: 0, failed: 0`, y el cron en verde.
     *
     * `muertas` = las que ya se rindieron. El dead-letter existe desde hace
     * mucho y **nadie lo mira**: quedan en Firestore con su motivo y ninguna
     * pantalla las enseña. Contarlas aquí es lo mínimo para que un aviso las
     * saque del cajón.
     */
    const totals = { sent: 0, failed: 0, skipped: 0, clinics: 0, pausadas: 0, muertas: 0, omitidasPorPruebaVencida: 0 }

    // ── Get all active clinics ────────────────────────────────
    const clinicsSnap = await adminDb.collection('clinics')
      .where('status', 'in', ['active', 'trial'])
      .get()

    for (const clinicDoc of clinicsSnap.docs) {
      const clinicId = clinicDoc.id
      totals.clinics++

      try {
        /**
         * LA PRUEBA VENCIDA NO MANDA MENSAJES (Panel de Lujo N-006, PL-D8).
         *
         * Este cron seguía mandando WhatsApp durante meses a costa de la
         * plataforma para consultorios cuya prueba había vencido. Se usa el
         * MISMO espejo que el resto del paywall (`puedeEscribir`): mismo día de
         * gracia, mismo fallo-abierto sin `trialEndsAtMs`. Se cuentan aparte para
         * que el dueño vea cuántas son — ese número es su lista de reactivación.
         */
        if (!puedeEscribir(clinicDoc.data() as { status?: string; trialEndsAtMs?: number; paseLibre?: boolean }, now.getTime())) {
          totals.omitidasPorPruebaVencida++
          continue
        }

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
         * El TEXTO vive en `lib/whatsapp/texto-recordatorio.ts` (puro): `{donde}`
         * en lugar de `{direccion}` y `{cierre}` en lugar de «Te esperamos»
         * porque a un paciente de TELECONSULTA le llegaba la dirección del
         * consultorio; sin «Consultorio: undefined» (ASM-017); con el plazo de
         * respuesta (ASM-006); y con modo discreto por consultorio (PG-018).
         */
        const discreto = (config as { recordatoriosDiscretos?: boolean }).recordatoriosDiscretos === true
        const citasRef = adminDb.collection('clinics').doc(clinicId).collection('appointments')

        /**
         * QUÉ QUEDA ESCRITO CUANDO NO SALE (ASM-007, ASM-005). Un fallo o una
         * omisión que sólo suben un contador no le dicen a la asistente a quién
         * llamar. Se anota en la cita (`recordatorio24hFallo`) y en
         * `whatsapp_no_entregados`. Silencio y tope NO son fallos: se reintentan.
         */
        const anotarNoEnviado = async (appt: Appointment, clave: ClaveRecordatorio, motivo: MotivoNoEnviado, texto: string) => {
          if (esTransitorio(motivo)) { totals.skipped++; return }
          if (motivo === 'proveedor') totals.failed++; else totals.skipped++
          await citasRef.doc(appt.id).update({ ...falloParaLaCita(clave, motivo, now.toISOString()), updatedAt: now.toISOString() })
            .catch(() => { /* la constancia no puede tumbar el bucle */ })
          await registrarNoEntregado(clinicId, appt.pacienteTelefono, texto, clave, motivo)
        }

        for (const appt of appointments) {
          const apptDate = appt.fechaHora.slice(0, 10)
          const apptHour = appt.fechaHora.slice(11, 16)
          // Instante REAL de la cita en hora MX (no en la zona del servidor)
          const apptDateObj = instanteMX(apptDate, apptHour, tzClinica)
          const diffHours = (apptDateObj.getTime() - now.getTime()) / (1000 * 60 * 60)

          const toca24h = config.recordatorio24h && !appt.recordatorio24hEnviado && diffHours >= 23 && diffHours <= 26
          const tocaMismoDia = config.recordatorioMismoDia && !appt.recordatorioMismoDiaEnviado && diffHours >= 1 && diffHours <= 4
          if (!toca24h && !tocaMismoDia) continue
          const clave: ClaveRecordatorio = toca24h ? 'recordatorio24h' : 'recordatorioMismoDia'

          if (!appt.consentimientoMensajes) { totals.skipped++; continue }

          /**
           * EL TELÉFONO SALE DEL EXPEDIENTE CUANDO LO HAY (Panel de Lujo ASM-004).
           *
           * `pacienteTelefono` es una copia en la cita. Corregir el teléfono en
           * `/pacientes` ya lo propaga (`updatePatient`), pero esta lectura es la
           * segunda red: si el expediente tiene teléfono, ése manda, porque es la
           * ÚNICA IDENTIDAD del paciente. La cita sólo decide cuando no hay
           * expediente (bot antiguo) o el expediente no tiene teléfono.
           */
          let phone = appt.pacienteTelefono
          let versionPortal = 0
          if (appt.pacienteId) {
            try {
              const pacSnap = await adminDb.collection('clinics').doc(clinicId)
                .collection('patients').doc(appt.pacienteId).get()
              const pac = pacSnap.data() as { telefono?: string; whatsapp?: string; portalTokenVersion?: number } | undefined
              const delExpediente = String(pac?.whatsapp || pac?.telefono || '').trim()
              if (delExpediente) phone = delExpediente
              versionPortal = Number(pac?.portalTokenVersion ?? 0)
            } catch { /* sin expediente legible se usa el de la cita, como antes */ }
          }
          if (!phone) { totals.skipped++; continue }
          /**
           * DESTINO VALIDADO ESTRICTO (ASM-002): lo que no se entiende no se manda
           * a nadie, y queda dicho en la cita para que recepción lo corrija.
           */
          if (!analizarTelefonoWa(phone).ok) {
            await anotarNoEnviado(appt, clave, 'telefono-invalido', '')
            continue
          }

          /**
           * RESERVAR ANTES DE ENVIAR (ASM-019). Si hay una reserva reciente sin
           * confirmación, no se reenvía: puede que sí saliera y sólo fallara la
           * marca. Si la reserva no se puede escribir, tampoco se manda: sin
           * reserva no hay idempotencia.
           */
          const campos = CAMPOS_RECORDATORIO[clave]
          const intentoPrevio = (appt as unknown as Record<string, unknown>)[campos.intentoAt] as string | undefined
          if (reservaReciente(intentoPrevio, now.getTime())) { totals.skipped++; continue }
          try {
            await citasRef.doc(appt.id).update({ [campos.intentoAt]: now.toISOString() })
          } catch { totals.skipped++; continue }

          /**
           * EL ENLACE DE LA SALA — éste es el mensaje que lo prometía.
           *
           * `dondeEsLaCita` sólo emite el enlace si le llega el token del
           * paciente. Alcance `agenda`, no `clinico`: este enlace viaja por
           * WhatsApp y se reenvía. Nace con la VERSIÓN vigente del expediente.
           *
           * Sólo se firma para una videoconsulta. Sin `pacienteId` no hay a quién
           * atarlo, y tampoco cuando el expediente se eligió POR TELÉFONO SIN
           * NOMBRE (RT-008): sin nombre confirmado no hay a quién atarlo, y un
           * enlace al portal de la madre en la cita de la hija es una fuga.
           *
           * `crearTokenPaciente` LANZA si falta `PORTAL_PACIENTE_SECRET`; se
           * degrada a «sin enlace», no a «sin recordatorio».
           */
          let tokenSala = ''
          const expedientePorConfirmar = !!(appt as { expedientePorConfirmar?: string }).expedientePorConfirmar
          if (esTeleconsulta(appt.tipo) && appt.pacienteId && !expedientePorConfirmar) {
            try {
              tokenSala = crearTokenPaciente(clinicId, appt.pacienteId, undefined, 'agenda', versionPortal)
            } catch (e) {
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
          const msgData: DatosRecordatorio = {
            paciente: appt.pacienteNombre,
            fecha: formatDateES(apptDate),
            hora: apptHour,
            // El médico de LA CITA, no el titular de la clínica (multi-médico).
            medico: appt.medicoNombre || config.nombreMedico || 'el médico',
            clinica: config.nombreClinica ?? '',
            // El nombre del consultorio tampoco va en una videoconsulta: sobra y
            // sugiere que hay que ir.
            clinicaLinea: lugar.esVideo ? '' : `📍 ${config.nombreClinica ?? ''}\n`,
            donde: lugar.lineas.join('\n'),
            cierre: lugar.cierre,
            direccion: config.direccion || '',
            telefono: config.whatsappConsultorio || config.telefonoAdmin || '',
          }
          const texto = clave === 'recordatorio24h'
            ? textoRecordatorio24h(msgData, { discreto })
            : textoRecordatorioMismoDia(msgData, { discreto })

          const { resultado } = await enviarProactivo(clinicId, phone, {
            clave, datos: discreto ? { ...msgData, medico: '', clinica: '' } : msgData,
            ahoraMs: now.getTime(), waConfig, minutosDelDiaMx: minMx, fechaHoyMx: hoyISO(tzClinica),
            textoLibre: texto,
          })
          const motivo = motivoDeResultado(resultado)
          if (motivo) { await anotarNoEnviado(appt, clave, motivo, texto); continue }

          /**
           * CONFIRMAR DESPUÉS DE ENVIAR. Si esto falla, la reserva de arriba
           * impide reenviar durante dos horas. El teléfono del expediente se
           * copia a la cita, para que el menú «Llamar» de /citas vea el mismo.
           */
          await citasRef.doc(appt.id).update(clave === 'recordatorio24h'
            ? {
                recordatorio24hEnviado: true,
                estado: appt.estado === 'confirmada' ? 'recordatorio-enviado' : appt.estado,
                pacienteTelefono: phone,
                updatedAt: now.toISOString(),
              }
            : { recordatorioMismoDiaEnviado: true, pacienteTelefono: phone, updatedAt: now.toISOString() })
          totals.sent++

          if (clave === 'recordatorio24h') {
            /**
             * EL «SÍ» DEL PACIENTE TIENE QUE LLEGAR A ALGÚN SITIO.
             *
             * El mensaje dice «Responde SÍ para confirmar o NO para cancelar» y
             * sin sesión previa el bot caía en el saludo. Se deja la sesión
             * esperando esa respuesta, con la cita concreta. El bot la mantiene
             * viva HASTA LA HORA DE LA CITA (ASM-006, `lib/whatsapp/vigencia-sesion.ts`),
             * no las 2 h de una conversación que inicia el paciente.
             *
             * `cancelarSolo: ''` NO sobra: `merge: true` funde los mapas anidados,
             * y una bandera de un diálogo de cancelación ABANDONADO sobrevivía
             * aquí — el «SÍ» al recordatorio le cancelaba la cita.
             */
            await adminDb.collection('clinics').doc(clinicId)
              .collection('bot_sessions').doc(normalizarTelefonoWa(phone))
              .set({
                telefono: normalizarTelefonoWa(phone),
                estado: 'confirmando_cita',
                datos: { citaId: appt.id, fecha: apptDate, hora: apptHour, cancelarSolo: '' },
                lastMessageAt: now.toISOString(),
                createdAt: now.toISOString(),
              }, { merge: true })
              .catch(() => { /* el recordatorio ya salió: esto no puede tumbarlo */ })
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
            const a = { id: d.id, ...d.data() } as Appointment & { resenaSolicitada?: boolean; resenaIntentoAt?: string }
            if (!ESTADOS_POST_VISITA.includes(a.estado)) continue
            if (a.resenaSolicitada) continue
            if (!a.consentimientoMensajes || !a.pacienteTelefono) { totals.skipped++; continue }
            // Solo citas terminadas hace 2–72h (no spamear histórico viejo)
            const fin = instanteMX(a.fechaHora.slice(0, 10), a.fechaHora.slice(11, 16), tzClinica)
            const horas = (now.getTime() - fin.getTime()) / 3_600_000
            if (horas < 2 || horas > 72) continue
            if (!analizarTelefonoWa(a.pacienteTelefono).ok) { totals.skipped++; continue }
            /**
             * POR LA PUERTA PROACTIVA, COMO TODO LO DEMÁS (ASM-008). Antes salía
             * como texto libre fuera de ventana, sin plantilla ni silencio ni
             * tope, y `resenaSolicitada` se escribía pase lo que pase: un rechazo
             * del proveedor cerraba la puerta para siempre. Ahora sólo se marca
             * cuando SALIÓ; si no, queda el fallo escrito y se reintenta un
             * ciclo después (con la misma reserva de 2 h que el recordatorio).
             */
            if (reservaReciente(a.resenaIntentoAt, now.getTime())) continue
            try {
              await citasRef.doc(a.id).update({ resenaIntentoAt: now.toISOString() })
              const link = await crearSolicitudResenaAdmin(origin, clinicId, a)
              const medico = config.nombreMedico || 'el médico'
              const texto = textoSolicitudResena(a.pacienteNombre, medico, link)
              const { resultado } = await enviarProactivo(clinicId, a.pacienteTelefono, {
                clave: 'resena', datos: { paciente: a.pacienteNombre, medico, enlace: link },
                ahoraMs: now.getTime(), waConfig, minutosDelDiaMx: minMx, fechaHoyMx: hoyISO(tzClinica),
                textoLibre: texto,
              })
              const motivo = motivoDeResultado(resultado)
              if (!motivo) {
                await citasRef.doc(a.id).update({ resenaSolicitada: true, updatedAt: now.toISOString() })
                totals.sent++
              } else if (esTransitorio(motivo)) {
                totals.skipped++
              } else {
                if (motivo === 'proveedor') totals.failed++; else totals.skipped++
                await citasRef.doc(a.id).update({ resenaFallo: { at: now.toISOString(), motivo } }).catch(() => {})
                await registrarNoEntregado(clinicId, a.pacienteTelefono, texto, 'resena', motivo)
              }
            } catch { totals.failed++ }
          }
        }

        // ── Drenar la cola de reintentos (outbox/DLQ) de esta clínica ──
        for (const e of await entradasVencidas(clinicId, now.getTime())) {
          const { resultado, veredicto } = await enviarProactivo(clinicId, e.to, {
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
            /**
             * Un fallo del PROVEEDOR no gasta un reintento del mensaje (REG-391):
             * con el cron cada hora, cinco horas de caída de Meta mataban toda la
             * cola sin que nada pareciera roto.
             */
            const delProveedor = veredicto === 'el_proveedor_no_esta'
            if (delProveedor) totals.pausadas++
            await reprogramarEntrada(clinicId, e, now.getTime(), undefined, delProveedor)
          }
          // 'silencio' / 'tope': dejar en la cola, se reintenta en el próximo ciclo
        }

        /* Las que ya se rindieron. Se cuentan aquí porque ya estamos en este
           consultorio: un recorrido aparte sería otro trabajo que vigilar. */
        totals.muertas += (await contarMuertas(clinicId)).cuantas
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
      correlacion,
      ok: true, duracionMs: Date.now() - arranqueCron,
      detalle: {
        enviados: totals.sent, fallidos: totals.failed, consultorios: totals.clinics,
        /* La cola, no el envío. Ver el comentario de `totals` (REG-397). */
        pausadas: totals.pausadas, muertas: totals.muertas,
        omitidasPorPruebaVencida: totals.omitidasPorPruebaVencida,
      },
    })
    return NextResponse.json({ ok: true, ...totals })
  } catch (err) {
    safeLog.error('Reminders cron error:', err)
    await registrarLatido('reminders', {
      correlacion,
      ok: false, duracionMs: Date.now() - arranqueCron,
      error: err instanceof Error ? err.message : 'error',
    })
    return errorAlCliente()
  }
}
