/**
 * CADA NOTA CON SU FORMATO, SIN MEZCLAS — REG-196.
 *
 * ── LO QUE MANDÓ EL DR. ──────────────────────────────────────────────────────
 *
 * Una **«Nota de Primera Vez»** con encabezados **SUBJETIVO (S) / OBJETIVO (O) /
 * EVALUACIÓN (A) / PLAN (P)**. El título decía una cosa y el documento tenía el
 * formato de otra. Sus palabras: «no quiero que la nota de primera vez me la
 * confundas con formato SOAP, cada nota debe tener su formato, no las mezcles».
 *
 * ── LAS DOS CAUSAS ───────────────────────────────────────────────────────────
 *
 * 1. **Una ausencia en el prompt.** De los trece tipos de nota, `primera_vez` y
 *    `alta_consulta` no tenían NINGUNA instrucción de formato. Sin una, el
 *    modelo escribe la que le sale — y en documentación médica la que sale por
 *    defecto es SOAP, por ser la más frecuente. No bastaba con no pedirle SOAP:
 *    hay que pedirle lo suyo y prohibirle lo ajeno.
 *
 * 2. **Las claves sobrevivían al cambio de tipo.** Al reprocesar sin cambiar de
 *    tipo, la base eran las secciones que ya había en memoria. Una clave de otro
 *    tipo, una vez dentro, no salía nunca.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SECCIONES_POR_TIPO, seccionesDelTipo } from '@/lib/expediente/templates'
import type { TipoNota } from '@/types/expediente'

const prompts = readFileSync(join(process.cwd(), 'src/lib/expediente/prompts.ts'), 'utf8')
const page = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8',
)
const TIPOS = Object.keys(SECCIONES_POR_TIPO) as TipoNota[]

/** El bloque de instrucciones por tipo, acotado. */
const especifico = (() => {
  const i = prompts.indexOf('const ESPECIFICO')
  return prompts.slice(i, prompts.indexOf('\n}', i))
})()

describe('ningún tipo se queda sin formato propio', () => {
  for (const t of TIPOS) {
    it(`«${t}» tiene instrucción de formato`, () => {
      // Un hueco en esta tabla es una nota con el formato de otra.
      expect(especifico, `«${t}» sin instrucción: el modelo elegirá el formato`).toContain(`  ${t}:`)
    })
  }
})

describe('SOAP sólo donde toca', () => {
  it('primera vez tiene prohibido SOAP, explícitamente', () => {
    const i = especifico.indexOf('primera_vez:')
    const bloque = especifico.slice(i, especifico.indexOf('`,', i))
    expect(bloque).toContain('NO uses formato SOAP')
  })

  it('y tiene prohibidos los encabezados S/O/A/P', () => {
    const i = especifico.indexOf('primera_vez:')
    const bloque = especifico.slice(i, especifico.indexOf('`,', i))
    expect(bloque).toContain('"S:", "O:", "A:", "P:"')
  })

  it('alta de consulta tampoco es SOAP', () => {
    const i = especifico.indexOf('alta_consulta:')
    const bloque = especifico.slice(i, especifico.indexOf('`,', i))
    expect(bloque).toContain('NO uses formato SOAP')
  })

  it('seguimiento SÍ es SOAP — ahí es lo correcto', () => {
    const i = especifico.indexOf('seguimiento:')
    expect(especifico.slice(i, i + 200)).toContain('SOAP')
  })

  it('y la regla general prohíbe traer el formato de otro tipo', () => {
    expect(prompts).toContain('18-bis. CADA NOTA CON SU FORMATO')
  })
})

describe('las claves de otro tipo no sobreviven', () => {
  const soap = [
    { key: 'subjetivo', label: 'Subjetivo (S)', value: 'Paciente de 73 años…' },
    { key: 'objetivo', label: 'Objetivo (O)', value: 'No explorada.' },
  ]

  it('una nota de primera vez sale con SUS secciones, no con las de seguimiento', () => {
    const { secciones } = seccionesDelTipo('primera_vez', soap)
    expect(secciones.map(s => s.key)).toEqual(
      SECCIONES_POR_TIPO.primera_vez.map(s => s.key),
    )
    expect(secciones.map(s => s.key)).not.toContain('subjetivo')
  })

  it('lo escrito en las claves que SÍ coinciden se conserva', () => {
    const { secciones } = seccionesDelTipo('primera_vez', [
      { key: 'padecimientoActual', label: 'x', value: 'Cuadro de tres meses.' },
    ])
    expect(secciones.find(s => s.key === 'padecimientoActual')?.value)
      .toBe('Cuadro de tres meses.')
  })

  it('y lo que no encaja NO se borra: se devuelve aparte', () => {
    /**
     * Perder prosa que el médico dictó para arreglar un problema de formato
     * sería cambiar un defecto por otro peor. En este repositorio la pérdida de
     * datos es el fallo que más caro se ha pagado.
     */
    const { huerfanas } = seccionesDelTipo('primera_vez', soap)
    expect(huerfanas.map(s => s.key)).toEqual(['subjetivo', 'objetivo'])
  })

  it('las secciones vacías de otro tipo no ensucian nada', () => {
    const { huerfanas } = seccionesDelTipo('primera_vez', [
      { key: 'subjetivo', label: 'S', value: '   ' },
    ])
    expect(huerfanas).toEqual([])
  })

  it('sin nada previo, la plantilla limpia del tipo', () => {
    const { secciones } = seccionesDelTipo('seguimiento')
    /* `pronostico` se añadió a las notas de consultorio con MI-011 (Panel de
       Lujo, sep-2026): opcional, porque que la NOM-004 lo exija en la nota
       AMBULATORIA no está demostrado y es decisión del dueño. Lo que esta
       prueba congela es que la plantilla del tipo salga LIMPIA y en su orden,
       no cuántas secciones tiene. */
    expect(secciones.map(s => s.key)).toEqual(['subjetivo', 'objetivo', 'evaluacion', 'plan', 'pronostico'])
  })
})

describe('está conectado a la consulta', () => {
  it('el procesado usa las secciones del tipo activo, no las que hubiera', () => {
    expect(page).toContain('seccionesDelTipo(tipoActivo, tipoOverride ? [] : prev).secciones')
  })

  it('en los DOS caminos de procesado', () => {
    expect(page.split('seccionesDelTipo(tipoActivo, tipoOverride ? [] : prev).secciones').length - 1).toBe(2)
  })

  it('ya no se parte de lo que hubiera en memoria', () => {
    expect(page).not.toContain('const base = tipoOverride ? seccionesVacias(tipoActivo) : prev')
  })
})
