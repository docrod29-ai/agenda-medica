/**
 * Orquestador de mensajes PROACTIVOS — Iteración WA-1 · TEMPLATES_AND_WINDOW.
 *
 * Une las piezas: ventana de 24 h + plantilla de la clínica + envío, y decide el
 * canal correcto. Es la puerta única para recordatorios y avisos de lista de
 * espera → imposible enviar texto libre fuera de la ventana por accidente.
 */

import { sendWhatsApp, sendWhatsAppTemplate } from '@/lib/whatsapp-send'
import { ventanaAbierta, decidirCanalProactivo } from '@/lib/whatsapp/window'
import {
  resolverPlantillaClinica, type ClavePlantilla, type DatosProactivos, type ConfigPlantillasClinica,
} from '@/lib/whatsapp/templates'
import { ultimoEntranteAt } from '@/lib/whatsapp/contacts'
import { resolverSilencio, enHorarioPermitido, type ConfigSilencio } from '@/lib/whatsapp/horario'

export type ResultadoProactivo = 'enviado' | 'omitido' | 'fallo' | 'optout' | 'silencio'

/**
 * Envía un mensaje proactivo por el canal correcto:
 *  - ventana abierta → texto libre (respeta opt-out, agrega pie BAJA).
 *  - ventana cerrada + plantilla aprobada de la clínica → plantilla HSM.
 *  - ventana cerrada sin plantilla → OMITE (no manda texto libre; Meta lo rechazaría)
 *    y lo registra para visibilidad.
 */
export async function enviarProactivo(
  clinicId: string,
  to: string,
  opts: {
    clave: ClavePlantilla
    datos: DatosProactivos
    textoLibre: string
    waConfig?: (ConfigPlantillasClinica & ConfigSilencio) | null
    ahoraMs: number
    /** ahoraMinutosDelDia() en MX. Si se da, se respetan las horas de silencio. */
    minutosDelDiaMx?: number
  },
): Promise<{ resultado: ResultadoProactivo; via: 'texto' | 'plantilla' | 'ninguno' }> {
  // Horas de silencio: no enviar proactivos de madrugada. El recordatorio no se
  // marca enviado → el siguiente ciclo del cron lo reintenta cuando pase el silencio.
  if (opts.minutosDelDiaMx != null) {
    const silencio = resolverSilencio(opts.waConfig)
    if (!enHorarioPermitido(opts.minutosDelDiaMx, silencio)) {
      return { resultado: 'silencio', via: 'ninguno' }
    }
  }

  const last = await ultimoEntranteAt(clinicId, to)
  const abierta = ventanaAbierta(last, opts.ahoraMs)
  const plantilla = resolverPlantillaClinica(opts.waConfig, opts.clave)
  const canal = decidirCanalProactivo({ ventanaAbierta: abierta, plantillaDisponible: !!plantilla })

  if (canal === 'texto') {
    const r = await sendWhatsApp(clinicId, to, opts.textoLibre, { proactivo: true })
    if (r.optout) return { resultado: 'optout', via: 'ninguno' }
    return { resultado: r.ok ? 'enviado' : 'fallo', via: 'texto' }
  }

  if (canal === 'plantilla' && plantilla) {
    const r = await sendWhatsAppTemplate(
      clinicId, to,
      { name: plantilla.name, lang: plantilla.lang, bodyParams: plantilla.construirParametros(opts.datos) },
      { proactivo: true },
    )
    if (r.optout) return { resultado: 'optout', via: 'ninguno' }
    return { resultado: r.ok ? 'enviado' : 'fallo', via: 'plantilla' }
  }

  // omitir: fuera de ventana y sin plantilla aprobada
  console.warn(
    `[whatsapp/proactivo] omitido (fuera de ventana 24h, sin plantilla '${opts.clave}' configurada) clínica ${clinicId}`,
  )
  return { resultado: 'omitido', via: 'ninguno' }
}
