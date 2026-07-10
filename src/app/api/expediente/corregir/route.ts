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
// Mismo nivel de razonamiento que la generación de la nota: Opus 4.8 primero.
const MODELOS = [MODEL_OVERRIDE, 'claude-opus-4-8', 'claude-opus-4-6', 'claude-sonnet-5', 'claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-3-7-sonnet-latest', 'claude-3-5-sonnet-latest'].filter(Boolean)

/** Modelos que soportan "extended thinking" (razonamiento previo). 3.5 no. */
function soportaThinking(model: string): boolean {
  return /opus-4|sonnet-5|sonnet-4|3-7-sonnet/.test(model)
}

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
  if (!txt) return null
  // Quita fences de markdown (```json … ```) que a veces mete el modelo.
  let s = txt.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const i = s.indexOf('{'); const j = s.lastIndexOf('}')
  if (i < 0 || j <= i) return null
  s = s.slice(i, j + 1)
  try { return JSON.parse(s) } catch { /* intenta reparar */ }
  // Reparo común: comas colgantes antes de } o ]
  try { return JSON.parse(s.replace(/,\s*([}\]])/g, '$1')) } catch { return null }
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

  // Un intento con un modelo, con o sin thinking. Extraído para poder reintentar
  // el MISMO modelo SIN thinking si el thinking (o max_tokens alto) da 400.
  const intento = (model: string, conThinking: boolean) => {
    const payload: Record<string, unknown> = {
      model,
      max_tokens: conThinking ? 16000 : 8000,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMsg }],
    }
    if (conThinking) payload.thinking = { type: 'enabled', budget_tokens: 4000 }
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: headers(API_KEY), body: JSON.stringify(payload),
    })
  }

  let ultimoDebug = ''
  for (const model of MODELOS) {
    try {
      const pienso = soportaThinking(model)
      let res = await intento(model, pienso)
      // MODO SEGURO: si el intento con thinking dio 400, reintenta el MISMO modelo
      // sin thinking y con tokens normales (evita que un límite de la cuenta tumbe
      // la corrección al parser). El razonamiento extendido es un plus, no un must.
      if (res.status === 400 && pienso) res = await intento(model, false)
      if (!res.ok) {
        // 400/404/422 → ese modelo no existe en la cuenta o no acepta el payload;
        // 429/5xx → sobrecarga transitoria. En TODOS los casos probamos el
        // siguiente modelo en vez de abortar (antes un 400 tumbaba todo el chat).
        ultimoDebug = `HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 150)}`
        continue
      }
      const data = await res.json()
      // Con thinking, el texto va en el bloque type==='text' (tras los de razonamiento).
      const bloques: { type?: string; text?: string }[] = Array.isArray(data?.content) ? data.content : []
      const texto = (bloques.find(b => b?.type === 'text')?.text ?? bloques[0]?.text ?? '') as string
      const nota = extraerJSON(texto)
      if (nota && typeof nota === 'object') return NextResponse.json({ ok: true, ...(nota as Record<string, unknown>) })
      // Respondió pero no fue JSON parseable → intenta con el siguiente modelo.
      ultimoDebug = 'parse-fail: ' + texto.slice(0, 150)
      continue
    } catch (e) {
      ultimoDebug = 'red: ' + String(e).slice(0, 120)
      continue
    }
  }
  return NextResponse.json({ ok: false, error: 'La IA no pudo aplicar la corrección. Intenta de nuevo o reformúlala.', _debug: ultimoDebug }, { status: 502 })
}

export const runtime = 'nodejs'
