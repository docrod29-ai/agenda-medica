/**
 * GET/POST /api/whatsapp/plantillas-config?clinicId=...
 *
 * Deja al médico registrar los NOMBRES de las plantillas HSM aprobadas en Meta
 * (paso 2 del alta de recordatorios fuera de la ventana de 24 h), además de las
 * horas de silencio y el tope diario — sin editar Firestore a mano.
 *
 * Escribe en clinics/{id}.whatsapp.{plantillas, silencio, topeDiarioProactivo}.
 * Solo miembros con rol médico/admin.
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarMedico } from '@/lib/auth-server'

const CLAVES = ['recordatorio24h', 'recordatorioMismoDia', 'listaEspera'] as const
type Clave = typeof CLAVES[number]

const NOMBRE_OK = /^[a-z0-9_]{1,512}$/       // formato de nombre de plantilla de Meta
const HHMM_OK = /^\d{1,2}:\d{2}$/

export async function GET(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get('clinicId')
  if (!clinicId) return NextResponse.json({ error: 'clinicId requerido' }, { status: 400 })
  const acc = await verificarMedico(req, clinicId)
  if (!acc.ok) return acc.response

  try {
    const snap = await adminDb.collection('clinics').doc(clinicId).get()
    const wa = (snap.data()?.whatsapp ?? {}) as Record<string, unknown>
    return NextResponse.json({
      ok: true,
      plantillas: wa.plantillas ?? {},
      silencio: wa.silencio ?? { activo: true, inicio: '21:00', fin: '08:00' },
      topeDiarioProactivo: typeof wa.topeDiarioProactivo === 'number' ? wa.topeDiarioProactivo : 3,
    })
  } catch (err) {
    console.error('[plantillas-config] GET error:', err)
    return NextResponse.json({ error: 'No se pudo leer la configuración' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: {
    clinicId?: string
    plantillas?: Partial<Record<Clave, { name?: string; lang?: string }>>
    silencio?: { activo?: boolean; inicio?: string; fin?: string }
    topeDiarioProactivo?: number
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const clinicId = body.clinicId
  if (!clinicId) return NextResponse.json({ error: 'clinicId requerido' }, { status: 400 })
  const acc = await verificarMedico(req, clinicId)
  if (!acc.ok) return acc.response

  // ── Validación + saneo (solo se escriben campos permitidos) ──
  const errores: string[] = []
  const plantillas: Record<string, { name: string; lang: string }> = {}
  for (const clave of CLAVES) {
    const p = body.plantillas?.[clave]
    if (!p) continue
    const name = (p.name ?? '').trim()
    if (name === '') continue // vacío = no configurada (se omite el registro de esa clave)
    if (!NOMBRE_OK.test(name)) {
      errores.push(`Nombre inválido para ${clave}: usa solo minúsculas, números y guion bajo.`)
      continue
    }
    const lang = (p.lang ?? 'es_MX').trim() || 'es_MX'
    plantillas[clave] = { name, lang }
  }

  const wa: Record<string, unknown> = { plantillas }

  if (body.silencio) {
    const s = body.silencio
    const inicio = (s.inicio ?? '').trim()
    const fin = (s.fin ?? '').trim()
    if (inicio && !HHMM_OK.test(inicio)) errores.push('Hora de inicio de silencio inválida (usa HH:MM).')
    if (fin && !HHMM_OK.test(fin)) errores.push('Hora de fin de silencio inválida (usa HH:MM).')
    wa.silencio = {
      activo: s.activo !== false,
      inicio: HHMM_OK.test(inicio) ? inicio : '21:00',
      fin: HHMM_OK.test(fin) ? fin : '08:00',
    }
  }

  if (body.topeDiarioProactivo != null) {
    const t = Number(body.topeDiarioProactivo)
    if (!Number.isFinite(t) || t < 1 || t > 20) errores.push('El tope diario debe estar entre 1 y 20.')
    else wa.topeDiarioProactivo = Math.floor(t)
  }

  if (errores.length) return NextResponse.json({ error: errores.join(' ') }, { status: 400 })

  try {
    await adminDb.collection('clinics').doc(clinicId).set({ whatsapp: wa }, { merge: true })
    return NextResponse.json({ ok: true, plantillas: wa.plantillas })
  } catch (err) {
    console.error('[plantillas-config] POST error:', err)
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
}
