/**
 * GET/POST /api/uci/estancia
 *
 * La ESTANCIA en UCI (`ICUStay`) de un internamiento: ingreso a la unidad y
 * **soportes activos**.
 *
 * ── POR QUÉ PASA POR EL SERVIDOR ─────────────────────────────────────────────
 *
 * `icu_stays` tiene `allow create, update, delete: if false` en las reglas: el
 * cliente NO escribe. A diferencia de `icu_observations` —que enfermería captura
 * a pie de cama y por eso sí se escribe desde el navegador—, la estancia define
 * de qué soportes depende el paciente, y de eso cuelga cómo se adapta la
 * interfaz (charter §32). Es un dato de estructura, no una toma: se valida
 * contra el catálogo antes de guardarse.
 *
 * ── LO QUE VALIDA ────────────────────────────────────────────────────────────
 *
 * Cada soporte tiene que estar en `SOPORTES_ACTIVOS`. Un soporte desconocido se
 * RECHAZA en vez de guardarse: si entrara texto libre, la pantalla que se adapta
 * a los soportes empezaría a recibir valores que no sabe interpretar y dejaría de
 * mostrar módulos sin decir por qué.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * **No deduce soportes de las mediciones.** Que haya una PEEP anotada no prueba
 * que el paciente siga ventilado: el ventilador pudo retirarse y la última toma
 * seguir ahí. Los soportes los declara quien pasa visita.
 */

import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { SOPORTES_ACTIVOS, type SoporteActivo, type ICUStay } from '@/types/hospital'

/** Un internamiento tiene UNA estancia de UCI vigente: id estable, sin duplicados. */
const ID_ESTANCIA = 'actual'

function ref(clinicId: string, internamientoId: string) {
  return adminDb.collection('clinics').doc(clinicId)
    .collection('internamientos').doc(internamientoId)
    .collection('icu_stays').doc(ID_ESTANCIA)
}

export async function GET(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get('clinicId')
  const internamientoId = req.nextUrl.searchParams.get('internamientoId')
  if (!clinicId || !internamientoId) {
    return NextResponse.json({ error: 'clinicId e internamientoId requeridos' }, { status: 400 })
  }
  const acc = await verificarCapacidad(req, clinicId, 'clinico.leer')
  if (!acc.ok) return acc.response

  try {
    const snap = await ref(clinicId, internamientoId).get()
    if (!snap.exists) return NextResponse.json({ ok: true, estancia: null })
    return NextResponse.json({ ok: true, estancia: { ...snap.data(), id: snap.id } })
  } catch (err) {
    safeLog.error('[uci/estancia] GET error:', err)
    return NextResponse.json({ error: 'No se pudo leer la estancia de UCI' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: {
    clinicId?: string
    internamientoId?: string
    pacienteId?: string
    soportes?: unknown
    motivoIngresoUci?: string
    fechaIngresoUci?: string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { clinicId, internamientoId } = body
  if (!clinicId || !internamientoId) {
    return NextResponse.json({ error: 'clinicId e internamientoId requeridos' }, { status: 400 })
  }
  const acc = await verificarCapacidad(req, clinicId, 'clinico.escribir')
  if (!acc.ok) return acc.response

  // Los soportes se validan contra el catálogo. Uno desconocido se RECHAZA:
  // guardarlo dejaría a la interfaz que se adapta a ellos recibiendo valores que
  // no sabe interpretar, y ocultaría módulos sin decir por qué.
  if (!Array.isArray(body.soportes)) {
    return NextResponse.json({ error: 'soportes debe ser un arreglo' }, { status: 400 })
  }
  const desconocidos = body.soportes.filter(
    s => !(SOPORTES_ACTIVOS as readonly string[]).includes(String(s)))
  if (desconocidos.length > 0) {
    return NextResponse.json({
      error: `Soporte no reconocido: ${desconocidos.map(String).join(', ')}. ` +
        'Sólo se aceptan los del catálogo del charter §32.',
    }, { status: 400 })
  }
  const soportes = [...new Set(body.soportes.map(String))] as SoporteActivo[]

  try {
    const doc = ref(clinicId, internamientoId)
    const previo = await doc.get()

    // El ingreso a UCI se fija UNA vez: si ya existe, no se reescribe. Cambiarlo
    // desplazaría el día de UCI y la duración de estancia de todo el episodio.
    const fechaIngresoUci = previo.exists
      ? (previo.data() as ICUStay).fechaIngresoUci
      : (body.fechaIngresoUci ?? new Date().toISOString())

    const datos: Record<string, unknown> = {
      internamientoId,
      estado: previo.exists ? (previo.data() as ICUStay).estado : 'activa',
      fechaIngresoUci,
      soportes,
      actualizadoPor: acc.uid,
      actualizadoEn: new Date().toISOString(),
    }
    if (body.pacienteId) datos.pacienteId = body.pacienteId
    if (body.motivoIngresoUci !== undefined) datos.motivoIngresoUci = body.motivoIngresoUci

    await doc.set(datos, { merge: true })
    return NextResponse.json({ ok: true, estancia: { ...datos, id: ID_ESTANCIA } })
  } catch (err) {
    safeLog.error('[uci/estancia] POST error:', err)
    return NextResponse.json({ error: 'No se pudo guardar la estancia de UCI' }, { status: 500 })
  }
}
