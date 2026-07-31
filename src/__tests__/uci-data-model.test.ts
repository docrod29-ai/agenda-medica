/**
 * nexusmed-icu-002 · ICU_DATA_MODEL
 * Candados del contrato de datos de UCI y de la nota por aparatos y sistemas.
 * No prueba motores (no existen aún) — solo el modelo y el mapeo de estados.
 */
import { describe, it, expect } from 'vitest'
import {
  ICU_SYSTEMS, certezaAStatus, esUsableParaCalculo,
  type ClinicalTruthStatus,
} from '@/types/uci'
import { TIPO_NOTA_LABEL } from '@/types/expediente'
import { SECCIONES_POR_TIPO, seccionesVacias, esHospitalaria, requiereSignosVitales } from '@/lib/expediente/templates'

describe('ICU data model — estados de verdad clínica', () => {
  it('mapea la certeza del extractor actual a ClinicalTruthStatus', () => {
    expect(certezaAStatus('confirmado')).toBe('confirmed')
    expect(certezaAStatus('descartado')).toBe('negated')
    expect(certezaAStatus('sospecha')).toBe('suspected')
    expect(certezaAStatus('historia')).toBe('historical')
  })

  it('un valor no interrogado (undefined) es "unknown", NUNCA "confirmed"', () => {
    expect(certezaAStatus(undefined)).toBe('unknown')
    expect(certezaAStatus(null)).toBe('unknown')
    // Ley del sistema: un campo vacío no es "normal".
    const s: ClinicalTruthStatus = certezaAStatus(undefined)
    expect(s).not.toBe('confirmed')
    expect(s).not.toBe('negated')
  })

  it('solo alimenta un cálculo lo confirmado/inferido CON valor normalizado', () => {
    expect(esUsableParaCalculo({ status: 'confirmed', normalizedValue: 8 })).toBe(true)
    expect(esUsableParaCalculo({ status: 'inferred', normalizedValue: 0.4 })).toBe(true)
    // Sin valor normalizado → no se calcula (no se asume).
    expect(esUsableParaCalculo({ status: 'confirmed', normalizedValue: undefined })).toBe(false)
    // Sospecha/negado/desconocido no alimentan un motor.
    expect(esUsableParaCalculo({ status: 'suspected', normalizedValue: 5 })).toBe(false)
    expect(esUsableParaCalculo({ status: 'unknown', normalizedValue: 5 })).toBe(false)
  })

  it('define los 8 aparatos y sistemas', () => {
    expect(ICU_SYSTEMS).toHaveLength(8)
    expect(ICU_SYSTEMS).toContain('respiratory')
    expect(ICU_SYSTEMS).toContain('ultrasound')
  })
})

describe('Nota de evolución UCI por aparatos y sistemas', () => {
  it('existe el tipo de nota con etiqueta legible', () => {
    expect(TIPO_NOTA_LABEL.evolucion_uci).toBe('Nota de Evolución UCI')
  })

  it('la plantilla cubre los 7 sistemas del Dr + contexto + plan', () => {
    const keys = SECCIONES_POR_TIPO.evolucion_uci.map(s => s.key)
    for (const k of ['contexto', 'neurologico', 'respiratorio', 'hemodinamico', 'abdominodigestivo', 'hidrometabolico', 'hematoinfeccioso', 'musculoesqueletico', 'plan']) {
      expect(keys).toContain(k)
    }
    expect(keys).toHaveLength(9)
  })

  it('el Plan es la sección obligatoria (NOM-004) y arranca vacía', () => {
    const plan = SECCIONES_POR_TIPO.evolucion_uci.find(s => s.key === 'plan')
    expect(plan?.obligatorio).toBe(true)
    const vacias = seccionesVacias('evolucion_uci')
    expect(vacias.every(s => s.value === '')).toBe(true)
    expect(vacias).toHaveLength(9)
  })

  it('la nota de UCI es hospitalaria y requiere signos vitales', () => {
    expect(esHospitalaria('evolucion_uci')).toBe(true)
    expect(requiereSignosVitales('evolucion_uci')).toBe(true)
  })
})
