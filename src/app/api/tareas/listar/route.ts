import { NextRequest, NextResponse } from 'next/server'
import type { Query, QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { puedeVerExpediente, ROLES_CON_EXPEDIENTE } from '@/lib/authz/alcance-del-paciente'
import type { Rol } from '@/lib/authz/matriz-acceso'
import { pesoDeUrgencia, type EstadoTarea, type TareaClinica } from '@/lib/tareas-clinicas/modelo'
import type { WorklistVivo } from '@/lib/tareas-clinicas/firestore'
import { conRespaldoSinIndice } from '@/lib/firestore/indice-que-todavia-no-esta'
import { safeLog } from '@/lib/security/sanitize'

export const maxDuration = 60
const VIVOS: EstadoTarea[] = ['solicitada', 'aceptada', 'en_curso', 'agendada', 'completada']
const PAGINA = 200
// Tareas examinadas; las fichas de autorización se leen por lotes una vez por petición.
const PRESUPUESTO = 5000
const segmento = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 1500 && !v.includes('/') && v !== '.' && v !== '..'

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    const valor: unknown = await req.json()
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('Cuerpo inválido')
    body = valor as Record<string, unknown>
  } catch { return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 }) }
  if (!segmento(body.clinicId) || (body.modo !== 'vivas' && body.modo !== 'cerradas')) {
    return NextResponse.json({ error: 'Faltan clínica o modo válido' }, { status: 400 })
  }
  const clinicId = body.clinicId
  const acc = await verificarCapacidad(req, clinicId, 'tareas.leer')
  if (!acc.ok) return acc.response
  const { uid, role } = acc
  const solicitado = typeof body.tope === 'number' && Number.isFinite(body.tope) ? Math.floor(body.tope) : body.modo === 'cerradas' ? 30 : 200
  const tope = Math.max(1, Math.min(200, solicitado))
  const soloRecepcion = body.soloRecepcion === true || !ROLES_CON_EXPEDIENTE.includes(role as Rol)
  const base = adminDb.collection('clinics').doc(clinicId)
  let cola: Query = base.collection('tareas_clinicas')
  if (soloRecepcion) cola = cola.where('area', '==', 'recepcion')
  const permisos = new Map<string, boolean>() // No sobrevive a la petición ni a una revocación.
  let examinados = 0

  async function filtrar(docs: QueryDocumentSnapshot[]) {
    if (role === 'admin') return docs
    if (soloRecepcion) return docs.filter(d => d.get('area') === 'recepcion')
    const ids = [...new Set(docs.filter(d => d.get('area') !== 'recepcion')
      .map(d => d.get('patientId')).filter((id): id is string => segmento(id) && !permisos.has(id)))]
    if (ids.length) {
      const fichas = await adminDb.getAll(...ids.map(id => base.collection('patients').doc(id)), { fieldMask: ['medicoTitularUid', 'compartidoCon'] })
      for (const ficha of fichas) permisos.set(ficha.id, ficha.exists && puedeVerExpediente(ficha.data(), uid, role))
    }
    return docs.filter(d => d.get('area') === 'recepcion' || permisos.get(d.get('patientId')) === true)
  }

  async function leer(q: Query, presupuesto: number) {
    const tareas: TareaClinica[] = []
    let cursor: QueryDocumentSnapshot | undefined
    let recorridos = 0
    let agotada = false
    while (tareas.length <= tope && recorridos < presupuesto && examinados < PRESUPUESTO) {
      const cantidad = Math.min(PAGINA, tope + 1 - tareas.length, presupuesto - recorridos, PRESUPUESTO - examinados)
      const pagina = await (cursor ? q.startAfter(cursor) : q).limit(cantidad).get()
      recorridos += pagina.size
      examinados += pagina.size
      for (const d of await filtrar(pagina.docs)) tareas.push({ ...(d.data() as TareaClinica), id: d.id })
      if (pagina.size < cantidad) { agotada = true; break }
      cursor = pagina.docs[pagina.docs.length - 1]
    }
    return { tareas, truncada: tareas.length > tope || !agotada, presupuestoAgotado: !agotada && tareas.length <= tope }
  }

  try {
    let resultado: WorklistVivo & { presupuestoAgotado: boolean }
    if (body.modo === 'cerradas') {
      const p = await leer(cola.where('estado', '==', 'cerrada'), PRESUPUESTO)
      resultado = { ...p, tareas: p.tareas.slice(0, tope), tope, ordenadaPorUrgencia: true, migracionPendiente: false }
    } else {
      const vivas = cola.where('estado', 'in', VIVOS)
      const antiguas = vivas.orderBy('creadaEn', 'asc')
      // Se conserva la red de P1-14: orderBy(pesoUrgencia) excluye el legado sin peso.
      const { valor: urgentes, degradada } = await conRespaldoSinIndice(
        'tareas_clinicas(estado, pesoUrgencia, creadaEn)',
        () => leer(vivas.orderBy('pesoUrgencia', 'asc').orderBy('creadaEn', 'asc'), PRESUPUESTO / 2),
        () => leer(antiguas, PRESUPUESTO),
      )
      const red = degradada ? urgentes : await leer(antiguas, PRESUPUESTO / 2)
      const porId = new Map<string, TareaClinica>()
      for (const t of [...urgentes.tareas, ...red.tareas]) porId.set(String(t.id), t)
      const todas = [...porId.values()]
      resultado = {
        tareas: todas.sort((a, b) => pesoDeUrgencia(a.prioridad) - pesoDeUrgencia(b.prioridad) || String(a.creadaEn).localeCompare(String(b.creadaEn))).slice(0, tope),
        tope, truncada: urgentes.truncada || red.truncada || todas.length > tope,
        ordenadaPorUrgencia: !degradada,
        migracionPendiente: todas.some(t => typeof t.pesoUrgencia !== 'number'),
        presupuestoAgotado: urgentes.presupuestoAgotado || red.presupuestoAgotado,
      }
    }
    return NextResponse.json(resultado, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    safeLog.error('[tareas/listar] lectura', e)
    return NextResponse.json({ error: 'No se pudieron cargar los pendientes. Inténtalo nuevamente.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
