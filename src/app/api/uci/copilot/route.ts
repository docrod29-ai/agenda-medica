/**
 * POST /api/uci/copilot — ICU Copilot dual-model (Anthropic + OpenAI).
 *
 * `action: 'generar'` (default): recibe los CAMPOS del Panel UCI, arma en el
 * SERVIDOR el snapshot DETERMINISTA (los motores calculan; el LLM jamás), llama a
 * Claude (Opus/Sonnet) y a GPT en PARALELO con el mismo snapshot, y fusiona: el
 * primario manda y la 2ª opinión se muestra como divergencias. Nunca da órdenes.
 *
 * `action: 'feedback'`: guarda 👍/👎 + edición del médico → el Copilot "aprende"
 * (las preferencias aceptadas se reinyectan como estilo en futuras síntesis).
 *
 * Gateado por `verificarModuloIA` (mismo entitlement que la IA de consulta).
 * Las llaves viven server-side (llave del consultorio o env). No exponen PHI: el
 * snapshot son solo números de motores.
 */
import { NextRequest, NextResponse } from 'next/server'
import admin, { adminDb } from '@/lib/firebase-admin'
import { verificarModuloIA } from '@/lib/auth-server'
import { limitarOResponder } from '@/lib/rate-limit'
import { resolverClaveIA, registrarUso, registrarCreditos } from '@/lib/ai-keys'
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

/** Preferencias aprendidas: últimas notas de feedback 👍 con corrección del médico. */
async function preferenciasAprendidas(clinicId: string): Promise<string[]> {
  try {
    const snap = await adminDb.collection('clinics').doc(clinicId).collection('uci_copilot_feedback')
      .where('rating', '==', 'up').orderBy('ts', 'desc').limit(5).get()
    return snap.docs.map(d => d.data()?.preferencia as string).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
  } catch { return [] }
}

export async function POST(req: NextRequest) {
  const acceso = await verificarModuloIA(req, 'expediente')
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

  // ── FEEDBACK: el Copilot aprende ──
  if (body.action === 'feedback') {
    if (!acceso.clinicId) return NextResponse.json({ error: 'Sin consultorio' }, { status: 403 })
    try {
      await adminDb.collection('clinics').doc(acceso.clinicId).collection('uci_copilot_feedback').add({
        rating: body.feedback?.rating ?? 'up',
        preferencia: (body.feedback?.preferencia ?? '').slice(0, 500),
        snapshotHash: body.feedback?.snapshotHash ?? '',
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
  const campos = body.campos ?? {}
  const snapshot = snapshotUCI(campos)
  const preferencias = acceso.clinicId ? await preferenciasAprendidas(acceso.clinicId) : []
  const user = buildCopilotUser(snapshot, { discusion: body.discusion, tendencias: body.tendencias, preferencias })

  const anthropic = await resolverClaveIA(acceso.uid, 'anthropic', process.env.ANTHROPIC_API_KEY ?? '').catch(() => ({ key: '', fuente: 'ninguna' as const, clinicId: acceso.clinicId ?? null }))
  const openai = await resolverClaveIA(acceso.uid, 'openai', process.env.OPENAI_API_KEY ?? '').catch(() => ({ key: '', fuente: 'ninguna' as const }))
  if (!anthropic.key && !openai.key) {
    return NextResponse.json({ error: 'No hay llave de IA configurada. Agrega tu llave de Anthropic u OpenAI en Configuración.' }, { status: 400 })
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

  // Cuenta uso (medidor de créditos). El Copilot cuesta 1 crédito por modelo usado.
  const modelosUsados = (rc ? 1 : 0) + (ro ? 1 : 0)
  if (acceso.clinicId) {
    registrarCreditos(acceso.clinicId, modelosUsados).catch(() => {})
    registrarUso(acceso.clinicId, anthropic.fuente).catch(() => {})
  }

  // Si el primario (Anthropic) falló pero GPT respondió, GPT pasa a ser el primario.
  const fusion = primario
    ? fusionarCopilot(primario, segunda, { primario: rc?.model ?? null, segunda: ro?.model ?? null })
    : fusionarCopilot(segunda, null, { primario: ro?.model ?? null, segunda: null })

  return NextResponse.json({ ok: true, version: COPILOT_VERSION, ...fusion })
}
