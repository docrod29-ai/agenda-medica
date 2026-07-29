import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  invariantesProtegidos,
  testsCitadosEnLedger,
  buscarDesactivaciones,
  contarCasos,
  rutaDeTest,
  METAGATES,
  PATRONES_DESACTIVACION,
  type SelloInvariantes,
} from '@/lib/clinical/safety-gate'
import { CLINICAL_ENGINE_REGISTRY } from '@/lib/clinical/registry'

/**
 * E0-11 — METAGATE de invariantes clínicos y de seguridad.
 *
 * `npx vitest run` mide los tests que QUEDAN, no los que DEBEN existir. Este
 * archivo cierra ese hueco: comprueba que cada invariante protegido siga en
 * disco, encendido y con al menos tantos casos como el día que se selló.
 *
 * El porqué del diseño (y por qué el trinquete aquí es MONÓTONO y en E0-03 es
 * exacto) está en `docs/ci/clinical-safety-gate.md`.
 */
const RAIZ = process.cwd()
const RUTA_SELLO = 'src/lib/clinical/invariantes-clinicos.json'
const RUTA_LEDGER = 'docs/audit/regression-ledger.md'
const RUTA_CI = '.github/workflows/ci.yml'

const leer = (rel: string) => readFileSync(resolve(RAIZ, rel), 'utf8')

const ledgerMd = leer(RUTA_LEDGER)
const sello: SelloInvariantes = JSON.parse(leer(RUTA_SELLO))
const protegidos = invariantesProtegidos(ledgerMd)

describe('E0-11 · el manifiesto de invariantes está sano', () => {
  it('el sello declara archivos y un total de casos', () => {
    expect(sello.archivos.length).toBeGreaterThanOrEqual(70)
    expect(sello.totalCasos).toBeGreaterThan(0)
  })

  it('el conjunto derivado no está vacío ni es sospechosamente corto', () => {
    // Si el registro o el ledger se vaciaran, el gate quedaría vacuo y verde.
    expect(protegidos.length).toBeGreaterThanOrEqual(70)
  })

  it('los tres metagates están en el conjunto protegido', () => {
    const rutas = new Set(protegidos.map(p => p.archivo))
    const ausentes = METAGATES.filter(m => !rutas.has(m.archivo)).map(m => m.archivo)
    expect(ausentes, 'metagates fuera del conjunto protegido').toEqual([])
  })
})

describe('E0-11 · ASERCIÓN 1: cada invariante protegido EXISTE en disco', () => {
  it('ningún archivo del sello fue borrado', () => {
    const fantasmas = sello.archivos
      .filter(a => !existsSync(resolve(RAIZ, a.archivo)))
      .map(a => a.archivo)
    expect(
      fantasmas,
      fantasmas.length
        ? `Se borró un invariante protegido:\n  ${fantasmas.join('\n  ')}\n\n` +
          'Si el test se RENOMBRÓ, actualiza el sello y la fuente que lo cita ' +
          '(registry.goldenTests o el regression-ledger). Si se ELIMINÓ, el motor ' +
          'o el REG-xxx que dependía de él se quedó sin prueba: eso es el hallazgo.'
        : '',
    ).toEqual([])
  })
})

describe('E0-11 · ASERCIÓN 2: ningún invariante está APAGADO', () => {
  it('no hay .skip / .only / .todo / xit / xdescribe en el conjunto protegido', () => {
    const apagados: string[] = []
    for (const { archivo } of sello.archivos) {
      const ruta = resolve(RAIZ, archivo)
      if (!existsSync(ruta)) continue // lo reporta la aserción 1
      for (const h of buscarDesactivaciones(readFileSync(ruta, 'utf8'))) {
        apagados.push(`${archivo}:${h.linea} [${h.patron}] ${h.texto}`)
      }
    }
    expect(
      apagados,
      apagados.length
        ? `Hay invariantes clínicos DESACTIVADOS:\n  ${apagados.join('\n  ')}\n\n` +
          'Un invariante no se apaga para pasar el CI. Las tres salidas legítimas ' +
          'están en docs/ci/clinical-safety-gate.md §Cuando el gate cae.'
        : '',
    ).toEqual([])
  })
})

describe('E0-11 · ASERCIÓN 3: TRINQUETE de cobertura (puede subir, nunca bajar)', () => {
  it('ningún archivo protegido perdió casos respecto al sello', () => {
    const encogidos: string[] = []
    for (const { archivo, minCasos } of sello.archivos) {
      const ruta = resolve(RAIZ, archivo)
      if (!existsSync(ruta)) continue
      const ahora = contarCasos(readFileSync(ruta, 'utf8'))
      if (ahora < minCasos) encogidos.push(`${archivo}: ${ahora} casos, el sello exige ${minCasos}`)
    }
    expect(
      encogidos,
      encogidos.length
        ? `Bajó la cobertura de invariantes:\n  ${encogidos.join('\n  ')}\n\n` +
          'NUNCA bajes minCasos "para pasar el CI". Si un refactor fusionó casos ' +
          'legítimamente, baja el número Y escribe la razón (ver docs/ci/clinical-safety-gate.md).'
        : '',
    ).toEqual([])
  })

  it('la suma total de casos protegidos no baja', () => {
    const total = sello.archivos.reduce((acc, a) => {
      const ruta = resolve(RAIZ, a.archivo)
      return acc + (existsSync(ruta) ? contarCasos(readFileSync(ruta, 'utf8')) : 0)
    }, 0)
    expect(
      total,
      `El total de casos protegidos es ${total} y el sello congeló ${sello.totalCasos}.`,
    ).toBeGreaterThanOrEqual(sello.totalCasos)
  })
})

describe('E0-11 · ASERCIÓN 4: el sello no se desincroniza de sus fuentes', () => {
  it('todo goldenTests del registro está protegido', () => {
    const sellados = new Set(sello.archivos.map(a => a.archivo))
    const huerfanos: string[] = []
    for (const motor of CLINICAL_ENGINE_REGISTRY) {
      for (const golden of motor.goldenTests ?? []) {
        const ruta = rutaDeTest(golden)
        if (!sellados.has(ruta)) huerfanos.push(`${motor.id} → ${ruta}`)
      }
    }
    expect(
      huerfanos,
      huerfanos.length
        ? `Motores cuyo golden NO está protegido:\n  ${huerfanos.join('\n  ')}\n\n` +
          `Añade cada ruta a ${RUTA_SELLO} con su minCasos medido (y súmalos a totalCasos).`
        : '',
    ).toEqual([])
  })

  it('todo test citado en el regression-ledger está protegido', () => {
    const sellados = new Set(sello.archivos.map(a => a.archivo))
    const huerfanos = testsCitadosEnLedger(ledgerMd).filter(t => !sellados.has(t))
    expect(
      huerfanos,
      huerfanos.length
        ? `Tests que cierran un REG-xxx y NO están protegidos:\n  ${huerfanos.join('\n  ')}`
        : '',
    ).toEqual([])
  })

  it('el sello no protege archivos que ya no derivan de ninguna fuente', () => {
    // Al revés que las dos anteriores: detecta basura acumulada en el sello,
    // que daría una falsa sensación de cobertura.
    const derivados = new Set(protegidos.map(p => p.archivo))
    const sobrantes = sello.archivos.map(a => a.archivo).filter(a => !derivados.has(a))
    expect(sobrantes, 'archivos sellados que ninguna fuente reclama ya').toEqual([])
  })
})

describe('E0-11 · ASERCIÓN 5: el gate está cableado en el CI (autoprotección)', () => {
  // Se lee el YAML como TEXTO a propósito: meter un parser de YAML solo para
  // esto añadiría una dependencia al repo. Lo que se comprueba es que nadie
  // quite el job en el mismo PR en el que rompe un invariante.
  const ci = leer(RUTA_CI)

  it('existe el job `clinical-safety` (es el required status check)', () => {
    expect(ci, `${RUTA_CI} perdió el job clinical-safety`).toMatch(/^\s{2}clinical-safety:/m)
  })

  it('el job corre este metagate y el manifiesto', () => {
    expect(ci).toContain('src/__tests__/clinical-safety-gate.test.ts')
    expect(ci).toContain('scripts/invariantes-clinicos.mjs')
  })

  it('el job `verificar` sigue corriendo la suite completa', () => {
    expect(ci).toMatch(/^\s{2}verificar:/m)
    expect(ci).toContain('npx vitest run')
  })

  it('el runner del manifiesto existe', () => {
    expect(existsSync(resolve(RAIZ, 'scripts/invariantes-clinicos.mjs'))).toBe(true)
  })
})

describe('E0-11 · ASERCIÓN 6: autotest — el gate no es de cartón', () => {
  // Sin este bloque, una regex mal escrita dejaría el gate siempre verde y
  // nadie se enteraría. Aquí se prueba que DETECTA lo que debe y que NO
  // dispara con menciones inocentes.
  const debeDetectar = [
    "  it.skip('caso', () => {})",
    "describe.skip('bloque', () => {})",
    "  test.skip('caso', () => {})",
    "  xit('caso', () => {})",
    "xdescribe('bloque', () => {})",
    "  it.only('caso', () => {})",
    "describe.only('bloque', () => {})",
    "  it.todo('pendiente')",
    "  it.each([1,2]).skip('caso %s', () => {})",
  ]
  const noDebeDetectar = [
    "  it('no salta pasos', () => {})",
    "  it('rechaza describe.skip en el manifiesto', () => {})",
    '  // ojo: nunca uses it.only aquí',
    "  const msg = 'usa it.skip bajo tu propio riesgo'",
    "  it('cuenta .todo como desactivación', () => {})",
  ]

  it.each(debeDetectar)('detecta la desactivación: %s', (linea) => {
    expect(buscarDesactivaciones(linea).length).toBeGreaterThan(0)
  })

  it.each(noDebeDetectar)('NO dispara con: %s', (linea) => {
    expect(buscarDesactivaciones(linea)).toEqual([])
  })

  it('las regex no arrastran estado entre llamadas (sin flag /g)', () => {
    const patron = PATRONES_DESACTIVACION[0].re
    const linea = "  it.skip('x', () => {})"
    expect(patron.test(linea)).toBe(true)
    expect(patron.test(linea)).toBe(true) // con /g la segunda daría false
  })

  it('contarCasos cuenta it/test y no comentarios ni strings', () => {
    const fuente = [
      "import { it } from 'vitest'",
      "it('uno', () => {})",
      "  test('dos', () => {})",
      "  it.each([1])('tres %s', () => {})",
      "// it('no cuenta', () => {})",
      "const s = \"it('tampoco', () => {})\"",
    ].join('\n')
    expect(contarCasos(fuente)).toBe(3)
  })

  it('contarCasos devuelve 0 en un archivo vaciado', () => {
    expect(contarCasos('// aquí no queda nada\n')).toBe(0)
  })

  it('invariantesProtegidos deriva del ledger que se le pasa (es puro)', () => {
    const fixture = '| REG-999 | X | Y | CLOSED | `src/__tests__/fixture-inventado.test.ts` |'
    const rutas = invariantesProtegidos(fixture).map(p => p.archivo)
    expect(rutas).toContain('src/__tests__/fixture-inventado.test.ts')
  })
})
