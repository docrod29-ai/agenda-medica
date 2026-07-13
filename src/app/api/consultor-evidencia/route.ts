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
import { leerMemoriaMedico, textoMemoria, aprenderDeMedico } from '@/lib/memoria-medico'

export const runtime = 'nodejs'
export const maxDuration = 300  // el Consultor encadena varios modelos; margen amplio (se topa al plan de Vercel)
const AV = '2023-06-01'

async function claude(key: string, model: string, system: string, user: string, maxTokens: number, timeoutMs = 55000) {
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': AV, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
    signal: AbortSignal.timeout(timeoutMs),  // no colgar indefinido → aborta y el caller degrada
  })
}
function textoDe(data: unknown): string {
  const c = (data as { content?: { type?: string; text?: string }[] })?.content
  if (!Array.isArray(c)) return ''
  return c.find(b => b?.type === 'text')?.text ?? c[0]?.text ?? ''
}

/**
 * Extrae 0-2 hechos DURABLES de las preferencias/práctica del médico para la
 * memoria (como ChatGPT/Claude). Usa Haiku (barato). Nunca lanza.
 */
async function extraerAprendizajes(key: string, pregunta: string, respuesta: string): Promise<string[]> {
  try {
    const sys = 'Extrae 0-2 hechos DURABLES sobre las PREFERENCIAS o la PRÁCTICA del MÉDICO que valga la pena recordar a largo plazo (su especialidad, fármacos/esquemas que prefiere, población de pacientes que atiende, estilo de respuesta que pide). NUNCA extraigas datos de pacientes, diagnósticos de un paciente concreto, ni cosas efímeras. Devuelve SOLO un array JSON de cadenas cortas en español (ej. ["Prefiere esquemas antibióticos cortos","Atiende sobre todo pacientes con VIH"]), o [] si no hay nada digno de recordar.'
    const usr = `Pregunta del médico: ${pregunta}\n\nRespuesta dada:\n${respuesta.slice(0, 900)}`
    const r = await claude(key, 'claude-haiku-4-5-20251001', sys, usr, 200)
    if (!r.ok) return []
    const t = textoDe(await r.json())
    const m = t.match(/\[[\s\S]*\]/)
    if (!m) return []
    const arr = JSON.parse(m[0])
    return Array.isArray(arr) ? arr.filter((x: unknown) => typeof x === 'string').slice(0, 2) : []
  } catch { return [] }
}

/** Llama a OpenAI (segundo cerebro) para refinar. Devuelve el texto o null. */
async function openaiRefinar(key: string, model: string, system: string, user: string): Promise<string | null> {
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_completion_tokens: 2600 }),
      signal: AbortSignal.timeout(28000),  // 2º cerebro es un extra: si tarda, se queda la respuesta de Claude
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
        const rq = await claude(key, m, sysTrad, usrTrad, 120, 15000)
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
    const cenetecUrl = `https://www.google.com/search?q=${encodeURIComponent(pregunta + ' guía de práctica clínica CENETEC GPC México')}`

    // Nivel + TOPE DURO de créditos (aplica HAYA o NO evidencia — ambos gastan IA).
    // Solo con la llave del dueño ('prueba'); con llave propia paga su uso y no se topa.
    const nivel = await nivelIADe(clinicId)
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

    // Memoria del médico: lo que el Consultor ha ido aprendiendo de ESTE médico
    // (especialidad, preferencias, estilo). Se inyecta para personalizar.
    const memTxt = textoMemoria(await leerMemoriaMedico(clinicId, acceso.uid))

    // SIN evidencia nueva en PubMed → NO cortamos en seco. La IA responde IGUAL,
    // razonando con conocimiento clínico + la CONVERSACIÓN previa (típico en
    // preguntas de seguimiento como "¿y cuál es la mejor opción?"). Se marca claro
    // que se apoya en conocimiento/consenso, no en citas nuevas.
    if (articulos.length === 0) {
      const sysSC = 'Eres un consultor clínico experto (nivel especialista) para médicos en MÉXICO. No se encontró evidencia NUEVA en PubMed para esta pregunta específica — es normal en preguntas de SEGUIMIENTO o muy puntuales. Responde IGUAL, con criterio clínico: apóyate en tu conocimiento, el consenso/guías y sobre todo en la CONVERSACIÓN PREVIA (continúa el hilo, no empieces de cero). En español, claro y accionable. Empieza con una línea honesta: "Sin citas nuevas de PubMed para esto; respondo con base en conocimiento clínico y lo que ya vimos." NO inventes estudios, PMIDs ni cifras exactas; si algo es incierto, dilo. Si hay contexto de paciente, personaliza (edad, comorbilidades, alergias). Cuando aplique, menciona la GPC de CENETEC/NOM pertinente por su nombre (aclarando verificar el documento oficial). Cierra con "Nivel de evidencia: alto/moderado/bajo" según tu juicio. Apoyas la decisión del médico, no das órdenes absolutas.'
      const usrSC = `${memTxt ? 'PERFIL DEL MÉDICO (memoria):\n' + memTxt + '\n\n' : ''}${paciente ? 'PACIENTE (contexto):\n' + paciente + '\n\n' : ''}${contexto ? 'Conversación previa:\n' + contexto + '\n\n' : ''}PREGUNTA: ${pregunta}`
      let resSC = await claude(key, model, sysSC, usrSC, 2600)
      if (resSC.status === 404 || resSC.status === 400) resSC = await claude(key, 'claude-sonnet-5', sysSC, usrSC, 2600)
      const respSC = resSC.ok ? (textoDe(await resSC.json()).trim() || 'Sin respuesta.') : 'No pude responder ahora; intenta de nuevo en un momento.'
      void registrarUso(clinicId, fuente)
      void registrarConsultor(clinicId, costo)
      // Aprendizaje NO bloqueante: nunca retrasa ni tumba la respuesta.
      void extraerAprendizajes(key, pregunta, respSC).then(f => aprenderDeMedico(clinicId, acceso.uid, f))
      return NextResponse.json({ ok: true, respuesta: respSC, articulos: [], sinCitas: true, cenetecUrl, modelos: [nivel === 'premium' ? 'Claude Opus 4.8' : 'Claude Sonnet 5'] })
    }

    // 2b) DOSIS oficial (openFDA): si se detecta un fármaco, trae su dosis
    //     etiquetada (autoritativa, no inventada).
    const farmacos = farmacosDetectados(`${pregunta} ${query}`)
    const dosis = farmacos[0] ? await dosisFDA(farmacos[0]).catch(() => null) : null
    const fuentes = articulos.map((a, i) => `[${i + 1}] ${a.revista} ${a.anio} · PMID ${a.pmid}\n${a.titulo}\n${a.resumen.slice(0, 700)}`).join('\n\n')
    const dosisTxt = dosis ? `\n\nDOSIS OFICIAL (ficha técnica FDA, ${dosis.farmaco}):\n${dosis.dosis}` : ''
    const system = 'Eres el mejor consultor clínico basado en evidencia para médicos en MÉXICO — al nivel de OpenEvidence: razonas a fondo, resuelves casos COMPLEJOS y das respuestas COMPLETAS y accionables, no superficiales. Responde en español CITANDO con [n] los artículos que respaldan cada afirmación. Estructura útil: síntesis directa arriba, luego el porqué (mecanismo/razonamiento clínico), abordaje escalonado, y advertencias. RAZONA como especialista: sopesa alternativas, menciona cuándo NO aplica, banderas rojas, poblaciones especiales, interacciones. Si hay contexto de PACIENTE, personaliza (edad, comorbilidades, alergias, tratamiento) y advierte contraindicaciones. Si es sobre un fármaco/tratamiento, incluye **Dosis**: usa la "DOSIS OFICIAL (FDA)" dada (ajústala a función renal/hepática y peso, y a verificar con el Cuadro Básico); si no se da, indica la dosis estándar de referencia y adviértelo. Cuando aplique, agrega **Guía en México**: GPC de CENETEC o NOM pertinente por su nombre (a verificar el documento oficial). REGLAS DE RIGOR: cita SOLO los artículos dados por su [n]; NUNCA inventes estudios, PMIDs ni cifras; si la evidencia es limitada, dilo con honestidad y complementa con razonamiento clínico y consenso (aclarando qué es evidencia y qué es criterio); apoya la decisión del médico, no des órdenes absolutas. Termina con "Nivel de evidencia: alto/moderado/bajo".'
    const user = `${memTxt ? 'PERFIL DEL MÉDICO (memoria):\n' + memTxt + '\n\n' : ''}${paciente ? 'PACIENTE (contexto):\n' + paciente + '\n\n' : ''}${contexto ? 'Conversación previa:\n' + contexto + '\n\n' : ''}PREGUNTA: ${pregunta}\n\nEVIDENCIA (PubMed):\n${fuentes}${dosisTxt}\n\nResponde citando [n].`

    let res = await claude(key, model, system, user, 3200)
    if (res.status === 404 || res.status === 400) res = await claude(key, 'claude-sonnet-5', system, user, 3200)
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
    void extraerAprendizajes(key, pregunta, respuesta).then(f => aprenderDeMedico(clinicId, acceso.uid, f))  // no bloquea
    return NextResponse.json({ ok: true, respuesta, articulos, cenetecUrl, dosisFDA: dosis, modelos })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 120) }, { status: 500 })
  }
}
