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
import { resolverClaveIA, registrarUso, nivelIADe, registrarConsultor, creditosUsadosDelMes, creditosExtraDelMes } from '@/lib/ai-keys'
import { costoConsultor, planPorNivel } from '@/lib/planes-ia'
import { buscarEvidencia, type ArticuloPubMed } from '@/lib/evidencia/pubmed'
import { traducirBasico, farmacosDetectados } from '@/lib/evidencia/traducir-medico'
import { dosisFDA } from '@/lib/evidencia/openfda'

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

/** Llama a OpenAI (segundo cerebro) para refinar. Devuelve el texto o null. */
async function openaiRefinar(key: string, model: string, system: string, user: string): Promise<string | null> {
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_completion_tokens: 2200 }),
    })
    if (!r.ok) return null
    const d = await r.json()
    const t = String(d?.choices?.[0]?.message?.content ?? '').trim()
    return t || null
  } catch { return null }
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

    // 2b) DOSIS oficial (openFDA): si se detecta un fármaco, trae su dosis
    //     etiquetada (autoritativa, no inventada). Y arma un enlace a la GPC de
    //     CENETEC (no hay API mexicana; se ofrece búsqueda directa del catálogo).
    const farmacos = farmacosDetectados(`${pregunta} ${query}`)
    const dosis = farmacos[0] ? await dosisFDA(farmacos[0]).catch(() => null) : null
    const cenetecUrl = `https://www.google.com/search?q=${encodeURIComponent(pregunta + ' guía de práctica clínica CENETEC GPC México')}`

    // 3) Responder citando.
    const nivel = await nivelIADe(clinicId)

    // TOPE DURO de créditos: el Consultor gasta del MISMO bote que las notas, pero
    // una FRACCIÓN por pregunta (según la IA del plan). Solo aplica con la llave del
    // dueño ('prueba'); un consultorio con su propia llave paga su uso y no se topa.
    // Si ya no alcanza, la IA se PAUSA (402) y el cliente ve "compra más / sube de plan".
    const costo = costoConsultor(nivel)
    if (fuente === 'prueba') {
      const [usados, extra] = await Promise.all([creditosUsadosDelMes(clinicId), creditosExtraDelMes(clinicId)])
      const limite = planPorNivel(nivel).creditos + extra
      if (usados + costo > limite) {
        return NextResponse.json({
          ok: false, sinCreditos: true, usados, limite,
          error: `Se acabaron tus créditos con IA del mes (${usados}/${limite}). Compra más o sube de plan.`,
        }, { status: 402 })
      }
    }

    const model = nivel === 'premium' ? 'claude-opus-4-8' : 'claude-sonnet-5'
    const fuentes = articulos.map((a, i) => `[${i + 1}] ${a.revista} ${a.anio} · PMID ${a.pmid}\n${a.titulo}\n${a.resumen.slice(0, 700)}`).join('\n\n')
    const dosisTxt = dosis ? `\n\nDOSIS OFICIAL (ficha técnica FDA, ${dosis.farmaco}):\n${dosis.dosis}` : ''
    const system = 'Eres un asistente clínico de medicina basada en evidencia para médicos en MÉXICO. Responde con una síntesis clara y accionable, en español, CITANDO con [n] los artículos de la lista que respaldan cada afirmación. Si se da contexto de un PACIENTE, personaliza (edad, comorbilidades, alergias, tratamiento) y advierte contraindicaciones/interacciones. Si la pregunta es sobre un fármaco o tratamiento, incluye una sección **Dosis**: usa la "DOSIS OFICIAL (FDA)" que se te dé (indica que es de la etiqueta FDA y que debe ajustarse a función renal/hepática y peso, y verificarse con el Cuadro Básico); si no se te da, indica la dosis estándar de referencia y adviértelo. Cuando aplique, agrega una línea **Guía en México**: menciona la GPC de CENETEC o la NOM pertinente si la conoces (por su nombre), aclarando que debe consultarse el documento oficial. REGLAS: cita SOLO los artículos dados por su [n]; NUNCA inventes estudios, PMIDs ni cifras; si la evidencia es limitada, dilo; apoya la decisión del médico, no des órdenes absolutas. Termina con "Nivel de evidencia: alto/moderado/bajo".'
    const user = `${paciente ? 'PACIENTE (contexto):\n' + paciente + '\n\n' : ''}${contexto ? 'Conversación previa:\n' + contexto + '\n\n' : ''}PREGUNTA: ${pregunta}\n\nEVIDENCIA (PubMed):\n${fuentes}${dosisTxt}\n\nResponde citando [n].`

    let res = await claude(key, model, system, user, 2200)
    if (res.status === 404 || res.status === 400) res = await claude(key, 'claude-sonnet-5', system, user, 2200)
    if (!res.ok) return NextResponse.json({ ok: true, respuesta: `No pude sintetizar la respuesta (HTTP ${res.status}), pero aquí están los artículos relevantes.`, articulos, cenetecUrl })

    let respuesta = textoDe(await res.json()).trim() || 'Sin respuesta.'
    const modelos: string[] = [nivel === 'premium' ? 'Claude Opus 4.8' : 'Claude Sonnet 5']

    // 4) SEGUNDO CEREBRO (OpenAI): revisa y MEJORA la respuesta de Claude contra la
    //    misma evidencia — corrige, añade matices, quita lo no sustentado. Si no hay
    //    llave de OpenAI, se queda la de Claude (nunca rompe).
    if (respuesta && respuesta !== 'Sin respuesta.') {
      try {
        const { key: openaiKey } = await resolverClaveIA(acceso.uid, 'openai', process.env.OPENAI_API_KEY ?? '')
        if (openaiKey) {
          const modeloGPT = nivel === 'premium' ? 'gpt-5' : 'gpt-4o'
          const sysR = 'Eres un SEGUNDO médico revisor de medicina basada en evidencia. Recibes una pregunta clínica, la evidencia (PubMed) y una respuesta preliminar de otro modelo de IA. MEJORA la respuesta FINAL: corrige errores, añade matices o puntos importantes que falten SEGÚN la evidencia dada, elimina afirmaciones no sustentadas, y verifica que las citas [n] sean correctas (NO inventes citas, PMIDs ni cifras). Conserva el español, el formato (secciones, Dosis, Guía en México, "Nivel de evidencia") y las citas. Devuelve SOLO la respuesta final mejorada, sin meta-comentarios sobre el proceso.'
          const userR = `PREGUNTA: ${pregunta}\n\nEVIDENCIA (PubMed):\n${fuentes}${dosisTxt}\n\nRESPUESTA PRELIMINAR (de otro modelo, mejórala):\n${respuesta}\n\nDevuelve la respuesta final mejorada.`
          const refinada = await openaiRefinar(openaiKey, modeloGPT, sysR, userR)
          if (refinada) { respuesta = refinada; modelos.push(nivel === 'premium' ? 'GPT-5' : 'GPT-4o') }
        }
      } catch { /* se queda la respuesta de Claude */ }
    }

    void registrarUso(clinicId, fuente)
    void registrarConsultor(clinicId, costo)  // descuenta la fracción de crédito del mes
    return NextResponse.json({ ok: true, respuesta, articulos, cenetecUrl, dosisFDA: dosis, modelos })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 120) }, { status: 500 })
  }
}
