import { describe, it, expect } from 'vitest'
import {
  CAPAS_PREPARACION,
  PRIORIDAD_CAPA,
  resolverPreparacion,
  registrarSinDosis,
  promoverAEstandarHospital,
  REFERENCE_LIBRARY,
  DATOS_QUE_PIDE,
  PROHIBIDO_APRENDER_DILUCION,
  type Preparacion,
} from '@/lib/clinical/infusion-library'

/**
 * Decisión ICU-Q4.3 del médico dueño (29-jul-2026).
 *
 *   Prioridad: PATIENT_ACTIVE_PREPARATION > HOSPITAL_STANDARD > REFERENCE_LIBRARY
 *   «REFERENCE_LIBRARY nunca se tratará como estándar local.»
 *   «Nunca aprender una dilución local automáticamente de una sola infusión.»
 *
 * Datos 100 % sintéticos. Ninguna concentración de estos fixtures pretende ser
 * clínicamente correcta: son números de prueba para ejercitar la prioridad.
 */

const prep = (capa: Preparacion['capa'], extra: Partial<Preparacion> = {}): Preparacion => ({
  capa,
  medicamento: 'norepinefrina',
  cantidadFarmaco: extra.cantidadFarmaco ?? 4,
  unidadFarmaco: 'mg',
  volumenFinal: extra.volumenFinal ?? 250,
  unidadVolumen: 'mL',
  ...extra,
})

describe('ICU-Q4.3 · prioridad de las tres capas', () => {
  it('la del PACIENTE gana sobre la del hospital', () => {
    const r = resolverPreparacion(
      [prep('HOSPITAL_STANDARD', { cantidadFarmaco: 4 }), prep('PATIENT_ACTIVE_PREPARATION', { cantidadFarmaco: 8 })],
      'norepinefrina',
    )
    expect(r.estado).toBe('RESUELTA')
    if (r.estado === 'RESUELTA') {
      expect(r.capa).toBe('PATIENT_ACTIVE_PREPARATION')
      expect(r.preparacion.cantidadFarmaco).toBe(8)
    }
  })

  it('la del HOSPITAL gana cuando no hay una del paciente', () => {
    const r = resolverPreparacion([prep('HOSPITAL_STANDARD')], 'norepinefrina')
    expect(r.estado).toBe('RESUELTA')
    if (r.estado === 'RESUELTA') expect(r.capa).toBe('HOSPITAL_STANDARD')
  })

  it('la prioridad se DERIVA del orden declarado, no se escribe aparte', () => {
    expect(PRIORIDAD_CAPA.PATIENT_ACTIVE_PREPARATION).toBeGreaterThan(PRIORIDAD_CAPA.HOSPITAL_STANDARD)
    expect(PRIORIDAD_CAPA.HOSPITAL_STANDARD).toBeGreaterThan(PRIORIDAD_CAPA.REFERENCE_LIBRARY)
    expect(CAPAS_PREPARACION).toHaveLength(3)
  })
})

describe('ICU-Q4.3 · la REFERENCIA nunca calcula ← la regla central', () => {
  it('con SÓLO referencia disponible → CANNOT_CALCULATE, no un número', () => {
    const r = resolverPreparacion(
      [prep('REFERENCE_LIBRARY', { fuenteExterna: 'fixture sintético' })],
      'norepinefrina',
    )
    expect(r.estado).toBe('CANNOT_CALCULATE')
    if (r.estado === 'CANNOT_CALCULATE') {
      expect(r.motivo).toBe('MISSING_CONCENTRATION')
      // La referencia se devuelve para MOSTRARLA rotulada, no para calcular.
      expect(r.referenciaDisponible?.capa).toBe('REFERENCE_LIBRARY')
    }
  })

  it('pide los CUATRO datos que enumera la decisión', () => {
    const r = resolverPreparacion([], 'norepinefrina')
    expect(r.estado).toBe('CANNOT_CALCULATE')
    if (r.estado === 'CANNOT_CALCULATE') {
      expect(r.pide).toEqual(DATOS_QUE_PIDE.MISSING_CONCENTRATION)
      expect(r.pide).toHaveLength(4)
      expect(r.pide.join(' · ')).toMatch(/cantidad total/)
      expect(r.pide.join(' · ')).toMatch(/volumen final/)
    }
  })

  it('la biblioteca de referencia nace VACÍA (no se inventó ninguna)', () => {
    // La decisión es explícita: «No disponemos todavía de las preparaciones
    // locales. NO INVENTAR NINGUNA.»
    expect(REFERENCE_LIBRARY).toEqual([])
  })

  it('un medicamento distinto no se confunde con el pedido', () => {
    const r = resolverPreparacion([prep('HOSPITAL_STANDARD', { medicamento: 'dobutamina' })], 'norepinefrina')
    expect(r.estado).toBe('CANNOT_CALCULATE')
  })

  it('el nombre se compara sin importar mayúsculas', () => {
    const r = resolverPreparacion([prep('HOSPITAL_STANDARD', { medicamento: 'Norepinefrina' })], 'NOREPINEFRINA')
    expect(r.estado).toBe('RESUELTA')
  })
})

describe('ICU-Q4.3 · el ejemplo literal — «Norepinefrina a 12 mL/h»', () => {
  const i = registrarSinDosis('norepinephrine', 12)

  it('guarda el hecho observado SIN inventar la dosis', () => {
    expect(i.medication).toBe('norepinephrine')
    expect(i.pumpRate).toBe(12)
    expect(i.pumpRateUnit).toBe('mL/h')
  })

  it('marca doseStatus = CANNOT_CALCULATE con su motivo', () => {
    expect(i.doseStatus).toBe('CANNOT_CALCULATE')
    expect(i.reason).toBe('MISSING_CONCENTRATION')
  })

  it('el dato dictado NO se pierde por no poder calcular', () => {
    // Lo importante: registrar 12 mL/h es información clínica real. Descartarla
    // por no tener concentración perdería lo que el médico dijo.
    expect(i.pumpRate).toBeGreaterThan(0)
  })
})

describe('ICU-Q4.3 · nunca aprender una dilución sola', () => {
  const usada = prep('PATIENT_ACTIVE_PREPARATION')
  const autor = { uid: 'med-ficticio', autorizado: true }

  it('sin confirmación explícita del usuario, LANZA', () => {
    expect(() => promoverAEstandarHospital(usada, autor, false, '2026-07-29T10:00:00Z'))
      .toThrowError(PROHIBIDO_APRENDER_DILUCION)
  })

  it('un usuario NO autorizado no puede promoverla', () => {
    expect(() => promoverAEstandarHospital(usada, { uid: 'enf', autorizado: false }, true, '2026-07-29T10:00:00Z'))
      .toThrowError(/usuario AUTORIZADO/)
  })

  it('con confirmación y autorización, queda como estándar CON su autor y fecha', () => {
    const r = promoverAEstandarHospital(usada, autor, true, '2026-07-29T10:00:00Z')
    expect(r.capa).toBe('HOSPITAL_STANDARD')
    expect(r.autorizadaPor).toBe('med-ficticio')
    expect(r.autorizadaEn).toBe('2026-07-29T10:00:00Z')
  })

  it('promover NO muta la preparación original', () => {
    const antes = JSON.stringify(usada)
    promoverAEstandarHospital(usada, autor, true, '2026-07-29T10:00:00Z')
    expect(JSON.stringify(usada)).toBe(antes)
  })
})
