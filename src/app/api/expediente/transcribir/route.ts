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
import { WHISPER_PROMPT_MEDICO } from '@/lib/expediente/medical-vocabulary'
import { verificarUsuario } from '@/lib/auth-server'
import { resolverClaveIA, registrarUso } from '@/lib/ai-keys'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const acceso = await verificarUsuario(req)
  if (!acceso.ok) return acceso.response

  // Llave del consultorio (o la del dueño en modo prueba).
  const { key: apiKey, fuente, clinicId } = await resolverClaveIA(acceso.uid, 'openai', process.env.OPENAI_API_KEY)
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'OPENAI_API_KEY no configurada. La app sigue funcionando con Web Speech.' },
      { status: 503 },
    )
  }
  // NOTA: la transcripción plana (OpenAI) es el plan B BARATO del modo económico —
  // corre SIEMPRE, no se topa por créditos. El excedente se controla en la NOTA
  // (procesar baja a Sonnet) y en la diarización (que sí se salta al agotar créditos).

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

  // Cascada de modelos por precisión (mejor → fallback):
  //   1. gpt-4o-transcribe       — ~30% menos WER que whisper-1 en español médico
  //   2. gpt-4o-mini-transcribe  — más rápido + barato, también mejor que whisper-1
  //   3. whisper-1               — fallback histórico (siempre disponible)
  // Override por env: OPENAI_TRANSCRIBE_MODEL.
  const modeloOverride = process.env.OPENAI_TRANSCRIBE_MODEL
  const modelos = modeloOverride
    ? [modeloOverride]
    : ['gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1']

  async function llamarOpenAI(model: string) {
    const upstream = new FormData()
    upstream.append('file', audio as Blob, 'consulta.webm')
    upstream.append('model', model)
    upstream.append('language', 'es')
    // temperature 0 → determinístico, no improvisa palabras
    upstream.append('temperature', '0')
    // Prompt con vocabulario médico extenso — clave para que la IA NO confunda
    // "amikacina" con "amigacina", "ceftriaxona" con "septriasona", etc.
    upstream.append('prompt', WHISPER_PROMPT_MEDICO)
    return fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    })
  }

  // Reintenta ante errores transitorios (rate-limit / 5xx): clave cuando muchos
  // médicos transcriben a la vez sobre la misma llave.
  const STATUS_REINTENTABLE = new Set([429, 500, 502, 503, 529])
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
  async function llamarOpenAIConReintentos(model: string) {
    let res = await llamarOpenAI(model)
    for (let i = 1; i <= 3 && STATUS_REINTENTABLE.has(res.status); i++) {
      await sleep(i * 800)
      res = await llamarOpenAI(model)
    }
    return res
  }

  let ultimoError = ''
  let ultimoStatus = 0
  for (const model of modelos) {
    try {
      const res = await llamarOpenAIConReintentos(model)
      if (res.ok) {
        const data = await res.json()
        void registrarUso(clinicId, fuente)
        return NextResponse.json({
          ok: true,
          text: data.text ?? '',
          language: data.language ?? 'es',
          model,
        })
      }
      ultimoStatus = res.status
      ultimoError = (await res.text()).slice(0, 300)
      console.warn(`[transcribir] ${model} respondió ${res.status} — probando siguiente modelo`)
      // La llave es inválida/expiró → ningún modelo servirá: abortar de una vez.
      if (res.status === 401) {
        return NextResponse.json({ ok: false, error: 'La API key de OpenAI es inválida o expiró. Revísala en Vercel.' }, { status: 502 })
      }
      // CUALQUIER otro error (400/404/429/500/502/503/529): NO abortar — probar el
      // SIGUIENTE modelo. whisper-1 (el último) es el más estable y casi nunca da
      // 5xx, así que un 502 pasajero de gpt-4o-transcribe ya no tumba la nota.
    } catch (err) {
      console.error(`[transcribir] ${model} error de red:`, err)
      ultimoError = String(err).slice(0, 300)
    }
  }
  // Aquí solo se llega si TODOS los modelos de OpenAI fallaron (outage real).
  console.error('[transcribir] Todos los modelos de OpenAI fallaron. Último:', ultimoStatus, ultimoError)
  return NextResponse.json(
    { ok: false, error: `OpenAI no disponible temporalmente (HTTP ${ultimoStatus}). El audio sigue guardado; reintenta en un momento.` },
    { status: 502 },
  )
}
