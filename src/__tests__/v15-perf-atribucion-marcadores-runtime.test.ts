/**
 * V15-PERF-001 (5ª rebanada) — la atribución por MARCADORES DE RUNTIME
 * nombra lo que los marcadores de path no pueden.
 *
 * Qué fallaba: la 4ª rebanada dejó dos chunks del excedente de /consulta
 * sin nombre — el de página (219 KB) y uno de 103 KB al que se le atribuyó
 * «el resto de la maquinaria de grabación eager». Los marcadores de path de
 * Turbopack ("[project]/…") no sobreviven a la minificación en esos chunks,
 * así que `acusarModulos` los devolvía casi vacíos y la hipótesis quedó sin
 * verificar.
 *
 * Cómo se descubrió: al correr la 5ª rebanada con fingerprinting de
 * literales, el chunk de 103 KB resultó NO ser maquinaria de grabación —
 * era `medical-vocabulary` (subconjunto vivo) + `medical-dictionary`, el
 * corpus que las validaciones de seguridad en render (alergia×medicamento,
 * PROA) necesitan. El hook de grabación real pesa 19 KB. Una hipótesis
 * plausible y SIN nombre habría mandado la siguiente rebanada a recortar
 * el módulo equivocado.
 *
 * Causa raíz: el fingerprinting inicial tenía dos hoyos que se taparon con
 * lección medida, no teórica:
 *   1. extraía literales también de los COMENTARIOS — el top-12 de
 *      medical-vocabulary eran ejemplos de JSDoc que no viajan al build,
 *      y el módulo salía «ausente» estando presente;
 *   2. aceptaba pseudo-literales de código JSX (fragmentos entre dos
 *      comillas con {}, =>, fontSize…) que jamás sobreviven a la
 *      minificación y sólo queman presupuesto de marcadores.
 *
 * La regla que lo hace seguro: `scripts/design/lib/marcadores-runtime.mjs`
 * quita comentarios ANTES de extraer, filtra pseudo-literales, exige ≥2
 * golpes para acusar (1 literal puede ser coincidencia; 2 del mismo archivo
 * no), busca lo no-ASCII también en su forma \uXXXX, y descarta marcadores
 * compartidos entre candidatos (un literal de dos dueños no acusa a nadie).
 *
 * Qué NO cubre: el tree-shaking de exports — un módulo puede estar presente
 * en el chunk con sus marcadores sacudidos si éstos viven en un export que
 * el grafo eager no importa (le pasó a los prompts de sesgo de
 * medical-vocabulary, que viajan con el pipeline diferido). Un MISS dice
 * que ESE texto no viaja; no exonera al módulo. Tampoco cubre que la lista
 * CANDIDATOS del script esté completa: nombrar un chunk exige que su dueño
 * esté en la lista.
 */
import { describe, it, expect } from 'vitest'
import {
  literalesDe,
  marcadoresDe,
  variantesDe,
  tablaDeMarcadores,
  acusarPorRuntime,
} from '../../scripts/design/lib/marcadores-runtime.mjs'

describe('literalesDe — los comentarios no fingerprintean', () => {
  it('un literal que sólo vive en un comentario NO es huella (así se escondió medical-vocabulary)', () => {
    const fuente = [
      '/** Ejemplo de JSDoc: "Meropenem dos gramos cada ocho horas en infusión" */',
      "// otro ejemplo: 'Términos: procalcitonina, hemocultivo, antibiograma'",
      "export const AVISO = 'El antibiograma llegó y cambia el tratamiento'",
    ].join('\n')
    const lits = literalesDe(fuente)
    expect(lits).toContain('El antibiograma llegó y cambia el tratamiento')
    expect(lits.join('\n')).not.toContain('Meropenem dos gramos')
    expect(lits.join('\n')).not.toContain('procalcitonina, hemocultivo')
  })

  it('no confunde una URL con un comentario de línea', () => {
    const fuente = "const DOC = 'https://ejemplo.mx/guia-clinica-de-sepsis'"
    expect(literalesDe(fuente)).toContain('https://ejemplo.mx/guia-clinica-de-sepsis')
  })
})

describe('marcadoresDe — pseudo-literales de JSX fuera', () => {
  it('descarta fragmentos de código y CSS-in-JS que no sobreviven a la minificación', () => {
    const candidatos = marcadoresDe([
      ', fontSize: 13.5, fontWeight: 700, sigue: ',
      'color-mix(in srgb, var(--amber) 30%, transparent)',
      '} disabled={firmada} aria-label={algo}',
      'La grabación sigue activa en otra pestaña de este navegador',
      'Permiso de micrófono denegado. Permítelo en los ajustes.',
      'El corrector no puede vigilar lo que nunca llegó al oído',
    ])
    expect(candidatos).toContain('La grabación sigue activa en otra pestaña de este navegador')
    expect(candidatos.join('\n')).not.toContain('fontSize')
    expect(candidatos.join('\n')).not.toContain('color-mix')
    expect(candidatos.join('\n')).not.toContain('disabled={firmada}')
  })
})

describe('variantesDe — lo no-ASCII se busca crudo y escapado', () => {
  it('genera la variante \\uXXXX y acusarPorRuntime la encuentra en un chunk que escapa acentos', () => {
    const marcador = 'Permiso de micrófono denegado en este navegador'
    const variantes = variantesDe(marcador)
    expect(variantes).toHaveLength(2)
    expect(variantes[1]).toContain('micr\\u00f3fono')

    const chunkEscapado = `var a="Permiso de micr\\u00f3fono denegado en este navegador";var b="y un segundo texto con su tilde escapada tambi\\u00e9n aqu\\u00ed"`
    const tabla = new Map([
      ['modulo-x', [marcador, 'y un segundo texto con su tilde escapada también aquí']],
    ])
    const presentes = acusarPorRuntime(chunkEscapado, tabla)
    expect(presentes).toHaveLength(1)
    expect(presentes[0]).toMatchObject({ modulo: 'modulo-x', golpes: 2 })
  })
})

describe('acusarPorRuntime — un literal suelto no acusa', () => {
  const tabla = new Map([
    ['sospechoso', [
      'primer marcador con tres palabras largas',
      'segundo marcador con otras palabras distintas',
      'tercer marcador que tampoco se repite en nada',
    ]],
  ])

  it('con 1 de 3 golpes NO hay presencia (coincidencia posible)', () => {
    const chunk = 'x="primer marcador con tres palabras largas"'
    expect(acusarPorRuntime(chunk, tabla)).toHaveLength(0)
  })

  it('con 2 de 3 golpes SÍ hay presencia', () => {
    const chunk = 'x="primer marcador con tres palabras largas";y="segundo marcador con otras palabras distintas"'
    const presentes = acusarPorRuntime(chunk, tabla)
    expect(presentes).toHaveLength(1)
    expect(presentes[0].golpes).toBe(2)
  })
})

describe('tablaDeMarcadores — un literal con dos dueños no acusa a nadie', () => {
  it('el marcador compartido entre candidatos se elimina de los dos', () => {
    const fuentes = new Map([
      ['a.ts', `const x = 'texto compartido por los dos archivos aquí'\nconst y = 'huella exclusiva del archivo a punto ts'`],
      ['b.ts', `const x = 'texto compartido por los dos archivos aquí'\nconst y = 'huella exclusiva del archivo b punto ts'`],
    ])
    const tabla = tablaDeMarcadores(['a.ts', 'b.ts'], (ruta) => fuentes.get(ruta) as string)
    expect(tabla.get('a.ts')).toEqual(['huella exclusiva del archivo a punto ts'])
    expect(tabla.get('b.ts')).toEqual(['huella exclusiva del archivo b punto ts'])
  })

  it('un candidato ilegible se salta sin tumbar la tabla', () => {
    const tabla = tablaDeMarcadores(['no-existe.ts', 'c.ts'], (ruta) => {
      if (ruta === 'no-existe.ts') throw new Error('ENOENT')
      return `const z = 'la huella del único archivo legible aquí'`
    })
    expect(tabla.has('no-existe.ts')).toBe(false)
    expect(tabla.get('c.ts')).toEqual(['la huella del único archivo legible aquí'])
  })
})

describe('el acta de la 5ª rebanada existe y nombra el excedente', () => {
  it('atribucion-consulta-final.json congela la corrida que nombró los 8 chunks', async () => {
    const { readFileSync } = await import('fs')
    const acta = JSON.parse(readFileSync('docs/design/capturas/v15-perf/atribucion-consulta-final.json', 'utf8'))
    // La refutación central: el chunk de ~103 KB es el diccionario, no la grabación.
    const conDiccionario = acta.runtimePorChunk.filter(
      (c: { modulos: { modulo: string }[] }) =>
        c.modulos.some(m => m.modulo === 'src/lib/expediente/medical-dictionary.ts'),
    )
    expect(conDiccionario.length).toBeGreaterThan(0)
    expect(Math.max(...conDiccionario.map((c: { kb: number }) => c.kb))).toBeGreaterThan(80)
    // Y el hook de grabación vive en un chunk chico (la hipótesis de la 4ª, refutada).
    const grabacion = acta.runtimePorChunk.find(
      (c: { modulos: { modulo: string }[] }) =>
        c.modulos.some(m => m.modulo === 'src/hooks/useGrabacionAudio.ts'),
    )
    expect(grabacion).toBeDefined()
    expect(grabacion.kb).toBeLessThan(40)
    // El chunk mayor es la página misma, con su nombre puesto.
    const mayor = [...acta.runtimePorChunk].sort((a: { kb: number }, b: { kb: number }) => b.kb - a.kb)[0]
    expect(mayor.modulos.map((m: { modulo: string }) => m.modulo))
      .toContain('src/app/(dashboard)/consulta/[patientId]/page.tsx')
  })
})
