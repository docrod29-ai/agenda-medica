/**
 * Gestión de las API keys de IA por consultorio.
 *
 *   GET  ?clinicId=…           → estado ENMASCARADO + uso del mes (miembro)
 *   POST { clinicId, proveedor, key } → guarda/borra la llave (solo médico/admin)
 *
 * La llave nunca se devuelve al cliente; solo "configurada: true · ····1234".
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarMiembro, verificarMedico } from '@/lib/auth-server'
import { estadoClavesIA, guardarClaveIA, type ProveedorIA } from '@/lib/ai-keys'

export const runtime = 'nodejs'

const PROVEEDORES: ProveedorIA[] = ['anthropic', 'assemblyai', 'openai']

export async function GET(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get('clinicId') ?? ''
  const acceso = await verificarMiembro(req, clinicId)
  if (!acceso.ok) return acceso.response
  try {
    return NextResponse.json({ ok: true, ...(await estadoClavesIA(clinicId)) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 120) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: { clinicId?: string; proveedor?: string; key?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }
  const { clinicId, proveedor, key } = body
  if (!clinicId || !proveedor) {
    return NextResponse.json({ ok: false, error: 'Faltan clinicId o proveedor' }, { status: 400 })
  }
  if (!PROVEEDORES.includes(proveedor as ProveedorIA)) {
    return NextResponse.json({ ok: false, error: 'Proveedor no válido' }, { status: 400 })
  }
  // Solo médico/admin del consultorio puede tocar las llaves.
  const acceso = await verificarMedico(req, clinicId)
  if (!acceso.ok) return acceso.response
  try {
    await guardarClaveIA(clinicId, proveedor as ProveedorIA, key ?? '')
    return NextResponse.json({ ok: true, ...(await estadoClavesIA(clinicId)) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 120) }, { status: 500 })
  }
}
