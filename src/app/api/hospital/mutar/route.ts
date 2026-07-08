/**
 * POST /api/hospital/mutar
 *
 * GATEWAY de mutaciones del internamiento con RBAC POR ACCIÓN validado en el
 * SERVIDOR (Admin SDK). Las Firestore Rules bloquean la escritura directa del
 * cliente al doc de internamiento; todo cambio pasa por aquí, donde el rol del
 * usuario (clinic_members) decide si la acción está permitida.
 *
 * Body: { clinicId, internamientoId?, accion, payload }
 * Resp: { ok, id? } | { ok:false, error }
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarMiembro } from '@/lib/auth-server'
import { adminDb } from '@/lib/firebase-admin'
import { randomUUID } from 'crypto'

// Qué rol puede ejecutar cada acción.
const GATES: Record<string, string[]> = {
  crear:                 ['medico', 'admin'],
  egresar:               ['medico', 'admin'],
  trasladar:             ['medico', 'admin'],
  cambiar_tratante:      ['medico', 'admin'],
  indicacion_agregar:    ['medico', 'admin'],
  indicacion_suspender:  ['medico', 'admin'],
  interconsulta_agregar: ['medico', 'admin'],
  interconsulta_responder: ['medico', 'admin'],
  conciliar:             ['medico', 'admin'],
  administrar:           ['enfermeria', 'medico', 'admin'],
  balance:               ['enfermeria', 'medico', 'admin'],
  escala:                ['enfermeria', 'medico', 'admin'],
  sbar:                  ['enfermeria', 'medico', 'admin'],
  verificar_farmacia:    ['farmacia', 'medico', 'admin'],
}

type Any = Record<string, unknown>

// Calcula el patch para el doc de internamiento según la acción (mismo comportamiento que la lib cliente).
function patch(accion: string, inter: Any, p: Any, now: string): Any {
  const arr = (k: string) => (Array.isArray(inter[k]) ? (inter[k] as Any[]) : [])
  switch (accion) {
    case 'egresar':
      return { estado: 'egresado', fechaEgreso: now, tipoEgreso: p.tipoEgreso, resumenEgreso: p.resumenEgreso }
    case 'trasladar': {
      const detalle = `${inter.servicio}${inter.cama ? ' · Cama ' + inter.cama : ''} → ${p.servicio}${p.cama ? ' · Cama ' + p.cama : ''}`
      return { servicio: p.servicio, cama: p.cama, movimientos: [...arr('movimientos'), { fecha: now, tipo: 'traslado', detalle, por: p.por }] }
    }
    case 'cambiar_tratante':
      return { medicoTratanteId: p.medicoTratanteId, medicoTratanteNombre: p.medicoTratanteNombre, movimientos: [...arr('movimientos'), { fecha: now, tipo: 'tratante', detalle: `${inter.medicoTratanteNombre || '—'} → ${p.medicoTratanteNombre}`, por: p.por }] }
    case 'indicacion_agregar':
      return { indicaciones: [...arr('indicaciones'), { id: randomUUID(), tipo: p.tipo, descripcion: p.descripcion, frecuencia: p.frecuencia, creadaPor: p.creadaPor, activa: true, fecha: now, administraciones: [] }] }
    case 'indicacion_suspender':
      return { indicaciones: arr('indicaciones').map(x => (x as Any).id === p.indId ? { ...x, activa: p.activa } : x) }
    case 'administrar':
      return { indicaciones: arr('indicaciones').map(x => (x as Any).id === p.indId ? { ...x, administraciones: [...((x as Any).administraciones as Any[] ?? []), p.adm] } : x) }
    case 'verificar_farmacia':
      return { indicaciones: arr('indicaciones').map(x => (x as Any).id === p.indId ? { ...x, verificadaFarmacia: true, verificadaPor: p.por, fechaVerificacion: now } : x) }
    case 'interconsulta_agregar':
      return { interconsultas: [...arr('interconsultas'), { id: randomUUID(), especialidad: p.especialidad, motivo: p.motivo, solicitanteNombre: p.solicitanteNombre, solicitanteId: p.solicitanteId ?? null, medicoSolicitadoId: p.medicoSolicitadoId ?? null, medicoSolicitadoNombre: p.medicoSolicitadoNombre ?? null, estado: 'solicitada', fecha: now }] }
    case 'interconsulta_responder':
      return { interconsultas: arr('interconsultas').map(x => (x as Any).id === p.icId ? { ...x, estado: 'respondida', fechaRespuesta: now, respuesta: p.respuesta, respondidaPor: p.respondidaPor } : x) }
    case 'conciliar':
      return { medicamentosCasa: p.meds, conciliadoAl: now }
    case 'balance':
      return { balanceHidrico: [...arr('balanceHidrico'), { fecha: now, ingresos: p.ingresos, egresos: p.egresos, por: p.por }].slice(-100) }
    case 'escala':
      return { escalas: [...arr('escalas'), { fecha: now, tipo: p.tipo, score: p.score, riesgo: p.riesgo, por: p.por }].slice(-100) }
    case 'sbar':
      return { sbar: [...arr('sbar'), { fecha: now, texto: p.texto, por: p.por }].slice(-50) }
    default:
      return {}
  }
}

export async function POST(req: NextRequest) {
  let body: { clinicId?: string; internamientoId?: string; accion?: string; payload?: Any }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }
  const { clinicId, internamientoId, accion, payload = {} } = body
  if (!clinicId || !accion) return NextResponse.json({ ok: false, error: 'clinicId y accion requeridos' }, { status: 400 })

  const acc = await verificarMiembro(req, clinicId)
  if (!acc.ok) return acc.response
  const roles = GATES[accion]
  if (!roles) return NextResponse.json({ ok: false, error: 'Acción desconocida' }, { status: 400 })
  if (!roles.includes(String(acc.role ?? ''))) return NextResponse.json({ ok: false, error: `Tu rol (${acc.role}) no puede: ${accion}` }, { status: 403 })

  const now = new Date().toISOString()
  const col = adminDb.collection('clinics').doc(clinicId).collection('internamientos')

  try {
    // Ingreso: create con guard de duplicado activo ATÓMICO (transacción: la
    // consulta y la escritura van juntas → dos ingresos simultáneos no cuelan).
    if (accion === 'crear') {
      if (!payload.pacienteId) return NextResponse.json({ ok: false, error: 'Falta el paciente' }, { status: 400 })
      try {
        const id = await adminDb.runTransaction(async (tx) => {
          const snap = await tx.get(col.where('pacienteId', '==', payload.pacienteId))
          if (snap.docs.some(d => d.data().estado === 'activo')) throw new Error('DUPLICADO')
          const nref = col.doc()
          tx.set(nref, { ...payload, clinicId, estado: 'activo', createdAt: now, updatedAt: now })
          return nref.id
        })
        return NextResponse.json({ ok: true, id })
      } catch (e) {
        if (e instanceof Error && e.message === 'DUPLICADO') return NextResponse.json({ ok: false, error: 'DUPLICADO: el paciente ya tiene un internamiento activo.' }, { status: 409 })
        throw e
      }
    }

    if (!internamientoId) return NextResponse.json({ ok: false, error: 'internamientoId requerido' }, { status: 400 })
    const ref = col.doc(internamientoId)
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new Error('no-existe')
      const inter = { id: snap.id, ...(snap.data() as Any) }
      tx.update(ref, { ...patch(accion, inter, payload, now), updatedAt: now })
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
