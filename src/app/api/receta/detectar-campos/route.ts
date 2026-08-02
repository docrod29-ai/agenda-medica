import { anotarLlamada } from '@/lib/ia/gateway'
import { esFundador } from '@/lib/authz/fundador'
import { NextRequest, NextResponse } from 'next/server'
import { verificarModuloIA } from '@/lib/auth-server'
import { limitarOResponder } from '@/lib/rate-limit'
import { resolverClaveIA, gateCreditos, registrarCreditos } from '@/lib/ai-keys'
import { COSTO_CREDITOS } from '@/lib/planes-ia'

/**
 * IA de visión: recibe la imagen del FORMATO de receta del médico y detecta dónde
 * va el VALOR de cada campo del paciente (Nombre, Edad, Sexo, Fecha, Folio) como
 * coordenadas en % — para pre-llenar el calibrador. El médico confirma/ajusta.
 * "La IA se adapta a tu formato, no tú a ella."
 */
export const runtime = 'nodejs'
export const maxDuration = 300  // visión IA; sin esto se cortaba a 60s en Vercel

const ENV_ANTHROPIC = process.env.ANTHROPIC_API_KEY ?? ''
const MODEL_OVERRIDE = process.env.ANTHROPIC_MODEL ?? ''
const ANTHROPIC_VERSION = '2023-06-01'
const MODELOS = ['claude-sonnet-4-6', 'claude-sonnet-4-5']

const headers = (key: string) => ({ 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION, 'Content-Type': 'application/json' })

async function resolverModelo(key: string): Promise<string> {
  if (MODEL_OVERRIDE) return MODEL_OVERRIDE
  try {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=100', { headers: headers(key) })
    if (res.ok) {
      const ids: string[] = ((await res.json()).data ?? []).map((m: { id: string }) => m.id)
      return MODELOS.find(c => ids.includes(c)) ?? ids.find(id => id.includes('sonnet')) ?? ids[0] ?? MODELOS[0]
    }
  } catch { /* fallback */ }
  return MODELOS[0]
}

const PROMPT = `Esta imagen es una PLANTILLA DE RECETA MÉDICA en blanco (papel membretado del médico).
Devuelve SOLO un objeto JSON con:
1) La posición donde el médico debe ESCRIBIR el VALOR de cada dato del paciente, junto a las etiquetas impresas ("Nombre:", "Edad:", "Sexo:", "Fecha:", "Folio:"), en PORCENTAJE del ancho (x) y alto (y), 0 a 100 (0,0 = esquina superior izquierda). Claves posibles: "nombre","edad","sexo","fecha","folio". Incluye SOLO las que aparezcan.
2) "cuerpo": el ÁREA EN BLANCO donde va la LISTA DE MEDICAMENTOS (Rx) — DEBAJO de los campos del paciente y ARRIBA del pie/firma/logo del membrete — como {"top":Y%,"bottom":Y%} (porcentaje del alto; top = borde superior del área libre, bottom = donde empieza el pie).
Formato exacto: {"nombre":{"x":n,"y":n},"fecha":{"x":n,"y":n},"cuerpo":{"top":n,"bottom":n}}
NO expliques nada. Responde ÚNICAMENTE el JSON.`

const CLAVES_VALIDAS = ['nombre', 'edad', 'sexo', 'fecha', 'folio']

export async function POST(req: NextRequest) {
  const acceso = await verificarModuloIA(req, 'expediente')
  if (!acceso.ok) return acceso.response
  const _rl = await limitarOResponder(`detectar-campos:${acceso.uid}`, 20, 60)
  if (_rl) return _rl

  const { key, fuente, clinicId } = await resolverClaveIA(acceso.uid, 'anthropic', ENV_ANTHROPIC)
  if (!key) return NextResponse.json({ ok: false, error: 'No hay API key de Claude configurada.' }, { status: 503 })
  /**
   * El gate COMPARTIDO, no uno propio.
   *
   * Aquí había una comprobación a mano de `creditosAgotados` que se saltaba el
   * tope de PRUEBA: una cuenta en cortesía con el cupo consumido seguía llamando
   * a la API del dueño. `gateCreditos` mira las dos cosas, y es el mismo criterio
   * que el resto de las rutas — dos gates distintos acaban discrepando.
   */
  const _corte = await gateCreditos(clinicId, fuente); if (_corte) return _corte

  let body: { imagenBase64?: string; mediaType?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }
  const { imagenBase64, mediaType } = body
  if (!imagenBase64) return NextResponse.json({ ok: false, error: 'Falta la imagen' }, { status: 400 })

  /**
   * Contexto del libro de costos. Esta ruta todavía no pasa por el gateway; se
   * anota el gasto igual, porque una llamada sin asiento no se ve como un error
   * sino como una plataforma que gasta menos de lo que gasta.
   */
  const ctxCosto = {
    feature: 'receta-detectar-campos',
    requestId: req.headers.get('x-vercel-id') || `rd-${acceso.uid}-${Date.now()}`,
    clinicId: clinicId ?? null, uid: acceso.uid, creditos: COSTO_CREDITOS.recetaVision, fuente,
    esFundador: esFundador(acceso.email, process.env.SUPERADMIN_EMAILS),
  }
  const t0Costo = Date.now()

  try {
    const model = await resolverModelo(key)
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: headers(key),
      body: JSON.stringify({
        model,
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/png', data: imagenBase64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      return NextResponse.json({ ok: false, error: `IA no disponible (${res.status})`, detalle: t.slice(0, 200) }, { status: 502 })
    }
    const data = await res.json()
    anotarLlamada(ctxCosto, 'anthropic', String(data?.model ?? ''), data, Date.now() - t0Costo)
    const texto: string = (data.content ?? []).map((c: { text?: string }) => c.text ?? '').join('')
    const m = texto.match(/\{[\s\S]*\}/)
    if (!m) return NextResponse.json({ ok: false, error: 'La IA no devolvió coordenadas' }, { status: 422 })

    const crudo = JSON.parse(m[0]) as Record<string, { x?: number; y?: number; top?: number; bottom?: number }>
    const clamp = (n: number) => Math.min(100, Math.max(0, n))
    const campos: Record<string, { x: number; y: number }> = {}
    for (const k of CLAVES_VALIDAS) {
      const c = crudo[k]
      if (c && typeof c.x === 'number' && typeof c.y === 'number') {
        campos[k] = { x: clamp(c.x), y: clamp(c.y) }
      }
    }
    // Área en blanco para la lista de medicamentos (evita que se encimen con el pie)
    let cuerpo: { top: number; bottom: number } | undefined
    const cu = crudo.cuerpo
    if (cu && typeof cu.top === 'number' && typeof cu.bottom === 'number' && cu.bottom > cu.top) {
      cuerpo = { top: clamp(cu.top), bottom: clamp(cu.bottom) }
    }
    if (Object.keys(campos).length === 0 && !cuerpo) return NextResponse.json({ ok: false, error: 'No se detectaron campos' }, { status: 422 })
    // COBRAR — sólo al devolver algo. El gate mira `uso.{mes}.creditos` y esta
    // ruta no lo incrementaba nunca: el corte no podía dispararse.
    void registrarCreditos(clinicId, COSTO_CREDITOS.recetaVision)
    return NextResponse.json({ ok: true, campos, cuerpo })
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'Error al detectar', detalle: String(e).slice(0, 200) }, { status: 500 })
  }
}
