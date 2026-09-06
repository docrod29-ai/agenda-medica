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

import { revalidarCitas } from '@/lib/ia/revalidar-citas'
import { NextRequest, NextResponse } from 'next/server'
import { buildSystemPrompt, buildUserPrompt } from '@/lib/expediente/prompts'
import { tieneGuia } from '@/lib/expediente/guias-de-especialidad'
import { RespuestaExtraccion } from '@/lib/expediente/extraction-schema'
import { parserClinicoComoRespuestaIA } from '@/lib/expediente/parser-clinico'
import { safeLog, redactarString } from '@/lib/security/sanitize'
import { verificarModuloIA } from '@/lib/auth-server'
import { TIMEOUT } from '@/lib/fetch-con-timeout'
import { limitarOResponder } from '@/lib/rate-limit'
import { anotarLlamada } from '@/lib/ia/gateway'
import { esFundador } from '@/lib/authz/fundador'
import { claseDeFallo, quienPaga, avisoAlMedico } from '@/lib/ia/fallo-proveedor'
import { reportarFalloIA } from '@/lib/ia/incidentes-servidor'
import { reservarParaClinica, confirmarCreditos, devolverCreditos } from '@/lib/finanzas/cartera-server'
import { gateCreditos, resolverClaveIA, registrarUso, nivelIADe, registrarCreditos, registrarConsultaEconomica, economicasDelMes, entitlementsDe, creditosUsadosDelMes, creditosExtraDelMes  } from '@/lib/ai-keys'
import { planDeNivel, estadoUso, MOTORES, motorPorClave, motorPorDefecto, topeEconomicoDe } from '@/lib/planes-ia'
import type { TipoNota, PacienteContexto } from '@/types/expediente'
import { PROMPT_VERSION } from '@/lib/expediente/prompt-version'
import { correlacionDe } from '@/lib/observabilidad/correlacion'
import { elegirModelo, sePuedeRecordar, type Eleccion } from '@/lib/ia/que-modelo-se-eligio'

const ENV_ANTHROPIC = process.env.ANTHROPIC_API_KEY ?? ''
const MODEL_OVERRIDE = process.env.ANTHROPIC_MODEL ?? ''
const ANTHROPIC_VERSION = '2023-06-01'
// Versión del prompt/pipeline de la nota. Súbela al cambiar el prompt maestro:
// queda registrada en el provenance inmutable de cada nota (trazabilidad SaMD).
/**
 * La versión vive en su módulo desde REG-191, con un candado que impide que se
 * quede atrás cuando el prompt cambia. Redeclararla aquí era cómo se
 * desincronizaba: el módulo y la ruta podían decir cosas distintas.
 */

// Tres PERFILES de modelo, según plan del consultorio y momento:
//  · 'live'    → borrador EN VIVO (cada ~30s): Haiku, baratísimo y veloz. Sin thinking.
//  · 'pro'     → nota FINAL del plan Pro ($899): Sonnet 5, excelente, sin thinking.
//  · 'premium' → nota FINAL del plan Premium ($1,999): Opus 4.8 + extended thinking.
// resolverModelo() descubre el primero disponible en la cuenta vía /v1/models.
const MODELOS_PREMIUM = [
  'claude-opus-4-8',
  'claude-opus-4-6',
  'claude-sonnet-5',
  'claude-sonnet-4-6',
  'claude-sonnet-4-5',
]
const MODELOS_PRO = [
  'claude-sonnet-5',
  'claude-sonnet-4-6',
  'claude-sonnet-4-5',
]
const MODELOS_LIVE = [
  'claude-haiku-4-5-20251001',
  'claude-haiku-4-5',
  'claude-sonnet-5',   // respaldo si la cuenta no tiene Haiku
]
type Perfil = 'live' | 'pro' | 'premium'
const CANDIDATOS: Record<Perfil, string[]> = { live: MODELOS_LIVE, pro: MODELOS_PRO, premium: MODELOS_PREMIUM }

/** Modelos que soportan "extended thinking" (razonamiento previo). 3.5/haiku no. */
function soportaThinking(model: string): boolean {
  return /opus-4|sonnet-5|sonnet-4|3-7-sonnet/.test(model)
}

// Errores transitorios de Anthropic (sobrecarga / rate-limit / 5xx). Reintentamos
// con backoff antes de caer al parser local — son la causa #1 de "sigue fallando".
const STATUS_REINTENTABLE = new Set([429, 500, 502, 503, 529])
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const headersAnthropic = (key: string) => ({
  'x-api-key': key,
  'anthropic-version': ANTHROPIC_VERSION,
  'Content-Type': 'application/json',
})

/**
 * Cachea el modelo resuelto entre invocaciones del runtime (uno por perfil).
 *
 * REG-584 · **una degradación NO se cachea.** Antes se guardaba cualquier
 * elección y sólo se limpiaba con un 404, así que un modelo de último recurso
 * escogido durante una caída parcial quedaba clavado toda la vida de la
 * instancia caliente — todas las notas de todos los médicos de esa instancia.
 */
const modeloResuelto: Record<Perfil, string> = { live: '', pro: '', premium: '' }

/**
 * Descubre un modelo válido para esta cuenta vía /v1/models, y **dice cómo llegó
 * a él**: la decisión vive en `que-modelo-se-eligio.ts`, que es donde se puede
 * probar. Ver REG-584.
 */
async function resolverModelo(key: string, perfil: Perfil): Promise<Eleccion> {
  const candidatos = CANDIDATOS[perfil]
  // El override por env solo aplica al perfil premium (la nota "de máximo nivel").
  if (perfil === 'premium' && MODELO_OVERRIDE_OK()) {
    return { modelo: MODEL_OVERRIDE, comoSeEligio: 'candidato', degradado: false, aviso: '' }
  }
  if (modeloResuelto[perfil]) {
    return { modelo: modeloResuelto[perfil], comoSeEligio: 'candidato', degradado: false, aviso: '' }
  }
  try {
    /**
     * REG-346 — con señal. Es un GET de descubrimiento, pero corre en una ruta
     * con `maxDuration = 800`: un socket colgado aquí inmoviliza la lambda los
     * 800 s enteros, facturados por GB-segundo, y el médico se queda mirando.
     * Ya pasó una vez con 300 (`sw-changelog`); aquí sería casi el triple.
     */
    const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
      headers: headersAnthropic(key),
      signal: AbortSignal.timeout(TIMEOUT.ia),
    })
    if (res.ok) {
      const data = await res.json()
      const ids: string[] = (data.data ?? []).map((m: { id: string }) => m.id)
      /**
       * REG-584 · el ramal que degradaba en silencio vivía aquí:
       * `?? ids[0]` se quedaba con el primer modelo que la cuenta tuviera, que
       * para el perfil `premium` —la nota que el dueño decidió que no escatima—
       * puede ser Haiku. El modelo viajaba como procedencia y nadie lo comparaba
       * con lo que se había pedido. La ELECCIÓN no cambia; lo que cambia es que
       * ahora se sabe, se dice y no se recuerda.
       */
      const eleccion = elegirModelo(candidatos, ids)
      if (eleccion.degradado) {
        safeLog.warn(`[expediente/procesar] modelo degradado en perfil ${perfil}: ${eleccion.comoSeEligio}`)
      }
      if (sePuedeRecordar(eleccion) && eleccion.modelo) modeloResuelto[perfil] = eleccion.modelo
      if (eleccion.modelo) return eleccion
    }
  } catch { /* cae al fallback */ }
  /* El descubrimiento no contestó: se usa el candidato de ARRIBA, que es el
     mejor, y si no existe el 404 lo redescubre. Eso no es una degradación. */
  return elegirModelo(candidatos, null)
}

function MODELO_OVERRIDE_OK() { return MODEL_OVERRIDE.length > 0 }

async function llamarClaude(key: string, model: string, system: string, userMsg: string, conThinking = false, maxOverride?: number, msDisponibles = 90_000) {
  const pienso = conThinking && soportaThinking(model)
  const esHaiku = /haiku/i.test(model)   // Haiku topa el output en ~8k
  const body: Record<string, unknown> = {
    model,
    // BUG 2026-07 (JSON cortado): con "thinking" el max INCLUYE el razonamiento,
    // así que 16000 dejaba solo ~10000 para el JSON y en notas complejas
    // (1ª vez, infectología, muchas secciones) se truncaba. Se sube el techo con
    // amplio margen para el JSON: 24000 con thinking (razonamiento 6000 + ~18000
    // de JSON) y 16000 sin thinking en modelos grandes (Sonnet/Opus). Haiku se
    // mantiene en 8000 (su límite real de salida). maxOverride: para el
    // auto-reintento cuando aun así se corta (todo el presupuesto al JSON).
    max_tokens: maxOverride ?? (esHaiku ? 8000 : 24000),
    // Prompt caching: el system (instrucciones clínicas, grande y fijo) se
    // cachea → desde la 2ª nota la IA lo reutiliza y responde más rápido y más
    // barato, sin cambiar el resultado.
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userMsg }],
  }
  // Razonamiento extendido: la IA "piensa" el caso clínico antes de redactar
  // (mejor diagnóstico diferencial, dosis, coherencia). Solo en modelos que lo
  // soportan; el JSON final sale igual, solo mejor razonado.
  if (pienso) body.thinking = { type: 'enabled', budget_tokens: 6000 }
  /**
   * EL TOPE DE ESPERA SALE DEL PRESUPUESTO QUE QUEDA, NO DE UN NÚMERO FIJO.
   *
   * Aquí había 90 s por intento. Con tres intentos son 270 s más las esperas
   * entre ellos: **no cabían en los 300 s de la función**, así que el último
   * intento lo cortaba Vercel en seco y el médico acababa en el parser local.
   *
   * Y 90 s es poco para lo que de verdad importa: una consulta larga con
   * razonamiento extendido tarda. Rendirse a los 90 s con presupuesto de sobra
   * es tirar la nota por impaciencia.
   *
   * Ahora cada intento recibe **lo que queda**, menos un margen para responder.
   * Un solo intento puede usar casi cuatro minutos si hace falta; y si ya no
   * queda tiempo, no se empieza uno que se sabe que no va a terminar.
   */
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: headersAnthropic(key),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(msDisponibles),
  })
}

/**
 * Llama a Claude reintentando ante errores transitorios (sobrecarga / rate-limit
 * / 5xx) con backoff. Anthropic devuelve 529 cuando está saturado: un solo
 * intento hacía que la nota cayera al parser local "porque sí".
 */
/**
 * ── EL RELOJ DE LA NOTA ──────────────────────────────────────────────────────
 *
 * `maxDuration = 300`: pasado eso Vercel corta la función en seco, sin darle al
 * médico ni el aviso. Todo lo que se haga tiene que caber ahí dentro.
 *
 * Se reservan 25 s para lo que va DESPUÉS de la última llamada —leer la
 * respuesta, validarla, componer y responder—. Si eso no cupiera, el trabajo
 * estaría hecho y se perdería igual, que es la peor forma de fallar.
 */
/**
 * Tiene que ser el MISMO número que `maxDuration`, y no se puede compartir una
 * constante: Next exige que `maxDuration` sea un literal. Una prueba los ata.
 */
const PRESUPUESTO_MS = 800_000
const RESERVA_RESPUESTA_MS = 25_000
/** Nunca se empieza un intento con menos de esto: no le daría tiempo ni a arrancar. */
const MINIMO_PARA_INTENTAR_MS = 20_000

async function llamarClaudeConReintentos(key: string, model: string, system: string, userMsg: string, conThinking = false, maxOverride?: number, t0 = Date.now()) {
  /**
   * Un TIMEOUT o un fallo de red no llegan como `res.status`: llegan como
   * excepción. Sin esto, el tope de espera recién puesto se saltaba el bucle de
   * reintentos y subía directo al catch general, donde el médico veía el texto
   * crudo del error de JavaScript.
   *
   * Se convierte en un 504 sintético para que caiga por el MISMO camino que
   * cualquier otro error HTTP: el que ya clasifica el fallo, avisa al dueño si
   * la llave es de la plataforma y le escribe al médico una frase que se puede
   * leer.
   */
  const restante = () => PRESUPUESTO_MS - RESERVA_RESPUESTA_MS - (Date.now() - t0)

  const intentar = async (): Promise<Response> => {
    const ms = restante()
    if (ms < MINIMO_PARA_INTENTAR_MS) {
      // No se empieza lo que no puede terminar: se devuelve el 504 sintético
      // ya, para que el médico reciba su aviso en vez de un corte de Vercel.
      safeLog.warn(`[expediente/procesar] sin presupuesto para otro intento (${Math.round(ms / 1000)} s)`)
      return new Response('sin-presupuesto', { status: 504 })
    }
    try {
      return await llamarClaude(key, model, system, userMsg, conThinking, maxOverride, ms)
    } catch (e) {
      safeLog.warn('[expediente/procesar] Claude no respondió a tiempo o falló la red', e)
      return new Response('timeout', { status: 504 })
    }
  }

  let res = await intentar()
  /**
   * Se reintenta MIENTRAS QUEDE TIEMPO, no un número fijo de veces.
   *
   * Antes eran tres intentos de 90 s: 270 s más las esperas no cabían en los
   * 300 s de la función, así que el último lo cortaba Vercel y el médico
   * acababa en el parser local **por aritmética**, no porque el proveedor
   * estuviera caído.
   */
  for (let intento = 1; intento <= 2 && (STATUS_REINTENTABLE.has(res.status) || res.status === 504); intento++) {
    if (restante() < MINIMO_PARA_INTENTAR_MS) break
    await sleep(intento * 700)
    res = await intentar()
  }
  return res
}

// ENSAMBLE de la nota (💎 Máxima): GPT redacta su versión del MISMO caso con el
// mismo prompt, para que Claude luego fusione lo mejor de ambos. Devuelve el JSON
// crudo del modelo o null (a prueba de fallos: si algo falla, se ignora).
const MODELOS_OPENAI_NOTA = ['gpt-5', 'gpt-4o']
async function generarNotaOpenAI(
  keyOAI: string, system: string, userMsg: string,
  /**
   * REG-346 — LO QUE QUEDA DEL RELOJ, IGUAL QUE CLAUDE.
   *
   * `llamarClaude` ya recibía `msDisponibles` y ponía su `AbortSignal`; ésta no
   * tenía ninguna. En una ruta con `maxDuration = 800` eso significa que un
   * socket que no cierra inmoviliza la lambda los 800 s enteros —facturados por
   * GB-segundo— y el médico se queda mirando una nota que ya no va a llegar.
   *
   * El ensamble es ADEMÁS el candidato natural a colgarse: es la segunda
   * opinión, la que se puede perder sin perder la nota. Por eso se le da un
   * tope propio y se le deja fallar: `null` ya significa «sigue con la de
   * Claude».
   */
  msDisponibles = TIMEOUT.ia,
): Promise<Record<string, unknown> | null> {
  async function llamar(model: string) {
    return fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${keyOAI}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: userMsg }], response_format: { type: 'json_object' }, max_completion_tokens: 8000 }),
      signal: AbortSignal.timeout(msDisponibles),
    })
  }
  try {
    let res = await llamar(MODELOS_OPENAI_NOTA[0])
    for (let i = 1; i < MODELOS_OPENAI_NOTA.length && (res.status === 404 || res.status === 400); i++) res = await llamar(MODELOS_OPENAI_NOTA[i])
    if (!res.ok) return null
    const data = await res.json()
    const t: string = data.choices?.[0]?.message?.content ?? ''
    const mm = t.match(/\{[\s\S]*\}/)
    try { return mm ? JSON.parse(mm[0]) : null } catch { return null }
  } catch { return null }
}

/**
 * Devuelve el fallback del parser local PERO con la causa REAL visible en el
 * panel (safety.missing_critical_fields), no solo en un toast que desaparece.
 * Así el médico (y nosotros) vemos en pantalla por qué falló la IA.
 */
function fallbackVisible(transcripcion: string, tipo: TipoNota, aviso: string, causa: string, debug?: string) {
  const fallback = parserClinicoComoRespuestaIA(transcripcion, tipo) as {
    safety: { missing_critical_fields: string[] }
  } & Record<string, unknown>
  fallback.safety.missing_critical_fields = [aviso]
  /**
   * `_modelo: 'parser-local'` NO es cosmético.
   *
   * El fallback no lo devolvía, así que el cliente conservaba el `provenanceIA`
   * del procesamiento ANTERIOR y, al firmar, grababa ese modelo en la
   * procedencia inmutable. Procesar con éxito, dictar más, que Anthropic
   * devuelva 529 y firmar dejaba una nota que dice «la escribió Opus» sobre un
   * texto que escribió una regex.
   */
  return NextResponse.json({
    ...fallback, _aviso: aviso, _causaFallback: causa, _detalleDebug: debug,
    _modelo: 'parser-local', _promptVersion: 'n/a', _apiVersion: 'n/a',
  })
}

/**
 * ── CUÁNTO PUEDE TARDAR LA NOTA ─────────────────────────────────────────────
 *
 * Sin esto Vercel cortaba a los 60 s — el fallo más doloroso en consulta. Estuvo
 * en 300 s, que es el techo del plan Pro **sin** Fluid compute; con Fluid llega a
 * **800**.
 *
 * Instrucción del Dr., literal: «dale el tiempo que necesite, no nomás 4.5
 * minutos». Una consulta larga con razonamiento extendido no se rinde por reloj.
 *
 * **Es el MISMO número que `SEGUNDOS_DE_LA_FUNCION`**, del que sale el
 * presupuesto de cada intento: si los dos se separan, o se desperdicia tiempo
 * pagado o Vercel corta con el trabajo hecho. Una prueba lo ata.
 */
export const maxDuration = 800

export async function POST(req: NextRequest) {
  // Seguridad: solo usuarios autenticados. Procesa PHI y consume la API key
  // de Anthropic — sin esto cualquiera con la URL la quemaba.
  const acceso = await verificarModuloIA(req, 'expediente')
  if (!acceso.ok) return acceso.response

  // Tope de ráfaga sobre el sistema de créditos: la generación de nota cuesta IA. 40/min por usuario.
  const limite = await limitarOResponder(`procesar:${acceso.uid}`, 40, 60)
  if (limite) return limite

  // Llave del consultorio (o la del dueño en modo prueba con tope).
  const { key: API_KEY, fuente, clinicId } = await resolverClaveIA(acceso.uid, 'anthropic', ENV_ANTHROPIC)
  // TOPE DE CRÉDITOS (auditoría 26-jul): sin esto, un consultorio con los
  // créditos agotados seguía quemando la llave del dueño indefinidamente.
  // `gateCreditos` sólo corta cuando la llave es la del dueño (`prueba`):
  // con llave propia del consultorio NO se corta, porque paga su propia API.
  /**
   * `permiteEconomico`: esta ruta SÍ sabe seguir sin créditos, bajando a ⚡
   * Rápida — que es justo lo que promete la página de precios. Sin esta bandera
   * el portero cortaba aquí y el respaldo, cincuenta líneas más abajo, no se
   * alcanzaba nunca.
   */
  const corteCreditos = await gateCreditos(clinicId, fuente, { permiteEconomico: true })
  if (corteCreditos) return corteCreditos
  if (!API_KEY) {
    return NextResponse.json(
      { ok: false, error: 'No hay API key de Claude configurada. Agrégala en Configuración → Llaves de IA.' },
      { status: 503 },
    )
  }
  let body: { transcripcion?: string; tipo?: TipoNota; contexto?: PacienteContexto; rapido?: boolean; motor?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const { transcripcion, tipo, contexto } = body
  const rapido = body.rapido === true
  if (!transcripcion || !tipo || !contexto) {
    return NextResponse.json({ ok: false, error: 'Faltan transcripcion, tipo o contexto' }, { status: 400 })
  }

  /**
   * Contexto del libro de costos.
   *
   * Esta ruta NO pasa por el gateway todavía: hace descubrimiento de modelos
   * contra `/v1/models`, usa razonamiento extendido y reintenta sin él ante un
   * 400. Migrarla entera cambiaría de callado cómo razona la nota que el médico
   * firma. Pero es la llamada MÁS CARA de la plataforma, y hasta hoy no dejaba
   * un solo renglón: se anota el costo aunque el enrutado venga después.
   */
  const ctxCosto = {
    feature: 'nota-consulta',
    requestId: req.headers.get('x-vercel-id') || `np-${acceso.uid}-${Date.now()}`,
        correlacion: correlacionDe(req),
    clinicId: clinicId ?? null,
    uid: acceso.uid,
    creditos: 0,   // los créditos los cobra esta ruta por su cuenta, más abajo
    fuente,
    esFundador: esFundador(acceso.email, process.env.SUPERADMIN_EMAILS),
  }
  const t0Costo = Date.now()

  const nivel = await nivelIADe(clinicId)

  // ── MENÚ DE IA ──────────────────────────────────────────────────────────
  // El cliente pide un MOTOR (⚡ Rápida / ⭐ Estándar / 💎 Máxima) que define el
  // modelo y cuántos créditos quema. Si no manda motor, se usa el default del
  // plan (Pro→Máxima, Clínica→Estándar). El borrador en vivo siempre es Rápida.
  const motorPedido = rapido ? MOTORES.rapida : (body.motor ? motorPorClave(body.motor) : motorPorDefecto(nivel))

  // ── DEGRADACIÓN (nunca bloquea) ─────────────────────────────────────────
  // Con la llave del DUEÑO ('prueba'), si el consultorio ya agotó sus créditos del
  // mes (plan + recargas), la nota NO se detiene: baja a ⚡ Rápida (Haiku, casi
  // gratis) y no gasta crédito premium. Para recuperar la IA máxima compra más.
  // Consultorio con su PROPIA llave: nunca se degrada (paga su uso).
  let modoEconomico = false
  // Cupo EFECTIVO: escala con el número de médicos (cobro por asiento). El plan
  // incluye 1 médico; cada médico extra suma su bolsa de créditos + tope económico.
  let limiteEfectivo = planDeNivel(nivel).limiteConsultas
  let topeEco = topeEconomicoDe(nivel)
  /**
   * LA RESERVA — decidir y apartar en el MISMO paso.
   *
   * Esto era leer el gasto del mes, decidir, y más abajo incrementar con un
   * `void`. Entre la lectura y el incremento caben treinta segundos de llamada
   * al modelo, así que dos notas simultáneas del mismo consultorio leían el
   * mismo saldo y pasaban las dos en modo premium con el cupo de una. Es
   * exactamente el fallo que la cartera existe para cerrar, y ésta era la única
   * ruta grande que no la usaba — la más cara, además.
   *
   * `reservarParaClinica` falla ABIERTO: un mal minuto de Firestore no deja al
   * médico sin su nota, sólo queda anotado.
   */
  let reserva: Awaited<ReturnType<typeof reservarParaClinica>> | null = null
  /** Si la nota no llega a salir, lo apartado se devuelve en el `finally`. */
  let reservaConfirmada = false
  if (!rapido && fuente === 'prueba') {
    const ent = await entitlementsDe(clinicId, nivel)
    limiteEfectivo = ent.limiteCreditos
    topeEco = ent.topeEconomico
    reserva = await reservarParaClinica(clinicId, fuente, motorPedido.creditos, esFundador(acceso.email, process.env.SUPERADMIN_EMAILS))
    // No caber es lo que antes se calculaba a mano: se degrada, no se bloquea.
    if (!reserva.ok) { modoEconomico = true; reserva = null }
  }

  // ── TOPE del modo económico (red de seguridad de costo) ─────────────────
  // El modo económico es GRATIS pero NO infinito: tras un número generoso de
  // notas económicas al mes se PAUSA (recarga/subir de plan). Así, aunque un
  // consultorio con varios médicos exprima la IA, el costo del dueño no se dispara.
  if (modoEconomico) {
    const econ = await economicasDelMes(clinicId)
    if (econ >= topeEco) {
      return NextResponse.json({
        ok: false, sinCreditos: true, tope: topeEco, economicas: econ,
        error: `Se acabó tu IA del mes (incluye las notas económicas gratis). Compra más créditos o sube de plan para seguir.`,
      }, { status: 402 })
    }
  }

  const motor = modoEconomico ? MOTORES.rapida : motorPedido
  const perfil: Perfil = motor.perfil
  const conThinking = perfil === 'premium'
  // El cliente dispara la 2ª opinión GPT-5 automática solo si la nota fue Máxima (Opus).
  const planDeRespuesta = perfil === 'premium' ? 'premium' : 'pro'

  try {
    /**
     * La propuesta de apartados vacíos SÓLO en el pase final.
     *
     * `rapido` es verdadero en los pases en vivo y en el preliminar. En esos, un
     * apartado vacío sigue significando «falta»; en el final ya no va a llenarse
     * solo, y ahí sí se propone — marcado. Ver `COMPLETA_LOS_HUECOS`.
     */
    const system  = buildSystemPrompt(tipo, contexto.especialidad, contexto.instruccionesIA, { proponerHuecos: !rapido })
    const userMsg = buildUserPrompt(transcripcion, contexto)

    let eleccion = await resolverModelo(API_KEY, perfil)
    let model = eleccion.modelo ?? CANDIDATOS[perfil][0]
    let res = await llamarClaudeConReintentos(API_KEY, model, system, userMsg, conThinking)

    // Si el modelo no existe (404), redescubre y reintenta una vez
    if (res.status === 404) {
      modeloResuelto[perfil] = ''
      eleccion = await resolverModelo(API_KEY, perfil)
      model = eleccion.modelo ?? CANDIDATOS[perfil][0]
      res = await llamarClaudeConReintentos(API_KEY, model, system, userMsg, conThinking)
    }

    // MODO SEGURO: un 400 con "extended thinking" (o max_tokens alto) tumbaba la
    // nota al parser local. Si el intento con thinking devolvió 400, reintentamos
    // el MISMO modelo SIN thinking y con tokens normales → la nota se genera igual,
    // solo sin el razonamiento extra. Así un límite de la cuenta o del modelo no
    // rompe la generación. (Solo aplica si usamos thinking = plan premium.)
    if (res.status === 400 && conThinking) {
      const errTxt = await res.clone().text().catch(() => '')
      safeLog.error('[expediente/procesar] 400 con thinking, reintento modo seguro:', redactarString(errTxt.slice(0, 300)))
      res = await llamarClaudeConReintentos(API_KEY, model, system, userMsg, false)
    }

    if (!res.ok) {
      const err = await res.text()
      safeLog.error('[expediente/procesar] Claude HTTP error:', res.status, redactarString(err.slice(0, 500)))
      // Distingue saldo (credit balance) de otros 400 para no mandar al Dr a
      // "revisar créditos" cuando en realidad es un parámetro.
      /**
       * QUIÉN PAGA LA LLAVE DECIDE QUÉ SE LE DICE AL MÉDICO.
       *
       * Aquí decía «IA de estructura no disponible: Anthropic respondió HTTP 401
       * — llave inválida» y, para el 429, «carga saldo en console.anthropic.com».
       * Con la llave de la PLATAFORMA eso es doblemente malo: le filtra al cliente
       * un problema interno nuestro y lo manda a pagar en una consola que no es
       * suya y a la que no tiene acceso. Regla del dueño, literal: «no quiero que
       * a mis clientes les pase eso, está prohibido».
       *
       * Con llave PROPIA del consultorio sí se le dice todo, porque ahí sí lo
       * arregla él. Ver `fallo-proveedor.ts`.
       */
      const quien = quienPaga(fuente)
      const clase = claseDeFallo(res.status, err)
      reportarFalloIA({ clase, quien, proveedor: 'anthropic', feature: 'nota-consulta', status: res.status })
      return fallbackVisible(
        transcripcion, tipo,
        avisoAlMedico(clase, quien, 'anthropic').texto,
        'http_error',
        // El detalle técnico sigue existiendo para el registro y el soporte; lo
        // que cambia es que ya no es lo que ve el médico.
        `Claude ${res.status} (${clase}) en modelo ${model}`,
      )
    }

    const data = await res.json()
    anotarLlamada(ctxCosto, 'anthropic', String(data?.model ?? model), data, Date.now() - t0Costo)
    // Con "extended thinking" el content trae bloques {type:'thinking'} ANTES del
    // {type:'text'}; tomamos el bloque de texto, no content[0] (que sería el
    // razonamiento). Sin thinking, content[0] ya es el texto.
    const bloques: { type?: string; text?: string }[] = Array.isArray(data.content) ? data.content : []
    const text: string = bloques.find(b => b?.type === 'text')?.text ?? bloques[0]?.text ?? ''
    const stopReason: string = data.stop_reason ?? ''

    // Si Claude devolvió string vacío, es signo de bloqueo/timeout
    if (!text.trim()) {
      safeLog.warn('[procesar] Claude devolvió texto vacío. stop_reason=', stopReason)
      return fallbackVisible(
        transcripcion, tipo,
        `IA de estructura devolvió respuesta vacía (stop_reason=${stopReason || 'desconocido'}).`,
        'respuesta_vacia',
      )
    }

    // Parsear el JSON (robusto ante markdown accidental y comentarios)
    let parsed = parseJSON(text)

    // AUTO-REPARACIÓN (bug 2026-07): si el JSON se cortó por límite de tokens,
    // reintenta UNA vez SIN thinking y con el máximo de salida (32000). Al no
    // gastar presupuesto en razonamiento, TODO va al JSON → cabe completo.
    // (Solo modelos grandes; Haiku ya topa en 8k y no se sube.)
    if (!parsed && stopReason === 'max_tokens' && !/haiku/i.test(model)) {
      safeLog.error('[expediente/procesar] JSON truncado por max_tokens; reintento 32000 sin thinking')
      const res2 = await llamarClaudeConReintentos(API_KEY, model, system, userMsg, false, 32000)
      if (res2.ok) {
        const data2 = await res2.json().catch(() => null)
        // El reintento es OTRA llamada y cuesta otros tokens: su asiento va aparte.
        anotarLlamada(ctxCosto, 'anthropic', String(data2?.model ?? model), data2, Date.now() - t0Costo)
        const b2: { type?: string; text?: string }[] = Array.isArray(data2?.content) ? data2.content : []
        const t2: string = b2.find(x => x?.type === 'text')?.text ?? b2[0]?.text ?? ''
        const p2 = parseJSON(t2)
        if (p2) parsed = p2
      }
    }

    if (!parsed) {
      safeLog.warn('[procesar] JSON no parseable. stop_reason=', stopReason, 'primeros 300 chars:', text.slice(0, 300))
      const fueCortado = stopReason === 'max_tokens'
      return fallbackVisible(
        transcripcion, tipo,
        fueCortado
          ? 'IA de estructura devolvió JSON cortado por límite de tokens.'
          : 'IA de estructura devolvió un formato no válido.',
        fueCortado ? 'truncado_max_tokens' : 'json_malformado',
        text.slice(0, 200),
      )
    }

    // Validar con Zod. Si falla, devolvemos lo que sí se pudo parsear
    // (modo permisivo: el frontend prioriza los campos planos y muestra el extraction si llega).
    // Candado de gasto (SOFT): cuenta la consulta SOLO si es nota final (no el
    // borrador en vivo) y devuelve el uso vs el límite del plan. Nunca bloquea.
    let uso: ReturnType<typeof estadoUso> | undefined
    const limitePlan = limiteEfectivo   // cupo escalado por # de médicos
    if (!rapido) {
      if (modoEconomico) {
        // Excedente: corre en ⚡ Rápida (Haiku), NO gasta crédito premium. Se cuenta aparte.
        void registrarConsultaEconomica(clinicId)
        uso = estadoUso(limitePlan, limitePlan)   // 100% del cupo usado
      } else {
        // CONFIRMAR lo apartado. El motor que se acabó usando puede no ser el
        // pedido (la cascada degrada), así que se confirma el costo REAL y la
        // cartera devuelve la diferencia sola.
        if (reserva) { await confirmarCreditos(reserva, motor.creditos); reservaConfirmada = true }
        else void registrarCreditos(clinicId, motor.creditos)
        const prev = await creditosUsadosDelMes(clinicId)
        uso = estadoUso(Math.round(prev), limitePlan)
      }
    }

    const validation = RespuestaExtraccion.safeParse(parsed)
    if (!validation.success) {
      safeLog.warn('[procesar] Validación parcial:', validation.error.issues.slice(0, 3))
      void registrarUso(clinicId, fuente)
      return NextResponse.json({ ok: true, ...parsed, _schemaWarning: true, _plan: planDeRespuesta, _motor: motor.clave, _uso: uso, _modoEconomico: modoEconomico, _modelo: model, _modeloDegradado: eleccion.degradado, _avisoModelo: eleccion.aviso, _promptVersion: PROMPT_VERSION, _apiVersion: ANTHROPIC_VERSION })
    }

    void registrarUso(clinicId, fuente)

    // ── ENSAMBLE MULTI-MODELO DE LA NOTA (solo 💎 Máxima) ──────────────
    // "No escatimar": GPT redacta su versión del MISMO caso y Claude FUSIONA lo
    // mejor de ambos borradores. A PRUEBA DE FALLOS: la nota de Claude ya es la
    // base garantizada; cualquier fallo del ensamble → se queda esa (sin regresión).
    let notaFinal: Record<string, unknown> = validation.data
    const modelosNota: string[] = [model]
    /** Qué pasó con las citas al fusionar. `null` cuando no hubo ensamble. */
    let citasFusion: { revisadas: number; restauradas: number; descartadas: number } | null = null
    if (perfil === 'premium' && !modoEconomico && !rapido) {
      // Presupuesto de tiempo: si el ensamble (GPT + síntesis) no termina en 25s,
      // se usa la nota de Claude — así NUNCA provoca un 504 en la generación.
      const ensamble = (async (): Promise<Record<string, unknown> | null> => {
        const oai = await resolverClaveIA(acceso.uid, 'openai', process.env.OPENAI_API_KEY ?? '').catch(() => ({ key: '' as string }))
        if (!oai.key) return null
        const notaGPT = await generarNotaOpenAI(oai.key as string, system, userMsg)
        if (!notaGPT) return null
        const sysS = `${system}\n\n[MODO SÍNTESIS] Recibes además DOS borradores de esta nota (A=Claude, B=GPT) del MISMO caso. Combínalos en la MEJOR nota ÚNICA con EXACTAMENTE el mismo esquema JSON: toma lo más correcto y completo de cada uno, agrega lo que uno haya omitido, NO inventes nada que no esté en la transcripción, y prioriza la seguridad clínica (dosis, interacciones, alergias). Devuelve SOLO el JSON del esquema.`
        /**
         * NO SE TRUNCA LA NOTA BUENA PARA FUSIONARLA.
         *
         * Los dos borradores se recortaban a 20 000 caracteres cada uno con un
         * `.slice()`, lo que entrega al sintetizador un JSON PARTIDO A LA MITAD.
         * Todo lo que quedaba tras el corte se reescribía desde el otro borrador o
         * desaparecía — y la síntesis reemplaza la nota entera. En una historia
         * clínica de primera vez con el bloque `extraction` poblado (que lleva una
         * cita textual por campo), pasar de 20k es lo normal, no el caso raro.
         *
         * Ahora, si los borradores no caben, NO se fusiona: se conserva la nota de
         * Claude íntegra. Perder la segunda opinión es un downgrade de calidad;
         * fusionar sobre un JSON mutilado es perder contenido clínico.
         */
        const TOPE_FUSION = 60000
        const jsonA = JSON.stringify(validation.data)
        const jsonB = JSON.stringify(notaGPT)
        if (jsonA.length + jsonB.length > TOPE_FUSION) return null
        const usrS = `${userMsg}\n\n=== BORRADOR A (Claude) ===\n${jsonA}\n\n=== BORRADOR B (GPT) ===\n${jsonB}\n\nFusiona A y B en la mejor nota. Devuelve solo el JSON del esquema.`
        const resS = await llamarClaudeConReintentos(API_KEY, model, sysS, usrS, false, 32000)
        if (!resS.ok) return null
        const dS = await resS.json()
        const bS: { type?: string; text?: string }[] = Array.isArray(dS.content) ? dS.content : []
        const pS = parseJSON(bS.find(b => b?.type === 'text')?.text ?? bS[0]?.text ?? '')
        const vS = pS ? RespuestaExtraccion.safeParse(pS) : null
        return vS && vS.success ? (vS.data as Record<string, unknown>) : null
      })().catch(() => null)
      const merged = await Promise.race([ensamble, new Promise<null>(r => setTimeout(() => r(null), 25000))])
      if (merged) {
        /**
         * ── LAS CITAS DE LA FUSIÓN SE VUELVEN A COMPROBAR ────────────────────
         *
         * La síntesis pasaba por el esquema —o sea, se comprobaba la FORMA— y
         * nadie miraba si las `source_quote` fusionadas **seguían existiendo en
         * la transcripción**.
         *
         * Y la cita es lo único que sostiene el sello «dictado»: `procedencia`
         * lo comprueba al firmar y, si no aparece, degrada el campo a «ia». O
         * sea que una cita reescrita por el sintetizador no rompía nada
         * ruidosamente — hacía que un dato DICTADO dejara de parecerlo, y el
         * médico veía más avisos de «no se pudo comprobar» sin explicación.
         *
         * Se revalida elemento por elemento: lo que la fusión rompió vuelve al
         * borrador de Claude si allí la cita sí verifica. Tirar la fusión entera
         * por una cita mala es el error que ya costó caro con el guardián.
         */
        const rev = revalidarCitas(merged, validation.data, transcripcion)
        notaFinal = rev.nota
        modelosNota.push('GPT', 'síntesis')
        if (rev.restaurados > 0 || rev.descartadas > 0) {
          // Una corrección silenciosa se ve igual que un acierto.
          safeLog.info(`[procesar] citas de la fusión: ${rev.revisadas} revisadas, ${rev.restaurados} restauradas del borrador base, ${rev.descartadas} descartadas`)
        }
        citasFusion = { revisadas: rev.revisadas, restauradas: rev.restaurados, descartadas: rev.descartadas }
      }
    }

    // _plan: el cliente decide con esto si la 2ª opinión (GPT-5) es automática. Va
    // 'premium' SOLO si la nota usó el motor 💎 Máxima (Opus). _motor: qué motor se
    // usó (para la insignia). _modoEconomico: bajó a ⚡ Rápida por falta de créditos.
    /**
     * ¿SE REDACTÓ CON EL CRITERIO DE SU RAMA, O CON EL DE NADIE?
     *
     * `guiaDe()` devuelve null cuando la especialidad no tiene guía —un
     * reumatólogo, un geriatra, cualquiera fuera de las dieciséis—. Antes eso
     * era una cadena vacía y la nota salía con criterio GENÉRICO sin que nadie
     * se lo dijera.
     *
     * Un genérico silencioso es la peor de las opciones: el médico no sabe que
     * su nota se redactó con el criterio de ninguna rama. Se dice.
     */
    const conGuia = tieneGuia(contexto.especialidad)
    return NextResponse.json({ ok: true, ...notaFinal, _plan: planDeRespuesta, _motor: motor.clave, _uso: uso, _modoEconomico: modoEconomico, _modelo: model, _modeloDegradado: eleccion.degradado, _avisoModelo: eleccion.aviso, _promptVersion: PROMPT_VERSION, _apiVersion: ANTHROPIC_VERSION, _modelosNota: modelosNota, _citasFusion: citasFusion, _especialidadSinGuia: contexto.especialidad && !conGuia ? String(contexto.especialidad) : undefined })
  } catch (err) {
    safeLog.error('[expediente/procesar] Exception:', err)
    try {
      return fallbackVisible(
        transcripcion, tipo,
        `Error interno al llamar la IA de estructura: ${String(err).slice(0, 100)}.`,
        'excepcion',
      )
    } catch {
      return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
    }
  } finally {
    /**
     * DEVOLVER LO APARTADO SI LA NOTA NO SALIÓ.
     *
     * Todos los caminos de fallo salen por `fallbackVisible` —proveedor caído,
     * respuesta vacía, JSON roto, excepción— y ninguno pasa por la confirmación.
     * Sin esto, apartar créditos sería peor que no apartarlos: una caída de
     * Anthropic le comería el cupo del mes al consultorio sin darle una sola nota.
     */
    if (reserva && !reservaConfirmada) void devolverCreditos(reserva)
  }
}

/**
 * Extrae JSON aunque venga envuelto en ```json … ``` o con comentarios
 * que la IA copió accidentalmente del prompt.
 * Pipeline de fallbacks:
 *   1. Parse directo
 *   2. Quitar fences de markdown
 *   3. Recortar de primer "{" a último "}"
 *   4. Quitar comentarios // ... y trailing commas (JSON5-ish)
 */
function parseJSON(text: string): Record<string, unknown> | null {
  let t = text.trim()
  // 1. fence markdown
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) t = fence[1].trim()
  // 2. recortar al primer { … último }
  const first = t.indexOf('{')
  const last = t.lastIndexOf('}')
  if (first === -1 || last === -1) return null
  const slice = t.slice(first, last + 1)

  // intento 1: parse limpio
  try { return JSON.parse(slice) } catch { /* sigue al fallback */ }

  // intento 2: limpiar comentarios // y trailing commas que la IA pudo
  // copiar del prompt. Conserva strings (evita romper URLs con //)
  const limpio = slice
    // quitar comentarios de línea // que NO estén dentro de strings
    .split('\n')
    .map(line => {
      const m = line.match(/^([^"]*(?:"[^"]*"[^"]*)*?)\s*\/\/.*$/)
      return m ? m[1].trimEnd() : line
    })
    .join('\n')
    // trailing comma antes de } o ]
    .replace(/,(\s*[}\]])/g, '$1')

  try { return JSON.parse(limpio) } catch {
    safeLog.warn('[procesar] JSON inválido incluso tras limpieza. Primeros 200 chars:', slice.slice(0, 200))
    return null
  }
}
