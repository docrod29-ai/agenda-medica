/**
 * POST /api/consultor-evidencia  —  "OpenEvidence" propio
 *
 * El médico hace una PREGUNTA clínica en lenguaje natural y recibe una respuesta
 * SINTETIZADA y CITADA con literatura real de PubMed (NEJM/JAMA/Cochrane/Lancet…).
 *
 * Flujo:
 *  1) Un modelo convierte la pregunta (español) en una búsqueda óptima de PubMed.
 *  2) Se busca en PubMed (API pública gratis) → artículos + resúmenes.
 *  3) El modelo de razonamiento responde en español CITANDO solo esos artículos [n].
 *
 * NO reproduce texto completo de revistas de paga (derechos de autor): usa el
 * resumen público + la cita. Nivel Premium responde con Opus 4.8; Pro con Sonnet 5.
 *
 * Body: { pregunta, historial?: [{ rol:'user'|'ia', texto }] }
 * Resp: { ok, respuesta, articulos:[{pmid,titulo,revista,anio,url}] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/auth-server'
import { resolverClaveIA, registrarUso, nivelIADe } from '@/lib/ai-keys'
import { buscarEvidencia, type ArticuloPubMed } from '@/lib/evidencia/pubmed'
import { traducirBasico } from '@/lib/evidencia/traducir-medico'

export const runtime = 'nodejs'
export const maxDuration = 60
const AV = '2023-06-01'

async function claude(key: string, model: string, system: string, user: string, maxTokens: number) {
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': AV, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  })
}
function textoDe(data: unknown): string {
  const c = (data as { content?: { type?: string; text?: string }[] })?.content
  if (!Array.isArray(c)) return ''
  return c.find(b => b?.type === 'text')?.text ?? c[0]?.text ?? ''
}

export async function POST(req: NextRequest) {
  const acceso = await verificarUsuario(req)
  if (!acceso.ok) return acceso.response
  const { key, fuente, clinicId } = await resolverClaveIA(acceso.uid, 'anthropic', process.env.ANTHROPIC_API_KEY ?? '')
  if (!key) return NextResponse.json({ ok: false, error: 'No hay API key de Claude configurada.' }, { status: 503 })

  let body: { pregunta?: string; historial?: { rol: string; texto: string }[]; contextoPaciente?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }
  const pregunta = String(body.pregunta ?? '').trim()
  if (!pregunta) return NextResponse.json({ ok: false, error: 'Escribe tu pregunta clínica' }, { status: 400 })

  // Contexto del paciente (opcional): cuando se abre desde un expediente, la
  // respuesta se personaliza a ESE paciente (edad, dx, alergias, tratamiento).
  const paciente = String(body.contextoPaciente ?? '').trim().slice(0, 1500)
  const contexto = (body.historial ?? []).slice(-4).map(h => `${h.rol === 'user' ? 'Médico' : 'Asistente'}: ${h.texto}`).join('\n')

  try {
    // 1) Pregunta (ES) → búsqueda PubMed (EN). CRÍTICO: buscar en español da casi
    //    cero (ej. "finerenona" 6 vs "finerenone" 1136). Se traduce con una CASCADA
    //    de modelos (si uno no está en la cuenta, prueba el siguiente).
    let query = pregunta
    const MODELOS_TRAD = ['claude-3-5-haiku-latest', 'claude-haiku-4-5-20251001', 'claude-sonnet-5', 'claude-3-5-sonnet-latest']
    const sysTrad = 'Traduce la pregunta clínica a una búsqueda de PubMed en INGLÉS. Devuelve SOLO 2-6 términos clave en inglés (nombres de fármacos/enfermedades en su forma en inglés, ej. "finerenona"→"finerenone", "diosmina"→"diosmin"), unidos con AND/OR si aplica. Sin comillas, sin explicación, sin field tags.'
    const usrTrad = `${paciente ? 'Paciente: ' + paciente + '\n' : ''}${contexto ? contexto + '\n' : ''}Pregunta: ${pregunta}`
    for (const m of MODELOS_TRAD) {
      try {
        const rq = await claude(key, m, sysTrad, usrTrad, 120)
        if (rq.ok) {
          const t = textoDe(await rq.json()).replace(/^["'\s]+|["'\s]+$/g, '').slice(0, 300)
          if (t) { query = t; break }
        }
      } catch { /* prueba el siguiente modelo */ }
    }

    // 2) Buscar evidencia. Tres redes de seguridad para que NUNCA salga "0" en un
    //    tema real: (a) query de la IA; (b) traducción determinista ES→EN (sin IA);
    //    (c) la pregunta cruda.
    let articulos: ArticuloPubMed[] = await buscarEvidencia(query, { max: 8, aniosRecientes: 12 }).catch(() => [])
    if (articulos.length === 0) {
      const det = traducirBasico(pregunta)
      if (det) articulos = await buscarEvidencia(det, { max: 8, aniosRecientes: 12 }).catch(() => [])
    }
    if (articulos.length === 0 && query !== pregunta) {
      articulos = await buscarEvidencia(pregunta, { max: 8 }).catch(() => [])
    }
    if (articulos.length === 0) {
      return NextResponse.json({ ok: true, respuesta: 'No encontré evidencia en PubMed para esta pregunta. Prueba reformularla o con términos más específicos.', articulos: [] })
    }

    // 3) Responder citando.
    const nivel = await nivelIADe(clinicId)
    const model = nivel === 'premium' ? 'claude-opus-4-8' : 'claude-sonnet-5'
    const fuentes = articulos.map((a, i) => `[${i + 1}] ${a.revista} ${a.anio} · PMID ${a.pmid}\n${a.titulo}\n${a.resumen.slice(0, 700)}`).join('\n\n')
    const system = 'Eres un asistente clínico de medicina basada en evidencia para médicos. Responde la pregunta con una síntesis clara y accionable, en español, CITANDO con [n] los artículos de la lista que respaldan cada afirmación. Si se da contexto de un PACIENTE, personaliza la respuesta a ese caso (edad, comorbilidades, alergias, tratamiento actual) y advierte contraindicaciones o interacciones relevantes. REGLAS: cita SOLO los artículos dados (por su [n]); NUNCA inventes estudios, cifras ni fuentes; si la evidencia es limitada o no concluyente, dilo; no des indicaciones absolutas, apoya la decisión del médico. Termina con una línea "Nivel de evidencia: alto/moderado/bajo" según lo hallado.'
    const user = `${paciente ? 'PACIENTE (contexto):\n' + paciente + '\n\n' : ''}${contexto ? 'Conversación previa:\n' + contexto + '\n\n' : ''}PREGUNTA: ${pregunta}\n\nEVIDENCIA (PubMed):\n${fuentes}\n\nResponde citando [n].`

    let res = await claude(key, model, system, user, 2000)
    if (res.status === 404 || res.status === 400) res = await claude(key, 'claude-sonnet-5', system, user, 2000)
    if (!res.ok) return NextResponse.json({ ok: true, respuesta: `No pude sintetizar la respuesta (HTTP ${res.status}), pero aquí están los artículos relevantes.`, articulos })

    const respuesta = textoDe(await res.json()).trim() || 'Sin respuesta.'
    void registrarUso(clinicId, fuente)
    return NextResponse.json({ ok: true, respuesta, articulos })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 120) }, { status: 500 })
  }
}
