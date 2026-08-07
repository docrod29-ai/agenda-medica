/**
 * POST /api/expediente/extraer-entidades
 *
 * Equivalente local a AWS Comprehend Medical / Google Healthcare NLP.
 * Recibe texto clínico (transcripción o nota redactada) y devuelve
 * entidades estructuradas con códigos CIE-10 + cross-check de
 * alergia↔medicamento + interacciones farmacológicas.
 *
 * Body:   { texto: string }
 * Output: EntidadesExtraidas | { ok: false, error }
 *
 * No expone API keys. Usa el mismo modelo Claude que el endpoint
 * principal de extracción pero con un prompt NER puro.
 */
import { anotarLlamada } from '@/lib/ia/gateway'
import { condicionesNegadas, condicionesDudosas, corregirCertezaPorNegacion, avisosDeDudaDelExtractor } from '@/lib/expediente/negaciones'
import { mencionesEnPasado, avisosTemporalesDelExtractor } from '@/lib/expediente/temporalidad'
import { esFundador } from '@/lib/authz/fundador'
import { NextRequest, NextResponse } from 'next/server'
import { NER_SYSTEM_PROMPT, buildNerUserPrompt, EntidadesExtraidas, TOPE_TEXTO_NER } from '@/lib/expediente/medical-ner'
import { safeLog } from '@/lib/security/sanitize'
import { claseDeFallo, quienPaga, avisoAlMedico } from '@/lib/ia/fallo-proveedor'
import { reportarFalloIA } from '@/lib/ia/incidentes-servidor'
import { verificarModuloIA } from '@/lib/auth-server'
import { limitarOResponder } from '@/lib/rate-limit'
import { gateCreditos, resolverClaveIA, registrarCreditos } from '@/lib/ai-keys'
import { COSTO_CREDITOS } from '@/lib/planes-ia'

const ENV_ANTHROPIC = process.env.ANTHROPIC_API_KEY ?? ''
const ANTHROPIC_VERSION = '2023-06-01'

const MODELOS_CANDIDATOS = [
  'claude-sonnet-4-5',
  'claude-sonnet-4-5-20250929',
]

let modeloCache = ''

async function resolverModelo(key: string): Promise<string> {
  if (process.env.ANTHROPIC_MODEL) return process.env.ANTHROPIC_MODEL
  if (modeloCache) return modeloCache
  try {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
      headers: { 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION },
      signal: AbortSignal.timeout(8000),   // no colgar el NER si la lista de modelos tarda
    })
    if (res.ok) {
      const data = await res.json()
      const ids: string[] = (data.data ?? []).map((m: { id: string }) => m.id)
      const elegido = MODELOS_CANDIDATOS.find(c => ids.includes(c))
        ?? ids.find(id => id.includes('sonnet'))
        ?? ids[0]
      if (elegido) { modeloCache = elegido; return elegido }
    }
  } catch { /* fallback */ }
  return MODELOS_CANDIDATOS[0]
}

/** Parser robusto — comparte estrategia con /api/expediente/procesar */
function parseJSON(text: string): Record<string, unknown> | null {
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) t = fence[1].trim()
  const first = t.indexOf('{')
  const last = t.lastIndexOf('}')
  if (first === -1 || last === -1) return null
  const slice = t.slice(first, last + 1)
  try { return JSON.parse(slice) } catch { /* */ }
  const limpio = slice
    .split('\n')
    .map(line => {
      const m = line.match(/^([^"]*(?:"[^"]*"[^"]*)*?)\s*\/\/.*$/)
      return m ? m[1].trimEnd() : line
    })
    .join('\n')
    .replace(/,(\s*[}\]])/g, '$1')
  try { return JSON.parse(limpio) } catch { return null }
}

export async function POST(req: NextRequest) {
  const acceso = await verificarModuloIA(req, 'expediente')
  if (!acceso.ok) return acceso.response
  const _rl = await limitarOResponder(`extraer-entidades:${acceso.uid}`, 40, 60)
  if (_rl) return _rl

  const { key: API_KEY, clinicId, fuente } = await resolverClaveIA(acceso.uid, 'anthropic', ENV_ANTHROPIC)
  const _corte = await gateCreditos(clinicId, fuente); if (_corte) return _corte
  if (!API_KEY) {
    return NextResponse.json(
      { ok: false, error: 'No hay API key de Claude configurada. Agrégala en Configuración → Llaves de IA.' },
      { status: 503 },
    )
  }

  let body: { texto?: string; alergiasRegistradas?: string[] }
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const texto = (body.texto ?? '').trim()
  if (!texto) {
    return NextResponse.json({ ok: false, error: 'Falta texto a analizar' }, { status: 400 })
  }
  /**
   * EL TOPE DE LA RUTA TIENE QUE SER EL DEL PROMPT.
   *
   * La ruta aceptaba hasta 20 000 caracteres y el prompt recortaba a 12 000 sin
   * decir nada: en una consulta larga, el cruce alergia↔medicamento no veía el
   * último tercio —justo donde está la receta— y el panel salía VACÍO, que es
   * lo más tranquilizador que puede mostrar. Se rechaza en vez de cortar.
   */
  if (texto.length > TOPE_TEXTO_NER) {
    return NextResponse.json({
      ok: false,
      error: `El texto es más largo de lo que el análisis puede revisar de una vez (${texto.length.toLocaleString('es-MX')} de ${TOPE_TEXTO_NER.toLocaleString('es-MX')} caracteres). NO se analizó — revísalo tú o analiza por partes.`,
    }, { status: 400 })
  }
  // Auditoría 2026-07 (P1): alergias del expediente entran al cross-check.
  const alergiasRegistradas = Array.isArray(body.alergiasRegistradas)
    ? body.alergiasRegistradas.map(a => String(a)).filter(Boolean).slice(0, 40)
    : []

  /**
   * Contexto del libro de costos. Esta ruta todavía no pasa por el gateway; se
   * anota el gasto igual, porque una llamada sin asiento no se ve como un error
   * sino como una plataforma que gasta menos de lo que gasta.
   */
  const ctxCosto = {
    feature: 'extraer-entidades',
    requestId: req.headers.get('x-vercel-id') || `ee-${acceso.uid}-${Date.now()}`,
    clinicId: clinicId ?? null, uid: acceso.uid, creditos: 0, fuente,
    esFundador: esFundador(acceso.email, process.env.SUPERADMIN_EMAILS),
  }
  const t0Costo = Date.now()

  try {
    const model = await resolverModelo(API_KEY)
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        system: NER_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildNerUserPrompt(texto, alergiasRegistradas) }],
      }),
      signal: AbortSignal.timeout(45000),   // aborta limpio si tarda, sin "error de red" ambiguo
    })

    if (!res.ok) {
      const err = await res.text()
      safeLog.error('[extraer-entidades] Claude error:', res.status, err.slice(0, 300))
      // «Claude 401» no le dice nada al médico y, si la llave es nuestra, le
      // enseña un problema interno. El mensaje sale del clasificador compartido.
      const quien = quienPaga(fuente)
      const clase = claseDeFallo(res.status, err)
      reportarFalloIA({ clase, quien, proveedor: 'anthropic', feature: 'entidades', status: res.status })
      return NextResponse.json({ ok: false, error: avisoAlMedico(clase, quien, 'anthropic').texto }, { status: 502 })
    }

    const data = await res.json()
    anotarLlamada(ctxCosto, 'anthropic', String(data?.model ?? ''), data, Date.now() - t0Costo)
    const text: string = data.content?.[0]?.text ?? ''
    if (!text.trim()) {
      return NextResponse.json({ ok: false, error: 'IA devolvió respuesta vacía' }, { status: 502 })
    }
    const parsed = parseJSON(text)
    if (!parsed) {
      return NextResponse.json({ ok: false, error: 'NER no parseable', raw: text.slice(0, 300) }, { status: 502 })
    }

    // Cobro (icu-007): el NER es una llamada real a IA; quema créditos una vez.
    void registrarCreditos(clinicId, COSTO_CREDITOS.extraerEntidades)

    const validation = EntidadesExtraidas.safeParse(parsed)
    if (!validation.success) {
      // Modo permisivo: devolvemos lo que sí parsea con _schemaWarning
      return NextResponse.json({ ok: true, ...parsed, _schemaWarning: true })
    }

    /**
     * EL EXTRACTOR TAMBIÉN COSECHABA LOS TÉRMINOS DE LA PREGUNTA.
     *
     * Caso real del Dr. (3-ago-2026): «¿Enfermedades crónicas como diabetes o
     * presión alta? No.» → salían las dos como condiciones. Una entidad
     * estructurada tiene peor pinta que una frase: parece un dato verificado.
     *
     * Se reclasifican como `descartado`, no se borran — «niega diabetes» es un
     * negativo pertinente y es información clínica real. Lo que no puede pasar
     * es que viajen como confirmadas.
     *
     * Va en el SERVIDOR y no en la pantalla porque esta ruta la consumen la
     * consulta y la ficha del paciente: arreglarlo en una dejaría la otra rota.
     */
    const negadas = condicionesNegadas(texto)
    const { conditions, corregidas } = corregirCertezaPorNegacion(validation.data.conditions, negadas)
    if (corregidas.length) {
      safeLog.info(`[extraer-entidades] ${corregidas.length} condición(es) reclasificadas a descartado por negación en el texto`)
    }

    /**
     * Y LA TERCERA COSECHA: LA QUE EL PACIENTE NO SUPO CONTESTAR.
     *
     * «¿Tiene diabetes? No sé» empieza por «no», así que hasta hoy entraba por
     * la puerta de arriba y salía `descartado`: el paciente decía que no se
     * acordaba y el expediente escribía que lo había negado. Aquí NO se
     * reclasifica —ni «confirmado» ni «descartado» es lo que dijo— y se señala.
     */
    const dudosas = condicionesDudosas(texto)
    const avisosDeDuda = avisosDeDudaDelExtractor(conditions, dudosas)
    if (avisosDeDuda.length) {
      safeLog.info(`[extraer-entidades] ${avisosDeDuda.length} condición(es) que el paciente dijo no saber`)
    }

    /**
     * Y LA OTRA COSECHA: LA QUE VIENE EN PASADO.
     *
     * `estado` nace en `activo` por omisión del esquema, así que «tuvo neumonía
     * hace tres años» sale como condición ACTIVA. Aquí NO se reclasifica —pasar
     * algo a `resuelto` porque la frase iba en pasado sería una decisión
     * clínica—: se señala y decide el médico.
     */
    const avisosTemporales = avisosTemporalesDelExtractor(conditions, mencionesEnPasado(texto))
    if (avisosTemporales.length) {
      safeLog.info(`[extraer-entidades] ${avisosTemporales.length} condición(es) activas que el dictado situó en pasado`)
    }

    return NextResponse.json({
      ok: true, ...validation.data, conditions, model,
      /** Lo corregido se DICE: una corrección silenciosa se ve igual que un extractor que acertó. */
      negacionesCorregidas: corregidas,
      /** Y lo NO corregido también: señalar sin tocar sólo sirve si se enseña. */
      avisosTemporales,
      /** Lo que el paciente dijo no saber. Ni confirmado ni descartado: falta. */
      avisosDeDuda,
    })
  } catch (err) {
    safeLog.error('[extraer-entidades] Exception:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
