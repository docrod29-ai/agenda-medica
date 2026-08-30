/**
 * Adaptador `ArticuloPubMed` → `Source` (Nexus OS E2-01).
 *
 * PORQUÉ EXISTE: hace REAL el modelo de E2-01 sin tocar ninguna ruta ni ningún
 * render. `buscarEvidencia()` ya trae los artículos; esto los convierte en
 * `Source`, que es lo único sobre lo que se pueden anclar pasajes.
 *
 * OJO CON EL IMPORT: `./pubmed` lee `process.env.NCBI_API_KEY` EN EL MOMENTO
 * DEL IMPORT (pubmed.ts:15) y monta una cola de throttle en módulo. Por eso
 * aquí se usa `import type`, que TypeScript BORRA al compilar: así cualquier
 * consumidor de estos tipos no arrastra ese efecto. Un test verifica que la
 * línea siga siendo `import type`.
 *
 * NO SE MAPEA `ArticuloPubMed.tipo` A `DisenoDeEstudio`, A PROPÓSITO. El
 * clasificador de pubmed.ts:61-68 colapsa: 'Meta-análisis' agrupa meta-análisis
 * CON revisiones sistemáticas, y 'ECA' agrupa ensayos aleatorizados CON
 * `clinical trial` a secas (que puede no ser aleatorizado). Traducir esas
 * cubetas a la taxonomía fina inventaría un dato metodológico que la fuente no
 * dio. Extraer el diseño de verdad es E2-02/E2-03.
 */

import type { ArticuloPubMed } from './pubmed'
import {
  fuente, fechaPublicacionDesde,
  type Source, type Resultado, type MotivoRechazoSource,
} from '@/types/evidence'

/**
 * Convierte un artículo de PubMed en un `Source`.
 *
 * `recuperadoEn` se recibe como parámetro (no `new Date()`) para que la función
 * sea pura y determinista: quien hizo la petición es quien sabe cuándo la hizo,
 * y los tests no dependen del reloj.
 *
 * El texto anclable es el RESUMEN público (lo que la ley permite reproducir;
 * ver el encabezado de pubmed.ts). Un artículo sin resumen se RECHAZA con
 * `SIN_TEXTO_RECUPERADO`: sin texto no hay pasajes posibles, y sin pasajes no
 * hay claims — es preferible perder el artículo a fabricar respaldo.
 */
/**
 * LA IDENTIDAD DE LA PUBLICACIÓN, QUE ANTES SE PERDÍA AQUÍ (WS-07, REG-398).
 *
 * `ArticuloPubMed` traía el `doi` desde hacía tiempo y esta función **no lo
 * pasaba**: el `Source` —lo único sobre lo que se anclan pasajes y, por tanto,
 * lo único que respalda una afirmación— nacía sin él. El DOI llegaba a la
 * pantalla por otro camino y no llegaba al modelo, así que una cita anclada no
 * podía exportarse ni verificarse por su identificador estable.
 *
 * El `pmcid` y el acceso abierto no salen del artículo sino de haber ido a PMC,
 * así que se reciben aparte: `textoCompletoPMCConIdentidad` los devuelve. Si
 * nadie los pidió, quedan ausentes — que es lo que hay que decir, y no `false`.
 */
export function sourceDesdeArticuloPubMed(
  a: ArticuloPubMed,
  recuperadoEn: string,
  dePmc?: { pmcid?: string; accesoAbierto?: boolean },
): Resultado<Source, MotivoRechazoSource> {
  const identidad = {
    ...(a.doi ? { doi: a.doi } : {}),
    ...(a.revistaAbrev ? { revistaAbrev: a.revistaAbrev } : {}),
    ...(dePmc?.pmcid ? { pmcid: dePmc.pmcid } : {}),
    ...(dePmc?.accesoAbierto === true ? { accesoAbierto: true as const } : {}),
  }
  return fuente({
    ...(Object.keys(identidad).length ? { identidad } : {}),
    proveedor: 'pubmed',
    idExterno: a.pmid ?? '',
    titulo: a.titulo ?? '',
    contenedor: a.revista || undefined,
    // Sólo el año: PubMed no siempre da más (pubmed.ts:119 extrae <Year>). NO se
    // completa a '-01-01' — eso inventaría once meses de precisión.
    publicado: fechaPublicacionDesde(a.anio),
    recuperadoEn,
    textoRecuperado: a.resumen ?? '',
    url: a.url || undefined,
  })
}
