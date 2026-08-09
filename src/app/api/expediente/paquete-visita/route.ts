/**
 * POST /api/expediente/paquete-visita   { clinicId, patientId, notaId }
 *
 * LA COMPUERTA Y EL CAMINO DE `POSTVISIT-001`.
 *
 * `componerPaquete` es puro y no lee Firestore: esta ruta es quien resuelve
 * «qué está firmado, qué estaba vigente antes, quién aprueba y cuándo» y se lo
 * entrega ya armado. `paquetes_visita` tiene `allow write: if false` en
 * `firestore.rules` — sólo el Admin SDK, es decir sólo esta clase de ruta,
 * puede escribir aquí. Esconder el botón no basta; el servidor es quien manda.
 *
 * ── LA COMPUERTA DE FIRMA (POSTVISIT-GATE-001) ──────────────────────────────
 *
 * «Firmar» y «liberar» son dos actos (regla 4 de `patient-facing-ai.md`), y
 * esta ruta es donde el segundo exige al primero: sin `nota.estado ===
 * 'firmada'`, no hay paquete. Un borrador nunca llega al paciente aunque
 * alguien golpee este endpoint directamente.
 *
 * ── POR QUÉ SE RECOMPONE AQUÍ Y NO SE ACEPTA LO QUE MANDÓ EL CLIENTE ────────
 *
 * El cliente puede enseñar una vista previa (los mismos datos ya están en la
 * pantalla de consulta, con `comoSeLoExplico`), pero lo que se GUARDA se
 * recalcula del lado del servidor a partir de la nota firmada en Firestore.
 * «Autorización en el servidor, no en la pantalla» (regla de aislamiento):
 * confiar en un `PaqueteDeVisita` que llegó en el body dejaría que cualquiera
 * con el token de sesión escribiera lo que quisiera en un documento clínico.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { adminDb } from '@/lib/firebase-admin'
import { safeLog } from '@/lib/security/sanitize'
import { medicamentosVigentes } from '@/lib/expediente/ordenes-medicamento'
import { telefonoDelConsultorio } from '@/lib/whatsapp/avisar-consultorio'
import { componerPaquete, liberar, type PaqueteDeVisita } from '@/lib/paciente/paquete-de-visita'
import type { NotaMedica } from '@/types/expediente'
import type { ClinicConfig } from '@/types'

export async function POST(req: NextRequest) {
  let body: { clinicId?: string; patientId?: string; notaId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { clinicId, patientId, notaId } = body
  if (!clinicId || !patientId || !notaId) {
    return NextResponse.json({ error: 'clinicId, patientId y notaId requeridos' }, { status: 400 })
  }

  const acc = await verificarCapacidad(req, clinicId, 'clinico.escribir')
  if (!acc.ok) return acc.response

  try {
    const refPaciente = adminDb.collection('clinics').doc(clinicId).collection('patients').doc(patientId)

    const notaSnap = await refPaciente.collection('notas').doc(notaId).get()
    if (!notaSnap.exists) return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 })
    const nota = notaSnap.data() as Omit<NotaMedica, 'id'>

    if (nota.estado !== 'firmada') {
      return NextResponse.json(
        { error: 'La nota no está firmada. Fírmala antes de liberar el paquete al paciente.' },
        { status: 409 },
      )
    }
    if (nota.internamientoId) {
      return NextResponse.json(
        {
          error:
            'Los paquetes de visita son para consulta ambulatoria. Las notas de hospitalización se resuelven en el episodio.',
        },
        { status: 400 },
      )
    }

    /*
     * Todas las notas FIRMADAS del paciente, para derivar «lo vigente» con la
     * misma regla que usa el expediente: la nota más reciente que menciona un
     * fármaco manda sobre él, y el silencio no suspende un crónico.
     */
    const fechaDeEstaNota = nota.fechaConsulta ?? nota.metadata?.fechaCreacion ?? ''
    const todasSnap = await refPaciente.collection('notas').where('estado', '==', 'firmada').get()
    const firmadas = todasSnap.docs
      .map((d: FirebaseFirestore.QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as Omit<NotaMedica, 'id'>) }))
      .map(n => ({ id: n.id, fecha: n.fechaConsulta ?? n.metadata?.fechaCreacion ?? '', medicamentos: n.medicamentos }))

    const anteriores = firmadas.filter((n: (typeof firmadas)[number]) => n.id !== notaId && n.fecha < fechaDeEstaNota)
    const vigentesAntes = medicamentosVigentes(anteriores).map(v => ({ nombre: v.medicamento.nombre }))
    const vigentesDespues = medicamentosVigentes([...anteriores, { fecha: fechaDeEstaNota, medicamentos: nota.medicamentos }])
      .map(v => v.medicamento)

    // Versión: cuántos paquetes ya existen para ESTA nota, +1. Nunca se pisa uno anterior.
    const previosSnap = await refPaciente.collection('paquetes_visita').where('notaId', '==', notaId).get()
    const version = previosSnap.size + 1

    const configSnap = await adminDb.collection('clinics').doc(clinicId).collection('config').doc('main').get()
    const config = configSnap.exists ? (configSnap.data() as ClinicConfig) : null
    const telefono = telefonoDelConsultorio(config ?? undefined)
    const nombreConsultorio = config?.nombreClinica || config?.nombreMedico || 'su consultorio'
    const reglasDeContactoClinico = telefono
      ? `Si tiene dudas o una urgencia relacionada con esta consulta, comuníquese a ${nombreConsultorio}: ${telefono}.`
      : ''

    const borrador = componerPaquete({
      notaId,
      medicamentosVigentes: vigentesDespues,
      medicamentosVigentesAntes: vigentesAntes,
      estudios: nota.estudiosOrden ?? [],
      resumenEncuentro: nota.resumenEjecutivo,
      reglasDeContactoClinico,
      version,
    })

    const aprobadoPor = (nota.firma?.nombreMedico ?? '').trim() || acc.email || acc.uid
    const paquete = liberar(borrador, aprobadoPor, Date.now())

    const docRef = await refPaciente.collection('paquetes_visita').add(paquete satisfies PaqueteDeVisita)

    safeLog.info('[paquete-visita] liberado', docRef.id, 'nota:', notaId, 'version:', version)
    return NextResponse.json({ ok: true, id: docRef.id, paquete })
  } catch (e) {
    safeLog.error('[paquete-visita] error', e)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
