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
import { safeLog } from '@/lib/security/sanitize'
import { verificarMiembro } from '@/lib/auth-server'
import { parsearORU, parsearADT, oruAFHIR, construirACK } from '@/lib/hl7/v2'
import { traducirVitales, hayVitales } from '@/lib/dispositivos/vitales-hl7'
import { origenDesdeFuente } from '@/lib/expediente/procedencia'

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

    /**
     * ADAPTADOR DE DISPOSITIVOS: los signos vitales que trae el mensaje.
     *
     * Casi todos los monitores de cabecera hablan HL7 y mandan un `OBX` por
     * parámetro. El convertidor sólo devolvía FHIR genérico; ahora también
     * traduce lo que es un signo vital al mismo `RegistroSignos` que usan el
     * censo, NEWS2 y la nota — con la unidad VALIDADA y la hora del aparato.
     *
     * Lo que no se entiende se DECLARA en `descartados` en vez de colarse: una
     * temperatura en Fahrenheit leída como Celsius es 37 donde había 98.6, y
     * NEWS2 puntúa con ese número. Ver `lib/dispositivos/vitales-hl7.ts`.
     */
    const vitales = traducirVitales(oru.resultados.map(r => ({
      codigo: r.codigo, valor: r.valor, unidad: r.unidad, medidoEn: r.medidoEn,
    })))

    return NextResponse.json({
      ok: true,
      tipo: 'oru',
      oru,
      vitales: {
        ...vitales,
        // Que quien lo guarde no pueda confundirlo con algo que tecleó alguien:
        // la fuente Y su equivalente en el vocabulario de procedencia de la nota,
        // donde `manual` significa literalmente «lo escribió el médico».
        fuente: 'dispositivo',
        origenProcedencia: origenDesdeFuente('dispositivo'),
        hay: hayVitales(vitales),
      },
      fhir: { resourceType: 'Bundle', type: 'collection', total: observations.length, entry: observations.map(r => ({ resource: r })) },
      ack: construirACK(oru.mensajeControlId || ''),
    })
  } catch (err) {
    safeLog.error('[hl7/convertir] error:', err)
    return NextResponse.json({ error: 'No se pudo procesar el mensaje HL7' }, { status: 422 })
  }
}
