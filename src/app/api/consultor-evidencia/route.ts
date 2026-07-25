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
import { verificarModuloIA } from '@/lib/auth-server'
import { limitarOResponder } from '@/lib/rate-limit'
import { resolverClaveIA, registrarUso, nivelIADe, registrarConsultor, creditosUsadosDelMes, creditosExtraDelMes } from '@/lib/ai-keys'
import { costoConsultor, planPorNivel } from '@/lib/planes-ia'
import { buscarEvidencia, buscarEvidenciaMulti, textoCompletoPMC, type ArticuloPubMed } from '@/lib/evidencia/pubmed'
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

// ── Streaming: SSE de Anthropic → NDJSON al cliente ───────────────
async function* anthropicStream(key: string, model: string, system: string, user: string, maxTokens: number): AsyncGenerator<string> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': AV, 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, stream: true, messages: [{ role: 'user', content: user }] }),
    signal: AbortSignal.timeout(120000),
  })
  if (!r.ok || !r.body) throw new Error(`anthropic stream HTTP ${r.status}`)
  const reader = r.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lineas = buf.split('\n')
    buf = lineas.pop() ?? ''
    for (const linea of lineas) {
      const s = linea.trim()
      if (!s.startsWith('data:')) continue
      const payload = s.slice(5).trim()
      if (payload === '[DONE]') return
      try {
        const j = JSON.parse(payload)
        if (j.type === 'content_block_delta' && j.delta?.type === 'text_delta') yield j.delta.text as string
      } catch { /* keepalive / evento sin texto */ }
    }
  }
}

interface MetaStream { articulos: unknown[]; cenetecUrl?: string; modelos: string[]; sinCitas?: boolean; dosisFDA?: unknown; fechaBusqueda?: string }
/** Devuelve una respuesta STREAM (NDJSON): 1ª línea meta (fuentes), luego deltas de texto. */
function responderStream(opts: { key: string; model: string; system: string; user: string; maxTokens: number; meta: MetaStream; onDone: (texto: string) => void }): Response {
  const enc = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + '\n'))
      send({ type: 'meta', ...opts.meta })
      let full = ''
      try {
        for await (const t of anthropicStream(opts.key, opts.model, opts.system, opts.user, opts.maxTokens)) { full += t; send({ type: 'delta', text: t }) }
        if (!full.trim()) throw new Error('vacío')
      } catch {
        try {
          let r = await claude(opts.key, opts.model, opts.system, opts.user, opts.maxTokens)
          if (r.status === 404 || r.status === 400) r = await claude(opts.key, 'claude-sonnet-5', opts.system, opts.user, opts.maxTokens)
          const txt = r.ok ? textoDe(await r.json()).trim() : ''
          if (txt) { full = txt; send({ type: 'delta', text: txt }) } else send({ type: 'error', error: 'No pude responder ahora; intenta de nuevo.' })
        } catch { send({ type: 'error', error: 'No pude responder ahora; intenta de nuevo.' }) }
      }
      send({ type: 'done' })
      controller.close()
      try { opts.onDone(full) } catch { /* no-op */ }
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform' } })
}

export async function POST(req: NextRequest) {
  const acceso = await verificarModuloIA(req, 'expediente')
  if (!acceso.ok) return acceso.response
  const _rl = await limitarOResponder(`consultor-evidencia:${acceso.uid}`, 30, 60)
  if (_rl) return _rl
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
    // Descompón la pregunta en 1-3 SUB-BÚSQUEDAS PubMed (ángulos PICO: eficacia,
    //  seguridad, comparación) en inglés — cada una en su línea. Más ángulos =
    //  mejor cobertura de la evidencia. La 1ª sirve además para detectar fármacos.
    let subQueries: string[] = [pregunta]
    const MODELOS_TRAD = ['claude-3-5-haiku-latest', 'claude-haiku-4-5-20251001', 'claude-sonnet-5', 'claude-3-5-sonnet-latest']
    const sysTrad = 'Descompón la pregunta clínica en 1-3 SUB-BÚSQUEDAS de PubMed en INGLÉS, cada una en su PROPIA LÍNEA. Cada línea: solo 2-6 términos clave en inglés (fármacos/enfermedades en su forma inglesa, ej. "finerenona"→"finerenone"), unidos con AND/OR si aplica. Usa ángulos distintos cuando ayude (eficacia; seguridad/efectos adversos; comparación entre opciones). Sin numeración, sin comillas, sin explicación, sin field tags. Máximo 3 líneas.'
    const usrTrad = `${paciente ? 'Paciente: ' + paciente + '\n' : ''}${contexto ? contexto + '\n' : ''}Pregunta: ${pregunta}`
    for (const m of MODELOS_TRAD) {
      try {
        const rq = await claude(key, m, sysTrad, usrTrad, 160, 15000)
        if (rq.ok) {
          const lineas = textoDe(await rq.json()).split('\n').map(l => l.replace(/^[\d.\-•)\s"']+|["'\s]+$/g, '').trim()).filter(Boolean).slice(0, 3)
          if (lineas.length) { subQueries = lineas; break }
        }
      } catch { /* prueba el siguiente modelo */ }
    }
    const query = subQueries[0]  // representativa (para detectar fármacos)

    // 2) Buscar evidencia MULTI-consulta (sub-preguntas en paralelo, prioriza
    //    meta-análisis/ECA/guías). Redes de seguridad para NUNCA salir "0":
    //    (a) sub-queries de la IA; (b) traducción determinista ES→EN; (c) cruda.
    let articulos: ArticuloPubMed[] = await buscarEvidenciaMulti(subQueries, { max: 8, aniosRecientes: 12 }).catch(() => [])
    if (articulos.length === 0) {
      const det = traducirBasico(pregunta)
      if (det) articulos = await buscarEvidencia(det, { max: 8, aniosRecientes: 12 }).catch(() => [])
    }
    if (articulos.length === 0) {
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
      return responderStream({
        key, model, system: sysSC, user: usrSC, maxTokens: 2600,
        meta: { articulos: [], sinCitas: true, cenetecUrl, modelos: [nivel === 'premium' ? 'Claude Opus 4.8' : 'Claude Sonnet 5'] },
        onDone: (txt) => {
          void registrarUso(clinicId, fuente)
          void registrarConsultor(clinicId, costo)
          void extraerAprendizajes(key, pregunta, txt).then(f => aprenderDeMedico(clinicId, acceso.uid, f))
        },
      })
    }

    // 2b) DOSIS oficial (openFDA): si se detecta un fármaco, trae su dosis
    //     etiquetada (autoritativa, no inventada).
    const farmacos = farmacosDetectados(`${pregunta} ${query}`)
    // Dosis oficial de TODOS los fármacos detectados (antes solo el primero → el
    // 2º quedaba sin fuente y el modelo podía inventar su dosis).
    const dosisList = (await Promise.all(farmacos.slice(0, 3).map(f => dosisFDA(f).catch(() => null))))
      .filter((d): d is NonNullable<typeof d> => !!d)
    const dosis = dosisList[0] ?? null
    // Abstract completo (1200 vs 700): más contexto = mejor razonamiento (pubmed.ts ya trae 1200).
    // Texto completo de PMC (acceso abierto) de los 3 primeros: razonar sobre cifras
    // reales (NNT, IC95%, HR), no solo el resumen. Timeout corto para no demorar.
    const fullText = await textoCompletoPMC(articulos.slice(0, 3).map(a => a.pmid), { signal: AbortSignal.timeout(8000) }).catch(() => ({} as Record<string, string>))
    const fuentes = articulos.map((a, i) => {
      const ft = fullText[a.pmid] ? `\nTEXTO COMPLETO (extracto con cifras):\n${fullText[a.pmid]}` : ''
      return `[${i + 1}] ${a.tipo ? `[${a.tipo}] ` : ''}${a.revista} ${a.anio} · PMID ${a.pmid}\n${a.titulo}\n${a.resumen.slice(0, 1200)}${ft}`
    }).join('\n\n')
    const dosisTxt = dosisList.length ? '\n\nDOSIS OFICIAL (ficha técnica FDA):\n' + dosisList.map(d => `• ${d.farmaco}: ${d.dosis}`).join('\n') : ''
    const system = 'Eres el mejor consultor clínico basado en evidencia para médicos en MÉXICO — al nivel de OpenEvidence: razonas a fondo, resuelves casos COMPLEJOS y das respuestas COMPLETAS y accionables, no superficiales. Responde en español CITANDO con [n] los artículos que respaldan cada afirmación. Estructura útil: síntesis directa arriba, luego el porqué (mecanismo/razonamiento clínico), abordaje escalonado, y advertencias. Cuando una fuente incluya "TEXTO COMPLETO", razona sobre sus CIFRAS reales (NNT, IC95%, HR, RR, tamaño de muestra) y menciónalas citando su [n] — no te quedes solo en lo cualitativo. RAZONA como especialista: sopesa alternativas, menciona cuándo NO aplica, banderas rojas, poblaciones especiales, interacciones. Si hay contexto de PACIENTE, personaliza (edad, comorbilidades, alergias, tratamiento) y advierte contraindicaciones. Si es sobre un fármaco/tratamiento, incluye **Dosis**: usa la "DOSIS OFICIAL (FDA)" dada (ajústala a función renal/hepática y peso, y a verificar con el Cuadro Básico); si no se da, indica la dosis estándar de referencia y adviértelo. Cuando aplique, agrega **Guía en México**: GPC de CENETEC o NOM pertinente por su nombre (a verificar el documento oficial). SEGURIDAD DE DOSIS (crítico): NUNCA emitas una CIFRA de dosis (mg, mg/kg, intervalo) sin respaldo. Si tienes la "DOSIS OFICIAL (FDA)" para ese fármaco, úsala y cítala como tal. Si NO la tienes, di "verificar dosis en el Cuadro Básico / ficha técnica" SIN inventar el número; jamás adivines una cifra. Recuerda ajustar por función renal/hepática, peso y edad, y en pediatría/embarazo/lactancia extrema la precaución. REGLAS DE RIGOR: cita SOLO los artículos dados por su [n]; NUNCA inventes estudios, PMIDs ni cifras; si la evidencia es limitada, dilo con honestidad y complementa con razonamiento clínico y consenso (aclarando qué es evidencia y qué es criterio); apoya la decisión del médico, no des órdenes absolutas. Termina con "Nivel de evidencia: alto/moderado/bajo".'
    const user = `${memTxt ? 'PERFIL DEL MÉDICO (memoria):\n' + memTxt + '\n\n' : ''}${paciente ? 'PACIENTE (contexto):\n' + paciente + '\n\n' : ''}${contexto ? 'Conversación previa:\n' + contexto + '\n\n' : ''}PREGUNTA: ${pregunta}\n\nEVIDENCIA (PubMed):\n${fuentes}${dosisTxt}\n\nResponde citando [n].`

    // Respuesta en STREAMING (token a token). Las fuentes van en el meta (se pintan
    // de inmediato) y el texto llega en vivo. La verificación de citas es
    // DETERMINISTA en el cliente (cada [n] contra el rango de fuentes).
    const articulosMin = articulos.map(a => ({ pmid: a.pmid, titulo: a.titulo, revista: a.revista, anio: a.anio, url: a.url, tipo: a.tipo, doi: a.doi }))
    return responderStream({
      key, model, system, user, maxTokens: 3200,
      meta: { articulos: articulosMin, cenetecUrl, dosisFDA: dosis, sinCitas: false, fechaBusqueda: new Date().toISOString().slice(0, 10), modelos: [nivel === 'premium' ? 'Claude Opus 4.8' : 'Claude Sonnet 5'] },
      onDone: (txt) => {
        void registrarUso(clinicId, fuente)
        void registrarConsultor(clinicId, costo)
        void extraerAprendizajes(key, pregunta, txt).then(f => aprenderDeMedico(clinicId, acceso.uid, f))
      },
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 120) }, { status: 500 })
  }
}
