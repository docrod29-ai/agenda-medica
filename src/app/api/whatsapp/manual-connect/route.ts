/**
 * POST /api/whatsapp/manual-connect
 *
 * Conexión manual de WhatsApp (Meta Cloud API) sin Embedded Signup.
 * El médico pega su Phone Number ID y su access token (del panel de Meta
 * o del número de prueba). Validamos el token consultando Graph API y,
 * si es válido, guardamos las credenciales en la clínica.
 *
 * Body: { clinicId, phoneNumberId, token }
 */
import { NextRequest, NextResponse } from 'next/server'
import { errorAlCliente } from '@/lib/security/error-al-cliente'
import { reclamarCanal } from '@/lib/whatsapp/reclamar-canal'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { guardarSecretoCanal } from '@/lib/whatsapp/secreto-canal'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { fetchConTimeout, TiempoAgotado } from '@/lib/fetch-con-timeout'

const GRAPH = 'https://graph.facebook.com/v20.0'

export async function POST(req: NextRequest) {
  try {
    const { clinicId, phoneNumberId, token } = await req.json()

    if (!clinicId || !phoneNumberId || !token) {
      return NextResponse.json({ ok: false, error: 'Faltan clinicId, phoneNumberId o token' }, { status: 400 })
    }
    // Seguridad: solo un miembro de ESTA clínica puede conectar su WhatsApp.
    // Antes era anónimo → se podía secuestrar el canal de otra clínica.
    const acceso = await verificarCapacidad(req, clinicId, 'administrar')
    if (!acceso.ok) return acceso.response

    // 1. Validar credenciales: pedir el número a Graph API
    const res = await fetchConTimeout(
      `${GRAPH}/${phoneNumberId}?fields=display_phone_number,verified_name&access_token=${encodeURIComponent(token)}`
    )
    if (!res.ok) {
      const err = await res.text()
      safeLog.error('[manual-connect] Validación falló:', res.status, err)
      return NextResponse.json(
        { ok: false, error: 'Credenciales inválidas. Revisa el Phone Number ID y el token.' },
        { status: 400 },
      )
    }
    const data = await res.json()
    const phoneNumber: string = data.display_phone_number ?? `ID ${phoneNumberId}`

    // 2. Guardar en la clínica
    const now = new Date().toISOString()
    await guardarSecretoCanal(clinicId, token)
    const whatsapp = {
      provider: 'meta',
      phoneNumberId,
      phoneNumber,
      connected: true,
      connectedAt: now,
    }
    await adminDb.collection('clinics').doc(clinicId).update({ whatsapp, updatedAt: now })

    // 3. Índice para que el webhook encuentre la clínica por phoneNumberId.
    //    No se sobrescribe el de otro consultorio: ver `reclamarCanal`.
    const reclamo = await reclamarCanal(phoneNumberId, clinicId, { provider: 'meta', phoneNumber, createdAt: now })
    if (!reclamo.ok) {
      safeLog.warn(`[manual-connect] canal ya en uso por ${reclamo.dueñoPrevio ?? '?'}`)
      return NextResponse.json({ ok: false, error: reclamo.error }, { status: 409 })
    }

    return NextResponse.json({ ok: true, phoneNumber })
  } catch (err) {
    safeLog.error('[manual-connect] Error:', err)
    // Igual que en `meta-connect`: «se tardó» y «falló» se contestan distinto.
    if (err instanceof TiempoAgotado) {
      return NextResponse.json({
        ok: false,
        error: 'Meta no respondió a tiempo. No se cambió nada: vuelve a intentar la conexión.',
      }, { status: 504 })
    }
    return errorAlCliente()
  }
}
