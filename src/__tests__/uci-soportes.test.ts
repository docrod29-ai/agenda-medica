/**
 * Motores de soporte extracorpóreo (ICU OS P2): CKRT/PRISMA y ECMO.
 * Deterministas, bloquean si falta el dato, NUNCA autodiagnostican.
 */
import { describe, it, expect } from 'vitest'
import { analizarCKRT, analizarCitrato, tendenciaFiltro } from '@/lib/uci/ckrt'
import { vigilanciaOxigenador, panelHemolisis, evaluarVV, evaluarVA, analizarECMO } from '@/lib/uci/ecmo'

describe('CKRT — dosis y efluente por modalidad', () => {
  it('CVVHDF: efluente = dializado + reposición + UF neta; dosis = efluente/peso', () => {
    const r = analizarCKRT({ modalidad: 'CVVHDF', pesoKg: 70, dializadoMlH: 1000, reposicionPreMlH: 500, reposicionPostMlH: 500, ufNetaMlH: 150 })
    expect(r.ok).toBe(true)
    expect(r.efluenteMlH).toBe(2150)
    expect(r.dosisPrescritaMlKgH).toBeCloseTo(30.7, 1)
  })
  it('descuenta downtime en la dosis ENTREGADA', () => {
    const r = analizarCKRT({ modalidad: 'CVVHDF', pesoKg: 70, dializadoMlH: 1000, reposicionPostMlH: 400, ufNetaMlH: 100, tiempoActivoH: 18 })
    // prescrita 1500/70=21.4; entregada ×18/24 = 16.1 → alerta <20
    expect(r.dosisEntregadaMlKgH).toBeCloseTo(16.1, 1)
    expect(r.advertencias.join(' ')).toMatch(/entregada/i)
  })
  it('bloquea sin modalidad o sin UF neta', () => {
    expect(analizarCKRT({ pesoKg: 70, ufNetaMlH: 100 }).bloqueado).toBe(true)
    expect(analizarCKRT({ modalidad: 'CVVH' }).bloqueado).toBe(true)
  })
  it('fracción de filtración alta alerta por coagulación (CVVH)', () => {
    const r = analizarCKRT({ modalidad: 'CVVH', pesoKg: 70, qbMlMin: 150, hematocrito: 30, reposicionPostMlH: 2000, ufNetaMlH: 100 })
    expect(r.fraccionFiltracionPct).not.toBeNull()
    expect(r.fraccionFiltracionPct!).toBeGreaterThan(25)
    expect(r.advertencias.join(' ')).toMatch(/coagulación/i)
  })
})

describe('CKRT — citrato', () => {
  it('ratio Ca total/iónico ≥ 2.5 marca patrón de acumulación (no diagnóstico)', () => {
    const r = analizarCitrato({ caIonicoSistemico: 1.0, caTotal: 2.7 })
    expect(r.ratioCaTotalIonico).toBeCloseTo(2.7, 1)
    expect(r.patronAcumulacion).toBe(true)
    expect(r.advertencias.join(' ')).toMatch(/acumulación de citrato/i)
  })
  it('iCa postfiltro fuera de rango alerta', () => {
    expect(analizarCitrato({ caPostfiltro: 0.5 }).advertencias.join(' ')).toMatch(/subóptima|circuito/i)
  })
})

describe('CKRT — vida del filtro', () => {
  it('detecta tendencia descendente', () => {
    expect(tendenciaFiltro([24, 18, 12]).descendente).toBe(true)
    expect(tendenciaFiltro([12, 20, 30]).descendente).toBe(false)
    expect(tendenciaFiltro([24]).bloqueado).toBe(true)
  })
})

describe('ECMO — oxigenador', () => {
  it('ΔP = pre − post; ascenso ≥30% vs basal pide inspección (no diagnostica trombosis)', () => {
    const r = vigilanciaOxigenador({ presionPre: 250, presionPost: 210, deltaPBasal: 25 })
    expect(r.deltaP).toBe(40)
    expect(r.cambioVsBasalPct).toBe(60)
    expect(r.señales.some(s => /INSPECCIONAR/.test(s.mensaje))).toBe(true)
    expect(r.señales.some(s => /No confirma trombosis/.test(s.mensaje))).toBe(true)
  })
  it('bloquea sin ΔP ni presiones', () => {
    expect(vigilanciaOxigenador({}).bloqueado).toBe(true)
  })
})

describe('ECMO — hemólisis / VV / VA', () => {
  it('pfHb > 50 marca hemólisis significativa', () => {
    expect(panelHemolisis({ plasmaFreeHb: 80 }).patronHemolisis).toBe(true)
  })
  it('VV: SaO2 baja + SvO2 pre-oxigenador alta → patrón de recirculación', () => {
    const r = evaluarVV({ saO2: 84, preOxiSvO2: 82, flujoLMin: 4 })
    expect(r.señales.some(s => /recirculación/i.test(s.mensaje))).toBe(true)
  })
  it('VA: SpO2 mano derecha << inferior → hipoxia diferencial (Harlequin)', () => {
    const r = evaluarVA({ spo2ManoDerecha: 85, spo2MiembroInferior: 99 })
    expect(r.señales.some(s => /diferencial|Harlequin/i.test(s.mensaje))).toBe(true)
  })
  it('VA: baja pulsatilidad / válvula que no abre → distensión de VI (venting a valorar)', () => {
    const r = evaluarVA({ pas: 70, pad: 62, valvulaAorticaAbre: false })
    expect(r.pulsatilidadMmHg).toBe(8)
    expect(r.señales.some(s => /distensión|venting/i.test(s.mensaje))).toBe(true)
  })
  it('orquestador consolida señales según configuración', () => {
    const r = analizarECMO({ config: 'VA', presionPre: 260, presionPost: 200, deltaPBasal: 25, spo2ManoDerecha: 84, spo2MiembroInferior: 99 })
    expect(r.va).not.toBeNull()
    expect(r.vv).toBeNull()
    expect(r.señales.length).toBeGreaterThanOrEqual(2)
  })
})
