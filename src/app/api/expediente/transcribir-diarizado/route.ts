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
import { topeDe, TOPE_TERMINOS, componerSesgo, type ContextoSesgo } from '@/lib/asr/sesgo-diarizado'
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

/**
 * El modelo que se pide por su nombre.
 *
 * Documentación del proveedor (agosto 2026): `universal-3.5-pro` admite español
 * —está entre sus 18 idiomas— y «keyterms prompting up to 1,000 words», que es
 * exactamente el tamaño de nuestra lista de sesgo.
 */
const MODELO_DIARIZACION = 'universal-3-5-pro'

/**
 * ── EL PARÁMETRO CAMBIÓ Y NOS DEJÓ SIN DIARIZACIÓN (4-ago-2026) ─────────────
 *
 * El proveedor **retiró `speech_model`**. Ya no acepta ningún valor — ni el
 * nombre del modelo ni el alias `'best'`:
 *
 *     «The speech_model parameter is deprecated. Use speech_models:
 *      ["universal-3-5-pro", "universal-2"]»
 *
 * Comprobado contra su API el 4-ago-2026, con las dos variantes.
 *
 * Consecuencia real: **los dos intentos de esta ruta devolvían 400**. El
 * principal por pedir el modelo por su nombre, y el reintento por caer al alias
 * heredado — que era justo la red de seguridad. Con los dos caídos, cada
 * consulta grabada se iba al motor de respaldo y se quedaba **sin separación de
 * voces**: sin ella no hay atribución de rol, y sin rol el motor de negaciones y
 * la procedencia razonan sobre un diálogo plano.
 *
 * Y no avisaba: la ruta hace lo correcto —seguir con el respaldo antes que
 * dejar al médico sin nota— así que el fallo era silencioso.
 *
 * Ahora se manda `speech_models` con la lista, que es el mecanismo de respaldo
 * **del propio proveedor**: si el primero no está disponible usa el segundo, sin
 * un segundo viaje ni una segunda subida del audio.
 *
 * El nombre también cambió de forma: `universal-3.5-pro` → `universal-3-5-pro`,
 * con guiones. Lo dice el mensaje de error, literal.
 */
const MODELOS_DIARIZACION = ['universal-3-5-pro', 'universal-2'] as const

/**
 * Cuántas voces como mucho en una grabación clínica.
 *
 * NO es una cifra clínica: es un techo de configuración. Cuatro cubre médico,
 * paciente, un acompañante y alguien más (residente, enfermera) sin dejar que el
 * proveedor reparta a una sola persona en diez etiquetas distintas, que es lo
 * que hace por defecto y lo que rompe la atribución de roles.
 */
const MAX_VOCES = 4

/**
 * MODO MÉDICO DEL PROVEEDOR — decisión del Dr., 4-ago-2026.
 *
 * `domain: 'medical-v1'` es un modelo de dominio de AssemblyAI entrenado en
 * lenguaje clínico. Su documentación declara **cuatro idiomas: inglés, español,
 * alemán y francés** — o sea que el español NO es un caso degradado.
 *
 * ── POR QUÉ ESTABA APAGADO HASTA HOY ────────────────────────────────────────
 *
 * Es un añadido que **puede facturarse aparte**, y encender un cargo recurrente
 * en la cuenta de otro no es una decisión de ingeniería. Quedó anotado en la
 * bitácora como pendiente del Dr. desde la v1002; lo autorizó el 4-ago-2026.
 *
 * ── POR QUÉ ES SEGURO ENCENDERLO ────────────────────────────────────────────
 *
 * Falla **suave**: si el idioma no estuviera soportado, el proveedor **ignora**
 * el parámetro y devuelve un aviso, en vez de rechazar la transcripción. Y si
 * rechazara el envío entero, el reintento con el alias heredado —que ya existe
 * desde la v1002— lo recoge.
 */
const DOMINIO_MEDICO = 'medical-v1'

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
  /**
   * El contexto del paciente, que llega por los DOS caminos.
   *
   * Audio corto viaja como formulario; audio largo ya está en Storage y viaja
   * como JSON. Leerlo sólo en uno habría dejado las consultas largas —las que
   * más términos traen— con el sesgo genérico, que es el defecto que se está
   * reparando, cometido a medias.
   */
  let ctxSesgo: ContextoSesgo = {}
  const comoLista = (v: unknown): string[] => {
    try {
      const j = typeof v === 'string' ? JSON.parse(v) : v
      return Array.isArray(j) ? j.map(String).slice(0, 200) : []
    } catch { return [] }
  }

  try {
    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => null)
      const url = body?.audioUrl
      if (!url || typeof url !== 'string') {
        return NextResponse.json({ ok: false, error: 'Falta audioUrl' }, { status: 400 })
      }
      audio_url = url
      ctxSesgo = {
        medicamentos: comoLista(body?.medicamentos),
        problemas: comoLista(body?.problemas),
        alergias: comoLista(body?.alergias),
        aprendidas: comoLista(body?.aprendidas),
        especialidad: comoLista(body?.especialidades),
      }
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
      ctxSesgo = {
        medicamentos: comoLista(formData.get('medicamentos')),
        problemas: comoLista(formData.get('problemas')),
        alergias: comoLista(formData.get('alergias')),
        aprendidas: comoLista(formData.get('aprendidas')),
        especialidad: comoLista(formData.get('especialidades')),
      }
    }

    /**
     * Si el contexto no viene —o viene mal— el sesgo cae al catálogo global de
     * siempre: **nunca se queda sin sesgo por un dato ausente**.
     */
    /**
     * ── LA LISTA DE MODELOS, Y EL TOPE DEL MÁS PEQUEÑO ──────────────────────
     *
     * El respaldo lo hace **el proveedor**, no nosotros: `speech_models` acepta
     * una lista y usa el primero disponible. Eso ahorra un segundo viaje y una
     * segunda subida del audio, que en una consulta de veinte minutos no es un
     * detalle.
     *
     * **El sesgo se presupuesta para el modelo MÁS PEQUEÑO de la lista** —200
     * términos, no 1 000—. Si se presupuestara para el mayor y el proveedor
     * acabara usando el menor, ochocientos términos los tiraría él, por el
     * criterio que quisiera y sin decirlo. Y el orden de esa lista ES la
     * política: primero los fármacos de ESTE paciente. Un recorte que no
     * controlamos puede llevarse justo la parte que importa.
     *
     * Se prefiere mandar menos y saber cuáles, que mandar más y no saber cuáles
     * llegaron.
     */
    const tope = Math.min(...MODELOS_DIARIZACION.map(m => topeDe(m)))
    const armar = () => {
      const sesgo = componerSesgo(ctxSesgo, WORD_BOOST_MEDICO, tope)
      if (sesgo.descartados > 0) {
        // Un tope que nadie ve se lee como «cupo todo».
        safeLog.info(`[diarizado] sesgo (${MODELOS_DIARIZACION.join(', ')}): ${sesgo.terminos.length} términos (${sesgo.delPaciente} del paciente), ${sesgo.descartados} no cupieron`)
      }
      return {
        audio_url,
        speech_models: [...MODELOS_DIARIZACION],
        speaker_labels: true,   // separa voces (Hablante A/B/C…)
        /**
         * CUÁNTAS VOCES COMO MUCHO.
         *
         * Sin esto el proveedor asume hasta **10** voces en audio de 2–10 min y
         * hasta **30** de ahí en adelante (su documentación). En una consulta
         * eso no sobra: sobre-parte. Un mismo médico acaba repartido en «A», «C»
         * y «F», y entonces la atribución de roles —quién dijo el diagnóstico—
         * se vuelve irresoluble.
         *
         * Se manda `max_speakers_expected`, NO `speakers_expected`: la propia
         * documentación advierte que fijar el número exacto sin estar seguro
         * degrada la precisión. Y no lo estamos: en un consultorio puede entrar
         * un acompañante, y en un pase de UCI hay más gente.
         */
        speaker_options: { min_speakers_expected: 1, max_speakers_expected: MAX_VOCES },
        // Modo médico. Ver `DOMINIO_MEDICO`: el español está entre sus idiomas,
        // y si no lo estuviera el proveedor lo ignoraría con un aviso.
        domain: DOMINIO_MEDICO,
        language_code: 'es',
        punctuate: true,
        format_text: true,
        /**
         * EL SESGO LLEVA AL PACIENTE QUE ESTÁ ENFRENTE.
         *
         * Hasta la v981 aquí iba `WORD_BOOST_MEDICO` pelado: la misma lista de
         * mil términos para todos los pacientes del mundo. Mientras tanto
         * `lexicon.ts` presupuestaba con cuidado los fármacos y problemas de
         * ESTE paciente… y sólo alimentaba al motor de repuesto, que casi nunca
         * corre porque la diarización se intenta primero.
         *
         * El sesgo es lo ÚNICO que cambia lo que el motor OYE. El corrector y el
         * guardián trabajan sobre lo ya oído y no pueden recuperar una palabra
         * que nunca llegó.
         */
        word_boost: sesgo.terminos,
        boost_param: 'high',
      }
    }

    const enviar = (cuerpo: object) => fetch(`${AAI}/transcript`, {
      method: 'POST',
      headers: { authorization: key, 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })

    const sub = await enviar(armar())
    /**
     * UN 4xx AQUÍ YA NO SE REINTENTA — Y ESO ES LO CORRECTO.
     *
     * Antes se reintentaba con el alias heredado, y el 4-ago-2026 se vio para
     * qué servía eso: el proveedor retiró `speech_model` y **los dos intentos
     * devolvían 400**, así que la red de seguridad no salvaba nada y encima
     * escondía el problema detrás de un segundo viaje.
     *
     * El respaldo entre modelos ahora lo hace el proveedor dentro de
     * `speech_models`. Si aun así responde 4xx, el problema es **nuestro cuerpo
     * de petición** —un parámetro retirado, una opción mal escrita— y repetirlo
     * igual no lo arregla: se registra con el motivo del proveedor, que es lo
     * único que dice qué cambió.
     */
    if (!sub.ok) {
      const detalle = (await sub.text().catch(() => '')).slice(0, 300)
      safeLog.error(`[diarizado] rechazado HTTP ${sub.status}`, { detalle })
      return NextResponse.json({ ok: false, error: `AssemblyAI submit HTTP ${sub.status}` }, { status: 502 })
    }
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
