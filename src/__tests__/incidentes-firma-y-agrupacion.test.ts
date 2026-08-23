/**
 * GOLDEN — la identidad de un incidente: firma, agrupación y PHI.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Nada todavía: este es el guardián que nace con el carril #315. Lo que existía
 * antes era la agrupación por `proveedor_clase_HORA` de
 * `src/lib/ia/incidentes-servidor.ts`, buena y sólo para la IA. Fuera de ahí, un
 * mismo fallo repetido diez mil veces eran diez mil líneas sueltas: en
 * `api/errores` la única defensa era un `Set` en el navegador que se vacía al
 * recargar la pestaña.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Leyendo `reportarError()`: deduplica por `mensaje+origen` **en memoria del
 * cliente**, así que veinte médicos con el mismo fallo son veinte reportes, y un
 * médico que recarga cinco veces son cinco más. La agrupación tenía que subir al
 * servidor y dejar de depender del proveedor.
 *
 * ── CAUSA RAÍZ (la que este golden protege) ──────────────────────────────────
 *
 * Sin firma determinista no hay agrupación; sin vocabulario cerrado en la firma,
 * la agrupación se convierte en un sitio por donde sale PHI — porque todo lo que
 * entra en la firma sale en la alerta y en la consola de soporte.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * La identidad de un incidente es vocabulario cerrado. Una frase no puede entrar
 * porque no tiene la forma de una etiqueta, y la ruta entra como PLANTILLA.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · No detecta un NOMBRE propio suelto. Ningún regex distingue «María González»
 *   de «monoterapia»: la defensa es la forma, no el contenido.
 * · No prueba que las rutas reales del producto emitan estos eventos. Eso es
 *   cableado y vive en los handoffs de `docs/support/`.
 * · No cubre Hospital ni UCI.
 */
import { describe, it, expect } from 'vitest'
import { firmaDe, familiaDe, plantillaDeRuta, verificarFirmaLibreDePHI } from '@/lib/incidents/firma'
import { agrupar, fusionar, TOPE_CONJUNTO } from '@/lib/incidents/agrupacion'
import type { EventoIncidente } from '@/lib/incidents/taxonomia'

const base: EventoIncidente = {
  categoria: 'ai_provider',
  subtipo: 'sin_saldo',
  feature: 'nota',
  ruta: '/consulta/[id]',
  proveedor: 'anthropic',
  codigoNormalizado: 'http_400',
  appVersion: 'nexusmed-v1171',
  ocurridoEn: '2026-08-23T09:00:00.000Z',
}

describe('La firma es determinista y no puede llevar PHI', () => {
  it('el mismo fallo produce la misma firma', () => {
    const a = firmaDe({ ...base, ocurridoEn: '2026-08-23T09:00:00.000Z', operationId: 'op-1' })
    const b = firmaDe({ ...base, ocurridoEn: '2026-08-23T11:47:33.000Z', operationId: 'op-999' })
    expect(a).toBe(b)
  })

  it('dos fallos técnicamente distintos NO comparten firma', () => {
    expect(firmaDe(base)).not.toBe(firmaDe({ ...base, subtipo: 'limite_tasa' }))
    expect(firmaDe(base)).not.toBe(firmaDe({ ...base, feature: 'transcribir' }))
  })

  it('una versión nueva separa la regresión nueva, y la FAMILIA la vuelve a unir', () => {
    const viejo = firmaDe(base)
    const nuevo = firmaDe({ ...base, appVersion: 'nexusmed-v1172' })
    expect(nuevo).not.toBe(viejo)
    // Misma familia: es el MISMO fallo visto a través de dos despliegues.
    expect(familiaDe({ ...base, appVersion: 'nexusmed-v1172' })).toBe(familiaDe(base))
  })

  it('la ruta entra como PLANTILLA: un id de paciente nunca llega a la firma', () => {
    expect(plantillaDeRuta('/consulta/8f2aB1cD9x/nota')).toBe('/consulta/[id]/nota')
    expect(plantillaDeRuta('/pacientes/1834/citas')).toBe('/pacientes/[id]/citas')
    const f = firmaDe({ ...base, ruta: '/consulta/8f2aB1cD9x/nota' })
    expect(f).not.toContain('8f2a')
    expect(verificarFirmaLibreDePHI(f).limpia).toBe(true)
  })

  /**
   * PROBADO AL REVÉS. Sin la compuerta de forma, un mensaje de error entero
   * cabría en `subtipo` y viajaría a la alerta, al agrupador y a la consola.
   */
  it('AL REVÉS: un mensaje de error con PHI NO se puede convertir en firma', () => {
    expect(() => firmaDe({ ...base, subtipo: 'no se pudo guardar la nota de Ana Ruiz' as string }))
      .toThrow(/etiqueta admisible/)
    expect(() => firmaDe({ ...base, feature: 'ana.ruiz@correo.com' as string }))
      .toThrow(/etiqueta admisible/)
  })

  it('AL REVÉS: una firma con un identificador dentro se declara sucia', () => {
    const sucia = 'ai_provider|sin_saldo|nota|/consulta/[id]|anthropic|http_400|RUIA850101HDFXXX09'
    expect(verificarFirmaLibreDePHI(sucia).limpia).toBe(false)
  })
})

describe('Diez mil eventos iguales son UN incidente', () => {
  const mil = (n: number) => Array.from({ length: n }, (_, i) => ({
    ...base,
    ocurridoEn: new Date(Date.parse(base.ocurridoEn) + i * 100).toISOString(),
    operationId: `op-${i}`,
  }))

  it('1000 repeticiones del mismo fallo → un solo grupo con su contador', () => {
    const { grupos, rechazados } = agrupar(mil(1000))
    expect(rechazados).toHaveLength(0)
    expect(grupos).toHaveLength(1)
    expect(grupos[0].count).toBe(1000)
  })

  it('el conteo NO se recorta, pero el conjunto de operaciones SÍ — y lo declara', () => {
    const { grupos } = agrupar(mil(1000))
    expect(grupos[0].count).toBe(1000)
    expect(grupos[0].operacionesAfectadas).toBe(TOPE_CONJUNTO)
    // Lo que importa: el recorte no se lee como el total.
    expect(grupos[0].operacionesRecortadas).toBe(true)
  })

  it('dos fallos distintos no se funden en uno', () => {
    const { grupos } = agrupar([...mil(5), ...mil(5).map(e => ({ ...e, subtipo: 'sobrecarga' }))])
    expect(grupos).toHaveLength(2)
  })

  it('el resultado no depende del orden de llegada', () => {
    const eventos = mil(50)
    const a = agrupar(eventos).grupos
    const b = agrupar([...eventos].reverse()).grupos
    expect(b.map(g => g.firma)).toEqual(a.map(g => g.firma))
    expect(b[0].firstSeen).toBe(a[0].firstSeen)
    expect(b[0].lastSeen).toBe(a[0].lastSeen)
  })

  it('un evento que no se puede firmar se DEVUELVE, no se descarta en silencio', () => {
    const { grupos, rechazados } = agrupar([base, { ...base, feature: 'texto con espacios' }])
    expect(grupos).toHaveLength(1)
    expect(rechazados).toHaveLength(1)
    expect(rechazados[0].porQue).toMatch(/etiqueta admisible/)
  })

  it('fusionar suma contadores y conserva el estado del guardado', () => {
    const guardado = { ...agrupar(mil(3)).grupos[0], estado: 'resuelto' as const }
    const nuevo = agrupar(mil(4)).grupos[0]
    const unido = fusionar(guardado, nuevo)
    expect(unido.count).toBe(7)
    // Un evento rezagado no reabre lo que soporte ya cerró.
    expect(unido.estado).toBe('resuelto')
  })

  it('AL REVÉS: no se fusionan dos firmas distintas', () => {
    const a = agrupar(mil(1)).grupos[0]
    const b = agrupar([{ ...base, subtipo: 'sobrecarga' }]).grupos[0]
    expect(() => fusionar(a, b)).toThrow(/no se fusionan/)
  })
})
