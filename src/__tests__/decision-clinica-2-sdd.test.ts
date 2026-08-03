/**
 * GOLDEN — decisión 2 del Dr. (3-ago-2026): SDD es una categoría PROPIA.
 *
 * Fuente: `docs/maintenance/DECISIONES-CLINICAS-2026-08-03.md`.
 *
 * ── LO QUE SE PERDÍA ─────────────────────────────────────────────────────────
 *
 * El panel trabajaba sólo en S/I/R, así que un SDD reportado por el laboratorio
 * —cefepime, piperacilina-tazobactam, ceftarolina, daptomicina— se quedaba
 * FUERA y sólo se nombraba en un aviso que decía «captúralo a mano».
 *
 * Palabras del Dr.: **eso desperdicia información clínicamente relevante**. CLSI
 * define SDD como categoría propia: la probabilidad de eficacia depende de
 * emplear mayor exposición — dosis mayor, mayor frecuencia o infusión
 * prolongada.
 *
 *     categoria_original            = SDD
 *     utilizable                    = sí, condicional
 *     requiere_exposicion_aumentada = sí
 *     equivalente_a_S               = no
 *     equivalente_a_I               = no
 *
 * ── LAS DOS FORMAS DE EQUIVOCARSE ────────────────────────────────────────────
 *
 * Guardarlo como **S** lo vuelve un sensible cualquiera y se pierde la condición
 * de dosis: es lo que el Dr. prohibió explícitamente. Guardarlo como **I** lo
 * convierte en la resistencia que CLSI advierte que no hay que inventar — «la C
 * hace que SDD se interprete con frecuencia como resistencia, precisamente el
 * problema que CLSI intenta evitar».
 *
 * Por eso viaja como sí mismo de punta a punta.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PerfilExtraido, perfilAEntradaConDescartes } from '@/lib/expediente/antibiograma/vision'
import { interpretarAntibiograma } from '@/lib/expediente/antibiograma/motor'
import { resumenParaNota } from '@/lib/expediente/antibiograma/resumen-nota'
import { resumenDeterminista } from '@/lib/expediente/antibiograma/razonar'
import { ES_S, ES_I, ES_R, ES_SDD, NO_S } from '@/lib/expediente/antibiograma/util'

const PERFIL = PerfilExtraido.parse({
  organismo: 'Escherichia coli', muestra: 'sangre',
  resultados: [
    { antibiotico: 'Cefepime', interpretacion: 'SDD', cmi_texto: '4' },
    { antibiotico: 'Meropenem', interpretacion: 'S', cmi_texto: '≤0.25' },
    { antibiotico: 'Ciprofloxacino', interpretacion: 'R' },
    { antibiotico: 'Gentamicina', interpretacion: 'R' },
  ],
})

describe('el SDD YA ENTRA al panel', () => {
  const { entrada, descartes } = perfilAEntradaConDescartes(PERFIL)

  it('llega desde la foto, como SDD', () => {
    const fila = entrada.resultados.find(r => r.antibiotico === 'Cefepime')
    expect(fila, 'ya no se queda fuera del panel').toBeDefined()
    expect(fila!.interpretacion).toBe('SDD')
  })

  it('NO se convirtió en S ni en I', () => {
    // Las dos formas de equivocarse, fijadas.
    const fila = entrada.resultados.find(r => r.antibiotico === 'Cefepime')!
    expect(fila.interpretacion).not.toBe('S')
    expect(fila.interpretacion).not.toBe('I')
  })

  it('ya no aparece como algo que el médico tenga que capturar a mano', () => {
    expect(descartes.avisos.join(' ')).not.toMatch(/captúralos a mano/)
  })

  it('pero se sigue NOMBRANDO, con lo que significa', () => {
    // Que entre no quiere decir que pase inadvertido: la condición de dosis es
    // justamente lo que hay que leer.
    expect(descartes.sdd).toEqual(['Cefepime'])
    expect(descartes.avisos.join(' ')).toMatch(/EXPOSICIÓN AUMENTADA/)
  })

  it('y lo ilegible sigue quedándose fuera', () => {
    /**
     * Sin esto, ampliar el panel podría haber dejado entrar también lo que no se
     * pudo leer — que es lo contrario de lo que se quería.
     */
    const p = PerfilExtraido.parse({
      organismo: 'Escherichia coli',
      resultados: [{ antibiotico: 'Ceftriaxona', interpretacion: null, cmi_texto: 'ND' }],
    })
    const r = perfilAEntradaConDescartes(p)
    expect(r.entrada.resultados).toEqual([])
    expect(r.descartes.ilegibles).toEqual(['Ceftriaxona'])
  })
})

describe('los predicados tratan al SDD como lo que es', () => {
  it('ni sensible ni no-sensible: su propia categoría', () => {
    expect(ES_SDD('SDD')).toBe(true)
    expect(ES_S('SDD')).toBe(false)
    expect(ES_I('SDD')).toBe(false)
    expect(ES_R('SDD')).toBe(false)
    expect(NO_S('SDD')).toBe(false)
  })

  it('y por eso NO suma al conteo de resistencia', () => {
    /**
     * Si `NO_S` se hubiera escrito como `v !== 'S'`, el fármaco que el
     * laboratorio declaró utilizable con dosis alta pasaría a sumar para
     * declarar multirresistencia. Es justo el error que CLSI advierte.
     *
     * Aquí: cipro R + genta R + cefepime SDD = DOS clases, no tres.
     */
    const { entrada } = perfilAEntradaConDescartes(PERFIL)
    const claves = interpretarAntibiograma(entrada).fenotipos.map(f => f.clave)
    expect(claves).not.toContain('MDR')
    expect(claves).not.toContain('resistencia-adquirida-extensa')
  })
})

describe('el motor no lo fuerza a compararse con el punto de corte', () => {
  const { entrada } = perfilAEntradaConDescartes(PERFIL)
  const c = interpretarAntibiograma(entrada).categoriasCMI.find(x => x.antibiotico === 'Cefepime')!

  it('la fila queda marcada como reportada SDD', () => {
    expect(c.reportadoSDD).toBe(true)
  })

  it('y NO se inventa una concordancia contra una categoría que no existe', () => {
    /**
     * `categoriaReportada` es S/I/R por definición. Meter ahí un SDD para poder
     * comparar habría producido una «discordancia» falsa o una concordancia
     * falsa, según el lado. Se deja fuera de la comparación.
     */
    expect(c.categoriaReportada).toBeUndefined()
    expect(c.concuerda).toBeNull()
  })
})

describe('sale en las tres salidas, siempre con su condición', () => {
  const { entrada } = perfilAEntradaConDescartes(PERFIL)
  const r = interpretarAntibiograma(entrada)

  it('la NOTA nunca lo imprime a secas', () => {
    /**
     * La categoría sola se lee como una sensibilidad cualquiera. Lo que
     * significa es «utilizable SÓLO con exposición aumentada».
     */
    const nota = resumenParaNota(entrada, r)
    expect(nota).toMatch(/Cefepime SDD/)
    expect(nota).toMatch(/requiere EXPOSICIÓN AUMENTADA/)
    expect(nota).toMatch(/infusión prolongada/)
  })

  it('el PROMPT del modelo tampoco', () => {
    const p = resumenDeterminista(entrada, r)
    expect(p).toMatch(/Cefepime=SDD/)
    expect(p).toMatch(/NO equivale a S ni a I/)
  })

  it('y el prompt ya prohibía contradecir la categoría SDD', () => {
    // Estaba escrito en las reglas del sistema desde antes; ahora hay un SDD que
    // de verdad puede llegarle.
    const src = readFileSync(join(process.cwd(), 'src', 'lib', 'expediente', 'antibiograma', 'razonar.ts'), 'utf8')
    expect(src).toContain('NO contradigas las categorías S/I/R/SDD')
  })
})

describe('EL CONTROL: un panel sin SDD se comporta igual que siempre', () => {
  it('tres R adquiridas siguen dando la señal de resistencia extensa', () => {
    const p = PerfilExtraido.parse({
      organismo: 'Escherichia coli',
      resultados: [
        { antibiotico: 'Cefepime', interpretacion: 'R' },
        { antibiotico: 'Ciprofloxacino', interpretacion: 'R' },
        { antibiotico: 'Gentamicina', interpretacion: 'R' },
        { antibiotico: 'Meropenem', interpretacion: 'S' },
      ],
    })
    const { entrada } = perfilAEntradaConDescartes(p)
    expect(interpretarAntibiograma(entrada).fenotipos.map(f => f.clave)).toContain('MDR')
  })

  it('y una S sigue imprimiéndose sin condición de dosis', () => {
    const { entrada } = perfilAEntradaConDescartes(PERFIL)
    const nota = resumenParaNota(entrada, interpretarAntibiograma(entrada))
    expect(nota).toMatch(/Meropenem S \(CMI <0\.25\)/)
    expect(nota).not.toMatch(/Meropenem S[^·]*EXPOSICIÓN AUMENTADA/)
  })
})

describe('la decisión está escrita y el código la cita', () => {
  it('el documento trae la regla literal del Dr.', () => {
    const doc = readFileSync(join(process.cwd(), 'docs', 'maintenance', 'DECISIONES-CLINICAS-2026-08-03.md'), 'utf8')
    expect(doc).toContain('equivalente_a_S               = no')
    expect(doc).toContain('requiere_exposicion_aumentada = sí')
  })

  it('y los archivos que cambiaron señalan al documento', () => {
    for (const ruta of [
      ['src', 'lib', 'expediente', 'antibiograma', 'tipos.ts'],
      ['src', 'lib', 'expediente', 'antibiograma', 'vision.ts'],
    ]) {
      expect(readFileSync(join(process.cwd(), ...ruta), 'utf8'), ruta.join('/'))
        .toContain('DECISIONES-CLINICAS-2026-08-03.md')
    }
  })
})
