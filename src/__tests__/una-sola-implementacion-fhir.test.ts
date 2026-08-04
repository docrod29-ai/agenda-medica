/**
 * GOLDEN — había dos implementaciones FHIR, y la que consume un tercero era la
 * pobre.
 *
 * ── LO QUE PASABA (D7) ───────────────────────────────────────────────────────
 *
 * `lib/fhir/recursos.ts` y `lib/fhir-export.ts` mapeaban el mismo modelo de dos
 * maneras distintas. La **API HTTP viva** —`/api/fhir/paciente/[id]`, la que
 * consulta un sistema de terceros— usaba la primera. Y diferían justo en lo que
 * importa:
 *
 * · Mapeaba **todas** las notas sin mirar si estaban firmadas: los diagnósticos
 *   de un borrador salían como `Condition` **confirmadas**, con el mismo peso
 *   que los de una nota firmada. Es exactamente lo que la firma existe para
 *   impedir, y en la interfaz por la que salen los datos hacia fuera.
 * · No emitía ningún `Composition`: el texto de la nota —el documento clínico—
 *   no viajaba, sólo sus fragmentos estructurados.
 * · No llevaba `Practitioner`, ni atestación, ni encuentro.
 *
 * ── POR QUÉ NO SE ARREGLA «CORRIGIENDO LAS DOS» ──────────────────────────────
 *
 * Porque no se mantienen sincronizadas. Una se corrige y la otra se queda, y
 * nadie se entera hasta que un tercero recibe el archivo malo. Ahora hay una
 * sola y la otra delega.
 *
 * Lo bueno del mapeo pobre —las alergias una a una, con categoría y
 * criticidad— se llevó a la buena: unificar no puede significar perder.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { bundlePaciente, POR_QUE_UNA_SOLA_IMPLEMENTACION } from '@/lib/fhir/recursos'
import { exportarPacienteAFhir } from '@/lib/fhir-export'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const ruta = leer('src', 'app', 'api', 'fhir', 'paciente', '[patientId]', 'route.ts')

const paciente = {
  id: 'p1', nombre: 'Paciente Sintético', sexo: 'Masculino',
  alergias: 'penicilina, mariscos', updatedAt: '2026-08-04T10:00:00.000Z',
} as never

const nota = (estado: string) => ({
  id: 'n1', estado, tipo: 'consulta',
  fechaConsulta: '2026-08-04T10:00:00.000Z',
  metadata: { id: 'n1', fechaCreacion: '2026-08-04T10:00:00.000Z', medicoId: 'm1' },
  secciones: [{ key: 'padecimiento', label: 'Padecimiento actual', value: 'Texto sintético.' }],
  diagnosticos: [{ descripcion: 'Bronquitis', codigoCIE10: 'J20', tipo: 'presuntivo', estado: 'activo' }],
} as never)

describe('LAS DOS RUTAS PRODUCEN LO MISMO', () => {
  it('el bundle del módulo delegado es idéntico al de la implementación buena', () => {
    /**
     * Es la prueba que impide que vuelvan a divergir: si alguien reintroduce un
     * mapeo propio aquí, esto se pone rojo.
     */
    const a = bundlePaciente(paciente, [nota('firmada')])
    const b = exportarPacienteAFhir({ paciente, notas: [nota('firmada')] as never, config: null })
    // El sello de tiempo del bundle es lo único que cambia entre dos llamadas.
    expect({ ...a, timestamp: undefined }).toEqual({ ...b, timestamp: undefined } as unknown)
  })

  it('está escrito por qué no puede haber dos', () => {
    expect(POR_QUE_UNA_SOLA_IMPLEMENTACION).toMatch(/hasta que un tercero recibe el archivo malo/)
  })
})

describe('LO QUE LA RUTA VIVA HACÍA MAL', () => {
  it('un borrador ya no exporta diagnósticos confirmados', () => {
    const b = bundlePaciente(paciente, [nota('borrador')])
    const tipos = (b.entry as { resource: { resourceType: string } }[]).map(e => e.resource.resourceType)
    expect(tipos).not.toContain('Condition')
  })

  it('y ahora sí viaja el documento clínico', () => {
    const b = bundlePaciente(paciente, [nota('firmada')])
    const comp = (b.entry as { resource: { resourceType: string; text?: { div?: string } } }[])
      .find(e => e.resource.resourceType === 'Composition')
    expect(comp).toBeTruthy()
    expect(String(comp!.resource.text?.div)).toContain('Texto sintético')
  })
})

describe('AL UNIFICAR NO SE PERDIÓ LO BUENO DEL OTRO', () => {
  it('las alergias van una por alérgeno', () => {
    const b = bundlePaciente(paciente, [])
    const algs = (b.entry as { resource: { resourceType: string; code?: { text?: string } } }[])
      .filter(e => e.resource.resourceType === 'AllergyIntolerance')
    expect(algs.length).toBe(2)
    expect(algs.map(a => a.resource.code?.text).sort()).toEqual(['mariscos', 'penicilina'])
  })

  it('sin alergias no se inventa ningún recurso', () => {
    const b = bundlePaciente({ ...(paciente as object), alergias: '' } as never, [])
    const algs = (b.entry as { resource: { resourceType: string } }[])
      .filter(e => e.resource.resourceType === 'AllergyIntolerance')
    expect(algs).toHaveLength(0)
  })
})

describe('LA RUTA HTTP', () => {
  it('pasa la configuración, para que el documento tenga autor identificable', () => {
    expect(ruta).toContain("collection('config').doc('main').get()")
    expect(ruta).toContain('bundlePaciente(patient, notas, config)')
  })

  it('y sigue exigiendo capacidad de médico, no de miembro', () => {
    // Lee las notas con el Admin SDK, que ignora las reglas: con `miembro` una
    // asistente podía bajar diagnósticos y alergias de cualquier paciente.
    expect(ruta).toContain("verificarCapacidad(req, clinicId, 'clinico.escribir')")
  })
})
