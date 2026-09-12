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
 * 3. El modo rápido del proveedor (mismo modelo, misma salida, más caro) nació
 *    apagado y el dueño lo encendió (D-060): va por omisión, `0` lo apaga,
 *    sólo aplica a los modelos que lo sirven, y si el proveedor lo rechaza se
 *    repite en velocidad normal.
 * 4. El borrador de GPT arranca ANTES de la llamada a Claude.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · No llama al proveedor: no puede afirmar que `adaptive` sea aceptado HOY.
 *   Eso se mira del otro lado con una llave real (regla «el dato tiene que
 *   LLEGAR»); aquí sólo se garantiza que la forma rechazada no vuelva.
 * · No mide cuánto tarda la nota ni cuántas veces aterriza el ensamble: eso
 *   son `_modelosNota` y el libro de costos en producción.
 * · `corregir` y `evidencia` llevaban el mismo literal antiguo con sus propios
 *   presupuestos (4000 y 5000): se cubren abajo, con la misma función.
 * · REG-686 (B-003): si el modo seguro se dispara de todos modos, la respuesta
 *   lo DICE (`_sinRazonamiento` + aviso), la pantalla lo pinta y la
 *   procedencia sellada lo guarda (`razonamientoExtendido`). No cubre que el
 *   aviso se lea: eso es la pantalla, y se recorre a mano.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  thinkingPara, versionDe, velocidadPara, admiteModoRapido, cabecerasDeVelocidad,
  cuerpoDeVelocidad, modoRapidoHabilitado, BUDGET_LEGADO, BETA_MODO_RAPIDO,
  ESTADOS_QUE_RETIRAN_LA_VELOCIDAD, AVISO_SIN_RAZONAMIENTO, etiquetaDeModelo,
} from '@/lib/ia/parametros-de-nota'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const sinComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const ruta = leer('src/app/api/expediente/procesar/route.ts')
/** El CÓDIGO de la ruta, sin comentarios: la historia puede nombrar la forma vieja; el código no. */
const codigo = sinComentarios(ruta)

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

  it('`corregir` y `evidencia` piden la forma por modelo, con su presupuesto legado propio', () => {
    for (const [archivo, presupuesto] of [['src/app/api/expediente/corregir/route.ts', 'BUDGET_CORRECCION'], ['src/app/api/expediente/evidencia/route.ts', '5000']] as const) {
      const src = leer(archivo)
      expect(src, archivo).toContain("from '@/lib/ia/parametros-de-nota'")
      expect(src, archivo).toContain(`thinkingPara(model, ${presupuesto})`)
      expect(sinComentarios(src), `${archivo} conserva el literal viejo`).not.toContain('budget_tokens')
      expect(sinComentarios(src), `${archivo} conserva la regex vieja`).not.toMatch(/opus-4\|sonnet-5\|sonnet-4/)
    }
    // El presupuesto por ruta sólo cambia la forma vieja; la nueva no lo lleva.
    expect(thinkingPara('claude-sonnet-4-5', 4000)).toEqual({ type: 'enabled', budget_tokens: 4000 })
    expect(thinkingPara('claude-opus-4-8', 4000)).toEqual({ type: 'adaptive' })
  })
})

describe('REG-686 · si la nota Máxima no razonó, se DICE (hallazgo B-003)', () => {
  const consulta = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')

  it('la ruta lleva la cuenta de si razonó, y la pierde en los dos caminos que degradan', () => {
    expect(ruta).toContain('razono = conThinking && thinkingPara(model) !== null')
    // Modo seguro (400 con razonamiento) y reintento por JSON cortado.
    // La propia nace sin atribuirse razonamiento extendido no comprobado.
    expect([...ruta.matchAll(/razono = false/g)]).toHaveLength(3)
    expect(ruta).toMatch(/res = await llamarClaudeConReintentos\(API_KEY, model, system, userMsg, false\)\s*\n\s*razono = false/)
    expect(ruta).toContain('if (p2) { parsed = p2; razono = false }')
  })

  it('la respuesta lo dice en las DOS salidas (válida y con aviso de esquema), y el parser local no presume razonamiento', () => {
    expect([...ruta.matchAll(/_razonamientoExtendido: razono, _sinRazonamiento: !propia && conThinking && !razono, _avisoRazonamiento: !propia && conThinking && !razono \? AVISO_SIN_RAZONAMIENTO : ''/g)]).toHaveLength(2)
    expect(ruta).toContain("_modelo: 'parser-local', _razonamientoExtendido: false")
  })

  it('el aviso existe, habla al médico y no culpa a otra cosa', () => {
    expect(AVISO_SIN_RAZONAMIENTO).toMatch(/SIN el razonamiento extendido/)
    expect(AVISO_SIN_RAZONAMIENTO).toMatch(/revisa/i)
    expect(AVISO_SIN_RAZONAMIENTO).not.toMatch(/créditos|saldo|tarjeta/i)
  })

  it('la pantalla lo pinta con el mismo peso que la degradación de modelo', () => {
    expect(consulta).toContain("setAvisoRazonamiento(data._sinRazonamiento ? String(data._avisoRazonamiento ?? '') : '')")
    expect(consulta).toContain('Esta nota se redactó sin el razonamiento extendido')
    expect(consulta).toContain('{avisoRazonamiento && !avisoModelo && !sinCreditos && !grabandoAhora() && (')
  })

  it('y la procedencia sellada lo guarda: una nota Máxima sin razonar se firma igual, pero el expediente lo dice', () => {
    expect(consulta).toContain('razonamientoExtendido: data._razonamientoExtendido === true')
    expect(consulta).toContain('razonamientoExtendido: provenanceIA.razonamientoExtendido')
    expect(consulta).toContain("modelo: 'parser-local', promptVersion: 'n/a', apiVersion: 'n/a', generadoEn: new Date().toISOString(), razonamientoExtendido: false")
    expect(leer('src/types/expediente.ts')).toContain('razonamientoExtendido?: boolean')
  })
})

describe('REG-685 · el modo rápido es del dueño, y nunca deja sin nota', () => {
  it('ENCENDIDO por omisión (D-060) y sólo `0` lo apaga: la decisión del dueño no depende de recordar una variable', () => {
    expect(modoRapidoHabilitado(undefined)).toBe(true)
    expect(modoRapidoHabilitado('')).toBe(true)
    expect(modoRapidoHabilitado('1')).toBe(true)
    expect(modoRapidoHabilitado('0')).toBe(false)
    // Apagado, no se pide velocidad a nadie.
    expect(velocidadPara('claude-opus-5', false)).toBe('standard')
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
    // D-062: el ensamble va detrás de una bandera apagada; la condición de fondo no cambia.
    expect(ruta).toContain("const quiereEnsamble = !propia && ENSAMBLE_GPT && perfil === 'premium' && !modoEconomico && !rapido")
    expect(ruta).toMatch(/const borradorGPT[\s\S]*?\.catch\(\(\) => null\)\s*:\s*Promise\.resolve\(null\)/)
  })

  it('el tope de 25 s del ensamble sigue: la nota de Claude nunca espera más por la segunda opinión', () => {
    expect(ruta).toContain('new Promise<null>(r => setTimeout(() => r(null), 25000))')
  })
})

describe('D-059 · Opus 5 a la cabeza, y el nombre del modelo sale del que contestó', () => {
  it('las cascadas con respaldo empiezan en Opus 5 y conservan 4.8 detrás', () => {
    expect(cascadaDeLaRuta('MODELOS_PREMIUM').slice(0, 2)).toEqual(['claude-opus-5', 'claude-opus-4-8'])
    for (const [archivo, nombre] of [
      ['src/app/api/expediente/corregir/route.ts', 'MODELOS'],
      ['src/app/api/expediente/evidencia/route.ts', 'MODELOS_PREMIUM'],
      ['src/app/api/expediente/antibiograma-razonar/route.ts', 'MODELOS_OPUS'],
      ['src/app/api/uci/copilot/route.ts', 'MODELOS_CLAUDE'],
    ] as const) {
      const src = leer(archivo)
      const bloque = src.match(new RegExp(`const ${nombre} = \\[([^\\]]*)\\]`))?.[1] ?? ''
      const ids = [...bloque.matchAll(/'(claude-[^']+)'/g)].map(m => m[1])
      expect(ids.slice(0, 2), archivo).toEqual(['claude-opus-5', 'claude-opus-4-8'])
    }
  })

  it('Opus 5 razona con la forma nueva y sirve el modo rápido: no se pierde nada al subir', () => {
    expect(thinkingPara('claude-opus-5')).toEqual({ type: 'adaptive' })
    expect(admiteModoRapido('claude-opus-5')).toBe(true)
  })

  it('el nombre legible se deriva del identificador, no de una cadena fija', () => {
    expect(etiquetaDeModelo('claude-opus-5')).toBe('Claude Opus 5')
    expect(etiquetaDeModelo('claude-opus-4-8')).toBe('Claude Opus 4.8')
    expect(etiquetaDeModelo('claude-sonnet-5')).toBe('Claude Sonnet 5')
    expect(etiquetaDeModelo('claude-haiku-4-5-20251001')).toBe('Claude Haiku 4.5')
    expect(etiquetaDeModelo('gpt-5')).toBe('Claude')   // nunca inventa una versión
  })

  it('AL REVÉS: ninguna ruta vuelve a escribir «Claude Opus 4.8» a mano en lo que pinta', () => {
    for (const archivo of ['src/app/api/expediente/corregir/route.ts', 'src/app/api/consultor-evidencia/route.ts']) {
      const codigo = sinComentarios(leer(archivo))
      expect(codigo, archivo).not.toContain("'Claude Opus 4.8'")
      expect(codigo, archivo).toContain('etiquetaDeModelo(')
    }
  })
})
