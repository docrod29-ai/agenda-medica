import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { CLINICAL_ENGINE_REGISTRY } from '@/lib/clinical/registry'
import { DEUDA_ADR_CONGELADA, CAMPOS_ADR, DOCS_NO_ADR } from '@/lib/clinical/adr-cobertura'

/**
 * E0-03 — gate de cobertura documental del Clinical Engine Registry.
 *
 * Ver el porqué del diseño de TRINQUETE en `src/lib/clinical/adr-cobertura.ts`:
 * un gate que nace rojo con 53 fallos no protege nada, porque se marca `skip` y
 * deja de mirarse. Éste nace verde y solo impide que la deuda CREZCA.
 */
const RAIZ = process.cwd()
const DIR_ADR = 'docs/clinical-decisions'

const conAdr = CLINICAL_ENGINE_REGISTRY.filter(m => existsSync(resolve(RAIZ, m.adr)))
const sinAdr = CLINICAL_ENGINE_REGISTRY.filter(m => !existsSync(resolve(RAIZ, m.adr)))

describe('E0-03 · el registro de motores clínicos está sano', () => {
  it('no está vacío (si no, todo lo demás sería vacuo)', () => {
    expect(CLINICAL_ENGINE_REGISTRY.length).toBeGreaterThanOrEqual(20)
  })

  it('cada motor declara id, archivo, versión y ruta de ADR', () => {
    const rotos = CLINICAL_ENGINE_REGISTRY.filter(
      m => !m.id?.trim() || !m.file?.trim() || !m.version?.trim() || !m.adr?.trim(),
    ).map(m => m.id || '(sin id)')
    expect(rotos, 'motores con metadatos incompletos').toEqual([])
  })

  it('no hay ids duplicados', () => {
    const ids = CLINICAL_ENGINE_REGISTRY.map(m => m.id)
    expect(ids.length - new Set(ids).size, 'ids repetidos').toBe(0)
  })

  it('el archivo que declara cada motor EXISTE', () => {
    const fantasmas = CLINICAL_ENGINE_REGISTRY
      .filter(m => !existsSync(resolve(RAIZ, m.file)))
      .map(m => `${m.id} → ${m.file}`)
    expect(fantasmas, 'motores que apuntan a un archivo inexistente').toEqual([])
  })

  it('todos los ADRs viven en docs/clinical-decisions', () => {
    const fuera = CLINICAL_ENGINE_REGISTRY
      .filter(m => !m.adr.startsWith(`${DIR_ADR}/`))
      .map(m => `${m.id} → ${m.adr}`)
    expect(fuera).toEqual([])
  })
})

describe('E0-03 · TRINQUETE: la deuda documental no puede crecer', () => {
  it(`hay ${DEUDA_ADR_CONGELADA} motores sin ADR o menos — nunca más`, () => {
    const faltantes = sinAdr.map(m => `${m.id} (${m.file})`)
    expect(
      faltantes.length,
      faltantes.length > DEUDA_ADR_CONGELADA
        ? `Entró lógica clínica SIN documentar. Motores sin ADR (${faltantes.length}, el tope es ${DEUDA_ADR_CONGELADA}):\n  ${faltantes.join('\n  ')}\n\nEscribe el ADR del motor nuevo. NO subas DEUDA_ADR_CONGELADA para apagar este test: si subió es porque entró un motor indocumentado, y ESE es el hallazgo.`
        : '',
    ).toBeLessThanOrEqual(DEUDA_ADR_CONGELADA)
  })

  it('si la deuda ya bajó, hay que apretar la tuerca (no dejarla floja)', () => {
    // Cuando alguien escribe un ADR, este test le recuerda bajar la constante.
    // Se tolera una holgura de 0: el trinquete solo sirve si se aprieta.
    expect(
      sinAdr.length,
      `La deuda real es ${sinAdr.length} y la constante dice ${DEUDA_ADR_CONGELADA}. ` +
      `Baja DEUDA_ADR_CONGELADA a ${sinAdr.length} para que la mejora quede fijada.`,
    ).toBe(DEUDA_ADR_CONGELADA)
  })
})

describe('E0-03 · los ADRs que SÍ existen se verifican estrictos', () => {
  it('hay al menos un motor documentado (si no, el bloque sería vacuo)', () => {
    expect(conAdr.length).toBeGreaterThanOrEqual(3)
  })

  it('cada ADR trae los campos obligatorios', () => {
    const problemas: string[] = []
    for (const m of conAdr) {
      const txt = readFileSync(resolve(RAIZ, m.adr), 'utf8')
      for (const campo of CAMPOS_ADR) {
        if (!txt.includes(campo)) problemas.push(`${m.adr}: falta «${campo}»`)
      }
    }
    expect(problemas).toEqual([])
  })

  /**
   * ANTI-DERIVA: el ADR debe citar el archivo REAL del motor. Sin esto, se
   * renombra el motor, el ADR queda apuntando al vacío y nadie se entera — la
   * documentación miente en silencio, que es peor que no tenerla.
   */
  it('cada ADR cita el archivo del motor que documenta', () => {
    const problemas: string[] = []
    for (const m of conAdr) {
      const txt = readFileSync(resolve(RAIZ, m.adr), 'utf8')
      const base = m.file.split('/').pop() ?? m.file
      if (!txt.includes(base)) problemas.push(`${m.adr} no menciona ${base}`)
    }
    expect(problemas, 'ADRs que dejaron de apuntar a su motor').toEqual([])
  })
})

describe('E0-03 · no hay ADRs huérfanos', () => {
  it('todo .md de clinical-decisions es un ADR reclamado o está declarado como otra cosa', () => {
    const reclamados = new Set(CLINICAL_ENGINE_REGISTRY.map(m => m.adr.split('/').pop()))
    const huerfanos = readdirSync(resolve(RAIZ, DIR_ADR))
      .filter(n => n.endsWith('.md'))
      .filter(n => !reclamados.has(n) && !DOCS_NO_ADR.includes(n))
    expect(
      huerfanos,
      'ADR sin motor que lo reclame. Si NO es un ADR de motor (p. ej. una decisión ' +
      'clínica del médico), decláralo en DOCS_NO_ADR.',
    ).toEqual([])
  })

  it('DOCS_NO_ADR no se pudre: cada entrada sigue existiendo', () => {
    const fantasmas = DOCS_NO_ADR.filter(n => !existsSync(resolve(RAIZ, DIR_ADR, n)))
    expect(fantasmas, 'entradas de DOCS_NO_ADR que ya no existen').toEqual([])
  })
})
