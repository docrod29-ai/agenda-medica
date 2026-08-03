/**
 * GOLDEN + GUARDIÁN — el mismo antibiograma daba dos categorías según entrara por
 * la foto o por el teclado.
 *
 * ── EL FALLO, REPRODUCIDO CORRIENDO EL MOTOR ─────────────────────────────────
 *
 * Un *S. pneumoniae* de hemocultivo con **penicilina «>2»** reportada como S:
 *
 *   | camino  | lo que llegaba al motor        | categoría CLSI | ¿concuerda? |
 *   |---------|--------------------------------|----------------|-------------|
 *   | foto    | `{ cmi: 2 }`                   | **S**          | sí          |
 *   | manual  | `{ cmi: 2, cmiCensurada: '>' }`| **I**          | **no**      |
 *
 * Es exactamente la decisión que el Dr. ya había tomado —«una CMI es un intervalo,
 * no un número»— aplicada sólo en uno de los dos caminos. Por el otro, el aviso
 * de discordancia con el laboratorio **no salía**.
 *
 * ── POR QUÉ PASÓ ─────────────────────────────────────────────────────────────
 *
 * `parseCMI` vivía dentro de `antibiograma/page.tsx`. El puente visión→motor de
 * la librería, `perfilAEntrada`, no podía usarla: reenviaba `c.cmi` —el número
 * pelado— y **nunca miraba `cmi_texto`**, que es justo donde el prompt de visión
 * pide que venga el símbolo. `cmiCensurada` no se asignaba jamás por ese camino.
 *
 * Y de paso tiraba, sin decir nada, toda fila cuya categoría no fuera S/I/R: un
 * SDD reportado por el laboratorio desaparecía del panel y de los avisos.
 *
 * La firma de siempre: la regla escrita en un sitio, y el código de al lado sin
 * cumplirla.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parseCMI, POR_QUE_UNA_SOLA_IMPLEMENTACION } from '@/lib/expediente/antibiograma/cmi'
import {
  PerfilExtraido, perfilAEntrada, perfilAEntradaConDescartes,
} from '@/lib/expediente/antibiograma/vision'
import { interpretarAntibiograma } from '@/lib/expediente/antibiograma/motor'

const perfilPenicilina = (cmi_texto: string | null, cmi: number | null) => PerfilExtraido.parse({
  organismo: 'Streptococcus pneumoniae', muestra: 'sangre',
  resultados: [{ antibiotico: 'Penicilina', interpretacion: 'S', cmi_texto, cmi }],
})

describe('EL CASO QUE SE ROMPÍA: penicilina «>2» leída por foto', () => {
  const { entrada } = perfilAEntradaConDescartes(perfilPenicilina('>2', 2))

  it('el símbolo llega al motor', () => {
    expect(entrada.resultados[0]).toMatchObject({ cmi: 2, cmiCensurada: '>' })
  })

  it('y la categoría deja de ser S', () => {
    // «>2» significa que el valor real está POR ENCIMA de 2, y el techo de
    // susceptibilidad es 2: S es matemáticamente imposible.
    const c = interpretarAntibiograma(entrada).categoriasCMI[0]
    expect(c.categoriaCLSI).not.toBe('S')
    expect(c.desdeCmiCensurada).toBe(true)
  })

  it('y se ve que el laboratorio y el punto de corte NO concuerdan', () => {
    // Ése es el aviso que no salía por el camino de la foto.
    expect(interpretarAntibiograma(entrada).categoriasCMI[0].concuerda).toBe(false)
  })
})

describe('EL CONTROL: sin símbolo, la lectura no cambia', () => {
  /**
   * Sin esto, la reparación podría estar marcando TODO como censurado y las
   * pruebas de arriba pasarían igual, arruinando cualquier CMI exacta.
   */
  it('una CMI exacta de 2 sigue siendo S y sigue concordando', () => {
    const { entrada } = perfilAEntradaConDescartes(perfilPenicilina(null, 2))
    expect(entrada.resultados[0].cmiCensurada).toBeUndefined()
    const c = interpretarAntibiograma(entrada).categoriasCMI[0]
    expect(c.categoriaCLSI).toBe('S')
    expect(c.concuerda).toBe(true)
  })
})

describe('la lectura de la CMI, en un solo sitio', () => {
  it('lee los cuatro símbolos', () => {
    expect(parseCMI('≤0.5')).toEqual({ valor: 0.5, censurada: '<' })
    expect(parseCMI('< 0.5')).toEqual({ valor: 0.5, censurada: '<' })
    expect(parseCMI('>16')).toEqual({ valor: 16, censurada: '>' })
    expect(parseCMI('≥ 16')).toEqual({ valor: 16, censurada: '>' })
  })

  it('un valor exacto no inventa símbolo', () => {
    expect(parseCMI('0,5')).toEqual({ valor: 0.5, censurada: undefined })
    expect(parseCMI(4)).toEqual({ valor: 4 })
  })

  it('en una razón toma el componente activo, que es el del punto de corte', () => {
    // TMP-SMX se reporta «≤2/38»: el corte está definido contra el trimetoprim.
    expect(parseCMI('≤2/38')).toEqual({ valor: 2, censurada: '<' })
  })

  it('lo que no trae número devuelve null, no un cero', () => {
    // Una CMI ausente y una CMI de cero son cosas distintas, y confundirlas
    // cambia la categoría.
    for (const v of ['', '   ', 'ND', 'no reportado', null, undefined]) {
      expect(parseCMI(v), String(v)).toBeNull()
    }
  })
})

describe('lo que no cabe en el panel, se DICE', () => {
  const perfil = PerfilExtraido.parse({
    organismo: 'Escherichia coli', muestra: 'orina',
    resultados: [
      { antibiotico: 'Meropenem', interpretacion: 'S', cmi_texto: '≤0.25' },
      { antibiotico: 'Cefepime', interpretacion: 'SDD', cmi_texto: '4' },
      { antibiotico: 'Ceftriaxona', interpretacion: null, cmi_texto: 'ND' },
      { antibiotico: 'Amikacina', interpretacion: 'S', conf: 'baja', needs_review: true },
    ],
  })
  const { entrada, descartes } = perfilAEntradaConDescartes(perfil)

  it('el SDD no desaparece: se nombra', () => {
    expect(descartes.sdd).toEqual(['Cefepime'])
    expect(descartes.avisos.join(' ')).toContain('Cefepime')
    expect(descartes.avisos.join(' ')).toMatch(/EXPOSICIÓN AUMENTADA/)
  })

  it('y NO se cuela al panel convertido en otra cosa', () => {
    /**
     * ACTUALIZADO el 3-ago-2026 con la decisión 2 del Dr. Este archivo dejaba el
     * SDD FUERA del panel porque a qué categoría correspondía era criterio
     * clínico y estaba sin decidir. Ya está decidido: **entra, y entra COMO
     * SDD** — categoría propia, ni S ni I.
     *
     * Lo que esta prueba fija sigue siendo exactamente lo mismo que fijaba
     * antes: que no se convierta en otra cosa por el camino.
     */
    const fila = entrada.resultados.find(r => r.antibiotico === 'Cefepime')
    expect(fila, 'ahora sí entra').toBeDefined()
    expect(fila!.interpretacion).toBe('SDD')
    expect(fila!.interpretacion).not.toBe('S')
    expect(fila!.interpretacion).not.toBe('I')
  })

  it('lo ilegible se queda fuera y se avisa — nunca se asume sensible', () => {
    expect(descartes.ilegibles).toEqual(['Ceftriaxona'])
    expect(entrada.resultados.map(r => r.antibiotico)).not.toContain('Ceftriaxona')
    expect(descartes.avisos.join(' ')).toMatch(/para no darlos por sensibles/)
  })

  it('lo dudoso se avisa pero NO se tira: la categoría se leyó', () => {
    /**
     * `needs_review` es «revísalo», no «no se pudo leer». Sacarlo del panel
     * borraría un dato que la IA sí transcribió, y el médico se quedaría sin la
     * fila que tiene que verificar.
     */
    expect(descartes.dudosos).toEqual(['Amikacina'])
    expect(descartes.avisos.join(' ')).toMatch(/Lectura dudosa/)
    expect(entrada.resultados.map(r => r.antibiotico)).toContain('Amikacina')
  })

  it('y lo legible pasa entero, con su símbolo', () => {
    expect(entrada.resultados).toEqual([
      { antibiotico: 'Meropenem', interpretacion: 'S', cmi: 0.25, cmiCensurada: '<' },
      // Entra con su categoría propia y con su CMI: decisión 2 del Dr.
      { antibiotico: 'Cefepime', interpretacion: 'SDD', cmi: 4 },
      { antibiotico: 'Amikacina', interpretacion: 'S' },
    ])
  })
})

describe('la firma antigua sigue sirviendo', () => {
  it('`perfilAEntrada` devuelve lo mismo que la entrada de la nueva', () => {
    const p = perfilPenicilina('>2', 2)
    expect(perfilAEntrada(p)).toEqual(perfilAEntradaConDescartes(p).entrada)
  })
})

describe('GUARDIÁN — una sola implementación en todo el repositorio', () => {
  /**
   * Barre `src/` buscando `function parseCMI`. Si aparece una segunda, los dos
   * caminos vuelven a poder divergir — y divergen en silencio, porque nadie
   * compara el resultado del mismo antibiograma leído de las dos maneras.
   */
  function archivos(dir: string): string[] {
    const out: string[] = []
    for (const e of readdirSync(dir)) {
      const p = join(dir, e)
      if (statSync(p).isDirectory()) { out.push(...archivos(p)); continue }
      if (e.endsWith('.ts') || e.endsWith('.tsx')) out.push(p)
    }
    return out
  }

  const definiciones = archivos(join(process.cwd(), 'src')).filter(f => {
    const codigo = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')
    return /(?:function|const)\s+parseCMI\b/.test(codigo)
  }).map(f => f.replace(process.cwd() + '/', ''))

  it('sólo la de la librería', () => {
    expect(definiciones).toEqual(['src/lib/expediente/antibiograma/cmi.ts'])
  })

  it('la pantalla la importa en vez de tener la suya', () => {
    const page = readFileSync(
      join(process.cwd(), 'src', 'app', '(dashboard)', 'antibiograma', 'page.tsx'), 'utf8')
    expect(page).toContain("import { parseCMI } from '@/lib/expediente/antibiograma/cmi'")
  })

  it('y está escrito por qué, no como nota al margen', () => {
    expect(POR_QUE_UNA_SOLA_IMPLEMENTACION).toMatch(/S por foto e I tecleado/)
  })
})
