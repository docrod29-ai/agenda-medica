/**
 * POST /api/expediente/procesar
 *
 * Recibe la transcripción de voz + tipo de nota + contexto del paciente,
 * llama a Claude para estructurar la nota, y devuelve el JSON estructurado.
 *
 * La API key NUNCA se expone al cliente — vive en ANTHROPIC_API_KEY (Vercel).
 *
 * Body: { transcripcion, tipo, contexto }
 * Resp: { ok, resumenEjecutivo, secciones, diagnosticos, medicamentos, alergias, signosVitales }
 */

import { NextRequest, NextResponse } from 'next/server'
import { buildSystemPrompt, buildUserPrompt } from '@/lib/expediente/prompts'
import { RespuestaExtraccion } from '@/lib/expediente/extraction-schema'
import type { TipoNota, PacienteContexto } from '@/types/expediente'

const API_KEY = process.env.ANTHROPIC_API_KEY ?? ''
const MODEL_OVERRIDE = process.env.ANTHROPIC_MODEL ?? ''
const ANTHROPIC_VERSION = '2023-06-01'

// Modelos candidatos en orden de preferencia (el primero disponible se usa)
const MODELOS_CANDIDATOS = [
  'claude-sonnet-4-5',
  'claude-sonnet-4-5-20250929',
  'claude-sonnet-4-20250514',
  'claude-3-7-sonnet-latest',
  'claude-3-5-sonnet-latest',
]

const headersAnthropic = {
  'x-api-key': API_KEY,
  'anthropic-version': ANTHROPIC_VERSION,
  'Content-Type': 'application/json',
}

/** Cachea el modelo resuelto entre invocaciones del runtime */
let modeloResuelto = ''

/** Descubre un modelo válido para esta cuenta vía /v1/models */
async function resolverModelo(): Promise<string> {
  if (MODELO_OVERRIDE_OK()) return MODEL_OVERRIDE
  if (modeloResuelto) return modeloResuelto
  try {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=100', { headers: headersAnthropic })
    if (res.ok) {
      const data = await res.json()
      const ids: string[] = (data.data ?? []).map((m: { id: string }) => m.id)
      // Prefiere candidatos conocidos; si no, el primer "sonnet"; si no, el primero
      const elegido =
        MODELOS_CANDIDATOS.find(c => ids.includes(c)) ??
        ids.find(id => id.includes('sonnet')) ??
        ids[0]
      if (elegido) { modeloResuelto = elegido; return elegido }
    }
  } catch { /* cae al fallback */ }
  return MODELOS_CANDIDATOS[0]
}

function MODELO_OVERRIDE_OK() { return MODEL_OVERRIDE.length > 0 }

async function llamarClaude(model: string, system: string, userMsg: string) {
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: headersAnthropic,
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      system,
      messages: [{ role: 'user', content: userMsg }],
    }),
  })
}

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json(
      { ok: false, error: 'ANTHROPIC_API_KEY no configurada en el servidor' },
      { status: 503 },
    )
  }

  let body: { transcripcion?: string; tipo?: TipoNota; contexto?: PacienteContexto }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const { transcripcion, tipo, contexto } = body
  if (!transcripcion || !tipo || !contexto) {
    return NextResponse.json({ ok: false, error: 'Faltan transcripcion, tipo o contexto' }, { status: 400 })
  }

  try {
    const system  = buildSystemPrompt(tipo)
    const userMsg = buildUserPrompt(transcripcion, contexto)

    let model = await resolverModelo()
    let res = await llamarClaude(model, system, userMsg)

    // Si el modelo no existe (404), redescubre y reintenta una vez
    if (res.status === 404) {
      modeloResuelto = ''
      model = await resolverModelo()
      res = await llamarClaude(model, system, userMsg)
    }

    if (!res.ok) {
      const err = await res.text()
      console.error('[expediente/procesar] Claude error:', res.status, err)
      return NextResponse.json({ ok: false, error: `Claude ${res.status} (${model})` }, { status: 502 })
    }

    const data = await res.json()
    const text: string = data.content?.[0]?.text ?? ''

    // Parsear el JSON de la respuesta (robusto ante markdown accidental)
    const parsed = parseJSON(text)
    if (!parsed) {
      return NextResponse.json({ ok: false, error: 'Respuesta de IA no parseable', raw: text }, { status: 502 })
    }

    // Validar con Zod. Si falla, devolvemos lo que sí se pudo parsear
    // (modo permisivo: el frontend prioriza los campos planos y muestra el extraction si llega).
    const validation = RespuestaExtraccion.safeParse(parsed)
    if (!validation.success) {
      console.warn('[procesar] Validación parcial:', validation.error.issues.slice(0, 3))
      return NextResponse.json({ ok: true, ...parsed, _schemaWarning: true })
    }

    return NextResponse.json({ ok: true, ...validation.data })
  } catch (err) {
    console.error('[expediente/procesar] Error:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

/**
 * Extrae JSON aunque venga envuelto en ```json … ``` o con comentarios
 * que la IA copió accidentalmente del prompt.
 * Pipeline de fallbacks:
 *   1. Parse directo
 *   2. Quitar fences de markdown
 *   3. Recortar de primer "{" a último "}"
 *   4. Quitar comentarios // ... y trailing commas (JSON5-ish)
 */
function parseJSON(text: string): Record<string, unknown> | null {
  let t = text.trim()
  // 1. fence markdown
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) t = fence[1].trim()
  // 2. recortar al primer { … último }
  const first = t.indexOf('{')
  const last = t.lastIndexOf('}')
  if (first === -1 || last === -1) return null
  const slice = t.slice(first, last + 1)

  // intento 1: parse limpio
  try { return JSON.parse(slice) } catch { /* sigue al fallback */ }

  // intento 2: limpiar comentarios // y trailing commas que la IA pudo
  // copiar del prompt. Conserva strings (evita romper URLs con //)
  const limpio = slice
    // quitar comentarios de línea // que NO estén dentro de strings
    .split('\n')
    .map(line => {
      const m = line.match(/^([^"]*(?:"[^"]*"[^"]*)*?)\s*\/\/.*$/)
      return m ? m[1].trimEnd() : line
    })
    .join('\n')
    // trailing comma antes de } o ]
    .replace(/,(\s*[}\]])/g, '$1')

  try { return JSON.parse(limpio) } catch {
    console.warn('[procesar] JSON inválido incluso tras limpieza. Primeros 200 chars:', slice.slice(0, 200))
    return null
  }
}
