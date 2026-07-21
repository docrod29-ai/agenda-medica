/**
 * POST /api/whatsapp/waitlist-notify
 *
 * Called when an appointment is cancelled.
 * Finds active waitlist patients and sends them a WhatsApp offer
 * for the now-open slot.
 *
 * Body: { fecha, hora, clinicId?, tipo? }
 *   - tipo opcional: si viene, solo se ofrece a quienes pidieron ese tipo
 *     (o no especificaron) y cuya fechaDeseada no sea posterior al slot.
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarMiembro } from '@/lib/auth-server'
import { ClinicConfig, WaitlistEntry } from '@/types'
import { enviarProactivo } from '@/lib/whatsapp/proactivo'
import { encolarReintento } from '@/lib/whatsapp/outbox'
import { hoyISO } from '@/lib/timezone'
import { normalizarTelefonoWa } from '@/lib/whatsapp/consent'

function formatDate(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00')
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
}

export async function POST(req: NextRequest) {
  try {
    const { fecha, hora, clinicId, tipo: slotTipo } = await req.json()
    if (!fecha || !hora || !clinicId) {
      return NextResponse.json({ error: 'fecha, hora y clinicId requeridos' }, { status: 400 })
    }

    // AUTORIZACIÓN: solo un miembro de la clínica puede disparar avisos de lista de espera
    // (antes era público → spam/abuso de WhatsApp y mutación de estado).
    const acc = await verificarMiembro(req, clinicId)
    if (!acc.ok) return acc.response

    const clinicRef = adminDb.collection('clinics').doc(clinicId)

    // Load config
    const configSnap = await clinicRef.collection('config').doc('main').get()
    if (!configSnap.exists) {
      return NextResponse.json({ error: 'no config' }, { status: 500 })
    }
    const config = configSnap.data() as ClinicConfig
    // Config de plantillas HSM de la clínica (para envío fuera de ventana 24 h).
    const clinicSnap = await clinicRef.get()
    const waConfig = clinicSnap.data()?.whatsapp as { plantillas?: Record<string, { name?: string; lang?: string }> } | undefined

    // Candidatos activos ordenados por prioridad (1 = MAYOR prioridad → asc).
    // Antes era 'desc', que ofrecía el slot al paciente MENOS prioritario.
    // Traemos más de 3 para poder filtrar por compatibilidad y aún notificar a 3.
    const waitlistSnap = await clinicRef.collection('waitlist')
      .where('estado', '==', 'activo')
      .orderBy('prioridad', 'asc')
      .orderBy('createdAt', 'asc')
      .limit(20)
      .get()

    if (waitlistSnap.empty) {
      return NextResponse.json({ notified: 0 })
    }

    const clinicName = config.nombreClinica || config.nombreMedico
    let notified = 0
    const LIMITE_NOTIFICAR = 3

    for (const doc of waitlistSnap.docs) {
      if (notified >= LIMITE_NOTIFICAR) break
      const entry = { id: doc.id, ...doc.data() } as WaitlistEntry

      if (!entry.pacienteTelefono) continue

      // MATCHING: no ofrecer un slot que no le sirve al paciente.
      // - tipo: si el slot tiene tipo y el paciente pidió otro distinto, saltar.
      // - fechaDeseada: si el paciente quiere a partir de cierta fecha y el slot
      //   liberado es ANTES, no le sirve.
      if (slotTipo && entry.tipo && entry.tipo !== slotTipo) continue
      if (entry.fechaDeseada && fecha < entry.fechaDeseada) continue

      const msg = [
        `🔔 *Espacio disponible en ${clinicName}*`,
        ``,
        `Hola ${entry.pacienteNombre.split(' ')[0]}, se liberó un horario:`,
        ``,
        `📅 *${formatDate(fecha)}*`,
        `🕐 *${hora} hrs*`,
        ``,
        `¿Desea tomar este horario? Responda *SÍ* antes de que se ocupe.`,
        ``,
        `Si ya no está interesado, responda *NO* y le quitamos de la lista.`,
      ].join('\n')

      // Proactivo: dentro de ventana → texto; fuera → plantilla lista_espera si
      // la clínica la tiene aprobada; si no, se omite (no marca contactado).
      const { resultado } = await enviarProactivo(clinicId, entry.pacienteTelefono, {
        clave: 'listaEspera',
        datos: {
          paciente: entry.pacienteNombre.split(' ')[0],
          medico: config.nombreMedico || 'el médico',
          fecha: formatDate(fecha),
          hora,
        },
        textoLibre: msg,
        waConfig,
        ahoraMs: Date.now(),
        fechaHoyMx: hoyISO(),
      })
      if (resultado === 'enviado') {
        notified++

        // MISMA clave canónica que el webhook (normalizarTelefonoWa → 52 + 10
        // dígitos). Antes se guardaba el teléfono crudo y el webhook buscaba por
        // el wa_id de Meta (formato 521…): no coincidían y la respuesta "SÍ" del
        // paciente caía al menú por defecto → el hueco se perdía en silencio.
        const telNorm = normalizarTelefonoWa(entry.pacienteTelefono || '')
        const sessionData = {
          telefono: telNorm,
          estado: 'esperando_lista',
          datos: {
            nombre: entry.pacienteNombre,
            slotFecha: fecha,
            slotHora: hora,
            tipo: entry.tipo || 'seguimiento',
            waitlistId: entry.id,
            pacienteId: entry.pacienteId || '',
          },
          lastMessageAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        }

        /**
         * UNA SOLA CONVENCIÓN DE ID PARA LAS SESIONES DEL BOT.
         *
         * Aquí se buscaba por `where('telefono')` y se creaba con `add()` (id
         * automático), mientras el resto del sistema usa un id DERIVADO del
         * teléfono. Dos escritores con dos convenciones sobre la misma colección
         * dejan sesiones duplicadas para el mismo número, y el `limit(1)` puede
         * devolver la que no es.
         *
         * Consecuencia concreta: si el paciente contesta "SÍ" contra la sesión
         * equivocada, su estado no es `esperando_lista`, cae al menú por defecto y
         * LA OFERTA DEL HUECO SE PIERDE EN SILENCIO — nadie ocupa el horario y
         * nadie se entera.
         *
         * Se usa el mismo id determinista, con merge para no pisar lo que ya haya.
         */
        const idSesion = telNorm || 'sin-telefono'
        await clinicRef.collection('bot_sessions').doc(idSesion).set(sessionData, { merge: true })

        // Mark waitlist entry as contactado
        await clinicRef.collection('waitlist').doc(entry.id).update({ estado: 'contactado' })
      } else if (resultado === 'fallo') {
        // Aviso de un solo disparo: si falla por error transitorio, encolar para
        // reintento con backoff (lo drena el cron de recordatorios).
        await encolarReintento(clinicId, {
          to: entry.pacienteTelefono, clave: 'listaEspera',
          datos: { paciente: entry.pacienteNombre.split(' ')[0], medico: config.nombreMedico || 'el médico', fecha: formatDate(fecha), hora },
          textoLibre: msg,
          // Para que, si el cron reenvía esta oferta, cree la sesión esperando_lista
          // y el "SÍ" del paciente sí agende el hueco (mismo efecto que el envío inline).
          meta: {
            sesionListaEspera: {
              telefono: normalizarTelefonoWa(entry.pacienteTelefono || ''),
              nombre: entry.pacienteNombre,
              slotFecha: fecha,
              slotHora: hora,
              tipo: entry.tipo || 'seguimiento',
              waitlistId: entry.id,
              pacienteId: entry.pacienteId || '',
            },
          },
        }, Date.now())
      }
    }

    return NextResponse.json({ ok: true, notified })
  } catch (err) {
    console.error('[WaitlistNotify] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
