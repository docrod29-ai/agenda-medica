'use client'
import { type CambioTranscripcion } from '@/lib/expediente/medical-vocabulary'
import { dudaEnZonaCritica } from '@/lib/expediente/confianza-audio'
import { UNIDADES_CANONICAS } from '@/lib/asr/politica-critica'
import type { PalabraOida } from '@/lib/expediente/confianza-audio'
import { quitarEcoDeCabecera, quitarSolapeConAnterior } from '@/lib/asr/eco-de-cabecera'
import { type AlertaDictado } from '@/lib/asr/corrector-vigilado'
import { cambiosVisibles, type CambioVisible } from '@/lib/asr/cambios-visibles'
/**
 * EL PIPELINE COMPLETO, no sólo el guardián.
 *
 * Hasta hoy la consulta corría `corregirVigilado`, que es la etapa 1 de nueve:
 * corrige el léxico y vigila que la corrección no se coma una cifra. Las otras
 * ocho —cifras y unidades en su forma escrita, ortografía de siglas, verificación
 * de entidades críticas, gate de ambigüedad— estaban escritas, probadas contra
 * 6 000 frases y **sin conectar a nada**: `procesarTranscript` no aparecía en un
 * solo archivo de producción.
 *
 * O sea que «paracetamol quinientos miligramos cada ocho horas» llegaba a la nota
 * tal cual, en letra, y todo lo que midió el banco de voz no le servía al médico.
 *
 * `procesarTranscript` LLAMA a `corregirVigilado` como su primera etapa, así que
 * esto no quita nada: añade.
 */
import { procesarTranscript } from '@/lib/asr/pipeline'
import { fetchAutenticado } from '@/lib/auth-client'
import { auth, storage } from '@/lib/firebase'
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
/**
 * Hook de grabación HIFI con streaming + pause/resume + crash recovery.
 *
 * v3 — arquitectura "ultra perfect" (2026-06-10):
 *
 *   CAPTURA (sin cambios v2):
 *     48kHz · mono · 128kbps Opus · autoGainControl · medidor RMS en vivo
 *
 *   STREAMING (nuevo):
 *     Cada ~20s se manda un chunk a /api/expediente/transcribir-chunk.
 *     El texto aparece en `transcripcionParcial` mientras la grabación
 *     sigue. Al detener, se reusa lo ya transcrito + el último chunk
 *     pendiente — el médico ya no espera 2 min al final.
 *     `setTranscripcion` final = concatenación + corrección léxica.
 *
 *   PAUSE / RESUME (nuevo):
 *     pausar() — MediaRecorder.pause() + congela timer/analyser
 *     reanudar() — MediaRecorder.resume() + reanuda timer/analyser
 *     útil cuando el paciente sale al baño o entra acompañante a media
 *     consulta sin que termine la nota.
 *
 *   CRASH RECOVERY (nuevo):
 *     Los chunks se persisten en IndexedDB conforme van llegando.
 *     Si el navegador crashea o el doctor cierra la pestaña por error,
 *     al reabrir la consulta detectamos chunks huérfanos y ofrecemos
 *     recuperar. NUNCA se pierde audio capturado.
 *     Los chunks se borran al confirmar la transcripción final.
 *
 *   LIBERACIÓN DE RECURSOS (sin cambios v2):
 *     5 paths cubiertos: detener feliz, fallo de getUserMedia, error en
 *     vivo, unmount, reset. AudioContext.close() + RAF cancel + IDB clear.
 */
import { useState, useRef, useCallback, useEffect } from 'react'

type Estado = 'inactivo' | 'grabando' | 'pausado' | 'subiendo' | 'listo' | 'error'

export interface OpcionesGrabacion {
  noiseSuppression?: boolean
  echoCancellation?: boolean
  autoGainControl?: boolean
  /** Activa streaming chunks (default true). Off solo para debugging. */
  streaming?: boolean
  /** Intervalo de chunks a transcribir en vivo (ms). Default 20s. */
  intervaloChunkMs?: number
  /** ID estable para recovery vía IndexedDB (ej. patientId). */
  recoveryKey?: string
  /**
   * Módulo del dictado. Decide el vocabulario con el que se sesga al reconocedor.
   *
   * Medido sobre el corpus de 498 audios: sin esto, CVVHDF, VExUS y RASS fallan
   * porque el sesgo apunta al consultorio.
   */
  contexto?: 'consulta' | 'hospitalizacion' | 'uci' | 'urgencias' | 'quirofano'
  /**
   * ¿Hablan dos, o dicta uno solo?
   *
   * El médico contestó que en UCI y en hospital **dicta solo**. Pedir separación
   * de voces ahí es trabajo, dinero y espera para nada — y peor: el diarizador
   * parte a una sola persona en dos hablantes cuando cambia el tono, con lo que
   * su propio dictado sale atribuido a un «paciente» que nunca habló.
   *
   * Por omisión, `conversacion`: **ante la duda se diariza**. Perder la
   * separación en una conversación real cuesta información irrecuperable;
   * diarizar un monólogo sólo cuesta unos segundos, y `esMonologo` limpia el
   * resultado aguas abajo. Ver `lib/asr/un-solo-hablante.ts`.
   */
  modoDeHabla?: 'conversacion' | 'dictado'
  /**
   * Vocabulario de ESTE paciente, para el prompt del reconocedor.
   *
   * El prompt es lo único que cambia lo que el modelo OYE, y su presupuesto son
   * ~224 tokens: lo del paciente entra PRIMERO y lo genérico llena lo que sobre.
   * Un fármaco que el paciente ya toma es la pista más específica que existe.
   */
  especialidades?: readonly string[]
  /**
   * Palabras que ESTE médico ya corrigió a mano más de una vez (LEARN).
   *
   * Van con lo del paciente, no al final: el presupuesto del sesgo es de 224
   * tokens y el orden ES la política.
   */
  aprendidas?: readonly string[]
  medicamentos?: readonly string[]
  problemas?: readonly string[]
  /**
   * Alérgenos del expediente.
   *
   * Sesgar hacia ellos importa más que hacia cualquier otro término: el cruce
   * alergia↔fármaco compara contra lo que se OYÓ, así que un alérgeno mal oído
   * es un cruce que nunca salta.
   */
  alergias?: readonly string[]
}

/** Un turno de habla diarizado (AssemblyAI): quién habló y qué dijo. */
export interface Utterance {
  speaker: string   // 'A' | 'B' | 'C' … (etiqueta cruda de AssemblyAI)
  text: string
  /**
   * Cada palabra con la confianza que el motor le puso.
   *
   * Opcional porque el camino sin diarización no las trae — y porque un turno
   * viejo, recuperado de un borrador guardado antes de la v975, tampoco.
   * Ausente significa «no se sabe», que NO es lo mismo que «todas seguras»: por
   * eso quien las consume no rellena confianzas por omisión.
   */
  palabras?: PalabraOida[]
}

/** Lo que el navegador concedió al abrir el micrófono (no lo que se le pidió). */
export interface AjustesCaptura {
  sampleRate: number | null
  canales: number | null
  /** Etiqueta del dispositivo. Vacía si el navegador no la expone. */
  microfono: string
  supresionRuido: boolean
  cancelacionEco: boolean
  gananciaAutomatica: boolean
}

export interface UseGrabacionAudio {
  soportado: boolean
  estado: Estado
  /**
   * Por qué NO hubo separación de voces, o `null` si sí la hubo.
   *
   * Lo consume la pantalla de consulta para decírselo al médico: hasta ahora el
   * fallback a Whisper era invisible y la nota salía idéntica.
   */
  sinDiarizacion: MotivoSinDiarizacion | null
  /** Ruta en Storage del audio de esta consulta, o `null` si no se guardó. */
  audioPath: string | null
  duracion: number
  transcripcion: string
  /** Turnos de habla separados por voz (vacío si no hubo diarización). */
  utterances: Utterance[]
  /** Texto que va apareciendo conforme llegan los chunks (streaming). */
  transcripcionParcial: string
  error: string
  nivelAudio: number
  silencioProlongado: boolean
  bytesGrabados: number
  /**
   * Lo que el navegador concedió de verdad, no lo que se le pidió.
   *
   * `null` hasta que se abre el micrófono. Se enseña en pantalla en vez de la
   * constante que se afirmaba sin comprobar.
   */
  /**
   * El texto tal como salió del reconocedor, **antes** del pipeline y antes de
   * que el médico lo edite.
   *
   * Es el material de origen. Se expone porque el campo que la nota archivaba
   * como «cruda» no lo era: era el texto de trabajo, ya corregido y editable.
   */
  transcripcionMotor: string
  /**
   * Por qué el dictado pide una confirmación del médico.
   *
   * Vacío casi siempre. Cuando trae algo, es porque una etapa determinista
   * detectó una ambigüedad que **no le corresponde resolver a un modelo**:
   * negación, lateralidad, dosis, unidad o dos fármacos plausibles.
   */
  motivosConfirmacion: string[]
  /**
   * Adopta un dictado transcrito en OTRA pantalla (el pase de UCI).
   *
   * Sin esto, la nota que se firma en la consulta no tenía ni los turnos ni el
   * material de origen del pase, aunque ambos existían al otro lado.
   */
  sembrarDictado: (semilla: { crudo?: string; utterances?: Utterance[] }) => void
  /**
   * ¿La señal está recortando (saturando)?
   *
   * El RMS no lo ve: una señal recortada tiene nivel normal y armónicos falsos
   * en todo el espectro. Sin esto, el medidor podía decir «captando bien» sobre
   * audio saturado.
   */
  recorte: boolean
  captura: AjustesCaptura | null
  /**
   * Cuántos trozos en vivo NO se pudieron transcribir.
   *
   * Mientras esto sea > 0, el texto en vivo —y la nota preliminar que sale de
   * él— están incompletos.
   */
  chunksFallidos: number
  /** Cuántos chunks han sido transcritos en vivo. */
  chunksTranscritos: number
  /**
   * Correcciones léxicas aplicadas a la transcripción final.
   * Cada una es { original, corregido, motivo } — el médico puede
   * revisarlas y revertirlas (documento legal: nada cambia en silencio).
   */
  correcciones: CambioTranscripcion[]
  /**
   * Cifras, unidades y siglas reescritas por el pipeline.
   *
   * Se calculaban desde siempre y no las devolvía nadie: el médico veía las
   * correcciones de fármacos y no las de **dosis**.
   */
  cambiosCifras: CambioVisible[]
  /**
   * Lo que el GUARDIÁN descartó, y las dosis que se quedaron sin cantidad.
   *
   * No son correcciones aplicadas: son correcciones que NO se aplicaron porque
   * tocaban una cifra, una unidad, una sigla crítica, una negación o el lado del
   * paciente. La pantalla debe pedirle al médico que revise esa parte.
   */
  alertasDictado: AlertaDictado[]
  iniciar: (opts?: OpcionesGrabacion) => Promise<void>
  detener: () => Promise<void>
  pausar: () => void
  reanudar: () => void
  reset: () => void
  setTranscripcion: (t: string) => void
  /** Verifica si hay audio sin transcribir guardado de una sesión previa. */
  hayRecovery: (recoveryKey: string) => Promise<boolean>
  /** Recupera el audio huérfano y lo manda a transcribir. */
  /**
   * Reintenta la transcripción del audio guardado.
   *
   * `ctx` lleva el vocabulario del paciente: sin él, la recuperación —que es
   * justo la consulta que ya falló— se transcribiría con el catálogo genérico.
   */
  recuperarAudio: (recoveryKey: string, ctx?: CtxDictado) => Promise<void>
  descargarAudioGuardado: (recoveryKey: string) => Promise<boolean>
  /** BORRA de IndexedDB el audio guardado de una clave (descartar recuperación). */
  descartarRecovery: (recoveryKey: string) => Promise<void>
}

const SILENCIO_MS = 15_000
const NIVEL_SILENCIO = 0.02
/**
 * A partir de aquí la señal está recortando.
 *
 * Una muestra a fondo de escala ya es recorte; se deja un pelo de margen para no
 * marcar un pico legítimo. NO es una cifra clínica: es el techo del formato.
 */
const UMBRAL_RECORTE = 0.99
/**
 * Un salto entre fotogramas mayor que esto significa que la pestaña estuvo
 * dormida, no que el micrófono se calló.
 */
const SALTO_SOSPECHOSO_MS = 2000
// 16 kHz mono · 64 kbps Opus. Es EXACTAMENTE lo que usa el ASR (remuestrea a 16 kHz)
// y AssemblyAI diariza perfecto a 16 kHz (es el estándar de voz/telefonía). Se
// volvió de 48k/128k a esto porque el archivo pesado (~2.5×) cruzaba el umbral de
// "audio grande" y en Safari (mp4) el troceado por partes fallaba → "no se pudo
// transcribir". Ligero = sube rápido, no hace timeout y no rompe la transcripción.
/**
 * A PARTIR DE AQUÍ EL AUDIO NO CABE EN EL CUERPO DE LA PETICIÓN.
 *
 * Vercel limita el cuerpo de una función a ~4,5 MB; se deja margen. Era un
 * número suelto dentro de `detener()`, y por eso `recuperarAudio` no lo miraba
 * y siempre tomaba el camino largo.
 *
 * Con BITRATE_OPUS = 64 kbps son 8 000 bytes por segundo, así que este umbral
 * se cruza a los **7 min 30 s** de grabación. Ése es el minuto exacto en el que
 * toda consulta cambiaba de camino — y el camino de destino estaba muerto por
 * una regla de Storage (REG-225).
 */
const LIMITE_CUERPO_BYTES = 3_600_000

const BITRATE_OPUS = 64_000
const SAMPLE_RATE_OBJETIVO = 16_000
const INTERVALO_CHUNK_DEFAULT_MS = 20_000
/**
 * Cada cuánto `MediaRecorder` entrega un trozo.
 *
 * Estaba como literal dentro de `rec.start(2000)`. Se nombra porque la
 * recuperación necesita **estimar la duración** de un audio que ya no tiene
 * reloj: tras recargar la página, el contador vale 0 y `esperaDiarizacion(0)`
 * concedía el mínimo — un minuto para un pase de quince.
 */
const TROZO_MS = 2000

// ─────────────────────────────────────────────────────────────────
// IndexedDB — almacén minimalista para crash recovery
// ─────────────────────────────────────────────────────────────────

const DB_NAME = 'nexusmed-recovery'
const STORE = 'audio_chunks'

function abrirDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: ['recoveryKey', 'idx'] })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function guardarChunk(recoveryKey: string, idx: number, blob: Blob) {
  try {
    const db = await abrirDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ recoveryKey, idx, blob, ts: Date.now() })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // IndexedDB puede fallar en modo privado — no es bloqueante
  }
}

async function leerChunks(recoveryKey: string): Promise<Blob[]> {
  try {
    const db = await abrirDB()
    const chunks: { idx: number; blob: Blob }[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const range = IDBKeyRange.bound([recoveryKey, 0], [recoveryKey, Number.MAX_SAFE_INTEGER])
      const req = tx.objectStore(STORE).getAll(range)
      req.onsuccess = () => resolve(req.result ?? [])
      req.onerror = () => reject(req.error)
    })
    db.close()
    return chunks.sort((a, b) => a.idx - b.idx).map(c => c.blob)
  } catch {
    return []
  }
}

async function borrarChunks(recoveryKey: string) {
  try {
    const db = await abrirDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const range = IDBKeyRange.bound([recoveryKey, 0], [recoveryKey, Number.MAX_SAFE_INTEGER])
      tx.objectStore(STORE).delete(range)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch { /* */ }
}

const sleepMs = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * POR QUÉ LA DIARIZACIÓN NO SE RINDE EN SILENCIO.
 *
 * Los cuatro caminos de fallo —sin llave, error del proveedor, red caída y
 * TIEMPO AGOTADO— devolvían el mismo `null`. El que llamaba no podía
 * distinguirlos, caía a Whisper sin separación de voces, y **al médico no se le
 * decía nada**. Una nota escrita con el motor de repuesto se ve exactamente
 * igual que una escrita con el bueno.
 *
 * Pasó en una consulta real: el paciente contó tres años de antecedentes
 * urológicos y la nota salió como «datos sociodemográficos», con una palabra
 * mal oída ascendida a diagnóstico. La llave de AssemblyAI estaba puesta y
 * pagada; lo que falló fue el reloj.
 */
export type MotivoSinDiarizacion = 'sin_llave' | 'error_proveedor' | 'tiempo_agotado' | 'red' | 'sin_texto'
  /** El audio subió pero no se pudo LEER su URL: permiso de Storage. */
  | 'sin_permiso_de_lectura'
  /** No se pudo ni subir el audio al almacenamiento. */
  | 'no_se_pudo_subir'

export interface ResultadoDiarizacion {
  ok: boolean
  text: string
  utterances: Utterance[]
  /** Por qué NO hubo separación de voces. Sólo cuando `ok` es false. */
  motivo?: MotivoSinDiarizacion
  /**
   * ── LA RUTA DEL AUDIO EN STORAGE (REG-249) ────────────────────────────────
   *
   * Se subía el audio, se sacaba su URL para dársela al motor de diarización, y
   * **se tiraba**. Nunca volvía aquí ni se guardaba con la nota — así que no
   * había nada que reproducir, por muy buenos que fueran los tiempos.
   *
   * Es la RUTA, no la URL de descarga. Una URL de Firebase Storage lleva un
   * token de acceso dentro; persistirla en Firestore sería dejar una llave
   * escrita en el expediente, y una llave que no caduca cuando cambian los
   * permisos. La URL se vuelve a pedir con `getDownloadURL` en el momento de
   * reproducir, que es cuando las reglas se evalúan de nuevo.
   */
  audioPath?: string
}

/**
 * CUÁNTO ESPERAR — proporcional al audio, no un tope fijo.
 *
 * Esperaba 90 × 2 s = **3 minutos** para cualquier grabación. AssemblyAI no
 * termina en tres minutos un audio de doce, así que toda consulta de duración
 * real agotaba el contador y se iba por el camino malo. El tope no protegía de
 * nada: garantizaba el fallo justo en las consultas que más importan.
 *
 * La transcripción tarda una fracción de la duración del audio. Se espera esa
 * fracción con un margen amplio, y nunca menos de un minuto ni más de quince —
 * un techo hace falta, pero tiene que estar donde no lo toque el uso normal.
 */
export function esperaDiarizacion(segundosAudio: number): { intentos: number; pausaMs: number } {
  const pausaMs = 2500
  /**
   * Techo de VEINTE minutos, no quince.
   *
   * Con quince, una primera consulta de 25 minutos ya se quedaba justa — lo
   * destapó una prueba de este mismo cambio. El techo existe para que un trabajo
   * colgado no deje al médico esperando indefinidamente, no para recortar
   * consultas largas, que son precisamente las que más información llevan.
   *
   * Y esperar no bloquea: la nota preliminar ya está en pantalla mientras tanto.
   */
  const presupuestoMs = Math.min(20 * 60_000, Math.max(60_000, segundosAudio * 1000 * 1.5 + 60_000))
  return { intentos: Math.ceil(presupuestoMs / pausaMs), pausaMs }
}



/**
 * Intenta transcribir CON diarización (AssemblyAI). Sube el audio, encola y
 * hace polling hasta completar. Devuelve texto + turnos de habla, o null si la
 * llave no está configurada o algo falla → el caller cae a OpenAI sin diarizar.
 */
/**
 * El contexto del paciente que se manda al MOTOR PRINCIPAL.
 *
 * Es el mismo `CtxDictado` que ya viajaba a la ruta de Whisper. Hasta la v981
 * este camino —el que de verdad corre— no recibía nada, así que el sesgo del
 * motor era una lista genérica igual para todos los pacientes.
 */
async function intentarDiarizar(
  blob: Blob, ext: string, segundosAudio: number, ctx: CtxDictado = {},
  /** Para nombrar el audio guardado igual que en el camino largo (REG-249). */
  recoveryKey = '',
): Promise<ResultadoDiarizacion> {
  const falla = (motivo: MotivoSinDiarizacion): ResultadoDiarizacion =>
    ({ ok: false, text: '', utterances: [], motivo })
  try {
    const fd = new FormData()
    fd.append('audio', blob, `consulta.${ext}`)
    /**
     * El vocabulario de ESTE paciente al motor que de verdad transcribe.
     *
     * `aprendidas` y `especialidades` se añadieron en la v1025: viajaban a las
     * rutas de Whisper —que aquí son el REPUESTO— y no a ésta, que es la que
     * corre. Es el mismo fallo de la v981 un nivel más arriba: el trabajo estaba
     * hecho y no llegaba al único sitio donde cambia lo que se OYE.
     */
    for (const [k, v] of [['medicamentos', ctx.medicamentos], ['problemas', ctx.problemas], ['alergias', ctx.alergias], ['aprendidas', ctx.aprendidas], ['especialidades', ctx.especialidades]] as const) {
      if (v && v.length > 0) fd.append(k, JSON.stringify([...v]))
    }
    const res = await fetchAutenticado('/api/expediente/transcribir-diarizado', { method: 'POST', body: fd })
    if (!res.ok) {
      // 503 con `sinClave` es «no hay llave»; cualquier otro código es el proveedor.
      const d = await res.json().catch(() => null)
      return falla(d?.sinClave ? 'sin_llave' : 'error_proveedor')
    }
    const sub = await res.json()
    if (!sub.ok || !sub.id) return falla('error_proveedor')

    const { intentos, pausaMs } = esperaDiarizacion(segundosAudio)
    for (let i = 0; i < intentos; i++) {
      await sleepMs(pausaMs)
      const p = await fetchAutenticado(`/api/expediente/transcribir-diarizado?id=${encodeURIComponent(sub.id)}`)
      if (!p.ok) continue
      const d = await p.json()
      if (d.status === 'completed') {
        const text = String(d.text ?? '')
        if (!text.trim()) return falla('sin_texto')
        /**
         * ── EL AUDIO CORTO TAMBIÉN SE GUARDA (REG-249) ────────────────────
         *
         * Este camino manda el audio como multipart y NUNCA lo subía a
         * Storage. Sin eso, «escuchar de dónde salió esta frase» sólo
         * funcionaría en las consultas largas — una función que aparece
         * pasados unos minutos y antes no, y que el médico no puede predecir.
         *
         * Se sube DESPUÉS de tener el texto y en un `try` propio: si la
         * subida falla, la transcripción ya está y no se pierde nada. Se
         * queda sin `audioPath`, que es exactamente lo que significa —no hay
         * audio que reproducir—, y no se inventa una ruta.
         */
        let audioPath: string | undefined
        try {
          audioPath = await guardarAudioDeLaConsulta(blob, ext, recoveryKey)
        } catch { /* Sin audio guardado; la nota y el dictado siguen intactos. */ }
        return { ok: true, text, utterances: (d.utterances ?? []) as Utterance[], audioPath }
      }
      if (d.status === 'error' || d.ok === false) return falla('error_proveedor')
    }
    return falla('tiempo_agotado')
  } catch {
    return falla('red')
  }
}

/**
 * Sube el audio de la consulta a Storage y devuelve su RUTA.
 *
 * ── POR QUÉ LA RUTA Y NO LA URL ─────────────────────────────────────────────
 *
 * `getDownloadURL` devuelve una URL con un token de acceso dentro. Guardarla en
 * Firestore sería dejar una llave escrita en el expediente — y una llave que
 * sigue sirviendo aunque después cambien las reglas o se revoque el acceso.
 *
 * Se guarda la ruta, y la URL se vuelve a pedir en el momento de reproducir:
 * ahí es donde las reglas se evalúan otra vez, con quien esté mirando en ese
 * momento.
 *
 * ── DÓNDE VIVE ──────────────────────────────────────────────────────────────
 *
 * Bajo `consultas-audio/{uid}/`, que es la carpeta que ya existía y cuya regla
 * de lectura se reparó en REG-2xx (`allow read: if request.auth.uid == uid`).
 * No se abre ningún sitio nuevo.
 */
async function guardarAudioDeLaConsulta(
  blob: Blob, ext: string, recoveryKey: string,
): Promise<string | undefined> {
  if (!storage || !auth.currentUser) return undefined
  /* Sin clave no se guarda: es una parte de un lote, no una consulta. */
  if (!recoveryKey) return undefined
  const uid = auth.currentUser.uid
  const path = `consultas-audio/${uid}/${(recoveryKey || 'tmp').replace(/[^\w-]/g, '_')}-${Date.now()}.${ext}`
  await uploadBytes(storageRef(storage, path), blob, { contentType: blob.type || 'audio/webm' })
  return path
}

/**
 * Diarización de audio LARGO: sube el audio a Firebase Storage (sin pasar por el
 * límite de 4.5MB de Vercel), manda la URL a AssemblyAI, hace polling y BORRA el
 * audio al terminar (no deja PHI). Devuelve texto + turnos, o null (→ fallback).
 */
async function intentarDiarizarLargo(
  blob: Blob, ext: string, recoveryKey: string, segundosAudio: number, ctx: CtxDictado = {},
): Promise<ResultadoDiarizacion> {
  const falla = (motivo: MotivoSinDiarizacion): ResultadoDiarizacion =>
    ({ ok: false, text: '', utterances: [], motivo })
  if (!storage || !auth.currentUser) return falla('error_proveedor')
  const uid = auth.currentUser.uid
  const path = `consultas-audio/${uid}/${(recoveryKey || 'tmp').replace(/[^\w-]/g, '_')}-${Date.now()}.${ext}`
  const objRef = storageRef(storage, path)
  let subido = false
  try {
    await uploadBytes(objRef, blob, { contentType: blob.type || 'audio/webm' })
    subido = true
    const url = await getDownloadURL(objRef)
    const res = await fetchAutenticado('/api/expediente/transcribir-diarizado', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      // Igual que el camino corto: sin esto, las consultas LARGAS —las que más
      // términos traen— se quedaban con el sesgo genérico.
      body: JSON.stringify({
        audioUrl: url,
        medicamentos: ctx.medicamentos ? [...ctx.medicamentos] : undefined,
        problemas: ctx.problemas ? [...ctx.problemas] : undefined,
        alergias: ctx.alergias ? [...ctx.alergias] : undefined,
        aprendidas: ctx.aprendidas ? [...ctx.aprendidas] : undefined,
        especialidades: ctx.especialidades ? [...ctx.especialidades] : undefined,
      }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      return falla(d?.sinClave ? 'sin_llave' : 'error_proveedor')
    }
    const sub = await res.json()
    if (!sub.ok || !sub.id) return falla('error_proveedor')
    // Polling más holgado (audio largo tarda más): hasta ~6 min
    // Mismo criterio que el camino corto: la espera la fija el AUDIO, no un tope.
    const { intentos, pausaMs } = esperaDiarizacion(segundosAudio)
    for (let i = 0; i < intentos; i++) {
      await sleepMs(pausaMs)
      const p = await fetchAutenticado(`/api/expediente/transcribir-diarizado?id=${encodeURIComponent(sub.id)}`)
      if (!p.ok) continue
      const d = await p.json()
      if (d.status === 'completed') {
        const text = String(d.text ?? '')
        if (!text.trim()) return falla('sin_texto')
        return { ok: true, text, utterances: (d.utterances ?? []) as Utterance[], audioPath: path }
      }
      if (d.status === 'error' || d.ok === false) return falla('error_proveedor')
    }
    return falla('tiempo_agotado')
  } catch (e) {
    /**
     * EL MOTIVO TIENE QUE SER EL DE VERDAD.
     *
     * Este `catch` decía «tiempo_agotado» pasara lo que pasara. Durante meses
     * lo que pasaba era un `storage/unauthorized` en `getDownloadURL()` —falta
     * de permiso, en el primer segundo— y el médico leía «se agotó el tiempo»,
     * así que buscaba el problema en su internet.
     *
     * Un motivo que miente cuesta doble: la avería, y las horas persiguiendo la
     * avería equivocada. Es una familia de defecto entera de este repositorio.
     */
    const codigo = String((e as { code?: string })?.code ?? '')
    if (codigo.startsWith('storage/')) return falla('sin_permiso_de_lectura')
    if (!subido) return falla('no_se_pudo_subir')
    return falla('tiempo_agotado')
  } finally {
    /**
     * Borra el audio de Storage (AssemblyAI ya lo descargó al encolar).
     *
     * Esto es lo PRIMERO y lo inmediato, pero no basta: vive en un `finally` del
     * navegador, así que sólo corre si la pestaña sigue abierta — y el sondeo de
     * arriba dura hasta seis minutos. Cerrarla, quedarse sin red o irse a otra
     * pantalla dejaba la conversación del paciente en el bucket.
     *
     * Aquí decía «lifecycle rule lo limpia». Una regla de ciclo de vida es
     * configuración del bucket, no código: nadie la había creado. Ahora la red
     * debajo es `api/cron/limpiar-audio`, que barre a diario lo que quedó
     * huérfano y no depende de ninguna pestaña.
     */
    if (subido) { try { await deleteObject(objRef) } catch { /* lo recoge el barrido diario */ } }
  }
}

// Guarda la causa REAL del último fallo de transcripción (para mostrarla en vez
// de un error genérico: sin saldo, llave faltante, audio muy grande, timeout…).
let motivoFalloTranscripcion = ''

/**
 * Transcribe un blob vía OpenAI. NUNCA lanza: ante 413/500/HTML devuelve ''.
 * (Antes, res.json() sobre una página de error HTML tiraba SyntaxError.)
 */
interface CtxDictado {
  /**
   * Segundos grabados, medidos por el propio grabador.
   *
   * Viaja al servidor SÓLO para el libro de costos: la transcripción se cobra
   * por minuto de audio y sin este dato el gasto de cada consulta dictada no
   * existía para el tablero. No decide nada clínico ni cobra al paciente.
   */
  duracionSeg?: number
  contexto?: string
  especialidades?: readonly string[]
  /**
   * Palabras que ESTE médico ya corrigió a mano más de una vez (LEARN).
   *
   * Van con lo del paciente, no al final: el presupuesto del sesgo es de 224
   * tokens y el orden ES la política.
   */
  aprendidas?: readonly string[]
  medicamentos?: readonly string[]
  problemas?: readonly string[]
  /**
   * Alérgenos del expediente.
   *
   * Sesgar hacia ellos importa más que hacia cualquier otro término: el cruce
   * alergia↔fármaco compara contra lo que se OYÓ, así que un alérgeno mal oído
   * es un cruce que nunca salta.
   */
  alergias?: readonly string[]
}

/** Añade el vocabulario del paciente al formulario, si lo hay. */
function anexarContexto(fd: FormData, c: CtxDictado): void {
  // Los minutos son lo que se cobra en transcripción: sin ellos el servidor no
  // puede asentar el costo del dictado.
  if (typeof c.duracionSeg === 'number' && c.duracionSeg > 0) fd.append('duracionSeg', String(Math.round(c.duracionSeg)))
  if (c.contexto) fd.append('contexto', c.contexto)
  for (const [k, v] of [['aprendidas', c.aprendidas], ['especialidades', c.especialidades], ['medicamentos', c.medicamentos], ['problemas', c.problemas]] as const) {
    if (v && v.length > 0) fd.append(k, JSON.stringify([...v]))
  }
}

async function transcribirBlobSimple(blob: Blob, ext: string, contexto: CtxDictado = {}): Promise<string> {
  try {
    const fd = new FormData()
    fd.append('audio', blob, `audio.${ext}`)
    anexarContexto(fd, contexto)
    const res = await fetchAutenticado('/api/expediente/transcribir', { method: 'POST', body: fd })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      // El servidor manda un `error` descriptivo (ej. "La API key de OpenAI es
      // inválida o expiró", "OpenAI no disponible temporalmente (HTTP 400)…").
      // Antes se ignoraba y solo salía "OpenAI HTTP 502" → causa invisible.
      let msgServidor = ''
      try { msgServidor = String(JSON.parse(body)?.error || '') } catch { /* body no-JSON */ }
      /**
       * EL MENSAJE DEL SERVIDOR VA PRIMERO, Y NO ES UN DETALLE DE ORDEN.
       *
       * Sólo el servidor sabe QUIÉN PAGA esa llamada, y de eso depende qué se le
       * puede decir al médico. Aquí se adivinaba por el cuerpo de la respuesta y
       * salían frases como «SIN SALDO en OpenAI, carga créditos» o «llave
       * inválida» a un médico cuyo plan usa la llave de la plataforma: ni es su
       * saldo, ni es su llave, ni puede hacer nada con esa información.
       *
       * El 413 sí se queda arriba: el audio demasiado grande es un hecho de este
       * lado, y el servidor ni siquiera llega a verlo.
       */
      motivoFalloTranscripcion =
        res.status === 413 ? 'audio demasiado grande para el servidor'
        : msgServidor ? msgServidor.slice(0, 140)   // ← causa REAL, con dueño correcto
        : /credit|balance|quota|insufficient|billing|saldo/i.test(body) ? 'el servicio de transcripción no está disponible ahora mismo'
        : res.status === 401 ? 'el servicio de transcripción rechazó la conexión'
        : res.status === 503 ? 'el servicio de transcripción no está configurado'
        : `el servicio de transcripción falló (HTTP ${res.status})`
      return ''                                     // 413 (límite Vercel) / 5xx / HTML → sin texto
    }
    const data = await res.json().catch(() => null)
    if (data?.ok && data.text) return data.text
    motivoFalloTranscripcion = data?.error ? String(data.error).slice(0, 100) : 'OpenAI devolvió respuesta vacía'
    return ''
  } catch (e) {
    motivoFalloTranscripcion = 'sin conexión / timeout: ' + String(e).slice(0, 50)
    return ''
  }
}

/**
 * Transcribe UN blob con el motor que esté configurado: primero OpenAI; si no
 * hay OPENAI_API_KEY (503) o falla, intenta AssemblyAI. Así basta con tener
 * UNA de las dos llaves. Nunca lanza.
 */
async function transcribirParte(blob: Blob, ext: string, contexto: CtxDictado = {}): Promise<string> {
  const openai = await transcribirBlobSimple(blob, ext, contexto)
  if (openai) return openai
  // Fallback: AssemblyAI (la misma llave que usa la diarización)
  /* Sin `recoveryKey` a propósito: esto es UNA PARTE de un lote, no la consulta
     entera. Guardar cada trozo dejaría N audios sueltos que no corresponden a
     ninguna nota y que nadie borraría nunca. */
  const aai = await intentarDiarizar(blob, ext, contexto.duracionSeg ?? 0, contexto)
  return aai.ok ? aai.text : ''
}

/**
 * Transcribe audio largo EN PARTES para no chocar con el límite de ~4.5MB de
 * Vercel en el body de la función. Agrupa los chunks en lotes < 3.6MB y, como
 * los fragmentos WebM posteriores no traen cabecera, antepone el primer chunk
 * (que SÍ la tiene) a cada lote para que el decodificador lo entienda.
 */
export interface ResultadoPorPartes { texto: string; lotesFallidos: number }

async function transcribirEnPartes(chunks: Blob[], mime: string, ext: string, contexto: CtxDictado = {}): Promise<ResultadoPorPartes> {
  if (chunks.length === 0) return { texto: '', lotesFallidos: 0 }
  const header = chunks[0]
  const LIMITE = 3_600_000
  const lotes: Blob[][] = []
  let actual: Blob[] = []
  let size = 0
  for (const c of chunks) {
    if (size + c.size > LIMITE && actual.length > 0) { lotes.push(actual); actual = []; size = 0 }
    actual.push(c); size += c.size
  }
  if (actual.length) lotes.push(actual)

  /**
   * UN LOTE QUE FALLA YA NO DESAPARECE SIN DEJAR RASTRO.
   *
   * Antes era `if (t) textos.push(t)`: si el lote 2 de 4 fallaba (un 429 o un 500
   * de OpenAI, o la red), su texto se descartaba, los otros tres se pegaban, y
   * como el resultado global no venía vacío el llamador borraba el audio de
   * IndexedDB — la única copia. El médico veía una transcripción fluida a la que
   * le faltaba el centro de la consulta, sin ninguna señal de que faltara algo.
   *
   * Toda grabación de más de ~7,5 min entra por aquí, así que no es un caso raro:
   * es cualquier consulta larga con la red inestable.
   *
   * Ahora se deja un marcador VISIBLE en la posición exacta del hueco y se cuenta
   * cuántos lotes fallaron, para que el llamador NO borre el audio.
   */
  const textos: string[] = []
  let lotesFallidos = 0
  for (let b = 0; b < lotes.length; b++) {
    const parts = b === 0 ? lotes[b] : [header, ...lotes[b]]
    const t = await transcribirParte(new Blob(parts, { type: mime }), ext, contexto)
    if (t) {
      /**
       * ── Y SE QUITA EL ECO DE LA CABECERA ────────────────────────────────────
       *
       * `header` no es sólo cabecera: es el PRIMER TROZO, con sus 2 segundos de
       * audio real dentro. Anteponerlo a cada lote —que hay que hacerlo, porque
       * los fragmentos posteriores no traen cabecera y ningún decodificador los
       * abre— hacía que las primeras palabras de la consulta se transcribieran
       * **una vez por lote**.
       *
       * En una consulta de 20 minutos troceada en cuatro, lo primero que dijo el
       * paciente aparecía CUATRO veces, intercalado donde no ocurrió. Y si esos
       * 2 segundos llevan una cifra o un fármaco, el modelo lee la misma
       * indicación repetida en momentos distintos de la consulta: eso no es
       * ruido, es una orden médica duplicada.
       *
       * El mismo recorte que la v979 puso en el camino en vivo. Sólo se quita lo
       * que de verdad coincide con el arranque del primer lote.
       */
      textos.push(b === 0 ? t : quitarEcoDeCabecera(t, textos[0] ?? ''))
    } else {
      lotesFallidos++
      textos.push(`\n[⚠ FALTA UN TRAMO DE LA GRABACIÓN — no se pudo transcribir. El audio se conservó para reintentar.]\n`)
    }
  }
  return { texto: textos.join(' '), lotesFallidos }
}


/**
 * Aplica el diccionario de correcciones de fármacos a CADA TURNO diarizado.
 *
 * Bug encontrado en la auditoría: el corrector solo se aplicaba al texto corrido.
 * Pero cuando hay separación de voces, lo que se le manda a la IA para redactar la
 * nota son los TURNOS, no el texto corrido — y los turnos iban sin corregir.
 *
 * Resultado: el médico veía "ceftriaxona" en pantalla (texto corrido, corregido) y
 * el modelo recibía "sefriaxona" (turno, crudo). El desajuste era invisible, y
 * ocurría justo en el camino que el médico considera el bueno. En el modo simple sí
 * se corregía.
 */
function corregirUtterances(us: Utterance[]): Utterance[] {
  /**
   * `palabras` se conserva SIN corregir, a propósito.
   *
   * El corrector trabaja sobre el texto corrido y no sabe reasignar el resultado
   * palabra por palabra. Corregir el texto y dejar las palabras como estaban es
   * lo correcto aquí: la confianza describe **lo que el motor oyó**, no lo que
   * el corrector escribió después. Si se sobrescribieran, la lista de «palabras
   * a verificar» señalaría términos que el médico ya no ve en pantalla.
   */
  return us.map(u => ({ ...u, text: procesarTranscript(u.text).texto }))
}

/**
 * La extensión que corresponde al contenedor REAL.
 *
 * Estaba repetida en tres sitios con variantes distintas, y en el trozo en vivo
 * ni siquiera se usaba: se mandaba `.webm` siempre. En Safari el contenedor es
 * mp4, así que el nombre le mentía al proveedor sobre lo que le llegaba.
 */
export function extDe(mime: string): string {
  const m = (mime || '').toLowerCase()
  return m.includes('mp4') ? 'm4a' : m.includes('ogg') ? 'ogg' : m.includes('wav') ? 'wav' : 'webm'
}

// ─────────────────────────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────────────────────────

export function useGrabacionAudio(): UseGrabacionAudio {
  const [soportado] = useState(() => typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined')
  const [estado, setEstado] = useState<Estado>('inactivo')
  const [duracion, setDuracion] = useState(0)
  /**
   * Espejo de `duracion` en una referencia, para el libro de costos.
   *
   * La subida ocurre dentro de un callback creado en un render anterior, así que
   * leer el estado ahí devuelve el valor congelado de ese render — típicamente 0
   * si el callback se creó al empezar a grabar. Un cero no se ve como un error:
   * se ve como una consulta que no costó nada. La referencia siempre trae el
   * último valor.
   */
  const duracionRef = useRef(0)
  /**
   * Cuántos segundos llevaba grabados el ÚLTIMO trozo que se mandó.
   *
   * La resta contra `duracionRef` da los segundos de audio del trozo actual, que
   * es lo que el libro de costos necesita: la transcripción se cobra por MINUTO.
   * Se calcula así, y no con el reloj de pared, porque `duracionRef` ya descuenta
   * las pausas — con el reloj, una pausa de tres minutos se facturaría como
   * audio que nunca se grabó ni se mandó.
   */
  const duracionUltimoTrozoRef = useRef(0)
  const [transcripcion, setTranscripcion] = useState('')
  const [utterances, setUtterances] = useState<Utterance[]>([])
  const [transcripcionParcial, setTranscripcionParcial] = useState('')
  const [error, setError] = useState('')
  const [nivelAudio, setNivelAudio] = useState(0)
  const [silencioProlongado, setSilencioProlongado] = useState(false)
  const [bytesGrabados, setBytesGrabados] = useState(0)
  /**
   * Por qué NO hubo separación de voces en esta grabación, o `null` si sí la hubo.
   *
   * Es el dato que faltaba: el fallback a Whisper era invisible, y una nota
   * escrita con el motor de repuesto se ve igual que una escrita con el bueno.
   */
  const [sinDiarizacion, setSinDiarizacion] = useState<MotivoSinDiarizacion | null>(null)
  /**
   * La ruta en Storage del audio de ESTA consulta (REG-249).
   *
   * `null` mientras no haya audio guardado — que es lo que significa: no hay
   * nada que reproducir. No se inventa una ruta ni se guarda una URL.
   */
  const [audioPath, setAudioPath] = useState<string | null>(null)
  const [chunksTranscritos, setChunksTranscritos] = useState(0)
  const [chunksFallidos, setChunksFallidos] = useState(0)
  /** Lo que el navegador concedió de verdad al abrir el micrófono. */
  const [captura, setCaptura] = useState<AjustesCaptura | null>(null)
  const [correcciones, setCorrecciones] = useState<CambioTranscripcion[]>([])
  /**
   * Cifras, unidades y siglas que el pipeline reescribió.
   *
   * Se calculaban en cada dictado y **no salían de aquí**. La regla que ya
   * estaba escrita para las correcciones léxicas vale igual: lo que el médico no
   * puede ver es una edición que alguien le hizo a su dictado sin decírselo.
   */
  const [cambiosCifras, setCambiosCifras] = useState<CambioVisible[]>([])
  const [alertasDictado, setAlertasDictado] = useState<AlertaDictado[]>([])

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])           // chunks recientes para flush
  const todosChunksRef = useRef<Blob[]>([])      // TODOS los chunks (blob final)
  /**
   * Trozos en vivo que el proveedor no pudo transcribir.
   *
   * Se cuenta y se enseña: un texto en vivo truncado se lee exactamente igual
   * que uno completo, y la nota preliminar sale de él.
   */
  const chunksFallidosRef = useRef(0)
  /**
   * Espejo de `silencioProlongado` en una referencia.
   *
   * El bucle del medidor se crea UNA vez y sigue corriendo; leer el estado ahí
   * devuelve el valor congelado del render en que se creó. Con el valor viejo,
   * la rama que apaga el aviso («volvió la voz») **nunca se ejecutaba**: una vez
   * que aparecía «Sin señal por +15s», se quedaba el resto de la grabación
   * aunque el médico estuviera hablando. Un aviso que miente es peor que
   * ninguno: enseña a ignorarlos.
   */
  const silencioRef = useRef(false)
  /**
   * Si la señal llegó a recortar (clipping).
   *
   * No se detectaba en absoluto, y es invisible por RMS: una señal recortada
   * tiene un RMS perfectamente normal y en cambio mete armónicos falsos en todo
   * el espectro. El medidor podía decir «captando bien» sobre audio saturado.
   */
  const [recorte, setRecorte] = useState(false)
  /**
   * MOTIVOS DE CONFIRMACIÓN — el gate que estaba escrito y no salía del hook.
   *
   * `pipeline.ts` los calcula en cada dictado desde la v746 y **ningún
   * consumidor los leía**: el hook ni siquiera los devolvía. Es la etapa que
   * decide cuándo hay que PREGUNTAR en vez de adivinar —negación incierta,
   * lateralidad, dosis o unidad ambigua, dos fármacos plausibles— y vivía
   * apagada.
   */
  const [motivosConfirmacion, setMotivosConfirmacion] = useState<string[]>([])
  /**
   * LO QUE EL MOTOR DIJO, ANTES DE QUE NADIE LO TOCARA.
   *
   * El pipeline devuelve `crudo` en cada llamada y **se descartaba en la misma
   * línea** en que se aplicaba el resultado. Después de eso, el único texto que
   * existía era el corregido — y el campo que la nota archiva como
   * «transcripción cruda» es ése, ya pasado por las cuatro etapas **y editable
   * por el médico**.
   *
   * O sea que el «material de origen» que queda en el expediente no es lo que el
   * motor oyó. Ante una discusión medicolegal, eso es justo lo que hace falta.
   *
   * La regla nº 5 del paquete del Dr. dice que el transcript crudo no se borra
   * nunca. Se cumplía dentro del pipeline y se rompía al salir de él.
   */
  const [transcripcionMotor, setTranscripcionMotor] = useState('')
  /**
   * Espejo de `utterances`. `aplicar` corre dentro de un callback creado en un
   * render anterior: leer el estado ahí devolvería el valor congelado — el mismo
   * defecto que ya obligó a espejar la duración para el libro de costos.
   */
  const utterancesRef = useRef<Utterance[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chunkFlushRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef<number>(0)
  const pausaTotalMsRef = useRef<number>(0)
  const pausaInicioRef = useRef<number>(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const ultimaSenalRef = useRef<number>(0)
  // Streaming
  const chunkIdxRef = useRef<number>(0)
  const textosChunksRef = useRef<string[]>([])
  const recoveryKeyRef = useRef<string>('')
  const contextoRef = useRef<CtxDictado>({})
  /** Ver `OpcionesGrabacion.modoDeHabla`. Por omisión se diariza. */
  const modoDeHablaRef = useRef<'conversacion' | 'dictado'>('conversacion')
  // Anti-pérdida: desde qué índice persistir en IndexedDB. Si ya hay audio de una
  // transcripción que FALLÓ bajo la misma llave, los chunks nuevos se guardan
  // DESPUÉS (no encima), para no borrar el audio que se prometió a salvo.
  const recoveryBaseRef = useRef<number>(0)
  const streamingActivoRef = useRef<boolean>(true)
  const mimeRef = useRef<string>('')

  const liberarRecursos = useCallback(() => {
    const rec = mediaRef.current
    if (rec && rec.state !== 'inactive') {
      /**
       * DESENGANCHAR el handler ANTES de parar — auditoría 2026-07 (P0). `stop()`
       * dispara un `ondataavailable` FINAL de forma asíncrona, y justo abajo se
       * resetea `todosChunksRef = []`. Ese último evento calculaba
       * `localIdx = recoveryBaseRef - 1` y PISABA un chunk válido del respaldo en
       * IndexedDB (o escribía en idx -1), corrompiendo el audio de recuperación al
       * salir de la consulta grabando. Los chunks ya persistidos quedan intactos;
       * solo se descarta el buffer final (~2 s), que es el intercambio correcto.
       */
      try { rec.ondataavailable = null } catch { /* */ }
      try { rec.stop() } catch { /* */ }
    }
    mediaRef.current = null

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => { try { t.stop() } catch { /* */ } })
      streamRef.current = null
    }

    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (chunkFlushRef.current) { clearInterval(chunkFlushRef.current); chunkFlushRef.current = null }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }

    if (audioCtxRef.current) {
      try { audioCtxRef.current.close() } catch { /* */ }
      audioCtxRef.current = null
    }
    analyserRef.current = null

    chunksRef.current = []
    todosChunksRef.current = []
    chunksFallidosRef.current = 0; setChunksFallidos(0)
    silencioRef.current = false; setSilencioProlongado(false); setRecorte(false); setMotivosConfirmacion([])
    setTranscripcionMotor('')
    pausaTotalMsRef.current = 0
    pausaInicioRef.current = 0
    chunkIdxRef.current = 0
    textosChunksRef.current = []
    setNivelAudio(0)
    setSilencioProlongado(false)
    setBytesGrabados(0)
    setChunksTranscritos(0)
    setTranscripcionParcial('')
    setUtterances([]); utterancesRef.current = []
  }, [])

  const reset = useCallback(() => {
    const rk = recoveryKeyRef.current
    liberarRecursos()
    setEstado('inactivo'); duracionRef.current = 0; duracionUltimoTrozoRef.current = 0; setDuracion(0); setTranscripcion(''); setError('')
    setCorrecciones([]); setCambiosCifras([]); setUtterances([]); utterancesRef.current = []; setAlertasDictado([])
    /* Al reiniciar no queda audio de esta consulta que reproducir (REG-249). */
    setAudioPath(null)
    if (rk) borrarChunks(rk)
    recoveryKeyRef.current = ''
  }, [liberarRecursos])

  useEffect(() => () => { liberarRecursos() }, [liberarRecursos])

  // Función: flushea chunks acumulados al endpoint de streaming
  const flushChunks = useCallback(async () => {
    if (!streamingActivoRef.current) return
    if (chunksRef.current.length === 0) return
    const idx = chunkIdxRef.current++
    /**
     * LA CABECERA VA EN TODOS LOS TROZOS, NO SÓLO EN EL PRIMERO.
     *
     * `MediaRecorder` pone la cabecera del contenedor (EBML/moov) SÓLO en el
     * primer fragmento. Este bloque construía el blob con los fragmentos
     * acumulados desde el flush anterior, así que del segundo en adelante
     * mandaba datos sueltos que ningún decodificador abre: el proveedor
     * respondía error y `if (!res.ok) return` lo tragaba en silencio.
     *
     * Consecuencia real: la transcripción EN VIVO se congelaba a los ~20
     * segundos, la nota preliminar se armaba con el primer trozo de la consulta,
     * y el último recurso —cuando la transcripción final falla— entregaba esos
     * 20 segundos presentados como la consulta entera.
     *
     * El otro camino (`transcribirEnPartes`) ya compensaba esto y lo explicaba
     * en su comentario. Aquí no se hizo nunca.
     */
    const cabecera = todosChunksRef.current[0]
    const partes = idx === 0 || !cabecera ? chunksRef.current : [cabecera, ...chunksRef.current]
    const blob = new Blob(partes, { type: mimeRef.current })
    /**
     * ── EL ÚLTIMO TROZO SE QUEDA PARA EL ENVÍO SIGUIENTE ──────────────────────
     *
     * El corte cada 20 segundos era **limpio**: sin un solo segundo de solape.
     * Una palabra a caballo de la frontera se partía y cada mitad se
     * decodificaba sin la otra.
     *
     * En una consulta eso no queda «mal escrito», queda **cambiado**: «ciento…
     * veinte» partido por la mitad produce **otro número**. El contexto previo
     * que ya se mandaba sesga al modelo, pero no puede reconstruir media palabra
     * que no está en el audio.
     *
     * Conservar el último trozo hace que dos envíos consecutivos compartan esos
     * segundos. La costura se quita después, sobre el texto.
     */
    const ultimo = chunksRef.current[chunksRef.current.length - 1]
    chunksRef.current = ultimo ? [ultimo] : []
    if (blob.size < 1024) return  // skip muy pequeños

    // Contexto previo (últimas ~30 palabras del último chunk transcrito)
    const prevContext = textosChunksRef.current.length
      ? textosChunksRef.current[textosChunksRef.current.length - 1].split(/\s+/).slice(-30).join(' ')
      : ''

    try {
      const fd = new FormData()
      // La extensión sigue al mime REAL: en Safari esto es mp4, y llamarlo
      // `.webm` le miente al proveedor sobre lo que le está llegando.
      fd.append('audio', blob, `chunk-${idx}.${extDe(mimeRef.current)}`)
      fd.append('chunkIdx', String(idx))
      /**
       * Los segundos de audio de este trozo, sólo para el libro de costos.
       *
       * El servidor no puede deducirlos: recibe un blob de webm, no una duración.
       * Y sin ellos no hay costo que calcular — esta ruta se dispara cada ~20 s
       * de cada consulta y era el gasto de IA más frecuente y más invisible de
       * toda la aplicación.
       */
      const segTrozo = Math.max(0, duracionRef.current - duracionUltimoTrozoRef.current)
      duracionUltimoTrozoRef.current = duracionRef.current
      if (segTrozo > 0) fd.append('duracionSeg', String(Math.round(segTrozo)))
      if (prevContext) fd.append('prevContext', prevContext)
      // El módulo, para que el texto en vivo use el MISMO vocabulario que el
      // final: en UCI se estaba sesgando con el catálogo de consultorio.
      if (contextoRef.current.contexto) fd.append('contexto', contextoRef.current.contexto)
      // Y el vocabulario del paciente: el texto en vivo alimenta la nota
      // preliminar y es el último recurso si la transcripción final falla.
      for (const [k, v] of [
        ['aprendidas', contextoRef.current.aprendidas],
        ['especialidades', contextoRef.current.especialidades],
        ['medicamentos', contextoRef.current.medicamentos],
        ['problemas', contextoRef.current.problemas],
      ] as const) {
        if (v && v.length > 0) fd.append(k, JSON.stringify([...v]))
      }
      const res = await fetchAutenticado('/api/expediente/transcribir-chunk', { method: 'POST', body: fd })
      if (!res.ok) {
        // Un trozo perdido deja de ser invisible: el contador se ve en pantalla
        // y evita que un texto truncado se lea como la consulta completa.
        chunksFallidosRef.current++
        setChunksFallidos(chunksFallidosRef.current)
        return                                         // 413/5xx/HTML → no parsear (evita SyntaxError)
      }
      const data = await res.json().catch(() => null)
      if (data?.ok && data.text) {
        // Corrección léxica médica TAMBIÉN en chunks — el médico ve los
        // fármacos bien escritos EN VIVO, no solo al final
        // En el parcial en vivo se aplica el pipeline entero: si el médico ve
        // «500 mg» mientras habla, ve lo mismo que va a quedar en la nota. Con
        // sólo la corrección léxica veía «quinientos miligramos» y luego el
        // texto le cambiaba al cerrar, que parece un error de la aplicación.
        /**
         * Y SE QUITA EL ECO DE LA CABECERA.
         *
         * Esa cabecera no es sólo cabecera: son 2 segundos de audio real. Sin
         * quitar su transcripción, las primeras palabras de la consulta
         * aparecerían al principio de CADA trozo — y si llevan una cifra o un
         * fármaco, el modelo leería la misma indicación repetida por toda la
         * consulta. Sólo se recorta lo que de verdad coincide.
         */
        const bruto = procesarTranscript(data.text).texto
        /**
         * DOS ECOS, EN ESTE ORDEN.
         *
         * 1. El de la **cabecera**, que son los 2 segundos del primer trozo
         *    antepuestos para que el contenedor se pueda abrir.
         * 2. El del **solape** con el envío anterior, que es el que evita que una
         *    palabra se parta en la frontera.
         *
         * Primero el de cabecera porque va delante del todo; lo que quede
         * empezando el texto es entonces el solape.
         */
        const sinCabecera = idx === 0
          ? bruto
          : quitarEcoDeCabecera(bruto, textosChunksRef.current[0] ?? '')
        textosChunksRef.current[idx] = idx === 0
          ? sinCabecera
          : quitarSolapeConAnterior(sinCabecera, textosChunksRef.current[idx - 1] ?? '')
        // Reconstruir transcripción parcial en orden
        const completa = textosChunksRef.current.filter(Boolean).join(' ')
        setTranscripcionParcial(completa)
        setChunksTranscritos(c => c + 1)
      }
    } catch {
      // Falla de red — el chunk queda solo en el blob final. No reintentar
      // (al detener se reusa el blob completo)
    }
  }, [])

  /**
   * EL MEDIDOR, EN UN SOLO SITIO.
   *
   * Estaba duplicado —una copia en `iniciar` y otra en `reanudar`— y las dos
   * copias ya habían divergido: la de reanudar no traía la detección de
   * silencio, así que después de una pausa el aviso de micrófono quedaba muerto.
   *
   * Y la de `iniciar` leía el estado desde su closure, así que la rama que
   * APAGA el aviso nunca corría: una vez encendido, se quedaba encendido.
   */
  const arrancarMedidor = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return
    const buffer = new Float32Array(analyser.fftSize)
    let ultimoFrame = Date.now()

    const tick = () => {
      if (!analyserRef.current) return
      analyserRef.current.getFloatTimeDomainData(buffer)
      let sumSq = 0
      let pico = 0
      for (let i = 0; i < buffer.length; i++) {
        sumSq += buffer[i] * buffer[i]
        const abs = Math.abs(buffer[i])
        if (abs > pico) pico = abs
      }
      const rms = Math.sqrt(sumSq / buffer.length)
      setNivelAudio(Math.min(1, rms / 0.3))
      // Recorte: el RMS no lo ve. Se mira el pico.
      setRecorte(pico >= UMBRAL_RECORTE)

      const ahora = Date.now()
      /**
       * SI LA PESTAÑA ESTUVO DORMIDA, NO SE INVENTA UN SILENCIO.
       *
       * `requestAnimationFrame` se congela en segundo plano. Al volver, la
       * diferencia contra la última señal supera de golpe los 15 s y disparaba
       * un «sin señal» falso sobre una grabación que iba perfecta. Un salto
       * anómalo entre fotogramas es la firma de eso, y lo correcto es
       * **reanclar el reloj**, no acusar al micrófono.
       */
      if (ahora - ultimoFrame > SALTO_SOSPECHOSO_MS) ultimaSenalRef.current = ahora
      ultimoFrame = ahora

      if (rms > NIVEL_SILENCIO) {
        ultimaSenalRef.current = ahora
        if (silencioRef.current) { silencioRef.current = false; setSilencioProlongado(false) }
      } else if (ahora - ultimaSenalRef.current > SILENCIO_MS) {
        if (!silencioRef.current) { silencioRef.current = true; setSilencioProlongado(true) }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const iniciar = useCallback(async (opts?: OpcionesGrabacion) => {
    if (!soportado) { setError('Tu navegador no soporta grabación de audio'); setEstado('error'); return }
    streamingActivoRef.current = opts?.streaming !== false
    recoveryKeyRef.current = opts?.recoveryKey ?? ''
    modoDeHablaRef.current = opts?.modoDeHabla ?? 'conversacion'
    contextoRef.current = {
      contexto: opts?.contexto,
      especialidades: opts?.especialidades,
      aprendidas: opts?.aprendidas,
      medicamentos: opts?.medicamentos,
      problemas: opts?.problemas,
      alergias: opts?.alergias,
    }
    // Si ya hay chunks bajo esta llave (p. ej. audio de una transcripción que
    // falló y NO se ha recuperado), NO los pises: continúa el índice DESPUÉS de
    // ellos. En éxito, borrarChunks limpia todo y la próxima grabación arranca en 0.
    recoveryBaseRef.current = 0
    if (recoveryKeyRef.current) {
      try { recoveryBaseRef.current = (await leerChunks(recoveryKeyRef.current)).length } catch { recoveryBaseRef.current = 0 }
    }
    const intervaloMs = opts?.intervaloChunkMs ?? INTERVALO_CHUNK_DEFAULT_MS

    try {
      /**
       * ── EL PROCESAMIENTO DEL NAVEGADOR VIENE APAGADO POR OMISIÓN ─────────────
       *
       * Hasta la v980 los tres venían `?? true`. La consulta los apagaba a mano,
       * pero **UCI y el banco de voz no pasaban nada**, así que grababan con
       * supresión de ruido y cancelación de eco ENCENDIDAS — que es justo lo que
       * los cuatro proveedores de reconocimiento desaconsejan.
       *
       * El motivo es físico: la supresión de ruido decide, banda por banda, qué
       * energía es voz y qué es ruido, y atenúa el resto. Las consonantes
       * fricativas (/s/, /f/) son, espectralmente, ruido de banda ancha y poca
       * energía: indistinguibles del ruido para ese estimador. Lo que se pierde
       * es exactamente lo que separa «seis» de «diez» y «mg» de «mL».
       *
       * Nadie decidió que UCI grabara así: fue un valor por omisión heredado. Y
       * el banco de voz, que es con lo que se mide la calidad, **medía en
       * condiciones distintas a las de la consulta real** — una medición que no
       * describe el camino que usa el médico.
       *
       * Ahora quien quiera procesamiento lo pide. La consulta no cambia: ya los
       * pasaba explícitos, incluido `autoGainControl: true`, que ahí sí compensa
       * un problema real (el paciente está a dos metros del micrófono). En el
       * dictado de UCI, con el aparato cerca de la boca, sólo puede restar.
       */
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: opts?.echoCancellation ?? false,
          noiseSuppression: opts?.noiseSuppression ?? false,
          autoGainControl: opts?.autoGainControl ?? false,
          sampleRate: SAMPLE_RATE_OBJETIVO,
          channelCount: 1,
        },
      })
      /**
       * ── LO QUE EL NAVEGADOR CONCEDIÓ DE VERDAD ──────────────────────────────
       *
       * `sampleRate` en `getUserMedia` es una constraint de disponibilidad
       * limitada: si el navegador no la soporta, **se ignora en silencio**. La
       * app llevaba enseñando en pantalla «16kHz» como un hecho, sin haberlo
       * comprobado nunca — y de esa cifra depende si el bitrate actual sobra o
       * falta.
       *
       * Se lee y se guarda. No cambia nada del audio: cambia que dejemos de
       * afirmar lo que no sabemos.
       */
      streamRef.current = stream
      try {
        const pista = stream.getAudioTracks()[0]
        const aj = pista?.getSettings?.() ?? {}
        setCaptura({
          sampleRate: typeof aj.sampleRate === 'number' ? aj.sampleRate : null,
          canales: typeof aj.channelCount === 'number' ? aj.channelCount : null,
          microfono: pista?.label || '',
          supresionRuido: aj.noiseSuppression === true,
          cancelacionEco: aj.echoCancellation === true,
          gananciaAutomatica: aj.autoGainControl === true,
        })
      } catch { /* leer los ajustes NUNCA puede impedir grabar */ }
      chunksRef.current = []
      todosChunksRef.current = []
    chunksFallidosRef.current = 0; setChunksFallidos(0)
      chunkIdxRef.current = 0
      textosChunksRef.current = []
      // Limpia la diarización del tramo anterior: la separación de voces es POR
      // blob y el blob nuevo solo trae este tramo. Si no se limpia, quedaban los
      // turnos del tramo 1 y, al no diarizar el tramo 2, la nota se armaba con el
      // tramo viejo ignorando el nuevo. (El texto completo multi-tramo se conserva
      // aparte en la transcripción; ver conBase/baseTranscripcionRef.)
      setUtterances([]); utterancesRef.current = []

      // AnalyserNode → medidor de nivel + detección de silencio
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        // Sin forzar sampleRate: usar la nativa del dispositivo evita un remuestreo
        // que en algunos equipos causaba cortes/trabas en la grabación.
        const ctx = new Ctx()
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        analyser.smoothingTimeConstant = 0.8
        source.connect(analyser)
        audioCtxRef.current = ctx
        analyserRef.current = analyser
        ultimaSenalRef.current = Date.now()

        arrancarMedidor()
      } catch { /* sin medidor */ }

      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        '',
      ]
      let mime = ''
      for (const m of candidates) {
        if (m === '' || (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m))) {
          mime = m; break
        }
      }
      mimeRef.current = mime

      const recOpts: MediaRecorderOptions = mime
        ? { mimeType: mime, audioBitsPerSecond: BITRATE_OPUS }
        : { audioBitsPerSecond: BITRATE_OPUS }
      const rec = new MediaRecorder(stream, recOpts)
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
          todosChunksRef.current.push(e.data)
          setBytesGrabados(prev => prev + e.data.size)
          // Persistir en IndexedDB para crash recovery
          if (recoveryKeyRef.current) {
            const localIdx = recoveryBaseRef.current + todosChunksRef.current.length - 1
            guardarChunk(recoveryKeyRef.current, localIdx, e.data)
          }
        }
      }
      rec.onerror = () => {
        liberarRecursos()
        setError('Error en la grabación de audio')
        setEstado('error')
      }
      rec.start(TROZO_MS)
      mediaRef.current = rec
      startRef.current = Date.now()
      pausaTotalMsRef.current = 0
      timerRef.current = setInterval(() => {
        const transcurrido = Date.now() - startRef.current - pausaTotalMsRef.current
        { const seg = Math.floor(transcurrido / 1000); duracionRef.current = seg; setDuracion(seg) }
      }, 500)

      // Streaming: flush periódico al endpoint
      if (streamingActivoRef.current) {
        chunkFlushRef.current = setInterval(flushChunks, intervaloMs)
      }

      setEstado('grabando')
      setError('')
    } catch (e) {
      liberarRecursos()
      const err = e as Error
      if (err.name === 'NotAllowedError' || err.message.includes('denied')) {
        setError('Permiso de micrófono denegado. Permítelo en los ajustes del navegador.')
      } else if (err.name === 'NotFoundError') {
        setError('No se detectó micrófono en este dispositivo.')
      } else {
        setError('No se pudo iniciar la grabación: ' + err.message)
      }
      setEstado('error')
    }
  }, [soportado, liberarRecursos, flushChunks, arrancarMedidor])

  const pausar = useCallback(() => {
    const rec = mediaRef.current
    if (!rec || rec.state !== 'recording') return
    try {
      rec.pause()
      pausaInicioRef.current = Date.now()
      // Pausar timer + analyser + flush
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      if (chunkFlushRef.current) { clearInterval(chunkFlushRef.current); chunkFlushRef.current = null }
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      setEstado('pausado')
    } catch { /* */ }
  }, [])

  const reanudar = useCallback(() => {
    const rec = mediaRef.current
    if (!rec || rec.state !== 'paused') return
    try {
      rec.resume()
      pausaTotalMsRef.current += Date.now() - pausaInicioRef.current
      pausaInicioRef.current = 0
      timerRef.current = setInterval(() => {
        const transcurrido = Date.now() - startRef.current - pausaTotalMsRef.current
        { const seg = Math.floor(transcurrido / 1000); duracionRef.current = seg; setDuracion(seg) }
      }, 500)
      if (streamingActivoRef.current) {
        chunkFlushRef.current = setInterval(flushChunks, INTERVALO_CHUNK_DEFAULT_MS)
      }
      /**
       * Reanudar el medidor con EL MISMO bucle.
       *
       * Antes había aquí una copia que **no traía la detección de silencio**:
       * tras una pausa, el aviso de micrófono quedaba muerto para el resto de la
       * grabación. Dos copias de la misma lógica divergen siempre; ahora es una.
       */
      if (audioCtxRef.current && analyserRef.current) arrancarMedidor()
      setEstado('grabando')
    } catch { /* */ }
  }, [flushChunks, arrancarMedidor])

  const detener = useCallback(async () => {
    const rec = mediaRef.current
    if (!rec) return
    setEstado('subiendo')

    await new Promise<void>(resolve => {
      rec.onstop = () => resolve()
      try { rec.stop() } catch { resolve() }
    })

    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    if (chunkFlushRef.current) clearInterval(chunkFlushRef.current)
    chunkFlushRef.current = null
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close() } catch { /* */ }
      audioCtxRef.current = null
    }
    analyserRef.current = null
    mediaRef.current = null

    // Flush final del último chunk pendiente (mejora la cobertura del streaming)
    if (streamingActivoRef.current && chunksRef.current.length > 0) {
      await flushChunks()
    }

    const allChunks = todosChunksRef.current.slice()  // copia ANTES de limpiar (para transcribir en partes)
    const blob = new Blob(allChunks, { type: rec.mimeType })
    chunksRef.current = []
    todosChunksRef.current = []
    chunksFallidosRef.current = 0; setChunksFallidos(0)
    if (blob.size === 0) { setEstado('error'); setError('Audio vacío'); return }

    const mt = rec.mimeType || ''
    const ext = extDe(mt)

    const aplicar = (texto: string) => {
      const r = procesarTranscript(texto)
      setTranscripcion(r.texto)
      setCorrecciones(r.cambiosLexicos)
      setCambiosCifras(cambiosVisibles(r.cambiosNormalizacion, r.cambiosSiglas))
      // El pipeline ya trae las alertas de las nueve etapas, no sólo las del
      // guardián: incluye lo que pide confirmación por ambigüedad.
      setAlertasDictado(r.alertas)
      // El gate de ambigüedad ya no muere aquí.
      /**
       * Y EL SEXTO MOTIVO, que el pipeline no puede emitir.
       *
       * `confianza_baja_con_termino_critico` está declarado desde siempre y no
       * lo emitía nadie: el pipeline trabaja sobre texto y no ve las confianzas
       * por palabra, que viven en `Utterance.palabras`. Aquí sí están.
       */
      const dudaCritica = dudaEnZonaCritica(utterancesRef.current, UNIDADES_CANONICAS)
      setMotivosConfirmacion(dudaCritica ? [...r.motivos, 'confianza_baja_con_termino_critico'] : r.motivos)
      setTranscripcionMotor(r.crudo)
      setEstado('listo')
    }

    motivoFalloTranscripcion = ''  // limpia causa previa
    const GRANDE = blob.size > LIMITE_CUERPO_BYTES

    /**
     * ── UN DICTADO NO NECESITA SEPARACIÓN DE VOCES ──────────────────────────
     *
     * En UCI y en hospital el médico dicta SOLO —lo contestó él—. Pedir la
     * separación ahí es trabajo, dinero y espera para nada, y el diarizador
     * puede partirlo en dos hablantes y atribuir su propio dictado a un
     * «paciente» que nunca habló.
     *
     * El `sinDiarizacion` se deja en `null` a propósito: **no es un fallo**, es
     * que no hacía falta. Poner un motivo aquí le enseñaría al médico un aviso
     * de algo que salió bien.
     */
    if (modoDeHablaRef.current === 'dictado') {
      const texto = GRANDE
        ? (await transcribirEnPartes(allChunks, rec.mimeType, ext, { ...contextoRef.current, duracionSeg: duracionRef.current })).texto
        : await transcribirBlobSimple(blob, ext, { ...contextoRef.current, duracionSeg: duracionRef.current })
      if (texto.trim()) {
        setUtterances([]); utterancesRef.current = []
        aplicar(texto)
        if (recoveryKeyRef.current) await borrarChunks(recoveryKeyRef.current)
        return
      }
      // Sin texto: cae al camino de siempre, que ya sabe usar el respaldo en vivo.
    }

    // 1) Diarización (separa voces): audio corto pasa directo; audio LARGO sube a
    //    Storage y se diariza por URL (sin chocar con el límite de Vercel).
    const diar = GRANDE
      ? await intentarDiarizarLargo(blob, ext, recoveryKeyRef.current, duracionRef.current, contextoRef.current)
      : await intentarDiarizar(blob, ext, duracionRef.current, contextoRef.current, recoveryKeyRef.current)
    if (diar.audioPath) setAudioPath(diar.audioPath)
    if (diar.ok && diar.text.trim()) {
      { const us = corregirUtterances(diar.utterances); setUtterances(us); utterancesRef.current = us }
      aplicar(diar.text)
      setSinDiarizacion(null)
      if (recoveryKeyRef.current) await borrarChunks(recoveryKeyRef.current)
      return
    }
    /**
     * NO HUBO SEPARACIÓN DE VOCES, Y SE DICE.
     *
     * La transcripción sigue —se cae a Whisper, que es lo correcto: mejor una
     * nota sin turnos que ninguna—. Lo que no puede pasar es que el médico no
     * lo sepa: una nota escrita con el motor de repuesto se ve idéntica a una
     * escrita con el bueno, y ahí es donde una palabra mal oída se convierte en
     * un diagnóstico sin que nadie sospeche.
     */
    setSinDiarizacion(diar.motivo ?? 'error_proveedor')

    // 2) Transcripción robusta (en partes si es grande). Nunca lanza.
    /**
     * Los segundos grabados viajan con el contexto SÓLO para el libro de costos.
     *
     * Se leen de `duracionRef` y no del estado: en el momento de subir, el
     * componente puede haberse desmontado y el estado quedaría en su valor
     * inicial — el gasto se anotaría como cero, que es peor que no anotarlo.
     */
    const ctxConDuracion: CtxDictado = { ...contextoRef.current, duracionSeg: duracionRef.current }
    const porPartes = GRANDE
      ? await transcribirEnPartes(allChunks, rec.mimeType, ext, ctxConDuracion)
      : { texto: await transcribirBlobSimple(blob, ext, ctxConDuracion), lotesFallidos: 0 }
    const texto = porPartes.texto

    /**
     * ── UN TEXTO HECHO SÓLO DE ADVERTENCIAS NO ES UN TEXTO ────────────────────
     *
     * `texto.trim()` era verdadero **aunque TODOS los lotes hubieran fallado**,
     * porque los marcadores `[⚠ FALTA UN TRAMO DE LA GRABACIÓN…]` son texto. Así
     * que el respaldo de abajo —la transcripción en vivo, que sí existía y que
     * el médico estaba viendo en pantalla— era inalcanzable.
     *
     * El médico acababa con una «nota» hecha de advertencias, y con lo bueno
     * descartado. Justo cuando ya había ido mal una vez.
     *
     * La misma cuenta que hizo falta para no borrar el audio (`lotesFallidos`)
     * servía para esto y no se usaba.
     */
    const todoFalló = porPartes.lotesFallidos > 0 && !porPartes.texto
      .replace(/\[⚠[^\]]*\]/g, '').trim()

    if (texto.trim() && !todoFalló) {
      aplicar(texto)
      // Solo se borra el audio si NO faltó ningún tramo. Si algo se perdió, el
      // audio es lo único que permite recuperarlo: se conserva.
      if (recoveryKeyRef.current && porPartes.lotesFallidos === 0) await borrarChunks(recoveryKeyRef.current)
      return
    }

    // 3) Si la transcripción final no dio texto, usa lo que capturó el streaming
    //    en vivo. NO borramos el audio guardado: queda para reintentar (recovery).
    if (textosChunksRef.current.length > 0) {
      aplicar(textosChunksRef.current.filter(Boolean).join(' '))
      return
    }

    setError(`No se pudo transcribir${motivoFalloTranscripcion ? ` (${motivoFalloTranscripcion})` : ''}. El audio quedó GUARDADO en este dispositivo — reintenta con "Recuperar audio".`)
    setEstado('error')
  }, [flushChunks])

  // ─── Recovery API ──────────────────────────────────────────
  const hayRecovery = useCallback(async (recoveryKey: string): Promise<boolean> => {
    const chunks = await leerChunks(recoveryKey)
    return chunks.length > 0
  }, [])

  /**
   * Descarta el audio de recuperación BORRÁNDOLO de IndexedDB.
   *
   * EL BUG QUE CIERRA: el botón "Descartar audio guardado" llamaba a `reset()`,
   * que solo borra de IndexedDB la clave de la sesión ACTUAL
   * (`recoveryKeyRef.current`). Pero al recargar la página y encontrar audio
   * huérfano, esa ref está vacía —no se ha grabado nada en esta sesión— así que
   * no se borraba nada y el audio reaparecía en cada recarga. Aquí se borra por
   * clave explícita, que es la que sí apunta al audio guardado.
   */
  const descartarRecovery = useCallback(async (recoveryKey: string) => {
    await borrarChunks(recoveryKey)
  }, [])

  const recuperarAudio = useCallback(async (recoveryKey: string, ctx: CtxDictado = {}) => {
    setEstado('subiendo')
    const chunks = await leerChunks(recoveryKey)
    if (chunks.length === 0) {
      setError('No hay audio guardado para recuperar')
      setEstado('error')
      return
    }
    const mime = chunks[0].type || 'audio/webm'
    const ext = extDe(mime)
    motivoFalloTranscripcion = ''

    // 1) Mejor opción: audio COMPLETO vía Storage → AssemblyAI (diariza y evita el
    //    troceado frágil). Si Storage no está habilitado, devuelve null.
    /**
     * LA DURACIÓN SE ESTIMA DE LOS TROZOS, NO DEL RELOJ.
     *
     * Tras recargar la página —el escenario NORMAL de una recuperación— el
     * contador vale 0, y `esperaDiarizacion(0)` concede el mínimo: **un minuto**.
     * O sea que todo audio recuperado de más de un minuto de proceso se rendía y
     * caía al camino troceado, perdiendo la separación de voces. Y la consulta
     * que se recupera es, por definición, la que ya falló una vez.
     *
     * Cada trozo son `TROZO_MS`, así que el número de trozos ES la duración. No
     * es una estimación fina: es la que el propio grabador impone.
     */
    const segundosEstimados = duracionRef.current > 0
      ? duracionRef.current
      : Math.round((chunks.length * TROZO_MS) / 1000)

    const blob = new Blob(chunks, { type: mime })
    /**
     * ── LA RECUPERACIÓN ELIGE CAMINO POR TAMAÑO, COMO `detener()` ─────────────
     *
     * Llamaba SIEMPRE a `intentarDiarizarLargo`, mirara o no el tamaño. Para un
     * audio de dos minutos eso significa subirlo a Storage y pedir su URL sin
     * ninguna necesidad — el camino más largo, más caro y más frágil de los dos,
     * para el caso que menos lo pide.
     *
     * El mismo umbral que usa `detener()`, para que los dos caminos no se
     * contradigan: por debajo de 3,6 MB el audio cabe en el cuerpo de la
     * petición y va directo.
     */
    const diar = blob.size > LIMITE_CUERPO_BYTES
      ? await intentarDiarizarLargo(blob, ext, recoveryKey, segundosEstimados, ctx)
      : await intentarDiarizar(blob, ext, segundosEstimados, ctx, recoveryKey)
    if (diar?.audioPath) setAudioPath(diar.audioPath)
    let texto = ''
    if (diar && diar.text.trim()) {
      { const us = corregirUtterances(diar.utterances); setUtterances(us); utterancesRef.current = us }
      texto = diar.text
    } else {
      // 2) Fallback: transcribir EN PARTES (OpenAI o AssemblyAI por trozo). Nunca lanza.
      // Con el contexto del paciente: sin él, la recuperación transcribe con el
      // catálogo genérico justo en la consulta que ya falló una vez.
      texto = (await transcribirEnPartes(chunks, mime, ext, { ...ctx, duracionSeg: segundosEstimados })).texto
    }

    if (texto.trim()) {
      const r = procesarTranscript(texto)
      setTranscripcion(r.texto)
      setCorrecciones(r.cambiosLexicos)
      setCambiosCifras(cambiosVisibles(r.cambiosNormalizacion, r.cambiosSiglas))
      setAlertasDictado(r.alertas)
      setMotivosConfirmacion(r.motivos)
      setTranscripcionMotor(r.crudo)
      setEstado('listo')
      await borrarChunks(recoveryKey)  // solo se borra si SÍ se transcribió
    } else {
      // No borramos el audio: sigue disponible para reintentar más tarde.
      setError(`No se pudo transcribir el audio recuperado${motivoFalloTranscripcion ? ` (${motivoFalloTranscripcion})` : ''}. Sigue guardado en este dispositivo; reintenta más tarde.`)
      setEstado('error')
    }
  }, [])

  /**
   * SIEMBRA EL DICTADO QUE SE GRABÓ EN OTRA PANTALLA.
   *
   * El pase de UCI se dicta en `/uci` y se firma en la consulta. Al pasar de una
   * a otra viajaban las secciones y el texto — pero **los turnos y el crudo del
   * motor se quedaban en la pantalla de origen**, así que la nota de UCI se
   * archivaba sin separación de voces, sin lista de palabras a verificar, sin
   * saber de quién era cada cita y sin material de origen.
   *
   * No graba nada ni transcribe nada: sólo **adopta** lo que ya se transcribió,
   * con las mismas reglas que el camino normal —incluido el sexto motivo de
   * confirmación, que necesita las confianzas por palabra.
   */
  const sembrarDictado = useCallback((semilla: { crudo?: string; utterances?: Utterance[] }) => {
    const us = semilla.utterances ?? []
    if (us.length) {
      setUtterances(us); utterancesRef.current = us
      if (dudaEnZonaCritica(us, UNIDADES_CANONICAS)) {
        setMotivosConfirmacion(m => m.includes('confianza_baja_con_termino_critico') ? m : [...m, 'confianza_baja_con_termino_critico'])
      }
    }
    // El crudo NO se inventa: si la pantalla de origen no lo mandó, se queda
    // vacío y la nota lo dirá, en vez de archivar el texto de trabajo como si
    // fuera el original — que es el defecto que la v996 vino a cerrar.
    if (semilla.crudo) setTranscripcionMotor(semilla.crudo)
  }, [])

  // Escape hatch: descarga el audio guardado como ARCHIVO al dispositivo, para que
  // la consulta NUNCA se pierda aunque la transcripción falle. No borra nada.
  const descargarAudioGuardado = useCallback(async (recoveryKey: string): Promise<boolean> => {
    const chunks = await leerChunks(recoveryKey)
    if (chunks.length === 0) return false
    const mime = chunks[0].type || 'audio/webm'
    const ext = extDe(mime)
    const blob = new Blob(chunks, { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `consulta-audio-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.${ext}`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    return true
  }, [])

  return {
    soportado, estado, duracion, transcripcion, utterances, transcripcionParcial, error,
    nivelAudio, silencioProlongado, recorte, motivosConfirmacion, transcripcionMotor, bytesGrabados, chunksTranscritos, chunksFallidos, captura, correcciones, cambiosCifras, sinDiarizacion, audioPath,
    alertasDictado,
    iniciar, detener, pausar, reanudar, reset, setTranscripcion, sembrarDictado,
    hayRecovery, recuperarAudio, descargarAudioGuardado, descartarRecovery,
  }
}
