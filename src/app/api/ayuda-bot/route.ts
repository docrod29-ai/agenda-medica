/**
 * POST /api/ayuda-bot  — Asistente de soporte de la app.
 *
 * Responde dudas de USO de NexusMED con base EXCLUSIVA en la guía (conocimiento.ts).
 * Usa Haiku (barato) porque es soporte. Si la pregunta no está en la guía, lo dice
 * y sugiere escribir a soporte. NO da consejo médico (para eso está el Consultor).
 *
 * Body: { pregunta, historial?: [{ rol:'user'|'bot', texto }] }
 * Resp: { ok, respuesta }
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/auth-server'
import { resolverClaveIA } from '@/lib/ai-keys'
import { conocimientoTexto } from '@/lib/ayuda/conocimiento'
import { limitarOResponder } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 30
const AV = '2023-06-01'
const MODELOS = ['claude-haiku-4-5-20251001', 'claude-3-5-haiku-latest', 'claude-sonnet-5']

export async function POST(req: NextRequest) {
  const acceso = await verificarUsuario(req)
  if (!acceso.ok) return acceso.response

  // Tope de ráfaga: el bot cuesta por llamada y no consume créditos. 20/min por usuario.
  const limite = await limitarOResponder(`bot:${acceso.uid}`, 20, 60)
  if (limite) return limite

  const { key } = await resolverClaveIA(acceso.uid, 'anthropic', process.env.ANTHROPIC_API_KEY ?? '')
  if (!key) return NextResponse.json({ ok: false, error: 'Asistente no disponible ahora.' }, { status: 503 })

  let body: { pregunta?: string; historial?: { rol: string; texto: string }[] }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }
  const pregunta = String(body.pregunta ?? '').trim().slice(0, 800)
  if (!pregunta) return NextResponse.json({ ok: false, error: 'Escribe tu pregunta' }, { status: 400 })

  const contexto = (body.historial ?? []).slice(-6).map(h => `${h.rol === 'user' ? 'Usuario' : 'Asistente'}: ${h.texto}`).join('\n')

  const system = `Eres el asistente de soporte de NexusMED, una app médica (agenda, expediente, notas con IA, recetas, hospitalización). Ayudas a los usuarios a USAR la app. Responde SIEMPRE en español, claro y breve (como a alguien que no es técnico), con pasos numerados cuando aplique.

REGLAS:
- Responde SOLO con base en la GUÍA de abajo. Si la respuesta no está en la guía, dilo con honestidad y sugiere: "escríbelo en Configuración → Soporte y sugerencias y el equipo te ayuda".
- NUNCA inventes funciones que no existan en la guía.
- NO des consejo médico ni clínico (dosis, diagnósticos). Si preguntan algo clínico, di que para eso está el "Consultor de IA" dentro de la app.
- Sé amable y resolutivo. Si es una queja o falla, reconócela y explica cómo reportarla en Soporte.

GUÍA DE LA APP:
${conocimientoTexto()}`

  const user = `${contexto ? 'Conversación previa:\n' + contexto + '\n\n' : ''}Pregunta del usuario: ${pregunta}`

  for (const model of MODELOS) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': AV, 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 900, system, messages: [{ role: 'user', content: user }] }),
      })
      if (!r.ok) continue
      const d = await r.json()
      const c = (d?.content as { type?: string; text?: string }[]) ?? []
      const texto = (c.find(b => b?.type === 'text')?.text ?? c[0]?.text ?? '').trim()
      if (texto) return NextResponse.json({ ok: true, respuesta: texto })
    } catch { /* siguiente modelo */ }
  }
  return NextResponse.json({ ok: true, respuesta: 'Ahora no pude responder. Escribe tu duda en Configuración → Soporte y sugerencias y el equipo te ayuda.' })
}
