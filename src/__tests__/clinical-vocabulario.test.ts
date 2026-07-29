/**
 * E1-02 — Vocabulario de conceptos clínicos.
 *
 * ACEPTACIÓN DEL BACKLOG (literal): «'creatinina', 'Cr' y 'creatinina sérica'
 * resuelven al mismo concepto».
 *
 * Esa frase tiene dos anticumplimientos triviales, y los dos están cubiertos:
 *  - colapsar todo lo que contenga «creatinina» (mandaría la de orina a la misma
 *    serie) → T-2;
 *  - añadir `cr` al regex actual (haría que «proteína C reactiva» entre a la
 *    serie de creatinina) → T-3.
 *
 * Datos 100% sintéticos. Sin PHI.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  CLAVES_SINONIMOS_DECLARADOS,
  CONCEPTOS,
  LAB_SIN_CODIGO_CONGELADO,
  LOINC_VITALES_ESPERADOS,
  TERMINOS_RESERVADOS,
  VOCABULARIO_VERSION,
  aConceptoRef,
  clavesQueDeclaran,
  conceptoPorClave,
  crearResolvedor,
  normalizarTermino,
  resolverConcepto,
  type ConceptoCanonico,
} from '@/lib/clinical-fact/vocabulario'
import { ConceptoRefSchema } from '@/lib/clinical-fact/schema'
import { ANALITOS } from '@/lib/expediente/laboratorio/analitos'
import {
  CATALOGO_CON_COLISION,
  FALSOS_POSITIVOS_MEDIDOS,
  TERMINOS_ACEPTACION,
  TERMINOS_DESCONOCIDOS,
} from './fixtures/conceptos'

/** Helper: la clave resuelta, o null si no resolvió. */
function claveDe(termino: string, dominio?: 'laboratorio' | 'signo-vital' | 'diagnostico'): string | null {
  const r = resolverConcepto(termino, dominio ? { dominio } : undefined)
  return r.estado === 'resuelto' ? r.concepto.clave : null
}

const CONCEPTOS_LAB = CONCEPTOS.filter(c => c.dominio === 'laboratorio')
const CONCEPTOS_VITALES = CONCEPTOS.filter(c => c.dominio === 'signo-vital')

// ---------------------------------------------------------------------------
// T-1 · La aceptación literal
// ---------------------------------------------------------------------------

describe('T-1 · aceptación: creatinina / Cr / creatinina sérica → el MISMO concepto', () => {
  it('las tres cadenas del backlog resuelven a la misma clave', () => {
    expect(claveDe('creatinina')).toBe('creatinina')
    expect(claveDe('Cr')).toBe('creatinina')
    expect(claveDe('creatinina sérica')).toBe('creatinina')
  })

  it('y sus variantes de normalización también (mayúsculas, acentos, espacios)', () => {
    const claves = TERMINOS_ACEPTACION.map(t => claveDe(t))
    expect(claves).toEqual(TERMINOS_ACEPTACION.map(() => 'creatinina'))
  })

  it('normalizarTermino colapsa mayúsculas, diacríticos y espacios', () => {
    expect(normalizarTermino('  Creatinina   Sérica ')).toBe('creatinina serica')
    expect(normalizarTermino('CR')).toBe('cr')
  })

  it('el concepto resuelto es el mismo OBJETO, no una copia parecida', () => {
    const a = resolverConcepto('Cr')
    const b = resolverConcepto('creatinina sérica')
    expect(a.estado).toBe('resuelto')
    expect(b.estado).toBe('resuelto')
    if (a.estado === 'resuelto' && b.estado === 'resuelto') {
      expect(a.concepto).toBe(b.concepto)
      expect(a.concepto).toBe(conceptoPorClave('creatinina'))
    }
  })
})

// ---------------------------------------------------------------------------
// T-2 · Anticumplimiento: la aceptación NO vale colapsando el espécimen
// ---------------------------------------------------------------------------

describe('T-2 · «creatinina en orina» es un concepto DISTINTO', () => {
  it('no cae en la serie de creatinina sérica', () => {
    expect(claveDe('creatinina en orina')).toBe('creatinina_orina')
    expect(claveDe('creatinina urinaria')).toBe('creatinina_orina')
    expect(claveDe('creatinina en orina')).not.toBe('creatinina')
  })

  it('los dos conceptos no comparten ni un solo sinónimo', () => {
    const suero = conceptoPorClave('creatinina')
    const orina = conceptoPorClave('creatinina_orina')
    expect(suero).not.toBeNull()
    expect(orina).not.toBeNull()
    const compartidos = (suero?.sinonimos ?? []).filter(s => (orina?.sinonimos ?? []).includes(s))
    expect(compartidos).toEqual([])
  })

  it('el espécimen queda EXPLÍCITO, no implícito (NEEDS_CLINICAL_REVIEW Q4)', () => {
    expect(conceptoPorClave('creatinina')?.especimen).toBe('suero')
    expect(conceptoPorClave('creatinina_orina')?.especimen).toBe('orina')
  })
})

// ---------------------------------------------------------------------------
// T-3 · Los falsos positivos MEDIDOS del casado por subcadena
// ---------------------------------------------------------------------------

describe('T-3 · casado por término COMPLETO: los falsos positivos medidos no ocurren', () => {
  // Medido contra producción: analitoDe('vitamina K') → potasio, y
  // valorPlausible('potasio', 10) → true, así que el punto entra a la gráfica.
  // Ver hallazgo E1-02-H1. Aquí se fija que el módulo nuevo NO lo hereda.
  it.each([...FALSOS_POSITIVOS_MEDIDOS])('«$termino» no resuelve a $noDebeResolverA', ({ termino, noDebeResolverA }) => {
    expect(claveDe(termino)).not.toBe(noDebeResolverA)
  })

  it('todos ellos quedan como `desconocido`, no como otra cosa', () => {
    for (const { termino } of FALSOS_POSITIVOS_MEDIDOS) {
      const r = resolverConcepto(termino)
      expect(r.estado).toBe('desconocido')
    }
  })

  it('un término vacío o desconocido no inventa concepto', () => {
    for (const t of TERMINOS_DESCONOCIDOS) {
      expect(resolverConcepto(t).estado).toBe('desconocido')
    }
  })

  it('la resolución NO extrae de prosa (precio declarado del diseño)', () => {
    // «creatinina» está dentro de la frase, pero la frase no ES el término.
    expect(resolverConcepto('se solicita creatinina de control').estado).toBe('desconocido')
  })
})

// ---------------------------------------------------------------------------
// T-4 · Invariante de unicidad sobre TODO el catálogo
// ---------------------------------------------------------------------------

describe('T-4 · invariante de unicidad del catálogo', () => {
  it('ninguna clave se repite', () => {
    const claves = CONCEPTOS.map(c => c.clave)
    expect(new Set(claves).size).toBe(claves.length)
  })

  it('ningún sinónimo pertenece a dos conceptos (salvo términos reservados)', () => {
    const colisiones: string[] = []
    for (const c of CONCEPTOS) {
      for (const s of [c.clave, ...c.sinonimos]) {
        const t = normalizarTermino(s)
        if (TERMINOS_RESERVADOS[t]) continue
        if (clavesQueDeclaran(t).length > 1) colisiones.push(`${t} → ${clavesQueDeclaran(t).join(', ')}`)
      }
    }
    expect(colisiones).toEqual([])
  })

  it('ninguna clave aparece como sinónimo de OTRO concepto', () => {
    const porTermino = new Map(CONCEPTOS.map(c => [normalizarTermino(c.clave), c.clave]))
    const intrusos: string[] = []
    for (const c of CONCEPTOS) {
      for (const s of c.sinonimos) {
        const dueno = porTermino.get(normalizarTermino(s))
        if (dueno && dueno !== c.clave) intrusos.push(`${s} (de ${dueno}) declarado en ${c.clave}`)
      }
    }
    expect(intrusos).toEqual([])
  })

  it('todo sinónimo está YA normalizado (nada de acentos ni mayúsculas sueltas)', () => {
    const sinNormalizar = CONCEPTOS
      .flatMap(c => c.sinonimos.map(s => ({ clave: c.clave, s })))
      .filter(({ s }) => s !== normalizarTermino(s))
    expect(sinNormalizar).toEqual([])
  })

  it('ningún concepto se queda sin etiqueta ni sin sinónimos', () => {
    for (const c of CONCEPTOS) {
      expect(c.etiqueta.length).toBeGreaterThan(0)
      expect(c.sinonimos.length).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// T-5 · Trinquete de códigos — nadie «completa» el catálogo inventando LOINC
// ---------------------------------------------------------------------------

describe('T-5 · trinquete de códigos estándar (NEEDS_CLINICAL_REVIEW Q1)', () => {
  it('todo código declarado trae su fuente, no vacía', () => {
    for (const c of CONCEPTOS) {
      for (const cod of c.codigos) {
        expect(cod.codigo.trim().length).toBeGreaterThan(0)
        expect(cod.fuente.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('el número de conceptos de laboratorio SIN código es el congelado', () => {
    const sinCodigo = CONCEPTOS_LAB.filter(c => c.codigos.length === 0).length
    // Este número sólo puede BAJAR, y sólo cuando el médico dueño valide la
    // tabla concepto→LOINC. Si SUBE, alguien añadió un concepto sin código; si
    // baja sin actualizar la constante, alguien puso un LOINC sin validar.
    expect(sinCodigo).toBe(LAB_SIN_CODIGO_CONGELADO)
  })

  it('hoy NINGÚN analito de laboratorio tiene LOINC: no se inventó ninguno', () => {
    expect(CONCEPTOS_LAB.every(c => c.codigos.length === 0)).toBe(true)
    expect(CONCEPTOS_LAB.length).toBe(LAB_SIN_CODIGO_CONGELADO)
  })

  it('sólo se emiten sistemas que la licencia permite (LOINC / CIE-10, nunca SNOMED)', () => {
    const sistemas = new Set(CONCEPTOS.flatMap(c => c.codigos.map(k => k.sistema)))
    for (const s of sistemas) expect(['LOINC', 'CIE-10']).toContain(s)
  })
})

// ---------------------------------------------------------------------------
// T-6 · No-deriva con analitos.ts (la fuente de verdad en producción)
// ---------------------------------------------------------------------------

describe('T-6 · el vocabulario no se bifurca de ANALITOS', () => {
  it('toda clave de ANALITOS existe como concepto de laboratorio', () => {
    for (const a of ANALITOS) {
      const c = conceptoPorClave(a.clave)
      expect(c, `falta el concepto para la clave '${a.clave}' de ANALITOS`).not.toBeNull()
      expect(c?.dominio).toBe('laboratorio')
    }
  })

  it('la unidad convencional es IDÉNTICA a la de ANALITOS', () => {
    for (const a of ANALITOS) {
      expect(conceptoPorClave(a.clave)?.unidadConvencional).toBe(a.unidad)
    }
  })

  it('la etiqueta es IDÉNTICA a la de ANALITOS', () => {
    for (const a of ANALITOS) {
      expect(conceptoPorClave(a.clave)?.etiqueta).toBe(a.etiqueta)
    }
  })

  it('el único concepto de laboratorio que NO viene de ANALITOS es creatinina_orina', () => {
    const clavesAnalitos = new Set(ANALITOS.map(a => a.clave))
    const extras = CONCEPTOS_LAB.map(c => c.clave).filter(k => !clavesAnalitos.has(k))
    expect(extras).toEqual(['creatinina_orina'])
  })

  it('ningún analito se quedó con sinónimos por defecto (obliga a declararlos)', () => {
    // Si mañana entra un analito nuevo a producción, el catálogo cae al
    // respaldo `[clave]` y este test lo delata: hay que declarar sus sinónimos
    // a mano, derivados de su regex, no inventados.
    // Se comprueba la DECLARACIÓN, no la forma del valor: un analito cuyo único
    // término legítimo es su propia clave (p. ej. `hemoglobina`) está declarado
    // correctamente aunque su lista sea de un solo elemento.
    const sinDeclarar = ANALITOS
      .map(a => a.clave)
      .filter(k => !CLAVES_SINONIMOS_DECLARADOS.includes(k))
    expect(sinDeclarar).toEqual([])
  })

  it('cada analito resuelve por su propio nombre canónico', () => {
    for (const a of ANALITOS) {
      if (normalizarTermino(a.clave) in TERMINOS_RESERVADOS) continue
      expect(claveDe(a.clave)).toBe(a.clave)
    }
  })
})

// ---------------------------------------------------------------------------
// T-7 · Los LOINC de vitales están COPIADOS, no elegidos
// ---------------------------------------------------------------------------

describe('T-7 · anti-deriva contra los LOINC ya en producción', () => {
  const fuente = readFileSync(join(process.cwd(), 'src/lib/fhir/recursos.ts'), 'utf8')

  it('los 10 conceptos de signo vital declaran exactamente un LOINC', () => {
    expect(CONCEPTOS_VITALES.length).toBe(10)
    for (const c of CONCEPTOS_VITALES) {
      expect(c.codigos.length, `${c.clave} debe tener su LOINC`).toBe(1)
      expect(c.codigos[0].sistema).toBe('LOINC')
    }
  })

  it('cada código coincide con el mapa esperado', () => {
    for (const c of CONCEPTOS_VITALES) {
      expect(c.codigos[0].codigo).toBe(LOINC_VITALES_ESPERADOS[c.clave])
    }
    expect(Object.keys(LOINC_VITALES_ESPERADOS).sort()).toEqual(CONCEPTOS_VITALES.map(c => c.clave).sort())
  })

  it('y cada código sigue presente en lib/fhir/recursos.ts (la fuente real)', () => {
    for (const [clave, codigo] of Object.entries(LOINC_VITALES_ESPERADOS)) {
      expect(fuente, `el LOINC de ${clave} ya no está en recursos.ts`).toContain(`'${codigo}'`)
    }
  })

  it('la TA sigue siendo DOS conceptos, no uno', () => {
    expect(conceptoPorClave('ta_sistolica')).not.toBeNull()
    expect(conceptoPorClave('ta_diastolica')).not.toBeNull()
    expect(conceptoPorClave('ta')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-8 · Puente con E1-01
// ---------------------------------------------------------------------------

describe('T-8 · todo concepto produce un ConceptoRef válido para el grafo', () => {
  it('ConceptoRefSchema acepta TODOS los conceptos del catálogo', () => {
    for (const c of CONCEPTOS) {
      expect(() => ConceptoRefSchema.parse(aConceptoRef(c)), c.clave).not.toThrow()
    }
  })

  it('un concepto sin códigos produce un ref SIN la llave `codigo`', () => {
    const c = conceptoPorClave('creatinina') as ConceptoCanonico
    const ref = aConceptoRef(c)
    // No basta con `ref.codigo === undefined`: z.strictObject distingue la
    // llave presente-con-undefined de la llave ausente al viajar por JSON.
    expect('codigo' in ref).toBe(false)
    expect(ref.clave).toBe('creatinina')
    expect(ref.etiqueta).toBe('Creatinina')
  })

  it('un concepto con código lo emite con su sistema', () => {
    const c = conceptoPorClave('fc') as ConceptoCanonico
    const ref = aConceptoRef(c)
    expect(ref.codigo).toEqual({ sistema: 'LOINC', codigo: '8867-4' })
    expect(() => ConceptoRefSchema.parse(ref)).not.toThrow()
  })

  it('el ref sobrevive la ida y vuelta por JSON (Firestore)', () => {
    for (const c of CONCEPTOS) {
      const ida = JSON.parse(JSON.stringify(aConceptoRef(c)))
      expect(() => ConceptoRefSchema.parse(ida), c.clave).not.toThrow()
    }
  })
})

// ---------------------------------------------------------------------------
// T-9 · Ambigüedad, no adivinanza
// ---------------------------------------------------------------------------

describe('T-9 · ante dos lecturas no se elige (cortafuegos de uci/extraccion.ts)', () => {
  it('«PCR» es reservado → ambiguo con ≥2 candidatos, nunca resuelto', () => {
    const r = resolverConcepto('PCR')
    expect(r.estado).toBe('ambiguo')
    if (r.estado === 'ambiguo') {
      expect(r.candidatos.length).toBeGreaterThanOrEqual(2)
      expect(r.nota).toContain('NEEDS_CLINICAL_REVIEW')
    }
  })

  it('«PCR» sigue ambiguo AUNQUE se dé la pista de dominio (Q2 sin decidir)', () => {
    expect(resolverConcepto('PCR', { dominio: 'laboratorio' }).estado).toBe('ambiguo')
    expect(resolverConcepto('proteína C reactiva').estado).toBe('resuelto')
  })

  it('con DOS candidatos y sin pista de dominio, jamás devuelve resuelto', () => {
    const r = crearResolvedor(CATALOGO_CON_COLISION, {}).resolver('xx')
    expect(r.estado).toBe('ambiguo')
    if (r.estado === 'ambiguo') {
      expect([...r.candidatos].sort()).toEqual(['concepto_lab_ficticio', 'concepto_vital_ficticio'])
    }
  })

  it('la pista de dominio desempata SÓLO si deja exactamente uno', () => {
    const rv = crearResolvedor(CATALOGO_CON_COLISION, {})
    const r = rv.resolver('xx', { dominio: 'signo-vital' })
    expect(r.estado).toBe('resuelto')
    if (r.estado === 'resuelto') expect(r.concepto.clave).toBe('concepto_vital_ficticio')

    // Un dominio que no deja ninguno tampoco inventa: sigue ambiguo.
    expect(rv.resolver('xx', { dominio: 'diagnostico' }).estado).toBe('ambiguo')
  })

  it('un término sin colisión resuelve normalmente en el catálogo sintético', () => {
    const r = crearResolvedor(CATALOGO_CON_COLISION, {}).resolver('yy')
    expect(r.estado).toBe('resuelto')
  })

  it('en el catálogo REAL, todo lo que resuelve tiene exactamente un dueño', () => {
    for (const c of CONCEPTOS) {
      for (const s of [c.clave, ...c.sinonimos]) {
        if (resolverConcepto(s).estado !== 'resuelto') continue
        expect(clavesQueDeclaran(s).length, `«${s}» resolvió con más de un dueño`).toBe(1)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Metadatos de la unidad
// ---------------------------------------------------------------------------

describe('metadatos del vocabulario', () => {
  it('declara su versión', () => {
    expect(VOCABULARIO_VERSION).toBe('1.0.0')
  })

  it('el dominio `diagnostico` no tiene entradas propias: lib/cie10.ts ya es el catálogo', () => {
    expect(CONCEPTOS.filter(c => c.dominio === 'diagnostico')).toEqual([])
  })
})
