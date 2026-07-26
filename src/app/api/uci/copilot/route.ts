/**
 * POST /api/uci/copilot — ICU Copilot dual-model (Anthropic + OpenAI).
 *
 * `action: 'generar'` (default): recibe los CAMPOS del Panel UCI, arma en el
 * SERVIDOR el snapshot DETERMINISTA (los motores calculan; el LLM jamás), llama a
 * Claude (Opus/Sonnet) y a GPT en PARALELO con el mismo snapshot, y fusiona: el
 * primario manda y la 2ª opinión se muestra como divergencias. Nunca da órdenes.
 *
 * `action: 'feedback'`: guarda SOLO el 👍/👎 (señal de telemetría). NO se guarda
 * ni se reinyecta ningún cuadro clínico del paciente entre sesiones (ver abajo).
 *
 * Gateado por `verificarModuloIA` (mismo entitlement que la IA de consulta).
 * Las llaves viven server-side (llave del consultorio o env). El SNAPSHOT son solo
 * números de motores (sin PHI); pero la `discusion` del pase y las `tendencias` son
 * TEXTO LIBRE que podría contener identificadores si el médico los dicta — se envían
 * al proveedor de IA. No escribir nombres/identificadores en el pase.
 */
import { NextRequest, NextResponse } from 'next/server'
import admin, { adminDb } from '@/lib/firebase-admin'
import { verificarModuloIA } from '@/lib/auth-server'
import { limitarOResponder } from '@/lib/rate-limit'
import { resolverClaveIA, registrarUso, registrarCreditos, creditosAgotados, pruebaAgotada } from '@/lib/ai-keys'
import { COSTO_CREDITOS } from '@/lib/planes-ia'
import { snapshotUCI, buildCopilotUser, COPILOT_SYSTEM, parseSalidaCopilot, fusionarCopilot, COPILOT_VERSION } from '@/lib/uci/copilot'
import { safeLog } from '@/lib/security/sanitize'

const ANTHROPIC_VERSION = '2023-06-01'
const MODELOS_CLAUDE = ['claude-opus-4-8', 'claude-sonnet-5', 'claude-sonnet-4-5', 'claude-3-5-sonnet-latest']
const MODELOS_OPENAI = ['gpt-5', 'gpt-4o']

async function llamarClaude(key: string, user: string): Promise<{ texto: string; model: string } | null> {
  async function intento(model: string) {
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION, 'content-type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: 4000,
        system: [{ type: 'text', text: COPILOT_SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: user }],
      }),
    })
  }
  try {
    let res = await intento(MODELOS_CLAUDE[0])
    for (let i = 1; i < MODELOS_CLAUDE.length && (res.status === 404 || res.status === 400); i++) res = await intento(MODELOS_CLAUDE[i])
    if (!res.ok) return null
    const data = await res.json()
    const texto: string = (data.content ?? []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('') ?? ''
    return { texto, model: data.model ?? MODELOS_CLAUDE[0] }
  } catch { return null }
}

async function llamarOpenAI(key: string, user: string): Promise<{ texto: string; model: string } | null> {
  async function intento(model: string) {
    return fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: COPILOT_SYSTEM }, { role: 'user', content: user }], response_format: { type: 'json_object' }, max_completion_tokens: 4000 }),
    })
  }
  try {
    let res = await intento(MODELOS_OPENAI[0])
    for (let i = 1; i < MODELOS_OPENAI.length && (res.status === 404 || res.status === 400); i++) res = await intento(MODELOS_OPENAI[i])
    if (!res.ok) return null
    const data = await res.json()
    return { texto: data.choices?.[0]?.message?.content ?? '', model: data.model ?? MODELOS_OPENAI[0] }
  } catch { return null }
}

export async function POST(req: NextRequest) {
  const acceso = await verificarModuloIA(req, 'uci')
  if (!acceso.ok) return acceso.response

  const limite = await limitarOResponder(`uci-copilot:${acceso.uid}`, 20, 60, 'Demasiadas solicitudes al Copilot; espera un momento.')
  if (limite) return limite

  const body = await req.json().catch(() => ({})) as {
    action?: 'generar' | 'feedback'
    campos?: Record<string, string>
    discusion?: string
    tendencias?: string
    internamientoId?: string
    feedback?: { rating?: 'up' | 'down'; preferencia?: string; snapshotHash?: string }
  }

  // ── FEEDBACK: solo señal (rating) para telemetría ──
  // SEGURIDAD/PHI: NO se guarda ningún resumen clínico del paciente. Antes se
  // almacenaba el cuadro del paciente como 'preferencia' y se REINYECTABA en el
  // razonamiento de OTROS pacientes (mezcla de PHI + aprender medicina de casos
  // individuales, prohibido). El Copilot NO aprende medicina; a lo sumo, más
  // adelante, estilo/formato bajo un pipeline supervisado y anonimizado.
  if (body.action === 'feedback') {
    if (!acceso.clinicId) return NextResponse.json({ error: 'Sin consultorio' }, { status: 403 })
    try {
      await adminDb.collection('clinics').doc(acceso.clinicId).collection('uci_copilot_feedback').add({
        rating: body.feedback?.rating === 'down' ? 'down' : 'up',
        internamientoId: body.internamientoId ?? '',
        medicoUid: acceso.uid, medicoEmail: acceso.email ?? '',
        ts: admin.firestore.FieldValue.serverTimestamp(),
      })
      return NextResponse.json({ ok: true })
    } catch (e) {
      safeLog.error('[uci-copilot] feedback', e)
      return NextResponse.json({ error: 'No se pudo guardar el feedback' }, { status: 500 })
    }
  }

  // ── GENERAR ──
  // NO se reinyecta ninguna "preferencia" clínica de feedback previo (evita cruzar
  // el cuadro de un paciente al razonamiento de otro). El prompt lleva solo el
  // snapshot determinista de ESTE paciente + su discusión/tendencias.
  const campos = body.campos ?? {}
  const snapshot = snapshotUCI(campos)
  const user = buildCopilotUser(snapshot, { discusion: body.discusion, tendencias: body.tendencias })

  const anthropic = await resolverClaveIA(acceso.uid, 'anthropic', process.env.ANTHROPIC_API_KEY ?? '').catch(() => ({ key: '', fuente: 'ninguna' as const, clinicId: acceso.clinicId ?? null }))
  const openai = await resolverClaveIA(acceso.uid, 'openai', process.env.OPENAI_API_KEY ?? '').catch(() => ({ key: '', fuente: 'ninguna' as const }))
  if (!anthropic.key && !openai.key) {
    return NextResponse.json({ error: 'No hay llave de IA configurada. Agrega tu llave de Anthropic u OpenAI en Configuración.' }, { status: 400 })
  }

  // RED DE SEGURIDAD DE COSTO (anti-fuga): si el Copilot corre sobre la LLAVE DEL
  // DUEÑO (fuente 'prueba' — el consultorio no configuró la suya), NO se permite
  // quemar el dual-model premium (~$10/turno) sin límite. Se corta si ya se
  // agotaron los créditos o el tope de prueba, igual que la nota. Con llave propia
  // del consultorio ('clinica') no aplica: paga su propia API.
  const sobreLlaveDelDueno = anthropic.fuente === 'prueba' || openai.fuente === 'prueba'
  if (sobreLlaveDelDueno && acceso.clinicId) {
    const [agotados, prueba] = await Promise.all([
      creditosAgotados(acceso.clinicId).catch(() => false),
      pruebaAgotada(acceso.clinicId).catch(() => false),
    ])
    if (agotados || prueba) {
      return NextResponse.json({ error: 'Créditos de IA agotados este mes. Recarga créditos o configura tu propia llave de IA en Configuración para seguir usando el Copilot de UCI.' }, { status: 402 })
    }
  }

  const [rc, ro] = await Promise.all([
    anthropic.key ? llamarClaude(anthropic.key, user) : Promise.resolve(null),
    openai.key ? llamarOpenAI(openai.key, user) : Promise.resolve(null),
  ])
  const primario = rc ? parseSalidaCopilot(rc.texto) : null
  const segunda = ro ? parseSalidaCopilot(ro.texto) : null

  if (!primario && !segunda) {
    return NextResponse.json({ error: 'El Copilot no pudo generar la síntesis (ambos modelos fallaron o no hay llaves válidas).' }, { status: 502 })
  }

  // MEDIDOR DE CRÉDITOS: el Copilot UCI es la acción MÁS CARA (Opus + GPT en
  // paralelo, ~$10/turno). Se cobra su costo real en créditos (antes valía 0 = la
  // mayor fuga de dinero). Se cobra una vez por turno cuando respondió ≥1 modelo.
  if (acceso.clinicId && (rc || ro)) {
    registrarCreditos(acceso.clinicId, COSTO_CREDITOS.copilotUci).catch(() => {})
    // Atribuir el uso a la fuente del modelo que REALMENTE respondió (si Anthropic
    // no tenía llave pero OpenAI sí consumió la env del dueño, no marcarlo 'ninguna').
    registrarUso(acceso.clinicId, rc ? anthropic.fuente : openai.fuente).catch(() => {})
  }

  // Si el primario (Anthropic) falló pero GPT respondió, GPT pasa a ser el primario.
  const fusion = primario
    ? fusionarCopilot(primario, segunda, { primario: rc?.model ?? null, segunda: ro?.model ?? null })
    : fusionarCopilot(segunda, null, { primario: ro?.model ?? null, segunda: null })

  return NextResponse.json({ ok: true, version: COPILOT_VERSION, ...fusion })
}
