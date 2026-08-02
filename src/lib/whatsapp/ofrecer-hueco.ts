/**
 * OFRECER UN HUECO QUE SE LIBERÓ, A QUIEN ESTÁ ESPERANDO.
 *
 * ── POR QUÉ VIVE AQUÍ Y NO DENTRO DE LA RUTA ─────────────────────────────────
 *
 * Estaba en el cuerpo de `POST /api/whatsapp/waitlist-notify`, detrás de
 * `verificarMiembro`. Eso significa que sólo el CONSULTORIO podía disparar la
 * oferta: cuando el paciente cancelaba desde su portal —que es un token, no una
 * sesión de miembro— el hueco quedaba libre y no se le ofrecía a nadie. La
 * cancelación más silenciosa era justo la que nadie del equipo veía pasar.
 *
 * Sacarlo a una función deja la ruta como lo que es —la puerta HTTP— y permite
 * que el portal llame a LO MISMO en vez de inventar una segunda implementación.
 * Así es como el motor de agenda acabó teniendo cinco.
 */
import { adminDb } from '@/lib/firebase-admin'
import { candidatos } from '@/lib/whatsapp/lista-espera'
import { safeLog } from '@/lib/security/sanitize'
import { ClinicConfig, WaitlistEntry } from '@/types'
import { enviarProactivo } from '@/lib/whatsapp/proactivo'
import { encolarReintento } from '@/lib/whatsapp/outbox'
import { registrarNoEntregado } from '@/lib/whatsapp/no-entregados'
import { hoyISO, TZ_DEFAULT } from '@/lib/timezone'
import { normalizarTelefonoWa } from '@/lib/whatsapp/consent'

function formatDate(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00')
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
}

export interface ResultadoOferta {
  ok: boolean
  /** A cuántos se les avisó de verdad. */
  notified: number
  /**
   * A cuántos NO se les pudo avisar por falta de plantilla aprobada fuera de la
   * ventana de 24 h.
   *
   * Se cuenta APARTE porque `notified: 0` no distingue «no había nadie en lista»
   * de «no se pudo avisar a nadie», y sólo uno de los dos significa que el hueco
   * sigue esperando a que alguien lo tome. Además cada omitido queda en el
   * registro de no entregados, que es justo el libro que se creó para esto.
   */
  omitidos: number
  error?: string
}

export async function ofrecerHuecoLiberado(
  clinicId: string,
  slot: { fecha: string; hora: string; tipo?: string; medicoId?: string },
): Promise<ResultadoOferta> {
  const { fecha, hora, tipo: slotTipo, medicoId: slotMedicoId } = slot
  let omitidos = 0
  try {
    const clinicRef = adminDb.collection('clinics').doc(clinicId)

    // Load config
    const configSnap = await clinicRef.collection('config').doc('main').get()
    if (!configSnap.exists) {
      return { ok: false, notified: 0, omitidos, error: 'no config' }
    }
    const config = configSnap.data() as ClinicConfig
    // Config de plantillas HSM de la clínica (para envío fuera de ventana 24 h).
    const clinicSnap = await clinicRef.get()
    const waConfig = clinicSnap.data()?.whatsapp as { plantillas?: Record<string, { name?: string; lang?: string }> } | undefined

    // Candidatos activos ordenados por prioridad (1 = MAYOR prioridad → asc).
    // Antes era 'desc', que ofrecía el slot al paciente MENOS prioritario.
    // Traemos más de 3 para poder filtrar por compatibilidad y aún notificar a 3.
    /**
     * TAMBIÉN LOS YA CONTACTADOS, PASADO UN TIEMPO.
     *
     * Al ofrecer un hueco se marcaba `contactado`, y la consulta de ofertas
     * futuras exigía `activo`: un paciente que recibía UNA oferta y no
     * contestaba —porque estaba trabajando, o no vio el mensaje— **no volvía a
     * recibir ninguna nunca**. Quedaba en la lista de espera para siempre sin
     * que la lista sirviera para nada.
     *
     * Se traen los dos estados y se filtra abajo por antigüedad del contacto:
     * `contactado` significa «ya se le ofreció algo hace poco», no «ya no
     * cuenta». El filtro va en memoria porque un `where in` + dos `orderBy`
     * exige un índice compuesto que hay que crear a mano en la consola — y
     * mientras no exista, la lectura falla ENTERA y no se ofrece a nadie.
     */
    const waitlistSnap = await clinicRef.collection('waitlist')
      .where('estado', 'in', ['activo', 'contactado'])
      .limit(60)
      .get()

    if (waitlistSnap.empty) {
      return { ok: true, notified: 0, omitidos }
    }

    const clinicName = config.nombreClinica || config.nombreMedico
    let notified = 0
    const LIMITE_NOTIFICAR = 3

    /**
     * Orden y elegibilidad en memoria (ver `lib/whatsapp/lista-espera.ts`):
     * prioridad, luego antigüedad, y los ya contactados vuelven a la rueda
     * pasadas unas horas en vez de quedar desterrados para siempre.
     */
    const ordenados = candidatos(
      waitlistSnap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) })),
      Date.now(),
    )

    for (const entradaOrdenada of ordenados) {
      const doc = waitlistSnap.docs.find(d => d.id === entradaOrdenada.id)!
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
        // La zona REAL del consultorio: el tope diario por contacto se cuenta
        // por su día, no por el de México central (Tijuana cierra 2 h antes).
        fechaHoyMx: hoyISO(config.zonaHoraria || TZ_DEFAULT),
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
            // medicoId del hueco liberado: sin esto el bot agendaba con el primer
            // doctor activo, no con el médico al que pertenecía el hueco.
            medicoId: slotMedicoId || '',
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
        // `contactadoEn` es lo que permite que vuelva a entrar en la rueda: sin
        // fecha, «contactado» sería otra vez un destierro permanente.
        await clinicRef.collection('waitlist').doc(entry.id)
          .update({ estado: 'contactado', contactadoEn: new Date().toISOString() })
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
              medicoId: slotMedicoId || '',
            },
          },
        }, Date.now())
      } else {
        /**
         * `omitido` = fuera de la ventana de 24 h y SIN plantilla aprobada.
         *
         * Se contaba como resuelto y no llegaba a ningún registro: la oferta del
         * hueco se perdía en silencio —nadie ocupaba el horario y nadie se
         * enteraba— y la respuesta decía `notified: 0`, indistinguible de «no
         * había nadie en lista». Ahora queda en el libro de no entregados, que
         * es exactamente para lo que se creó.
         */
        omitidos++
        void registrarNoEntregado(
          clinicId, entry.pacienteTelefono || '', msg,
          'lista-espera', 'sin-plantilla-fuera-de-ventana',
        )
      }
    }

    return { ok: true, notified, omitidos }
  } catch (err) {
    safeLog.error('[ofrecerHuecoLiberado]', err)
    return { ok: false, notified: 0, omitidos, error: 'No se pudo ofrecer el hueco' }
  }
}
