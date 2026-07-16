/**
 * POST /api/expediente/evidencia  —  ANÁLISIS BASADO EN EVIDENCIA + citas reales
 *
 * Cruza los diagnósticos y tratamientos de la nota contra la literatura médica
 * (PubMed: NEJM, JAMA, Cochrane, Lancet…) y con un modelo de razonamiento clínico
 * evalúa el tratamiento, señala interacciones, sugiere alternativas y da apoyo de
 * diagnóstico diferencial — CADA punto respaldado con las citas (PMID) reales que
 * lo sustentan. No inventa fuentes: solo usa los artículos que PubMed devolvió.
 *
 * Nivel Premium usa Opus 4.8 + razonamiento; Pro usa Sonnet 5.
 *
 * Body: { diagnosticos:[{descripcion}], medicamentos:[{nombre}], contexto:{edad,sexo,alergias} }
 * Resp: { ok, articulos:[...], evaluacion:[...], alternativas:[...], diferencial:[...] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/auth-server'
import { limitarOResponder } from '@/lib/rate-limit'
import { resolverClaveIA, registrarUso, nivelIADe } from '@/lib/ai-keys'
import { buscarEvidencia, type ArticuloPubMed } from '@/lib/evidencia/pubmed'
import { traducirBasico } from '@/lib/evidencia/traducir-medico'

export const runtime = 'nodejs'
export const maxDuration = 60
const ANTHROPIC_VERSION = '2023-06-01'
const MODELOS_PREMIUM = ['claude-opus-4-8', 'claude-sonnet-5', 'claude-sonnet-4-6']
const MODELOS_PRO = ['claude-sonnet-5', 'claude-sonnet-4-6', 'claude-3-5-sonnet-latest']

export async function POST(req: NextRequest) {
  const acceso = await verificarUsuario(req)
  if (!acceso.ok) return acceso.response
  const _rl = await limitarOResponder(`evidencia:${acceso.uid}`, 30, 60)
  if (_rl) return _rl
  const { key, fuente, clinicId } = await resolverClaveIA(acceso.uid, 'anthropic', process.env.ANTHROPIC_API_KEY ?? '')
  if (!key) return NextResponse.json({ ok: false, error: 'No hay API key de Claude configurada.' }, { status: 503 })

  let body: {
    diagnosticos?: { descripcion?: string }[]
    medicamentos?: { nombre?: string }[]
    resumen?: string
    contexto?: { edad?: number; sexo?: string; alergias?: unknown }
  }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  const dx = (body.diagnosticos ?? []).map(d => d?.descripcion).filter(Boolean) as string[]
  const meds = (body.medicamentos ?? []).map(m => m?.nombre).filter(Boolean) as string[]
  const resumen = (body.resumen ?? '').trim()
  // La IA razona con lo que haya: dx/meds estructurados O el resumen/texto de la nota.
  if (dx.length === 0 && meds.length === 0 && resumen.length < 8) {
    return NextResponse.json({ ok: false, error: 'La nota no tiene diagnóstico, tratamiento ni resumen para analizar todavía.' }, { status: 400 })
  }

  // 1) CONSTRUIR LAS CONSULTAS DE PUBMED.
  //    Primario: la IA convierte los dx/meds en español (con abreviaturas MX como
  //    IVU, DM2, HAS…) a consultas en inglés/MeSH — robusto ante cualquier término.
  //    Respaldo: construcción determinista + diccionario (traducirBasico).
  async function consultasIA(): Promise<string[]> {
    try {
      const sys = 'Convierte diagnósticos y tratamientos clínicos en español de México (con abreviaturas frecuentes: IVU/ITU=infección de vías urinarias, DM2=diabetes tipo 2, HAS/HTA=hipertensión, ERC=enfermedad renal crónica, EPOC, IAM, ICC, EVC, TVP, TEP) en 1 a 3 consultas CORTAS en INGLÉS para PubMed, con términos MeSH. Ignora paréntesis y datos del paciente. Devuelve SOLO un arreglo JSON de strings. Ej: ["recurrent urinary tract infection management adults","nitrofurantoin prophylaxis recurrent uti"]'
      const user = `Diagnósticos: ${dx.join('; ') || '—'}\nTratamiento: ${meds.join('; ') || '—'}${resumen ? `\nResumen clínico: ${resumen.slice(0, 800)}` : ''}`
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key as string, 'anthropic-version': ANTHROPIC_VERSION, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODELOS_PRO[0], max_tokens: 300, system: sys, messages: [{ role: 'user', content: user }] }),
      })
      if (!r.ok) return []
      const d = await r.json()
      const t: string = (Array.isArray(d.content) ? d.content : []).find((b: { type?: string }) => b?.type === 'text')?.text ?? ''
      const mm = t.match(/\[[\s\S]*\]/)
      const arr = mm ? JSON.parse(mm[0]) : []
      return Array.isArray(arr) ? arr.filter((x: unknown) => typeof x === 'string' && (x as string).trim()).slice(0, 3) : []
    } catch { return [] }
  }

  const consultasDet: string[] = []
  if (dx.length) consultasDet.push([dx[0], ...meds.slice(0, 3), 'treatment OR management OR guideline'].join(' '))
  if (dx[1]) consultasDet.push(dx[1])
  if (meds.length >= 2) consultasDet.push(`${meds.slice(0, 4).join(' ')} drug interaction`)

  async function buscarLote(queries: string[]): Promise<ArticuloPubMed[]> {
    const lotes = await Promise.all(queries.map(async c => {
      const en = traducirBasico(c) || c
      // con filtro de años primero; si no hay, sin filtro (evidencia clásica).
      let r = await buscarEvidencia(en, { max: 5, aniosRecientes: 10 }).catch(() => [])
      if (r.length === 0) r = await buscarEvidencia(en, { max: 5 }).catch(() => [])
      return r
    }))
    const porPmid = new Map<string, ArticuloPubMed>()
    for (const lote of lotes) for (const a of lote) if (!porPmid.has(a.pmid)) porPmid.set(a.pmid, a)
    return [...porPmid.values()]
  }

  // Intenta con las consultas de la IA; si no hay nada, cae a las deterministas.
  const consultasEN = await consultasIA()
  let articulos = await buscarLote(consultasEN.length ? consultasEN : consultasDet)
  if (articulos.length === 0 && consultasEN.length) articulos = await buscarLote(consultasDet)
  articulos = articulos.slice(0, 12)

  // 2) RAZONAMIENTO CLÍNICO — SIEMPRE corre, haya o no artículos de PubMed.
  //    Opus/Sonnet razonan el caso a fondo (nivel subespecialista); las citas de
  //    PubMed REFUERZAN, no condicionan. Sin artículos → razona con su conocimiento
  //    y lo declara honestamente. Nunca devuelve vacío.
  const nivel = await nivelIADe(clinicId)
  const modelos = nivel === 'premium' ? MODELOS_PREMIUM : MODELOS_PRO
  const ctx = body.contexto ?? {}
  const alergias = Array.isArray(ctx.alergias) ? (ctx.alergias as string[]).join(', ') : (ctx.alergias ?? 'no referidas')

  const hayEvidencia = articulos.length > 0
  const fuentesTxt = hayEvidencia
    ? articulos.map((a, i) => `[${i + 1}] PMID ${a.pmid} · ${a.revista} ${a.anio}\n${a.titulo}\n${a.resumen.slice(0, 700)}`).join('\n\n')
    : '(PubMed no devolvió artículos para estos términos — razona con tu conocimiento clínico, guías y consenso, y decláralo.)'

  const system = [
    'Eres un CONSULTOR CLÍNICO de altísimo nivel (subespecialista) para un médico experto en México.',
    'Tu trabajo: ENTENDER el caso, PROCESARLO, ANALIZARLO y RAZONARLO a fondo — SIEMPRE das un análisis útil y accionable, tengas o no artículos de PubMed.',
    'Se te da el caso (diagnósticos + tratamiento + resumen + paciente) y, si existen, una lista NUMERADA de artículos reales de PubMed con su resumen.',
    'REGLAS:',
    '(1) Cuando cites un artículo de la lista, hazlo por su número [n]; NUNCA inventes estudios, PMIDs, autores ni cifras. Si un dato no está en la lista, NO lo atribuyas a una cita.',
    '(2) Si NO hay artículos (o no alcanzan), razona igual con tu conocimiento clínico, guías (IDSA/GPC-CENETEC/NOM cuando aplique) y consenso — sin citas [n], y siendo honesto sobre el nivel de certeza.',
    '(3) Piensa como subespecialista: evalúa la idoneidad del tratamiento (fármaco/dosis/vía/duración), interacciones y contraindicaciones (considera alergias/edad/función orgánica), alternativas mejores, y el diagnóstico diferencial relevante.',
    '(4) Concreto y clínico, sin relleno.',
    'Responde SOLO JSON válido: {"evaluacion":[{"punto":"...","sustento":"...","citas":[n]}],"alternativas":[{"opcion":"...","porque":"...","citas":[n]}],"diferencial":[{"dx":"...","razon":"...","citas":[n]}]}. "citas" es un arreglo (posiblemente vacío) de números [n] de la lista. Da al menos 2-3 puntos de evaluación y, cuando aplique, alternativas y diferenciales.',
  ].join('\n')
  const userMsg = `PACIENTE: edad ${ctx.edad ?? '?'}, sexo ${ctx.sexo ?? '?'}, alergias: ${alergias}.\nDIAGNÓSTICOS: ${dx.join('; ') || '—'}\nTRATAMIENTO: ${meds.join('; ') || '—'}${resumen ? `\nRESUMEN CLÍNICO: ${resumen.slice(0, 1500)}` : ''}\n\nEVIDENCIA (PubMed):\n${fuentesTxt}\n\nAnaliza y razona el caso. Devuelve solo el JSON.`

  const conThinking = nivel === 'premium'
  async function llamar(model: string) {
    const payload: Record<string, unknown> = {
      model, max_tokens: conThinking ? 16000 : 8000,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMsg }],
    }
    if (conThinking && /opus-4|sonnet-5|sonnet-4/.test(model)) payload.thinking = { type: 'enabled', budget_tokens: 5000 }
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key as string, 'anthropic-version': ANTHROPIC_VERSION, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  try {
    let res = await llamar(modelos[0])
    for (let i = 1; i < modelos.length && (res.status === 404 || res.status === 400); i++) res = await llamar(modelos[i])
    if (!res.ok) return NextResponse.json({ ok: true, articulos, evaluacion: [], alternativas: [], diferencial: [], _aviso: `La IA de evidencia respondió HTTP ${res.status}. Muestro los artículos encontrados.` })

    const data = await res.json()
    const bloques: { type?: string; text?: string }[] = Array.isArray(data.content) ? data.content : []
    const text = bloques.find(b => b?.type === 'text')?.text ?? bloques[0]?.text ?? ''
    const m = text.match(/\{[\s\S]*\}/)
    const parsed = m ? JSON.parse(m[0]) : {}

    void registrarUso(clinicId, fuente)
    return NextResponse.json({
      ok: true,
      articulos,
      evaluacion: Array.isArray(parsed.evaluacion) ? parsed.evaluacion : [],
      alternativas: Array.isArray(parsed.alternativas) ? parsed.alternativas : [],
      diferencial: Array.isArray(parsed.diferencial) ? parsed.diferencial : [],
      nivel,
      _aviso: hayEvidencia ? undefined : 'Razonado con conocimiento clínico y guías (PubMed no devolvió citas nuevas para estos términos exactos).',
    })
  } catch (e) {
    return NextResponse.json({ ok: true, articulos, evaluacion: [], alternativas: [], diferencial: [], _aviso: `No se pudo analizar (${String(e).slice(0, 80)}). Muestro los artículos encontrados.` })
  }
}
