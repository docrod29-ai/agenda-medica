/**
 * GOLDEN — la raya entre ruido e incidente, y los tiempos que salen de ahí.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * El 5-ago-2026 el Dr. vio, debajo de la nota de una consulta real y en rojo,
 * cinco trabajos automáticos caídos que no tenían nada que ver con el paciente
 * que tenía delante. Era el octavo bloque de aviso de esa pantalla. La lección
 * quedó escrita en `ops/interrumpe-la-consulta.ts`: la pregunta correcta no es
 * «¿esto es urgente?» sino «¿esto se arregla desde donde estoy?».
 *
 * Este golden vigila el escalón anterior: **si TODO fallo dispara un aviso,
 * nadie mira los avisos**, y entonces el sistema de detección está apagado sin
 * que nadie lo haya apagado.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 *
 * Un evento y un incidente no son lo mismo, y sin una raya explícita el código
 * los confunde: cada `catch` decide por su cuenta si eso merece un aviso.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Hay raya para el ruido y NO la hay para el aislamiento entre consultorios:
 * ahí una vez ya es demasiadas. Y los umbrales que son compromisos de servicio
 * (tasa, latencia) se quedan en `null` y se DECLARAN como no evaluados, en vez
 * de rellenarse con una cifra plausible.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · No fija SLOs. `tasaError` y `latenciaP95Ms` siguen en `null` hasta que el
 *   dueño los apruebe; esta prueba comprueba que se declaran, no que valgan X.
 * · Los MTTD/MTTR que se prueban aquí son aritmética sobre instantes dados. No
 *   son mediciones de producción y esta prueba no las convierte en tales.
 */
import { describe, it, expect } from 'vitest'
import { agrupar } from '@/lib/incidents/agrupacion'
import { evaluarUmbral, POLITICA_POR_OMISION } from '@/lib/incidents/umbrales'
import { resumirTiempos, tiempoHastaDetectar, tiempoHastaRecuperar, comoSeDice, OBJETIVOS } from '@/lib/incidents/mttd-mttr'
import type { EventoIncidente } from '@/lib/incidents/taxonomia'

const T0 = Date.parse('2026-08-23T09:00:00.000Z')
const ev = (i: number, over: Partial<EventoIncidente> = {}): EventoIncidente => ({
  categoria: 'ai_provider',
  subtipo: 'timeout',
  feature: 'nota',
  ruta: '/consulta/[id]',
  proveedor: 'anthropic',
  codigoNormalizado: 'http_504',
  appVersion: 'nexusmed-v1171',
  ocurridoEn: new Date(T0 + i * 1000).toISOString(),
  operationId: `op-${i}`,
  ...over,
})

describe('Un fallo suelto NO es un incidente', () => {
  it('un timeout aislado se anota y no despierta a nadie', () => {
    const { grupos } = agrupar([ev(0)])
    const v = evaluarUmbral(grupos[0])
    expect(v.esIncidente).toBe(false)
    expect(v.porQue).toMatch(/por debajo de toda raya/)
  })

  it('cuatro operaciones distintas siguen por debajo de la raya', () => {
    const { grupos } = agrupar([0, 1, 2, 3].map(i => ev(i)))
    expect(evaluarUmbral(grupos[0]).esIncidente).toBe(false)
  })

  it('500 timeouts en 5 min en la misma función SÍ es un incidente', () => {
    const eventos = Array.from({ length: 500 }, (_, i) => ev(i * 0.6))
    const { grupos } = agrupar(eventos)
    const v = evaluarUmbral(grupos[0])
    expect(v.esIncidente).toBe(true)
    expect(v.razones).toContain('conteo')
    expect(v.razones).toContain('operaciones_afectadas')
  })

  it('un goteo largo cuenta aunque nunca llegue al conteo', () => {
    // Dos eventos separados 20 minutos: poco volumen, mucho rato.
    const { grupos } = agrupar([ev(0), ev(1200)])
    const v = evaluarUmbral(grupos[0])
    expect(v.esIncidente).toBe(true)
    expect(v.razones).toContain('sostenido')
  })

  it('un pico brusco contra la línea base cuenta como incidente', () => {
    const { grupos } = agrupar(Array.from({ length: 10 }, (_, i) => ev(i * 0.1, { operationId: 'op-0' })))
    const v = evaluarUmbral(grupos[0], { lineaBasePorMinuto: 0.5 })
    expect(v.razones).toContain('pico')
  })
})

describe('El aislamiento entre consultorios no tiene raya', () => {
  it('UN solo evento ya es incidente', () => {
    const { grupos } = agrupar([ev(0, {
      categoria: 'tenant_isolation', subtipo: 'lectura_cruzada',
      proveedor: undefined, codigoNormalizado: 'permission_denied',
    })])
    const v = evaluarUmbral(grupos[0])
    expect(v.esIncidente).toBe(true)
    expect(v.razones).toContain('invariante_de_seguridad')
  })

  it('AL REVÉS: subiendo TODOS los umbrales sigue siendo incidente', () => {
    const { grupos } = agrupar([ev(0, {
      categoria: 'tenant_isolation', subtipo: 'lectura_cruzada',
      proveedor: undefined, codigoNormalizado: 'permission_denied',
    })])
    const imposible = {
      ...POLITICA_POR_OMISION,
      minEventos: 1_000_000, minOperaciones: 1_000_000,
      sostenidoMin: 1_000_000, factorPico: 1_000_000,
      severidadInmediata: 'sev1' as const,
    }
    expect(evaluarUmbral(grupos[0], {}, imposible).esIncidente).toBe(true)
  })

  it('un fallo de autorización tampoco se puede silenciar por ruido', () => {
    const { grupos } = agrupar([ev(0, {
      categoria: 'authorization', subtipo: 'permiso_denegado',
      proveedor: undefined, codigoNormalizado: 'http_403',
    })])
    expect(evaluarUmbral(grupos[0]).razones).toContain('invariante_de_seguridad')
  })
})

describe('Lo que no se puede evaluar se DECLARA', () => {
  it('la tasa de error y la latencia se declaran como no evaluadas, no se estiman', () => {
    const { grupos } = agrupar([ev(0)])
    const v = evaluarUmbral(grupos[0])
    expect(v.noEvaluado.join(' ')).toMatch(/tasa de error.*SLO/)
    expect(v.noEvaluado.join(' ')).toMatch(/latencia.*SLO/)
    expect(POLITICA_POR_OMISION.tasaError).toBeNull()
    expect(POLITICA_POR_OMISION.latenciaP95Ms).toBeNull()
  })

  it('con un umbral aprobado y denominador, la tasa sí se evalúa', () => {
    const { grupos } = agrupar(Array.from({ length: 30 }, (_, i) => ev(i, { operationId: 'op-0' })))
    const v = evaluarUmbral(grupos[0], { operacionesTotales: 100 }, { ...POLITICA_POR_OMISION, tasaError: 0.2 })
    expect(v.razones).toContain('tasa_de_error')
  })

  it('con umbral aprobado pero SIN denominador, se declara y no se inventa', () => {
    const { grupos } = agrupar([ev(0)])
    const v = evaluarUmbral(grupos[0], {}, { ...POLITICA_POR_OMISION, tasaError: 0.2 })
    expect(v.razones).not.toContain('tasa_de_error')
    expect(v.noEvaluado.join(' ')).toMatch(/no hay total de operaciones/)
  })
})

describe('MTTD y MTTR se calculan, y se dice de dónde salen', () => {
  const linea = {
    primerFalloEn: '2026-08-23T09:00:00.000Z',
    detectadoEn: '2026-08-23T09:00:30.000Z',
    recuperadoEn: '2026-08-23T09:02:00.000Z',
  }

  it('MTTD es detección menos primer fallo', () => {
    expect(tiempoHastaDetectar(linea)).toBe(30_000)
  })

  it('MTTR se mide desde la DETECCIÓN, no desde el primer fallo', () => {
    expect(tiempoHastaRecuperar(linea)).toBe(90_000)
    // Si se midiera desde el primer fallo daría 120 s y mezclaría dos problemas.
    expect(tiempoHastaRecuperar(linea)).not.toBe(120_000)
  })

  it('sin instante de detección no hay cifra: null, y se dice por qué', () => {
    const r = resumirTiempos([{ primerFalloEn: linea.primerFalloEn }], 'observado')
    expect(r.mttd.valorMs).toBeNull()
    expect(r.mttd.porQueNo).toMatch(/instante de detección/)
  })

  it('la mediana, no la media: un caso nocturno no arrastra la semana', () => {
    const noche = { primerFalloEn: '2026-08-23T03:00:00.000Z', detectadoEn: '2026-08-23T11:00:00.000Z' }
    const normales = [1, 2, 3].map(i => ({
      primerFalloEn: `2026-08-23T09:0${i}:00.000Z`,
      detectadoEn: `2026-08-23T09:0${i}:20.000Z`,
    }))
    const r = resumirTiempos([...normales, noche], 'observado')
    expect(r.mttd.valorMs).toBe(20_000)          // mediana: el caso normal
    expect(r.peorMttdMs).toBe(8 * 3600 * 1000)   // y la cola sigue visible
  })

  it('una cifra de simulacro NUNCA se imprime como si fuera de producción', () => {
    const texto = comoSeDice({ origen: 'simulacro', valorMs: 12_000, n: 13 })
    expect(texto).toMatch(/MEDIDO EN SIMULACRO/)
    expect(texto).toMatch(/no el mundo real/)
  })

  it('los objetivos siguen vacíos: los fija el dueño, no este archivo', () => {
    expect(OBJETIVOS.mttdMs).toBeNull()
    expect(OBJETIVOS.mttrMs).toBeNull()
  })
})
