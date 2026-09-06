/**
 * ¿LO QUE DICE EL ANÁLISIS ESTÁ DE VERDAD EN EL ARTÍCULO QUE CITA?
 *
 * ── QUÉ NO SE COMPROBABA (P1-19) ─────────────────────────────────────────────
 *
 * La ruta de evidencia de la consulta pedía al modelo afirmaciones con
 * `citas: [n]` y comprobaba **una sola cosa**: que `n` estuviera dentro del
 * rango de artículos. Nada más.
 *
 * Es decir: un `[2]` que apunte a un artículo **que dice lo contrario** pasaba.
 * Y pasaba con la peor apariencia posible — una afirmación clínica con su
 * número de cita al lado, que es exactamente el formato que un médico lee como
 * «esto está respaldado».
 *
 * La maquinaria para comprobarlo de verdad —`mapaDeSoporte`,
 * `esRespuestaRespaldada`, `tasaSinRespaldo`— **existía, estaba probada y tenía
 * cero llamadores fuera de pruebas**. Su propio encabezado decía que se había
 * escrito reutilizando la forma de esta ruta «para que enchufarlo no exija
 * cambiarle el prompt». Nadie lo enchufó.
 *
 * ── POR QUÉ HACÍA FALTA TOCAR EL PROMPT DE TODOS MODOS ──────────────────────
 *
 * `claimDesde` exige el **pasaje literal**: el trozo de texto del artículo que
 * respalda la frase. Sin él no hay nada que verificar — sólo un número. Así que
 * al modelo hay que **pedirle que cite el texto**, no sólo el número.
 *
 * Eso además cambia lo que el modelo hace: obligarle a copiar la frase que lo
 * respalda es la forma más barata que existe de que no invente el respaldo.
 *
 * ── QUÉ SE HACE CON LO NO RESPALDADO — Y POR QUÉ NO SE BORRA ────────────────
 *
 * **No se borra.** Una afirmación sin respaldo bibliográfico puede seguir siendo
 * buen razonamiento clínico —consenso, fisiopatología, experiencia— y borrarla
 * le quitaría al médico algo que quizá necesita. Lo que no puede es **seguir
 * pareciendo respaldada**.
 *
 * Se marca. El médico decide, que es la regla de la casa: la IA sugiere, el
 * médico confirma.
 *
 * Módulo PURO: no hace red, no escribe nada.
 */
import { fuente, fechaPublicacionDesde, type Source } from '@/types/evidence'
import { mapaDeSoporte, esRespuestaRespaldada, tasaSinRespaldo } from '@/lib/evidence-integrations/soporte'
import type { ProveedorDeEvidencia } from '@/lib/evidence-integrations/catalogo'
import {
  procedenciaDelPasaje, normalizarEtiqueta, NO_SE_SABE,
  type Procedencia, type ParteDelResumen,
} from '@/lib/evidencia/de-donde-sale-el-pasaje'

/** Lo mínimo de un artículo de PubMed para poder anclar un pasaje. */
import {
  contradiccionesEntre, comoSeDice as comoSeDiceLaContradiccion,
  type Contradiccion,
} from './la-cita-dice-lo-contrario'

export interface ArticuloCitable {
  readonly pmid: string
  readonly titulo: string
  readonly revista?: string
  readonly anio?: string | number
  readonly resumen: string
  /**
   * Las partes del resumen estructurado, si las hubo (REG-400). Sirven para
   * decir de QUÉ parte del artículo sale una cita — los antecedentes de un
   * estudio no son sus hallazgos. Ausente = el resumen no venía estructurado.
   */
  readonly secciones?: readonly { etiqueta: string; texto: string }[]
}

/** Una afirmación tal como la devuelve el modelo. */
export interface AfirmacionCruda {
  readonly texto?: unknown
  readonly citas?: unknown
  readonly pasajes?: unknown
}

/** Una cita anclada cuyo pasaje NO sale de los hallazgos del estudio. */
export interface CitaFueraDeLosHallazgos {
  readonly texto: string
  readonly pmid: string
  readonly procedencia: Procedencia
}

/**
 * Una cita ANCLADA cuyo pasaje contradice a la afirmación que respalda.
 *
 * El tercero y peor de los defectos de cita: existe, es literal, sale de los
 * hallazgos —pasa las tres compuertas anteriores— y dice lo contrario.
 */
export interface CitaContradicha {
  readonly texto: string
  readonly pmid: string
  readonly contradicciones: readonly Contradiccion[]
  /** Cómo se le dice al médico, sin decidir quién tiene razón. */
  readonly frase: string
}

export interface Verificacion {
  /** true = toda afirmación citada quedó anclada a un pasaje literal. */
  readonly respaldada: boolean
  /** Proporción de afirmaciones sin anclar, 0..1. */
  readonly tasaSinRespaldo: number
  /** El texto de las que NO quedaron ancladas, con su motivo, para marcarlas. */
  readonly sinRespaldo: readonly { texto: string; motivo: string; detalle: string }[]
  /** Cuántas quedaron ancladas. */
  readonly respaldadas: number
  /** false = no se pudo verificar (sin fuentes utilizables). NO es «no respaldada». */
  readonly sePudoVerificar: boolean
  /**
   * Citas ANCLADAS cuyo pasaje sale de los antecedentes, el objetivo o los
   * métodos (REG-400).
   *
   * No están «sin respaldo»: el pasaje existe y es literal. Lo que pasa es que
   * viene de la parte del artículo que **no demuestra nada** — lo que se creía
   * antes, lo que se quería averiguar o cómo se hizo—. Se marcan aparte porque
   * son un problema distinto y se arreglan distinto.
   */
  readonly fueraDeLosHallazgos: readonly CitaFueraDeLosHallazgos[]
  /**
   * Citas ancladas cuyo pasaje NIEGA lo que la afirmación asevera (o al revés).
   *
   * Aparte de las otras dos, por la misma razón que ellas están aparte entre sí:
   * son tres defectos distintos que se arreglan distinto. Éste es el único que
   * se ve MÁS respaldado cuanto más se comprueba.
   */
  readonly contradichasPorSuPasaje: readonly CitaContradicha[]
}

/**
 * Convierte los artículos en `Source` anclables.
 *
 * El texto sobre el que se ancla es **el resumen** (más el texto completo de PMC
 * cuando la licencia lo permitió, REG-357), que es lo que se le enseñó al
 * modelo. Anclar contra un texto que el modelo no vio sería pedirle que cite lo
 * que no leyó.
 *
 * Los que no se pueden construir se descartan **y se cuentan**: si no queda
 * ninguno, la respuesta es «no se pudo verificar», que no es lo mismo que «no
 * está respaldada».
 */
export function fuentesDeArticulos(
  articulos: readonly ArticuloCitable[],
  recuperadoEn: string,
): Source[] {
  const out: Source[] = []
  for (const a of articulos) {
    const r = fuente({
      proveedor: 'pubmed',
      idExterno: String(a.pmid ?? '').trim(),
      titulo: String(a.titulo ?? '').trim(),
      ...(a.revista ? { contenedor: String(a.revista) } : {}),
      // `fechaPublicacionDesde` NUNCA adivina: sin año reconocible sale
      // `desconocida`, que es la verdad.
      publicado: fechaPublicacionDesde(a.anio === undefined || a.anio === null ? '' : String(a.anio)),
      recuperadoEn,
      textoRecuperado: String(a.resumen ?? ''),
    })
    if (r.ok) out.push(r.valor)
  }
  return out
}

/**
 * Verifica las afirmaciones contra los artículos que citan.
 *
 * El ORDEN de `articulos` es el que se le enseñó al modelo: `citas[i] = n`
 * significa «el n-ésimo de esa lista», 1-based. Cambiarlo aquí desalinearía
 * todas las citas a la vez, así que no se reordena.
 */
export function verificarAfirmaciones(
  afirmaciones: readonly AfirmacionCruda[],
  articulos: readonly ArticuloCitable[],
  recuperadoEn: string,
): Verificacion {
  const fuentes = fuentesDeArticulos(articulos, recuperadoEn)
  if (fuentes.length === 0 || afirmaciones.length === 0) {
    return {
      respaldada: false, tasaSinRespaldo: 0, sinRespaldo: [], respaldadas: 0,
      fueraDeLosHallazgos: [], contradichasPorSuPasaje: [],
      // Sin fuentes anclables no se puede verificar. Decir «no respaldada» aquí
      // sería convertir «no lo sé» en un juicio sobre el análisis.
      sePudoVerificar: false,
    }
  }
  const procedencia = new Map<string, ProveedorDeEvidencia>(fuentes.map(f => [f.id, 'pubmed' as ProveedorDeEvidencia]))
  const mapa = mapaDeSoporte(afirmaciones, { fuentes, procedencia, sobresSinAporte: [] })
  return {
    respaldada: esRespuestaRespaldada(mapa),
    tasaSinRespaldo: tasaSinRespaldo(mapa),
    sinRespaldo: mapa.sinRespaldo.map(s => ({ texto: s.texto, motivo: s.motivo, detalle: s.detalle })),
    respaldadas: mapa.respaldadas.length,
    sePudoVerificar: true,
    fueraDeLosHallazgos: citasFueraDeLosHallazgos(afirmaciones, articulos),
    contradichasPorSuPasaje: citasQueDicenLoContrario(afirmaciones, articulos),
  }
}

/** Las partes con etiqueta de un artículo, ya normalizadas. */
function partesDe(a: ArticuloCitable): ParteDelResumen[] {
  return (a.secciones ?? [])
    .filter(s => s.etiqueta?.trim())
    .map(s => ({ seccion: normalizarEtiqueta(s.etiqueta), etiqueta: s.etiqueta, texto: s.texto }))
}

/**
 * Qué citas ancladas salen de una parte del artículo que no demuestra nada.
 *
 * **No decide si la afirmación es cierta.** Dice de dónde salió la frase que la
 * respalda, que es lo único que se puede saber sin un modelo (ver
 * `POR_QUE_NO_ES_ENTAILMENT`).
 *
 * Se recorren los pasajes tal cual los devolvió el modelo: si una afirmación
 * cita dos artículos y sólo uno de los pasajes viene de los antecedentes, se
 * marca ese, no la afirmación entera.
 */
export function citasFueraDeLosHallazgos(
  afirmaciones: readonly AfirmacionCruda[],
  articulos: readonly ArticuloCitable[],
): CitaFueraDeLosHallazgos[] {
  const out: CitaFueraDeLosHallazgos[] = []
  for (const af of afirmaciones) {
    const texto = typeof af.texto === 'string' ? af.texto : ''
    const pasajes = Array.isArray(af.pasajes) ? af.pasajes : []
    const citas = Array.isArray(af.citas) ? af.citas : []
    for (let i = 0; i < pasajes.length; i++) {
      const pasaje = typeof pasajes[i] === 'string' ? (pasajes[i] as string) : ''
      if (!pasaje.trim()) continue
      /**
       * `citas[i] = n` es 1-based sobre la lista que se le enseñó al modelo.
       * Cuando hay un solo artículo citado y varios pasajes, todos son de él.
       */
      const n = Number(citas[i] ?? citas[0])
      const a = Number.isFinite(n) ? articulos[n - 1] : undefined
      if (!a) continue
      const partes = partesDe(a)
      if (partes.length === 0) continue   // sin estructura: NO_SE_SABE, no se marca
      const p = procedenciaDelPasaje(pasaje, partes)
      if (p === NO_SE_SABE || p.sostiene) continue
      out.push({ texto, pmid: a.pmid, procedencia: p })
    }
  }
  return out
}

/**
 * Qué citas ancladas dicen lo CONTRARIO de la afirmación que respaldan.
 *
 * Mismo recorrido que `citasFueraDeLosHallazgos` —pasaje a pasaje, resolviendo
 * el artículo por el índice que devolvió el modelo— porque es la misma unidad de
 * análisis: si una afirmación cita dos artículos y sólo uno la contradice, se
 * marca ese, no la afirmación entera.
 *
 * A diferencia de aquélla, **no necesita que el resumen venga estructurado**: la
 * polaridad se lee del pasaje tal cual, así que también protege a los artículos
 * sin secciones, que son justo los que la comprobación de REG-400 no puede mirar.
 */
export function citasQueDicenLoContrario(
  afirmaciones: readonly AfirmacionCruda[],
  articulos: readonly ArticuloCitable[],
): CitaContradicha[] {
  const out: CitaContradicha[] = []
  for (const af of afirmaciones) {
    const texto = typeof af.texto === 'string' ? af.texto : ''
    if (!texto.trim()) continue
    const pasajes = Array.isArray(af.pasajes) ? af.pasajes : []
    const citas = Array.isArray(af.citas) ? af.citas : []
    for (let i = 0; i < pasajes.length; i++) {
      const pasaje = typeof pasajes[i] === 'string' ? (pasajes[i] as string) : ''
      if (!pasaje.trim()) continue
      const n = Number(citas[i] ?? citas[0])
      const a = Number.isFinite(n) ? articulos[n - 1] : undefined
      if (!a) continue
      const choques = contradiccionesEntre(texto, pasaje)
      if (choques.length === 0) continue
      out.push({
        texto,
        pmid: a.pmid,
        contradicciones: choques,
        frase: choques.map(comoSeDiceLaContradiccion).join('; '),
      })
    }
  }
  return out
}

export const POR_QUE_LA_CONTRADICCION_ES_EL_TERCER_DEFECTO =
  'Una cita sin anclar no existe en el artículo. Una anclada en los antecedentes ' +
  'existe pero no demuestra nada. Una CONTRADICHA existe, es literal, sale de los ' +
  'hallazgos —pasa las dos compuertas anteriores— y dice lo opuesto. Es el único ' +
  'de los tres que se ve MÁS respaldado cuanto más se comprueba, y por eso se ' +
  'cuenta aparte en vez de esconderse dentro de los otros dos.'

export const POR_QUE_NO_SE_BORRA_LO_NO_RESPALDADO =
  'Una afirmación sin respaldo bibliográfico puede seguir siendo buen ' +
  'razonamiento clínico —consenso, fisiopatología, experiencia— y borrarla le ' +
  'quitaría al médico algo que quizá necesita. Lo que no puede es seguir ' +
  'PARECIENDO respaldada. Se marca; el médico decide.'

export const POR_QUE_FUERA_DE_LOS_HALLAZGOS_ES_OTRO_PROBLEMA =
  'Una cita sin anclar es una cita que no existe en el artículo: el modelo se la ' +
  'inventó. Una cita anclada en los ANTECEDENTES existe, es literal, y aun así no ' +
  'demuestra nada — es lo que se creía antes de hacer el estudio, a veces justo lo ' +
  'que vino a refutar. Son dos defectos distintos, se cuentan aparte y se ' +
  'arreglan distinto; mezclarlos escondería el segundo dentro del primero.'

/**
 * QUÉ CITAS DICEN OTRA COSA QUE SU PASAJE — REG-532.
 *
 * No mira los artículos: compara la afirmación con **el pasaje que el propio
 * modelo devolvió como respaldo**. Si ese pasaje niega el resultado, o lo dice
 * con reservas que la frase quitó, se marca.
 *
 * Va sobre los pasajes tal cual llegaron, igual que `citasFueraDeLosHallazgos`:
 * si una afirmación cita dos artículos y sólo uno de los pasajes la contradice,
 * se marca ese.
 */

/**
 * EL HUECO QUE ESTA CAPA **NO** CUBRE, Y QUE NO SE PIERDE (REG-560).
 *
 * `citasQueDicenLoContrario` caza la POLARIDAD invertida: la frase afirma un
 * efecto y el pasaje lo niega. No caza el otro medio defecto, que la rama
 * paralela sí había construido y que aquí se declara en vez de duplicarse:
 *
 *     el pasaje dice lo mismo, pero CON RESERVAS que la frase quitó
 *     («podría reducir», «sugiere una tendencia» → «reduce»).
 *
 * No es lo contrario, y por eso el detector de polaridad lo deja pasar. Es una
 * afirmación más fuerte que su fuente, que es como se cita mal de buena fe.
 *
 * Se declara aquí, con nombre, para que el día que se construya nadie tenga que
 * volver a descubrirlo — y para que hoy nadie lea el silencio como cobertura.
 */
export const LO_QUE_LA_POLARIDAD_NO_CAZA =
  'NO se detecta el pasaje que dice lo mismo CON RESERVAS que la frase quitó '
  + '(«podría reducir» citado como «reduce»). No es polaridad invertida: es una '
  + 'afirmación más fuerte que su fuente. Ausencia de marca NO es respaldo.'
