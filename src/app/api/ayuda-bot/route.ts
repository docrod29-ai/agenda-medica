/**
 * POST /api/ayuda-bot  — Asistente de soporte de la app.
 *
 * Responde dudas de USO de Ausculta con base EXCLUSIVA en la guía (conocimiento.ts).
 * Usa Haiku (barato) porque es soporte. Si la pregunta no está en la guía, lo dice
 * y sugiere escribir a soporte. NO da consejo médico (para eso está el Consultor).
 *
 * Body: { pregunta, historial?: [{ rol:'user'|'bot', texto }] }
 * Resp: { ok, respuesta }
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/auth-server'
import { gateCreditos, resolverClaveIA  } from '@/lib/ai-keys'
import { conocimientoTexto } from '@/lib/ayuda/conocimiento'
import { limitarOResponder } from '@/lib/rate-limit'
import { llamarIA } from '@/lib/ia/gateway'

export const runtime = 'nodejs'
export const maxDuration = 30
const MODELOS = ['claude-haiku-4-5-20251001', 'claude-sonnet-5']

export async function POST(req: NextRequest) {
  const acceso = await verificarUsuario(req)
  if (!acceso.ok) return acceso.response

  // Tope de ráfaga: el bot cuesta por llamada y no consume créditos. 20/min por usuario.
  const limite = await limitarOResponder(`bot:${acceso.uid}`, 20, 60)
  if (limite) return limite

  const { key, clinicId, fuente } = await resolverClaveIA(acceso.uid, 'anthropic', process.env.ANTHROPIC_API_KEY ?? '')
  // TOPE DE CRÉDITOS (auditoría 26-jul): sin esto, un consultorio con los
  // créditos agotados seguía quemando la llave del dueño indefinidamente.
  // `gateCreditos` sólo corta cuando la llave es la del dueño (`prueba`):
  // con llave propia del consultorio NO se corta, porque paga su propia API.
  const corteCreditos = await gateCreditos(clinicId, fuente)
  if (corteCreditos) return corteCreditos
  if (!key) return NextResponse.json({ ok: false, error: 'Asistente no disponible ahora.' }, { status: 503 })

  let body: { pregunta?: string; historial?: { rol: string; texto: string }[] }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }
  const pregunta = String(body.pregunta ?? '').trim().slice(0, 800)
  if (!pregunta) return NextResponse.json({ ok: false, error: 'Escribe tu pregunta' }, { status: 400 })

  const contexto = (body.historial ?? []).slice(-6).map(h => `${h.rol === 'user' ? 'Usuario' : 'Asistente'}: ${h.texto}`).join('\n')

  const system = `Eres el asistente de soporte de Ausculta, una app médica (agenda, expediente, notas con IA, recetas, hospitalización). Ayudas a los usuarios a USAR la app. Responde SIEMPRE en español, claro y breve (como a alguien que no es técnico), con pasos numerados cuando aplique.

REGLAS:
- Responde SOLO con base en la GUÍA de abajo. Si la respuesta no está en la guía, dilo con honestidad y sugiere: "escríbelo en Configuración → Soporte y sugerencias y el equipo te ayuda".
- NUNCA inventes funciones que no existan en la guía.
- NO des consejo médico ni clínico (dosis, diagnósticos). Si preguntan algo clínico, di que para eso está el "Consultor de IA" dentro de la app.
- Sé amable y resolutivo. Si es una queja o falla, reconócela y explica cómo reportarla en Soporte.

GUÍA DE LA APP:
${conocimientoTexto()}`

  const user = `${contexto ? 'Conversación previa:\n' + contexto + '\n\n' : ''}Pregunta del usuario: ${pregunta}`

  // Por el gateway (§P–T). El bot de ayuda no cobra créditos al médico, pero sí
  // cuesta tokens: sin asiento, ese gasto no existía en ningún lado.
  const r = await llamarIA(
    { proveedor: 'anthropic', clave: key, modelos: MODELOS, system, user, maxTokens: 900 },
    // El asiento iba con `clinicId: null, uid: null, fuente: 'prueba'` FIJOS, así que
    // el gasto del bot de ayuda no se podía atribuir a nadie en el libro de costos.
    // Los créditos siguen en 0 A PROPÓSITO: preguntar cómo se usa la aplicación no
    // se le cobra al médico. Lo que no puede ser es que el gasto sea anónimo.
    { feature: 'ayuda-bot', requestId: req.headers.get('x-vercel-id') || `ab-${acceso.uid}-${Date.now()}`, clinicId: clinicId ?? null, uid: acceso.uid, creditos: 0, fuente },
  )
  if (r.ok && r.texto.trim()) return NextResponse.json({ ok: true, respuesta: r.texto.trim() })

  return NextResponse.json({ ok: true, respuesta: 'Ahora no pude responder. Escribe tu duda en Configuración → Soporte y sugerencias y el equipo te ayuda.' })
}
