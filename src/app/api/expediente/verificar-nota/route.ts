/**
 * POST /api/expediente/verificar-nota  —  SEGUNDA OPINIÓN (verificación cruzada)
 *
 * La nota la redacta Claude Opus 4.8 (razonamiento máximo). Aquí un SEGUNDO
 * modelo de primer nivel (OpenAI GPT-5) la REVISA por seguridad clínica: dosis
 * peligrosas, interacciones, alergias del paciente vs fármacos, contradicciones
 * con lo dicho en la consulta, diagnósticos sin sustento, datos críticos que
 * faltan. NO reescribe la nota — solo señala hallazgos para que el médico decida
 * (mantiene al médico en control, respeta la inmutabilidad NOM-004).
 *
 * Reusa OPENAI_API_KEY (la misma de la transcripción) → normalmente sin llave
 * nueva. Es no-bloqueante: si falla, la nota sigue igual.
 *
 * Body: { nota: {resumen, secciones, diagnosticos, medicamentos, signos}, transcripcion, contexto }
 * Resp: { ok, modelo, hallazgos: [{ severidad, tema, problema, sugerencia }] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/auth-server'
import { resolverClaveIA, registrarUso } from '@/lib/ai-keys'

export const runtime = 'nodejs'
export const maxDuration = 45

// Mejor razonamiento de OpenAI primero; respaldo a gpt-4o si la cuenta no tiene gpt-5.
const MODELOS_OPENAI = ['gpt-5', 'gpt-4o']

interface NotaEntrada {
  resumen?: string
  secciones?: { titulo?: string; contenido?: string }[]
  diagnosticos?: { descripcion?: string; cie10?: string }[]
  medicamentos?: { nombre?: string; dosis?: string; via?: string; frecuencia?: string; duracion?: string }[]
  signos?: Record<string, unknown>
}

export async function POST(req: NextRequest) {
  const acceso = await verificarUsuario(req)
  if (!acceso.ok) return acceso.response

  const { key, fuente, clinicId } = await resolverClaveIA(acceso.uid, 'openai', process.env.OPENAI_API_KEY)
  if (!key) return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY no configurada' }, { status: 503 })

  let body: { nota?: NotaEntrada; transcripcion?: string; contexto?: Record<string, unknown> }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  const nota = body.nota
  if (!nota) return NextResponse.json({ ok: false, error: 'Falta nota' }, { status: 400 })

  // Serializa la nota a texto legible para el revisor.
  const notaTexto = [
    nota.resumen ? `RESUMEN: ${nota.resumen}` : '',
    (nota.secciones ?? []).map(s => `${s.titulo ?? ''}: ${s.contenido ?? ''}`).join('\n'),
    (nota.diagnosticos ?? []).length ? 'DIAGNÓSTICOS:\n' + nota.diagnosticos!.map(d => `- ${d.descripcion ?? ''}${d.cie10 ? ` (${d.cie10})` : ''}`).join('\n') : '',
    (nota.medicamentos ?? []).length ? 'MEDICAMENTOS:\n' + nota.medicamentos!.map(m => `- ${m.nombre ?? ''} ${m.dosis ?? ''} ${m.via ?? ''} ${m.frecuencia ?? ''} ${m.duracion ?? ''}`.trim()).join('\n') : '',
    nota.signos && Object.keys(nota.signos).length ? 'SIGNOS: ' + JSON.stringify(nota.signos) : '',
  ].filter(Boolean).join('\n\n')

  const ctx = body.contexto ?? {}
  const alergias = Array.isArray(ctx.alergias) ? (ctx.alergias as string[]).join(', ') : (ctx.alergias ?? 'no referidas')

  const system = 'Eres un médico revisor experto en seguridad del paciente. Revisas una nota clínica ya redactada contra la transcripción de la consulta y los datos del paciente. Señala SOLO problemas de seguridad o congruencia REALES: dosis peligrosas o fuera de rango, interacciones farmacológicas, fármaco recetado contra una alergia del paciente, contradicciones entre la nota y lo dicho, diagnósticos sin sustento en la transcripción, o datos críticos faltantes. NO reescribas la nota. NO inventes problemas si no los hay. Responde SOLO un objeto JSON: {"hallazgos":[{"severidad":"alta|media|baja","tema":"...","problema":"...","sugerencia":"..."}]}. Si todo está correcto, devuelve {"hallazgos":[]}.'
  const userMsg = `PACIENTE: edad ${ctx.edad ?? '?'}, sexo ${ctx.sexo ?? '?'}, alergias: ${alergias}.\n\nTRANSCRIPCIÓN DE LA CONSULTA:\n${(body.transcripcion ?? '').slice(0, 12000)}\n\nNOTA GENERADA A REVISAR:\n${notaTexto.slice(0, 12000)}\n\nDevuelve solo el JSON de hallazgos.`

  async function llamar(model: string) {
    return fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: userMsg }],
        response_format: { type: 'json_object' },
        max_completion_tokens: 2000,
      }),
    })
  }

  try {
    let usado = MODELOS_OPENAI[0]
    let res = await llamar(usado)
    // Si el modelo no existe / no lo permite la cuenta (400/404), prueba el respaldo.
    for (let i = 1; i < MODELOS_OPENAI.length && (res.status === 404 || res.status === 400); i++) {
      usado = MODELOS_OPENAI[i]
      res = await llamar(usado)
    }
    if (!res.ok) return NextResponse.json({ ok: false, error: `OpenAI HTTP ${res.status}` }, { status: 502 })

    const data = await res.json()
    const text: string = data.choices?.[0]?.message?.content ?? ''
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return NextResponse.json({ ok: true, modelo: usado, hallazgos: [] })

    const parsed = JSON.parse(m[0]) as { hallazgos?: unknown }
    const SEV = new Set(['alta', 'media', 'baja'])
    const hallazgos = (Array.isArray(parsed.hallazgos) ? parsed.hallazgos : [])
      .filter((h): h is Record<string, string> => !!h && typeof h === 'object')
      .map(h => ({
        severidad: SEV.has(String(h.severidad)) ? String(h.severidad) : 'media',
        tema: String(h.tema ?? '').slice(0, 120),
        problema: String(h.problema ?? '').slice(0, 400),
        sugerencia: String(h.sugerencia ?? '').slice(0, 400),
      }))
      .filter(h => h.problema)

    void registrarUso(clinicId, fuente)
    return NextResponse.json({ ok: true, modelo: usado, hallazgos })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 120) }, { status: 500 })
  }
}
