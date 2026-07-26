/**
 * POST /api/expediente/extraer-entidades
 *
 * Equivalente local a AWS Comprehend Medical / Google Healthcare NLP.
 * Recibe texto clínico (transcripción o nota redactada) y devuelve
 * entidades estructuradas con códigos CIE-10 + cross-check de
 * alergia↔medicamento + interacciones farmacológicas.
 *
 * Body:   { texto: string }
 * Output: EntidadesExtraidas | { ok: false, error }
 *
 * No expone API keys. Usa el mismo modelo Claude que el endpoint
 * principal de extracción pero con un prompt NER puro.
 */
import { NextRequest, NextResponse } from 'next/server'
import { NER_SYSTEM_PROMPT, buildNerUserPrompt, EntidadesExtraidas } from '@/lib/expediente/medical-ner'
import { safeLog } from '@/lib/security/sanitize'
import { verificarModuloIA } from '@/lib/auth-server'
import { limitarOResponder } from '@/lib/rate-limit'
import { gateCreditos, resolverClaveIA, registrarCreditos } from '@/lib/ai-keys'
import { COSTO_CREDITOS } from '@/lib/planes-ia'

const ENV_ANTHROPIC = process.env.ANTHROPIC_API_KEY ?? ''
const ANTHROPIC_VERSION = '2023-06-01'

const MODELOS_CANDIDATOS = [
  'claude-sonnet-4-5',
  'claude-sonnet-4-5-20250929',
  'claude-3-7-sonnet-latest',
  'claude-3-5-sonnet-latest',
]

let modeloCache = ''

async function resolverModelo(key: string): Promise<string> {
  if (process.env.ANTHROPIC_MODEL) return process.env.ANTHROPIC_MODEL
  if (modeloCache) return modeloCache
  try {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
      headers: { 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION },
      signal: AbortSignal.timeout(8000),   // no colgar el NER si la lista de modelos tarda
    })
    if (res.ok) {
      const data = await res.json()
      const ids: string[] = (data.data ?? []).map((m: { id: string }) => m.id)
      const elegido = MODELOS_CANDIDATOS.find(c => ids.includes(c))
        ?? ids.find(id => id.includes('sonnet'))
        ?? ids[0]
      if (elegido) { modeloCache = elegido; return elegido }
    }
  } catch { /* fallback */ }
  return MODELOS_CANDIDATOS[0]
}

/** Parser robusto — comparte estrategia con /api/expediente/procesar */
function parseJSON(text: string): Record<string, unknown> | null {
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) t = fence[1].trim()
  const first = t.indexOf('{')
  const last = t.lastIndexOf('}')
  if (first === -1 || last === -1) return null
  const slice = t.slice(first, last + 1)
  try { return JSON.parse(slice) } catch { /* */ }
  const limpio = slice
    .split('\n')
    .map(line => {
      const m = line.match(/^([^"]*(?:"[^"]*"[^"]*)*?)\s*\/\/.*$/)
      return m ? m[1].trimEnd() : line
    })
    .join('\n')
    .replace(/,(\s*[}\]])/g, '$1')
  try { return JSON.parse(limpio) } catch { return null }
}

export async function POST(req: NextRequest) {
  const acceso = await verificarModuloIA(req, 'expediente')
  if (!acceso.ok) return acceso.response
  const _rl = await limitarOResponder(`extraer-entidades:${acceso.uid}`, 40, 60)
  if (_rl) return _rl

  const { key: API_KEY, clinicId, fuente } = await resolverClaveIA(acceso.uid, 'anthropic', ENV_ANTHROPIC)
  const _corte = await gateCreditos(clinicId, fuente); if (_corte) return _corte
  if (!API_KEY) {
    return NextResponse.json(
      { ok: false, error: 'No hay API key de Claude configurada. Agrégala en Configuración → Llaves de IA.' },
      { status: 503 },
    )
  }

  let body: { texto?: string; alergiasRegistradas?: string[] }
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const texto = (body.texto ?? '').trim()
  if (!texto) {
    return NextResponse.json({ ok: false, error: 'Falta texto a analizar' }, { status: 400 })
  }
  if (texto.length > 20000) {
    return NextResponse.json({ ok: false, error: 'Texto demasiado largo (>20k chars)' }, { status: 400 })
  }
  // Auditoría 2026-07 (P1): alergias del expediente entran al cross-check.
  const alergiasRegistradas = Array.isArray(body.alergiasRegistradas)
    ? body.alergiasRegistradas.map(a => String(a)).filter(Boolean).slice(0, 40)
    : []

  try {
    const model = await resolverModelo(API_KEY)
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        system: NER_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildNerUserPrompt(texto, alergiasRegistradas) }],
      }),
      signal: AbortSignal.timeout(45000),   // aborta limpio si tarda, sin "error de red" ambiguo
    })

    if (!res.ok) {
      const err = await res.text()
      safeLog.error('[extraer-entidades] Claude error:', res.status, err.slice(0, 300))
      return NextResponse.json({ ok: false, error: `Claude ${res.status}` }, { status: 502 })
    }

    const data = await res.json()
    const text: string = data.content?.[0]?.text ?? ''
    if (!text.trim()) {
      return NextResponse.json({ ok: false, error: 'IA devolvió respuesta vacía' }, { status: 502 })
    }
    const parsed = parseJSON(text)
    if (!parsed) {
      return NextResponse.json({ ok: false, error: 'NER no parseable', raw: text.slice(0, 300) }, { status: 502 })
    }

    // Cobro (icu-007): el NER es una llamada real a IA; quema créditos una vez.
    void registrarCreditos(clinicId, COSTO_CREDITOS.extraerEntidades)

    const validation = EntidadesExtraidas.safeParse(parsed)
    if (!validation.success) {
      // Modo permisivo: devolvemos lo que sí parsea con _schemaWarning
      return NextResponse.json({ ok: true, ...parsed, _schemaWarning: true })
    }

    return NextResponse.json({ ok: true, ...validation.data, model })
  } catch (err) {
    safeLog.error('[extraer-entidades] Exception:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
