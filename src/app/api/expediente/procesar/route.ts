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
import type { TipoNota, PacienteContexto } from '@/types/expediente'

const API_KEY = process.env.ANTHROPIC_API_KEY ?? ''
const MODEL   = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514'

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
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        system: buildSystemPrompt(tipo),
        messages: [{ role: 'user', content: buildUserPrompt(transcripcion, contexto) }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[expediente/procesar] Claude error:', res.status, err)
      return NextResponse.json({ ok: false, error: `Claude ${res.status}` }, { status: 502 })
    }

    const data = await res.json()
    const text: string = data.content?.[0]?.text ?? ''

    // Parsear el JSON de la respuesta (robusto ante markdown accidental)
    const parsed = parseJSON(text)
    if (!parsed) {
      return NextResponse.json({ ok: false, error: 'Respuesta de IA no parseable', raw: text }, { status: 502 })
    }

    return NextResponse.json({ ok: true, ...parsed })
  } catch (err) {
    console.error('[expediente/procesar] Error:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

/** Extrae JSON aunque venga envuelto en ```json … ``` */
function parseJSON(text: string): Record<string, unknown> | null {
  let t = text.trim()
  // quitar fences de markdown si los hubiera
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) t = fence[1].trim()
  // recortar al primer { … último }
  const first = t.indexOf('{')
  const last = t.lastIndexOf('}')
  if (first === -1 || last === -1) return null
  try {
    return JSON.parse(t.slice(first, last + 1))
  } catch {
    return null
  }
}
