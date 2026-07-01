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
import { resolverClaveIA, pruebaAgotada, registrarUso } from '@/lib/ai-keys'
import type { TipoNota, PacienteContexto } from '@/types/expediente'

const ENV_ANTHROPIC = process.env.ANTHROPIC_API_KEY ?? ''
const MODEL_OVERRIDE = process.env.ANTHROPIC_MODEL ?? ''
const ANTHROPIC_VERSION = '2023-06-01'

// Modelos candidatos en orden de preferencia (el primero disponible se usa).
// resolverModelo() descubre dinámicamente vía /v1/models; esta lista es el
// respaldo cuando el descubrimiento no está disponible.
const MODELOS_CANDIDATOS = [
  'claude-sonnet-4-6',
  'claude-sonnet-4-5',
  'claude-sonnet-4-5-20250929',
  'claude-sonnet-4-20250514',
  'claude-3-7-sonnet-latest',
  'claude-3-5-sonnet-latest',
]

// Errores transitorios de Anthropic (sobrecarga / rate-limit / 5xx). Reintentamos
// con backoff antes de caer al parser local — son la causa #1 de "sigue fallando".
const STATUS_REINTENTABLE = new Set([429, 500, 502, 503, 529])
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const headersAnthropic = (key: string) => ({
  'x-api-key': key,
  'anthropic-version': ANTHROPIC_VERSION,
  'Content-Type': 'application/json',
})

/** Cachea el modelo resuelto entre invocaciones del runtime */
let modeloResuelto = ''

/** Descubre un modelo válido para esta cuenta vía /v1/models */
async function resolverModelo(key: string): Promise<string> {
  if (MODELO_OVERRIDE_OK()) return MODEL_OVERRIDE
  if (modeloResuelto) return modeloResuelto
  try {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=100', { headers: headersAnthropic(key) })
    if (res.ok) {
      const data = await res.json()
      const ids: string[] = (data.data ?? []).map((m: { id: string }) => m.id)
      // Prefiere candidatos conocidos; si no, el primer "sonnet"; si no, el primero
      const elegido =
        MODELOS_CANDIDATOS.find(c => ids.includes(c)) ??
        ids.find(id => id.includes('sonnet')) ??
        ids[0]
      if (elegido) { modeloResuelto = elegido; return elegido }
    }
  } catch { /* cae al fallback */ }
  return MODELOS_CANDIDATOS[0]
}

function MODELO_OVERRIDE_OK() { return MODEL_OVERRIDE.length > 0 }

async function llamarClaude(key: string, model: string, system: string, userMsg: string) {
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: headersAnthropic(key),
    body: JSON.stringify({
      model,
      // 8000 evita que el JSON se corte a la mitad cuando hay muchas
      // secciones + extraction + safety + preopInputs
      max_tokens: 8000,
      system,
      messages: [{ role: 'user', content: userMsg }],
    }),
  })
}

/**
 * Llama a Claude reintentando ante errores transitorios (sobrecarga / rate-limit
 * / 5xx) con backoff. Anthropic devuelve 529 cuando está saturado: un solo
 * intento hacía que la nota cayera al parser local "porque sí".
 */
async function llamarClaudeConReintentos(key: string, model: string, system: string, userMsg: string) {
  let res = await llamarClaude(key, model, system, userMsg)
  for (let intento = 1; intento <= 2 && STATUS_REINTENTABLE.has(res.status); intento++) {
    await sleep(intento * 700)
    res = await llamarClaude(key, model, system, userMsg)
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

export async function POST(req: NextRequest) {
  // Seguridad: solo usuarios autenticados. Procesa PHI y consume la API key
  // de Anthropic — sin esto cualquiera con la URL la quemaba.
  const acceso = await verificarUsuario(req)
  if (!acceso.ok) return acceso.response

  // Llave del consultorio (o la del dueño en modo prueba con tope).
  const { key: API_KEY, fuente, clinicId } = await resolverClaveIA(acceso.uid, 'anthropic', ENV_ANTHROPIC)
  if (!API_KEY) {
    return NextResponse.json(
      { ok: false, error: 'No hay API key de Claude configurada. Agrégala en Configuración → Llaves de IA.' },
      { status: 503 },
    )
  }
  if (fuente === 'prueba' && await pruebaAgotada(clinicId)) {
    return NextResponse.json(
      { ok: false, error: 'Se agotó tu prueba gratis de IA. Configura tu propia API key en Configuración → Llaves de IA.' },
      { status: 402 },
    )
  }

  let body: { transcripcion?: string; tipo?: TipoNota; contexto?: PacienteContexto }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const { transcripcion, tipo, contexto } = body
  if (!transcripcion || !tipo || !contexto) {
    return NextResponse.json({ ok: false, error: 'Faltan transcripcion, tipo o contexto' }, { status: 400 })
  }

  try {
    const system  = buildSystemPrompt(tipo, contexto.especialidad, contexto.instruccionesIA)
    const userMsg = buildUserPrompt(transcripcion, contexto)

    let model = await resolverModelo(API_KEY)
    let res = await llamarClaudeConReintentos(API_KEY, model, system, userMsg)

    // Si el modelo no existe (404), redescubre y reintenta una vez
    if (res.status === 404) {
      modeloResuelto = ''
      model = await resolverModelo(API_KEY)
      res = await llamarClaudeConReintentos(API_KEY, model, system, userMsg)
    }

    if (!res.ok) {
      const err = await res.text()
      safeLog.error('[expediente/procesar] Claude HTTP error:', res.status, redactarString(err.slice(0, 500)))
      const pista = res.status === 401 ? ' — llave inválida'
        : res.status === 403 ? ' — llave sin permiso'
        : res.status === 429 ? ' — sin créditos o saturada (carga saldo en console.anthropic.com)'
        : res.status === 400 ? ' — petición/saldo (revisa créditos en console.anthropic.com)'
        : ''
      return fallbackVisible(
        transcripcion, tipo,
        `IA de estructura no disponible: Anthropic respondió HTTP ${res.status}${pista}.`,
        'http_error',
        `Claude ${res.status} en modelo ${model}`,
      )
    }

    const data = await res.json()
    const text: string = data.content?.[0]?.text ?? ''
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
    const validation = RespuestaExtraccion.safeParse(parsed)
    if (!validation.success) {
      console.warn('[procesar] Validación parcial:', validation.error.issues.slice(0, 3))
      void registrarUso(clinicId, fuente)
      return NextResponse.json({ ok: true, ...parsed, _schemaWarning: true })
    }

    void registrarUso(clinicId, fuente)
    return NextResponse.json({ ok: true, ...validation.data })
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
