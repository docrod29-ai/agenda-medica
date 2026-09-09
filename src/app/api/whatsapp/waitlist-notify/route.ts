/**
 * POST /api/whatsapp/waitlist-notify
 *
 * La PUERTA HTTP de «se liberó un hueco, ofrécelo». La lógica vive en
 * `lib/whatsapp/ofrecer-hueco.ts` porque el portal del paciente también la
 * necesita y no tiene sesión de miembro: cuando el paciente cancelaba, el hueco
 * quedaba libre y no se le ofrecía a nadie.
 *
 * Body: { fecha, hora, clinicId, tipo?, duracion?, medicoId? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarMiembro } from '@/lib/auth-server'
import { ofrecerHuecoLiberado } from '@/lib/whatsapp/ofrecer-hueco'

export async function POST(req: NextRequest) {
  const { fecha, hora, clinicId, tipo, duracion, medicoId } = await req.json().catch(() => ({}))
  if (!fecha || !hora || !clinicId) {
    return NextResponse.json({ error: 'fecha, hora y clinicId requeridos' }, { status: 400 })
  }

  // AUTORIZACIÓN: sólo un miembro de la clínica dispara avisos desde fuera
  // (antes era público → spam y mutación de estado). El portal del paciente NO
  // pasa por aquí: llama a la función directamente con su propio token ya
  // verificado.
  const acc = await verificarMiembro(req, clinicId)
  if (!acc.ok) return acc.response

  /**
   * LA DURACIÓN DEL HUECO — que por esta puerta no viajaba.
   *
   * `ofrecerHuecoLiberado` comprueba el rango horario del paciente contra el
   * hueco COMPLETO, y sin este dato asumía 30 minutos. Los otros dos llamadores
   * —el bot y el portal— sí la mandan; ésta, que es por donde pasa la
   * cancelación DESDE EL CONSULTORIO, no.
   *
   * Las dos formas de equivocarse, y las dos silenciosas:
   *
   *  · Un retiro de 15 min que se libera a las 11:45 se evaluaba como
   *    11:45-12:15, así que a quien pidió «9-12» se le saltaba — cuando el
   *    hueco le cabía entero. Un hueco de un cuarto de hora no es un hueco
   *    inútil: es exactamente lo que espera quien viene a que le quiten unos
   *    puntos.
   *  · Al revés, una consulta larga de 90 min se evaluaba como 30 y se le
   *    ofrecía a quien no podía quedarse tanto.
   *
   * Ninguna de las dos se detecta desde fuera: el que no recibe un mensaje no se
   * queja de no haberlo recibido.
   *
   * Sin el dato se conserva el comportamiento de antes (30 min por defecto, en
   * la función): una petición vieja no puede quedarse sin ofrecer el hueco.
   */
  const duracionHueco = Number(duracion)
  const r = await ofrecerHuecoLiberado(clinicId, {
    fecha, hora, tipo, medicoId,
    duracion: Number.isFinite(duracionHueco) && duracionHueco > 0 ? duracionHueco : undefined,
  })
  return NextResponse.json(r, { status: r.ok ? 200 : 500 })
}
