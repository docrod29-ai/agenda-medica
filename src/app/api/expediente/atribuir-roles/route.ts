/**
 * POST /api/expediente/atribuir-roles
 *
 * Toma los turnos de habla diarizados (Hablante A/B/C… de AssemblyAI, que son
 * anónimos) y decide con Claude QUIÉN es cada quién: Médico, Paciente o
 * Acompañante — usando el contenido clínico (quién pregunta/explora/indica vs
 * quién describe síntomas). Esto es lo que ningún diarizador acústico hace solo
 * y lo que vuelve la separación médico-paciente automática ("perfecta"), sin que
 * el médico tenga que etiquetar a mano.
 *
 * Body: { utterances: [{ speaker, text }] }
 * Resp: { ok, roles: { "A": "Médico", "B": "Paciente", ... } }
 *
 * Si algo falla devuelve { ok:false } y el cliente deja el etiquetado manual —
 * nunca rompe el flujo.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/auth-server'
import { resolverClaveIA } from '@/lib/ai-keys'

export const runtime = 'nodejs'
export const maxDuration = 30

const ANTHROPIC_VERSION = '2023-06-01'
const MODELOS = ['claude-sonnet-5', 'claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-3-5-sonnet-latest']
const ROLES_VALIDOS = new Set(['Médico', 'Paciente', 'Acompañante'])

export async function POST(req: NextRequest) {
  const acceso = await verificarUsuario(req)
  if (!acceso.ok) return acceso.response

  const { key } = await resolverClaveIA(acceso.uid, 'anthropic', process.env.ANTHROPIC_API_KEY ?? '')
  if (!key) return NextResponse.json({ ok: false, error: 'sin llave' }, { status: 503 })

  let body: { utterances?: { speaker?: string; text?: string }[] }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  const utts = (body.utterances ?? []).filter(u => u && typeof u.text === 'string')
  if (utts.length === 0) return NextResponse.json({ ok: false, error: 'sin turnos' }, { status: 400 })

  // Hablantes presentes (para acotar la respuesta y validar).
  const hablantes = Array.from(new Set(utts.map(u => String(u.speaker ?? '?'))))

  // Muestra acotada: primeros ~40 turnos / ~4000 chars bastan para inferir roles
  // (no hace falta mandar toda la consulta → más rápido y barato).
  let muestra = ''
  for (const u of utts) {
    const linea = `Hablante ${u.speaker}: ${u.text}\n`
    if (muestra.length + linea.length > 4000) break
    muestra += linea
  }

  const system = 'Eres un asistente clínico. Recibes el diálogo de una consulta médica transcrito con hablantes anónimos (Hablante A, B, C…). Determina el ROL de cada hablante: "Médico" (pregunta, explora, explica, indica tratamiento), "Paciente" (describe síntomas y molestias) o "Acompañante" (familiar/cuidador que apoya). Responde ÚNICAMENTE un objeto JSON que mapee cada letra de hablante a su rol, sin texto extra. Ejemplo: {"A":"Médico","B":"Paciente"}.'
  const userMsg = `Hablantes: ${hablantes.join(', ')}\n\nDiálogo:\n${muestra}\n\nResponde solo el JSON.`

  async function llamar(model: string) {
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key as string, 'anthropic-version': ANTHROPIC_VERSION, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 300, system, messages: [{ role: 'user', content: userMsg }] }),
    })
  }

  try {
    let res = await llamar(MODELOS[0])
    // 404 = modelo no disponible en la cuenta → prueba el siguiente
    for (let i = 1; i < MODELOS.length && res.status === 404; i++) res = await llamar(MODELOS[i])
    if (!res.ok) return NextResponse.json({ ok: false, error: `Claude HTTP ${res.status}` }, { status: 502 })

    const data = await res.json()
    const text: string = data.content?.[0]?.text ?? ''
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return NextResponse.json({ ok: false, error: 'sin JSON' }, { status: 502 })

    const crudo = JSON.parse(m[0]) as Record<string, unknown>
    // Sanea: solo hablantes conocidos y roles válidos.
    const roles: Record<string, string> = {}
    for (const h of hablantes) {
      const r = String(crudo[h] ?? '').trim()
      if (ROLES_VALIDOS.has(r)) roles[h] = r
    }
    return NextResponse.json({ ok: true, roles })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 120) }, { status: 500 })
  }
}
