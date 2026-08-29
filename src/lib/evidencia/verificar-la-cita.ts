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

/** Lo mínimo de un artículo de PubMed para poder anclar un pasaje. */
export interface ArticuloCitable {
  readonly pmid: string
  readonly titulo: string
  readonly revista?: string
  readonly anio?: string | number
  readonly resumen: string
}

/** Una afirmación tal como la devuelve el modelo. */
export interface AfirmacionCruda {
  readonly texto?: unknown
  readonly citas?: unknown
  readonly pasajes?: unknown
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
  }
}

export const POR_QUE_NO_SE_BORRA_LO_NO_RESPALDADO =
  'Una afirmación sin respaldo bibliográfico puede seguir siendo buen ' +
  'razonamiento clínico —consenso, fisiopatología, experiencia— y borrarla le ' +
  'quitaría al médico algo que quizá necesita. Lo que no puede es seguir ' +
  'PARECIENDO respaldada. Se marca; el médico decide.'
