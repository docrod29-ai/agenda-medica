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

import { NextRequest, NextResponse } from 'next/server'
import { buildSystemPrompt, buildUserPrompt } from '@/lib/expediente/prompts'
import { RespuestaExtraccion } from '@/lib/expediente/extraction-schema'
import { parserClinicoComoRespuestaIA } from '@/lib/expediente/parser-clinico'
import { safeLog, redactarString } from '@/lib/security/sanitize'
import { verificarUsuario } from '@/lib/auth-server'
import { limitarOResponder } from '@/lib/rate-limit'
import { resolverClaveIA, registrarUso, nivelIADe, registrarCreditos, registrarConsultaEconomica, economicasDelMes, entitlementsDe, creditosUsadosDelMes, creditosExtraDelMes } from '@/lib/ai-keys'
import { planDeNivel, estadoUso, MOTORES, motorPorClave, motorPorDefecto, topeEconomicoDe } from '@/lib/planes-ia'
import type { TipoNota, PacienteContexto } from '@/types/expediente'

const ENV_ANTHROPIC = process.env.ANTHROPIC_API_KEY ?? ''
const MODEL_OVERRIDE = process.env.ANTHROPIC_MODEL ?? ''
const ANTHROPIC_VERSION = '2023-06-01'

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
  'claude-3-7-sonnet-latest',
]
const MODELOS_PRO = [
  'claude-sonnet-5',
  'claude-sonnet-4-6',
  'claude-sonnet-4-5',
  'claude-3-5-sonnet-latest',
]
const MODELOS_LIVE = [
  'claude-haiku-4-5-20251001',
  'claude-haiku-4-5',
  'claude-3-5-haiku-latest',
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

/** Cachea el modelo resuelto entre invocaciones del runtime (uno por perfil) */
const modeloResuelto: Record<Perfil, string> = { live: '', pro: '', premium: '' }

/** Descubre un modelo válido para esta cuenta vía /v1/models */
async function resolverModelo(key: string, perfil: Perfil): Promise<string> {
  // El override por env solo aplica al perfil premium (la nota "de máximo nivel").
  if (perfil === 'premium' && MODELO_OVERRIDE_OK()) return MODEL_OVERRIDE
  if (modeloResuelto[perfil]) return modeloResuelto[perfil]
  const candidatos = CANDIDATOS[perfil]
  try {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=100', { headers: headersAnthropic(key) })
    if (res.ok) {
      const data = await res.json()
      const ids: string[] = (data.data ?? []).map((m: { id: string }) => m.id)
      // Prefiere candidatos conocidos; si no, el primer "sonnet"; si no, el primero
      const elegido =
        candidatos.find(c => ids.includes(c)) ??
        ids.find(id => id.includes('sonnet')) ??
        ids[0]
      if (elegido) { modeloResuelto[perfil] = elegido; return elegido }
    }
  } catch { /* cae al fallback */ }
  return candidatos[0]
}

function MODELO_OVERRIDE_OK() { return MODEL_OVERRIDE.length > 0 }

async function llamarClaude(key: string, model: string, system: string, userMsg: string, conThinking = false) {
  const pienso = conThinking && soportaThinking(model)
  const body: Record<string, unknown> = {
    model,
    // Con "thinking" el máximo INCLUYE los tokens de razonamiento; se sube a 16000
    // para que quepa el razonamiento + el JSON completo sin cortarse (consultas
    // largas con muchas secciones). Sin thinking, 8000 basta.
    max_tokens: pienso ? 16000 : 8000,
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
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: headersAnthropic(key),
    body: JSON.stringify(body),
  })
}

/**
 * Llama a Claude reintentando ante errores transitorios (sobrecarga / rate-limit
 * / 5xx) con backoff. Anthropic devuelve 529 cuando está saturado: un solo
 * intento hacía que la nota cayera al parser local "porque sí".
 */
async function llamarClaudeConReintentos(key: string, model: string, system: string, userMsg: string, conThinking = false) {
  let res = await llamarClaude(key, model, system, userMsg, conThinking)
  for (let intento = 1; intento <= 2 && STATUS_REINTENTABLE.has(res.status); intento++) {
    await sleep(intento * 700)
    res = await llamarClaude(key, model, system, userMsg, conThinking)
  }
  return res
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
  return NextResponse.json({ ...fallback, _aviso: aviso, _causaFallback: causa, _detalleDebug: debug })
}

// La nota corre Opus 4.8 con razonamiento: sin esto Vercel la cortaba a 60s (504,
// el fallo más doloroso en consulta). En Vercel Pro sube a 300s.
export const maxDuration = 300

export async function POST(req: NextRequest) {
  // Seguridad: solo usuarios autenticados. Procesa PHI y consume la API key
  // de Anthropic — sin esto cualquiera con la URL la quemaba.
  const acceso = await verificarUsuario(req)
  if (!acceso.ok) return acceso.response

  // Tope de ráfaga sobre el sistema de créditos: la generación de nota cuesta IA. 40/min por usuario.
  const limite = await limitarOResponder(`procesar:${acceso.uid}`, 40, 60)
  if (limite) return limite

  // Llave del consultorio (o la del dueño en modo prueba con tope).
  const { key: API_KEY, fuente, clinicId } = await resolverClaveIA(acceso.uid, 'anthropic', ENV_ANTHROPIC)
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
  if (!rapido && fuente === 'prueba') {
    const [usados, extra, ent] = await Promise.all([creditosUsadosDelMes(clinicId), creditosExtraDelMes(clinicId), entitlementsDe(clinicId, nivel)])
    limiteEfectivo = ent.limiteCreditos
    topeEco = ent.topeEconomico
    if (usados + motorPedido.creditos > ent.limiteCreditos + extra) modoEconomico = true
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
    const system  = buildSystemPrompt(tipo, contexto.especialidad, contexto.instruccionesIA)
    const userMsg = buildUserPrompt(transcripcion, contexto)

    let model = await resolverModelo(API_KEY, perfil)
    let res = await llamarClaudeConReintentos(API_KEY, model, system, userMsg, conThinking)

    // Si el modelo no existe (404), redescubre y reintenta una vez
    if (res.status === 404) {
      modeloResuelto[perfil] = ''
      model = await resolverModelo(API_KEY, perfil)
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
      const esSaldo = /credit|balance|quota|billing|insufficient/i.test(err)
      const pista = res.status === 401 ? ' — llave inválida'
        : res.status === 403 ? ' — llave sin permiso'
        : res.status === 429 ? ' — sin créditos o saturada (carga saldo en console.anthropic.com)'
        : res.status === 400 && esSaldo ? ' — SIN SALDO: carga créditos en console.anthropic.com'
        : res.status === 400 ? ` — ${err.slice(0, 120)}`
        : ''
      return fallbackVisible(
        transcripcion, tipo,
        `IA de estructura no disponible: Anthropic respondió HTTP ${res.status}${pista}.`,
        'http_error',
        `Claude ${res.status} en modelo ${model}`,
      )
    }

    const data = await res.json()
    // Con "extended thinking" el content trae bloques {type:'thinking'} ANTES del
    // {type:'text'}; tomamos el bloque de texto, no content[0] (que sería el
    // razonamiento). Sin thinking, content[0] ya es el texto.
    const bloques: { type?: string; text?: string }[] = Array.isArray(data.content) ? data.content : []
    const text: string = bloques.find(b => b?.type === 'text')?.text ?? bloques[0]?.text ?? ''
    const stopReason: string = data.stop_reason ?? ''

    // Si Claude devolvió string vacío, es signo de bloqueo/timeout
    if (!text.trim()) {
      console.warn('[procesar] Claude devolvió texto vacío. stop_reason=', stopReason)
      return fallbackVisible(
        transcripcion, tipo,
        `IA de estructura devolvió respuesta vacía (stop_reason=${stopReason || 'desconocido'}).`,
        'respuesta_vacia',
      )
    }

    // Parsear el JSON (robusto ante markdown accidental y comentarios)
    const parsed = parseJSON(text)
    if (!parsed) {
      console.warn('[procesar] JSON no parseable. stop_reason=', stopReason, 'primeros 300 chars:', text.slice(0, 300))
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
        // Quema los créditos del MOTOR usado (Estándar=3, Máxima=10, Rápida=1).
        const prev = await creditosUsadosDelMes(clinicId)
        void registrarCreditos(clinicId, motor.creditos)
        uso = estadoUso(Math.round(prev + motor.creditos), limitePlan)
      }
    }

    const validation = RespuestaExtraccion.safeParse(parsed)
    if (!validation.success) {
      console.warn('[procesar] Validación parcial:', validation.error.issues.slice(0, 3))
      void registrarUso(clinicId, fuente)
      return NextResponse.json({ ok: true, ...parsed, _schemaWarning: true, _plan: planDeRespuesta, _motor: motor.clave, _uso: uso, _modoEconomico: modoEconomico })
    }

    void registrarUso(clinicId, fuente)
    // _plan: el cliente decide con esto si la 2ª opinión (GPT-5) es automática. Va
    // 'premium' SOLO si la nota usó el motor 💎 Máxima (Opus). _motor: qué motor se
    // usó (para la insignia). _modoEconomico: bajó a ⚡ Rápida por falta de créditos.
    return NextResponse.json({ ok: true, ...validation.data, _plan: planDeRespuesta, _motor: motor.clave, _uso: uso, _modoEconomico: modoEconomico })
  } catch (err) {
    console.error('[expediente/procesar] Exception:', err)
    try {
      return fallbackVisible(
        transcripcion, tipo,
        `Error interno al llamar la IA de estructura: ${String(err).slice(0, 100)}.`,
        'excepcion',
      )
    } catch {
      return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
    }
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
    console.warn('[procesar] JSON inválido incluso tras limpieza. Primeros 200 chars:', slice.slice(0, 200))
    return null
  }
}
