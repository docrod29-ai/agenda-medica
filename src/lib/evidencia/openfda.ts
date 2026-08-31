/**
 * Cliente openFDA (api.fda.gov) — ficha técnica de fármacos, GRATIS y sin llave.
 *
 * Da la DOSIS oficial etiquetada (dosage_and_administration) de un fármaco, para
 * que la app dé dosis AUTORITATIVA (de la etiqueta aprobada) y no una inventada
 * por la IA. Es etiquetado de EE.UU. (FDA); la farmacología/dosis coincide en su
 * mayoría con la práctica mexicana, pero SIEMPRE debe verificarse contra la GPC
 * local / el Cuadro Básico. Rate limit ~40 req/min sin llave.
 */
import { fetchConTimeout, TIMEOUT } from '@/lib/fetch-con-timeout'
import { permiteLlamar, anotarVeredicto } from '@/lib/red/interruptor'
import { exigeQueSeBaje } from '@/lib/evidence-integrations/de-donde-se-baja'
import {
  claveCircuitoEvidencia, veredictoDeRespuestaEvidencia, veredictoDeExcepcionEvidencia,
  anotarQueLaRespuestaSirvio,
} from '@/lib/evidencia/fallo-del-proveedor'

const FDA = 'https://api.fda.gov/drug/label.json'

export interface DosisFDA {
  farmaco: string
  dosis: string          // texto de dosificación (recortado)
  url: string            // enlace a openFDA para el fármaco
}

/**
 * REG-391 — este `fetch` no tenía tiempo máximo NINGUNO.
 *
 * `dosisFDA` se llama desde `consultor-evidencia` (`maxDuration = 300`) y por
 * partida triple, en paralelo. Un socket colgado de api.fda.gov inmovilizaba la
 * función los 300 segundos completos, facturados por GB-segundo, con el médico
 * mirando una barra de progreso. Es exactamente el fallo para el que se escribió
 * `fetch-con-timeout` (REG-346), y este módulo se quedó fuera.
 *
 * Devolver `null` sigue siendo lo correcto aquí: quien llama ya trata la
 * ausencia de etiqueta como «no hay dosis oficial», que es cierto tanto si el
 * fármaco no está en openFDA como si openFDA no contestó. Lo que NO puede pasar
 * es que la app **invente** una dosis, y eso no depende de este módulo.
 */
async function pedir(url: string): Promise<Record<string, unknown> | null> {
  const clave = claveCircuitoEvidencia('openfda')
  if (!permiteLlamar(clave).pasa) return null
  try {
    /* WS-06 — misma puerta que PubMed: el host, declarado, antes de salir. */
    exigeQueSeBaje(url)
    const r = await fetchConTimeout(url, {}, TIMEOUT.evidencia)
    if (!r.ok) { anotarVeredicto(clave, veredictoDeRespuestaEvidencia(r.status)); return null }
    /**
     * REG-435 · el éxito se anota DESPUÉS de leer el cuerpo, no al ver el 200.
     *
     * `'contesto'` cierra el circuito y borra los fallos anteriores. Anotándolo
     * aquí arriba, api.fda.gov devolviendo 200 con una página de error —lo que
     * hace un balanceador cuando el origen se cae— reseteaba su propio
     * interruptor en cada intento: medido, 40 peticiones y ningún circuito,
     * frente a 3 peticiones con un 503 honesto.
     */
    let cuerpo: Record<string, unknown>
    try {
      cuerpo = await r.json()
    } catch {
      /**
       * Un 200 cuyo cuerpo no es JSON no es la API de openFDA contestando: es
       * un balanceador contestando por ella. Cuenta como caída — si no, esta
       * degradación no abriría el circuito nunca, que es lo que se midió.
       */
      anotarVeredicto(clave, 'el_proveedor_no_esta')
      return null
    }
    anotarQueLaRespuestaSirvio('openfda')
    return cuerpo
  } catch (e) {
    anotarVeredicto(clave, veredictoDeExcepcionEvidencia(e))
    return null
  }
}

/**
 * Dosis etiquetada de un fármaco (nombre genérico en INGLÉS: 'amoxicillin').
 * Prefiere la etiqueta de ingrediente único (evita combinaciones). null si no hay.
 */
export async function dosisFDA(farmacoEn: string): Promise<DosisFDA | null> {
  const drug = farmacoEn.trim().toLowerCase()
  if (!drug || /[^a-z0-9 -]/.test(drug)) return null

  // 1) Búsqueda exacta por genérico (mayúsculas = campo .exact de openFDA).
  const exact = await pedir(`${FDA}?search=openfda.generic_name.exact:"${encodeURIComponent(drug.toUpperCase())}"&limit=5`)
  // 2) Respaldo: búsqueda amplia.
  const amplio = exact?.results ? exact : await pedir(`${FDA}?search=openfda.generic_name:"${encodeURIComponent(drug)}"&limit=5`)

  const results = (amplio?.results as Array<Record<string, unknown>> | undefined) ?? []
  if (results.length === 0) return null

  // Prefiere la etiqueta cuyo genérico sea SOLO este fármaco (no combinación).
  const esUnico = (r: Record<string, unknown>) => {
    const g = (r.openfda as { generic_name?: string[] } | undefined)?.generic_name ?? []
    return g.length === 1 && g[0].toLowerCase().includes(drug)
  }
  const elegido = results.find(esUnico) ?? results[0]
  const da = (elegido.dosage_and_administration as string[] | undefined)
  if (!Array.isArray(da) || da.length === 0) return null

  // Limpia el encabezado numérico ("2 DOSAGE AND ADMINISTRATION …") y recorta.
  const dosis = da.join(' ').replace(/^\s*\d+(\.\d+)?\s+DOSAGE AND ADMINISTRATION\s*/i, '').replace(/\s+/g, ' ').trim().slice(0, 900)
  if (!dosis) return null

  return { farmaco: drug, dosis, url: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=BasicSearch.process&searchTerm=${encodeURIComponent(drug)}` }
}
