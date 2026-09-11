/**
 * POST /api/expediente/estudio-aportado  { clinicId, patientId, id }
 *
 * ABRIR EL ESTUDIO QUE SUBIÓ EL PACIENTE — D-058.
 *
 * El objeto vive en Storage bajo `estudios-paciente/{clinicId}/{patientId}/` y
 * las reglas del bucket no dejan leerlo a NADIE desde el navegador: el médico
 * lo abre con una URL firmada de quince minutos que sólo emite esta ruta, y
 * sólo al médico DEL paciente (`verificarCapacidadSobrePaciente`, D-057). Así
 * el archivo nunca depende de una regla de lectura que un token filtrado
 * pudiera aprovechar, y cada apertura queda en la bitácora.
 */
import { NextRequest, NextResponse } from 'next/server'
import admin, { adminDb } from '@/lib/firebase-admin'
import { safeLog } from '@/lib/security/sanitize'
import { verificarCapacidadSobrePaciente } from '@/lib/authz/verificar-paciente'
import { esRutaDeEstudioDe, type EstudioAportado } from '@/lib/portal/estudios-aportados'

const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? ''
export const MINUTOS_DE_ENLACE = 15
const ID = /^[A-Za-z0-9_-]{1,120}$/

export async function POST(req: NextRequest) {
  let body: { clinicId?: unknown; patientId?: unknown; id?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 }) }
  const clinicId = String(body.clinicId ?? ''), patientId = String(body.patientId ?? ''), id = String(body.id ?? '')
  if (!ID.test(clinicId) || !ID.test(patientId) || !ID.test(id)) {
    return NextResponse.json({ ok: false, error: 'Faltan clinicId, patientId o id' }, { status: 400 })
  }
  const acceso = await verificarCapacidadSobrePaciente(req, clinicId, patientId, 'clinico.escribir')
  if (!acceso.ok) return acceso.response

  try {
    const base = adminDb.collection('clinics').doc(clinicId)
    const snap = await base.collection('patients').doc(patientId).collection('estudios_aportados').doc(id).get()
    if (!snap.exists) return NextResponse.json({ ok: false, error: 'Estudio no encontrado' }, { status: 404 })
    const e = snap.data() as EstudioAportado
    // La ruta guardada tiene que ser de ESTE paciente: si alguien la editara a mano, aquí se para.
    if (!esRutaDeEstudioDe(e.ruta, clinicId, patientId)) {
      return NextResponse.json({ ok: false, error: 'La ruta del estudio no es de este expediente' }, { status: 409 })
    }
    const expira = Date.now() + MINUTOS_DE_ENLACE * 60_000
    const [url] = await admin.storage().bucket(BUCKET).file(e.ruta).getSignedUrl({ version: 'v4', action: 'read', expires: expira })
    await base.collection('audit_log').add({
      evento: 'estudio_aportado_abierto', clinicId, patientId, medicoUid: acceso.uid,
      timestamp: new Date().toISOString(), meta: { id },
    }).catch(() => { /* la bitácora no bloquea la lectura */ })
    return NextResponse.json({ ok: true, url, expira, contentType: e.contentType, nombre: e.nombre })
  } catch (err) {
    safeLog.error('[estudio-aportado] no se pudo firmar la URL', err)
    return NextResponse.json({ ok: false, error: 'No se pudo abrir el estudio. Inténtalo de nuevo.' }, { status: 503 })
  }
}
