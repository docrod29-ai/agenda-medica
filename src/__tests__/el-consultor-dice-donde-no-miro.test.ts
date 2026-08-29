/**
 * GOLDEN — LA EVIDENCIA DE LA CONSULTA NO DECÍA DÓNDE **NO** HABÍA MIRADO.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `/api/expediente/evidencia` —la ruta que el médico usa **con el paciente
 * enfrente**— consulta **sólo PubMed**, y su respuesta nunca lo decía. El médico
 * veía artículos y razonamiento sin forma de saber que UpToDate, Cochrane, las
 * guías y todo lo demás **ni se miraron**.
 *
 * Un consultor que sólo enseña lo que SÍ encontró se lee como si hubiera mirado
 * en todas partes. Con el paciente delante, eso convierte «no lo miramos» en
 * «no existe» — que es la conclusión contraria a la que este módulo existe para
 * dar. Regla 4 de seguridad clínica: ausencia de dato no es dato de ausencia.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * P1-9 del tablero de Ausculta, que lo dejó escrito con estas palabras: «en esta
 * pantalla el médico no puede leer *UpToDate: no se consultó*».
 *
 * Y la auditoría anterior había acusado a esta misma ruta de esconder los fallos
 * en un `.catch(() => [])`. **Eso era falso** y quedó anotado: hay un `testigo`
 * mutable que se marca antes de que el `catch` lo alcance, y la ruta distingue
 * «no se pudo preguntar» de «no hay literatura». Lo que de verdad faltaba era
 * esto: las fuentes que nunca entraron en la conversación.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * **La maquinaria existía, estaba probada, y esta ruta no la tenía cableada.**
 * `planDeConsulta` decide quién se consulta y quién sólo se declara; los
 * adaptadores no operativos producen su sobre `not_configured` **sin salir a la
 * red** —`adaptadorNoConfigurado` ni siquiera conoce una URL— y
 * `comoSeLeDiceAlMedico` lo convierte en una frase. `/api/consultor-evidencia`
 * lo usa desde REG-345. Ésta no.
 *
 * Familia «escrito, probado y sin conectar»: no faltaba el dato ni la regla,
 * faltaba el cable.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Se declara **con la misma lista de proveedores** que usa el consultor
 * (`FABRICAS`), no con una copia. Dos censos divergen, y el día que uno gane un
 * adaptador el otro se queda mintiendo por omisión.
 *
 * Y se declara también **lo operativo que no se consultó**: que un adaptador
 * funcione no significa que se haya usado, y callar eso sería la misma mentira
 * por otro camino.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · **No añade ni una fuente.** Sólo arregla el silencio. Consultar UpToDate,
 *   Cochrane o Scopus exige licencias que no existen (WS-08) y los adaptadores
 *   están deliberadamente inertes: `READY_BUT_NOT_LICENSED`.
 * · **No prueba la red ni la ruta entera.** Se ejercita el módulo de declaración
 *   y se comprueba que la ruta y la pantalla lo tengan cableado.
 * · **No renderiza.** Que el bloque exista en el árbol no prueba que se vea; eso
 *   es navegador (WS-05).
 * · **No arregla la procedencia estructurada de #314.** La otra mitad de P1-9
 *   —que esta ruta produzca `Source` con procedencia en vez de artículos
 *   sueltos— sigue abierta y con nombre.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { declararFuentesNoConsultadas } from '@/lib/evidencia/lo-que-no-se-consulto'
import { PROVEEDORES_INSTANCIADOS } from '@/lib/evidencia/recuperacion-consultor'

describe('SE DECLARA LO QUE NO SE CONSULTÓ', () => {
  it('EL CASO: consultando sólo PubMed, el resto sale declarado', async () => {
    const d = await declararFuentesNoConsultadas('infección urinaria recurrente', ['pubmed'])
    expect(d.noConsultados.length).toBeGreaterThan(0)
    expect(
      d.noConsultados,
      'PubMed se consultó: declararlo como no consultado sería mentir al revés',
    ).not.toContain('pubmed')
  })

  it('cada uno viene con su frase, ya redactada y con el motivo', async () => {
    const d = await declararFuentesNoConsultadas('sepsis', ['pubmed'])
    expect(d.avisos.length).toBe(d.noConsultados.length)
    for (const a of d.avisos) {
      expect(a.length, `aviso vacío: ${a}`).toBeGreaterThan(10)
      // «X: NO CONSULTADO — motivo». El motivo es lo que hace útil el aviso.
      expect(a).toMatch(/NO CONSULTADO|consultado/)
    }
  })

  it('sale de la MISMA lista de proveedores que el consultor, no de una copia', async () => {
    const d = await declararFuentesNoConsultadas('neumonía', [])
    // Sin nada consultado, se declaran todos los que el consultor instancia.
    expect([...d.noConsultados].sort()).toEqual([...PROVEEDORES_INSTANCIADOS].sort())
  })

  it('un proveedor OPERATIVO que no se usó también se declara', async () => {
    /**
     * Que un adaptador funcione no significa que se haya usado. Callar eso sería
     * la misma mentira por otro camino.
     */
    const todos = await declararFuentesNoConsultadas('asma', [])
    const sinPubmed = await declararFuentesNoConsultadas('asma', ['pubmed'])
    expect(todos.noConsultados.length).toBe(sinPubmed.noConsultados.length + 1)
    expect(todos.noConsultados).toContain('pubmed')
  })

  it('es TOTAL: no lanza, porque la evidencia es opcional y no puede tumbar la consulta', async () => {
    // Con una pregunta vacía tampoco revienta: devuelve lo que puede declarar.
    const d = await declararFuentesNoConsultadas('', ['pubmed'])
    expect(Array.isArray(d.avisos)).toBe(true)
  })

  it('y NO sale a la red: sólo declara', () => {
    const src = readFileSync('src/lib/evidencia/lo-que-no-se-consulto.ts', 'utf8')
    expect(src).not.toContain('fetch(')
    expect(src).toContain('No consulta nada')
  })
})

describe('LA RUTA Y LA PANTALLA LO TIENEN CABLEADO — el dato tiene que LLEGAR', () => {
  const ruta = readFileSync('src/app/api/expediente/evidencia/route.ts', 'utf8')
  const pantalla = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')

  it('la ruta declara, y declara que consultó PubMed', () => {
    expect(ruta).toContain('declararFuentesNoConsultadas')
    expect(ruta).toContain("['pubmed']")
  })

  it('lo dice TAMBIÉN cuando el razonamiento falla pero hay artículos', () => {
    /**
     * Aunque el análisis no salga, las fuentes que no se miraron siguen sin
     * mirarse. Callarlo en ese camino sería el mismo defecto por otro sitio —
     * exactamente cómo sobrevivió éste al arreglo de REG-345 en la otra ruta.
     */
    // Se declara en LOS DOS caminos de salida: el del análisis completo y el
    // del razonamiento fallido. Uno solo dejaría media ruta muda.
    const veces = ruta.match(/await declararFuentesNoConsultadas\(/g) ?? []
    expect(veces.length, 'sólo un camino declara: el otro se queda mudo').toBeGreaterThanOrEqual(2)
    const sinRazonamiento = ruta.slice(ruta.indexOf('const sinRazonamiento'), ruta.indexOf('const sinRazonamiento') + 700)
    expect(sinRazonamiento).toContain('_fuentesNoConsultadas')
  })

  it('la respuesta lleva la lista, no sólo una frase suelta', () => {
    expect(ruta).toContain('_fuentesNoConsultadas')
  })

  it('LA PANTALLA LA PINTA — si no, es REG-345 otra vez', () => {
    expect(pantalla).toContain('_fuentesNoConsultadas')
    expect(pantalla).toContain('noConsultadas')
    expect(pantalla).toContain('Sólo se consultó PubMed')
    // Y dice la frase que evita la conclusión equivocada.
    expect(pantalla).toContain('dice que no se preguntó')
  })

  it('el aviso va ARRIBA, junto al análisis, no enterrado al final', () => {
    const i = pantalla.indexOf('Sólo se consultó PubMed')
    const j = pantalla.indexOf("bloque('Evaluación del tratamiento'")
    expect(i).toBeGreaterThan(0)
    expect(i, 'leer la conclusión antes de saber dónde no se miró es leerla mal').toBeLessThan(j)
  })
})
