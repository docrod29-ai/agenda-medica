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
import { safeLog } from '@/lib/security/sanitize'
import { WHISPER_PROMPT_MEDICO } from '@/lib/expediente/medical-vocabulary'
import { verificarModuloIA } from '@/lib/auth-server'
import { limitarOResponder } from '@/lib/rate-limit'
import { gateCreditos, resolverClaveIA, registrarCreditos  } from '@/lib/ai-keys'
import { COSTO_CREDITOS } from '@/lib/planes-ia'
import { anotarLlamada } from '@/lib/ia/gateway'
import { esFundador } from '@/lib/authz/fundador'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const acceso = await verificarModuloIA(req, 'expediente')
  if (!acceso.ok) return acceso.response
  const _rl = await limitarOResponder(`transcribir-chunk:${acceso.uid}`, 120, 60)
  if (_rl) return _rl

  // Usa la llave del consultorio si la tiene, cuenta créditos y aplica tope.
  // (El comentario que había aquí decía lo contrario — «no cuenta ni aplica
  //  tope» — y llevaba desactualizado desde que se añadió `gateCreditos`.)
  const { key: apiKey, clinicId, fuente } = await resolverClaveIA(acceso.uid, 'openai', process.env.OPENAI_API_KEY)
  // TOPE DE CRÉDITOS (auditoría 26-jul): sin esto, un consultorio con los
  // créditos agotados seguía quemando la llave del dueño indefinidamente.
  // `gateCreditos` sólo corta cuando la llave es la del dueño (`prueba`):
  // con llave propia del consultorio NO se corta, porque paga su propia API.
  const corteCreditos = await gateCreditos(clinicId, fuente)
  if (corteCreditos) return corteCreditos
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
  /**
   * Segundos de audio de ESTE trozo, que manda el cliente.
   *
   * Se acota a 10 minutos: un valor absurdo llegado del navegador no puede
   * inflar el libro de costos. Y si no viene, se queda en `undefined` a
   * propósito — un 0 se traduciría en «costó nada», que es peor que no saberlo.
   */
  const minutosAudio = Math.min(10, Math.max(0, Number(formData.get('duracionSeg') ?? 0) / 60)) || undefined
  const t0Costo = Date.now()

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
        void registrarCreditos(clinicId, COSTO_CREDITOS.transcribirChunk)
        /**
         * EL ASIENTO QUE FALTABA — y faltaba justo donde más se gasta.
         *
         * Esta ruta se dispara CADA ~20 SEGUNDOS de cada consulta, en paralelo,
         * para pintar el texto en vivo. Es la llamada de IA más frecuente de toda
         * la aplicación y era la única que no dejaba rastro en el libro de
         * costos: el tablero de /superadmin/costos enseñaba el gasto de la
         * transcripción FINAL y se saltaba entero el de la transcripción en
         * vivo, que ocurre decenas de veces por cada una de aquéllas.
         *
         * El efecto no era que faltara un renglón: era que el costo de la voz
         * salía sistemáticamente por debajo del real. Y de eso come la decisión
         * de a cuánto vender el crédito.
         *
         * La transcripción se cobra POR MINUTO, no por tokens, así que el uso
         * viaja en `minutosAudio`. Sin la duración no hay costo que calcular: se
         * anota igual —queda constancia de la llamada— pero el motor de precios
         * devuelve nulo en vez de cero, que es la diferencia entre «no lo sé» y
         * «fue gratis».
         */
        anotarLlamada(
          {
            feature: 'transcribir-chunk',
            requestId: req.headers.get('x-vercel-id') || `trc-${acceso.uid}-${chunkIdx}-${Date.now()}`,
            clinicId: clinicId ?? null, uid: acceso.uid,
            creditos: COSTO_CREDITOS.transcribirChunk, fuente,
            esFundador: esFundador(acceso.email, process.env.SUPERADMIN_EMAILS),
          },
          'openai', model,
          { usage: { input_tokens: 0, output_tokens: 0 }, minutosAudio },
          Date.now() - t0Costo,
        )
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
      safeLog.error(`[transcribir-chunk] ${model}:`, String(err).slice(0, 200))
    }
  }
  return NextResponse.json({ ok: false, error: 'Todos los modelos fallaron', chunkIdx }, { status: 502 })
}
