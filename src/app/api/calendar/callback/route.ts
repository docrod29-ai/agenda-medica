import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { getTokensFromCode } from '@/lib/google-calendar'
import { adminDb } from '@/lib/firebase-admin'
import { vincularMedico, type Vinculo, type MedicoVinculable } from '@/lib/calendario/vinculo-medico'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const nonce = searchParams.get('state') // nonce de un solo uso creado en /connect

  const base = process.env.NEXT_PUBLIC_APP_URL
  if (!code) {
    return NextResponse.redirect(`${base}/configuracion?gcal=error&msg=no_code`)
  }

  try {
    // El uid NO se toma del `state`: se recupera del nonce guardado server-side en
    // /connect, ligado a la sesión autenticada. Un `state` desconocido/expirado se
    // rechaza → cierra el secuestro de cuenta / fuga de PHI por OAuth.
    if (!nonce) {
      return NextResponse.redirect(`${base}/configuracion?gcal=error&msg=state_invalido`)
    }
    const stateRef = adminDb.collection('oauthStates').doc(nonce)
    const stateSnap = await stateRef.get()
    const st = stateSnap.data()
    // Consumir el nonce SIEMPRE (un solo uso), aunque luego falle algo.
    await stateRef.delete().catch(() => {})

    if (!stateSnap.exists || !st?.uid || (typeof st.exp === 'number' && st.exp < Date.now())) {
      return NextResponse.redirect(`${base}/configuracion?gcal=error&msg=state_invalido`)
    }
    const uid = st.uid as string

    const tokens = await getTokensFromCode(code)

    // Sin refresh_token NO queda nada guardado → no reportar "conectado" en falso.
    // (Google solo lo devuelve con prompt=consent/access_type=offline la 1ª vez.)
    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${base}/configuracion?gcal=error&msg=sin_permiso_offline`)
    }

    /**
     * EL VÍNCULO MÉDICO ↔ uid, QUE NO EXISTÍA.
     *
     * El token vive en `googleTokens/{uid}` y la agenda razona con `medicoId`
     * (el id del documento en `doctors`). Sin relación entre los dos, el portal
     * público, el bot y el reagendado del paciente NO pueden consultar el
     * freebusy de Google: un paciente puede reservar encima de algo que el
     * médico ya tiene apuntado en su calendario.
     *
     * Éste es el ÚNICO momento en que se sabe con certeza que un uid es de una
     * persona concreta: cuando esa persona conecta su propio calendario. Se liga
     * por correo EXACTO y sólo si es inequívoco; si no, se declara y no se
     * adivina (`lib/calendario/vinculo-medico.ts`). Ligarlo mal sería enseñarle
     * a un médico las horas ocupadas de otro.
     */
    const miembro = await adminDb.collection('clinic_members').doc(uid).get().catch(() => null)
    const clinicId = (miembro?.data() as { clinicId?: string } | undefined)?.clinicId ?? ''
    let vinculo: Vinculo = { como: 'sin-vinculo', motivo: 'No se pudo leer a qué consultorio perteneces.' }
    if (clinicId) {
      try {
        const docsSnap = await adminDb.collection('clinics').doc(clinicId).collection('doctors').get()
        const doctores = docsSnap.docs.map(d => ({ id: d.id, ...(d.data() as object) })) as MedicoVinculable[]
        vinculo = vincularMedico(uid, st.email as string | undefined, doctores)
        if (vinculo.medicoId && vinculo.como === 'por-correo') {
          await adminDb.collection('clinics').doc(clinicId).collection('doctors')
            .doc(vinculo.medicoId).set({ uid }, { merge: true })
        }
      } catch { /* conectar el calendario no se cae por no poder ligarlo */ }
    }

    await adminDb.collection('googleTokens').doc(uid).set({
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      expiryDate: tokens.expiry_date,
      // Con qué consultorio y qué médico: es lo que permite que un camino SIN
      // sesión encuentre el token del médico de la cita.
      clinicId,
      medicoId: vinculo.medicoId ?? '',
      vinculoMedico: vinculo.como,
      vinculoMotivo: vinculo.motivo,
      updatedAt: new Date().toISOString(),
    })

    // Si no se pudo ligar, el médico se entera al volver: el calendario está
    // conectado, pero la agenda pública todavía no puede tenerlo en cuenta.
    const sufijo = vinculo.medicoId ? '' : `&vinculo=${encodeURIComponent(vinculo.motivo.slice(0, 180))}`
    return NextResponse.redirect(`${base}/configuracion?gcal=connected${sufijo}`)
  } catch (err) {
    safeLog.error('Google Calendar callback error:', err)
    return NextResponse.redirect(`${base}/configuracion?gcal=error&msg=${encodeURIComponent(String(err))}`)
  }
}
