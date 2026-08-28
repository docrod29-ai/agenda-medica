/**
 * ══════════════════════════════════════════════════════════════════════════
 * EL SOBRE DE RECUPERACIÓN, CABLEADO AL CONSULTOR DEL MÉDICO (#314)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `src/app/api/consultor-evidencia/route.ts` buscaba en PubMed con tres redes
 * de seguridad encadenadas y las tres acababan en `.catch(() => [])`. Con eso,
 * el médico recibía EXACTAMENTE LA MISMA pantalla en dos situaciones opuestas:
 *
 *   · PubMed contestó y no hay literatura para esa pregunta  → dato clínico.
 *   · PubMed no contestó (red, 429 del NCBI, timeout)        → no se sabe nada.
 *
 * Y la pantalla escribía, determinista, «Sin resultados de PubMed para esta
 * pregunta». O sea: un fallo de red se le presentaba al médico como un hallazgo.
 *
 * ── EL DETALLE QUE HACE QUE ESTO NO SEA COSMÉTICA ───────────────────────────
 *
 * `buscarEvidenciaMulti` **NUNCA LANZA**: ante un 429 o una caída devuelve `[]`
 * y deja la marca en `TestigoPubMed` (pubmed.ts:104). Por eso NO basta con
 * envolver la llamada en el adaptador de #314: `adaptadorPubMed` sólo distingue
 * el fallo cuando su función de búsqueda LANZA, así que con el retrieval real
 * enchufado tal cual seguiría produciendo `available` con cero fuentes — la
 * misma mentira, ahora con un sobre encima.
 *
 * Aquí se lee el testigo y se convierte en la excepción que el adaptador espera.
 * Es «el dato tiene que LLEGAR» (.claude/rules/el-dato-tiene-que-llegar.md)
 * aplicado a una frontera interna: el estado ya existía en `pubmed.ts` y no
 * llegaba a quien tenía que pintarlo.
 *
 * ── LO QUE NO SE TOCA ───────────────────────────────────────────────────────
 *
 * NI UNA LÍNEA del retrieval. `buscarEvidenciaMulti` y `buscarEvidencia` siguen
 * siendo los mismos, con su cola de throttle y su cascada de tres intentos en
 * el mismo orden y con los mismos parámetros: cada intento trae su propia
 * función de búsqueda para que la calidad de búsqueda de producción no cambie
 * al pasar por aquí. Esto es un ENVOLTORIO, no una reescritura.
 *
 * ── LA REGLA DE ARRASTRE, QUE ES LA PARTE DELICADA ──────────────────────────
 *
 *   ╔══════════════════════════════════════════════════════════════════════╗
 *   ║  SI ALGÚN INTENTO NO OBTUVO RESPUESTA Y NINGUNO TRAJO MATERIAL,      ║
 *   ║  EL RESULTADO ES «NO SE PUDO CONSULTAR» — NUNCA «NO HAY NADA».       ║
 *   ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Un intento que falló es una pregunta que nadie contestó. Que OTRA búsqueda
 * —con otros términos— haya contestado «cero» no autoriza a decir que la
 * literatura no existe: se contestó otra cosa. El fallo gana al cero.
 *
 * ── LO QUE ESTE MÓDULO NO HACE ──────────────────────────────────────────────
 *
 *  · NO decide nada clínico. Devuelve estado, fuentes y frases; quien redacta
 *    es el modelo y quien decide es el médico (`compuertas.ts` de #314).
 *  · NO minimiza PHI: eso pasa antes, en la puerta de la ruta
 *    (`minimizarContextoPaciente`). Aquí sólo entran términos de búsqueda.
 *  · NO cachea nada.
 */

import {
  adaptadorPubMed,
  adaptadorConocimientoPersonal,
  uptodate, openevidence, cochrane, perplexity,
  planDeConsulta,
  corpusParaSintesis,
  tieneMaterial,
  comoSeLeDiceAlMedico,
  sobreConMaterial,
  frescuraDeSobre,
  UMBRAL_DIAS,
  type AdaptadorDeEvidencia,
  type ConsultaDeEvidencia,
  type ContextoDeRecuperacion,
  type SobreDeRecuperacion,
  type SobreConMaterial,
  type SobreSinMaterial,
  type ProveedorDeEvidencia,
} from '@/lib/evidence-integrations'
import { buscarEvidenciaMulti, type ArticuloPubMed, type TestigoPubMed } from '@/lib/evidencia/pubmed'
import type { Source } from '@/types/evidence'

/**
 * La firma del retrieval que ya existe, con el testigo OBLIGATORIO.
 *
 * Obligatorio y no opcional a propósito: el testigo es la única forma que tiene
 * `pubmed.ts` de decir «fallé», y hacerlo opcional aquí permitiría volver a
 * perderlo por olvido — que es exactamente cómo se perdía hasta hoy.
 */
export type BusquedaDePubMed = (
  terminos: readonly string[],
  opts: { max?: number; aniosRecientes?: number; signal?: AbortSignal; testigo: TestigoPubMed },
) => Promise<ArticuloPubMed[]>

const BUSQUEDA_REAL: BusquedaDePubMed = (terminos, opts) => buscarEvidenciaMulti([...terminos], opts)

/** Un peldaño de la cascada de búsqueda que la ruta ya tenía. */
export interface IntentoDeBusqueda {
  readonly terminos: readonly string[]
  readonly aniosRecientes?: number
  /** Búsqueda propia del peldaño. Ausente = la de por defecto (multi-consulta). */
  readonly buscar?: BusquedaDePubMed
  /** Por qué existe este peldaño. Obligatorio: uno sin motivo se borra a ciegas. */
  readonly porQue: string
}

export interface EntradaRecuperacionConsultor {
  /** Pregunta clínica YA minimizada. No se manda a ningún proveedor externo. */
  readonly pregunta: string
  readonly intentos: readonly IntentoDeBusqueda[]
  readonly maximo: number
  /** Instante ISO del intento. Se pasa, no se toma del reloj (fábricas puras). */
  readonly ahora: string
  /** Marca opaca de correlación. NUNCA lleva PHI (contrato.ts). */
  readonly correlacion: string
  readonly clinicId?: string
  readonly signal?: AbortSignal
  /** Búsqueda por defecto. Inyectable: las pruebas no salen a la red. */
  readonly buscar?: BusquedaDePubMed
}

/**
 * Los tres estados que el médico tiene que poder distinguir. No hay un cuarto:
 * añadirlo obliga a tocar la unión y con ella a quien la pinta.
 */
export type EstadoParaElMedico =
  /** Se consultó y hay material citable. */
  | 'con_evidencia'
  /** Se consultó, contestó, y no hay nada para esa búsqueda. Es un DATO. */
  | 'sin_resultados'
  /** No se pudo consultar. NO es un dato sobre la literatura. */
  | 'no_consultado'

export interface RecuperacionParaConsultor {
  readonly estado: EstadoParaElMedico
  /**
   * Los artículos CRUDOS del retrieval, tal cual los devolvía la ruta antes.
   * Se conservan porque llevan `resumen`, `tipo` y `doi`, que el `Source`
   * canónico no transporta y que el prompt y la lista de fuentes sí usan.
   */
  readonly articulos: readonly ArticuloPubMed[]
  /** El sobre de PubMed: el estado con su motivo, tal como lo define #314. */
  readonly sobre: SobreDeRecuperacion
  /** Los proveedores que NO se consultaron, cada uno con su porqué. */
  readonly declarados: readonly SobreDeRecuperacion[]
  /** Fuentes canónicas citables (las que pueden anclar un pasaje). */
  readonly fuentes: readonly Source[]
  /** De qué proveedor salió cada fuente. Procedencia, no adorno. */
  readonly procedencia: readonly { readonly sourceId: string; readonly proveedor: ProveedorDeEvidencia }[]
  /** Frases para el médico, en el vocabulario único del contrato. */
  readonly avisos: readonly string[]
  /** Sólo cuando no se pudo consultar: qué pasó, legible. */
  readonly motivo: string | null
}

/** Lo que se le dice al adaptador cuando `pubmed.ts` marcó fallo y no trajo nada. */
const PUBMED_NO_CONTESTO =
  'PubMed no contestó: el testigo de pubmed.ts marcó la petición como fallida y no llegó ningún artículo.'

/** Lo que se declara cuando SÍ llegó material pero parte de la búsqueda se cayó. */
const RECORTE_DE_COBERTURA =
  'al menos una de las consultas a PubMed no obtuvo respuesta: la búsqueda quedó incompleta y puede faltar literatura que sí existe.'

export const POR_QUE_EL_CONSULTOR_USA_EL_SOBRE =
  'Un array vacío significa dos cosas incompatibles —«no hay literatura» y «no se pudo preguntar»— y ' +
  'las dos se pintaban igual. El sobre las separa en el servidor, que es donde una regla se cumple ' +
  'siempre, y no en el prompt, que se cumple cuando el modelo colabora.'

/**
 * QUÉ PROVEEDORES SE INSTANCIAN DE VERDAD (REG-345).
 *
 * Esta lista es la **única verdad de runtime** sobre qué se consulta. Vivía
 * escrita a mano dentro de la función, y la matriz publicada
 * (`docs/evidence/MATRIZ-CALIFICACION-PROVEEDORES.md`) contestaba «¿puede citar
 * hoy?» mirando OTRA cosa: si el catálogo declaraba un `proveedorCanonico`, que
 * es una propiedad del TIPO.
 *
 * El resultado era una tabla que le decía al dueño que ClinicalTrials.gov, la
 * OMS y los CDC «pueden citar hoy: **sí**» cuando ninguno de los tres tiene
 * adaptador y ninguno se instancia aquí. Y ésa es exactamente la tabla que un
 * dueño lee para decidir un gasto.
 *
 * Se exporta para que el documento se DERIVE de ella en vez de repetirla a mano.
 */
const FABRICAS: Record<string, () => AdaptadorDeEvidencia> = {
  pubmed: adaptadorPubMed,
  uptodate,
  openevidence,
  cochrane,
  perplexity,
  conocimiento_personal: adaptadorConocimientoPersonal,
}

/** Los proveedores que de verdad se instancian. Deriva de las fábricas. */
export const PROVEEDORES_INSTANCIADOS: readonly string[] = Object.keys(FABRICAS)

/**
 * Recupera evidencia para el Consultor y devuelve el ESTADO, no sólo los datos.
 *
 * No lanza por fallo del proveedor: el sobre de fallo es el producto.
 */
export async function recuperarEvidenciaParaConsultor(
  e: EntradaRecuperacionConsultor,
): Promise<RecuperacionParaConsultor> {
  const ctx: ContextoDeRecuperacion = {
    ahora: e.ahora,
    correlacion: e.correlacion,
    ...(e.clinicId ? { clinicId: e.clinicId } : {}),
    ...(e.signal ? { signal: e.signal } : {}),
  }
  const consultaBase: ConsultaDeEvidencia = { pregunta: e.pregunta, maximo: e.maximo }


/**
   * QUIÉN SE CONSULTA Y QUIÉN SÓLO SE DECLARA — lo decide `seleccion.ts`, no
   * esta función. Un proveedor no operativo NO desaparece de la lista: baja al
   * final y produce su sobre `not_configured`, que es lo que hace posible que
   * el médico lea «UpToDate: no se consultó» en vez de no leer nada (#314 p. 9).
   *
   * La instancia de PubMed de esta lista sólo se usa para preguntarle su
   * DISPONIBILIDAD; la recuperación real corre abajo, con su cascada y un
   * testigo por intento.
   */
  const adaptadores: readonly AdaptadorDeEvidencia[] = Object.values(FABRICAS).map(f => f())
  const plan = planDeConsulta(adaptadores, consultaBase)
  const porProveedor = new Map(adaptadores.map(a => [a.proveedor, a] as const))

  const declarados: SobreDeRecuperacion[] = []
  for (const p of plan.aDeclarar) {
    const a = porProveedor.get(p)
    // Ninguno sale a la red: `adaptadorNoConfigurado` ni siquiera conoce una URL.
    if (a) declarados.push(await a.recuperar(consultaBase, ctx))
  }

  const sobrePubMed = await cascadaDePubMed(e, ctx)

  const corpus = corpusParaSintesis([sobrePubMed.sobre, ...declarados])
  const avisos = [
    comoSeLeDiceAlMedico(sobrePubMed.sobre),
    ...declarados.map(comoSeLeDiceAlMedico),
  ]

  // Antigüedad: señal OPERATIVA, no juicio clínico (ver frescura.ts). Se dice
  // cuántas fuentes la cruzan; no se descarta ninguna por vieja.
  const veredictos = frescuraDeSobre(sobrePubMed.sobre, e.ahora)
  const antiguas = veredictos.filter(v => v.veredicto.clase === 'antigua').length
  if (antiguas > 0) {
    avisos.push(
      `${antiguas} de ${veredictos.length} fuente(s) superan el umbral operativo de antigüedad ` +
      `(${UMBRAL_DIAS.literatura} días): puede existir material más reciente.`,
    )
  }

  return {
    estado: sobrePubMed.estado,
    articulos: sobrePubMed.articulos,
    sobre: sobrePubMed.sobre,
    declarados,
    fuentes: corpus.fuentes,
    procedencia: [...corpus.procedencia].map(([sourceId, proveedor]) => ({ sourceId, proveedor })),
    avisos,
    motivo: tieneMaterial(sobrePubMed.sobre) ? null : sobrePubMed.sobre.motivo,
  }
}

// ---------------------------------------------------------------------------
// La cascada
// ---------------------------------------------------------------------------

interface ResultadoDeLaCascada {
  readonly estado: EstadoParaElMedico
  readonly sobre: SobreDeRecuperacion
  readonly articulos: readonly ArticuloPubMed[]
}

async function cascadaDePubMed(
  e: EntradaRecuperacionConsultor,
  ctx: ContextoDeRecuperacion,
): Promise<ResultadoDeLaCascada> {
  const intentos = e.intentos.filter(i => i.terminos.some(t => t.trim()))
  // Sin ningún peldaño utilizable se deja que el adaptador lo diga: con términos
  // vacíos devuelve `not_permitted` con su motivo, que es la verdad.
  const peldanos: readonly IntentoDeBusqueda[] = intentos.length > 0
    ? intentos
    : [{ terminos: [e.pregunta], porQue: 'la pregunta tal cual, cuando no hubo términos utilizables' }]

  let fallo: SobreSinMaterial | null = null
  let cero: SobreConMaterial | null = null

  for (const peldano of peldanos) {
    const r = await unIntento(peldano, e, ctx)
    if (!tieneMaterial(r.sobre)) { fallo = r.sobre; continue }
    // Sin artículos se sigue bajando por la cascada, igual que hacía la ruta.
    if (r.articulos.length === 0) { cero = r.sobre; continue }
    return {
      estado: 'con_evidencia',
      sobre: r.coberturaIncompleta ? conRecorteDeCobertura(r.sobre) : r.sobre,
      articulos: r.articulos,
    }
  }

  // EL FALLO GANA AL CERO (ver encabezado): una pregunta sin contestar no
  // autoriza a afirmar que la literatura no existe.
  if (fallo) return { estado: 'no_consultado', sobre: fallo, articulos: [] }
  if (cero) return { estado: 'sin_resultados', sobre: cero, articulos: [] }
  /* c8 ignore next 2 -- inalcanzable: cada peldaño deja `fallo` o `cero`. */
  throw new Error('cascadaDePubMed terminó sin sobre: es un defecto de este archivo, no de PubMed')
}

interface UnIntento {
  readonly sobre: SobreDeRecuperacion
  readonly articulos: readonly ArticuloPubMed[]
  /** `pubmed.ts` marcó fallo en alguna de sus peticiones, hubiera o no artículos. */
  readonly coberturaIncompleta: boolean
}

async function unIntento(
  peldano: IntentoDeBusqueda,
  e: EntradaRecuperacionConsultor,
  ctx: ContextoDeRecuperacion,
): Promise<UnIntento> {
  const testigo: TestigoPubMed = { fallo: false }
  const capturados: ArticuloPubMed[] = []
  const buscar = peldano.buscar ?? e.buscar ?? BUSQUEDA_REAL

  const adaptador = adaptadorPubMed({
    buscar: async (terminos, opts) => {
      const arts = await buscar(terminos, { ...opts, testigo })
      // AQUÍ ESTÁ EL CABLE. Sin esta línea el sobre saldría `available` con cero
      // fuentes ante una caída de PubMed, que es la mentira que #314 prohíbe.
      if (testigo.fallo && arts.length === 0) throw new Error(PUBMED_NO_CONTESTO)
      capturados.push(...arts)
      return arts
    },
  })

  const consulta: ConsultaDeEvidencia = {
    pregunta: e.pregunta,
    terminos: peldano.terminos,
    maximo: e.maximo,
    ...(peldano.aniosRecientes !== undefined ? { aniosRecientes: peldano.aniosRecientes } : {}),
  }
  return { sobre: await adaptador.recuperar(consulta, ctx), articulos: capturados, coberturaIncompleta: testigo.fallo }
}

/**
 * Degrada un sobre a `partial` cuando la búsqueda se completó a medias.
 *
 * Se reconstruye con la fábrica pública en vez de mutar el objeto: un sobre
 * sólo nace en `contrato.ts`, y ése es justo el invariante que impide
 * fabricar uno a mano. Si la fábrica lo rechazara —no debería: los datos salen
 * de un sobre ya válido— se devuelve el original antes que perder el material.
 */
function conRecorteDeCobertura(s: SobreConMaterial): SobreConMaterial {
  const recorte = s.recorte ? `${s.recorte} · ${RECORTE_DE_COBERTURA}` : RECORTE_DE_COBERTURA
  const r = sobreConMaterial({
    proveedor: s.proveedor,
    estado: 'partial',
    intentadoEn: s.intentadoEn,
    correlacion: s.correlacion,
    telemetria: s.telemetria,
    fuentes: s.fuentes,
    frescura: s.frescura,
    recorte,
  })
  return r.ok ? r.valor : s
}
