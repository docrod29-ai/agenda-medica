/**
 * LA CAPACIDAD, Y ADEMÁS EL PACIENTE — D-057.
 *
 * `verificarCapacidad` dice si el rol puede; esto dice si puede SOBRE ESTE
 * paciente: titular, compartido o admin (`alcance-del-paciente.ts`). Las rutas
 * del Admin SDK no pasan por `firestore.rules`, así que sin este embudo un
 * médico del consultorio podía exportar o leer por FHIR el expediente de un
 * paciente de otro médico aunque la pantalla se lo negara.
 *
 * Vive en su propio módulo, y no en `verificar.ts`, a propósito: lee
 * `patients`, y el guardián que congela «qué rutas tocan la identidad del
 * paciente» mira las bibliotecas que cada ruta importa. Sólo las rutas que de
 * verdad abren un expediente importan esto.
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import type { Acceso } from '@/lib/auth-server'
import type { Capacidad } from './capabilities'
import { verificarCapacidad } from './verificar'
import { anotarDenegacion, rutaSinParametros } from '@/lib/ops/lo-que-no-deberia-pasar'
import { puedeVerExpediente, TEXTO_SIN_ACCESO, type FichaDeAlcance } from './alcance-del-paciente'

export async function verificarCapacidadSobrePaciente(
  req: NextRequest,
  clinicId: string,
  patientId: string,
  capacidad: Capacidad,
): Promise<Acceso> {
  const acceso = await verificarCapacidad(req, clinicId, capacidad)
  if (!acceso.ok) return acceso
  const snap = await adminDb.collection('clinics').doc(clinicId).collection('patients').doc(patientId).get()
  if (!snap.exists) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'Paciente no encontrado' }, { status: 404 }) }
  }
  const ficha = snap.data() as FichaDeAlcance
  if (!puedeVerExpediente(ficha, acceso.uid, acceso.role)) {
    anotarDenegacion({ uid: acceso.uid, clinicId, ruta: rutaSinParametros(req.nextUrl?.pathname ?? ''), capacidad: `${capacidad}:paciente_de_otro_medico`, cuando: new Date().toISOString() })
    return { ok: false, response: NextResponse.json({ ok: false, error: TEXTO_SIN_ACCESO.de_otro_medico }, { status: 403 }) }
  }
  return acceso
}
