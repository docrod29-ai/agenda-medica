/**
 * GET /api/facturacion/descargar?clinicId=...&pagoId=...&tipo=pdf|xml
 *
 * Descarga el PDF o XML de un CFDI ya emitido para un pago del consultorio.
 * Devuelve el archivo (miembro del consultorio).
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarMiembro } from '@/lib/auth-server'
import { descargarCFDI } from '@/lib/facturama'

type Any = Record<string, unknown>

export async function GET(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get('clinicId') ?? ''
  const pagoId = req.nextUrl.searchParams.get('pagoId') ?? ''
  const tipo = (req.nextUrl.searchParams.get('tipo') === 'xml' ? 'xml' : 'pdf') as 'pdf' | 'xml'
  if (!clinicId || !pagoId) return NextResponse.json({ ok: false, error: 'Faltan datos' }, { status: 400 })

  const acceso = await verificarMiembro(req, clinicId)
  if (!acceso.ok) return acceso.response

  try {
    const pago = (await adminDb.collection('platform_payments').doc(pagoId).get()).data() as Any | undefined
    if (!pago || String(pago.clinicId ?? '') !== clinicId) return NextResponse.json({ ok: false, error: 'Pago no encontrado' }, { status: 404 })
    if (!pago.cfdiId) return NextResponse.json({ ok: false, error: 'Ese pago aún no tiene factura' }, { status: 400 })

    const b64 = await descargarCFDI(String(pago.cfdiId), tipo)
    const buf = Buffer.from(b64, 'base64')
    const uuid = String(pago.cfdiUuid ?? 'factura')
    return new NextResponse(buf, {
      headers: {
        'Content-Type': tipo === 'pdf' ? 'application/pdf' : 'application/xml',
        'Content-Disposition': `attachment; filename="factura-${uuid}.${tipo}"`,
      },
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 200) }, { status: 500 })
  }
}

export const runtime = 'nodejs'
