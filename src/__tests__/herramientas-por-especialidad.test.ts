import { describe, it, expect } from 'vitest'
import { troncoDe, herramientasDe, filtrarHerramientas } from '@/lib/herramientas-por-especialidad'
import { ESPECIALIDADES_MEDICAS } from '@/lib/especialidades'

/**
 * Filtrar herramientas por especialidad ahorra tiempo, pero esconder la
 * equivocada cuesta una decisión clínica. Estos tests fijan las dos direcciones:
 * que aparezca lo que toca y que NO desaparezca lo que se necesita.
 */
describe('a qué tronco pertenece cada especialidad', () => {
  it('las subespecialidades de medicina interna heredan su tronco', () => {
    for (const e of ['Medicina Interna', 'Infectología', 'Cardiología', 'Neumología',
      'Gastroenterología', 'Endocrinología', 'Nefrología', 'Reumatología',
      'Hematología', 'Oncología Médica', 'Geriatría', 'Neurología']) {
      expect(troncoDe(e)).toBe('medicina-interna')
    }
  })

  it('los compuestos se resuelven por lo que el médico HACE, no por la palabra', () => {
    // Un cirujano pediatra opera: su herramienta central es la perioperatoria.
    expect(troncoDe('Cirugía Pediátrica')).toBe('cirugia')
    // Una oncóloga ginecológica atiende a la mujer: gineco manda.
    expect(troncoDe('Oncología Ginecológica')).toBe('gineco-obstetricia')
    // Un infectólogo pediatra ve niños: dosis por peso.
    expect(troncoDe('Infectología Pediátrica')).toBe('pediatria')
  })

  it('trauma y ortopedia comparten tronco con cirugía', () => {
    expect(troncoDe('Ortopedia y Traumatología')).toBe('cirugia')
    expect(troncoDe('Neurocirugía')).toBe('cirugia')
    expect(troncoDe('Urología')).toBe('cirugia')
  })

  it('primer contacto se distingue de las demás', () => {
    expect(troncoDe('Medicina General')).toBe('primer-contacto')
    expect(troncoDe('Medicina Familiar')).toBe('primer-contacto')
    expect(troncoDe('Medicina de Urgencias')).toBe('primer-contacto')
  })

  it('sin especialidad o desconocida cae a "otra"', () => {
    expect(troncoDe('')).toBe('otra')
    expect(troncoDe(null)).toBe('otra')
    expect(troncoDe('Astrología')).toBe('otra')
  })

  it('tolera acentos, mayúsculas y espacios', () => {
    expect(troncoDe('  INFECTOLOGIA  ')).toBe('medicina-interna')
    expect(troncoDe('ginecología y obstetricia')).toBe('gineco-obstetricia')
  })
})

describe('qué herramientas ve cada quien', () => {
  it('el copiloto y las fotos NUNCA se esconden: son red de seguridad y documentación', () => {
    for (const e of [...ESPECIALIDADES_MEDICAS, '', 'Astrología']) {
      const h = herramientasDe(e)
      expect(h).toContain('copiloto')
      expect(h).toContain('fotos')
    }
  })

  it('el internista no carga con pediatría ni gineco', () => {
    const h = herramientasDe('Medicina Interna')
    expect(h).not.toContain('pediatria')
    expect(h).not.toContain('gineco')
    expect(h).toContain('cardiometabolico')
    expect(h).toContain('antibiograma')
  })

  it('el pediatra no carga con riesgo cardiovascular a 10 años', () => {
    const h = herramientasDe('Pediatría')
    expect(h).toContain('pediatria')
    expect(h).not.toContain('cardiometabolico')
    expect(h).not.toContain('gineco')
  })

  it('el cirujano tiene la valoración perioperatoria', () => {
    expect(herramientasDe('Cirugía General')).toContain('cirugia')
    expect(herramientasDe('Ortopedia y Traumatología')).toContain('cirugia')
  })

  it('SIN especialidad reconocida se muestra TODO, no nada', () => {
    // Esconderle herramientas a alguien de quien no sabemos qué hace es peor que
    // mostrarle de más.
    const h = herramientasDe('Astrología')
    expect(h).toContain('pediatria')
    expect(h).toContain('gineco')
    expect(h).toContain('cirugia')
    expect(h).toContain('cardiometabolico')
  })

  it('ninguna especialidad del catálogo se queda sin herramientas', () => {
    for (const e of ESPECIALIDADES_MEDICAS) {
      expect(herramientasDe(e).length).toBeGreaterThan(2)
    }
  })
})

describe('filtrarHerramientas', () => {
  const items = [
    { id: 'copiloto' }, { id: 'cirugia' }, { id: 'gineco' }, { id: 'pediatria' },
    { id: 'calculadoras' }, { id: 'cardiometabolico' }, { id: 'preventivo' },
    { id: 'antibiograma' }, { id: 'fotos' },
  ]

  it('deja solo las de la especialidad', () => {
    const r = filtrarHerramientas(items, 'Medicina Interna').map(i => i.id)
    expect(r).not.toContain('pediatria')
    expect(r).toContain('antibiograma')
  })

  it('el CONTEXTO DEL PACIENTE gana a la configuración', () => {
    // Si el diagnóstico dictado es quirúrgico, el panel de cirugía aparece aunque
    // el médico sea internista.
    const r = filtrarHerramientas(items, 'Medicina Interna', ['cirugia']).map(i => i.id)
    expect(r).toContain('cirugia')
  })

  it('no inventa herramientas que no existan en la lista', () => {
    const r = filtrarHerramientas([{ id: 'copiloto' }], 'Medicina Interna').map(i => i.id)
    expect(r).toEqual(['copiloto'])
  })
})
