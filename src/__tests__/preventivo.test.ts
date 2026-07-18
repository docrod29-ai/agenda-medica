import { describe, it, expect } from 'vitest'
import {
  TAMIZAJES, tamizajesPara, tamizajesProximos, ADVERTENCIA_PREVENTIVO,
  analizarTendencia, alertaDeTendencia, CAMBIOS_RELEVANTES,
} from '@/lib/expediente/preventivo'

describe('Tamizajes por edad y sexo', () => {
  it('una mujer de 45 años tiene mastografía y tamizaje de colon', () => {
    const t = tamizajesPara(45, true).map(x => x.prueba)
    expect(t).toContain('Mastografía')
    expect(t).toContain('Tamizaje de cáncer colorrectal')
  })

  it('un hombre no recibe tamizajes exclusivos de mujer', () => {
    const t = tamizajesPara(60, false).map(x => x.prueba)
    expect(t).not.toContain('Mastografía')
    expect(t).not.toContain('Densitometría ósea')
    expect(t).toContain('Antígeno prostático específico')
  })

  it('el colon inicia a los 45, no a los 50', () => {
    expect(tamizajesPara(44, false).map(x => x.prueba)).not.toContain('Tamizaje de cáncer colorrectal')
    expect(tamizajesPara(45, false).map(x => x.prueba)).toContain('Tamizaje de cáncer colorrectal')
  })

  it('la mastografía inicia a los 40 (la USPSTF bajó la edad)', () => {
    expect(tamizajesPara(39, true).map(x => x.prueba)).not.toContain('Mastografía')
    expect(tamizajesPara(40, true).map(x => x.prueba)).toContain('Mastografía')
  })

  it('marca como vencido lo que ya pasó su ventana en vez de ocultarlo', () => {
    const colon = tamizajesPara(80, false).find(x => /colorrectal/.test(x.prueba))!
    expect(colon.vencido).toBe(true)
    const colon60 = tamizajesPara(60, false).find(x => /colorrectal/.test(x.prueba))!
    expect(colon60.vencido).toBe(false)
  })

  it('anticipa lo que viene en los próximos 5 años', () => {
    const p = tamizajesProximos(43, false).map(x => x.prueba)
    expect(p).toContain('Tamizaje de cáncer colorrectal')
    expect(tamizajesProximos(20, false).map(x => x.prueba)).not.toContain('Tamizaje de cáncer colorrectal')
  })

  it('cada tamizaje dice de qué organismo viene, para poder verificarlo', () => {
    for (const t of TAMIZAJES) expect(t.organismo.length, t.prueba).toBeGreaterThanOrEqual(3)
  })

  it('la advertencia de procedencia es explícita y distingue de los módulos leídos', () => {
    expect(ADVERTENCIA_PREVENTIVO).toMatch(/no se derivaron de un documento leído/i)
    expect(ADVERTENCIA_PREVENTIVO).toMatch(/cotejarse/i)
  })

  it('edad inválida devuelve lista vacía en vez de romperse', () => {
    expect(tamizajesPara(-1, true)).toHaveLength(0)
    expect(tamizajesPara(NaN, true)).toHaveLength(0)
  })
})

describe('Tendencias de laboratorio', () => {
  const serie = [
    { fecha: '2026-01-10', valor: 1.0 },
    { fecha: '2026-04-10', valor: 1.2 },
    { fecha: '2026-07-10', valor: 1.5 },
  ]

  it('describe la dirección y el cambio', () => {
    const t = analizarTendencia(serie, 'mg/dL')!
    expect(t.direccion).toBe('sube')
    expect(t.cambio).toBe(0.5)
    expect(t.cambioPct).toBe(50)
    expect(t.dias).toBe(181)
  })

  it('ordena por fecha aunque lleguen desordenadas', () => {
    const desordenada = [serie[2], serie[0], serie[1]]
    const t = analizarTendencia(desordenada)!
    expect(t.primero.valor).toBe(1.0)
    expect(t.ultimo.valor).toBe(1.5)
  })

  it('un cambio menor al 5% se llama estable, no tendencia', () => {
    const t = analizarTendencia([
      { fecha: '2026-01-01', valor: 100 },
      { fecha: '2026-06-01', valor: 103 },
    ])!
    expect(t.direccion).toBe('estable')
    expect(t.resumen).toMatch(/ruido/i)
  })

  it('detecta descenso', () => {
    const t = analizarTendencia([
      { fecha: '2026-01-01', valor: 180 },
      { fecha: '2026-06-01', valor: 85 },
    ])!
    expect(t.direccion).toBe('baja')
    expect(t.cambioPct).toBe(-52.8)
  })

  it('con menos de dos puntos no inventa tendencia', () => {
    expect(analizarTendencia([serie[0]])).toBeNull()
    expect(analizarTendencia([])).toBeNull()
  })

  it('descarta puntos con valor o fecha inválidos', () => {
    const t = analizarTendencia([
      { fecha: 'no-es-fecha', valor: 5 },
      { fecha: '2026-01-01', valor: 10 },
      { fecha: '2026-06-01', valor: 20 },
    ])!
    expect(t.primero.valor).toBe(10)
  })
})

describe('Alertas por cambio clínicamente relevante', () => {
  it('creatinina: +0.3 mg/dL dispara criterio de lesión renal aguda', () => {
    const t = analizarTendencia([
      { fecha: '2026-01-01', valor: 0.9 },
      { fecha: '2026-02-01', valor: 1.3 },
    ])!
    const a = alertaDeTendencia('Creatinina', t)!
    expect(a).toMatch(/lesión renal aguda/i)
    expect(a).toMatch(/KDIGO/)
  })

  it('creatinina estable no dispara alerta', () => {
    const t = analizarTendencia([
      { fecha: '2026-01-01', valor: 0.9 },
      { fecha: '2026-02-01', valor: 0.95 },
    ])!
    expect(alertaDeTendencia('Creatinina', t)).toBeNull()
  })

  it('hemoglobina: caída de 2 g/dL manda buscar sangrado', () => {
    const t = analizarTendencia([
      { fecha: '2026-01-01', valor: 14 },
      { fecha: '2026-03-01', valor: 11.5 },
    ])!
    expect(alertaDeTendencia('Hemoglobina', t)!).toMatch(/sangrado/i)
  })

  it('HbA1c: 0.5% ya es cambio real, no ruido', () => {
    const t = analizarTendencia([
      { fecha: '2026-01-01', valor: 8.2 },
      { fecha: '2026-06-01', valor: 7.5 },
    ])!
    expect(alertaDeTendencia('Hemoglobina glucosilada', t)!).toMatch(/clínicamente significativo/i)
  })

  it('LDL: reconoce el 50% de reducción que pide la guía', () => {
    const t = analizarTendencia([
      { fecha: '2026-01-01', valor: 160 },
      { fecha: '2026-04-01', valor: 70 },
    ])!
    expect(alertaDeTendencia('LDL', t)!).toMatch(/50%/)
  })

  it('LDL al alza sugiere revisar adherencia ANTES de escalar', () => {
    const t = analizarTendencia([
      { fecha: '2026-01-01', valor: 90 },
      { fecha: '2026-04-01', valor: 120 },
    ])!
    expect(alertaDeTendencia('LDL', t)!).toMatch(/adherencia/i)
  })

  it('TFG: caída de 30% marca progresión y reajuste de dosis', () => {
    const t = analizarTendencia([
      { fecha: '2026-01-01', valor: 70 },
      { fecha: '2026-08-01', valor: 45 },
    ])!
    const a = alertaDeTendencia('TFG', t)!
    expect(a).toMatch(/progresión/i)
    expect(a).toMatch(/riñón/i)
  })

  it('un analito sin regla no inventa alerta', () => {
    const t = analizarTendencia([
      { fecha: '2026-01-01', valor: 10 },
      { fecha: '2026-06-01', valor: 30 },
    ])!
    expect(alertaDeTendencia('analito inexistente', t)).toBeNull()
  })

  it('todas las reglas declaran su umbral', () => {
    for (const r of CAMBIOS_RELEVANTES) expect(r.regla, r.analito).toMatch(/\d/)
  })
})
