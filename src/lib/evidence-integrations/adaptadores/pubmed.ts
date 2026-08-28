/**
 * ADAPTADOR PubMed — el único proveedor REAL y operativo de #314 hoy.
 *
 * PORQUÉ NO SE TOCA `src/lib/evidencia/pubmed.ts`. Ese módulo lleva en
 * producción un arreglo probado en vivo: una cola de throttle que nació de un
 * fallo real («a veces no salen citas», por 429 del NCBI). Reescribirlo para
 * que devuelva sobres sería cambiar código que funciona por código que todavía
 * no. Aquí sólo se le pone un ENVOLTORIO delante: el retrieval no cambia ni un
 * carácter. Mismo criterio que `buscar-con-pico.ts` y `desde-pubmed.ts`.
 *
 * QUÉ APORTA EL ENVOLTORIO, que es justamente lo que hoy se pierde:
 *
 *  1. `buscarEvidencia` devuelve `ArticuloPubMed[]`. Un array vacío significa
 *     hoy DOS cosas incompatibles —«PubMed dijo que no hay nada» y «PubMed no
 *     contestó»— y el llamador no puede distinguirlas. Aquí se separan en
 *     `available` con cero fuentes y `unavailable` con motivo.
 *  2. Convierte cada artículo en `Source` canónico con
 *     `sourceDesdeArticuloPubMed` (que YA existía, sin llamador hasta ahora).
 *  3. Registra latencia, que es lo que el benchmark de #314 necesita medir.
 *
 * ── EL DETALLE QUE PARECE MENOR Y NO LO ES ──────────────────────────────────
 *
 * Un artículo SIN RESUMEN se rechaza (`sourceDesdeArticuloPubMed` devuelve
 * `SIN_TEXTO_RECUPERADO`). Eso significa que la cuenta de artículos que trajo
 * PubMed y la cuenta de fuentes citables NO COINCIDEN, y esa diferencia se
 * declara como `partial` con su recorte. Si se silenciara, el médico creería
 * que se revisó material que en realidad se descartó por no tener texto que
 * anclar.
 */

import { buscarEvidenciaMulti, type ArticuloPubMed } from '@/lib/evidencia/pubmed'
import { sourceDesdeArticuloPubMed } from '@/lib/evidencia/desde-pubmed'
import type { Source } from '@/types/evidence'
import {
  sobreConMaterial, sobreSinMaterial,
  type AdaptadorDeEvidencia, type ConsultaDeEvidencia, type ContextoDeRecuperacion,
  type SobreDeRecuperacion, type DisponibilidadDeclarada, type ClaseDeFallo,
} from '../contrato'

/** Función de búsqueda inyectable: los tests no salen a la red. */
export type BuscarArticulos = (
  terminos: readonly string[],
  opts: { max?: number; aniosRecientes?: number; signal?: AbortSignal },
) => Promise<ArticuloPubMed[]>

/**
 * Traduce un error de red en una clase de fallo. Conservador a propósito:
 * lo que no se reconoce es `desconocido`, no `red`. Clasificar de más ensucia
 * la telemetría con certezas falsas.
 */
export function claseDeFalloDeRed(e: unknown): ClaseDeFallo {
  const nombre = (e as { name?: string } | null)?.name ?? ''
  const msg = String((e as { message?: string } | null)?.message ?? e ?? '')
  if (nombre === 'AbortError' || nombre === 'TimeoutError' || /timeout|abort/i.test(msg)) return 'timeout'
  if (/429|rate limit|too many requests/i.test(msg)) return 'limite_de_tasa'
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|network/i.test(msg)) return 'red'
  return 'desconocido'
}

/**
 * Términos que se le mandan al buscador.
 *
 * Se prefieren los `terminos` ya estructurados (p. ej. los que produce el
 * extractor PICO de `src/lib/evidencia/pico.ts`) y sólo se cae a la pregunta
 * cruda si no los hay. NO se inventa una traducción a sintaxis MeSH aquí: eso
 * ya tiene dueño y hacerlo dos veces produciría dos búsquedas distintas para la
 * misma pregunta.
 */
function terminosDe(c: ConsultaDeEvidencia): readonly string[] {
  const t = (c.terminos ?? []).map(x => x.trim()).filter(Boolean)
  return t.length > 0 ? t : [c.pregunta.trim()].filter(Boolean)
}

export interface OpcionesPubMed {
  /** Inyectable para pruebas; por defecto el retrieval real ya existente. */
  readonly buscar?: BuscarArticulos
}

export function adaptadorPubMed(o: OpcionesPubMed = {}): AdaptadorDeEvidencia {
  const buscar: BuscarArticulos = o.buscar
    ?? ((terminos, opts) => buscarEvidenciaMulti([...terminos], opts))

  return {
    proveedor: 'pubmed',

    /**
     * PubMed es público: siempre operativo. `NCBI_API_KEY` sólo eleva el límite
     * de tasa, así que su ausencia NO se reporta como falta de credencial —
     * decirlo sería sugerir que hace falta contratar algo que no hace falta.
     */
    disponibilidad(): DisponibilidadDeclarada {
      return { operativo: true }
    },

    async recuperar(c: ConsultaDeEvidencia, ctx: ContextoDeRecuperacion): Promise<SobreDeRecuperacion> {
      const terminos = terminosDe(c)
      const inicio = Date.now()

      if (terminos.length === 0) {
        return exigir(sobreSinMaterial({
          proveedor: 'pubmed', estado: 'not_permitted', intentadoEn: ctx.ahora,
          correlacion: ctx.correlacion, telemetria: { latenciaMs: 0 },
          motivo: 'no se consultó PubMed: la pregunta llegó vacía y una búsqueda sin términos devuelve ruido, no evidencia.',
          clase: 'politica_del_repo',
        }))
      }

      let articulos: ArticuloPubMed[]
      try {
        articulos = await buscar(terminos, {
          max: c.maximo,
          ...(c.aniosRecientes !== undefined ? { aniosRecientes: c.aniosRecientes } : {}),
          ...(ctx.signal ? { signal: ctx.signal } : {}),
        })
      } catch (e) {
        // EL PUNTO 9 DE #314, EN CUATRO LÍNEAS: el fallo se declara, no se
        // convierte en silencio ni en lista vacía.
        return exigir(sobreSinMaterial({
          proveedor: 'pubmed', estado: 'unavailable', intentadoEn: ctx.ahora,
          correlacion: ctx.correlacion, telemetria: { latenciaMs: Date.now() - inicio },
          motivo: 'PubMed no respondió a esta búsqueda. La evidencia mostrada NO incluye literatura indexada; no es que no exista.',
          clase: claseDeFalloDeRed(e),
        }))
      }

      const fuentes: Source[] = []
      const descartados: string[] = []
      for (const a of articulos) {
        const r = sourceDesdeArticuloPubMed(a, ctx.ahora)
        if (r.ok) { fuentes.push(r.valor); continue }
        // Se guarda el MOTIVO, no sólo la cuenta: «12 sin resumen» y «12
        // sin PMID» son problemas distintos con arreglos distintos.
        descartados.push(r.motivo)
      }

      const latenciaMs = Date.now() - inicio
      // Descartar es legítimo (un artículo sin resumen no puede anclar nada),
      // pero NO es gratis: el sobre pasa a `partial` para que la diferencia
      // entre «lo que trajo PubMed» y «lo que se puede citar» quede escrita.
      const hayRecorte = descartados.length > 0
      return exigir(sobreConMaterial({
        proveedor: 'pubmed',
        estado: hayRecorte ? 'partial' : 'available',
        intentadoEn: ctx.ahora,
        correlacion: ctx.correlacion,
        telemetria: { latenciaMs, totalDeclarado: articulos.length },
        fuentes,
        // PubMed da fecha de PUBLICACIÓN, no de revisión: no hay frescura de
        // fuente que declarar y decirlo es más honesto que omitirlo.
        frescura: { ausenciaPorque: 'proveedor_no_lo_expone' },
        ...(hayRecorte
          ? { recorte: `${descartados.length} de ${articulos.length} artículo(s) no son citables (${resumirMotivos(descartados)}): sin texto recuperado no se puede anclar ningún pasaje.` }
          : {}),
      }))
    },
  }
}

/** `SIN_TEXTO_RECUPERADO×3, SIN_TITULO×1` — cuenta por motivo, orden estable. */
function resumirMotivos(motivos: readonly string[]): string {
  const cuenta = new Map<string, number>()
  for (const m of motivos) cuenta.set(m, (cuenta.get(m) ?? 0) + 1)
  return [...cuenta.entries()].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)
    .map(([m, n]) => `${m}×${n}`).join(', ')
}

/**
 * Desenvuelve un `Resultado` que este archivo construye con literales suyos.
 *
 * NO es un `catch` disfrazado: si esto lanza, el defecto está en ESTE archivo
 * (un proveedor mal escrito, una latencia negativa), no en PubMed. Un fallo del
 * proveedor ya salió antes como sobre. Su prueba lo cubre por el camino de
 * error.
 */
function exigir<T>(r: { ok: true; valor: T } | { ok: false; motivo: string; detalle: string }): T {
  if (!r.ok) throw new Error(`adaptadorPubMed construyó un sobre inválido: ${r.motivo} — ${r.detalle}`)
  return r.valor
}
