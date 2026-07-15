/**
 * GET/POST /api/voz/comandos-config?clinicId=...
 *
 * Guarda la configuración del reconocimiento de comandos de voz 100% en el
 * dispositivo (Picovoice): AccessKey + URLs de las palabras clave entrenadas.
 * Escribe en clinics/{id}.voz.picovoice. Solo médico/admin.
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarMedico } from '@/lib/auth-server'

export async function GET(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get('clinicId')
  if (!clinicId) return NextResponse.json({ error: 'clinicId requerido' }, { status: 400 })
  const acc = await verificarMedico(req, clinicId)
  if (!acc.ok) return acc.response

  try {
    const snap = await adminDb.collection('clinics').doc(clinicId).get()
    const pico = (snap.data()?.voz?.picovoice ?? {}) as Record<string, unknown>
    return NextResponse.json({ ok: true, picovoice: pico })
  } catch (err) {
    console.error('[voz/comandos-config] GET error:', err)
    return NextResponse.json({ error: 'No se pudo leer la configuración' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: {
    clinicId?: string
    accessKey?: string
    keywordIniciarUrl?: string
    keywordCerrarUrl?: string
    modeloEsUrl?: string
    sensibilidad?: number
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const clinicId = body.clinicId
  if (!clinicId) return NextResponse.json({ error: 'clinicId requerido' }, { status: 400 })
  const acc = await verificarMedico(req, clinicId)
  if (!acc.ok) return acc.response

  const s = Number(body.sensibilidad)
  const picovoice = {
    accessKey: (body.accessKey ?? '').trim(),
    keywordIniciarUrl: (body.keywordIniciarUrl ?? '').trim(),
    keywordCerrarUrl: (body.keywordCerrarUrl ?? '').trim(),
    modeloEsUrl: (body.modeloEsUrl ?? '').trim() || '/porcupine/porcupine_params_es.pv',
    sensibilidad: Number.isFinite(s) && s >= 0 && s <= 1 ? s : 0.6,
  }

  try {
    await adminDb.collection('clinics').doc(clinicId).set({ voz: { picovoice } }, { merge: true })
    return NextResponse.json({ ok: true, picovoice })
  } catch (err) {
    console.error('[voz/comandos-config] POST error:', err)
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
}
