/**
 * GOLDEN — se podía ver qué función cuesta, y no quién gasta ni cuánto vale
 * atender a un paciente.
 *
 * ── LO QUE PASABA (N6 de la auditoría del equipo) ────────────────────────────
 *
 * La consola de costos agrupaba por **función, modelo y clase**. El libro anota
 * el `uid` en cada asiento desde que existe el gateway, y nadie agrupaba por él.
 * Y no había ninguna cifra por consulta.
 *
 * Son las dos preguntas con las que se decide un precio: **quién gasta** y
 * **cuánto cuesta atender a un paciente**. El auditor lo dijo exacto: falta una
 * línea de agrupación, no un sistema.
 *
 * ── POR QUÉ NO SE CUENTAN NOTAS ──────────────────────────────────────────────
 *
 * La nota se re-genera sola cada ~30 segundos mientras se graba —la «nota en
 * vivo»—, así que contar notas contaría una consulta muchas veces. Se cuenta la
 * transcripción final, que ocurre una vez, al detener.
 *
 * ── Y POR QUÉ EL SUPUESTO VA ESCRITO AL LADO ─────────────────────────────────
 *
 * Una media sin su divisor se lee como un hecho. Un dictado grabado en dos
 * tandas cuenta como dos consultas, y una consulta escrita a mano no cuenta como
 * ninguna: eso hay que poder leerlo junto a la cifra, no descubrirlo después.
 */
import { describe, it, expect } from 'vitest'
import {
  costoPorConsulta, porClave, CADENA_CONSULTA, MARCAN_CONSULTA,
  POR_QUE_NO_SE_CUENTAN_NOTAS, type EventoCosto,
} from '@/lib/finanzas/cost-ledger'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const ruta = leer('src', 'app', 'api', 'superadmin', 'costos', 'route.ts')
const page = leer('src', 'app', 'superadmin', 'costos', 'page.tsx')

const ev = (feature: string, costoUsd: number | null, extra: Partial<EventoCosto> = {}): EventoCosto => ({
  requestId: 'r', clinicId: 'c1', uid: 'u1', feature,
  proveedor: 'anthropic', modelo: 'claude-opus-5',
  entrada: 100, salida: 50, entradaCache: 0, latenciaMs: 900,
  costoUsd, creditos: 1, clase: 'customer', ts: '2026-08-04T10:00:00.000Z',
  ...extra,
})

describe('LA CADENA SE DECLARA EN UN SOLO SITIO', () => {
  it('incluye lo que corre al dictar una consulta', () => {
    /**
     * No es una lista nueva: es la que ya estaba escrita en el tope de
     * cortesía —«transcribir + procesar + verificar-nota + evidencia»— más lo
     * que se le añadió después.
     */
    for (const f of ['transcribir', 'nota-consulta', 'verificar-nota', 'evidencia']) {
      expect(CADENA_CONSULTA, f).toContain(f)
    }
  })

  it('lo que marca una consulta es la transcripción, no la nota', () => {
    expect(MARCAN_CONSULTA).toContain('transcribir-diarizado')
    expect(MARCAN_CONSULTA).not.toContain('nota-consulta')
    expect(POR_QUE_NO_SE_CUENTAN_NOTAS).toMatch(/contaría una consulta muchas veces/)
  })

  it('todo lo que marca una consulta está dentro de la cadena', () => {
    // Si no, la cifra dividiría un costo entre consultas que no aportaron a él.
    for (const f of MARCAN_CONSULTA) expect(CADENA_CONSULTA, f).toContain(f)
  })
})

describe('EL COSTO POR CONSULTA', () => {
  it('divide la cadena entre las transcripciones finales', () => {
    const r = costoPorConsulta([
      ev('transcribir-diarizado', 0.10),
      ev('nota-consulta', 0.30),
      ev('verificar-nota', 0.10),
    ])
    expect(r.consultas).toBe(1)
    expect(r.totalUsd).toBeCloseTo(0.5, 6)
    expect(r.usdPorConsulta).toBeCloseTo(0.5, 6)
  })

  it('la nota en vivo NO multiplica las consultas', () => {
    /**
     * Es el defecto que haría inútil la cifra: `procesar` corre cada ~30 s
     * mientras se graba, así que una consulta de veinte minutos deja decenas de
     * asientos de nota.
     */
    const r = costoPorConsulta([
      ev('transcribir-diarizado', 0.10),
      ...Array.from({ length: 20 }, () => ev('nota-consulta', 0.02)),
    ])
    expect(r.consultas).toBe(1)
  })

  it('lo que NO es de la cadena no entra en el total', () => {
    // El antibiograma o el bot de ayuda no son parte de atender esta consulta.
    const r = costoPorConsulta([
      ev('transcribir', 0.10),
      ev('antibiograma-razonar', 5.00),
      ev('ayuda-bot', 1.00),
    ])
    expect(r.totalUsd).toBeCloseTo(0.10, 6)
  })

  it('sin consultas NO dice 0: dice que no se sabe', () => {
    // Dividir entre cero no es cero. Una media de cero se lee como «gratis».
    const r = costoPorConsulta([ev('nota-consulta', 0.30)])
    expect(r.consultas).toBe(0)
    expect(r.usdPorConsulta).toBeNull()
  })

  it('una transcripción que FALLÓ no es una consulta', () => {
    // Cuesta tokens —y por eso suma al total— pero no atendió a nadie:
    // contarla bajaría el costo por consulta con un fracaso.
    const r = costoPorConsulta([ev('transcribir', 0.05, { fallo: true }), ev('transcribir', 0.05)])
    expect(r.consultas).toBe(1)
  })

  it('lo que no tiene tarifa se declara, no se suma como cero', () => {
    const r = costoPorConsulta([
      ev('transcribir', 0.10),
      ev('nota-consulta', null, { motivoSinCosto: 'sin_tarifa' }),
    ])
    expect(r.sinTarifa).toBe(1)
    expect(r.totalUsd).toBeCloseTo(0.10, 6)
  })

  it('el supuesto viaja con la cifra', () => {
    // Una media sin su divisor se lee como un hecho.
    const r = costoPorConsulta([ev('transcribir', 0.10)])
    expect(r.supuesto).toMatch(/dos tandas cuenta como dos/)
    expect(r.supuesto).toMatch(/escrita a mano no cuenta/)
  })
})

describe('EL COSTO POR MÉDICO', () => {
  it('agrupa por uid', () => {
    const g = porClave([ev('nota-consulta', 0.30), ev('nota-consulta', 0.10, { uid: 'u2' })], e => e.uid ?? '')
    expect(g).toHaveLength(2)
    expect(g[0].clave).toBe('u1')
    expect(g[0].resumen.totalUsd).toBeCloseTo(0.30, 6)
  })

  it('los asientos sin médico no se pierden ni se reparten', () => {
    const g = porClave([ev('ayuda-bot', 0.05, { uid: null })], e => e.uid ?? '(sin médico)')
    expect(g[0].clave).toBe('(sin médico)')
  })
})

describe('LA CONSOLA LO ENSEÑA', () => {
  it('la ruta manda las dos líneas, y sobre COGS', () => {
    /**
     * Sobre COGS y no sobre todo: el gasto de I+D del fundador no es el costo
     * de atender a un paciente.
     */
    expect(ruta).toContain("porMedico: porClave(cogs, e => e.uid ?? '(sin médico)')")
    expect(ruta).toContain('porConsulta: costoPorConsulta(cogs)')
  })

  it('la pantalla enseña el costo por consulta CON su supuesto', () => {
    expect(page).toContain('Costo de IA por consulta dictada')
    expect(page).toContain('datos.porConsulta.supuesto')
  })

  it('y la tabla por médico dice que es el identificador, no el nombre', () => {
    // El libro de costos no guarda identidades a propósito.
    expect(page).toContain('titulo="Por médico"')
    expect(page).toMatch(/nunca el nombre/)
  })
})
