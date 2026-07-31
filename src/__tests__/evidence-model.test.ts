import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  fuente, pasaje, claim, claimDesde, claimDesdeJSON, estudio,
  fechaPublicacionDesde, esProveedorHabilitado, normalizarParaComparar,
  PROVEEDORES, MINIMO_CARACTERES_PASAJE,
  type Source, type Passage, type NoVacio,
} from '@/types/evidence'
import { sourceDesdeArticuloPubMed } from '@/lib/evidencia/desde-pubmed'

/**
 * E2-01 — Modelo Claim / Source / Passage.
 *
 * REPARTO DE RESPONSABILIDADES, igual que en E0-04: la ACEPTACIÓN de la unidad
 * («una afirmación sin pasaje de respaldo no puede construirse») se prueba en
 * DOS sitios distintos y por mecanismos distintos:
 *   - src/__tests__/tipos/evidence.tipos.ts → gate de `tsc` (no de vitest).
 *   - este archivo → la mitad de RUNTIME (`claimDesde`), que es por donde entra
 *     de verdad el JSON del LLM, y el GUARDIÁN del gate del compilador.
 *
 * Todo con FIXTURES SINTÉTICOS: un resumen ficticio escrito para el test. Cero
 * PHI, cero red, cero reloj.
 */

const raiz = process.cwd()
const leer = (p: string) => readFileSync(resolve(raiz, p), 'utf8')

// ---------------------------------------------------------------------------
// FIXTURES SINTÉTICOS
// ---------------------------------------------------------------------------

/**
 * Resumen ficticio. A propósito trae SALTOS DE LÍNEA y una raya larga Unicode
 * (`–` en «0.58–0.89»): son las dos diferencias de maquetación que la
 * normalización conservadora sí debe absorber.
 */
const RESUMEN = [
  'Antecedentes: cohorte sintética de 300 pacientes ficticios creada para pruebas.',
  'Resultados: el desenlace primario ocurrió con menor frecuencia en el grupo de',
  'intervención (HR 0.72, IC 95% 0.58–0.89).',
  'Limitaciones: centro único y seguimiento corto.',
].join('\n')

const CITA_DESENLACE = 'el desenlace primario ocurrió con menor frecuencia en el grupo de intervención'

function fuenteFixture(idExterno = '00000001', texto = RESUMEN): Source {
  const r = fuente({
    proveedor: 'pubmed',
    idExterno,
    titulo: 'Estudio ficticio para pruebas de E2-01',
    contenedor: 'Revista Ficticia de Pruebas',
    publicado: { precision: 'anio', iso: '2024' },
    recuperadoEn: '2026-07-29T00:00:00.000Z',
    textoRecuperado: texto,
  })
  if (!r.ok) throw new Error(`fixture inválido: ${r.motivo} ${r.detalle}`)
  return r.valor
}

function pasajeFixture(s: Source, texto = CITA_DESENLACE): Passage {
  const r = pasaje(s, texto)
  if (!r.ok) throw new Error(`fixture inválido: ${r.motivo} ${r.detalle}`)
  return r.valor
}

// ---------------------------------------------------------------------------
// GUARDIÁN DEL GATE DEL COMPILADOR (patrón de clinical-quantity.test.ts)
// ---------------------------------------------------------------------------

describe('E2-01 · guardián del gate del compilador', () => {
  const rutaTipos = 'src/__tests__/tipos/evidence.tipos.ts'
  const rutaModelo = 'src/types/evidence.ts'

  it('1. el archivo de casos negativos existe', () => {
    expect(existsSync(resolve(raiz, rutaTipos)), `${rutaTipos} es la aceptación de E2-01: sin él, nada prueba que el compilador rechace una afirmación sin pasaje`).toBe(true)
  })

  it('2. conserva al menos 6 @ts-expect-error ACTIVOS (no comentados)', () => {
    const activos = leer(rutaTipos)
      .split('\n')
      .filter(l => /^\s*\/\/\s*@ts-expect-error\b/.test(l))
    expect(activos.length, 'comentar o borrar los casos negativos "arregla" el CI y deja el agujero abierto').toBeGreaterThanOrEqual(6)
  })

  it('3. cubre el caso textual de la aceptación: claim(…, [])', () => {
    expect(leer(rutaTipos)).toMatch(/claim\('afirmación sin respaldo',\s*\[\]\)/)
  })

  it('4. las CUATRO marcas invariantes siguen en el modelo (control negativo del DISEÑO §4.4)', () => {
    // Sin la forma `(x: 'literal') => 'literal'` el tipo se ensancha y un
    // Passage/Claim FABRICADO A MANO compila: el CI queda verde y la aceptación
    // desaparece. Verificado en el diseño: al sustituirlas por `?: never`,
    // tsc devolvió exit 2 con 2 TS2578 (casos 3 y 4).
    const src = leer(rutaModelo)
    expect(src).toContain("readonly [MARCA_SOURCE]: (s: 'source') => 'source'")
    expect(src).toContain("readonly [MARCA_PASAJE]: (p: 'passage') => 'passage'")
    expect(src).toContain("readonly [MARCA_CLAIM]: (c: 'claim') => 'claim'")
    expect(src).toContain("readonly [MARCA_ESTUDIO]: (e: 'estudio') => 'estudio'")
  })

  it('5. ninguna marca se exporta (la única puerta de entrada es la fábrica)', () => {
    expect(leer(rutaModelo)).not.toMatch(/^export\s+declare\s+const\s+MARCA_/m)
  })

  it('6. `apoyos` sigue tipado como tupla NO VACÍA', () => {
    expect(leer(rutaModelo), 'cambiar NoVacio<Passage> por readonly Passage[] deja pasar claim(…, [])')
      .toContain('readonly apoyos: NoVacio<Passage>')
  })

  it('7. el adaptador de PubMed importa los tipos con `import type` (no arrastra process.env)', () => {
    // pubmed.ts:15 lee NCBI_API_KEY EN EL IMPORT; un import de valor arrastraría
    // ese efecto a cualquier consumidor del modelo de evidencia.
    expect(leer('src/lib/evidencia/desde-pubmed.ts')).toMatch(/^import type \{ ArticuloPubMed \} from '\.\/pubmed'$/m)
  })

  it('8. el modelo no lee process.env ni usa reloj/azar (fábricas puras y deterministas)', () => {
    // Se quitan los comentarios antes de mirar: el encabezado EXPLICA por qué no
    // se lee process.env, y esa explicación no debe disparar el guardián.
    const codigo = leer(rutaModelo).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(codigo, 'un módulo de tipos que lee el entorno deja de ser puro').not.toMatch(/process\.env/)
    expect(codigo, 'ids con reloj = tests irreproducibles y claims no deduplicables').not.toMatch(/Date\.now\(\)/)
    expect(codigo).not.toMatch(/Math\.random\(\)/)
  })
})

// ---------------------------------------------------------------------------
// LA ACEPTACIÓN, EN RUNTIME
// ---------------------------------------------------------------------------

describe('E2-01 · ACEPTACIÓN: una afirmación sin pasaje de respaldo no puede construirse', () => {
  it('claimDesde con `citas: []` devuelve SIN_PASAJE, nunca un Claim', () => {
    const s = fuenteFixture()
    const r = claimDesde({ texto: 'La intervención reduce el desenlace.', citas: [], pasajes: [] }, [s])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('SIN_PASAJE')
  })

  it('claimDesde sin campo `citas` también devuelve SIN_PASAJE', () => {
    const s = fuenteFixture()
    const r = claimDesde({ texto: 'La intervención reduce el desenlace.' }, [s])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('SIN_PASAJE')
  })

  it('claimDesde con citas pero SIN texto literal citado devuelve SIN_PASAJE', () => {
    // Es el caso más traicionero: el modelo "cita" la fuente 1 pero no aporta
    // ningún fragmento. Hoy eso se pintaría como afirmación respaldada.
    const s = fuenteFixture()
    const r = claimDesde({ texto: 'La intervención reduce el desenlace.', citas: [1] }, [s])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('SIN_PASAJE')
  })

  it('un índice de cita FUERA DE RANGO se rechaza — hoy se descarta en silencio', () => {
    // Reproduce el bug de consulta/[patientId]/page.tsx:2698, donde
    // `(nums ?? []).filter(n => arts[n - 1])` borra la cita inválida y la
    // afirmación se muestra igual que una respaldada.
    const s = fuenteFixture()
    const r = claimDesde({ texto: 'Afirmación con cita inventada.', citas: [9], pasajes: [CITA_DESENLACE] }, [s])
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.motivo).toBe('CITA_FUERA_DE_RANGO')
      expect(r.detalle).toContain('[9]')
    }
  })

  it('el camino feliz SÍ construye el Claim, con su pasaje anclado', () => {
    const s = fuenteFixture()
    const r = claimDesde({ texto: 'El desenlace fue menos frecuente con la intervención.', citas: [1], pasajes: [CITA_DESENLACE] }, [s])
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.valor.apoyos.length).toBe(1)
      expect(r.valor.apoyos[0].sourceId).toBe('pubmed:00000001')
      // El pasaje es la subcadena LITERAL del texto de la fuente.
      expect(s.textoRecuperado.slice(r.valor.apoyos[0].inicio, r.valor.apoyos[0].fin)).toBe(r.valor.apoyos[0].texto)
    }
  })

  it('claim() con texto vacío se rechaza aunque tenga pasajes', () => {
    const s = fuenteFixture()
    const p = pasajeFixture(s)
    const r = claim('   ', [p] as NoVacio<Passage>)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('TEXTO_VACIO')
  })
})

// ---------------------------------------------------------------------------
// PASSAGE: literalidad, no paráfrasis
// ---------------------------------------------------------------------------

describe('E2-01 · Passage exige literalidad', () => {
  it('una paráfrasis que no es subcadena se rechaza con PASAJE_NO_LITERAL', () => {
    const s = fuenteFixture()
    const r = pasaje(s, 'los pacientes que recibieron el tratamiento evolucionaron mucho mejor que los demás')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('PASAJE_NO_LITERAL')
  })

  it('acepta la misma cita con espacios/saltos distintos y guion en vez de raya Unicode', () => {
    // Normalización CONSERVADORA: maquetación sí, contenido no.
    const s = fuenteFixture()
    const r = pasaje(s, '(HR 0.72, IC 95%   0.58-0.89).\n\n  Limitaciones: centro único')
    expect(r.ok).toBe(true)
    if (r.ok) {
      // El texto guardado conserva la raya Unicode ORIGINAL de la fuente.
      expect(r.valor.texto).toContain('0.58–0.89')
      expect(s.textoRecuperado.slice(r.valor.inicio, r.valor.fin)).toBe(r.valor.texto)
    }
  })

  it('RECHAZA 0·72 frente a 0.72: las cifras NO se normalizan, a propósito', () => {
    // Estilo Lancet (punto medio) vs. punto decimal. Preferimos un rechazo
    // honesto a una coincidencia inventada sobre una CIFRA.
    const s = fuenteFixture()
    const r = pasaje(s, '(HR 0·72, IC 95% 0.58-0.89). Limitaciones: centro único')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('PASAJE_NO_LITERAL')
  })

  it('un fragmento de 3 caracteres se rechaza (guarda de SOFTWARE, no umbral clínico)', () => {
    const s = fuenteFixture()
    const r = pasaje(s, '300')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.motivo).toBe('PASAJE_DEMASIADO_CORTO')
      expect(r.detalle).toContain(String(MINIMO_CARACTERES_PASAJE))
    }
  })

  it('el mínimo es un PARÁMETRO ajustable, no una constante escondida', () => {
    const s = fuenteFixture()
    const r = pasaje(s, 'centro único', { minimoCaracteres: 5 })
    expect(r.ok).toBe(true)
  })

  it('texto citado vacío ⇒ PASAJE_VACIO', () => {
    const s = fuenteFixture()
    const r = pasaje(s, '   ')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('PASAJE_VACIO')
  })

  it('una "fuente" sin texto recuperado (llegada por un `as`) ⇒ FUENTE_DESCONOCIDA', () => {
    const falsa = { id: 'pubmed:1', textoRecuperado: '' } as unknown as Source
    const r = pasaje(falsa, CITA_DESENLACE)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('FUENTE_DESCONOCIDA')
  })

  it('normalizarParaComparar no toca acentos ni cifras', () => {
    expect(normalizarParaComparar('  único\n\n 0.72  ')).toBe('único 0.72')
  })
})

// ---------------------------------------------------------------------------
// IDS DETERMINISTAS
// ---------------------------------------------------------------------------

describe('E2-01 · ids deterministas (sin reloj ni azar)', () => {
  it('el mismo input produce el mismo Passage.id en dos construcciones separadas', () => {
    const a = pasajeFixture(fuenteFixture())
    const b = pasajeFixture(fuenteFixture())
    expect(a.id).toBe(b.id)
    expect(a.id).toBe(`pubmed:00000001#${a.inicio}-${a.fin}`)
  })

  it('el mismo input produce el mismo Claim.id, y cambiar el texto lo cambia', () => {
    const s = fuenteFixture()
    const p = pasajeFixture(s)
    const r1 = claim('Afirmación A', [p] as NoVacio<Passage>)
    const r2 = claim('Afirmación A', [p] as NoVacio<Passage>)
    const r3 = claim('Afirmación B', [p] as NoVacio<Passage>)
    expect(r1.ok && r2.ok && r3.ok).toBe(true)
    if (r1.ok && r2.ok && r3.ok) {
      expect(r1.valor.id).toBe(r2.valor.id)
      expect(r1.valor.id).not.toBe(r3.valor.id)
    }
  })
})

// ---------------------------------------------------------------------------
// SERIALIZACIÓN: un objeto que vuelve de Firestore NO es un Claim
// ---------------------------------------------------------------------------

describe('E2-01 · claimDesdeJSON', () => {
  it('ida y vuelta por JSON.stringify reconstruye un Claim equivalente', () => {
    const s = fuenteFixture()
    const r = claimDesde({ texto: 'El desenlace fue menos frecuente.', citas: [1], pasajes: [CITA_DESENLACE] }, [s])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const vuelta = claimDesdeJSON(JSON.parse(JSON.stringify(r.valor)), [s])
    expect(vuelta.ok).toBe(true)
    if (vuelta.ok) {
      expect(vuelta.valor.id).toBe(r.valor.id)
      expect(vuelta.valor.apoyos[0].id).toBe(r.valor.apoyos[0].id)
    }
  })

  it('un JSON MANIPULADO al que le quitaron los apoyos ⇒ SIN_PASAJE', () => {
    const s = fuenteFixture()
    const r = claimDesde({ texto: 'El desenlace fue menos frecuente.', citas: [1], pasajes: [CITA_DESENLACE] }, [s])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const manipulado = { ...JSON.parse(JSON.stringify(r.valor)), apoyos: [] }
    const vuelta = claimDesdeJSON(manipulado, [s])
    expect(vuelta.ok).toBe(false)
    if (!vuelta.ok) expect(vuelta.motivo).toBe('SIN_PASAJE')
  })

  it('un apoyo cuyo texto ya NO aparece en la fuente ⇒ PASAJE_NO_LITERAL (no se confía en lo guardado)', () => {
    const s = fuenteFixture()
    const manipulado = {
      texto: 'Afirmación manipulada.',
      apoyos: [{ id: 'pubmed:00000001#0-50', sourceId: 'pubmed:00000001', texto: 'la mortalidad se redujo a la mitad en todos los subgrupos', inicio: 0, fin: 50 }],
    }
    const vuelta = claimDesdeJSON(manipulado, [s])
    expect(vuelta.ok).toBe(false)
    if (!vuelta.ok) expect(vuelta.motivo).toBe('PASAJE_NO_LITERAL')
  })

  it('un apoyo que apunta a una fuente desconocida ⇒ FUENTE_DESCONOCIDA', () => {
    const s = fuenteFixture()
    const vuelta = claimDesdeJSON({ texto: 'x', apoyos: [{ sourceId: 'pubmed:99999999', texto: CITA_DESENLACE }] }, [s])
    expect(vuelta.ok).toBe(false)
    if (!vuelta.ok) expect(vuelta.motivo).toBe('FUENTE_DESCONOCIDA')
  })
})

// ---------------------------------------------------------------------------
// CIFRAS
// ---------------------------------------------------------------------------

describe('E2-01 · las cifras deben estar en el pasaje', () => {
  it('una cifra que no aparece literalmente en ningún pasaje ⇒ CIFRA_NO_LITERAL', () => {
    const s = fuenteFixture()
    const r = claimDesde({ texto: 'La intervención redujo el riesgo (HR 0.35).', citas: [1], pasajes: [CITA_DESENLACE], cifra: 'HR 0.35' }, [s])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('CIFRA_NO_LITERAL')
  })

  it('una cifra que SÍ aparece en el pasaje se acepta', () => {
    const s = fuenteFixture()
    const r = claimDesde({
      texto: 'La intervención redujo el riesgo (HR 0.72).',
      citas: [1],
      pasajes: ['(HR 0.72, IC 95% 0.58-0.89). Limitaciones: centro único'],
      cifra: 'HR 0.72',
    }, [s])
    expect(r.ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// ESTUDIO: población, diseño, efecto, limitaciones, fecha
// ---------------------------------------------------------------------------

describe('E2-01 · Estudio', () => {
  const base = () => {
    const s = fuenteFixture()
    const pDesenlace = pasajeFixture(s)
    const pEfecto = pasajeFixture(s, '(HR 0.72, IC 95% 0.58-0.89). Limitaciones: centro único')
    return { s, pDesenlace, pEfecto }
  }

  it('construye con los cuatro campos declarados y anclados', () => {
    const { s, pDesenlace, pEfecto } = base()
    const r = estudio({
      source: s,
      poblacion: { conocido: true, valor: { descripcion: 'cohorte sintética', n: 300 }, pasajeId: pDesenlace.id },
      diseno: { conocido: true, valor: 'cohorte', pasajeId: pDesenlace.id },
      efecto: { conocido: true, valor: { medida: 'HR', valor: 0.72, ic95: [0.58, 0.89], citaLiteral: 'HR 0.72' }, pasajeId: pEfecto.id },
      limitaciones: { conocido: true, valor: ['centro único'], pasajeId: pEfecto.id },
      pasajes: [pDesenlace, pEfecto],
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.valor.source.publicado).toEqual({ precision: 'anio', iso: '2024' })
  })

  it('limitaciones conocido:true con arreglo VACÍO se rechaza (ambigüedad peligrosa)', () => {
    const { s, pEfecto } = base()
    const r = estudio({
      source: s,
      poblacion: { conocido: false, motivo: 'no_extraido_todavia' },
      diseno: { conocido: false, motivo: 'no_extraido_todavia' },
      efecto: { conocido: false, motivo: 'no_extraido_todavia' },
      limitaciones: { conocido: true, valor: [], pasajeId: pEfecto.id },
      pasajes: [pEfecto],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('LIMITACIONES_VACIAS')
  })

  it('un pasaje de OTRA fuente no puede anclar un campo de este estudio', () => {
    const { s, pDesenlace } = base()
    const otra = fuenteFixture('00000002')
    const pAjeno = pasajeFixture(otra)
    const r = estudio({
      source: s,
      poblacion: { conocido: true, valor: { descripcion: 'cohorte sintética' }, pasajeId: pAjeno.id },
      diseno: { conocido: false, motivo: 'no_extraido_todavia' },
      efecto: { conocido: false, motivo: 'no_extraido_todavia' },
      limitaciones: { conocido: false, motivo: 'no_reportado_en_la_fuente' },
      pasajes: [pDesenlace, pAjeno],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('PASAJE_AJENO_AL_SOURCE')
  })

  it('un efecto cuya citaLiteral no está en su pasaje ⇒ CIFRA_NO_LITERAL', () => {
    const { s, pDesenlace } = base()
    const r = estudio({
      source: s,
      poblacion: { conocido: false, motivo: 'no_extraido_todavia' },
      diseno: { conocido: false, motivo: 'no_extraido_todavia' },
      efecto: { conocido: true, valor: { medida: 'HR', valor: 0.35, citaLiteral: 'HR 0.35' }, pasajeId: pDesenlace.id },
      limitaciones: { conocido: false, motivo: 'no_reportado_en_la_fuente' },
      pasajes: [pDesenlace],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('CIFRA_NO_LITERAL')
  })
})

// ---------------------------------------------------------------------------
// SOURCE, PROVEEDORES Y FECHAS
// ---------------------------------------------------------------------------

describe('E2-01 · Source, proveedores y fechas', () => {
  it('un proveedor LICENSE_UNKNOWN se rechaza también en runtime', () => {
    const r = fuente({
      // El compilador ya lo bloquea; esto cubre el objeto que llega de Firestore.
      proveedor: 'clsi' as never,
      idExterno: 'M100',
      titulo: 'Documento con licencia desconocida',
      publicado: { precision: 'desconocida' },
      recuperadoEn: '2026-07-29T00:00:00.000Z',
      textoRecuperado: 'texto cualquiera suficientemente largo para el test',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('PROVEEDOR_NO_HABILITADO')
  })

  it('esProveedorHabilitado sólo acepta los ENABLED del catálogo', () => {
    expect(esProveedorHabilitado('pubmed')).toBe(true)
    expect(esProveedorHabilitado('uptodate')).toBe(false)
    expect(esProveedorHabilitado('inventado')).toBe(false)
    // El catálogo codifica la decisión D1 del Dr., no criterio nuevo.
    expect(PROVEEDORES.clsi.licencia).toBe('LICENSE_UNKNOWN')
  })

  it('un Source sin texto recuperado se rechaza (sin texto no hay pasajes)', () => {
    const r = fuente({
      proveedor: 'pubmed', idExterno: '1', titulo: 't',
      publicado: { precision: 'desconocida' }, recuperadoEn: '2026-07-29T00:00:00.000Z',
      textoRecuperado: '   ',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('SIN_TEXTO_RECUPERADO')
  })

  it('una fecha con sólo AÑO conserva precision:anio y NO se completa a -01-01', () => {
    expect(fechaPublicacionDesde('2024')).toEqual({ precision: 'anio', iso: '2024' })
    expect(fechaPublicacionDesde('2024-03')).toEqual({ precision: 'mes', iso: '2024-03' })
    expect(fechaPublicacionDesde('2024-03-15')).toEqual({ precision: 'dia', iso: '2024-03-15' })
    // Lo que no se reconoce NO se adivina.
    expect(fechaPublicacionDesde('primavera de 2024')).toEqual({ precision: 'desconocida' })
    expect(fechaPublicacionDesde(undefined)).toEqual({ precision: 'desconocida' })
  })
})

// ---------------------------------------------------------------------------
// ADAPTADOR DE PUBMED
// ---------------------------------------------------------------------------

describe('E2-01 · sourceDesdeArticuloPubMed', () => {
  const articulo = {
    pmid: '38412345',
    titulo: 'Título ficticio de prueba',
    revista: 'Revista Ficticia',
    anio: '2024',
    resumen: RESUMEN,
    url: 'https://pubmed.ncbi.nlm.nih.gov/38412345/',
    tipo: 'ECA',
  }

  it('un artículo SIN resumen se rechaza: sin texto no hay pasajes posibles', () => {
    const r = sourceDesdeArticuloPubMed({ ...articulo, resumen: '' }, '2026-07-29T00:00:00.000Z')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('SIN_TEXTO_RECUPERADO')
  })

  it('con resumen construye el Source y conserva el recuperadoEn que se le pasó', () => {
    const r = sourceDesdeArticuloPubMed(articulo, '2026-07-29T00:00:00.000Z')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.valor.id).toBe('pubmed:38412345')
      expect(r.valor.recuperadoEn).toBe('2026-07-29T00:00:00.000Z')
      expect(r.valor.publicado).toEqual({ precision: 'anio', iso: '2024' })
      // Los pasajes se anclan sobre el resumen recuperado.
      expect(pasaje(r.valor, CITA_DESENLACE).ok).toBe(true)
    }
  })

  it('NO traduce `tipo` a DisenoDeEstudio: el clasificador de pubmed.ts colapsa categorías', () => {
    // 'ECA' de pubmed.ts:64 también captura `clinical trial` a secas, que puede
    // no ser aleatorizado. Traducirlo inventaría un dato metodológico.
    const r = sourceDesdeArticuloPubMed(articulo, '2026-07-29T00:00:00.000Z')
    expect(r.ok).toBe(true)
    if (r.ok) expect('diseno' in r.valor).toBe(false)
  })
})
