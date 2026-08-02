/**
 * POST /api/whatsapp/waitlist-notify
 *
 * La PUERTA HTTP de «se liberó un hueco, ofrécelo». La lógica vive en
 * `lib/whatsapp/ofrecer-hueco.ts` porque el portal del paciente también la
 * necesita y no tiene sesión de miembro: cuando el paciente cancelaba, el hueco
 * quedaba libre y no se le ofrecía a nadie.
 *
 * Body: { fecha, hora, clinicId, tipo?, medicoId? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarMiembro } from '@/lib/auth-server'
import { ofrecerHuecoLiberado } from '@/lib/whatsapp/ofrecer-hueco'

export async function POST(req: NextRequest) {
  const { fecha, hora, clinicId, tipo, medicoId } = await req.json().catch(() => ({}))
  if (!fecha || !hora || !clinicId) {
    return NextResponse.json({ error: 'fecha, hora y clinicId requeridos' }, { status: 400 })
  }

  // AUTORIZACIÓN: sólo un miembro de la clínica dispara avisos desde fuera
  // (antes era público → spam y mutación de estado). El portal del paciente NO
  // pasa por aquí: llama a la función directamente con su propio token ya
  // verificado.
  const acc = await verificarMiembro(req, clinicId)
  if (!acc.ok) return acc.response

  const r = await ofrecerHuecoLiberado(clinicId, { fecha, hora, tipo, medicoId })
  return NextResponse.json(r, { status: r.ok ? 200 : 500 })
}
