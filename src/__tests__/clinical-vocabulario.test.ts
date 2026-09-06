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
  PROCEDENCIA_CONGELADA,
  PROCEDENCIA_SINONIMO,
  SENTIDOS_NO_CATALOGADOS,
  SINONIMOS_PROPUESTOS_PENDIENTES,
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
import { ANALITOS, analitoDe } from '@/lib/expediente/laboratorio/analitos'
import { extraerSignosVitales } from '@/lib/expediente/parser-clinico'
import {
  CASOS_FILTRO_DOMINIO,
  CATALOGO_CON_COLISION,
  FALSOS_POSITIVOS_MEDIDOS,
  TERMINOS_ACEPTACION,
  TERMINOS_DESCONOCIDOS,
  TERMINOS_RETIRADOS_SIN_FUENTE,
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

  it('ninguno resuelve al concepto EQUIVOCADO, que es lo que importa', () => {
    /**
     * ── LA PREMISA CAMBIÓ, Y A MEJOR (REG-556) ──────────────────────────────
     *
     * Antes esto exigía `desconocido` para los cinco, porque ninguno tenía
     * concepto propio: la única salida honesta era no resolver.
     *
     * «Vitamina B12» ya lo tiene —entró con el catálogo del dueño (§6)— y ahora
     * resuelve a `vitaminaB12`. Eso NO es el falso positivo que este bloque
     * vigila: el peligro medido era que cayera en `bilirrubinaTotal` por las dos
     * letras del final. Sigue sin caer ahí.
     *
     * Así que lo que se exige es lo que siempre se quiso exigir: o desconocido,
     * o su propio concepto. Nunca el ajeno. Endurecer esto a «desconocido
     * siempre» convertiría el crecimiento del catálogo en un fallo.
     */
    for (const { termino, noDebeResolverA } of FALSOS_POSITIVOS_MEDIDOS) {
      const r = resolverConcepto(termino)
      expect(['desconocido', 'resuelto', 'ambiguo'], termino).toContain(r.estado)
      if (r.estado === 'resuelto') expect(r.concepto.clave, termino).not.toBe(noDebeResolverA)
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

  it('YA NO hay ningún concepto de laboratorio fuera de ANALITOS', () => {
    /**
     * `creatinina_orina` era el único, y existía porque `analitos.ts` no tenía
     * la creatinina urinaria: se le dio identidad aquí para que la aceptación de
     * E1-02 no se pudiera «cumplir» colapsando orina y suero.
     *
     * REG-556 cargó el catálogo del médico dueño, que SÍ la trae (§20), y reusó
     * esta misma clave en vez de crear una segunda. Así que el vocabulario ya no
     * inventa conceptos: todos salen de ANALITOS. Una fuente, no dos.
     */
    const clavesAnalitos = new Set(ANALITOS.map(a => a.clave))
    const extras = CONCEPTOS_LAB.map(c => c.clave).filter(k => !clavesAnalitos.has(k))
    expect(extras).toEqual([])
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

  it('el filtro de dominio desemboca en resuelto SÓLO si deja exactamente uno', () => {
    const rv = crearResolvedor(CATALOGO_CON_COLISION, {})
    const r = rv.resolver('xx', { dominio: 'signo-vital' })
    expect(r.estado).toBe('resuelto')
    if (r.estado === 'resuelto') expect(r.concepto.clave).toBe('concepto_vital_ficticio')

    // Un dominio que no deja NINGÚN candidato no inventa ni devuelve el otro:
    // `desconocido`. (Antes de cerrar V-3 esta rama devolvía `ambiguo`, lo que
    // hacía creer al consumidor que el término existía en ese dominio.)
    expect(rv.resolver('xx', { dominio: 'diagnostico' }).estado).toBe('desconocido')
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
// T-10 · PROCEDENCIA: la frase «aquí no se inventó ningún sinónimo» se vuelve
//        FALSABLE POR MÁQUINA. Es el invariante que faltaba (hallazgo V-1: se
//        habían colado 'hb' y 'bt' mientras el archivo afirmaba lo contrario).
// ---------------------------------------------------------------------------

/**
 * Oráculo 2b — los `display` LOINC que HOY están en producción, cosechados del
 * archivo real por código. Se ata el display AL CÓDIGO, no al concepto: así
 * «sistolica» sólo puede justificarse con el display del 8480-6 y no con
 * cualquier otro. Si mañana `recursos.ts` renombra un display, esto cambia.
 */
const DISPLAY_POR_CODIGO_LOINC: Record<string, string> = (() => {
  const fuente = readFileSync(join(process.cwd(), 'src/lib/fhir/recursos.ts'), 'utf8')
  const out: Record<string, string> = {}
  for (const m of fuente.matchAll(/code:\s*'([0-9]+-[0-9])'\s*,\s*display:\s*'([^']+)'/g)) {
    out[m[1]] = m[2]
  }
  return out
})()

/**
 * Oráculo 4 — campo del parser de producción que corresponde a cada signo vital,
 * con un valor sintético plausible para que el patrón (que exige número pegado al
 * término) pueda casar. `imc`, `glucometria` y las dos de TA NO tienen campo
 * numérico propio en el parser: para ellas este oráculo no existe y punto.
 */
const CAMPO_PARSER_VITAL: Record<string, { campo: 'fc' | 'fr' | 'temperatura' | 'spo2' | 'peso' | 'talla'; valor: number }> = {
  fc: { campo: 'fc', valor: 80 },
  fr: { campo: 'fr', valor: 18 },
  temperatura: { campo: 'temperatura', valor: 37 },
  spo2: { campo: 'spo2', valor: 95 },
  peso: { campo: 'peso', valor: 72 },
  talla: { campo: 'talla', valor: 170 },
}

/** Justificación de UN sinónimo, o `null` si ningún oráculo lo respalda. */
function procedenciaDe(c: ConceptoCanonico, s: string): string | null {
  // 1 · autorreferencia: no es un mapeo nuevo, es el nombre del propio concepto.
  if (s === normalizarTermino(c.clave)) return 'clave'
  if (s === normalizarTermino(c.clave.replace(/_/g, ' '))) return 'clave (con _ como espacio)'

  // 2 · etiqueta del concepto (para laboratorio, T-6 ya la ata a ANALITOS).
  if (s === normalizarTermino(c.etiqueta)) return 'etiqueta'

  // 2b · `display` LOINC en producción, atado al código que declara el concepto.
  for (const cod of c.codigos) {
    const display = DISPLAY_POR_CODIGO_LOINC[cod.codigo]
    if (display && normalizarTermino(display) === s) return `display LOINC ${cod.codigo} en recursos.ts`
  }

  /**
   * 3 · oráculo de laboratorio: producción YA hace ese mapeo.
   *
   * Se le pasa la UNIDAD del propio concepto (REG-553). Desde que el diferencial
   * leucocitario se desambigua por unidad (§25.2 de D-032), `analitoDe('neutrofilos')`
   * a secas devuelve `null` a propósito — y sin la unidad este oráculo declararía
   * huérfano un sinónimo que producción sí resuelve. Sigue exigiendo la clave
   * EXACTA: preguntar con la unidad no afloja nada, sólo pregunta bien.
   */
  if (c.dominio === 'laboratorio' && analitoDe(s, c.unidadConvencional)?.clave === c.clave) return 'analitoDe()'

  // 4 · oráculo de signos vitales. Se exige el campo ESPERADO y que no se llene
  //     ningún otro: una confirmación por casualidad no cuenta como fuente.
  const esperado = CAMPO_PARSER_VITAL[c.clave]
  if (c.dominio === 'signo-vital' && esperado) {
    const sv = extraerSignosVitales(`${s} ${esperado.valor}`)
    const otrosLlenos = (['fc', 'fr', 'temperatura', 'spo2', 'peso', 'talla'] as const)
      .filter(k => k !== esperado.campo && sv[k] !== null)
    if (sv[esperado.campo] === esperado.valor && otrosLlenos.length === 0 && sv.ta === '') {
      return 'extraerSignosVitales()'
    }
  }

  // 5 · cita explícita, con fuente no vacía y atada a ESTE concepto.
  const cita = PROCEDENCIA_SINONIMO[s]
  if (cita && cita.clave === c.clave && cita.fuente.trim().length > 0) return `cita: ${cita.fuente}`

  return null
}

describe('T-10 · todo sinónimo tiene procedencia comprobable (cierra V-1)', () => {
  it('NINGÚN sinónimo del catálogo carece de fuente', () => {
    const huerfanos: string[] = []
    for (const c of CONCEPTOS) {
      for (const s of c.sinonimos) {
        if (!procedenciaDe(c, s)) huerfanos.push(`«${s}» (declarado en '${c.clave}')`)
      }
    }
    // Si este test se pone rojo hay exactamente dos salidas honestas: retirar el
    // sinónimo, o citarlo en PROCEDENCIA_SINONIMO con su archivo:línea. Inventar
    // una fuente es la falla más grave posible en este repo.
    expect(huerfanos, `sinónimos sin fuente: ${huerfanos.join(' · ')}`).toEqual([])
  })

  it('las abreviaturas que la verificación pilló inventadas NO están de vuelta', () => {
    // 'hb' y 'bt' no existen en ningún patrón de ANALITOS ni en el resto de src.
    // Control positivo del invariante: si alguien las reintroduce, el test de
    // arriba las delata — aquí se fija además que hoy no resuelven.
    expect(analitoDe('hb')).toBeNull()
    expect(analitoDe('bt')).toBeNull()
    expect(resolverConcepto('hb').estado).toBe('desconocido')
    expect(resolverConcepto('bt').estado).toBe('desconocido')
  })

  it('el trinquete de citas está congelado y ninguna cita está huérfana', () => {
    expect(Object.keys(PROCEDENCIA_SINONIMO).length).toBe(PROCEDENCIA_CONGELADA)
    for (const [termino, p] of Object.entries(PROCEDENCIA_SINONIMO)) {
      expect(termino, 'la llave debe estar ya normalizada').toBe(normalizarTermino(termino))
      expect(p.fuente.trim().length, `la cita de «${termino}» no puede venir vacía`).toBeGreaterThan(0)
      const c = conceptoPorClave(p.clave)
      expect(c, `la cita de «${termino}» apunta a una clave inexistente: ${p.clave}`).not.toBeNull()
      expect(c?.sinonimos, `«${termino}» está citado pero no es sinónimo de ${p.clave}`).toContain(termino)
    }
  })

  it('los oráculos que sostienen el invariante EXISTEN de verdad', () => {
    // Guardián del propio test: si `analitoDe` dejara de reconocer nada, T-10
    // pasaría en verde sin probar nada. Se fija que los tres oráculos responden.
    expect(analitoDe('creatinina')?.clave).toBe('creatinina')
    expect(extraerSignosVitales('fc 80').fc).toBe(80)
    expect(Object.keys(DISPLAY_POR_CODIGO_LOINC).length).toBeGreaterThanOrEqual(10)
    expect(DISPLAY_POR_CODIGO_LOINC['8480-6']).toBe('Sistólica')
  })

  it('E1-02-H2: una cara REPARADA por REG-556, la otra sigue registrada', () => {
    /**
     * El hallazgo tenía dos caras y hoy están en sitios distintos. Decirlo
     * entero importa: un hallazgo «medio cerrado» que se anota como cerrado es
     * como no haberlo anotado.
     *
     * ── REPARADA ──────────────────────────────────────────────────────────────
     * «creatinina urinaria» caía en la serie de creatinina SÉRICA. La exclusión
     * del patrón sólo miraba la palabra «orina» y no cubría «urinaria»: una
     * defensa escrita analito por analito, con un hueco.
     *
     * REG-556 la cerró de raíz. La muestra se decide UNA vez, sobre el nombre
     * del renglón, y un renglón de orina sólo puede casar con analitos de orina.
     * Y no hizo falta una clave nueva: el catálogo del dueño trae la creatinina
     * urinaria y reusa la que el vocabulario ya tenía.
     *
     * ── SIGUE ABIERTA ────────────────────────────────────────────────────────
     * «depuración de creatinina» es una alternativa del patrón de `tfg`, pero el
     * patrón de `creatinina` gana por orden y manda la depuración a la serie de
     * creatinina sérica. Eso NO lo toca el espécimen —las dos son de suero— y
     * cambiar el orden de los patrones a mano es justo la clase de arreglo que
     * rompe otra cosa sin avisar. Sigue registrada, con su pregunta al médico.
     */
    expect(analitoDe('creatinina urinaria')?.clave, 'REPARADA por REG-556').toBe('creatinina_orina')
    expect(claveDe('creatinina urinaria')).toBe('creatinina_orina')

    expect(analitoDe('depuracion de creatinina')?.clave, 'sigue abierta').toBe('creatinina')
    expect(claveDe('depuración de creatinina')).toBe('tfg')
    expect(PROCEDENCIA_SINONIMO['depuracion de creatinina']?.needsClinicalReview).toContain('E1-02-H2')
  })
})

// ---------------------------------------------------------------------------
// T-11 · `dominio` es FILTRO ESTRICTO, no desempate silencioso (cierra V-3)
// ---------------------------------------------------------------------------

describe('T-11 · el filtro por dominio', () => {
  it.each([...CASOS_FILTRO_DOMINIO])('«$termino» con dominio $dominio → $esperado ($porQue)', ({ termino, dominio, esperado }) => {
    expect(resolverConcepto(termino, { dominio }).estado).toBe(esperado)
  })

  it('sin dominio, el comportamiento no cambia', () => {
    expect(claveDe('creatinina')).toBe('creatinina')
    expect(claveDe('fc')).toBe('fc')
  })

  it('pedir el dominio equivocado NUNCA devuelve el concepto del otro dominio', () => {
    for (const c of CONCEPTOS) {
      const otro = c.dominio === 'laboratorio' ? 'signo-vital' : 'laboratorio'
      const r = resolverConcepto(c.clave, { dominio: otro })
      expect(r.estado, `«${c.clave}» se colgó del dominio ${otro}`).not.toBe('resuelto')
    }
  })

  it('todo concepto resuelve pidiendo SU propio dominio', () => {
    for (const c of CONCEPTOS) {
      if (normalizarTermino(c.clave) in TERMINOS_RESERVADOS) continue
      expect(claveDe(c.clave, c.dominio), `«${c.clave}» no resuelve en su propio dominio`).toBe(c.clave)
    }
  })
})

// ---------------------------------------------------------------------------
// T-12 · Los candidatos de un término reservado son resolubles o declarados (V-4)
// ---------------------------------------------------------------------------

describe('T-12 · candidatos de términos reservados', () => {
  it('cada candidato es un concepto del catálogo o está declarado como NO catalogado', () => {
    const declarados = new Set(SENTIDOS_NO_CATALOGADOS.map(s => s.clave))
    for (const [termino, r] of Object.entries(TERMINOS_RESERVADOS)) {
      expect(r.candidatos.length, `«${termino}» reservado con menos de 2 sentidos`).toBeGreaterThanOrEqual(2)
      for (const k of r.candidatos) {
        const resoluble = conceptoPorClave(k) !== null
        expect(resoluble || declarados.has(k), `el candidato '${k}' de «${termino}» no existe ni está declarado`).toBe(true)
      }
    }
  })

  it('todo sentido declarado NO catalogado trae su porqué y de verdad no está en el catálogo', () => {
    for (const s of SENTIDOS_NO_CATALOGADOS) {
      expect(s.porQue).toContain('NEEDS_CLINICAL_REVIEW')
      expect(conceptoPorClave(s.clave), `'${s.clave}' se declara no catalogado pero SÍ está`).toBeNull()
    }
  })
})

// ---------------------------------------------------------------------------
// T-13 · Los términos sin fuente RETIRADOS no resuelven (Q6 / Q7)
// ---------------------------------------------------------------------------

describe('T-13 · lo retirado por falta de fuente devuelve `desconocido`', () => {
  it.each([...TERMINOS_RETIRADOS_SIN_FUENTE])('«%s» no resuelve', (termino) => {
    expect(resolverConcepto(termino).estado).toBe('desconocido')
  })

  it('ninguno está en el catálogo por otra vía (ni como clave, ni como sinónimo)', () => {
    for (const p of SINONIMOS_PROPUESTOS_PENDIENTES) {
      expect(clavesQueDeclaran(p.termino), `«${p.termino}» sigue indexado`).toEqual([])
    }
  })

  it('la propuesta NO se pierde: cada término pendiente dice a dónde iría y qué falta', () => {
    expect(SINONIMOS_PROPUESTOS_PENDIENTES.length).toBeGreaterThan(0)
    for (const p of SINONIMOS_PROPUESTOS_PENDIENTES) {
      expect(p.termino).toBe(normalizarTermino(p.termino))
      expect(conceptoPorClave(p.claveSugerida), `la clave sugerida de «${p.termino}» no existe`).not.toBeNull()
      expect(['Q6', 'Q7']).toContain(p.pregunta)
      expect(p.porQueNoEntra.length).toBeGreaterThan(20)
    }
  })

  it('y el concepto al que se propusieron sigue resolviendo por su nombre canónico', () => {
    // La retirada no puede dejar un concepto huérfano de todo término.
    expect(claveDe('glucometria')).toBe('glucometria')
    expect(claveDe('imc')).toBe('imc')
  })
})

// ---------------------------------------------------------------------------
// Metadatos de la unidad
// ---------------------------------------------------------------------------

describe('metadatos del vocabulario', () => {
  it('declara su versión', () => {
    // 1.1.0: el CONTENIDO del catálogo cambió (3 sinónimos retirados) y la
    // semántica de `dominio` también. Una versión que no se mueve al cambiar el
    // catálogo es una mentira barata; se mueve con él.
    expect(VOCABULARIO_VERSION).toBe('1.1.0')
  })

  it('el dominio `diagnostico` no tiene entradas propias: lib/cie10.ts ya es el catálogo', () => {
    expect(CONCEPTOS.filter(c => c.dominio === 'diagnostico')).toEqual([])
  })
})
