/**
 * POST /api/expediente/antibiograma-vision
 *
 * Foto del antibiograma → perfil de susceptibilidad estructurado (S/I/R + CMI).
 * Patrón del foso: la IA de VISIÓN solo TRANSCRIBE lo legible (sin interpretar);
 * el motor determinista `interpretarAntibiograma` razona el mecanismo después.
 *
 * Body:   { imagen: dataURL | base64, sitio?: string }
 * Output: { ok, perfil: PerfilExtraido } | { ok:false, error }
 *
 * No expone API keys. Auth + rate limit + llave por consultorio, como el resto de la IA.
 */
import { anotarLlamada } from '@/lib/ia/gateway'
import { esFundador } from '@/lib/authz/fundador'
import { NextRequest, NextResponse } from 'next/server'
import { verificarModuloIA } from '@/lib/auth-server'
import { limitarOResponder } from '@/lib/rate-limit'
import { gateCreditos, resolverClaveIA, registrarCreditos } from '@/lib/ai-keys'
import { COSTO_CREDITOS } from '@/lib/planes-ia'
import { safeLog } from '@/lib/security/sanitize'
import { VISION_SYSTEM_PROMPT, buildVisionUserPrompt, PerfilExtraido } from '@/lib/expediente/antibiograma/vision'

const ENV_ANTHROPIC = process.env.ANTHROPIC_API_KEY ?? ''
const ANTHROPIC_VERSION = '2023-06-01'

// Modelos con visión (orden de preferencia); se valida contra la lista real de la cuenta.
const MODELOS_VISION = [
  'claude-sonnet-4-5',
  'claude-sonnet-4-5-20250929',
  'claude-3-7-sonnet-latest',
  'claude-3-5-sonnet-latest',
]
let modeloCache = ''

async function resolverModelo(key: string): Promise<string> {
  if (process.env.ANTHROPIC_MODEL_VISION) return process.env.ANTHROPIC_MODEL_VISION
  if (modeloCache) return modeloCache
  try {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
      headers: { 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION },
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const data = await res.json()
      const ids: string[] = (data.data ?? []).map((m: { id: string }) => m.id)
      const elegido = MODELOS_VISION.find(c => ids.includes(c)) ?? ids.find(id => id.includes('sonnet')) ?? ids[0]
      if (elegido) { modeloCache = elegido; return elegido }
    }
  } catch { /* fallback */ }
  return MODELOS_VISION[0]
}

/** Separa un data URL en {media_type, data}. Acepta también base64 puro (asume jpeg). */
function parseImagen(imagen: string): { media_type: string; data: string } | null {
  if (!imagen) return null
  const m = imagen.match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,(.+)$/i)
  if (m) return { media_type: m[1].toLowerCase().replace('image/jpg', 'image/jpeg'), data: m[2] }
  if (/^[A-Za-z0-9+/=\s]+$/.test(imagen) && imagen.length > 100) return { media_type: 'image/jpeg', data: imagen.replace(/\s+/g, '') }
  return null
}

/** Parser JSON robusto (comparte estrategia con /api/expediente/procesar). */
function parseJSON(text: string): Record<string, unknown> | null {
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) t = fence[1].trim()
  const first = t.indexOf('{'); const last = t.lastIndexOf('}')
  if (first === -1 || last === -1) return null
  const slice = t.slice(first, last + 1)
  try { return JSON.parse(slice) } catch { /* */ }
  const limpio = slice.replace(/,(\s*[}\]])/g, '$1')
  try { return JSON.parse(limpio) } catch { return null }
}

export async function POST(req: NextRequest) {
  const acceso = await verificarModuloIA(req, 'expediente')
  if (!acceso.ok) return acceso.response
  const _rl = await limitarOResponder(`antibiograma-vision:${acceso.uid}`, 20, 60)
  if (_rl) return _rl

  const { key: API_KEY, clinicId, fuente } = await resolverClaveIA(acceso.uid, 'anthropic', ENV_ANTHROPIC)
  const _corte = await gateCreditos(clinicId, fuente); if (_corte) return _corte
  if (!API_KEY) {
    return NextResponse.json({ ok: false, error: 'No hay API key de Claude configurada. Agrégala en Configuración → Llaves de IA.' }, { status: 503 })
  }

  let body: { imagen?: string; sitio?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const img = parseImagen(body.imagen ?? '')
  if (!img) {
    return NextResponse.json({ ok: false, error: 'Falta una imagen válida (PNG/JPEG/WebP en base64).' }, { status: 400 })
  }
  // Límite defensivo ~8MB de base64 (~6MB binario).
  if (img.data.length > 8_000_000) {
    return NextResponse.json({ ok: false, error: 'Imagen demasiado grande (>6MB). Reduce la resolución.' }, { status: 400 })
  }

  /**
   * Contexto del libro de costos. Esta ruta todavía no pasa por el gateway; se
   * anota el gasto igual, porque una llamada sin asiento no se ve como un error
   * sino como una plataforma que gasta menos de lo que gasta.
   */
  const ctxCosto = {
    feature: 'antibiograma-vision',
    requestId: req.headers.get('x-vercel-id') || `av-${acceso.uid}-${Date.now()}`,
    clinicId: clinicId ?? null, uid: acceso.uid, creditos: 0, fuente,
    esFundador: esFundador(acceso.email, process.env.SUPERADMIN_EMAILS),
  }
  const t0Costo = Date.now()

  try {
    const model = await resolverModelo(API_KEY)
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'anthropic-version': ANTHROPIC_VERSION, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        system: VISION_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } },
            { type: 'text', text: buildVisionUserPrompt() },
          ],
        }],
      }),
      signal: AbortSignal.timeout(45000),
    })

    if (!res.ok) {
      const err = await res.text()
      safeLog.error('[antibiograma-vision] Claude error:', res.status, err.slice(0, 300))
      const pista = res.status === 401 ? 'llave de IA inválida' : res.status === 429 ? 'sin créditos/límite' : res.status === 404 ? 'modelo de visión no disponible' : `error ${res.status}`
      return NextResponse.json({ ok: false, error: `IA de visión: ${pista}.` }, { status: 502 })
    }

    // Cobrar el crédito EN CUANTO Claude respondió OK: el costo (llave del dueño)
    // ya se incurrió aquí. Antes solo se cobraba en el camino feliz (tras parseo),
    // así una foto en blanco/ilegible corría la IA GRATIS y drenaba la llave del
    // dueño en modo prueba (auditoría P1 — fail-open de contabilización).
    void registrarCreditos(clinicId, COSTO_CREDITOS.antibiogramaVision)

    const data = await res.json()
    anotarLlamada(ctxCosto, 'anthropic', String(data?.model ?? ''), data, Date.now() - t0Costo)
    const text: string = data.content?.[0]?.text ?? ''
    const parsed = parseJSON(text)
    if (!parsed) {
      return NextResponse.json({ ok: false, error: 'La IA no devolvió un perfil legible. Reintenta con una foto más nítida.', raw: text.slice(0, 200) }, { status: 502 })
    }
    const val = PerfilExtraido.safeParse(parsed)
    if (!val.success) {
      // Modo permisivo: devuelve lo que sí cumple para que el médico corrija a mano.
      return NextResponse.json({ ok: true, perfil: parsed, _schemaWarning: true, model })
    }
    return NextResponse.json({ ok: true, perfil: val.data, model })
  } catch (err) {
    safeLog.error('[antibiograma-vision] Exception:', err)
    return NextResponse.json({ ok: false, error: `Error al procesar la imagen: ${String(err)}` }, { status: 500 })
  }
}
