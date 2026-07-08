/**
 * POST /api/expediente/corregir
 *
 * Editor clínico de PRECISIÓN por chat: recibe la nota actual + una instrucción
 * en lenguaje natural del médico ("la dosis es 500 mg", "quita la diabetes",
 * "el Dx correcto es apendicitis") y devuelve la nota con SOLO ese cambio
 * aplicado — nada más, sin inventar, sin re-alucinar.
 *
 * Body: { nota: { resumenEjecutivo, secciones{clave:texto}, diagnosticos[], medicamentos[], alergias[], signosVitales{} }, instruccion, contexto? }
 * Resp: { ok, resumenEjecutivo, secciones, diagnosticos, medicamentos, alergias, signosVitales } | { ok:false, error }
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/auth-server'
import { resolverClaveIA } from '@/lib/ai-keys'

const ENV_ANTHROPIC = process.env.ANTHROPIC_API_KEY ?? ''
const MODEL_OVERRIDE = process.env.ANTHROPIC_MODEL ?? ''
const ANTHROPIC_VERSION = '2023-06-01'
const MODELOS = [MODEL_OVERRIDE, 'claude-sonnet-5', 'claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-3-7-sonnet-latest', 'claude-3-5-sonnet-latest'].filter(Boolean)

function headers(key: string) {
  return { 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION, 'content-type': 'application/json' }
}

const SYSTEM = `Eres un EDITOR CLÍNICO DE PRECISIÓN de una EHR mexicana. Recibes una NOTA MÉDICA en JSON y UNA instrucción de corrección del médico tratante. Tu único trabajo es aplicar EXACTAMENTE lo que el médico pide.

REGLAS ABSOLUTAS:
1. Aplica SOLO el cambio pedido. Todo lo que la instrucción NO menciona debe quedar IDÉNTICO, carácter por carácter.
2. NUNCA inventes ni agregues datos (diagnósticos, fármacos, dosis, hallazgos, signos) que el médico no pidió. Cero alucinaciones.
3. NO "mejores" redacción, estilo ni contenido salvo que se pida explícitamente.
4. Si el médico corrige un dato clínico (dosis, diagnóstico, vía, alergia, cifra), refléjalo en TODOS los campos donde aparezca de forma coherente (ej. si cambia la dosis de un fármaco, actualízala tanto en el arreglo de medicamentos como en el texto del plan si ahí se menciona), pero sin tocar nada ajeno al cambio.
5. Si la instrucción pide QUITAR algo, elimínalo de donde esté (arreglos y texto) sin dejar rastros incoherentes.
6. Si la instrucción es ambigua o imposible con los datos dados, haz el cambio más conservador y razonable; NO agregues información nueva para "completar".
7. Conserva EXACTA la estructura de campos del JSON de entrada (mismas claves de secciones).

FORMATO DE SALIDA: responde EXCLUSIVAMENTE el JSON de la nota corregida, con la MISMA forma que la de entrada:
{ "resumenEjecutivo": "", "secciones": { ...mismas claves... }, "diagnosticos": [{"descripcion":"","codigoCIE10":"","tipo":"","estado":""}], "medicamentos": [{"nombre":"","dosis":"","via":"","frecuencia":"","duracion":"","indicacion":""}], "alergias": [{"alergeno":"","tipo":"","reaccion":"","severidad":"","confirmada":false}], "signosVitales": {"fc":null,"fr":null,"ta":"","temperatura":null,"spo2":null,"peso":null,"talla":null} }
Sin markdown, sin backticks, sin texto antes o después. Primer carácter "{", último "}".`

function extraerJSON(txt: string): unknown | null {
  const i = txt.indexOf('{'); const j = txt.lastIndexOf('}')
  if (i < 0 || j <= i) return null
  try { return JSON.parse(txt.slice(i, j + 1)) } catch { return null }
}

export async function POST(req: NextRequest) {
  const acceso = await verificarUsuario(req)
  if (!acceso.ok) return acceso.response

  let body: { nota?: unknown; instruccion?: string; contexto?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }
  const instruccion = String(body.instruccion ?? '').trim()
  if (!instruccion) return NextResponse.json({ ok: false, error: 'Escribe qué corregir' }, { status: 400 })
  if (!body.nota) return NextResponse.json({ ok: false, error: 'Falta la nota' }, { status: 400 })

  const { key: API_KEY } = await resolverClaveIA(acceso.uid, 'anthropic', ENV_ANTHROPIC)
  if (!API_KEY) return NextResponse.json({ ok: false, error: 'No hay API key de Claude configurada (Configuración → Llaves de IA).' }, { status: 503 })

  const userMsg = `NOTA ACTUAL (JSON):\n${JSON.stringify(body.nota)}\n\nCONTEXTO DEL PACIENTE (referencia, no lo metas a la nota salvo que se pida):\n${JSON.stringify(body.contexto ?? {})}\n\nINSTRUCCIÓN DE CORRECCIÓN DEL MÉDICO:\n"${instruccion}"\n\nDevuelve la nota corregida en JSON aplicando SOLO ese cambio.`

  for (const model of MODELOS) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: headers(API_KEY),
        body: JSON.stringify({ model, max_tokens: 8000, system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content: userMsg }] }),
      })
      if (!res.ok) {
        // Modelo no encontrado → prueba el siguiente; otros errores → aborta.
        if (res.status === 404) continue
        const err = await res.text().catch(() => '')
        return NextResponse.json({ ok: false, error: `IA no disponible (${res.status})`, _debug: err.slice(0, 200) }, { status: 502 })
      }
      const data = await res.json()
      const texto = (data?.content?.[0]?.text ?? '') as string
      const nota = extraerJSON(texto)
      if (!nota || typeof nota !== 'object') return NextResponse.json({ ok: false, error: 'La IA no devolvió una nota válida. Intenta reformular.' }, { status: 502 })
      return NextResponse.json({ ok: true, ...(nota as Record<string, unknown>) })
    } catch {
      // red/timeout → intenta el siguiente modelo
      continue
    }
  }
  return NextResponse.json({ ok: false, error: 'No se pudo contactar a la IA. Intenta de nuevo.' }, { status: 502 })
}

export const runtime = 'nodejs'
