/**
 * POST /api/hl7/convertir?clinicId=...
 *
 * Recibe un mensaje HL7 v2 (ORU^R01 o ADT) en texto plano y devuelve su versión
 * NORMALIZADA + FHIR (Observations para ORU). NO almacena nada: es el convertidor
 * que demuestra la interoperabilidad de entrada; la persistencia a un LIS real es
 * un paso posterior. Solo miembros de la clínica.
 *
 * Body: texto crudo HL7 (Content-Type text/plain). Query: ?clinicId=&tipo=oru|adt
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarMiembro } from '@/lib/auth-server'
import { parsearORU, parsearADT, oruAFHIR, construirACK } from '@/lib/hl7/v2'

export async function POST(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get('clinicId')
  if (!clinicId) return NextResponse.json({ error: 'clinicId requerido' }, { status: 400 })

  const acc = await verificarMiembro(req, clinicId)
  if (!acc.ok) return acc.response

  const tipo = (req.nextUrl.searchParams.get('tipo') || 'oru').toLowerCase()
  let mensaje = ''
  try { mensaje = await req.text() } catch { /* vacío */ }
  if (!mensaje.trim()) return NextResponse.json({ error: 'Cuerpo HL7 vacío' }, { status: 400 })

  try {
    if (tipo === 'adt') {
      return NextResponse.json({ ok: true, tipo: 'adt', adt: parsearADT(mensaje) })
    }
    const oru = parsearORU(mensaje)
    const observations = oruAFHIR(oru, oru.paciente.id ? `Patient/${oru.paciente.id}` : 'Patient/desconocido')
    return NextResponse.json({
      ok: true,
      tipo: 'oru',
      oru,
      fhir: { resourceType: 'Bundle', type: 'collection', total: observations.length, entry: observations.map(r => ({ resource: r })) },
      ack: construirACK(oru.mensajeControlId || ''),
    })
  } catch (err) {
    console.error('[hl7/convertir] error:', err)
    return NextResponse.json({ error: 'No se pudo procesar el mensaje HL7' }, { status: 422 })
  }
}
