import { NextRequest, NextResponse } from 'next/server'
import { errorAlCliente } from '@/lib/security/error-al-cliente'
import { adminDb } from '@/lib/firebase-admin'
import { verificarUsuario } from '@/lib/auth-server'
import { rellenarVinculoSiFalta } from '@/lib/calendario/ligar-en-servidor'
import { AVISO_SIN_VINCULO } from '@/lib/calendario/vinculo-medico'

export async function GET(req: NextRequest) {
  // uid del token: antes se consultaba el estado de conexión de cualquier uid.
  const acc = await verificarUsuario(req)
  if (!acc.ok) return NextResponse.json({ connected: false })
  try {
    /**
     * AQUÍ SE RELLENA EL VÍNCULO QUE LES FALTA A LOS QUE YA ESTABAN CONECTADOS.
     *
     * El vínculo `médico ↔ uid` se escribe al conectar el calendario, así que
     * quien lo conectó antes de que eso existiera no tiene ninguno: su pantalla
     * dice «conectado» y, sin embargo, la agenda pública no puede descontar sus
     * eventos de Google — un paciente puede reservar encima de algo que ya tiene
     * apuntado.
     *
     * Nadie va a reconectar por su cuenta algo que no sabe que le falta. Esta
     * ruta la llama su propia pantalla de configuración con su sesión, que es
     * justo el momento en que se sabe con certeza quién es, así que se rellena
     * solo, con las mismas reglas y sin recalcular un vínculo que ya exista.
     */
    const relleno = await rellenarVinculoSiFalta(acc.uid, acc.email)
    if (relleno.estado === 'sin-calendario') return NextResponse.json({ connected: false })

    // Y si aun así no se pudo ligar, se DICE: callarlo dejaría al médico creyendo
    // que la agenda pública ya tiene en cuenta su calendario.
    return NextResponse.json({
      connected: true,
      vinculado: relleno.ligado,
      aviso: relleno.ligado ? '' : (relleno.motivo || AVISO_SIN_VINCULO),
    })
  } catch {
    return NextResponse.json({ connected: false })
  }
}

export async function DELETE(req: NextRequest) {
  // uid del token: antes cualquiera desconectaba el Google Calendar de otro usuario.
  const acc = await verificarUsuario(req)
  if (!acc.ok) return acc.response
  try {
    await adminDb.collection('googleTokens').doc(acc.uid).delete()
    return NextResponse.json({ success: true })
  } catch (err) {
    return errorAlCliente()
  }
}
