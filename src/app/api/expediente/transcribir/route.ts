/**
 * POST /api/expediente/transcribir
 *
 * Transcripción de audio con OpenAI Whisper (precisión mucho mayor para español
 * médico que Web Speech API). Sirve como upgrade opcional — la app sigue
 * funcionando con Web Speech si esta ruta no está disponible.
 *
 * Costo: ~$0.006 USD por minuto.
 *
 * Body: multipart/form-data con campo "audio" (File/Blob webm/mp3/wav/m4a)
 * Devuelve: { ok, text, language, durationSec }
 *
 * Requiere env var: OPENAI_API_KEY
 */
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'OPENAI_API_KEY no configurada. La app sigue funcionando con Web Speech.' },
      { status: 503 },
    )
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ ok: false, error: 'Form-data inválido' }, { status: 400 })
  }

  const audio = formData.get('audio')
  if (!audio || !(audio instanceof Blob)) {
    return NextResponse.json({ ok: false, error: 'Falta archivo de audio' }, { status: 400 })
  }
  // Tamaño máximo razonable (~25 MB es el límite de OpenAI)
  if (audio.size > 25 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: 'Audio mayor a 25 MB. Divide en partes.' }, { status: 400 })
  }

  try {
    const upstream = new FormData()
    upstream.append('file', audio, 'consulta.webm')
    upstream.append('model', 'whisper-1')
    upstream.append('language', 'es')
    // Prompt clínico para mejorar precisión de términos médicos comunes en MX
    upstream.append(
      'prompt',
      'Consulta médica en español de México. Términos: paciente, padecimiento, antecedente, alergia, medicamento, dosis, frecuencia, vía oral, exploración física, signos vitales, diagnóstico, plan, seguimiento, diabetes mellitus, hipertensión, losartán, metformina, ceftriaxona, amoxicilina, omeprazol, levotiroxina, prednisona.',
    )

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[transcribir] Whisper error:', res.status, err.slice(0, 300))
      return NextResponse.json({ ok: false, error: `Whisper ${res.status}` }, { status: 502 })
    }

    const data = await res.json()
    return NextResponse.json({
      ok: true,
      text: data.text ?? '',
      language: data.language ?? 'es',
    })
  } catch (err) {
    console.error('[transcribir] Error:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
