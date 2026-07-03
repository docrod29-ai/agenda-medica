import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/auth-server'
import { resolverClaveIA, pruebaAgotada } from '@/lib/ai-keys'

/**
 * IA de visión: recibe la imagen del FORMATO de receta del médico y detecta dónde
 * va el VALOR de cada campo del paciente (Nombre, Edad, Sexo, Fecha, Folio) como
 * coordenadas en % — para pre-llenar el calibrador. El médico confirma/ajusta.
 * "La IA se adapta a tu formato, no tú a ella."
 */
export const runtime = 'nodejs'

const ENV_ANTHROPIC = process.env.ANTHROPIC_API_KEY ?? ''
const MODEL_OVERRIDE = process.env.ANTHROPIC_MODEL ?? ''
const ANTHROPIC_VERSION = '2023-06-01'
const MODELOS = ['claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-3-7-sonnet-latest', 'claude-3-5-sonnet-latest']

const headers = (key: string) => ({ 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION, 'Content-Type': 'application/json' })

async function resolverModelo(key: string): Promise<string> {
  if (MODEL_OVERRIDE) return MODEL_OVERRIDE
  try {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=100', { headers: headers(key) })
    if (res.ok) {
      const ids: string[] = ((await res.json()).data ?? []).map((m: { id: string }) => m.id)
      return MODELOS.find(c => ids.includes(c)) ?? ids.find(id => id.includes('sonnet')) ?? ids[0] ?? MODELOS[0]
    }
  } catch { /* fallback */ }
  return MODELOS[0]
}

const PROMPT = `Esta imagen es una PLANTILLA DE RECETA MÉDICA en blanco (papel membretado del médico).
Encuentra dónde el médico debe ESCRIBIR el valor de cada dato del paciente, junto a las etiquetas impresas (p.ej. "Nombre:", "Edad:", "Sexo:", "Fecha:", "Folio:").
Devuelve SOLO un objeto JSON con la posición donde debe ir el VALOR de cada campo, en PORCENTAJE del ancho (x) y alto (y) de la imagen, de 0 a 100 (0,0 = esquina superior izquierda).
Claves posibles: "nombre", "edad", "sexo", "fecha", "folio". Incluye SOLO las que realmente aparezcan en el formato; omite las que no estén.
Formato exacto: {"nombre":{"x":number,"y":number},"fecha":{"x":number,"y":number}}
NO expliques nada. Responde ÚNICAMENTE el JSON.`

const CLAVES_VALIDAS = ['nombre', 'edad', 'sexo', 'fecha', 'folio']

export async function POST(req: NextRequest) {
  const acceso = await verificarUsuario(req)
  if (!acceso.ok) return acceso.response

  const { key, fuente, clinicId } = await resolverClaveIA(acceso.uid, 'anthropic', ENV_ANTHROPIC)
  if (!key) return NextResponse.json({ ok: false, error: 'No hay API key de Claude configurada.' }, { status: 503 })
  if (fuente === 'prueba' && await pruebaAgotada(clinicId)) {
    return NextResponse.json({ ok: false, error: 'Se agotó tu prueba gratis de IA.' }, { status: 402 })
  }

  let body: { imagenBase64?: string; mediaType?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }
  const { imagenBase64, mediaType } = body
  if (!imagenBase64) return NextResponse.json({ ok: false, error: 'Falta la imagen' }, { status: 400 })

  try {
    const model = await resolverModelo(key)
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: headers(key),
      body: JSON.stringify({
        model,
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/png', data: imagenBase64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      return NextResponse.json({ ok: false, error: `IA no disponible (${res.status})`, detalle: t.slice(0, 200) }, { status: 502 })
    }
    const data = await res.json()
    const texto: string = (data.content ?? []).map((c: { text?: string }) => c.text ?? '').join('')
    const m = texto.match(/\{[\s\S]*\}/)
    if (!m) return NextResponse.json({ ok: false, error: 'La IA no devolvió coordenadas' }, { status: 422 })

    const crudo = JSON.parse(m[0]) as Record<string, { x?: number; y?: number }>
    const campos: Record<string, { x: number; y: number }> = {}
    for (const k of CLAVES_VALIDAS) {
      const c = crudo[k]
      if (c && typeof c.x === 'number' && typeof c.y === 'number') {
        campos[k] = { x: Math.min(100, Math.max(0, c.x)), y: Math.min(100, Math.max(0, c.y)) }
      }
    }
    if (Object.keys(campos).length === 0) return NextResponse.json({ ok: false, error: 'No se detectaron campos' }, { status: 422 })
    return NextResponse.json({ ok: true, campos })
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'Error al detectar', detalle: String(e).slice(0, 200) }, { status: 500 })
  }
}
