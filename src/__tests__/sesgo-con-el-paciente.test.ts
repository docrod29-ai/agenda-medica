/**
 * GOLDEN — el vocabulario del paciente llega al motor que DE VERDAD transcribe.
 *
 * ── EL HALLAZGO ──────────────────────────────────────────────────────────────
 *
 * `lexicon.ts` presupuesta con cuidado los 224 tokens del prompt de Whisper y
 * gasta primero en los fármacos y problemas de ESTE paciente. Bien pensado, bien
 * probado… y alimentando sólo al motor de **repuesto**.
 *
 * Porque el camino real intenta SIEMPRE la diarización primero, y sólo cae a
 * Whisper si aquélla falla. O sea que el motor que transcribe las consultas
 * recibía una lista genérica de mil términos, **igual para todos los pacientes
 * del mundo**.
 *
 * ── POR QUÉ ESTO PESA MÁS QUE CUALQUIER CORRECCIÓN POSTERIOR ─────────────────
 *
 * El sesgo es lo ÚNICO que cambia **lo que el motor oye**. El corrector, el
 * guardián y las marcas de confianza trabajan sobre lo ya oído, y ninguno puede
 * recuperar una palabra que nunca llegó.
 *
 * ── Y ES EL FOSO ─────────────────────────────────────────────────────────────
 *
 * Ninguno de los diez productos investigados sesga el motor con el expediente
 * del paciente que está enfrente. El líder del mercado ni siquiera aplica su
 * diccionario personalizado a la ruta ambiental — está en su documentación.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  componerSesgo, utilizable, TOPE_TERMINOS,
  POR_QUE_EL_PACIENTE_VA_PRIMERO, POR_QUE_ES_UN_FOSO,
} from '@/lib/asr/sesgo-diarizado'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const GLOBAL = ['ceftriaxona', 'meropenem', 'vancomicina', 'metformina']

describe('EL ORDEN ES LA POLÍTICA', () => {
  it('los fármacos del paciente van ANTES que el catálogo global', () => {
    const r = componerSesgo({ medicamentos: ['tacrolimus'] }, GLOBAL)
    expect(r.terminos[0]).toBe('tacrolimus')
  })

  it('las alergias van casi al principio, y no es un detalle', () => {
    /**
     * El cruce alergia↔fármaco compara contra lo que se OYÓ. Un alérgeno mal
     * transcrito es un cruce que nunca salta: el fallo se vuelve invisible
     * justo en la comprobación que existe para atraparlo.
     */
    const r = componerSesgo({ medicamentos: ['losartán'], alergias: ['penicilina'] }, GLOBAL)
    expect(r.terminos.slice(0, 2)).toEqual(['losartán', 'penicilina'])
  })

  it('los diagnósticos del paciente también entran antes que lo genérico', () => {
    const r = componerSesgo({ problemas: ['pielonefritis'] }, GLOBAL)
    expect(r.terminos.indexOf('pielonefritis')).toBeLessThan(r.terminos.indexOf('ceftriaxona'))
  })

  it('y el catálogo global sigue rellenando: no se tira sitio', () => {
    // Cada hueco sin usar es una palabra que el motor no va a esperar.
    const r = componerSesgo({ medicamentos: ['tacrolimus'] }, GLOBAL)
    expect(r.terminos).toContain('meropenem')
    expect(r.terminos.length).toBe(1 + GLOBAL.length)
  })
})

describe('SIN CONTEXTO NO SE QUEDA SIN SESGO', () => {
  it('con el paciente vacío, el sesgo es el de siempre', () => {
    /**
     * Un dato ausente no puede degradar el dictado. Es el mismo patrón que ya
     * usa `lexicon.ts`: si el léxico revienta, se usa el de siempre.
     */
    const r = componerSesgo({}, GLOBAL)
    expect(r.terminos).toEqual(GLOBAL)
    expect(r.delPaciente).toBe(0)
  })
})

describe('NO SE RECORTA EN SILENCIO', () => {
  it('se dice cuántos NO cupieron', () => {
    // «Un tope que nadie ve se lee como cupo todo» — el fallo que este
    // repositorio ya arregló en otros sitios.
    const muchos = Array.from({ length: TOPE_TERMINOS + 20 }, (_, i) => `farmacoDePrueba${i}`)
    const r = componerSesgo({}, muchos)
    expect(r.terminos).toHaveLength(TOPE_TERMINOS)
    expect(r.descartados).toBe(20)
  })

  it('y lo del paciente NUNCA es lo que se recorta', () => {
    const muchos = Array.from({ length: TOPE_TERMINOS + 50 }, (_, i) => `farmacoDePrueba${i}`)
    const r = componerSesgo({ medicamentos: ['tacrolimus', 'micofenolato'] }, muchos)
    expect(r.terminos).toContain('tacrolimus')
    expect(r.terminos).toContain('micofenolato')
    expect(r.delPaciente).toBe(2)
  })
})

describe('LO QUE NO SIRVE PARA SESGAR NO GASTA SITIO', () => {
  it('las palabras de menos de cuatro letras no entran', () => {
    // No sesgan nada y ocupan un hueco que vale una palabra de verdad.
    expect(utilizable('IV')).toBe(false)
    expect(utilizable('mg')).toBe(false)
    expect(utilizable('losartán')).toBe(true)
  })

  it('ni las frases largas, que el proveedor descarta enteras sin decirlo', () => {
    expect(utilizable('trimetoprima con sulfametoxazol')).toBe(true)          // 3 palabras
    expect(utilizable('paciente con datos de respuesta inflamatoria grave')).toBe(false)
  })

  it('no se repite un término por venir de dos sitios', () => {
    const r = componerSesgo({ medicamentos: ['Ceftriaxona'] }, ['ceftriaxona', 'meropenem'])
    expect(r.terminos.filter(t => t.toLowerCase() === 'ceftriaxona')).toHaveLength(1)
    // Gana la forma del PACIENTE, que es la que él escribió en el expediente.
    expect(r.terminos[0]).toBe('Ceftriaxona')
  })

  it('los acentos no crean duplicados', () => {
    const r = componerSesgo({ medicamentos: ['losartan'] }, ['losartán'])
    expect(r.terminos).toHaveLength(1)
  })
})

describe('ESTÁ CONECTADO — por los DOS caminos', () => {
  const ruta = leer('src', 'app', 'api', 'expediente', 'transcribir-diarizado', 'route.ts')

  it('la ruta compone el sesgo en vez de mandar la lista pelada', () => {
    // El tercer argumento lo añadió la v1002: el tope de términos depende del
    // modelo que se pida (1 000 en universal-3.5-pro, 200 en universal-2).
    expect(ruta).toContain('componerSesgo(ctxSesgo, WORD_BOOST_MEDICO,')
    expect(ruta).toContain('word_boost: sesgo.terminos')
  })

  it('lee el contexto del formulario Y del JSON', () => {
    /**
     * Audio corto viaja como formulario; audio largo ya está en Storage y viaja
     * como JSON. Leerlo sólo en uno habría dejado las consultas LARGAS —las que
     * más términos traen— con el sesgo genérico: el mismo defecto, a medias.
     */
    expect(ruta).toContain("comoLista(formData.get('medicamentos'))")
    expect(ruta).toContain('comoLista(body?.medicamentos)')
  })

  it('el hook manda el contexto por los dos caminos', () => {
    const hook = leer('src', 'hooks', 'useGrabacionAudio.ts')
    expect(hook).toMatch(/intentarDiarizar\(blob, ext, duracionRef\.current, contextoRef\.current\)/)
    expect(hook).toMatch(/intentarDiarizarLargo\(blob, ext, recoveryKeyRef\.current, duracionRef\.current, contextoRef\.current\)/)
  })

  it('y la consulta aporta fármacos, diagnósticos y ALERGIAS', () => {
    /**
     * Antes se exigía la expresión literal `(patient?.alergias ?? '').split(...)`
     * — y **esa expresión era uno de los cuatro parsers del mismo campo**:
     * partía sólo por coma, punto y coma y salto de línea, así que «Penicilina /
     * Sulfas» viajaba como un término, «niega alergias» viajaba como si fuera un
     * alérgeno y `alergiasEstructuradas` no se miraba.
     *
     * Segunda vez en el día que una prueba fija la FORMA de una expresión y con
     * eso certifica un defecto. Se comprueba el llamador canónico; el
     * comportamiento lo prueba `un-solo-parser-de-alergias.test.ts`.
     */
    const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(page).toContain('alergias: alergenosDe(patient ?? {})')
  })

  it('un tope alcanzado se registra, no se traga', () => {
    expect(ruta).toMatch(/no cupieron/)
  })
})

describe('LAS RAZONES ESTÁN ESCRITAS', () => {
  it('por qué el paciente va primero', () => {
    expect(POR_QUE_EL_PACIENTE_VA_PRIMERO).toMatch(/lo que el motor oye/i)
    expect(POR_QUE_EL_PACIENTE_VA_PRIMERO).toMatch(/nunca llegó/)
  })
  it('y por qué esto es un foso, no una mejora más', () => {
    expect(POR_QUE_ES_UN_FOSO).toMatch(/ruta ambiental/)
  })
})
