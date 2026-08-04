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

describe('LA RUTA PIDE EL MODELO POR SU NOMBRE', () => {
  it('ya no manda el alias como primera opción', () => {
    expect(ruta).toContain("const MODELO_DIARIZACION = 'universal-3.5-pro'")
    expect(ruta).toContain('speech_model: modelo ?? \'best\'')
  })

  it('y presupuesta el sesgo PARA ESE modelo', () => {
    expect(ruta).toContain('componerSesgo(ctxSesgo, WORD_BOOST_MEDICO, modelo ? topeDe(modelo) : TOPE_TERMINOS)')
  })

  it('si el proveedor rechaza el nombre, se reintenta con el alias', () => {
    /**
     * Perder la separación de voces por una cadena de texto sería mucho peor
     * que seguir con lo que ya funcionaba: de ella cuelgan la atribución de
     * roles, la procedencia V3 y las palabras a verificar.
     */
    expect(ruta).toContain('if (!sub.ok && sub.status >= 400 && sub.status < 500)')
    expect(ruta).toContain('sub = await enviar(armar(null))')
  })

  it('el reintento se registra: una caída silenciosa se lee como un acierto', () => {
    expect(ruta).toMatch(/rechazado \(HTTP \$\{sub\.status\}\); reintento con el alias heredado/)
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
