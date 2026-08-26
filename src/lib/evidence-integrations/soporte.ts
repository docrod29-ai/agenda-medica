/**
 * ══════════════════════════════════════════════════════════════════════════
 * SEPARACIÓN RETRIEVAL → SÍNTESIS y MAPA AFIRMACIÓN↔FUENTE (#314, puntos 3 y 4)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ── LA FRONTERA QUE ESTE ARCHIVO DEFIENDE ───────────────────────────────────
 *
 * Recuperar y sintetizar son dos actos con responsabilidades opuestas:
 *
 *   RECUPERAR  es un hecho verificable. Se consultó PubMed a las 10:04 y trajo
 *              seis resúmenes. Se puede repetir y comprobar.
 *   SINTETIZAR es una redacción. Un modelo de lenguaje leyó esos seis resúmenes
 *              y escribió tres frases en español.
 *
 * El defecto clásico —y el que #314 encarga cerrar— es que la síntesis
 * ARRASTRE autoridad del retrieval: tres frases redactadas por un modelo salen
 * bajo un encabezado que dice «según la literatura» y con seis citas al pie,
 * sin que nadie haya comprobado QUÉ FRASE se apoya en QUÉ RESUMEN. Basta con
 * que la tercera frase sea inventada para que se lea igual de respaldada que
 * las otras dos.
 *
 * ── LO QUE YA EXISTE Y NO SE REESCRIBE ──────────────────────────────────────
 *
 * `src/types/evidence.ts` ya hace cumplir «un `Claim` no existe sin al menos un
 * `Passage` literal», por compilador y por runtime, incluyendo el caso real de
 * `citas: []` que el prompt de producción autoriza hoy. Ese trabajo está hecho
 * y aquí se USA.
 *
 * ── LO QUE FALTABA, Y ES LO QUE HACE ESTE ARCHIVO ───────────────────────────
 *
 *  1. `claimDesde` es TODO-O-NADA por afirmación: devuelve un `Claim` o un
 *     motivo. Pero una síntesis trae VARIAS afirmaciones, y hoy no hay nada que
 *     represente «tres respaldadas y una no». Sin ese objeto, quien llama sólo
 *     puede quedarse con las buenas y tirar la mala EN SILENCIO — que es
 *     exactamente el bug de consulta/page.tsx:2698 un nivel más arriba.
 *     `MapaDeSoporte` conserva las dos listas.
 *
 *  2. Nadie comprobaba de qué SOBRE salió cada fuente. Un pasaje puede ser
 *     literal y aun así venir de un proveedor con rol `descubrimiento`, que por
 *     #314 no puede respaldar nada. Aquí se comprueba.
 *
 *   ╔══════════════════════════════════════════════════════════════════════╗
 *   ║  UNA AFIRMACIÓN NO RESPALDADA NO SE BORRA: SE MARCA.                 ║
 *   ║  BORRARLA ES LO MISMO QUE FINGIR QUE NUNCA SE DIJO.                  ║
 *   ╚══════════════════════════════════════════════════════════════════════╝
 */

import {
  claimDesde,
  type Claim, type Source, type MotivoRechazoClaim,
} from '@/types/evidence'
import {
  tieneMaterial, puedeRespaldar,
  type SobreDeRecuperacion, type SobreConMaterial,
} from './contrato'
import { entradaDeCatalogo, type ProveedorDeEvidencia } from './catalogo'

// ---------------------------------------------------------------------------
// 1. El corpus de la síntesis — lo único que el modelo puede leer
// ---------------------------------------------------------------------------

/**
 * Las fuentes que SÍ pueden respaldar, con el sobre del que salió cada una.
 *
 * Es lo que se le pasa al sintetizador, y es deliberadamente MENOS de lo que se
 * recuperó: el material de descubrimiento y las notas personales quedan fuera
 * de este corpus aunque se hayan recuperado en la misma vuelta.
 */
export interface CorpusParaSintesis {
  /** En ORDEN ESTABLE: los índices 1-basados de las citas apuntan aquí. */
  readonly fuentes: readonly Source[]
  /** De qué proveedor salió cada fuente, por `Source.id`. */
  readonly procedencia: ReadonlyMap<string, ProveedorDeEvidencia>
  /** Sobres que NO aportaron material citable. Se conservan para declararlos. */
  readonly sobresSinAporte: readonly SobreDeRecuperacion[]
}

/**
 * Construye el corpus a partir de los sobres de una vuelta de recuperación.
 *
 * DOS FILTROS, y los dos importan:
 *  · `puedeRespaldar` deja fuera los sobres de rol `descubrimiento` y
 *    `conocimiento_personal` — puntos 7 y 8 de #314;
 *  · los sobres sin material se apartan en `sobresSinAporte` en vez de
 *    descartarse, porque «no se consultó UpToDate» es una frase que el médico
 *    tiene que ver junto a la respuesta, no un dato que se pierde.
 *
 * La deduplicación es por `Source.id` (`proveedor:idExterno`), así que el mismo
 * PMID que llegue por dos caminos ocupa UNA entrada. Si no se dedujera, un
 * artículo repetido inflaría la sensación de respaldo: tres citas al mismo
 * estudio se leen como tres estudios.
 */
export function corpusParaSintesis(sobres: readonly SobreDeRecuperacion[]): CorpusParaSintesis {
  const fuentes: Source[] = []
  const procedencia = new Map<string, ProveedorDeEvidencia>()
  const sobresSinAporte: SobreDeRecuperacion[] = []

  for (const s of sobres) {
    if (!puedeRespaldar(s)) { sobresSinAporte.push(s); continue }
    for (const f of s.fuentes) {
      if (procedencia.has(f.id)) continue
      procedencia.set(f.id, s.proveedor)
      fuentes.push(f)
    }
  }
  // Un sobre `available` de rol `respaldo` que trajo CERO fuentes tampoco
  // aportó nada, y decirlo es información: «PubMed se consultó y no encontró».
  for (const s of sobres) {
    if (puedeRespaldar(s) && s.fuentes.length === 0) sobresSinAporte.push(s)
  }
  return { fuentes, procedencia, sobresSinAporte }
}

// ---------------------------------------------------------------------------
// 2. El mapa de soporte
// ---------------------------------------------------------------------------

/** Una afirmación que SÍ quedó anclada, con de dónde salió su respaldo. */
export interface AfirmacionRespaldada {
  readonly claim: Claim
  /** Proveedores que aportan al menos un pasaje. Sin repetir, orden estable. */
  readonly proveedores: readonly ProveedorDeEvidencia[]
}

/**
 * Una afirmación que el modelo escribió y que NO se pudo anclar.
 *
 * Se conserva ENTERA —con su texto— a propósito. La interfaz decide si la
 * enseña marcada como no verificada o si la esconde, pero esa decisión se toma
 * arriba y con el dato delante. Aquí no se tira nada.
 */
export interface AfirmacionSinRespaldo {
  readonly texto: string
  readonly motivo: MotivoRechazoClaim | 'PROVEEDOR_NO_PUEDE_RESPALDAR'
  readonly detalle: string
}

export interface MapaDeSoporte {
  readonly respaldadas: readonly AfirmacionRespaldada[]
  readonly sinRespaldo: readonly AfirmacionSinRespaldo[]
  /** Sobres que no aportaron, para que la respuesta pueda declararlos. */
  readonly sobresSinAporte: readonly SobreDeRecuperacion[]
}

/**
 * Tasa de afirmaciones sin respaldo. Es una de las métricas obligatorias del
 * punto 11 de #314. Con cero afirmaciones devuelve 0 y no `NaN`: una síntesis
 * vacía no tiene afirmaciones inventadas.
 */
export function tasaSinRespaldo(m: MapaDeSoporte): number {
  const total = m.respaldadas.length + m.sinRespaldo.length
  return total === 0 ? 0 : m.sinRespaldo.length / total
}

/**
 * Construye el mapa de soporte de una síntesis contra su corpus.
 *
 * `crudas` es lo que devuelve el modelo, con la forma que YA usa la ruta de
 * producción (`{texto, citas:[n], pasajes:[...]}`,
 * src/app/api/expediente/evidencia/route.ts:153). Se reutiliza esa forma para
 * que enchufar esto a la ruta no exija cambiarle el prompt.
 *
 * TRES COMPROBACIONES, en este orden:
 *  1. `claimDesde` — pasaje literal, cita en rango, cifra presente. Ya existía.
 *  2. procedencia — cada pasaje viene de una fuente que PUEDE respaldar.
 *  3. nada se descarta en silencio: lo que falla acaba en `sinRespaldo`.
 */
export function mapaDeSoporte(
  crudas: readonly unknown[],
  corpus: CorpusParaSintesis,
): MapaDeSoporte {
  const respaldadas: AfirmacionRespaldada[] = []
  const sinRespaldo: AfirmacionSinRespaldo[] = []

  for (const cruda of crudas) {
    const texto = textoDe(cruda)
    const r = claimDesde(cruda, corpus.fuentes)
    if (!r.ok) {
      sinRespaldo.push({ texto, motivo: r.motivo, detalle: r.detalle })
      continue
    }
    // El pasaje es literal, pero ¿de dónde salió la fuente? Un `Source` es
    // sólo un documento: no lleva escrito si su proveedor podía respaldar.
    const proveedores: ProveedorDeEvidencia[] = []
    let ilegitimo: string | null = null
    for (const apoyo of r.valor.apoyos) {
      const p = corpus.procedencia.get(apoyo.sourceId)
      if (!p) {
        ilegitimo = `el pasaje apunta a la fuente "${apoyo.sourceId}", que no está en el corpus de esta síntesis`
        break
      }
      if (entradaDeCatalogo(p).rol !== 'respaldo') {
        ilegitimo = `la fuente "${apoyo.sourceId}" viene de ${entradaDeCatalogo(p).nombre}, cuyo rol es "${entradaDeCatalogo(p).rol}": orienta la búsqueda, no respalda la afirmación`
        break
      }
      if (!proveedores.includes(p)) proveedores.push(p)
    }
    if (ilegitimo) {
      sinRespaldo.push({ texto, motivo: 'PROVEEDOR_NO_PUEDE_RESPALDAR', detalle: ilegitimo })
      continue
    }
    respaldadas.push({ claim: r.valor, proveedores })
  }
  return { respaldadas, sinRespaldo, sobresSinAporte: corpus.sobresSinAporte }
}

function textoDe(cruda: unknown): string {
  if (typeof cruda === 'object' && cruda !== null) {
    const t = (cruda as { texto?: unknown }).texto
    if (typeof t === 'string') return t.trim()
  }
  return '(afirmación sin texto)'
}

// ---------------------------------------------------------------------------
// 3. Lo que la respuesta tiene que decir SIEMPRE
// ---------------------------------------------------------------------------

/**
 * Frases de degradación explícita, una por sobre que no aportó.
 *
 * Existe para que ninguna pantalla improvise. El punto 9 de #314 es
 * inaplicable si cada sitio inventa su forma de decir «faltó una fuente»:
 * alguna acabará no diciéndolo.
 */
export function avisosDeDegradacion(m: MapaDeSoporte): readonly string[] {
  const avisos: string[] = []
  for (const s of m.sobresSinAporte) {
    if (tieneMaterial(s)) {
      avisos.push(`${entradaDeCatalogo(s.proveedor).nombre}: se consultó y no encontró resultados para esta búsqueda.`)
      continue
    }
    avisos.push(`${entradaDeCatalogo(s.proveedor).nombre}: NO SE CONSULTÓ — ${s.motivo}`)
  }
  if (m.sinRespaldo.length > 0) {
    avisos.push(`${m.sinRespaldo.length} afirmación(es) de la síntesis no quedaron ancladas a un pasaje de la literatura recuperada y NO deben leerse como respaldadas.`)
  }
  return avisos
}

/**
 * ¿Puede esta respuesta presentarse como «respaldada por la literatura»?
 *
 * Sólo si hay al menos una afirmación anclada Y ninguna sin anclar. Es
 * deliberadamente estricto: una respuesta con tres afirmaciones buenas y una
 * inventada NO es una respuesta respaldada — es una respuesta con una
 * afirmación inventada dentro, y presentarla como respaldada es el fallo que
 * #314 encarga cerrar.
 */
export function esRespuestaRespaldada(m: MapaDeSoporte): boolean {
  return m.respaldadas.length > 0 && m.sinRespaldo.length === 0
}

/** Sobres con material citable de un lote. Útil para el orquestador y el benchmark. */
export function sobresConAporte(sobres: readonly SobreDeRecuperacion[]): readonly SobreConMaterial[] {
  return sobres.filter((s): s is SobreConMaterial => puedeRespaldar(s) && s.fuentes.length > 0)
}
