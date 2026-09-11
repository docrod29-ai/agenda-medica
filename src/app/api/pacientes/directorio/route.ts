import { NextRequest, NextResponse } from 'next/server'
import { FieldPath } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { puedeVerExpediente } from '@/lib/authz/alcance-del-paciente'
import { safeLog } from '@/lib/security/sanitize'

// La ficha administrativa es una proyección, nunca una segunda fuente de datos.
// Lista blanca: campos nuevos permanecen privados hasta una decisión explícita.
const CAMPOS_DIRECTORIO = [
  'nombre', 'telefono', 'email', 'fechaNacimiento', 'sexo', 'curp', 'seguroMedico',
  'createdAt', 'updatedAt', 'medicoTitularUid',
] as const
const segmento = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 1500 && !v.includes('/') && v !== '.' && v !== '..'
const texto = (v: unknown): v is string => typeof v === 'string' && v.length <= 200

function proyectarPaciente(id: string, datos: Record<string, unknown>, uid: string, role: string | undefined) {
  if (puedeVerExpediente(datos, uid, role)) return { ...datos, id }
  const ficha: Record<string, unknown> = Object.fromEntries(CAMPOS_DIRECTORIO.filter(k => typeof datos[k] === 'string' || typeof datos[k] === 'number' || datos[k] === null).map(k => [k, datos[k]]))
  if (Array.isArray(datos.compartidoCon)) ficha.compartidoCon = datos.compartidoCon.filter(v => typeof v === 'string')
  if (datos.responsable && typeof datos.responsable === 'object') {
    const responsable = datos.responsable as Record<string, unknown>
    ficha.responsable = Object.fromEntries(['nombre', 'parentesco', 'telefono', 'identificacion'].filter(k => typeof responsable[k] === 'string').map(k => [k, responsable[k]]))
  }
  return { ...ficha, id }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    const valor: unknown = await req.json()
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('Cuerpo inválido')
    body = valor as Record<string, unknown>
  } catch { return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 }) }
  if (!segmento(body.clinicId)) return NextResponse.json({ error: 'Clínica inválida' }, { status: 400 })
  const acceso = await verificarCapacidad(req, body.clinicId, 'pacientes.directorio')
  if (!acceso.ok) return acceso.response
  const { uid, role } = acceso
  const limite = typeof body.limite === 'number' && Number.isFinite(body.limite)
    ? Math.min(200, Math.max(1, Math.floor(body.limite))) : 50
  const pacientes = adminDb.collection('clinics').doc(body.clinicId).collection('patients')
  const respuesta = (dato: unknown) => NextResponse.json(dato, { headers: { 'Cache-Control': 'no-store' } })
  try {
    if (body.modo === 'uno') {
      if (!segmento(body.patientId)) return NextResponse.json({ error: 'Paciente inválido' }, { status: 400 })
      const ficha = await pacientes.doc(body.patientId).get()
      return respuesta({ paciente: ficha.exists ? proyectarPaciente(ficha.id, ficha.data()!, uid, role) : null })
    }
    if (body.modo === 'sondeo') {
      // IDs autorizados para rescatar enlaces antiguos, con el techo original.
      const pagina = await pacientes.orderBy(FieldPath.documentId(), 'asc').limit(limite + 1).get()
      return respuesta({ pacientes: pagina.docs.slice(0, limite).filter(d => puedeVerExpediente(d.data(), uid, role)).map(d => ({ id: d.id })), hayMas: pagina.docs.length > limite })
    }
    if (body.modo === 'pagina') {
      let q = pacientes.orderBy('nombre', 'asc').orderBy(FieldPath.documentId(), 'asc')
      if (body.cursor != null) {
        const c = body.cursor as Record<string, unknown>
        if (!c || !texto(c.nombre) || !segmento(c.id)) return NextResponse.json({ error: 'Cursor inválido' }, { status: 400 })
        q = q.startAfter(c.nombre, c.id)
      }
      const pagina = await q.limit(limite + 1).get()
      const hayMas = pagina.docs.length > limite
      const docs = pagina.docs.slice(0, limite)
      const ultimo = docs.at(-1)
      return respuesta({
        pacientes: docs.map(d => proyectarPaciente(d.id, d.data(), uid, role)),
        cursor: hayMas && ultimo ? { nombre: String(ultimo.get('nombre') ?? ''), id: ultimo.id } : null,
        hayMas, limite,
      })
    }
    if (body.modo === 'prefijo' && ['nombre', 'telefono', 'email', 'curp'].includes(String(body.campo)) && texto(body.valor) && body.valor) {
      const campo = String(body.campo)
      const pagina = await pacientes.orderBy(campo, 'asc').where(campo, '>=', body.valor)
        .where(campo, '<', body.valor + String.fromCharCode(0xf8ff)).limit(limite).get()
      return respuesta({ pacientes: pagina.docs.map(d => proyectarPaciente(d.id, d.data(), uid, role)) })
    }
    return NextResponse.json({ error: 'Consulta inválida' }, { status: 400 })
  } catch (e) {
    safeLog.error('[pacientes/directorio] lectura', e)
    return NextResponse.json({ error: 'No se pudo leer el directorio. Inténtalo nuevamente.' }, { status: 503 })
  }
}
