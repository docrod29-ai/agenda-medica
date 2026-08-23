import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  incidentesNuevosParaAlerta,
  resumenIncidentesParaOps,
} from '@/lib/incidents/vigilancia'

const AHORA = Date.parse('2026-08-23T12:15:00.000Z')

const incidente = (id: string, hora = '2026-08-23T12', extra: Record<string, unknown> = {}) => ({
  id,
  hora,
  urgente: false,
  titulo: 'Proveedor no disponible',
  proveedor: 'openai',
  clase: 'timeout',
  veces: 7,
  ...extra,
})

describe('R-01 · el vigilante consume platform_incidentes sin hacer ruido repetido', () => {
  it('un grupo reciente y nunca avisado se escala', () => {
    const r = incidentesNuevosParaAlerta([incidente('openai_timeout_2026-08-23T12')], '', AHORA)
    expect(r.nuevos.map(x => x.id)).toEqual(['openai_timeout_2026-08-23T12'])
    expect(r.activos).toBe(1)
    expect(r.marca).toContain('openai_timeout_2026-08-23T12')
  })

  it('el mismo grupo no despierta otra vez cada 15 minutos', () => {
    const id = 'openai_timeout_2026-08-23T12'
    const r = incidentesNuevosParaAlerta([incidente(id)], id, AHORA)
    expect(r.nuevos).toEqual([])
    expect(r.marca).toBe(id)
  })

  it('si el fallo persiste en una hora nueva puede volver a escalar', () => {
    const previo = 'openai_timeout_2026-08-23T11'
    const actual = 'openai_timeout_2026-08-23T12'
    const r = incidentesNuevosParaAlerta([incidente(actual)], previo, AHORA)
    expect(r.nuevos.map(x => x.id)).toEqual([actual])
    expect(r.marca).toContain(previo)
    expect(r.marca).toContain(actual)
  })

  it('un incidente viejo no se reanima al desplegar el vigilante', () => {
    const r = incidentesNuevosParaAlerta([
      incidente('viejo', '2026-08-20T01'),
      incidente('anterior', '2026-08-23T11'),
    ], '', AHORA)
    expect(r.nuevos.map(x => x.id)).toEqual(['anterior'])
  })

  it('ids malformed no entran en la marca ni en la alerta', () => {
    const r = incidentesNuevosParaAlerta([
      incidente('malo,inyectado'),
      incidente('malo\nsegunda-linea'),
    ], '', AHORA)
    expect(r.nuevos).toEqual([])
    expect(r.marca).toBe('')
  })

  it('el resumen es PHI-safe por contrato y sanea saltos de línea', () => {
    const r = incidentesNuevosParaAlerta([
      incidente('x', '2026-08-23T12', { titulo: 'Fallo\ncon salto', urgente: true }),
    ], '', AHORA)
    const texto = resumenIncidentesParaOps(r.nuevos)
    expect(texto).toContain('openai/timeout')
    expect(texto).toContain('Fallo con salto')
    expect(texto).not.toContain('\ncon salto')
    expect(r.nuevos[0].urgente).toBe(true)
  })
})

describe('cableado del cron', () => {
  const ruta = readFileSync(join(process.cwd(), 'src/app/api/cron/vigilante/route.ts'), 'utf8')

  it('lee los incidentes persistidos y no crea otro motor paralelo', () => {
    expect(ruta).toContain("import { incidentesRecientes } from '@/lib/ia/incidentes-servidor'")
    expect(ruta).toContain('incidentesRecientes(100)')
    expect(ruta).toContain('incidentesNuevosParaAlerta')
  })

  it('persiste la marca PHI-safe en el latido y devuelve si el aviso salió', () => {
    expect(ruta).toContain('incidentesAlertados: vigilanciaIncidentes.marca')
    expect(ruta).toContain('alertaIncidentes')
    expect(ruta).toContain('incidentesNuevos: vigilanciaIncidentes.nuevos.length')
  })

  it('no degrada el candado del cron', () => {
    expect(ruta).toContain('CRON_SECRET no configurado (fail-closed)')
    expect(ruta).toContain("auth !== `Bearer ${CRON_SECRET}`")
  })
})
