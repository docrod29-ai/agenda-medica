/**
 * GOLDEN — se pedía un alias de modelo, y con él un tope de términos que quizá
 * no existía.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * La diarización pedía `speech_model: 'best'`. Comprobado en la documentación
 * del proveedor (agosto 2026, página «Models»): **«best» ya no aparece** entre
 * los valores de `speech_model`. Es un alias heredado — puede seguir
 * resolviéndose, pero **a qué modelo lo decide el proveedor**, y puede cambiar
 * sin avisar.
 *
 * Y de ese modelo depende cuántos términos de sesgo se aceptan:
 *
 * · `universal-3.5-pro` — «Keyterms prompting up to **1,000** words».
 * · `universal-2` — «Keyterms prompting up to **200** words».
 *
 * Nosotros mandábamos **mil** siempre. Si el alias caía en `universal-2`, ochocientos
 * los tiraba el proveedor por su cuenta y por su criterio — y el orden de esa
 * lista **es la política**: primero los fármacos de ESTE paciente. Un recorte
 * que no controlamos puede tirar justo lo que más importa, sin decir nada.
 *
 * ── Y LAS VOCES ──────────────────────────────────────────────────────────────
 *
 * No se mandaba ningún límite de hablantes. Por defecto el proveedor asume hasta
 * **10** voces en audio de 2–10 minutos y hasta **30** de ahí en adelante. En
 * una consulta eso no sobra: **sobre-parte**. Un mismo médico acaba repartido en
 * «A», «C» y «F», y la atribución de roles —quién dijo el diagnóstico— se
 * vuelve irresoluble.
 *
 * Se manda `max_speakers_expected`, **no** `speakers_expected`: la propia
 * documentación advierte que fijar el número exacto sin estar seguro degrada la
 * precisión, y no lo estamos — puede entrar un acompañante.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { componerSesgo, topeDe, TOPE_POR_MODELO, TOPE_TERMINOS } from '@/lib/asr/sesgo-diarizado'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const ruta = leer('src', 'app', 'api', 'expediente', 'transcribir-diarizado', 'route.ts')

describe('EL TOPE DEPENDE DEL MODELO', () => {
  it('cada modelo declarado trae el suyo, tal como lo dice el proveedor', () => {
    expect(TOPE_POR_MODELO['universal-3.5-pro']).toBe(1000)
    expect(TOPE_POR_MODELO['universal-2']).toBe(200)
  })

  it('un modelo desconocido usa el MÁS PRUDENTE, no el más grande', () => {
    /**
     * Al revés —suponer el tope alto— se manda una lista que el proveedor
     * recorta por su cuenta: exactamente el defecto que esto viene a cerrar.
     */
    expect(topeDe('modelo-que-no-existe')).toBe(200)
  })

  it('y el sesgo se presupuesta con ese tope', () => {
    const global = Array.from({ length: 500 }, (_, i) => `termino${i}`)
    const r = componerSesgo({ medicamentos: ['meropenem'] }, global, 200)
    expect(r.terminos.length).toBe(200)
    // Lo que no cupo se cuenta: un tope que nadie ve se lee como «cupo todo».
    expect(r.descartados).toBeGreaterThan(0)
  })

  it('el paciente entra PRIMERO aunque el tope sea pequeño', () => {
    // Es la garantía que hace que el recorte sea nuestro y no del proveedor.
    const global = Array.from({ length: 500 }, (_, i) => `termino${i}`)
    const r = componerSesgo({ medicamentos: ['meropenem'], alergias: ['penicilina'] }, global, 5)
    expect(r.terminos[0].toLowerCase()).toContain('meropenem')
    expect(r.delPaciente).toBeGreaterThan(0)
  })

  it('sin tope explícito se mantiene el de siempre', () => {
    // Los llamadores que no lo pasan no cambian de comportamiento.
    const r = componerSesgo({}, ['meropenem', 'ceftriaxona'])
    expect(TOPE_TERMINOS).toBe(1000)
    expect(r.terminos).toHaveLength(2)
    expect(r.descartados).toBe(0)
  })
})

describe('LA RUTA PIDE LOS MODELOS EN LISTA — el parámetro viejo lo RETIRARON', () => {
  /**
   * ── LO QUE ESTAS PRUEBAS CERTIFICABAN (4-ago-2026) ────────────────────────
   *
   * Fijaban `speech_model` y el reintento con el alias `'best'`. El proveedor
   * **retiró ese parámetro**: devuelve 400 con cualquier valor, incluido el
   * alias. Comprobado contra su API con las dos variantes.
   *
   *     «The speech_model parameter is deprecated. Use speech_models:
   *      ["universal-3-5-pro", "universal-2"]»
   *
   * O sea que los DOS intentos de la ruta fallaban y cada consulta grabada se
   * iba al motor de respaldo **sin separación de voces** — y sin ella no hay
   * atribución de rol, que es de donde cuelgan el motor de negaciones y la
   * procedencia. Silencioso: la ruta hace lo correcto y sigue con el respaldo.
   *
   * Estas pruebas pasaban en verde mientras la diarización estaba caída, porque
   * comprobaban que el código dijera lo acordado — no que el proveedor lo
   * aceptara. Una prueba de contrato no sustituye una llamada real.
   */
  it('manda la lista, no el parámetro retirado', () => {
    expect(ruta).toContain("const MODELOS_DIARIZACION = ['universal-3-5-pro', 'universal-2'] as const")
    expect(ruta).toContain('speech_models: [...MODELOS_DIARIZACION],')
    expect(ruta).not.toContain('speech_model:')
  })

  it('con el nombre en la forma que el proveedor pide: guiones, no punto', () => {
    expect(ruta).toContain("'universal-3-5-pro'")
  })

  it('y presupuesta el sesgo para el modelo MÁS PEQUEÑO de la lista', () => {
    /**
     * Si se presupuestara para el mayor y el proveedor acabara usando el menor,
     * ochocientos términos los tiraría él, por el criterio que quisiera y sin
     * decirlo. Mejor mandar menos y saber cuáles.
     */
    expect(ruta).toContain('const tope = Math.min(...MODELOS_DIARIZACION.map(m => topeDe(m)))')
    expect(ruta).toContain('componerSesgo(ctxSesgo, WORD_BOOST_MEDICO, tope)')
  })

  it('ya no reintenta un 4xx — el respaldo entre modelos lo hace el proveedor', () => {
    /**
     * El reintento existía para salvar la separación de voces, y el 4-ago se
     * vio que no salvaba nada: fallaban los dos. Repetir un cuerpo que el
     * proveedor rechaza no lo arregla; esconde el motivo detrás de otro viaje.
     */
    expect(ruta).not.toContain('sub = await enviar(armar(null))')
    expect(ruta).toContain('const sub = await enviar(armar())')
  })

  it('y un rechazo se registra CON el motivo del proveedor', () => {
    // Es lo único que dice qué parámetro cambió. Sin él, el siguiente cambio de
    // la API vuelve a ser invisible.
    expect(ruta).toContain('safeLog.error(`[diarizado] rechazado HTTP ${sub.status}`, { detalle })')
  })
})

/**
 * ── EL MODO MÉDICO, ENCENDIDO POR DECISIÓN DEL DR. (4-ago-2026) ────────────
 *
 * `domain: 'medical-v1'` es un modelo de dominio entrenado en lenguaje clínico.
 * Su documentación declara cuatro idiomas —inglés, **español**, alemán y
 * francés—, así que el español no es un caso degradado.
 *
 * Estaba apagado porque **puede facturarse aparte**, y encender un cargo
 * recurrente en la cuenta de otro no es una decisión de ingeniería. Quedó
 * anotado como pendiente del Dr. desde la v1002.
 */
describe('EL MODO MÉDICO', () => {
  it('se manda en el cuerpo del envío', () => {
    expect(ruta).toContain("const DOMINIO_MEDICO = 'medical-v1'")
    expect(ruta).toContain('domain: DOMINIO_MEDICO,')
  })

  it('va en el MISMO cuerpo que arma los dos intentos', () => {
    /**
     * Si sólo fuera en el intento con nombre, un rechazo del modelo dejaría al
     * paciente sin modo médico sin que nadie lo notara — el reintento es
     * silencioso por diseño.
     */
    const cuerpo = ruta.slice(ruta.indexOf('const armar ='), ruta.indexOf('const enviar ='))
    expect(cuerpo).toContain('domain: DOMINIO_MEDICO,')
  })

  it('está escrito que falla SUAVE y por qué se podía encender', () => {
    // Con un idioma no soportado el proveedor lo ignora y avisa, en vez de
    // rechazar la transcripción; y el reintento con el alias ya existía.
    expect(ruta).toMatch(/Falla \*\*suave\*\*/)
    expect(ruta).toMatch(/puede facturarse aparte/)
  })

  it('y que la decisión es del Dr., con fecha', () => {
    // Un cargo recurrente encendido sin dueño es una factura que nadie reclama.
    expect(ruta).toMatch(/decisión del Dr\., 4-ago-2026/)
  })
})

describe('EL LÍMITE DE VOCES', () => {
  it('se manda un máximo, no un número exacto', () => {
    expect(ruta).toContain('speaker_options: { min_speakers_expected: 1, max_speakers_expected: MAX_VOCES }')
    // Que no se mande como campo suelto del cuerpo (en el comentario sí se
    // nombra, para explicar por qué NO se usa).
    expect(ruta).not.toMatch(/^\s+speakers_expected:/m)
  })

  it('el máximo es acotado y está justificado como configuración, no como cifra clínica', () => {
    expect(ruta).toContain('const MAX_VOCES = 4')
    expect(ruta).toMatch(/NO es una cifra clínica/)
  })

  it('y se dice qué pasaba sin él', () => {
    expect(ruta).toMatch(/sobre-parte/)
    expect(ruta).toMatch(/irresoluble/)
  })
})
