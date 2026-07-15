/**
 * GET /api/whatsapp/entregas?clinicId=...&dias=14
 *
 * Resumen de entregabilidad de WhatsApp para el médico: cuántos mensajes se
 * entregaron, leyeron o fallaron en los últimos N días. Lee whatsapp_status
 * (poblado por los webhooks de estado, Iter. 6). Solo miembros de la clínica.
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarMiembro } from '@/lib/auth-server'
import { resumirEntregas } from '@/lib/whatsapp/entregas'
import type { EstadoMensaje } from '@/lib/whatsapp/status'

export async function GET(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get('clinicId')
  if (!clinicId) return NextResponse.json({ error: 'clinicId requerido' }, { status: 400 })

  const acc = await verificarMiembro(req, clinicId)
  if (!acc.ok) return acc.response

  const diasParam = Number(req.nextUrl.searchParams.get('dias') || '14')
  const dias = Number.isFinite(diasParam) ? Math.min(Math.max(diasParam, 1), 90) : 14
  const corte = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()

  try {
    const snap = await adminDb
      .collection('clinics').doc(clinicId)
      .collection('whatsapp_status')
      .where('updatedAt', '>=', corte)
      .get()

    const items: EstadoMensaje[] = snap.docs.map(d => {
      const x = d.data()
      return {
        wamid: (x.wamid as string) || d.id,
        estado: (x.estado as string) || 'unknown',
        telefono: x.telefono as string | undefined,
        timestamp: x.timestamp as string | undefined,
        errorCode: x.errorCode as number | undefined,
        errorTitulo: x.errorTitulo as string | undefined,
      }
    })

    return NextResponse.json({ ok: true, dias, resumen: resumirEntregas(items) })
  } catch (err) {
    console.error('[whatsapp/entregas] error:', err)
    return NextResponse.json({ error: 'No se pudo leer la entregabilidad' }, { status: 500 })
  }
}
