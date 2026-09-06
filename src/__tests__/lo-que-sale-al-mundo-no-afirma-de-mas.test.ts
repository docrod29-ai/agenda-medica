/**
 * GOLDEN — el archivo que se entrega fuera dice quién firmó, no afirma certezas
 * que el expediente no tiene, y la receta declara lo que no cabe.
 *
 * Cuatro hallazgos del Panel de Lujo (sep-2026), auditor Z-cierre-lib:
 *
 *   · ZL-003 (CONFIRMADO, P2) — el Bundle FHIR atribuía TODAS las notas
 *     —incluido el `attester` de la firma y el `requester` de cada receta— a la
 *     cédula de `config/main`. En un consultorio con dos médicos, el archivo que
 *     se entrega al paciente lleva la cédula equivocada.
 *   · ZL-004 (CONFIRMADO, P3) — toda alergia salía `confirmed`, incluso la
 *     derivada de un texto libre («refiere molestia con AINE, no confirmada»); y
 *     toda receta histórica salía `active`, aunque fuera de hace dos años.
 *   · ZL-005 (PARCIAL, P3) — el adaptador HL7 fundía la saturación de gasometría
 *     arterial (2708-6) y la de pulsioximetría (59408-5) en el mismo campo sin
 *     declararlo.
 *   · ZL-018 (CONFIRMADO, P3) — un bloque más alto que la hoja se colocaba igual
 *     y se recortaba con `overflow:hidden`, sin señal.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Oleada de cierre de la biblioteca. En ZL-003 el equipo rojo probó primero la
 * refutación («si nadie lo llama, baja a P3») y la tumbó: hay tres llamadores,
 * uno de ellos una ruta de API que consulta un tercero. Y encontró que el
 * repositorio ya había resuelto exactamente este defecto en la superficie
 * hermana —`emisorDeNota` para el QR de la receta— sin llevarlo aquí.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Un solo `Practitioner` calculado una vez, fuera del bucle de notas: la
 * identidad se decidía por CONSULTORIO cuando el dato existe por NOTA. Y en las
 * alergias, un literal `confirmed` escrito cuando el modelo ni siquiera tenía
 * campo de verificación — el mismo módulo ya aplicaba el criterio correcto a la
 * criticidad dos líneas más abajo.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * clinical-safety §4: ausencia de dato no es dato de ausencia — también hacia
 * afuera. Y NOM-024 exige identificar al profesional que registra: no al dueño
 * de la configuración.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO sobre `exportarPacienteAFhir`, `estadoDeReceta`,
 * `traducirVitales` y `paginarReceta`, todas puras. Probadas al revés: la nota
 * legada SIN bloque de firma sigue cayendo al respaldo de config —que es la
 * única identidad que existe para ella— y una receta que aún no vence sigue
 * `active`.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No valida el Bundle contra un servidor FHIR real. No decide la regla clínica
 * de cuándo un tratamiento CRÓNICO deja de estar vigente (`estadoDeReceta`
 * devuelve `active` mientras la receta lo diga, y `unknown` cuando no se puede
 * saber): eso es NEEDS_CLINICAL_REVIEW. No separa SaO₂ de SpO₂ en el modelo de
 * signos —`RegistroSignos` tiene un solo campo y añadir otro es decisión del
 * dueño—: sólo deja de fundirlas en silencio. No mide la exactitud del
 * estimador de altura de la paginación (0.52 × fontSize por carácter).
 */
import { describe, it, expect } from 'vitest'
import { exportarPacienteAFhir, estadoDeReceta } from '@/lib/fhir-export'
import { traducirVitales, AVISO_SATURACION_ARTERIAL } from '@/lib/dispositivos/vitales-hl7'
import { paginarReceta, hayDesborde, avisoDeDesborde } from '@/lib/receta-paginacion'
import type { NotaMedica } from '@/types/expediente'
import type { Patient, ClinicConfig } from '@/types'

const PACIENTE = {
  id: 'p-sintetico', nombre: 'Paciente Sintético', sexo: 'Femenino',
  alergias: 'refiere molestia con AINE (no confirmada)',
  updatedAt: '2026-09-01T10:00:00Z',
} as unknown as Patient

const CONFIG = {
  nombreMedico: 'Dra. Sintética A', cedulaProfesional: 'AAA111', especialidad: 'Medicina Interna',
} as unknown as ClinicConfig

function notaFirmadaPor(nombre: string, cedula: string, over: Partial<NotaMedica> = {}): NotaMedica {
  return {
    id: `n-${cedula}`, clinicId: 'c-sintetica', pacienteId: 'p-sintetico',
    pacienteNombre: 'Paciente Sintético', tipo: 'seguimiento', estado: 'firmada',
    metadata: {
      id: `n-${cedula}`, tipoNota: 'seguimiento', clinicId: 'c-sintetica', pacienteId: 'p-sintetico',
      medicoId: 'uid-sintetico', cedulaProfesional: cedula, especialidad: 'Cirugía',
      establecimiento: 'Consultorio sintético', fechaCreacion: '2026-09-01T10:00:00Z',
      fechaModificacion: '2026-09-01T10:00:00Z', hashIntegridad: '', version: 1,
      estado: 'firmada', fuenteGeneracion: 'manual',
    },
    firma: { nombreMedico: nombre, cedulaProfesional: cedula, timestamp: '2026-09-01T11:00:00Z' },
    fechaConsulta: '2026-09-01T10:00:00Z',
    secciones: [], diagnosticos: [], alergias: [],
    medicamentos: [{ nombre: 'Amoxicilina', dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 horas', duracion: '7 días' }],
    ...over,
  } as unknown as NotaMedica
}

const recursos = (b: ReturnType<typeof exportarPacienteAFhir>, tipo: string) =>
  b.entry.map(e => e.resource).filter(r => r.resourceType === tipo)

describe('ZL-003 · el bundle dice quién firmó', () => {
  const bundle = exportarPacienteAFhir({
    paciente: PACIENTE,
    notas: [notaFirmadaPor('Dr. Sintético B', 'BBB222')],
    config: CONFIG,
  })

  it('emite un Practitioner por cada cédula distinta, no sólo el de la configuración', () => {
    const ids = recursos(bundle, 'Practitioner').map(r => r.id)
    expect(ids).toContain('AAA111')
    expect(ids, 'el médico que firmó no existe en el bundle').toContain('BBB222')
  })

  it('el attester de la firma apunta a quien firmó', () => {
    const comp = recursos(bundle, 'Composition')[0] as { attester: { party: { reference: string } }[] }
    expect(comp.attester[0].party.reference).toBe('Practitioner/BBB222')
  })

  it('el requester de la receta también', () => {
    const mr = recursos(bundle, 'MedicationRequest')[0] as { requester: { reference: string } }
    expect(mr.requester.reference).toBe('Practitioner/BBB222')
  })

  it('al revés: una nota legada SIN bloque de firma cae al respaldo declarado', () => {
    // Sin firma y sin cédula en la metadata no hay más identidad que la de la
    // clínica: se usa, y se DECLARA que es un respaldo (no se inventa un
    // médico). Es el caso que el propio hallazgo dice no cubrir.
    const legada = notaFirmadaPor('', '', { firma: undefined } as never)
    const b = exportarPacienteAFhir({ paciente: PACIENTE, notas: [legada], config: CONFIG })
    const comp = recursos(b, 'Composition')[0] as { author: { reference: string }[] }
    expect(comp.author[0].reference).toBe('Practitioner/AAA111')
  })

  it('… y una nota legada CON cédula en la metadata usa esa, no la de la clínica', () => {
    const legada = notaFirmadaPor('', 'CCC333', { firma: undefined } as never)
    const b = exportarPacienteAFhir({ paciente: PACIENTE, notas: [legada], config: CONFIG })
    const comp = recursos(b, 'Composition')[0] as { author: { reference: string }[] }
    expect(comp.author[0].reference).toBe('Practitioner/CCC333')
  })
})

describe('ZL-004 · no se afirma una certeza que el expediente no tiene', () => {
  const bundle = exportarPacienteAFhir({
    paciente: PACIENTE, notas: [notaFirmadaPor('Dra. Sintética A', 'AAA111')], config: CONFIG,
  })

  it('una alergia sin marca de verificación sale «unconfirmed», no «confirmed»', () => {
    const al = recursos(bundle, 'AllergyIntolerance')[0] as { verificationStatus: { coding: { code: string }[] } }
    expect(al.verificationStatus.coding[0].code).toBe('unconfirmed')
  })

  it('una receta de 7 días firmada hace dos años no es medicación de hoy', () => {
    expect(estadoDeReceta('7 días', '2024-09-01T10:00:00Z', '2026-09-06T10:00:00Z')).toBe('completed')
  })

  it('… pero la de esta semana sigue activa', () => {
    expect(estadoDeReceta('7 días', '2026-09-04T10:00:00Z', '2026-09-06T10:00:00Z')).toBe('active')
  })

  it('lo indefinido se declara activo y lo que no se puede saber, «unknown»', () => {
    expect(estadoDeReceta('indefinido', '2020-01-01T00:00:00Z', '2026-09-06T10:00:00Z')).toBe('active')
    expect(estadoDeReceta('', '2020-01-01T00:00:00Z', '2026-09-06T10:00:00Z')).toBe('unknown')
    expect(estadoDeReceta('según indicaciones', '2020-01-01T00:00:00Z', '2026-09-06T10:00:00Z')).toBe('unknown')
  })
})

describe('MO-005 · los estudios pedidos existen para el mundo', () => {
  it('la nota con estudios solicitados emite ServiceRequest', () => {
    const b = exportarPacienteAFhir({
      paciente: PACIENTE,
      notas: [notaFirmadaPor('Dra. Sintética A', 'AAA111', { estudiosOrden: ['Radiografía de tobillo izquierdo'] } as never)],
      config: CONFIG,
    })
    const sr = recursos(b, 'ServiceRequest') as { code: { text: string } }[]
    expect(sr.length).toBe(1)
    expect(sr[0].code.text).toBe('Radiografía de tobillo izquierdo')
  })
})

describe('ZL-005 · la fusión de los dos códigos de saturación se declara', () => {
  it('la saturación por gasometría entra, y avisa de que no se distingue', () => {
    const v = traducirVitales([{ codigo: '2708-6', valor: '94', unidad: '%' }])
    expect(v.signos.spo2).toBe(94)
    expect(v.avisos).toContain(AVISO_SATURACION_ARTERIAL)
  })

  it('la de pulsioximetría entra sin aviso: es la que la gráfica espera', () => {
    const v = traducirVitales([{ codigo: '59408-5', valor: '94', unidad: '%' }])
    expect(v.signos.spo2).toBe(94)
    expect(v.avisos).toEqual([])
  })
})

describe('ZL-018 · lo que no cabe en la hoja se declara', () => {
  const base = {
    estudios: [], fontSizePx: 11, areaAltoMm: 90, areaAnchoMm: 100,
    headerPrimeraMm: 40, firmaMm: 20,
  }

  it('un medicamento con una indicación enorme deja constancia del recorte', () => {
    const paginas = paginarReceta({
      ...base,
      medicamentos: [{
        nombre: 'Insulina sintética', dosis: '10 U', via: 'sc',
        frecuencia: 'según esquema', duracion: 'indefinido',
        indicacion: 'Esquema sintético por glucemia. '.repeat(60),
      }] as never,
    })
    expect(hayDesborde(paginas), 'el bloque no cabe y nadie lo dice').toBe(true)
    expect(avisoDeDesborde(paginas)).toMatch(/Insulina sintética/)
    expect(avisoDeDesborde(paginas)).toMatch(/cortado/i)
  })

  it('al revés: una receta normal no inventa un aviso de recorte', () => {
    const paginas = paginarReceta({
      ...base,
      medicamentos: [{
        nombre: 'Paracetamol', dosis: '500 mg', via: 'oral',
        frecuencia: 'cada 8 horas', duracion: '3 días',
      }] as never,
    })
    expect(hayDesborde(paginas)).toBe(false)
    expect(avisoDeDesborde(paginas)).toBe('')
  })
})
