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
import { safeLog } from '@/lib/security/sanitize'
import { claseDeFallo, quienPaga, avisoAlMedico } from '@/lib/ia/fallo-proveedor'
import { reportarFalloIA } from '@/lib/ia/incidentes-servidor'
import { anotarLlamada } from '@/lib/ia/gateway'
import { esFundador } from '@/lib/authz/fundador'
import { WHISPER_PROMPT_MEDICO, WHISPER_PROMPT_UCI } from '@/lib/expediente/medical-vocabulary'
import { construir as construirLexicon } from '@/lib/asr/lexicon'
import { verificarModuloIA } from '@/lib/auth-server'
import { limitarOResponder } from '@/lib/rate-limit'
import { gateCreditos, resolverClaveIA, registrarUso, registrarCreditos  } from '@/lib/ai-keys'
import { COSTO_CREDITOS } from '@/lib/planes-ia'
import { correlacionDe } from '@/lib/observabilidad/correlacion'
import { iaNoDisponible } from '@/lib/ia/fallo-proveedor'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const acceso = await verificarModuloIA(req, 'expediente')
  if (!acceso.ok) return acceso.response

  // Tope de ráfaga: transcribir audio cuesta por llamada (OpenAI). 30/min por usuario.
  const limite = await limitarOResponder(`transcribir:${acceso.uid}`, 30, 60)
  if (limite) return limite

  // Llave del consultorio (o la del dueño en modo prueba).
  const { key: apiKey, fuente, clinicId } = await resolverClaveIA(acceso.uid, 'openai', process.env.OPENAI_API_KEY)
  // TOPE DE CRÉDITOS (auditoría 26-jul): sin esto, un consultorio con los
  // créditos agotados seguía quemando la llave del dueño indefinidamente.
  // `gateCreditos` sólo corta cuando la llave es la del dueño (`prueba`):
  // con llave propia del consultorio NO se corta, porque paga su propia API.
  const t0Costo = Date.now()
  const corteCreditos = await gateCreditos(clinicId, fuente)
  if (corteCreditos) return corteCreditos
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: iaNoDisponible('transcripcion').mensaje },
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
  /**
   * Contexto del dictado. `uci` cambia el vocabulario que se le sugiere al
   * modelo. Si no viene, se usa el de consulta — el comportamiento de siempre.
   */
  const contexto = String(formData.get('contexto') ?? '')
  /**
   * MINUTOS DE AUDIO — lo que de verdad se cobra en transcripción.
   *
   * La duración la reporta el grabador del cliente, que es quien la conoce con
   * precisión. Se acota a 4 horas: es telemetría de COSTO, no una factura al
   * paciente, pero un valor absurdo (o manipulado) ensuciaría el tablero del
   * dueño y no vale nada dejarlo abierto.
   *
   * Sin este dato el gasto de dictado NO EXISTÍA en el libro: la ruta sólo
   * descontaba créditos. Con cada consulta dictada, era probablemente el renglón
   * más grande de la plataforma, invisible.
   */
  const minutosAudio = Math.min(240, Math.max(0, Number(formData.get('duracionSeg') ?? 0) / 60)) || undefined
  /**
   * VOCABULARIO DE ESTE PACIENTE.
   *
   * El prompt es lo ÚNICO que cambia lo que el reconocedor OYE: sesga su
   * decodificación hacia las palabras que se le dan. Todo lo demás del pipeline
   * ocurre DESPUÉS y no puede recuperar una palabra que nunca se oyó.
   *
   * Hasta hoy se mandaba uno de dos prompts fijos, así que el trabajo de
   * `lib/asr/lexicon.ts` —79 especialidades, presupuestadas a los 224 tokens que
   * el modelo lee, con los fármacos y problemas de ESTE paciente primero— no
   * llegaba nunca al reconocedor. Estaba escrito, probado y desconectado.
   *
   * Los campos son opcionales y todo cae al prompt de siempre si algo falta: un
   * dictado nunca se queda sin vocabulario por un dato que no llegó.
   */
  const leerLista = (k: string): string[] => {
    try {
      const v = JSON.parse(String(formData.get(k) ?? '[]')) as unknown
      return Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 40) : []
    } catch { return [] }
  }
  const promptLexicon = ((): string => {
    try {
      const modulo = (['consulta', 'hospitalizacion', 'uci', 'urgencias', 'quirofano'] as const)
        .find(m => m === contexto)
      if (!modulo) return ''
      const lex = construirLexicon({
        modulo,
        aprendidas: leerLista('aprendidas'),
        // Los alérgenos los mandaba el grabador desde hace tiempo y esta ruta
        // no los leía: se tiraban en el último metro. Ver `ContextoDictado`.
        alergias: leerLista('alergias'),
        especialidades: leerLista('especialidades'),
        medicamentos: leerLista('medicamentos'),
        problemas: leerLista('problemas'),
      })
      return lex.prompt
    } catch {
      // Si el léxico revienta, se sigue con el de siempre. Perder vocabulario
      // extra es molesto; quedarse sin dictado es otra cosa.
      return ''
    }
  })()
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
    /**
     * VOCABULARIO POR CONTEXTO.
     *
     * Medido sobre el corpus de 498 audios de UCI: el prompt de consulta no
     * traía NI UNA palabra de cuidados críticos, y por eso CVVHDF, VExUS, RASS y
     * sweep gas fallaban — el sesgo apuntaba a fármacos de consultorio. Mandar
     * los dos juntos no cabe en los ~224 tokens que el modelo lee.
     */
    upstream.append('prompt', promptLexicon || (contexto === 'uci' ? WHISPER_PROMPT_UCI : WHISPER_PROMPT_MEDICO))
    return fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
      // REG-346 — cabe dentro de `maxDuration = 60` con margen para responder.
      signal: AbortSignal.timeout(50_000),
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
        void registrarCreditos(clinicId, COSTO_CREDITOS.transcribir)
        /**
         * El asiento en el libro de costos, que esta ruta no dejaba.
         *
         * La transcripción no devuelve tokens —se cobra por minuto— así que el
         * uso viaja en `minutosAudio`. Sin esto, /superadmin/costos ignoraba
         * por completo el gasto de voz.
         */
        anotarLlamada(
          {
            feature: 'transcribir',
            requestId: req.headers.get('x-vercel-id') || `tr-${acceso.uid}-${Date.now()}`,
        correlacion: correlacionDe(req),
            clinicId: clinicId ?? null, uid: acceso.uid,
            creditos: COSTO_CREDITOS.transcribir, fuente,
            esFundador: esFundador(acceso.email, process.env.SUPERADMIN_EMAILS),
          },
          'openai', model,
          { usage: { input_tokens: 0, output_tokens: 0 }, minutosAudio },
          Date.now() - t0Costo,
        )
        return NextResponse.json({
          ok: true,
          text: data.text ?? '',
          language: data.language ?? 'es',
          model,
        })
      }
      ultimoStatus = res.status
      ultimoError = (await res.text()).slice(0, 300)
      safeLog.warn(`[transcribir] ${model} respondió ${res.status} — probando siguiente modelo`)
      /**
       * La llave es inválida/expiró → ningún modelo servirá: abortar de una vez.
       *
       * QUIÉN PAGA DECIDE QUÉ SE LE DICE AL MÉDICO. El mensaje anterior era
       * «Revísala en Vercel» SIEMPRE — una consola a la que el médico no tiene
       * acceso, por una llave que en el plan de plataforma ni siquiera es suya.
       * Es exactamente lo que `fallo-proveedor.ts` prohíbe («con llave de la
       * PLATAFORMA, al médico jamás se le echa la culpa ni se le manda a
       * pagar»); `procesar` ya lo hacía bien y esta ruta se había quedado atrás.
       */
      if (res.status === 401) {
        const quien = quienPaga(fuente)
        const clase = claseDeFallo(res.status, ultimoError)
        reportarFalloIA({ clase, quien, proveedor: 'openai', feature: 'transcribir', status: res.status })
        return NextResponse.json({ ok: false, error: avisoAlMedico(clase, quien, 'openai').texto }, { status: 502 })
      }
      // CUALQUIER otro error (400/404/429/500/502/503/529): NO abortar — probar el
      // SIGUIENTE modelo. whisper-1 (el último) es el más estable y casi nunca da
      // 5xx, así que un 502 pasajero de gpt-4o-transcribe ya no tumba la nota.
    } catch (err) {
      safeLog.error(`[transcribir] ${model} error de red:`, err)
      ultimoError = String(err).slice(0, 300)
    }
  }
  // Aquí solo se llega si TODOS los modelos de OpenAI fallaron (outage real).
  safeLog.error('[transcribir] Todos los modelos de OpenAI fallaron. Último:', ultimoStatus, ultimoError)
  return NextResponse.json(
    /* Éste ya decía lo importante —«el audio sigue guardado»— pero nombraba al
       proveedor y le enseñaba un código HTTP al médico. `avisoAlMedico` dice lo
       mismo, clasificado, y sabe si reintentar sirve de verdad. */
    { ok: false, error: avisoAlMedico(claseDeFallo(ultimoStatus, ultimoError), quienPaga(fuente), 'openai').texto },
    { status: 502 },
  )
}
