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
import { verificarUsuario } from '@/lib/auth-server'
import { resolverClaveIA, pruebaAgotada, registrarUso } from '@/lib/ai-keys'

const ENV_ANTHROPIC = process.env.ANTHROPIC_API_KEY ?? ''
const ANTHROPIC_VERSION = '2023-06-01'
const MODELOS = ['claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-3-7-sonnet-latest', 'claude-3-5-sonnet-latest']

const SYSTEM = `Eres infectólogo. Redacta una NOTA DE VALORACIÓN INFECTOLÓGICA del paciente inmunocomprometido, en prosa profesional, lista para el expediente y para entregar a quien solicitó la interconsulta.

REGLAS ESTRICTAS:
- SOLO infectología. No incluyas recomendaciones de otras especialidades.
- SIN citas bibliográficas ni referencias.
- SIN emojis.
- NO inventes dosis, fechas, microorganismos ni datos que no estén en la información dada. Si una dosis es necesaria, escribe "requiere validación clínica".
- NO agregues recomendaciones clínicas nuevas fuera del PLAN que se te entrega: puedes integrarlo, ordenarlo, priorizarlo según el MOTIVO y explicarlo con claridad, pero sin cambiar su contenido.
- Eres un apoyo a la decisión; el médico tratante valida.

ESTRUCTURA (prosa con encabezados simples, sin viñetas con emojis):
- Resumen del caso (huésped, motivo de la interconsulta, fase si aplica).
- Antecedentes relevantes (comorbilidades, inmunosupresión, exposiciones, vacunación; menciona los negativos pertinentes de forma concisa).
- Resultados (interpreta los disponibles; señala los pendientes).
- Impresión infectológica.
- Plan (reproduce y prioriza el plan dado, dirigido al motivo).
- Pendientes y seguimiento.

Devuelve solo la nota, sin preámbulos.`

export async function POST(req: NextRequest) {
  const acceso = await verificarUsuario(req)
  if (!acceso.ok) return acceso.response

  const { key, fuente, clinicId } = await resolverClaveIA(acceso.uid, 'anthropic', ENV_ANTHROPIC)
  if (!key) {
    return NextResponse.json({ ok: false, error: 'No hay API key de Claude configurada. Agrégala en Configuración → Llaves de IA.' }, { status: 503 })
  }
  if (fuente === 'prueba' && (await pruebaAgotada(clinicId))) {
    return NextResponse.json({ ok: false, error: 'Se agotó tu prueba gratis de IA. Configura tu propia API key en Configuración → Llaves de IA.' }, { status: 402 })
  }

  let body: { contexto?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }
  const contexto = (body.contexto || '').trim()
  if (!contexto) return NextResponse.json({ ok: false, error: 'Falta el contexto de la valoración' }, { status: 400 })

  const headers = { 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION, 'Content-Type': 'application/json' }
  const payload = (model: string) => JSON.stringify({
    model, max_tokens: 2500, system: SYSTEM,
    messages: [{ role: 'user', content: 'Datos de la valoración:\n\n' + contexto + '\n\nRedacta la nota infectológica siguiendo las reglas.' }],
  })

  try {
    let res: Response | null = null
    for (const model of MODELOS) {
      res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: payload(model) })
      if (res.status !== 404) break // 404 = modelo no disponible para esta cuenta → probar el siguiente
    }
    if (!res || !res.ok) {
      const status = res?.status ?? 500
      const pista = status === 401 ? ' (llave inválida)' : status === 429 ? ' (sin créditos o saturada)' : ''
      return NextResponse.json({ ok: false, error: `IA no disponible: Anthropic respondió HTTP ${status}${pista}.` }, { status: 502 })
    }
    const data = await res.json()
    const texto: string = data?.content?.[0]?.text ?? ''
    if (!texto.trim()) return NextResponse.json({ ok: false, error: 'La IA devolvió una respuesta vacía. Intenta de nuevo.' }, { status: 502 })
    await registrarUso(clinicId, fuente)
    return NextResponse.json({ ok: true, texto })
  } catch {
    return NextResponse.json({ ok: false, error: 'Error al contactar la IA.' }, { status: 500 })
  }
}
