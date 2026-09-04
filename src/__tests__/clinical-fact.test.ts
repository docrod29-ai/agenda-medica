import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { parsearHecho, ClinicalFactSchema } from '@/lib/clinical-fact/schema'
import { esUsableParaCalculo } from '@/types/clinical-fact'
import { parsearCantidad, FACTORES, valorEn, type Dimension } from '@/types/clinical-quantity'
import { ANALITOS } from '@/lib/expediente/laboratorio/analitos'
import {
  HECHO_CANTIDAD, HECHO_CODIGO, HECHO_BOOLEANO, HECHO_TEXTO, HECHO_MOTOR,
  HECHO_CORREGIDO, HECHO_CON_VIGENCIA, HECHOS_VALIDOS, sin,
} from './fixtures/clinical-facts'

/**
 * E1-01 — ClinicalFact.
 *
 * REPARTO DE RESPONSABILIDADES (igual que E0-04): la mitad de la aceptación que
 * dice «un hecho MAL FORMADO no es ni expresable» la prueba
 * `src/__tests__/tipos/clinical-fact.tipos.ts`, que es un gate de `tsc`, no de
 * vitest. Este archivo cubre (a) la validación en runtime de datos `unknown`,
 * (b) el GUARDIÁN de aquel gate y (c) el hueco de cobertura de unidades, fijado
 * para que no crezca en silencio.
 */

const raiz = process.cwd()
const leer = (p: string) => readFileSync(resolve(raiz, p), 'utf8')

// ---------------------------------------------------------------------------
// GUARDIÁN DEL GATE DEL COMPILADOR
// ---------------------------------------------------------------------------

describe('E1-01 · guardián del gate del compilador', () => {
  const rutaTipos = 'src/__tests__/tipos/clinical-fact.tipos.ts'

  it('el archivo de casos negativos existe', () => {
    expect(
      existsSync(resolve(raiz, rutaTipos)),
      `${rutaTipos} es media aceptación de E1-01: sin él, nada prueba que un hecho sin procedencia no compile`,
    ).toBe(true)
  })

  it('conserva al menos 10 @ts-expect-error ACTIVOS (no comentados)', () => {
    const activos = leer(rutaTipos)
      .split('\n')
      .filter((l) => /^\s*\/\/\s*@ts-expect-error\b/.test(l))
    expect(activos.length).toBeGreaterThanOrEqual(10)
  })

  it('sigue cubriendo los dos casos que cita la aceptación del backlog', () => {
    const src = leer(rutaTipos)
    expect(src).toContain('`procedencia` es obligatoria')
    expect(src).toContain('le falta la unidad')
  })
})

// ---------------------------------------------------------------------------
// 1. ACEPTACIÓN LITERAL — «un hecho sin unidad o sin procedencia no valida»
// ---------------------------------------------------------------------------

describe('E1-01 · aceptación: sin unidad no valida', () => {
  it('los fixtures válidos SÍ validan (control positivo)', () => {
    for (const h of HECHOS_VALIDOS) {
      const r = parsearHecho(h)
      expect(r.ok, `${(h as { id: string }).id}: ${r.ok ? '' : r.errores.join(' · ')}`).toBe(true)
    }
  })

  it('una cantidad SIN unidad no valida', () => {
    const r = parsearHecho({
      ...HECHO_CANTIDAD,
      valor: { clase: 'cantidad', cantidad: { valor: 1.2, dimension: 'concentracion_masa' } },
    })
    expect(r.ok).toBe(false)
  })

  it('una unidad VACÍA no valida (un string en blanco no es una unidad)', () => {
    const r = parsearHecho({
      ...HECHO_CANTIDAD,
      valor: { clase: 'cantidad', cantidad: { valor: 1.2, unidad: '', dimension: 'concentracion_masa' } },
    })
    expect(r.ok).toBe(false)
  })

  it('una unidad que NO pertenece a la dimensión declarada no valida (cruce de campos)', () => {
    // 'mL' existe en el catálogo, pero es de `volumen`. Sin este cruce bastaría
    // con «hay un string en unidad» y el bug de escala volvería por la puerta.
    const r = parsearHecho({
      ...HECHO_CANTIDAD,
      valor: { clase: 'cantidad', cantidad: { valor: 1.2, unidad: 'mL', dimension: 'masa' } },
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores.join(' ')).toContain('no pertenece a la dimensión')
  })

  it('una dimensión fuera del catálogo no valida', () => {
    const r = parsearHecho({
      ...HECHO_CANTIDAD,
      valor: { clase: 'cantidad', cantidad: { valor: 37, unidad: '°C', dimension: 'temperatura' } },
    })
    expect(r.ok).toBe(false)
  })
})

describe('E1-01 · aceptación: sin procedencia no valida', () => {
  it('un hecho SIN el campo procedencia no valida', () => {
    const r = parsearHecho(sin(HECHO_CANTIDAD, 'procedencia'))
    expect(r.ok).toBe(false)
  })

  it('procedencia VACÍA no valida (el patrón `provenance: {}` que hoy sí pasa en la nota)', () => {
    const r = parsearHecho({ ...HECHO_CANTIDAD, procedencia: {} })
    expect(r.ok).toBe(false)
  })

  it('procedencia de IA sin modelo no valida (invariante 5: modelo + promptVersion)', () => {
    const r = parsearHecho({
      ...HECHO_BOOLEANO,
      procedencia: {
        origen: 'ia', registradoEn: '2026-07-28T09:00:00Z',
        autor: { uid: 'uid_demo' }, promptVersion: 'v1', revisadoPorHumano: true,
      },
    })
    expect(r.ok).toBe(false)
  })

  it('procedencia de IA con modelo VACÍO no valida', () => {
    const r = parsearHecho({
      ...HECHO_BOOLEANO,
      procedencia: {
        origen: 'ia', registradoEn: '2026-07-28T09:00:00Z', autor: { uid: 'uid_demo' },
        modelo: '', promptVersion: 'v1', revisadoPorHumano: true,
      },
    })
    expect(r.ok).toBe(false)
  })

  it('procedencia de motor sin engineVersion no valida (no se podría reproducir)', () => {
    const r = parsearHecho({
      ...HECHO_MOTOR,
      procedencia: { origen: 'motor', registradoEn: '2026-07-28T09:00:00Z', engineId: 'ckd-epi-2021' },
    })
    expect(r.ok).toBe(false)
  })

  it('un origen inventado no valida', () => {
    const r = parsearHecho({
      ...HECHO_CANTIDAD,
      procedencia: { origen: 'telepatia', registradoEn: '2026-07-28T09:00:00Z' },
    })
    expect(r.ok).toBe(false)
  })

  it('un hecho sin observedAt no valida (sin cuándo pasó no hay grafo temporal)', () => {
    const r = parsearHecho(sin(HECHO_CANTIDAD, 'observedAt'))
    expect(r.ok).toBe(false)
  })

  it('un hecho sin clinicId no valida (multi-tenant: el hecho sabe de quién es)', () => {
    const r = parsearHecho(sin(HECHO_CANTIDAD, 'clinicId'))
    expect(r.ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 2. ANTI-VACIAMIENTO — los dos agujeros por los que la aceptación sería decorativa
// ---------------------------------------------------------------------------

describe('E1-01 · anti-vaciamiento de la aceptación', () => {
  it('una llave EXTRA colada junto al valor no se descarta en silencio: falla', () => {
    // Con `z.object` (no strict) esta `unidad` se descartaría sin avisar y el
    // productor creería que su hecho de texto «tiene unidad». Control negativo
    // ejecutado: cambiando strictObject→object, este caso se pone rojo.
    const r = parsearHecho({
      ...HECHO_TEXTO,
      valor: { clase: 'texto', texto: 'sin focalización', unidad: 'mg' },
    })
    expect(r.ok).toBe(false)
  })

  it('una llave extra en el hecho tampoco pasa', () => {
    const r = parsearHecho({ ...HECHO_CANTIDAD, unidad: 'mg/dL' })
    expect(r.ok).toBe(false)
  })

  it('un NÚMERO disfrazado de texto NO valida (la fuga que vaciaba la aceptación)', () => {
    const r = parsearHecho({ ...HECHO_TEXTO, valor: { clase: 'texto', texto: '135' } })
    expect(r.ok).toBe(false)
  })

  it('un número con coma decimal mexicana disfrazado de texto tampoco valida', () => {
    const r = parsearHecho({ ...HECHO_TEXTO, valor: { clase: 'texto', texto: '1,2' } })
    expect(r.ok).toBe(false)
  })

  it('"120/80" SÍ valida: es texto de verdad, no un número', () => {
    const r = parsearHecho({ ...HECHO_TEXTO, valor: { clase: 'texto', texto: '120/80' } })
    expect(r.ok).toBe(true)
  })

  it('un texto vacío no valida', () => {
    const r = parsearHecho({ ...HECHO_TEXTO, valor: { clase: 'texto', texto: '' } })
    expect(r.ok).toBe(false)
  })

  it('parsearHecho NUNCA rellena un campo ausente con un default', () => {
    const r = parsearHecho(sin(HECHO_CANTIDAD, 'certeza'))
    expect(r.ok).toBe(false)
    // y cuando SÍ valida, no aparecen campos que no venían
    const ok = parsearHecho(HECHO_TEXTO)
    expect(ok.ok).toBe(true)
    if (ok.ok) {
      expect(ok.hecho.validFrom).toBeUndefined()
      expect(ok.hecho.validTo).toBeUndefined()
      expect(ok.hecho.supersedes).toBeUndefined()
    }
  })

  it('parsearHecho no lanza nunca, ni con basura', () => {
    for (const basura of [null, undefined, 0, '', [], 'hola', { a: 1 }]) {
      expect(() => parsearHecho(basura)).not.toThrow()
      expect(parsearHecho(basura).ok).toBe(false)
    }
  })

  it('los errores traen la RUTA del campo, para arreglarlo en el origen', () => {
    const r = parsearHecho(sin(HECHO_CANTIDAD, 'procedencia'))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores.some((e) => e.startsWith('procedencia'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 3. IDA Y VUELTA A FIRESTORE
// ---------------------------------------------------------------------------

describe('E1-01 · ida y vuelta por JSON (Firestore)', () => {
  it('un hecho validado vuelve a validar tras serializar y deserializar', () => {
    for (const h of HECHOS_VALIDOS) {
      const r = parsearHecho(h)
      expect(r.ok).toBe(true)
      if (!r.ok) continue
      const vuelta = JSON.parse(JSON.stringify(r.hecho))
      expect(parsearHecho(vuelta).ok, `${r.hecho.id} no sobrevivió el viaje`).toBe(true)
    }
  })

  it('la cantidad conserva valor + unidad + dimensión (la marca es FANTASMA, no existe en runtime)', () => {
    const r = parsearHecho(HECHO_CANTIDAD)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const vuelta = JSON.parse(JSON.stringify(r.hecho))
    expect(vuelta.valor.cantidad).toEqual({ valor: 1.2, unidad: 'mg/dL', dimension: 'concentracion_masa' })
    expect(Object.keys(vuelta.valor.cantidad).sort()).toEqual(['dimension', 'unidad', 'valor'])
  })

  it('la cantidad construida es operable con la API tipada de E0-04', () => {
    const r = parsearHecho(HECHO_CANTIDAD)
    expect(r.ok).toBe(true)
    if (!r.ok || r.hecho.valor.clase !== 'cantidad') return
    const q = r.hecho.valor.cantidad
    expect(q.dimension).toBe('concentracion_masa')
    if (q.dimension === 'concentracion_masa') expect(valorEn(q, 'mg/L')).toBeCloseTo(12, 10)
  })

  it('el esquema exportado y parsearHecho coinciden', () => {
    expect(ClinicalFactSchema.safeParse(HECHO_CODIGO).success).toBe(true)
    expect(ClinicalFactSchema.safeParse(sin(HECHO_CODIGO, 'procedencia')).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 4. parsearCantidad — la puerta de entrada de datos `unknown`
// ---------------------------------------------------------------------------

describe('E1-01 · parsearCantidad', () => {
  it('construye cuando la unidad pertenece a la dimensión declarada', () => {
    const q = parsearCantidad(500, 'mg', 'masa')
    expect(q).not.toBeNull()
    expect(q?.unidad).toBe('mg')
    expect(q?.dimension).toBe('masa')
  })

  it('acepta el número con coma decimal mexicana (usa num(), la fuente única)', () => {
    expect(parsearCantidad('1,2', 'mg/dL', 'concentracion_masa')?.valor).toBe(1.2)
  })

  it('devuelve null —nunca 0— si el valor no es un número finito', () => {
    for (const v of [null, undefined, '', '  ', 'abc', NaN, Infinity, {}]) {
      expect(parsearCantidad(v, 'mg', 'masa')).toBeNull()
    }
  })

  it('devuelve null si la unidad no pertenece a ESA dimensión', () => {
    expect(parsearCantidad(5, 'mL', 'masa')).toBeNull()
    expect(parsearCantidad(80, 'mL/min', 'depuracion_indexada')).toBeNull()
    expect(parsearCantidad(80, 'mL/min/1.73m²', 'depuracion')).toBeNull()
  })

  it('devuelve null si la dimensión no existe en el catálogo', () => {
    expect(parsearCantidad(37, '°C', 'temperatura')).toBeNull()
    expect(parsearCantidad(5, 'mg', 'masita')).toBeNull()
  })

  it('NUNCA infiere la dimensión a partir de la unidad', () => {
    // 'mg' es masa, pero si el productor declara otra cosa, se rechaza en vez de
    // "corregir" en silencio: adivinar es el bug que E0-04 existe para impedir.
    expect(parsearCantidad(5, 'mg', 'volumen')).toBeNull()
    expect(parsearCantidad(5, 'mg', undefined)).toBeNull()
    expect(parsearCantidad(5, 'mg', null)).toBeNull()
  })

  it('rechaza llaves heredadas del prototipo como dimensión o unidad', () => {
    expect(parsearCantidad(5, 'mg', 'constructor')).toBeNull()
    expect(parsearCantidad(5, 'toString', 'masa')).toBeNull()
  })

  it('acepta TODAS las unidades del catálogo de E0-04 (barrido, no muestra)', () => {
    for (const dim of Object.keys(FACTORES) as Dimension[]) {
      for (const u of Object.keys(FACTORES[dim])) {
        expect(parsearCantidad(1, u, dim), `${u} de ${dim}`).not.toBeNull()
      }
    }
  })
})

// ---------------------------------------------------------------------------
// 5. esUsableParaCalculo
// ---------------------------------------------------------------------------

describe('E1-01 · esUsableParaCalculo', () => {
  const valor = { clase: 'texto', texto: 'x' } as const

  it('sólo confirmed e inferred alimentan un motor (política copiada de uci.ts)', () => {
    expect(esUsableParaCalculo({ estado: 'final', certeza: 'confirmed', valor })).toBe(true)
    expect(esUsableParaCalculo({ estado: 'final', certeza: 'inferred', valor })).toBe(true)
  })

  it('lo no confirmado NO alimenta un motor', () => {
    for (const certeza of ['unknown', 'suspected', 'negated', 'conflicting', 'historical'] as const) {
      expect(esUsableParaCalculo({ estado: 'final', certeza, valor }), certeza).toBe(false)
    }
  })

  it('un registro ANULADO nunca alimenta un motor, por confirmado que esté', () => {
    expect(esUsableParaCalculo({ estado: 'anulado', certeza: 'confirmed', valor })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 6. GUARDIÁN DE COBERTURA — el hueco medido, para que no crezca en silencio
// ---------------------------------------------------------------------------

/**
 * EL HUECO DE UNIDADES, CONGELADO — pasó de 5 a 29 con REG-453.
 *
 * Son las unidades que aparecen en `ANALITOS` y que el motor de cantidades
 * todavía no sabe expresar. La lista es EXACTA a propósito: un «≤» dejaría
 * entrar una unidad nueva sin que nadie lo decidiera.
 *
 * Nótese `10^3/µL` y `10³/µL`: la misma unidad escrita de dos maneras, porque el
 * documento del dueño usa el circunflejo y los analitos de producción el
 * superíndice. `claveDeUnidad` ya las trata como iguales al validar; aquí
 * aparecen las dos porque esto mira la cadena literal.
 */
const UNIDADES_SIN_DIMENSION_HOY: readonly string[] = [
  '/100 WBC',
  '10^3/µL',
  '10^6/µL',
  '10³/µL',
  'IU/L',
  'IU/mL',
  'U/L',
  'cm H2O',
  'copias/mL',
  'células/µL',
  'fL',
  'log10 copias/mL',
  'mIU/mL',
  'mOsm/kg',
  'mg/24 h',
  'mg/g',
  'mm/h',
  'ng/L',
  'ng/dL',
  'ng/mL',
  'ng/mL FEU',
  'pH',
  'pg',
  'pg/mL',
  'ratio',
  'µIU/mL',
  'µUI/mL',
  'µg/dL',
  'índice ODI',
]

describe('E1-01 · guardián del hueco de cobertura de unidades', () => {
  /**
   * E1-01 NO amplía el catálogo de E0-04 (ampliarlo toca un guardián deliberado
   * de esa unidad y no lo exige esta aceptación). Este bloque FIJA qué unidades
   * del repo hoy NO son expresables, para que el hueco no se olvide ni crezca.
   * Está declarado como NEEDS_CLINICAL_REVIEW y es prerrequisito de E1-03.
   */
  const unidadEsExpresable = (u: string) =>
    (Object.keys(FACTORES) as Dimension[]).some((d) => Object.keys(FACTORES[d]).includes(u))

  it('las unidades de SignosVitales que HOY faltan siguen siendo exactamente éstas', () => {
    // Fuente: src/types/expediente.ts → SignosVitales (comentarios de unidad).
    const deSignos = ['lpm', 'rpm', '°C', 'cm', 'kg/m²', 'puntos', '%', 'kg', 'mg/dL']
    const faltantes = deSignos.filter((u) => !unidadEsExpresable(u))
    expect(faltantes.sort()).toEqual(['cm', 'kg/m²', 'lpm', 'puntos', 'rpm', '°C'])
  })

  it('las unidades de ANALITOS que HOY faltan siguen siendo exactamente éstas', () => {
    /**
     * EL HUECO CRECIÓ, Y ESO ES LO QUE ESTE GUARDIÁN EXISTE PARA QUE SE VEA.
     *
     * REG-450 metió ocho analitos del catálogo del dueño (D-032) y con ellos dos
     * unidades que el motor de cantidades todavía no sabe expresar: `fL` (VCM) y
     * `ng/mL` (ferritina, vitamina D). No se «arregló» ampliando `FACTORES` de
     * paso: ampliarlo toca un guardián deliberado de otra unidad de trabajo, y
     * hacerlo de refilón es cómo un hueco declarado se convierte en uno oculto.
     *
     * Sigue siendo prerrequisito de E1-03, ahora con cinco unidades en vez de tres.
     */
    const faltantes = [...new Set(ANALITOS.map((a) => a.unidad))].filter((u) => !unidadEsExpresable(u))
    /**
     * REG-453: el hueco pasó de 5 a 29 de golpe porque entró el catálogo ENTERO
     * del médico dueño (220 analitos, 41 unidades distintas). No se «arregló»
     * ampliando `FACTORES` de paso: ampliarlo toca un guardián deliberado de otra
     * unidad de trabajo, y hacerlo de refilón es cómo un hueco declarado se
     * vuelve uno oculto.
     *
     * Lo que este guardián protege sigue en pie: la lista es EXACTA, así que si
     * mañana entra una unidad nueva sin que nadie lo decida, esto se pone rojo.
     */
    expect(faltantes.sort()).toEqual(UNIDADES_SIN_DIMENSION_HOY)
  })

  it('el comportamiento seguro está garantizado: lo no expresable FALLA, no se degrada', () => {
    // Ni como cantidad (no hay dimensión) ni colándose como texto (R-9).
    expect(parsearCantidad(72, 'lpm', 'frecuencia')).toBeNull()
    const comoTexto = parsearHecho({ ...HECHO_TEXTO, valor: { clase: 'texto', texto: '72' } })
    expect(comoTexto.ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 7. Semántica de corrección y vigencia (reusadas, no reinventadas)
// ---------------------------------------------------------------------------

describe('E1-01 · corrección y vigencia', () => {
  it('supersedes usa el vocabulario ya decidido en hospital.ts', () => {
    for (const efecto of ['anula', 'sustituye', 'aclara']) {
      const r = parsearHecho({ ...HECHO_CORREGIDO, supersedes: { factId: 'f1', efecto } })
      expect(r.ok, efecto).toBe(true)
    }
    expect(parsearHecho({ ...HECHO_CORREGIDO, supersedes: { factId: 'f1', efecto: 'borra' } }).ok).toBe(false)
  })

  it('supersedes sin factId no valida (una corrección que no apunta a nada no corrige)', () => {
    expect(parsearHecho({ ...HECHO_CORREGIDO, supersedes: { efecto: 'sustituye' } }).ok).toBe(false)
  })

  it('validFrom/validTo son opcionales pero deben ser fechas ISO si vienen', () => {
    expect(parsearHecho(HECHO_CON_VIGENCIA).ok).toBe(true)
    expect(parsearHecho({ ...HECHO_CON_VIGENCIA, validTo: 'el martes' }).ok).toBe(false)
  })

  it('observedAt y procedencia.registradoEn son campos DISTINTOS (bitemporalidad)', () => {
    const r = parsearHecho(HECHO_CANTIDAD)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.hecho.observedAt).not.toBe(r.hecho.procedencia.registradoEn)
  })
})
