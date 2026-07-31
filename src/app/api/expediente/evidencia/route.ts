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
import { safeLog } from '@/lib/security/sanitize'
import { verificarModuloIA } from '@/lib/auth-server'
import { limitarOResponder } from '@/lib/rate-limit'
import { gateCreditos, resolverClaveIA, registrarUso, nivelIADe, registrarCreditos } from '@/lib/ai-keys'
import { COSTO_CREDITOS } from '@/lib/planes-ia'
import type { FuenteLlave } from '@/lib/finanzas/cost-ledger'
import { buscarEvidenciaMulti, type ArticuloPubMed } from '@/lib/evidencia/pubmed'
import { traducirBasico } from '@/lib/evidencia/traducir-medico'

export const runtime = 'nodejs'
export const maxDuration = 60
const ANTHROPIC_VERSION = '2023-06-01'
const MODELOS_PREMIUM = ['claude-opus-4-8', 'claude-sonnet-5', 'claude-sonnet-4-6']
const MODELOS_PRO = ['claude-sonnet-5', 'claude-sonnet-4-6', 'claude-3-5-sonnet-latest']
const MODELOS_HAIKU_ANALISIS = ['claude-haiku-4-5-20251001', 'claude-3-5-haiku-latest']

export async function POST(req: NextRequest) {
  const acceso = await verificarModuloIA(req, 'expediente')
  if (!acceso.ok) return acceso.response
  const _rl = await limitarOResponder(`evidencia:${acceso.uid}`, 30, 60)
  if (_rl) return _rl

  // RED DE SEGURIDAD TOTAL: nada dentro puede tumbar el endpoint con un 500;
  // si algo falla, devolvemos el ERROR REAL (no un toast mudo). Ver bug 2026-07.
  try {
  let key = ''
  // El tipo se IMPORTA, no se reescribe: esta copia a mano se quedó sin
  // `'fundador'` el día que la union creció, y era la cuarta lista igual.
  let fuente: FuenteLlave = 'ninguna'
  let clinicId = ''
  try {
    const r = await resolverClaveIA(acceso.uid, 'anthropic', process.env.ANTHROPIC_API_KEY ?? '')
    key = (r.key as string) ?? ''; fuente = r.fuente; clinicId = r.clinicId ?? ''
  } catch { /* key queda vacía → mensaje claro abajo, nunca 500 */ }
  const _corte = await gateCreditos(clinicId, fuente); if (_corte) return _corte
  if (!key) return NextResponse.json({ ok: false, error: 'No hay API key de Claude configurada (revisa Configuración → Llaves de IA).' }, { status: 503 })

  let body: {
    diagnosticos?: { descripcion?: string }[]
    medicamentos?: { nombre?: string }[]
    motivo?: string
    resumen?: string
    motor?: string   // 'rapida' | 'estandar' | 'maxima' — el motor que el médico eligió para la nota
    contexto?: { edad?: number; sexo?: string; alergias?: unknown }
  }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  const dx = (body.diagnosticos ?? []).map(d => d?.descripcion).filter(Boolean) as string[]
  const meds = (body.medicamentos ?? []).map(m => m?.nombre).filter(Boolean) as string[]
  const motivo = (body.motivo ?? '').trim()   // MOTIVO DE CONSULTA = problema activo que se atiende HOY
  const resumen = (body.resumen ?? '').trim()
  if (dx.length === 0 && meds.length === 0 && resumen.length < 8 && motivo.length < 4) {
    return NextResponse.json({ ok: false, error: 'La nota no tiene diagnóstico, tratamiento ni resumen para analizar todavía.' }, { status: 400 })
  }

  // 1) CONSULTAS DE PUBMED — priorizan el MOTIVO DE CONSULTA (el problema activo),
  //    NO las comorbilidades. La búsqueda usa el filtro de ALTA CALIDAD (revisiones
  //    sistemáticas, meta-análisis, RCT, guías internacionales) y reciente.
  const consultasDet: string[] = []
  if (motivo) consultasDet.push(motivo)                            // lo primero: el motivo
  if (dx.length) consultasDet.push([dx[0], ...meds.slice(0, 2)].join(' '))
  if (dx[1]) consultasDet.push(dx[1])

  // Constructor de consulta con HAIKU (tarea trivial → rápido, ~2-3s en vez de ~12s
  // con Sonnet). Fallback de modelos por si la cuenta no tiene ese id.
  const MODELOS_HAIKU = ['claude-haiku-4-5-20251001', 'claude-3-5-haiku-latest']
  async function consultasIA(): Promise<string[]> {
    const sys = 'Eres experto en búsqueda en PubMed. Genera 2 o 3 consultas MUY CORTAS en INGLÉS (2 a 4 palabras clave / términos MeSH cada una — NO frases largas, que traen 0 resultados), PRIORIZANDO el MOTIVO DE CONSULTA (problema activo de HOY); comorbilidades solo si son directamente relevantes. Traduce abreviaturas MX (IVU/ITU=urinary tract infection, DM2=type 2 diabetes, HAS/HTA=hypertension, ERC=chronic kidney disease). Devuelve SOLO un arreglo JSON de strings, la 1ª del motivo. Ej "IVU recurrente": ["recurrent urinary tract infection","recurrent UTI prophylaxis","recurrent UTI diabetes"]'
    const user = `MOTIVO (principal): ${motivo || dx[0] || '—'}\nComorbilidades: ${dx.join('; ') || '—'}\nTratamiento: ${meds.join('; ') || '—'}`
    async function llamar(model: string) {
      return fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': key as string, 'anthropic-version': ANTHROPIC_VERSION, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, max_tokens: 250, system: sys, messages: [{ role: 'user', content: user }] }), signal: AbortSignal.timeout(9000) })
    }
    try {
      let r = await llamar(MODELOS_HAIKU[0])
      if (r.status === 404 || r.status === 400) r = await llamar(MODELOS_HAIKU[1])
      if (!r.ok) return []
      const d = await r.json()
      const t: string = (Array.isArray(d.content) ? d.content : []).find((b: { type?: string }) => b?.type === 'text')?.text ?? ''
      const mm = t.match(/\[[\s\S]*\]/)
      const arr = mm ? JSON.parse(mm[0]) : []
      return Array.isArray(arr) ? arr.filter((x: unknown) => typeof x === 'string' && (x as string).trim()).slice(0, 3) : []
    } catch { return [] }
  }

  // VELOCIDAD: lanzamos la búsqueda determinista YA y el constructor IA EN PARALELO.
  // Si la IA devuelve buenas queries, refinamos; si no (o tarda), usamos la determinista
  // que ya corrió — nunca esperamos SOLO al constructor. Búsqueda de ALTA CALIDAD.
  let articulos: ArticuloPubMed[] = []
  try {
    // NADA de ventana rígida de años en el primario: probado en vivo, (query + filtro
    // HQ + "últimos 7 años") devolvía 0 para IVU recurrente, pero SIN la ventana da 9.
    // buscarEvidenciaMulti YA prioriza alta calidad (revisiones/meta/RCT/guías) + landmark.
    const detP = buscarEvidenciaMulti(consultasDet.map(c => traducirBasico(c) || c).filter(Boolean), { max: 12 }).catch(() => [] as ArticuloPubMed[])
    const consultasEN = await consultasIA()
    if (consultasEN.length) {
      articulos = (await buscarEvidenciaMulti(consultasEN.map(c => traducirBasico(c) || c).filter(Boolean), { max: 12 }).catch(() => [])).slice(0, 12)
    }
    if (articulos.length === 0) articulos = (await detP).slice(0, 12)
    // Último respaldo: el motivo + términos amplios (por si las queries salieron raras).
    if (articulos.length === 0) {
      const amplias = [motivo, ...consultasEN, ...consultasDet].filter(Boolean).map(c => traducirBasico(c) || c).filter(Boolean)
      articulos = (await buscarEvidenciaMulti(amplias, { max: 12 }).catch(() => [])).slice(0, 12)
    }
  } catch { articulos = [] }

  // 2) RAZONAMIENTO CLÍNICO — SIEMPRE corre, haya o no artículos de PubMed.
  //    Opus/Sonnet razonan el caso a fondo (nivel subespecialista); las citas de
  //    PubMed REFUERZAN, no condicionan. Sin artículos → razona con su conocimiento
  //    y lo declara honestamente. Nunca devuelve vacío.
  let nivel: string = 'pro'
  try { nivel = await nivelIADe(clinicId) } catch { nivel = 'pro' }
  // RESPETA EL MOTOR QUE ELEGISTE PARA LA NOTA: Rápida→Haiku, Estándar→Sonnet,
  // Máxima→Opus. Así cambiar de motor SÍ cambia el análisis (antes usaba solo el
  // plan → daba igual). Sin motor → por plan. NUNCA razonamiento extendido aquí
  // (eso, no Opus, era lo que tardaba >40s); Opus sin thinking es rápido y máximo nivel.
  const motorSel = String(body.motor ?? '')
  const usaOpus = motorSel === 'maxima'
  const usaHaiku = motorSel === 'rapida'
  const modelos = usaOpus ? MODELOS_PREMIUM
    : usaHaiku ? MODELOS_HAIKU_ANALISIS
    : motorSel === 'estandar' ? MODELOS_PRO
    : (nivel === 'premium' ? MODELOS_PREMIUM : MODELOS_PRO)
  const ctx = body.contexto ?? {}
  const alergias = Array.isArray(ctx.alergias) ? (ctx.alergias as string[]).join(', ') : (ctx.alergias ?? 'no referidas')

  const hayEvidencia = articulos.length > 0
  const fuentesTxt = hayEvidencia
    ? articulos.map((a, i) => `[${i + 1}] PMID ${a.pmid} · ${a.revista} ${a.anio}\n${a.titulo}\n${a.resumen.slice(0, 700)}`).join('\n\n')
    : '(PubMed no devolvió artículos para estos términos — razona con tu conocimiento clínico, guías y consenso, y decláralo.)'

  const system = [
    'Eres un CONSULTOR CLÍNICO de altísimo nivel (subespecialista).',
    'Tu trabajo: ENTENDER el caso, PROCESARLO, ANALIZARLO y RAZONARLO a fondo — SIEMPRE das un análisis útil y accionable, tengas o no artículos de PubMed.',
    `PRIORIDAD ABSOLUTA: el análisis debe girar en torno al MOTIVO DE CONSULTA / problema activo que se atiende HOY${motivo ? ` (= "${motivo.slice(0, 160)}")` : ''}. Empieza y enfócate en ESE problema; las comorbilidades solo se mencionan si son directamente relevantes a él, y AL FINAL.`,
    'Se te da el caso y, si existen, una lista NUMERADA de artículos reales de PubMed (priorizados por ALTO nivel de evidencia: revisiones sistemáticas, meta-análisis, RCT, guías internacionales, recientes).',
    'REGLAS:',
    '(1) Cuando cites un artículo de la lista, hazlo por su número [n]; NUNCA inventes estudios, PMIDs, autores ni cifras. Si un artículo de la lista NO es del tema del motivo, NO lo fuerces.',
    '(2) Apóyate en evidencia INTERNACIONAL de alto nivel (Cochrane, meta-análisis, RCT, guías IDSA/ESCMID/AUA/EAU/ADA según el tema). NO cites GPC de CENETEC ni NOM mexicanas. Si no hay artículos, razona con tu conocimiento del consenso internacional, siendo honesto sobre el nivel de certeza.',
    '(3) Piensa como subespecialista: evalúa la idoneidad del tratamiento (fármaco/dosis/vía/duración), interacciones y contraindicaciones (alergias/edad/función orgánica), alternativas mejores, y el diagnóstico diferencial — todo centrado en el MOTIVO principal.',
    '(4) Concreto y clínico, sin relleno.',
    'Responde SOLO JSON válido: {"evaluacion":[{"punto":"...","sustento":"...","citas":[n]}],"alternativas":[{"opcion":"...","porque":"...","citas":[n]}],"diferencial":[{"dx":"...","razon":"...","citas":[n]}]}. "citas" es un arreglo (posiblemente vacío) de números [n] de la lista. Da al menos 2-3 puntos de evaluación y, cuando aplique, alternativas y diferenciales.',
  ].join('\n')
  const userMsg = `PACIENTE: edad ${ctx.edad ?? '?'}, sexo ${ctx.sexo ?? '?'}, alergias: ${alergias}.\nDIAGNÓSTICOS: ${dx.join('; ') || '—'}\nTRATAMIENTO: ${meds.join('; ') || '—'}${resumen ? `\nRESUMEN CLÍNICO: ${resumen.slice(0, 1500)}` : ''}\n\nEVIDENCIA (PubMed):\n${fuentesTxt}\n\nAnaliza y razona el caso. Devuelve solo el JSON.`

  const conThinking = false   // NUNCA razonamiento extendido aquí (causaba timeouts de 40s)
  type Parsed = Record<string, unknown>
  const soloJSON = (t: string): Parsed | null => { const mm = t.match(/\{[\s\S]*\}/); try { return mm ? JSON.parse(mm[0]) : null } catch { return null } }
  const norm = (p: Parsed | null) => ({
    evaluacion: Array.isArray(p?.evaluacion) ? p!.evaluacion : [],
    alternativas: Array.isArray(p?.alternativas) ? p!.alternativas : [],
    diferencial: Array.isArray(p?.diferencial) ? p!.diferencial : [],
  })

  const diag: string[] = []   // motivos de fallo de cada modelo (para que el aviso sea claro)
  const pista = (s: number) => s === 401 ? 'llave inválida' : s === 403 ? 'llave sin permiso' : s === 429 ? 'sin créditos o saturada' : s === 404 ? 'modelo no disponible' : `HTTP ${s}`

  // Análisis con Claude (Opus premium / Sonnet pro) — con razonamiento si premium.
  async function analizarClaude(sys: string, usr: string): Promise<Parsed | null> {
    async function llamar(model: string) {
      const payload: Record<string, unknown> = {
        model, max_tokens: 4000,   // el JSON del análisis es pequeño; menos = más rápido
        system: [{ type: 'text', text: sys, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: usr }],
      }
      if (conThinking && /opus-4|sonnet-5|sonnet-4/.test(model)) payload.thinking = { type: 'enabled', budget_tokens: 5000 }
      return fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': key as string, 'anthropic-version': ANTHROPIC_VERSION, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(40000) })
    }
    try {
      let res = await llamar(modelos[0])
      for (let i = 1; i < modelos.length && (res.status === 404 || res.status === 400); i++) res = await llamar(modelos[i])
      if (!res.ok) { diag.push(`Claude: ${pista(res.status)}`); return null }
      const data = await res.json()
      const bloques: { type?: string; text?: string }[] = Array.isArray(data.content) ? data.content : []
      return soloJSON(bloques.find(b => b?.type === 'text')?.text ?? bloques[0]?.text ?? '')
    } catch (e) { diag.push(`Claude: ${String(e instanceof Error ? e.message : e).slice(0, 40)}`); return null }
  }

  try {
    // COHERENCIA DE NIVELES: UN SOLO modelo por motor, monotónico y limpio —
    // Rápida=Haiku  <  Estándar=Sonnet  <  Máxima=Opus. Sin mezclas raras (el ensamble
    // con GPT fusionado ensuciaba Estándar y lo hacía ver PEOR que Rápida → incoherente).
    // Una respuesta limpia, reproducible; el modelo ya está fijado en `modelos`.
    const tierClaude = usaOpus ? 'Opus' : usaHaiku ? 'Haiku' : 'Sonnet'
    const ra = await analizarClaude(system, userMsg)
    const modelosUsados = ra ? [tierClaude] : []
    const final = ra ? norm(ra) : null

    if (!final) {
      const motivo = diag.length ? diag.join(' · ') : 'la IA tardó demasiado (timeout)'
      return NextResponse.json({ ok: true, articulos, evaluacion: [], alternativas: [], diferencial: [], _aviso: `No se obtuvo el razonamiento — ${motivo}. Revisa tu llave/créditos en Configuración → Llaves de IA.` })
    }

    void registrarUso(clinicId, fuente)
    void registrarCreditos(clinicId, COSTO_CREDITOS.evidencia)
    const avisos: string[] = []
    if (!hayEvidencia) avisos.push('Razonado con conocimiento clínico y guías (PubMed no devolvió citas nuevas para estos términos exactos).')
    avisos.push(modelosUsados.length > 1 ? `Análisis combinado: ${modelosUsados.join(' + ')}.` : `Análisis con ${modelosUsados[0] ?? tierClaude}.`)
    return NextResponse.json({ ok: true, articulos, ...final, nivel, _modelos: modelosUsados, _aviso: avisos.join(' ') })
  } catch (e) {
    return NextResponse.json({ ok: true, articulos, evaluacion: [], alternativas: [], diferencial: [], _aviso: `No se pudo analizar (${String(e).slice(0, 80)}). Muestro los artículos encontrados.` })
  }

  } catch (fatal) {
    // Cualquier excepción no prevista: NUNCA un 500 mudo. Devolvemos el error real
    // (status 200 para que el cliente lo parsee y lo muestre en vez del toast genérico).
    safeLog.error('[evidencia] fallo no controlado:', fatal)
    const msg = fatal instanceof Error ? fatal.message : String(fatal)
    return NextResponse.json({ ok: false, error: `Fallo al analizar la evidencia: ${msg.slice(0, 160)}` }, { status: 200 })
  }
}
