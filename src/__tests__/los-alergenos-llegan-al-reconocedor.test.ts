/**
 * LOS ALÉRGENOS LLEGAN AL RECONOCEDOR — REG-232 · I-9 del loop.
 *
 * ── LO QUE EL MÉDICO PIDIÓ ──────────────────────────────────────────────────
 *
 * «necesito **mejor precisión, con el audio, mejor inteligencia artificial**».
 *
 * ── EL HALLAZGO ─────────────────────────────────────────────────────────────
 *
 * El vocabulario que se le manda al reconocedor cabe en **224 tokens**, y el
 * orden en que se gasta ese presupuesto ES la política: lo más específico
 * primero. La pantalla ya calculaba los alérgenos del expediente, y el grabador
 * ya los mandaba por la red — con un comentario largo explicando por qué son la
 * pista de más valor que existe.
 *
 * **Y se tiraban en el último metro.** La ruta de transcripción leía
 * `medicamentos`, `problemas`, `aprendidas` y `especialidades` del formulario, y
 * NO `alergias`. El constructor del vocabulario ni siquiera tenía un campo para
 * ellos.
 *
 * Escrito, probado, viajando por la red — y sin conectar en el último salto.
 *
 * ── POR QUÉ ESTE CAMPO IMPORTA MÁS QUE LOS OTROS ────────────────────────────
 *
 * No porque sea más frecuente: por lo que cuesta oírlo mal.
 *
 * El cruce alergia ↔ fármaco compara contra **lo que se oyó**. Un alérgeno mal
 * transcrito es **un cruce que nunca salta**, y nadie se entera: la nota no
 * enseña un hueco, enseña una palabra parecida, y el guardián calla.
 *
 * Un fármaco mal oído, en cambio, sale impreso en la receta y el médico lo ve.
 * Por eso los alérgenos van **antes** que los fármacos, y sólo detrás de lo
 * aprendido —que es lo único que se ganó con evidencia real de este médico.
 *
 * ── UNA MEJORA QUE SE MIDIÓ Y SE DESCARTÓ ───────────────────────────────────
 *
 * En la misma iteración se probó poner lo crítico de SU especialidad por delante
 * de lo crítico de las demás. Parecía obvio. **Medido: idéntico** — 68 términos,
 * 35 de su rama, antes y después, porque `criticosGlobales()` es la unión de las
 * 79 y lo suyo ya venía dentro.
 *
 * Se revirtió y quedó anotado en el código. Dejar el cambio con un comentario
 * que promete una mejora medida en cero habría sido peor que no hacerlo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { construir } from '@/lib/asr/lexicon'
import { especialidadesDelMedico } from '@/lib/asr/especialidad-del-medico'
import { CLAVES_DE_SESGO_DEL_PACIENTE } from '@/hooks/useGrabacionAudio'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const MIAS = especialidadesDelMedico('Infectología')

describe('los alérgenos entran, y entran primero', () => {
  it('un alérgeno del expediente cabe en el vocabulario', () => {
    const lex = construir({ modulo: 'consulta', especialidades: MIAS, alergias: ['penicilina'] })
    expect(lex.terminos.map(t => t.toLowerCase())).toContain('penicilina')
  })

  it('van ANTES que los fármacos del paciente', () => {
    /**
     * Un fármaco mal oído sale impreso en la receta y el médico lo ve. Un
     * alérgeno mal oído es un cruce de seguridad que nunca salta y del que
     * nadie se entera.
     */
    const lex = construir({
      modulo: 'consulta', especialidades: MIAS,
      alergias: ['penicilina'], medicamentos: ['losartán'],
    })
    const t = lex.terminos.map(x => x.toLowerCase())
    expect(t.indexOf('penicilina')).toBeLessThan(t.indexOf('losartán'))
  })

  it('pero DESPUÉS de lo aprendido, que se ganó con evidencia', () => {
    const lex = construir({
      modulo: 'consulta', especialidades: MIAS,
      aprendidas: ['tazobactam'], alergias: ['penicilina'],
    })
    const t = lex.terminos.map(x => x.toLowerCase())
    expect(t.indexOf('tazobactam')).toBeLessThan(t.indexOf('penicilina'))
  })

  it('varios alérgenos entran todos', () => {
    const lex = construir({
      modulo: 'consulta', especialidades: MIAS,
      alergias: ['penicilina', 'sulfas', 'cefalosporinas'],
    })
    const t = lex.terminos.map(x => x.toLowerCase())
    for (const a of ['penicilina', 'sulfas', 'cefalosporinas']) expect(t).toContain(a)
  })

  it('sin alérgenos no revienta ni cambia nada más', () => {
    const sin = construir({ modulo: 'consulta', especialidades: MIAS, medicamentos: ['losartán'] })
    expect(sin.terminos[0].toLowerCase()).toBe('losartán')
  })
})

describe('está conectado en TODO el camino, no sólo en el módulo', () => {
  it('el tipo lo declara', () => {
    const lex = leer('src/lib/asr/lexicon.ts')
    expect(lex).toMatch(/alergias\?: readonly string\[\]/)
    expect(lex).toMatch(/\.\.\.\(ctx\.alergias \?\? \[\]\)/)
  })

  it('la ruta de transcripción los lee del formulario', () => {
    // Éste era el salto donde se tiraban: el grabador los mandaba y la ruta no
    // los leía.
    const r = leer('src/app/api/expediente/transcribir/route.ts')
    expect(r).toMatch(/alergias: leerLista\('alergias'\)/)
  })

  it('y la de los trozos en vivo también', () => {
    const r = leer('src/app/api/expediente/transcribir-chunk/route.ts')
    expect(r).toMatch(/alergias: leerLista\('alergias'\)/)
  })

  it('el grabador los sigue mandando — por los CUATRO puntos de envío', () => {
    /**
     * REG-516: este caso comprobaba `toContain("['alergias', ctx.alergias]")`
     * y ese literal vivía UNA vez en el archivo, en la rama de AssemblyAI. Los
     * dos puntos de Whisper no lo mandaban y el caso estaba verde. Ahora se
     * mide sobre la lista compartida que recorren los cuatro puntos; que los
     * cuatro la usen lo vigila `los-alergenos-llegan-tambien-a-whisper`.
     */
    expect(CLAVES_DE_SESGO_DEL_PACIENTE).toContain('alergias')
  })

  it('y la pantalla los sigue calculando del expediente', () => {
    const p = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
    expect(p).toMatch(/alergias: alergenosDe\(patient \?\? \{\}\)/)
  })
})

describe('la mejora que se midió y se descartó queda anotada', () => {
  it('el código dice que reordenar por especialidad NO cambia nada', () => {
    /**
     * Para que nadie lo vuelva a intentar creyendo que gana algo. Es la
     * diferencia entre una decisión documentada y una que se repite cada año.
     */
    const lex = leer('src/lib/asr/lexicon.ts')
    expect(lex).toMatch(/MEDIDO Y DESCARTADO/)
    expect(lex).toMatch(/68 términos, 35 de su rama/)
    expect(lex).toMatch(/es la UNIÓN de lo crítico de las 79/)
  })
})
