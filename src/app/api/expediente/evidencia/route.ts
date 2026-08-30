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
import { anotarLlamada } from '@/lib/ia/gateway'
import { esFundador } from '@/lib/authz/fundador'
import type { FuenteLlave } from '@/lib/finanzas/cost-ledger'
import { buscarEvidenciaMulti, type ArticuloPubMed } from '@/lib/evidencia/pubmed'
import { traducirBasico } from '@/lib/evidencia/traducir-medico'
import { declararFuentesNoConsultadas } from '@/lib/evidencia/lo-que-no-se-consulto'
import { aplicabilidadDesdeResumen, comoSeDiceLaAplicabilidad } from '@/lib/evidencia/aplicabilidad'
import { verificarAfirmaciones } from '@/lib/evidencia/verificar-la-cita'
import { nombreConCerteza } from '@/lib/expediente/problemas-activos'
import type { Diagnostico } from '@/types/expediente'

export const runtime = 'nodejs'
/**
 * EL RAZONAMIENTO NECESITA MÁS DE UN MINUTO, Y ANTES NO LO TENÍA.
 *
 * Con 12 artículos de PubMed en el contexto y el nivel Máxima (Opus), 40 s de
 * presupuesto se agotaban y la pantalla devolvía las fuentes sin el análisis:
 * el médico veía la bibliografía y ningún razonamiento.
 *
 * 300 s en la función y el resto del presupuesto para el modelo, descontando lo
 * que PubMed ya gastó. Es el mismo trato que se le dio al procesado de la nota:
 * darle el tiempo que necesita en vez de recortarle la calidad.
 *
 * Tiene que ser un literal — Next rechaza una referencia aquí.
 */
export const maxDuration = 300

/** Presupuesto total de la función, en ms. Atado al literal de arriba por un test. */
const PRESUPUESTO_MS = 300_000
/** Lo que se reserva para armar y devolver la respuesta. */
const RESERVA_RESPUESTA_MS = 15_000
const ANTHROPIC_VERSION = '2023-06-01'
const MODELOS_PREMIUM = ['claude-opus-4-8', 'claude-sonnet-5', 'claude-sonnet-4-6']
const MODELOS_PRO = ['claude-sonnet-5', 'claude-sonnet-4-6']
const MODELOS_HAIKU_ANALISIS = ['claude-haiku-4-5-20251001', 'claude-haiku-4-5']

export async function POST(req: NextRequest) {
  /**
   * EL RELOJ DE ESTA PETICIÓN — local, no de módulo.
   *
   * Se pone al entrar y no al llamar al modelo: PubMed ya gastó tiempo antes, y
   * darle al modelo un presupuesto fijo ignorando ese gasto es como se llegaba
   * al corte con la respuesta a medio escribir.
   *
   * Va dentro de `POST` a propósito. Como variable de módulo, dos consultas
   * simultáneas en el mismo runtime se pisarían el reloj: la segunda lo
   * reiniciaría y la primera creería que le queda más tiempo del que tiene.
   */
  const t0Peticion = Date.now()

  /**
   * Lo que de verdad le queda al modelo. Nunca menos de 20 s: por debajo no
   * alcanza ni para empezar, y es mejor decirlo que fingir un intento.
   */
  const msParaElModelo = () =>
    Math.max(20_000, PRESUPUESTO_MS - RESERVA_RESPUESTA_MS - (Date.now() - t0Peticion))

  const acceso = await verificarModuloIA(req, 'expediente')
  if (!acceso.ok) return acceso.response
  const _rl = await limitarOResponder(`evidencia:${acceso.uid}`, 30, 60)
  if (_rl) return _rl
  // Se copian aquí porque el asiento se deja DENTRO de `analizarClaude`, y
  // TypeScript no conserva ahí el afinado de tipo que hizo el `if (!acceso.ok)`.
  const uid = acceso.uid
  const email = acceso.email

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
    diagnosticos?: { descripcion?: string; tipo?: string }[]
    medicamentos?: { nombre?: string }[]
    motivo?: string
    resumen?: string
    motor?: string   // 'rapida' | 'estandar' | 'maxima' — el motor que el médico eligió para la nota
    contexto?: { edad?: number; sexo?: string; alergias?: unknown }
  }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  /**
   * ── EL PROMPT NO PUEDE LLAMAR DIAGNÓSTICO A UNA SOSPECHA (REG-364) ────────
   *
   * `dx` se aplanaba a la descripción, así que lo que el médico había
   * DESCARTADO viajaba en la línea «DIAGNÓSTICOS: …» exactamente igual que un
   * confirmado, y el modelo razonaba sobre una enfermedad que el paciente no
   * tiene. `SUGERIDO ≠ CONFIRMADO` también cuando el lector es un modelo.
   *
   * `presuntivo` NO se etiqueta, y el porqué está en `nombreConCerteza`: es el
   * valor de fábrica del esquema, así que etiquetarlo le diría al modelo que
   * hay una duda que nadie expresó — en casi todos los renglones (REG-365).
   *
   * Las CONSULTAS de PubMed se construyen con el término a secas: «(presuntivo)»
   * dentro de una búsqueda MeSH no la afina, la rompe.
   */
  const dxDet = (body.diagnosticos ?? [])
    .map(d => ({ texto: String(d?.descripcion ?? '').trim(), tipo: d?.tipo as Diagnostico['tipo'] | undefined }))
    .filter(d => d.texto)
  const dx = dxDet.map(d => d.texto)
  /** Los mismos, dichos con su grado de certeza, para el mensaje al modelo. */
  const dxParaElModelo = dxDet.map(d => nombreConCerteza({ descripcion: d.texto, tipo: d.tipo }))
  const meds = (body.medicamentos ?? []).map(m => m?.nombre).filter(Boolean) as string[]
  const motivo = (body.motivo ?? '').trim()   // MOTIVO DE CONSULTA = problema activo que se atiende HOY
  const resumen = (body.resumen ?? '').trim()
  /**
   * El texto con el que se ORDENAN los proveedores al declarar cuáles no se
   * consultaron (REG-356). No decide qué se consulta —eso lo decide qué está
   * operativo—, sólo la intención clínica para ordenar la lista.
   */
  const consultaParaDeclarar = [motivo, ...dx].filter(Boolean).join(' ') || 'consulta clínica'
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
  /**
   * El respaldo era `claude-3-5-haiku-latest`, RETIRADO por Anthropic en
   * feb-2026: la segunda llamada devolvía 404 y esta función se quedaba sin
   * consultas. Se sustituye por el alias de familia, que sí existe.
   */
  const MODELOS_HAIKU = ['claude-haiku-4-5-20251001', 'claude-haiku-4-5']
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
      // Esta ruta hace DOS llamadas de pago: ésta, que arma las consultas de
      // PubMed con Haiku, y el análisis grande. La pequeña es barata, pero corre
      // en cada petición de evidencia — un renglón barato que ocurre siempre
      // acaba pesando más que uno caro que ocurre poco.
      anotarLlamada(
        {
          feature: 'evidencia-consultas',
          requestId: req.headers.get('x-vercel-id') || `evq-${uid}-${Date.now()}`,
          clinicId: clinicId ?? null, uid,
          creditos: 0, fuente,
          esFundador: esFundador(email, process.env.SUPERADMIN_EMAILS),
        },
        'anthropic', String(d.model ?? MODELOS_HAIKU[0]),
        d, 0,
      )
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
  /** Si PubMed FALLÓ (429, red), no se le puede decir al médico «no hay evidencia». */
  const testigo = { fallo: false }
  try {
    // NADA de ventana rígida de años en el primario: probado en vivo, (query + filtro
    // HQ + "últimos 7 años") devolvía 0 para IVU recurrente, pero SIN la ventana da 9.
    // buscarEvidenciaMulti YA prioriza alta calidad (revisiones/meta/RCT/guías) + landmark.
    const detP = buscarEvidenciaMulti(consultasDet.map(c => traducirBasico(c) || c).filter(Boolean), { max: 12, testigo }).catch(() => [] as ArticuloPubMed[])
    const consultasEN = await consultasIA()
    if (consultasEN.length) {
      articulos = (await buscarEvidenciaMulti(consultasEN.map(c => traducirBasico(c) || c).filter(Boolean), { max: 12, testigo }).catch(() => [])).slice(0, 12)
    }
    if (articulos.length === 0) articulos = (await detP).slice(0, 12)
    // Último respaldo: el motivo + términos amplios (por si las queries salieron raras).
    if (articulos.length === 0) {
      const amplias = [motivo, ...consultasEN, ...consultasDet].filter(Boolean).map(c => traducirBasico(c) || c).filter(Boolean)
      articulos = (await buscarEvidenciaMulti(amplias, { max: 12, testigo }).catch(() => [])).slice(0, 12)
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

  /**
   * ── ¿ESTE ARTÍCULO APLICA A ESTE PACIENTE? (WS-09) ────────────────────────
   *
   * Hasta aquí la adaptación al paciente era **sólo por prompt**: se le pedía al
   * modelo «personaliza por edad, comorbilidades y alergias» y se confiaba. Un
   * ensayo hecho en adultos de 18 a 65 se le enseñaba igual al médico con un
   * paciente de 82 delante.
   *
   * Ahora cada artículo pasa por una compuerta **determinista** que sólo lee lo
   * que sabe leer y **cuenta lo que no**. Su veredicto máximo es «nada lo
   * excluye», nunca «aplica»: el motor no ha leído los criterios del estudio,
   * ha reconocido frases en un resumen, y la frase que sale lo dice.
   *
   * No filtra ni reordena los artículos. La aplicabilidad se ANOTA; quitar de la
   * vista un artículo porque un patrón no casó sería peor que no tener esto.
   */
  const estadoDelPaciente = {
    ...(typeof ctx.edad === 'number' ? { edadEnAnios: ctx.edad } : {}),
    ...(Array.isArray(ctx.alergias) ? { alergenos: ctx.alergias as string[] } : {}),
  }
  const aplicabilidadPorArticulo = articulos.map(a => {
    const r = aplicabilidadDesdeResumen(a.resumen ?? '', estadoDelPaciente)
    return { pmid: a.pmid, veredicto: r.veredicto, frase: comoSeDiceLaAplicabilidad(r), porQue: r.porQue }
  })

  const hayEvidencia = articulos.length > 0
  const fuentesTxt = hayEvidencia
    ? articulos.map((a, i) => `[${i + 1}] PMID ${a.pmid} · ${a.revista} ${a.anio}\n${a.titulo}\n${a.resumen.slice(0, 700)}`).join('\n\n')
    : testigo.fallo
      // NO es lo mismo «no hay literatura» que «no pudimos preguntar». Decirle al
      // médico lo primero cuando pasó lo segundo es la peor clase de error: parece
      // un hallazgo cuando es una caída de red.
      ? '(NO SE PUDO CONSULTAR PubMed en este momento —fallo de red o límite de peticiones—, así que NO se sabe si hay literatura sobre esto. Razona con tu conocimiento clínico, guías y consenso, y DECLARA que la búsqueda bibliográfica no pudo hacerse; no digas que no existe evidencia.)'
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
    /**
     * REG-359 — SE PIDE EL PASAJE LITERAL, NO SÓLO EL NÚMERO.
     *
     * Antes bastaba `citas:[n]` y lo único que se comprobaba era que `n`
     * estuviera en rango: un `[2]` que apuntara a un artículo que dice lo
     * contrario pasaba, con la apariencia de estar respaldado. Sin el trozo de
     * texto que respalda la frase no hay NADA que verificar.
     *
     * Y pedirlo cambia lo que el modelo hace: obligarle a copiar la frase que lo
     * respalda es la forma más barata que existe de que no invente el respaldo.
     */
    'Responde SOLO JSON válido: {"evaluacion":[{"punto":"...","sustento":"...","citas":[n],"pasajes":["cita textual del resumen n"]}],"alternativas":[{"opcion":"...","porque":"...","citas":[n],"pasajes":["..."]}],"diferencial":[{"dx":"...","razon":"...","citas":[n],"pasajes":["..."]}]}. Da al menos 2-3 puntos de evaluación y, cuando aplique, alternativas y diferenciales.',
    '(5) "citas" y "pasajes" van EMPAREJADOS y del mismo largo: por cada [n] que cites, copia en "pasajes" —LITERAL, palabra por palabra, del texto que se te dio— la frase de ESE artículo que respalda lo que afirmas. No parafrasees el pasaje ni lo traduzcas: se comprueba carácter a carácter contra el original. Si una afirmación tuya no tiene una frase literal que la respalde, deja "citas" y "pasajes" VACÍOS en vez de citar de más — decirlo sin cita es honesto; citar algo que no lo dice, no.',
  ].join('\n')
  const userMsg = `PACIENTE: edad ${ctx.edad ?? '?'}, sexo ${ctx.sexo ?? '?'}, alergias: ${alergias}.\nDIAGNÓSTICOS: ${dxParaElModelo.join('; ') || '—'}\nTRATAMIENTO: ${meds.join('; ') || '—'}${resumen ? `\nRESUMEN CLÍNICO: ${resumen.slice(0, 1500)}` : ''}\n\nEVIDENCIA (PubMed):\n${fuentesTxt}\n\nAnaliza y razona el caso. Devuelve solo el JSON.`

  const conThinking = false   // NUNCA razonamiento extendido aquí (causaba timeouts de 40s)
  type Parsed = Record<string, unknown>
  const soloJSON = (t: string): Parsed | null => { const mm = t.match(/\{[\s\S]*\}/); try { return mm ? JSON.parse(mm[0]) : null } catch { return null } }
  const norm = (p: Parsed | null) => ({
    evaluacion: Array.isArray(p?.evaluacion) ? p!.evaluacion : [],
    alternativas: Array.isArray(p?.alternativas) ? p!.alternativas : [],
    diferencial: Array.isArray(p?.diferencial) ? p!.diferencial : [],
  })

  const diag: string[] = []   // motivos de fallo de cada modelo (para que el aviso sea claro)
  /** Reloj para medir la latencia que va al libro de costos. */
  const t0Costo = Date.now()
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
      return fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': key as string, 'anthropic-version': ANTHROPIC_VERSION, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(msParaElModelo()) })
    }
    try {
      let res = await llamar(modelos[0])
      for (let i = 1; i < modelos.length && (res.status === 404 || res.status === 400); i++) res = await llamar(modelos[i])
      if (!res.ok) { diag.push(`Claude: ${pista(res.status)}`); return null }
      const data = await res.json()
      /**
       * EL ASIENTO SE DEJA AQUÍ, NO DESPUÉS DE PARSEAR.
       *
       * Anthropic ya cobró en cuanto respondió. Si el JSON viene mal formado y
       * la función devuelve `null`, el dinero salió igual — anotarlo sólo en el
       * camino feliz haría que los fallos de formato fueran, en el tablero,
       * gratis. Es de los pocos sitios donde el orden de dos líneas cambia si un
       * número es verdad o no.
       *
       * Este análisis va con `cache_control`, así que buena parte de la entrada
       * se cobra a un décimo: `usoDe` lee `cache_read_input_tokens` y el motor
       * de precios la aplica. Sumarla como entrada completa era el error de 10×
       * que ya costó una corrección.
       */
      anotarLlamada(
        {
          feature: 'evidencia',
          requestId: req.headers.get('x-vercel-id') || `ev-${uid}-${Date.now()}`,
          clinicId: clinicId ?? null, uid,
          creditos: COSTO_CREDITOS.evidencia, fuente,
          esFundador: esFundador(email, process.env.SUPERADMIN_EMAILS),
        },
        'anthropic', String(data.model ?? modelos[0]),
        data, Date.now() - t0Costo,
      )
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
      /**
       * EL AVISO NO PUEDE CULPAR A LA LLAVE CUANDO LA CAUSA FUE EL RELOJ.
       *
       * Decía «Revisa tu llave/créditos» pasara lo que pasara. Ante un timeout
       * del proveedor eso manda al médico a revisar una llave que está bien —el
       * mismo diagnóstico falso que el «rechazó el permiso» de la nota— y le
       * hace perder el tiempo en el único momento en que no lo tiene.
       */
      const esReloj = /timeout|aborted|deadline|ETIMEDOUT/i.test(motivo)
      const queHacer = esReloj
        ? 'Fue el proveedor, no tu cuenta: vuelve a pulsar «actualizar». Las fuentes de abajo son reales y sirven igual.'
        : 'Revisa tu llave/créditos en Configuración → Llaves de IA.'
      const sinRazonamiento = await declararFuentesNoConsultadas(consultaParaDeclarar, ['pubmed'])
      return NextResponse.json({
        ok: true, articulos, evaluacion: [], alternativas: [], diferencial: [],
        // Aunque el razonamiento no salga, las fuentes que no se miraron siguen
        // sin mirarse: callarlo aquí sería el mismo defecto por otro camino.
        _fuentesNoConsultadas: sinRazonamiento.noConsultados,
        _aviso: [`No se obtuvo el razonamiento — ${motivo}. ${queHacer}`, ...sinRazonamiento.avisos].join(' '),
      })
    }

    void registrarUso(clinicId, fuente)
    void registrarCreditos(clinicId, COSTO_CREDITOS.evidencia)
    const avisos: string[] = []
    /**
     * ── LO QUE NO SE CONSULTÓ, DICHO (REG-356) ────────────────────────────
     *
     * Esta ruta consulta **sólo PubMed** y no lo decía. El médico veía artículos
     * y razonamiento sin forma de saber que UpToDate, Cochrane y las guías ni se
     * miraron: un consultor que sólo enseña lo que SÍ encontró se lee como si
     * hubiera mirado en todas partes.
     *
     * La maquinaria ya existía y estaba probada —la usa `/api/consultor-evidencia`
     * desde REG-345—; esta ruta no la tenía cableada. Ninguno de esos adaptadores
     * sale a la red: sólo declaran.
     */
    const declaradas = await declararFuentesNoConsultadas(consultaParaDeclarar, ['pubmed'])
    avisos.push(...declaradas.avisos)

    /**
     * ── ¿LO QUE DICE ESTÁ DE VERDAD EN EL ARTÍCULO QUE CITA? (REG-359) ─────
     *
     * Hasta aquí lo único que se comprobaba de una cita era que su número
     * estuviera en rango. Ahora cada afirmación se ancla contra el TEXTO del
     * artículo que dice respaldarla.
     *
     * Lo no respaldado **no se borra**: puede seguir siendo buen razonamiento
     * clínico, y borrarlo le quitaría al médico algo que quizá necesita. Lo que
     * no puede es seguir pareciendo respaldado.
     */
    const afirmaciones = [
      ...final.evaluacion.map((x: Record<string, unknown>) => ({ texto: x.punto, citas: x.citas, pasajes: x.pasajes })),
      ...final.alternativas.map((x: Record<string, unknown>) => ({ texto: x.opcion, citas: x.citas, pasajes: x.pasajes })),
      ...final.diferencial.map((x: Record<string, unknown>) => ({ texto: x.dx, citas: x.citas, pasajes: x.pasajes })),
    ].filter(a => Array.isArray(a.citas) && (a.citas as unknown[]).length > 0)

    const verificacion = verificarAfirmaciones(afirmaciones, articulos, new Date().toISOString())
    if (verificacion.sePudoVerificar && verificacion.sinRespaldo.length > 0) {
      avisos.push(
        `${verificacion.sinRespaldo.length} afirmación(es) citan un artículo pero NO se pudo comprobar que ese artículo lo diga. Están marcadas: trátalas como razonamiento, no como evidencia citada.`,
      )
    }
    if (!hayEvidencia) {
      // El aviso que ve el médico tiene que distinguir las dos cosas: que no haya
      // literatura es un dato clínico; que no hayamos podido preguntar, no.
      avisos.push(testigo.fallo
        ? 'No se pudo consultar PubMed (fallo de red o límite de peticiones), así que NO se sabe si hay literatura sobre esto. Lo de abajo es razonamiento clínico, no una búsqueda vacía.'
        : 'Razonado con conocimiento clínico y guías (PubMed no devolvió citas nuevas para estos términos exactos).')
    }
    avisos.push(modelosUsados.length > 1 ? `Análisis combinado: ${modelosUsados.join(' + ')}.` : `Análisis con ${modelosUsados[0] ?? tierClaude}.`)
    return NextResponse.json({
      ok: true, articulos, _aplicabilidad: aplicabilidadPorArticulo, ...final, nivel, _modelos: modelosUsados,
      _aviso: avisos.join(' '), _busquedaFallida: testigo.fallo,
      _fuentesNoConsultadas: declaradas.noConsultados,
      _verificacion: verificacion,
    })
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
