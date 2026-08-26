/**
 * CONSULTORIO GP4/GP12 — provenance sí, plumbing técnico no.
 *
 * Los ledgers de normalización/corrección pueden seguir existiendo para
 * auditoría y superficies especializadas, pero la ruta ambulatoria no debe
 * convertirlos en trabajo rutinario del médico. Esta prueba fija ese contrato
 * sin borrar los componentes ni debilitar el canal de ambigüedad material.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const cifras = readFileSync(join(root, 'src/components/CambiosCifrasPanel.tsx'), 'utf8')
const correcciones = readFileSync(join(root, 'src/components/CorreccionesPanel.tsx'), 'utf8')
const consulta = readFileSync(join(root, 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

describe('Consultorio — los ledgers técnicos no ocupan el Golden Path', () => {
  it.each([
    ['cifras/unidades/siglas', cifras],
    ['correcciones léxicas', correcciones],
  ])('%s se conserva debajo pero se oculta en /consulta/', (_nombre, source) => {
    expect(source).toContain("usePathname")
    expect(source).toContain("pathname.startsWith('/consulta/')")
    expect(source).toMatch(/return null/)
  })

  it('la ambigüedad clínicamente material conserva su canal contextual', () => {
    expect(consulta).toContain('motivosDictado')
    expect(consulta).toContain('textosDeMotivos')
    expect(consulta).toContain('Conviene confirmar antes de firmar:')
  })
})
