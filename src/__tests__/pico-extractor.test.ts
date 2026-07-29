import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  termino, pico, consultaDesdePICO, consultasDesdePICO, terminosDeFaceta,
  picoDesdeModelo, picoDesdeNota, picoDegradadoDesdeTexto,
  MAXIMO_PALABRAS_TERMINO, MAXIMO_TERMINOS_POR_FACETA, MAXIMO_CARACTERES_TERMINO,
  type TerminoPICO, type PICO, type Faceta,
} from '@/lib/evidencia/pico'
import type { NoVacio } from '@/types/evidence'

/**
 * E2-02 — Extractor PICO.
 *
 * REPARTO DE RESPONSABILIDADES, igual que en E2-01: la ACEPTACIÓN de la unidad
 * («la búsqueda se arma desde PICO, no desde el texto crudo») se prueba en DOS
 * sitios y por DOS mecanismos distintos:
 *   - src/__tests__/tipos/pico.tipos.ts → gate de `tsc` (no de vitest): una
 *     cadena no compila donde se exige un PICO.
 *   - este archivo → la mitad de RUNTIME (`picoDesdeModelo`), que es por donde
 *     entra de verdad el JSON del LLM, más el GUARDIÁN del gate del compilador.
 *
 * Todo con FIXTURES SINTÉTICOS: preguntas y notas ficticias escritas para el
 * test. Cero PHI, cero red, cero reloj.
 */

const raiz = process.cwd()
const leer = (p: string) => readFileSync(resolve(raiz, p), 'utf8')

/**
 * Los encabezados de este módulo DOCUMENTAN qué no se hace (`process.env`,
 * `CLINICAL_ENGINE_REGISTRY`…), así que los tests de pureza tienen que mirar el
 * CÓDIGO, no los comentarios: si no, la propia documentación tumbaría el test.
 */
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

// ---------------------------------------------------------------------------
// FIXTURES SINTÉTICOS
// ---------------------------------------------------------------------------

function t(faceta: Faceta, busqueda: string, sinonimos: readonly string[] = [], original = busqueda): TerminoPICO {
  const r = termino({ faceta, original, busqueda, sinonimos, origen: 'modelo' })
  if (!r.ok) throw new Error(`fixture inválido: ${r.motivo} ${r.detalle}`)
  return r.valor
}

/** PICO ficticio con las cuatro facetas pobladas. */
function picoCompleto(): PICO {
  return pico({
    poblacion: [t('P', 'uti', ['urinary tract infection'])],
    intervencion: [t('I', 'nitrofurantoin')],
    comparador: [t('C', 'placebo')],
    outcome: [t('O', 'recurrence')],
    preguntaOriginal: 'pregunta ficticia de prueba',
  })
}

// ---------------------------------------------------------------------------
// GUARDIÁN DEL GATE DEL COMPILADOR (patrón de evidence-model.test.ts)
// ---------------------------------------------------------------------------

describe('E2-02 · guardián del gate del compilador', () => {
  const rutaTipos = 'src/__tests__/tipos/pico.tipos.ts'
  const rutaPico = 'src/lib/evidencia/pico.ts'

  it('1. el archivo de casos negativos existe', () => {
    expect(
      existsSync(resolve(raiz, rutaTipos)),
      `${rutaTipos} es la mitad de compilación de la aceptación de E2-02: sin él nada prueba que una cadena NO pueda usarse como consulta`,
    ).toBe(true)
  })

  it('2. conserva al menos 6 @ts-expect-error ACTIVOS (no comentados)', () => {
    const activos = leer(rutaTipos)
      .split('\n')
      .filter(l => /^\s*\/\/\s*@ts-expect-error\b/.test(l))
    expect(
      activos.length,
      'comentar o borrar los casos negativos "arregla" el CI y deja el agujero abierto',
    ).toBeGreaterThanOrEqual(6)
  })

  it('3. cubre el caso textual de la aceptación: consultaDesdePICO(<cadena>)', () => {
    expect(leer(rutaTipos)).toMatch(/consultaDesdePICO\('recurrent urinary tract infection'\)/)
  })

  it('4. las TRES marcas invariantes siguen en pico.ts (control negativo C1 del DISEÑO §4.3)', () => {
    const src = leer(rutaPico)
    for (const marca of ['MARCA_TERMINO', 'MARCA_PICO', 'MARCA_CONSULTA']) {
      expect(src, `falta ${marca}: sin la marca se puede fabricar el objeto a mano y la aceptación desaparece con el CI en verde`)
        .toMatch(new RegExp(`declare const ${marca}: unique symbol`))
      // Forma invariante `(x: 'literal') => 'literal'`, igual que en E0-04/E2-01.
      expect(src, `la marca ${marca} perdió su forma de función literal→literal`)
        .toMatch(new RegExp(`readonly \\[${marca}\\]: \\(\\w+: '\\w+'\\) => '\\w+'`))
    }
    // Si se exportaran, cualquiera podría construir el objeto sin la fábrica.
    expect(src).not.toMatch(/export\s+(declare\s+)?const\s+MARCA_/)
  })
})

// ---------------------------------------------------------------------------
// A3 — el modelo aporta TÉRMINOS; no dicta la consulta
// ---------------------------------------------------------------------------

describe('E2-02 · A3 · picoDesdeModelo no deja que el modelo dicte la consulta', () => {
  it('5. una consulta ya armada dentro de una casilla se RECHAZA (no se limpia)', () => {
    const r = picoDesdeModelo({ poblacion: ['(UTI OR cystitis) AND women'] }, 'q')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.motivo).toBe('CONSULTA_DICTADA_POR_EL_MODELO')
    // Que NO se limpie es el punto: borrarle los paréntesis produciría un
    // término que nadie escribió.
    expect(r.detalle).toContain('(UTI OR cystitis) AND women')
  })

  it('5b. también rechaza OR/NOT sueltos, en cualquier caja', () => {
    for (const malo of ['women or men', 'sepsis AND shock', 'uti not pyelonephritis']) {
      const r = picoDesdeModelo({ poblacion: [malo] }, 'q')
      expect(r.ok, malo).toBe(false)
      if (!r.ok) expect(r.motivo, malo).toBe('CONSULTA_DICTADA_POR_EL_MODELO')
    }
  })

  it('6. un field tag se rechaza con su propio motivo (sin diccionario MeSH no es verificable)', () => {
    const r = picoDesdeModelo({ poblacion: ['urinary tract infection[mh]'] }, 'q')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('FIELD_TAG_NO_VERIFICABLE')
  })

  it('7. una frase larga no es un término', () => {
    const frase = 'women with recurrent urinary tract infection treated in the outpatient clinic setting'
    expect(frase.split(' ').length).toBeGreaterThan(MAXIMO_PALABRAS_TERMINO)
    const r = picoDesdeModelo({ poblacion: [frase] }, 'q')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('TERMINO_DEMASIADO_LARGO')
  })

  it('8. sin población no hay búsqueda: ni I sola ni O sola arman consulta', () => {
    const r = picoDesdeModelo({ intervencion: ['nitrofurantoin'] }, 'q')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('SIN_POBLACION')

    const r2 = picoDesdeModelo({ outcome: ['recurrence'] }, 'q')
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.motivo).toBe('SIN_POBLACION')
  })

  it('9. una faceta que no es arreglo se distingue de "falta la población"', () => {
    const r = picoDesdeModelo({ poblacion: 'recurrent UTI' }, 'q')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('FACETA_NO_ES_ARREGLO')
  })

  it('10. un término vacío se rechaza con motivo', () => {
    const r = picoDesdeModelo({ poblacion: ['  '] }, 'q')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('TERMINO_VACIO')
  })

  it('11. una entrada que no es objeto se rechaza sin lanzar', () => {
    for (const basura of ['texto crudo', 42, null, undefined, ['a']]) {
      const r = picoDesdeModelo(basura, 'q')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.motivo).toBe('ENTRADA_NO_ES_OBJETO')
    }
  })

  it('12. el camino feliz: cuatro casillas de términos ⇒ PICO con procedencia "modelo"', () => {
    const r = picoDesdeModelo({
      poblacion: ['recurrent urinary tract infection'],
      intervencion: ['nitrofurantoin'],
      comparador: ['placebo'],
      outcome: ['recurrence'],
    }, '¿nitrofurantoína para IVU recurrente?')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.valor.poblacion[0].busqueda).toBe('recurrent urinary tract infection')
    expect(r.valor.poblacion[0].origen).toBe('modelo')
    expect(r.valor.degradado).toBe(false)
    // La pregunta original SÓLO se guarda para trazar; no entra a la consulta.
    expect(r.valor.preguntaOriginal).toBe('¿nitrofurantoína para IVU recurrente?')
    expect(consultaDesdePICO(r.valor).texto).not.toContain('nitrofurantoína')
  })

  it('13. el tope de términos por faceta recorta de forma DETERMINISTA (guarda de coste)', () => {
    const muchos = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7']
    expect(muchos.length).toBeGreaterThan(MAXIMO_TERMINOS_POR_FACETA)
    const r = picoDesdeModelo({ poblacion: muchos }, 'q')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.valor.poblacion).toHaveLength(MAXIMO_TERMINOS_POR_FACETA)
    expect(r.valor.poblacion.map(x => x.busqueda)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5'])
  })

  it('14. el tope de caracteres corta basura larga antes de que llegue a una URL', () => {
    const basura = 'x'.repeat(MAXIMO_CARACTERES_TERMINO + 1)
    const r = picoDesdeModelo({ poblacion: [basura] }, 'q')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('TERMINO_DEMASIADO_LARGO')
  })
})

// ---------------------------------------------------------------------------
// A2 — trazabilidad y ensamblado
// ---------------------------------------------------------------------------

describe('E2-02 · A2 · la consulta se ARMA y carga consigo su procedencia', () => {
  it('15. sinónimos con OR, facetas con AND, orden fijo P→I→C→O', () => {
    const c = consultaDesdePICO(picoCompleto())
    expect(c.texto).toBe('(uti OR urinary tract infection) AND (nitrofurantoin) AND (placebo) AND (recurrence)')
    expect(c.facetas).toEqual(['P', 'I', 'C', 'O'])
  })

  it('16. INVARIANTE A2: todo token del texto viene de un término declarado en procedencia', () => {
    const c = consultaDesdePICO(picoCompleto())
    const permitidos = new Set<string>(['AND', 'OR'])
    for (const term of c.procedencia) {
      for (const v of [term.busqueda, ...term.sinonimos]) {
        for (const tok of v.split(/[^A-Za-z0-9]+/).filter(Boolean)) permitidos.add(tok)
      }
    }
    const tokens = c.texto.split(/[^A-Za-z0-9]+/).filter(Boolean)
    expect(tokens.length).toBeGreaterThan(0)
    for (const tok of tokens) {
      expect(
        permitidos.has(tok),
        `el token "${tok}" no viene de ninguna faceta declarada: se coló texto ajeno a la estructura`,
      ).toBe(true)
    }
  })

  it('17. determinismo: el mismo PICO produce byte a byte la misma cadena', () => {
    expect(consultaDesdePICO(picoCompleto()).texto).toBe(consultaDesdePICO(picoCompleto()).texto)
  })

  it('18. backoff: 1-3 consultas, estrictamente decrecientes, TODAS con P', () => {
    const cs = consultasDesdePICO(picoCompleto())
    expect(cs.length).toBe(3)
    expect(cs.map(c => c.facetas)).toEqual([['P', 'I', 'C', 'O'], ['P', 'I'], ['P']])
    for (let i = 1; i < cs.length; i++) {
      expect(cs[i].facetas.length).toBeLessThan(cs[i - 1].facetas.length)
    }
    for (const c of cs) expect(c.facetas).toContain('P')

    // Un PICO de sólo P no produce consultas repetidas.
    const soloP = pico({ poblacion: [t('P', 'sepsis')], preguntaOriginal: 'q' })
    const cs2 = consultasDesdePICO(soloP)
    expect(cs2.length).toBe(1)
    expect(cs2[0].texto).toBe('(sepsis)')
  })

  it('19. dedup case-insensitive entre facetas, conservando `original` intacto', () => {
    const p = pico({
      poblacion: [t('P', 'diabetes', [], 'DM2 (diabetes mellitus tipo 2)')],
      intervencion: [t('I', 'Diabetes'), t('I', 'metformin')],
      preguntaOriginal: 'q',
    })
    expect(p.poblacion[0].original).toBe('DM2 (diabetes mellitus tipo 2)')
    expect(terminosDeFaceta(p, 'I').map(x => x.busqueda)).toEqual(['metformin'])
    expect(consultaDesdePICO(p).texto).toBe('(diabetes) AND (metformin)')
  })
})

// ---------------------------------------------------------------------------
// Extractor determinista desde la nota
// ---------------------------------------------------------------------------

describe('E2-02 · picoDesdeNota (determinista, sin LLM)', () => {
  const NOTA = {
    motivo: 'IVU recurrente',
    diagnosticos: ['DM2'],
    medicamentos: ['nitrofurantoína'],
  }

  it('20. mapea motivo→P (PRIMERO), diagnósticos→P y medicamentos→I, vía diccionario', () => {
    const r = picoDesdeNota(NOTA)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const p = r.valor
    // El MOTIVO manda sobre las comorbilidades: criterio ya vigente hoy en
    // src/app/api/expediente/evidencia/route.ts:68-72, aquí conservado.
    expect(p.poblacion[0].original).toBe('IVU recurrente')
    expect(p.poblacion[0].busqueda).toContain('urinary tract infection')
    expect(p.poblacion[0].busqueda).toContain('recurrent')
    expect(p.poblacion[0].origen).toBe('diccionario')
    expect(p.poblacion.map(x => x.busqueda)).toContain('type 2 diabetes')
    expect(p.intervencion).toHaveLength(1)
    expect(p.intervencion[0].faceta).toBe('I')
    expect(p.degradado).toBe(false)
  })

  it('21. YA NO concatena: población e intervención quedan en grupos separables', () => {
    const r = picoDesdeNota(NOTA)
    if (!r.ok) throw new Error('fixture inválido')
    const c = consultaDesdePICO(r.valor)
    // Hoy el repo hace `[dx[0], ...meds].join(' ')` y las pega en una sola cadena.
    expect(c.texto).toMatch(/^\(.+\) AND \(.+\)$/)
    // Y por eso se puede relajar una faceta sin la otra:
    const cs = consultasDesdePICO(r.valor)
    expect(cs[cs.length - 1].facetas).toEqual(['P'])
    expect(cs[cs.length - 1].texto).not.toContain('nitrofurantoina')
  })

  it('22. sin motivo y sin diagnósticos ⇒ SIN_POBLACION (no se rellena con texto libre)', () => {
    const r = picoDesdeNota({ motivo: '   ', diagnosticos: [], medicamentos: ['metformina'] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('SIN_POBLACION')
  })

  it('23. edad y sexo NO entran por defecto (re-identificación); con opts sí', () => {
    const conDemo = { ...NOTA, edad: 34, sexo: 'femenino' }
    const sin = picoDesdeNota(conDemo)
    if (!sin.ok) throw new Error('fixture inválido')
    const textoSin = consultaDesdePICO(sin.valor).texto
    expect(textoSin).not.toContain('female')
    expect(textoSin).not.toContain('34')

    const con = picoDesdeNota(conDemo, { incluirDemografia: true })
    if (!con.ok) throw new Error('fixture inválido')
    const textoCon = consultaDesdePICO(con.valor).texto
    expect(textoCon).toContain('female')
    expect(textoCon).toContain('34 years')
  })

  it('23b. un sexo fuera del mapa NO se adivina: simplemente no entra', () => {
    const r = picoDesdeNota({ ...NOTA, sexo: 'no especificado' }, { incluirDemografia: true })
    if (!r.ok) throw new Error('fixture inválido')
    const texto = consultaDesdePICO(r.valor).texto
    expect(texto).not.toContain('female')
    expect(texto).not.toContain('male')
  })

  it('24. Q4 parametrizada: opts.medicamentosComo mueve los fármacos de faceta', () => {
    const r = picoDesdeNota(NOTA, { medicamentosComo: 'P' })
    if (!r.ok) throw new Error('fixture inválido')
    expect(r.valor.intervencion).toHaveLength(0)
    expect(r.valor.poblacion.map(x => x.busqueda).some(b => b.includes('nitrofurantoina'))).toBe(true)
    // Con una sola faceta el backoff no puede relajar nada: 1 consulta.
    expect(consultasDesdePICO(r.valor)).toHaveLength(1)
  })

  it('25. PHI: sólo se leen las cinco claves declaradas en EntradaNota', () => {
    const leidas: string[] = []
    const espia = new Proxy(
      { ...NOTA, edad: 34, sexo: 'femenino', nombre: 'Paciente Ficticio', folio: 'X-1', resumen: 'texto libre' },
      { get: (o, k) => { if (typeof k === 'string') leidas.push(k); return Reflect.get(o, k) } },
    )
    const r = picoDesdeNota(espia, { incluirDemografia: true })
    expect(r.ok).toBe(true)
    expect(new Set(leidas)).toEqual(new Set(['motivo', 'diagnosticos', 'medicamentos', 'edad', 'sexo']))
  })

  it('26. la puntuación de una nota humana se limpia (no se rechaza como si fuera el modelo)', () => {
    // ASIMETRÍA DELIBERADA: un paréntesis del médico es puntuación; un paréntesis
    // del modelo es un intento de dictar la consulta (ver caso 5).
    const r = picoDesdeNota({ motivo: 'IVU (recurrente)', diagnosticos: [], medicamentos: [] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(consultaDesdePICO(r.valor).texto).not.toContain('(recurrente)')
    expect(r.valor.poblacion[0].original).toBe('IVU (recurrente)')
  })
})

// ---------------------------------------------------------------------------
// Camino degradado — sigue existiendo, pero MARCADO
// ---------------------------------------------------------------------------

describe('E2-02 · camino degradado', () => {
  it('27. picoDegradadoDesdeTexto marca degradado y propaga la bandera a la consulta', () => {
    const r = picoDegradadoDesdeTexto('¿tratamiento de la IVU recurrente?')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.valor.degradado).toBe(true)
    expect(r.valor.poblacion[0].origen).toBe('literal')
    const c = consultaDesdePICO(r.valor)
    expect(c.degradada).toBe(true)
    expect(c.texto).toContain('urinary tract infection')
    for (const q of consultasDesdePICO(r.valor)) expect(q.degradada).toBe(true)
  })

  it('28. un PICO normal NO se marca degradado (la bandera no se pega sola)', () => {
    expect(consultaDesdePICO(picoCompleto()).degradada).toBe(false)
  })

  it('29. texto que se queda sin términos buscables ⇒ SIN_POBLACION, no consulta vacía', () => {
    const r = picoDegradadoDesdeTexto('   ')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('SIN_POBLACION')
  })
})

// ---------------------------------------------------------------------------
// Pureza del módulo y del puente
// ---------------------------------------------------------------------------

describe('E2-02 · pureza e imports', () => {
  it('30. pico.ts NO importa pubmed.ts (arrastraría process.env y la cola de throttle)', () => {
    const src = sinComentarios(leer('src/lib/evidencia/pico.ts'))
    expect(src, 'pico.ts debe seguir siendo puro e importable desde cualquier lado').not.toMatch(/from '\.\/pubmed'/)
    expect(src).not.toMatch(/process\.env/)
    expect(src).not.toMatch(/Date\.now\(\)|Math\.random\(\)/)
  })

  it('31. buscar-con-pico.ts sólo delega en buscarEvidenciaMulti (pubmed.ts intacto)', () => {
    const src = leer('src/lib/evidencia/buscar-con-pico.ts')
    expect(src).toMatch(/import \{ buscarEvidenciaMulti, type ArticuloPubMed \} from '\.\/pubmed'/)
    expect(src).toMatch(/return buscarEvidenciaMulti\(consultas\.map\(c => c\.texto\), opts\)/)
    // Sus únicos imports de valor son de pubmed.ts; lo demás es `import type`.
    const importsDeValor = src.split('\n').filter(l => /^import (?!type )/.test(l))
    expect(importsDeValor).toHaveLength(1)
  })

  it('32. E2-02 no registra motor clínico (no calcula nada clínico ⇒ deuda de ADRs intacta)', () => {
    expect(sinComentarios(leer('src/lib/evidencia/pico.ts'))).not.toMatch(/CLINICAL_ENGINE_REGISTRY/)
  })
})

// ---------------------------------------------------------------------------
// Tipos usados en runtime (que el compilador no se queje de imports muertos)
// ---------------------------------------------------------------------------

describe('E2-02 · sanidad de tipos en runtime', () => {
  it('33. NoVacio se respeta en runtime: poblacion y procedencia nunca llegan vacías', () => {
    const p = picoCompleto()
    const poblacion: NoVacio<TerminoPICO> = p.poblacion
    expect(poblacion.length).toBeGreaterThan(0)
    expect(consultaDesdePICO(p).procedencia.length).toBeGreaterThan(0)
  })
})
