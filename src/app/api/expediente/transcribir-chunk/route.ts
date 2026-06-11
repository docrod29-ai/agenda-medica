/**
 * POST /api/expediente/transcribir-chunk
 *
 * Transcripción de UN chunk de audio (15-30 segundos) mientras la grabación
 * sigue. Permite mostrar el texto APARECIENDO en vivo en lugar de esperar
 * al final. Combinado con el blob completo final, se obtiene:
 *   - Vista previa instantánea por chunk (mejor UX)
 *   - Transcripción completa al final (precisión total)
 *
 * Body:   multipart/form-data { audio: Blob, chunkIdx: number, prevContext?: string }
 * Output: { ok, text, chunkIdx, model }
 *
 * Diferencia con /api/expediente/transcribir:
 *   - Acepta chunks pequeños (sin validación de tamaño mínimo)
 *   - Recibe `prevContext` con las últimas ~30 palabras del chunk previo
 *     para que Whisper mantenga continuidad (evita palabras cortadas)
 *   - Devuelve más rápido — pensado para llamadas paralelas
 */
import { NextRequest, NextResponse } from 'next/server'
import { WHISPER_PROMPT_MEDICO } from '@/lib/expediente/medical-vocabulary'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY no configurada' }, { status: 503 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ ok: false, error: 'Form-data inválido' }, { status: 400 })
  }

  const audio = formData.get('audio')
  if (!audio || !(audio instanceof Blob)) {
    return NextResponse.json({ ok: false, error: 'Falta chunk de audio' }, { status: 400 })
  }
  if (audio.size > 25 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: 'Chunk demasiado grande' }, { status: 400 })
  }
  if (audio.size < 1024) {
    // Chunk muy pequeño (<1KB) — silencio total. Devolver vacío sin gastar API.
    return NextResponse.json({ ok: true, text: '', chunkIdx: Number(formData.get('chunkIdx') ?? 0) })
  }

  const chunkIdx = Number(formData.get('chunkIdx') ?? 0)
  const prevContext = String(formData.get('prevContext') ?? '').slice(0, 500)

  // Mismo cascade de modelos que el endpoint principal
  const modeloOverride = process.env.OPENAI_TRANSCRIBE_MODEL
  const modelos = modeloOverride
    ? [modeloOverride]
    : ['gpt-4o-mini-transcribe', 'gpt-4o-transcribe', 'whisper-1']

  // Para chunks usamos gpt-4o-MINI primero (más rápido) — el modelo grande
  // se llama solo al final si el médico activa "re-transcribir todo".
  const promptCompleto = prevContext
    ? `${WHISPER_PROMPT_MEDICO}\n\nContexto previo de la consulta: "${prevContext}"`
    : WHISPER_PROMPT_MEDICO

  async function llamarOpenAI(model: string) {
    const upstream = new FormData()
    upstream.append('file', audio as Blob, `chunk-${chunkIdx}.webm`)
    upstream.append('model', model)
    upstream.append('language', 'es')
    upstream.append('temperature', '0')
    upstream.append('prompt', promptCompleto)
    return fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    })
  }

  for (const model of modelos) {
    try {
      const res = await llamarOpenAI(model)
      if (res.ok) {
        const data = await res.json()
        return NextResponse.json({
          ok: true,
          text: data.text ?? '',
          chunkIdx,
          model,
        })
      }
      if (![404, 403, 400].includes(res.status)) {
        const err = (await res.text()).slice(0, 200)
        return NextResponse.json({ ok: false, error: `OpenAI ${res.status}`, detail: err, chunkIdx }, { status: 502 })
      }
    } catch (err) {
      console.error(`[transcribir-chunk] ${model}:`, String(err).slice(0, 200))
    }
  }
  return NextResponse.json({ ok: false, error: 'Todos los modelos fallaron', chunkIdx }, { status: 502 })
}
