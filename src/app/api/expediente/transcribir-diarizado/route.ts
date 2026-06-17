/**
 * Transcripción CON DIARIZACIÓN (separación de voces) vía AssemblyAI.
 *
 * Diseño submit + poll para no chocar con el timeout de serverless:
 *   POST  → sube el audio a AssemblyAI, encola la transcripción, devuelve { id }
 *   GET ?id=… → consulta el estado; al terminar devuelve { text, utterances }
 * El cliente hace el polling (sin límite de tiempo de función).
 *
 * Si no hay ASSEMBLYAI_API_KEY, devuelve 503 con sinClave:true → el cliente
 * cae automáticamente a /api/expediente/transcribir (OpenAI, sin diarización).
 * Así la app funciona igual aunque no se haya configurado la llave.
 *
 * Requiere env var: ASSEMBLYAI_API_KEY
 * Costo aproximado: ~$0.01–0.015 USD por minuto de audio.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/auth-server'

export const runtime = 'nodejs'
export const maxDuration = 60

const AAI = 'https://api.assemblyai.com/v2'

interface UtteranceAAI { speaker: string; text: string }

export async function POST(req: NextRequest) {
  const acceso = await verificarUsuario(req)
  if (!acceso.ok) return acceso.response

  const key = process.env.ASSEMBLYAI_API_KEY
  if (!key) {
    return NextResponse.json(
      { ok: false, sinClave: true, error: 'ASSEMBLYAI_API_KEY no configurada. Se usa transcripción sin diarización.' },
      { status: 503 },
    )
  }

  let formData: FormData
  try { formData = await req.formData() } catch {
    return NextResponse.json({ ok: false, error: 'Form-data inválido' }, { status: 400 })
  }
  const audio = formData.get('audio')
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ ok: false, error: 'Falta archivo de audio' }, { status: 400 })
  }

  try {
    // 1. Subir el audio a AssemblyAI (passthrough de bytes)
    const bytes = Buffer.from(await audio.arrayBuffer())
    const up = await fetch(`${AAI}/upload`, {
      method: 'POST',
      headers: { authorization: key },
      body: bytes,
    })
    if (!up.ok) return NextResponse.json({ ok: false, error: `AssemblyAI upload HTTP ${up.status}` }, { status: 502 })
    const { upload_url } = await up.json()

    // 2. Encolar transcripción con diarización en español
    const sub = await fetch(`${AAI}/transcript`, {
      method: 'POST',
      headers: { authorization: key, 'content-type': 'application/json' },
      body: JSON.stringify({
        audio_url: upload_url,
        speaker_labels: true,   // separa voces (Hablante A/B/C…)
        language_code: 'es',
        punctuate: true,
        format_text: true,
      }),
    })
    if (!sub.ok) return NextResponse.json({ ok: false, error: `AssemblyAI submit HTTP ${sub.status}` }, { status: 502 })
    const { id } = await sub.json()
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 120) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const acceso = await verificarUsuario(req)
  if (!acceso.ok) return acceso.response

  const key = process.env.ASSEMBLYAI_API_KEY
  if (!key) return NextResponse.json({ ok: false, sinClave: true }, { status: 503 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, error: 'Falta id' }, { status: 400 })

  try {
    const r = await fetch(`${AAI}/transcript/${id}`, { headers: { authorization: key } })
    if (!r.ok) return NextResponse.json({ ok: false, error: `AssemblyAI HTTP ${r.status}` }, { status: 502 })
    const d = await r.json()

    if (d.status === 'completed') {
      const utterances: UtteranceAAI[] = (d.utterances ?? []).map(
        (u: { speaker: string; text: string }) => ({ speaker: u.speaker, text: u.text }),
      )
      return NextResponse.json({ ok: true, status: 'completed', text: d.text ?? '', utterances })
    }
    if (d.status === 'error') {
      return NextResponse.json({ ok: false, status: 'error', error: d.error ?? 'AssemblyAI error' })
    }
    // queued | processing
    return NextResponse.json({ ok: true, status: d.status ?? 'processing' })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 120) }, { status: 500 })
  }
}
