import { NextRequest, NextResponse } from 'next/server'
import { verificarMedico } from '@/lib/auth-server'
import { linkVerificacionReceta } from '@/lib/receta-token'
import { adminDb } from '@/lib/firebase-admin'
import { datosCertificado } from '@/lib/receta-certificado'
import type { NotaMedica } from '@/types/expediente'

/**
 * Firma la URL de verificación de una receta (destino del QR): /verificar/<token>.
 * El token es HMAC, sin datos del paciente (solo ids + info del prescriptor ya
 * impresa en la receta). Requiere rol MÉDICO/admin de la clínica.
 *
 * REG-025 (E0-01) — LO QUE CAMBIÓ Y POR QUÉ:
 * Antes esta ruta firmaba `folio`, `doctorNombre` y `cedula` tal como venían en
 * el body. Es decir, el servidor certificaba lo que el cliente le dictara: un
 * POST a mano con `cedula: '9999999'` y un `notaId` inventado producía una URL
 * que /verificar presenta como "Integridad verificada". Exigir rol médico
 * (auditoría previa) cerró el vector de la recepcionista, pero no el fondo: el
 * certificado no estaba ligado a ningún documento real.
 *
 * Ahora del body SOLO se aceptan LOCALIZADORES (clinicId, patientId, notaId) y
 * la huella opaca de lo impreso. Todo lo que el certificado AFIRMA se deriva de
 * la nota leída con el Admin SDK (`datosCertificado`), que no tiene forma de
 * recibir datos de la petición. `clinicId` es autoritativo de facto porque
 * `verificarMedico` lo contrasta contra `clinic_members/{uid}.clinicId`, así que
 * el path leído nunca cruza tenant.
 *
 * Efecto secundario deseado: en consultorios con varios médicos el QR deja de
 * decir la identidad de quien imprime y dice la de quien FIRMÓ la nota.
 *
 * Devuelve { url, folio, doctorNombre, cedula, origenEmisor } — el cliente sigue
 * usando solo `url`; el resto es informativo/diagnóstico.
 */
export const runtime = 'nodejs' // Admin SDK

export async function POST(req: NextRequest) {
  let body: { clinicId?: string; patientId?: string; notaId?: string; contenidoHash?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
  }

  // Solo un MÉDICO/admin acuña el certificado de verificación (auditoría P0):
  // antes era cualquier miembro → una recepcionista podía firmar un "Integridad
  // verificada". Se hace ANTES de tocar Firestore.
  const acc = await verificarMedico(req, body.clinicId || '')
  if (!acc.ok) return acc.response

  if (!body.patientId || !body.notaId) {
    return NextResponse.json({ error: 'Falta patientId o notaId' }, { status: 400 })
  }

  // La nota es la fuente de verdad del certificado. Si no existe, no hay nada
  // que certificar: esto es lo que mata el notaId inventado.
  let nota: NotaMedica
  try {
    const snap = await adminDb
      .doc(`clinics/${body.clinicId}/patients/${body.patientId}/notas/${body.notaId}`)
      .get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 })
    }
    nota = { ...(snap.data() as NotaMedica), id: snap.id }
  } catch {
    // Fail-CERRADO: sin poder leer la nota no se acuña certificado alguno. El
    // cliente ya degrada solo (el QR cae a "Folio:<folio>" en texto).
    return NextResponse.json({ error: 'No se pudo leer la nota' }, { status: 503 })
  }

  // Solo se certifican notas FIRMADAS. Hoy la UI únicamente ofrece "Generar
  // receta" sobre notas firmadas, así que este 409 es inalcanzable por el flujo
  // normal; existe para que no se pueda emitir un certificado de un borrador
  // llamando a la API directamente.
  if (nota.estado !== 'firmada') {
    return NextResponse.json({ error: 'La nota no está firmada' }, { status: 409 })
  }

  const datos = datosCertificado(body.notaId, nota)

  const origin = req.headers.get('origin') || req.nextUrl.origin
  const url = linkVerificacionReceta(origin, {
    clinicId: body.clinicId!,
    notaId: body.notaId,
    folio: datos.folio,
    doctorNombre: datos.doctorNombre,
    cedula: datos.cedula,
    // Huella del contenido IMPRESO (el médico puede ajustar medicamentos en la
    // pantalla de receta sin que eso se guarde en la nota, así que no puede
    // exigirse que coincida con ella). Es un hash opaco de 8 hex, no una
    // afirmación de identidad: se acota por si llega manipulada.
    contenidoHash: typeof body.contenidoHash === 'string' && /^[0-9a-f]{1,16}$/.test(body.contenidoHash) ? body.contenidoHash : undefined,
    // Huella de los medicamentos de la NOTA — esta sí la calcula el servidor.
    huellaNota: datos.huellaNota,
  })

  return NextResponse.json({
    url,
    folio: datos.folio,
    doctorNombre: datos.doctorNombre,
    cedula: datos.cedula,
    origenEmisor: datos.origenEmisor,
  })
}
