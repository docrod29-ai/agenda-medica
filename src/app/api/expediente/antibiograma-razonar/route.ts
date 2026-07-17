/**
 * POST /api/expediente/antibiograma-razonar
 *
 * Capa de RAZONAMIENTO con IA sobre el motor determinista del antibiograma.
 * El motor calcula los HECHOS (server-side, mismo `interpretarAntibiograma`);
 * Claude (y GPT como 2ª opinión si hay llave) los RAZONAN como infectólogo, SIN
 * contradecir categorías ni inventar. Combina «motor (rigor) + IA (juicio)».
 *
 * Body:   { organismo, resultados, sitio?, pruebas?, motor? }
 * Output: { ok, razonamiento, segundaOpinion?, modelos } | { ok:false, error }
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/auth-server'
import { limitarOResponder } from '@/lib/rate-limit'
import { resolverClaveIA } from '@/lib/ai-keys'
import { safeLog } from '@/lib/security/sanitize'
import { interpretarAntibiograma, type EntradaAntibiograma } from '@/lib/expediente/antibiograma'
import { resumenDeterminista, RAZONAR_SYSTEM, buildRazonarUser } from '@/lib/expediente/antibiograma/razonar'

const ENV_ANTHROPIC = process.env.ANTHROPIC_API_KEY ?? ''
const ENV_OPENAI = process.env.OPENAI_API_KEY ?? ''
const ANTHROPIC_VERSION = '2023-06-01'

const MODELOS_OPUS = ['claude-opus-4-8', 'claude-sonnet-5']
const MODELOS_SONNET = ['claude-sonnet-5', 'claude-sonnet-4-6', 'claude-3-5-sonnet-latest']
const MODELOS_HAIKU = ['claude-haiku-4-5-20251001', 'claude-3-5-haiku-latest']

async function claude(key: string, modelos: string[], system: string, user: string): Promise<{ texto: string; modelo: string } | { error: string }> {
  for (const model of modelos) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 1100, system, messages: [{ role: 'user', content: user }] }),
        signal: AbortSignal.timeout(40000),
      })
      if (res.ok) {
        const d = await res.json()
        const t = (d.content?.[0]?.text ?? '').trim()
        if (t) return { texto: t, modelo: model }
      } else if (res.status !== 404 && res.status !== 400) {
        const pista = res.status === 401 ? 'llave de IA inválida' : res.status === 429 ? 'sin créditos/límite' : `error ${res.status}`
        return { error: pista }
      }
    } catch (e) { return { error: String(e).includes('timeout') ? 'la IA tardó demasiado' : 'error de red' } }
  }
  return { error: 'ningún modelo disponible' }
}

async function gpt(key: string, system: string, user: string): Promise<string | null> {
  for (const model of ['gpt-5', 'gpt-4o']) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_completion_tokens: 1100, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
        signal: AbortSignal.timeout(40000),
      })
      if (res.ok) {
        const d = await res.json()
        const t = (d.choices?.[0]?.message?.content ?? '').trim()
        if (t) return t
      }
    } catch { /* intenta el siguiente */ }
  }
  return null
}

export async function POST(req: NextRequest) {
  const acceso = await verificarUsuario(req)
  if (!acceso.ok) return acceso.response
  const _rl = await limitarOResponder(`antibiograma-razonar:${acceso.uid}`, 30, 60)
  if (_rl) return _rl

  const { key: API_KEY } = await resolverClaveIA(acceso.uid, 'anthropic', ENV_ANTHROPIC)
  if (!API_KEY) return NextResponse.json({ ok: false, error: 'No hay API key de Claude configurada (Configuración → Llaves de IA).' }, { status: 503 })

  let body: { organismo?: string; resultados?: EntradaAntibiograma['resultados']; sitio?: EntradaAntibiograma['sitio']; pruebas?: EntradaAntibiograma['pruebas']; motor?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  const entrada: EntradaAntibiograma = {
    organismo: (body.organismo ?? '').trim(),
    resultados: Array.isArray(body.resultados) ? body.resultados : [],
    sitio: body.sitio,
    pruebas: body.pruebas,
  }
  if (!entrada.organismo && entrada.resultados.length === 0) {
    return NextResponse.json({ ok: false, error: 'Captura al menos el organismo o el panel para razonar.' }, { status: 400 })
  }

  try {
    // 1) HECHOS deterministas (server-side, misma función que la UI).
    const interp = interpretarAntibiograma(entrada)
    const resumen = resumenDeterminista(entrada, interp)
    const user = buildRazonarUser(resumen)

    // 2) Modelo de Claude según el motor elegido.
    const modelos = body.motor === 'maxima' ? MODELOS_OPUS : body.motor === 'rapida' ? MODELOS_HAIKU : MODELOS_SONNET

    // 3) Claude razona; si hay llave OpenAI y el motor es Máxima, GPT da 2ª opinión EN PARALELO.
    const { key: OPENAI_KEY } = await resolverClaveIA(acceso.uid, 'openai', ENV_OPENAI)
    const quiereGPT = !!OPENAI_KEY && body.motor === 'maxima'
    const [rc, gptTexto] = await Promise.all([
      claude(API_KEY, modelos, RAZONAR_SYSTEM, user),
      quiereGPT ? gpt(OPENAI_KEY as string, RAZONAR_SYSTEM, user) : Promise.resolve(null),
    ])

    if ('error' in rc) {
      return NextResponse.json({ ok: false, error: `IA: ${rc.error}. Revisa tu llave/créditos en Configuración → Llaves de IA.` }, { status: 502 })
    }
    return NextResponse.json({ ok: true, razonamiento: rc.texto, segundaOpinion: gptTexto ?? undefined, modelos: [rc.modelo, ...(gptTexto ? ['gpt'] : [])] })
  } catch (err) {
    safeLog.error('[antibiograma-razonar] Exception:', err)
    return NextResponse.json({ ok: false, error: `Error al razonar: ${String(err).slice(0, 120)}` }, { status: 500 })
  }
}
