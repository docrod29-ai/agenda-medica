/**
 * GOLDEN — REG-685 · la nota 💎 Máxima pedía el razonamiento con una forma que
 * el proveedor rechaza, y se rehacía SIN razonar. Y su ensamble esperaba en
 * serie lo que podía correr en paralelo.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * La ruta de la nota mandaba `thinking: { type: 'enabled', budget_tokens: 6000 }`
 * a todo modelo que «soportara thinking». Esa forma la aceptaban Opus 4.5 y
 * Sonnet 4.5. **Opus 4.7, 4.8, Opus 5, Sonnet 5 y Fable la rechazan con 400**:
 * desde esa generación sólo existe `{ type: 'adaptive' }`.
 *
 * El «modo seguro» que ya había —ante un 400 con thinking, repetir la misma
 * llamada sin thinking— se pensó para una cuenta rara con una política
 * restrictiva (auditoría B-003 del panel de sep-2026: «probabilidad baja»).
 * Con Opus 4.8 arriba de la cascada se disparaba en TODAS las notas Máxima:
 * un viaje de más al proveedor y la nota redactada sin el razonamiento que el
 * dueño decidió que «no escatima». Lo único que lo decía era una línea de
 * `safeLog.error` que nadie mira en consulta.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * El dueño preguntó por qué la nota tardaba tanto (11-sep-2026). Al recorrer
 * la ruta con la referencia vigente del proveedor a la vista, la forma del
 * parámetro no coincidía con la que aceptan los modelos que la cascada elige
 * primero. Es la hermana exacta de REG-167: el código *decía* razonamiento,
 * el proveedor no lo *aceptaba*, y el fallo caía en un camino que sigue.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * Un literal en la ruta, decidido cuando el modelo de arriba era otro. La
 * cascada cambia de modelo sola (toma el mejor que la cuenta tenga) y nadie
 * vuelve a cuestionar el literal. La forma correcta depende del modelo, así
 * que tiene que salir de una función del modelo: `thinkingPara(model)`.
 *
 * ── LO SEGUNDO: EL ENSAMBLE EN SERIE ─────────────────────────────────────────
 *
 * El borrador de GPT (segunda redacción del mismo caso) se pedía DESPUÉS de
 * que Claude terminara, y luego tenía 25 s para que GPT contestara y Claude
 * escribiera la síntesis. GPT solo, con 8 000 tokens de salida, se come esos
 * 25 s. Resultado práctico: la nota esperaba 25 s y el ensamble se tiraba.
 * El borrador sólo necesita el prompt, que ya existe antes de llamar a
 * Claude: se pide entonces y corre en paralelo.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * 1. La forma antigua (`budget_tokens`) no sale hacia ningún modelo 4.6+.
 * 2. El literal no vive en la ruta: la ruta llama a `thinkingPara(model)`.
 * 3. El modo rápido del proveedor (mismo modelo, misma salida, más caro) está
 *    APAGADO salvo que el dueño lo encienda, sólo aplica a los modelos que lo
 *    sirven, y si el proveedor lo rechaza se repite en velocidad normal.
 * 4. El borrador de GPT arranca ANTES de la llamada a Claude.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · No llama al proveedor: no puede afirmar que `adaptive` sea aceptado HOY.
 *   Eso se mira del otro lado con una llave real (regla «el dato tiene que
 *   LLEGAR»); aquí sólo se garantiza que la forma rechazada no vuelva.
 * · No mide cuánto tarda la nota ni cuántas veces aterriza el ensamble: eso
 *   son `_modelosNota` y el libro de costos en producción.
 * · No cubre `corregir` ni `evidencia`, que llevan el mismo literal antiguo
 *   con sus propios presupuestos. Declarado como pendiente en el ledger.
 * · El modo seguro (400 con thinking → sin thinking) sigue sin avisar al
 *   médico en la respuesta (B-003). Con la forma correcta ya no debería
 *   dispararse; si se dispara, sigue siendo silencioso. Abierto.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  thinkingPara, versionDe, velocidadPara, admiteModoRapido, cabecerasDeVelocidad,
  cuerpoDeVelocidad, modoRapidoHabilitado, BUDGET_LEGADO, BETA_MODO_RAPIDO,
  ESTADOS_QUE_RETIRAN_LA_VELOCIDAD,
} from '@/lib/ia/parametros-de-nota'

const ruta = readFileSync(join(process.cwd(), 'src/app/api/expediente/procesar/route.ts'), 'utf8')
/** El CÓDIGO de la ruta, sin comentarios: la historia puede nombrar la forma vieja; el código no. */
const codigo = ruta.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** La cascada tal como la declara la ruta, leída del archivo para no desfasarse. */
function cascadaDeLaRuta(nombre: 'MODELOS_PREMIUM' | 'MODELOS_PRO' | 'MODELOS_LIVE'): string[] {
  const bloque = ruta.match(new RegExp(`const ${nombre} = \\[([\\s\\S]*?)\\]`))?.[1] ?? ''
  return [...bloque.matchAll(/'([^']+)'/g)].map(m => m[1])
}

describe('REG-685 · la forma del razonamiento sale del modelo', () => {
  it('lee la versión de los identificadores reales, con y sin sufijo de fecha', () => {
    expect(versionDe('claude-opus-4-8')).toEqual({ familia: 'opus', version: 4.8 })
    expect(versionDe('claude-sonnet-5')).toEqual({ familia: 'sonnet', version: 5 })
    expect(versionDe('claude-haiku-4-5-20251001')).toEqual({ familia: 'haiku', version: 4.5 })
    expect(versionDe('claude-3-7-sonnet-20250219')).toEqual({ familia: 'sonnet', version: 3.7 })
    expect(versionDe('gpt-5')).toBeNull()
  })

  it('Opus 4.6+, Sonnet 4.6+ y Fable piden `adaptive`, que es la única forma que aceptan', () => {
    for (const m of ['claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-4-6', 'claude-opus-5', 'claude-sonnet-5', 'claude-sonnet-4-6', 'claude-fable-5-1']) {
      expect(thinkingPara(m), m).toEqual({ type: 'adaptive' })
    }
  })

  it('los modelos anteriores conservan la forma con presupuesto que sí aceptan', () => {
    for (const m of ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-3-7-sonnet-20250219']) {
      expect(thinkingPara(m), m).toEqual({ type: 'enabled', budget_tokens: BUDGET_LEGADO })
    }
    expect(BUDGET_LEGADO).toBe(6000)   // el mismo número que llevaba la ruta
  })

  it('Haiku y lo desconocido no llevan razonamiento, como hasta ahora', () => {
    expect(thinkingPara('claude-haiku-4-5-20251001')).toBeNull()
    expect(thinkingPara('claude-haiku-4-5')).toBeNull()
    expect(thinkingPara('claude-3-5-sonnet-20241022')).toBeNull()
    expect(thinkingPara('gpt-5')).toBeNull()
  })

  it('AL REVÉS: la forma antigua no sale hacia ningún modelo de la cascada que la rechaza', () => {
    // Éste es el defecto: `budget_tokens` hacia Opus 4.8. Si alguien lo
    // reintrodujera en `thinkingPara`, este caso cae.
    const rechazan = [...cascadaDeLaRuta('MODELOS_PREMIUM'), ...cascadaDeLaRuta('MODELOS_PRO')]
      .filter(m => (versionDe(m)?.version ?? 0) >= 4.6)
    expect(rechazan.length, 'la cascada tiene modelos 4.6+ (si no, el guardián no mira nada)').toBeGreaterThan(0)
    for (const m of rechazan) {
      const forma = thinkingPara(m)
      expect(forma && 'budget_tokens' in forma, `${m} recibiría budget_tokens`).toBe(false)
    }
  })

  it('el modelo de ARRIBA de la cascada premium —el que se usa de verdad— razona', () => {
    const [primero] = cascadaDeLaRuta('MODELOS_PREMIUM')
    expect(primero).toBeTruthy()
    expect(thinkingPara(primero)).not.toBeNull()
  })

  it('la ruta ya no lleva el literal: lo pide por modelo', () => {
    expect(codigo).not.toContain('budget_tokens')
    expect(ruta).toContain("from '@/lib/ia/parametros-de-nota'")
    expect(ruta).toContain('const thinking = conThinking ? thinkingPara(model) : null')
    // El modo seguro sigue existiendo para un rechazo de verdad; no se quita.
    expect(ruta).toContain('if (res.status === 400 && conThinking)')
  })

  it('con razonamiento adaptativo el JSON tiene el techo del auto-reintento, no 24000 − 6000', () => {
    expect(ruta).toContain('thinking ? 32000 : 24000')
  })
})

describe('REG-685 · el modo rápido es del dueño, y nunca deja sin nota', () => {
  it('APAGADO por omisión: sin la bandera no se pide velocidad a nadie', () => {
    expect(modoRapidoHabilitado(undefined)).toBe(false)
    expect(modoRapidoHabilitado('')).toBe(false)
    expect(modoRapidoHabilitado('true')).toBe(false)
    expect(modoRapidoHabilitado('1')).toBe(true)
    expect(velocidadPara('claude-opus-4-8', false)).toBe('standard')
  })

  it('encendido, sólo lo sirven Opus 4.8 y Opus 5', () => {
    expect(velocidadPara('claude-opus-4-8', true)).toBe('fast')
    expect(velocidadPara('claude-opus-5', true)).toBe('fast')
    for (const m of ['claude-opus-4-7', 'claude-opus-4-6', 'claude-sonnet-5', 'claude-haiku-4-5-20251001', 'claude-fable-5-1']) {
      expect(admiteModoRapido(m), m).toBe(false)
      expect(velocidadPara(m, true), m).toBe('standard')
    }
  })

  it('la velocidad viaja con su cabecera beta Y su campo, o con ninguno de los dos', () => {
    expect(cabecerasDeVelocidad('fast')).toEqual({ 'anthropic-beta': BETA_MODO_RAPIDO })
    expect(cuerpoDeVelocidad('fast')).toEqual({ speed: 'fast' })
    expect(cabecerasDeVelocidad('standard')).toEqual({})
    expect(cuerpoDeVelocidad('standard')).toEqual({})
    expect(BETA_MODO_RAPIDO).toBe('fast-mode-2026-02-01')
  })

  it('si el proveedor no la sirve (400) o su cupo se agotó (429), la ruta repite en velocidad normal', () => {
    expect([...ESTADOS_QUE_RETIRAN_LA_VELOCIDAD].sort()).toEqual([400, 429])
    expect(ruta).toContain("if (velocidad === 'fast' && ESTADOS_QUE_RETIRAN_LA_VELOCIDAD.has(res.status))")
    expect(ruta).toContain("return enviar('standard')")
    // Y ese reintento NO es un segundo `fetch` suelto: es la misma función, con
    // el mismo tope de espera (REG-346 cuenta las señales; aquí se cuenta el
    // destino).
    expect([...ruta.matchAll(/https:\/\/api\.anthropic\.com\/v1\/messages/g)]).toHaveLength(1)
  })

  it('un 529 en modo rápido NO retira la velocidad: es sobrecarga general y la reintenta el bucle de siempre', () => {
    expect(ESTADOS_QUE_RETIRAN_LA_VELOCIDAD.has(529)).toBe(false)
    expect(ESTADOS_QUE_RETIRAN_LA_VELOCIDAD.has(503)).toBe(false)
  })
})

describe('REG-685 · el borrador de GPT arranca a la vez que Claude', () => {
  it('se pide ANTES de la primera llamada a Claude, no después', () => {
    const arranque = ruta.indexOf('const borradorGPT')
    const claude = ruta.indexOf('await llamarClaudeConReintentos(API_KEY, model, system, userMsg, conThinking)')
    expect(arranque).toBeGreaterThan(0)
    expect(claude).toBeGreaterThan(0)
    expect(arranque, 'el borrador de GPT tiene que pedirse antes de esperar a Claude').toBeLessThan(claude)
  })

  it('el ensamble consume ese borrador en vez de pedir otro', () => {
    expect(ruta).toContain('const notaGPT = await borradorGPT')
    // Una definición y UNA llamada. Dos llamadas serían pagar dos borradores.
    expect([...ruta.matchAll(/generarNotaOpenAI\(/g)]).toHaveLength(2)
  })

  it('sólo se pide cuando de verdad va a haber ensamble, y con su catch', () => {
    expect(ruta).toContain("const quiereEnsamble = perfil === 'premium' && !modoEconomico && !rapido")
    expect(ruta).toMatch(/const borradorGPT[\s\S]*?\.catch\(\(\) => null\)\s*:\s*Promise\.resolve\(null\)/)
  })

  it('el tope de 25 s del ensamble sigue: la nota de Claude nunca espera más por la segunda opinión', () => {
    expect(ruta).toContain('new Promise<null>(r => setTimeout(() => r(null), 25000))')
  })
})
