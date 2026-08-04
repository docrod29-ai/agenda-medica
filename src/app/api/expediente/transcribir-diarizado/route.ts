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
import type { PalabraOida } from '@/lib/expediente/confianza-audio'
import { safeLog } from '@/lib/security/sanitize'
import { verificarModuloIA } from '@/lib/auth-server'
import { limitarOResponder } from '@/lib/rate-limit'
import { resolverClaveIA, creditosAgotados, registrarUso, registrarCreditos } from '@/lib/ai-keys'
import { COSTO_CREDITOS } from '@/lib/planes-ia'
import { anotarLlamada } from '@/lib/ia/gateway'
import { esFundador } from '@/lib/authz/fundador'
import { WORD_BOOST_MEDICO } from '@/lib/expediente/medical-vocabulary'
import { adminDb } from '@/lib/firebase-admin'

export const runtime = 'nodejs'
export const maxDuration = 60

const AAI = 'https://api.assemblyai.com/v2'

interface UtteranceAAI { speaker: string; text: string; palabras: PalabraOida[] }

export async function POST(req: NextRequest) {
  const acceso = await verificarModuloIA(req, 'expediente')
  if (!acceso.ok) return acceso.response
  const _rl = await limitarOResponder(`transcribir-diarizado:${acceso.uid}`, 20, 60)
  if (_rl) return _rl

  const { key, fuente, clinicId } = await resolverClaveIA(acceso.uid, 'assemblyai', process.env.ASSEMBLYAI_API_KEY)
  const t0Costo = Date.now()
  if (!key) {
    return NextResponse.json(
      { ok: false, sinClave: true, error: 'ASSEMBLYAI_API_KEY no configurada. Se usa transcripción sin diarización.' },
      { status: 503 },
    )
  }
  if (fuente === 'prueba' && await creditosAgotados(clinicId)) {
    return NextResponse.json(
      { ok: false, sinCreditos: true, error: 'Se acabaron tus créditos con IA del mes. Compra más o sube de plan para seguir grabando.' },
      { status: 402 },
    )
  }

  // Dos modos: (a) JSON { audioUrl } → audio ya está en Storage (audio LARGO,
  // sin pasar por el límite de 4.5MB de Vercel); (b) multipart con el blob
  // (audio corto, passthrough a AssemblyAI).
  const contentType = req.headers.get('content-type') || ''
  let audio_url: string

  try {
    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => null)
      const url = body?.audioUrl
      if (!url || typeof url !== 'string') {
        return NextResponse.json({ ok: false, error: 'Falta audioUrl' }, { status: 400 })
      }
      audio_url = url
    } else {
      const formData = await req.formData()
      const audio = formData.get('audio')
      if (!(audio instanceof Blob)) {
        return NextResponse.json({ ok: false, error: 'Falta archivo de audio' }, { status: 400 })
      }
      // Subir el audio a AssemblyAI (passthrough de bytes)
      const bytes = Buffer.from(await audio.arrayBuffer())
      const up = await fetch(`${AAI}/upload`, {
        method: 'POST',
        headers: { authorization: key },
        body: bytes,
      })
      if (!up.ok) return NextResponse.json({ ok: false, error: `AssemblyAI upload HTTP ${up.status}` }, { status: 502 })
      audio_url = (await up.json()).upload_url
    }

    // Encolar transcripción con diarización en español
    const sub = await fetch(`${AAI}/transcript`, {
      method: 'POST',
      headers: { authorization: key, 'content-type': 'application/json' },
      body: JSON.stringify({
        audio_url,
        speech_model: 'best',   // máxima precisión (Universal) — calidad > velocidad
        speaker_labels: true,   // separa voces (Hablante A/B/C…)
        language_code: 'es',
        punctuate: true,
        format_text: true,
        word_boost: WORD_BOOST_MEDICO,  // sesga el ASR hacia fármacos/términos MX
        boost_param: 'high',
      }),
    })
    if (!sub.ok) return NextResponse.json({ ok: false, error: `AssemblyAI submit HTTP ${sub.status}` }, { status: 502 })
    const { id } = await sub.json()
    // DUEÑO DEL TRANSCRIPT (auditoría P1 IDOR): en modo prueba varias clínicas
    // comparten la llave del dueño → sin esto, otra clínica podía leer el dictado
    // (PHI) con el UUID. Se registra el dueño y el GET lo verifica.
    if (id) void adminDb.collection('transcript_owners').doc(String(id)).set({ clinicId, uid: acceso.uid, at: new Date().toISOString() }).catch(() => {})
    void registrarUso(clinicId, fuente)   // un job = un uso
    void registrarCreditos(clinicId, COSTO_CREDITOS.transcribirDiarizado)
    /**
     * EL ASIENTO — Y LO QUE DELIBERADAMENTE NO TRAE.
     *
     * La separación de voces la hace AssemblyAI, un tercer proveedor que no está
     * en la tabla de tarifas: sus precios no los he leído de su página y no los
     * voy a deducir. El motor de precios devolverá NULO para este renglón, que
     * es la verdad —«no sé cuánto costó»— y no un cero, que se leería como
     * «fue gratis» y dejaría el gasto de la diarización fuera del margen sin
     * que nadie lo notara.
     *
     * Se anota igual porque la LLAMADA sí es un hecho: aparece en el tablero,
     * con su modelo y su fecha, marcada como sin tarifa. Cargar el precio real
     * de AssemblyAI es un pendiente declarado, no un olvido.
     *
     * Tampoco viajan minutos: en este punto sólo se ENVÍA el audio a la cola;
     * la duración se conocería al recogerlo en el GET.
     */
    anotarLlamada(
      {
        feature: 'transcribir-diarizado',
        requestId: req.headers.get('x-vercel-id') || `td-${acceso.uid}-${Date.now()}`,
        clinicId: clinicId ?? null, uid: acceso.uid,
        creditos: COSTO_CREDITOS.transcribirDiarizado, fuente,
        esFundador: esFundador(acceso.email, process.env.SUPERADMIN_EMAILS),
      },
      'assemblyai', 'best',
      { usage: { input_tokens: 0, output_tokens: 0 } },
      Date.now() - t0Costo,
    )
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 120) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const acceso = await verificarModuloIA(req, 'expediente')
  if (!acceso.ok) return acceso.response
  const _rl = await limitarOResponder(`transcribir-diarizado:${acceso.uid}`, 20, 60)
  if (_rl) return _rl

  // Debe poller con la MISMA llave que envió el job (la del consultorio).
  const { key, clinicId, fuente } = await resolverClaveIA(acceso.uid, 'assemblyai', process.env.ASSEMBLYAI_API_KEY)
  if (!key) return NextResponse.json({ ok: false, sinClave: true }, { status: 503 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, error: 'Falta id' }, { status: 400 })

  // Verifica que el transcript sea de ESTA clínica (auditoría P1 IDOR): en modo
  // prueba se comparte la llave del dueño, así que sin esto otra clínica leería el
  // dictado (PHI) con el UUID. Si no hay registro de dueño (jobs previos), se permite.
  const owner = await adminDb.collection('transcript_owners').doc(id).get().catch(() => null)
  if (owner?.exists && owner.data()?.clinicId && owner.data()?.clinicId !== clinicId) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 })
  }

  try {
    const r = await fetch(`${AAI}/transcript/${id}`, { headers: { authorization: key } })
    if (!r.ok) return NextResponse.json({ ok: false, error: `AssemblyAI HTTP ${r.status}` }, { status: 502 })
    const d = await r.json()

    if (d.status === 'completed') {
      /**
       * LAS PALABRAS VIAJAN CON SU CONFIANZA.
       *
       * Esta línea era el punto exacto donde se perdía la duda del motor:
       * mapeaba a `{ speaker, text }` y tiraba `u.words`, que trae la confianza
       * de CADA palabra. Después de aquí, una palabra que el motor dio con 0.31
       * y otra que dio con 0.99 eran indistinguibles — y el modelo razonaba
       * sobre las dos con la misma seguridad. Así fue como «la de la docencia»
       * acabó siendo «vesícula» en una consulta real.
       *
       * Se copia sólo lo que hace falta —texto, inicio y confianza—, no el
       * objeto entero: el `end` de cada palabra no lo usa nadie y engordaría una
       * respuesta que ya lleva la consulta íntegra.
       */
      const utterances: UtteranceAAI[] = (d.utterances ?? []).map(
        (u: { speaker: string; text: string; words?: { text: string; start: number; confidence: number }[] }) => ({
          speaker: u.speaker,
          text: u.text,
          palabras: (u.words ?? []).map(w => ({
            texto: w.text,
            inicioMs: Number(w.start ?? 0),
            confianza: Number(w.confidence ?? 1),
          })),
        }),
      )
      /**
       * ENTREGADO EL TEXTO, SE PURGA EL AUDIO DEL TERCERO.
       *
       * Lo que sale de aquí es la conversación ÍNTEGRA de una consulta, con los
       * nombres dichos en voz alta: es el dato más identificable del sistema y
       * el único que no se puede desidentificar antes de mandarlo —para saber
       * qué se dijo hay que transcribirlo primero—.
       *
       * Lo que sí se puede es que no se quede allá. Hasta ahora la transcripción
       * y su audio vivían en AssemblyAI indefinidamente después de que nosotros
       * ya teníamos el texto. `DELETE /v2/transcript/{id}` elimina de forma
       * permanente los datos de esa transcripción.
       *
       * Va DESPUÉS de construir la respuesta y sin esperar: si el borrado falla,
       * el médico recibe su dictado igual. Y es seguro borrar aquí porque el
       * cliente deja de consultar en cuanto ve `completed` (useGrabacionAudio),
       * así que nadie vuelve a pedir este id.
       *
       * El camino de audio largo ya borraba su copia de Firebase Storage; esta
       * era la mitad que faltaba.
       */
      /**
       * EL COSTO SE ANOTA AQUÍ, QUE ES CUANDO SE CONOCEN LOS MINUTOS.
       *
       * El POST sólo encola: en ese momento no se sabe cuánto dura el audio, así
       * que el asiento salía con cero minutos y, sin tarifa, el renglón más
       * frecuente del consultorio no aparecía en ningún lado.
       *
       * `audio_duration` viene en segundos en la respuesta del proveedor. Si no
       * viniera, se anota igual con cero y el libro lo marcará como sin uso —
       * nunca se inventa una duración.
       */
      const segundos = Number(d.audio_duration ?? 0)
      anotarLlamada(
        {
          feature: 'transcribir-diarizado',
          requestId: `td-fin-${id}`,
          clinicId: clinicId ?? null, uid: acceso.uid,
          creditos: 0, fuente,
          esFundador: esFundador(acceso.email, process.env.SUPERADMIN_EMAILS),
        },
        'assemblyai', 'best',
        { usage: { input_tokens: 0, output_tokens: 0 }, duracionSeg: segundos > 0 ? segundos : undefined },
        0,
      )
      const respuesta = NextResponse.json({ ok: true, status: 'completed', text: d.text ?? '', utterances })
      void fetch(`${AAI}/transcript/${id}`, { method: 'DELETE', headers: { authorization: key } })
        .then(r => { if (!r.ok) safeLog.warn(`[diarizado] no se pudo purgar la transcripción en el proveedor (HTTP ${r.status})`) })
        .catch(e => safeLog.warn('[diarizado] no se pudo purgar la transcripción en el proveedor', e))
      // El puntero local tampoco hace falta ya: sólo servía para comprobar de
      // quién era el transcript mientras existía.
      void adminDb.collection('transcript_owners').doc(id).delete().catch(() => { /* no bloquea */ })
      return respuesta
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
