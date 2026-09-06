/**
 * POST /api/inmuno/redactar
 *
 * Redacta en prosa una nota de valoración infectológica del paciente
 * inmunocomprometido a partir del contexto ya compuesto (datos + estudios + PLAN
 * determinista). La IA SOLO redacta el plan dado; no inventa recomendaciones.
 * La API key vive en el servidor (llave del consultorio o ANTHROPIC_API_KEY).
 *
 * Body: { contexto: string }   Resp: { ok, texto } | { ok:false, error }
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarModuloIA } from '@/lib/auth-server'
import { limitarOResponder } from '@/lib/rate-limit'
import { COSTO_CREDITOS } from '@/lib/planes-ia'
import { llamarIA } from '@/lib/ia/gateway'
import { esFundador } from '@/lib/authz/fundador'
import { resolverClaveIA, creditosAgotados, registrarUso, registrarCreditos } from '@/lib/ai-keys'
import { correlacionDe } from '@/lib/observabilidad/correlacion'
import { iaNoDisponible } from '@/lib/ia/fallo-proveedor'

const ENV_ANTHROPIC = process.env.ANTHROPIC_API_KEY ?? ''
const MODELOS = ['claude-sonnet-4-6', 'claude-sonnet-4-5']

const SYSTEM = `Eres infectólogo de trasplantes y huésped inmunocomprometido. Redacta una NOTA DE VALORACIÓN INFECTOLÓGICA de nivel de publicación, en prosa profesional, lista para el expediente y para entregar a quien solicitó la interconsulta (nefrología, hematología, hepatología, reumatología, etc.). Debe leerse como escrita por un especialista y dejar impresionado al que la lea.

REGLAS ESTRICTAS:
- SOLO infectología. No incluyas recomendaciones de otras especialidades.
- SIN citas bibliográficas ni referencias de guías. La nota debe leerse como escrita por el propio médico, en prosa clínica natural — NO como un documento académico. Si en la información recibida vienen citas entre corchetes (p. ej. [KDIGO 2020]), OMÍTELAS por completo.
- SIN emojis.
- NO inventes dosis, fechas, microorganismos ni datos que no estén en la información dada. Si una dosis es necesaria y no se da, escribe "dosis a validar por el médico tratante".
- NO agregues recomendaciones clínicas nuevas fuera del PLAN que se te entrega: puedes integrarlo, ordenarlo, priorizarlo según el MOTIVO, agrupar por tema y explicarlo con claridad clínica, pero sin cambiar su contenido.
- Eres un apoyo a la decisión; el médico tratante valida.

ESTRUCTURA (prosa con encabezados en MAYÚSCULAS, sin viñetas con emojis; usa listas numeradas donde ayude):
1. RESUMEN DEL CASO — huésped, motivo de la interconsulta, estado de inmunosupresión y fase/día post-trasplante si aplica.
2. ANTECEDENTES INFECTOLÓGICOS RELEVANTES — comorbilidades, inmunosupresión actual (nombra los fármacos), dispositivos, exposiciones epidemiológicas, vacunación y alergias; menciona negativos pertinentes de forma concisa.
3. ESTUDIOS — interpreta los resultados disponibles y enumera los pendientes/solicitados.
4. IMPRESIÓN INFECTOLÓGICA — síntesis del riesgo (estratificación por huésped, carga de inmunosupresión, serostatus).
5. PLAN — reproduce, prioriza y agrupa el plan dado (tamizaje, profilaxis, vacunación, monitoreo) dirigido al motivo, en prosa clínica y SIN citas.
6. PENDIENTES Y SEGUIMIENTO — qué vigilar y cuándo reevaluar.

Devuelve solo la nota, sin preámbulos.`

export const maxDuration = 300  // redacción con IA; sin esto se cortaba a 60s en Vercel

export async function POST(req: NextRequest) {
  const acceso = await verificarModuloIA(req, 'expediente')
  if (!acceso.ok) return acceso.response

  // Tope de ráfaga: redacción con IA por llamada. 30/min por usuario.
  const limite = await limitarOResponder(`inmuno:${acceso.uid}`, 30, 60)
  if (limite) return limite

  const { key, fuente, clinicId } = await resolverClaveIA(acceso.uid, 'anthropic', ENV_ANTHROPIC)
  if (!key) {
    return NextResponse.json({ ok: false, error: iaNoDisponible('nota').mensaje }, { status: 503 })
  }
  if (fuente === 'prueba' && (await creditosAgotados(clinicId))) {
    return NextResponse.json({ ok: false, sinCreditos: true, error: 'Se acabaron tus créditos con IA del mes. Compra más o sube de plan.' }, { status: 402 })
  }

  let body: { contexto?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }
  const contexto = (body.contexto || '').trim()
  if (!contexto) return NextResponse.json({ ok: false, error: 'Falta el contexto de la valoración' }, { status: 400 })

  // Por el gateway (§P–T): la cascada de modelos y los motivos accionables
  // dejan de estar escritos a mano aquí, y la llamada deja asiento en el libro
  // de costos — antes no dejaba ninguno.
  try {
    const r = await llamarIA(
      { proveedor: 'anthropic', clave: key, modelos: MODELOS, system: SYSTEM, user: 'Datos de la valoración:\n\n' + contexto + '\n\nRedacta la nota infectológica siguiendo las reglas.', maxTokens: 2500 },
      {
        feature: 'inmuno-redactar',
        requestId: req.headers.get('x-vercel-id') || `ir-${acceso.uid}-${Date.now()}`,
        correlacion: correlacionDe(req),
        clinicId: clinicId ?? null, uid: acceso.uid, creditos: COSTO_CREDITOS.inmunoRedactar, fuente,
        esFundador: esFundador(acceso.email, process.env.SUPERADMIN_EMAILS),
      },
    )
    if (!r.ok) return NextResponse.json({ ok: false, error: `IA no disponible: ${r.motivo}` }, { status: 502 })
    const texto = r.texto
    if (!texto.trim()) return NextResponse.json({ ok: false, error: 'La IA devolvió una respuesta vacía. Intenta de nuevo.' }, { status: 502 })
    await registrarUso(clinicId, fuente)
    // COBRAR — y sólo cuando hubo texto. Sin esto el contador no se movía nunca,
    // así que el corte por créditos agotados no podía dispararse.
    void registrarCreditos(clinicId, COSTO_CREDITOS.inmunoRedactar)
    return NextResponse.json({ ok: true, texto })
  } catch {
    return NextResponse.json({ ok: false, error: 'Error al contactar la IA.' }, { status: 500 })
  }
}
