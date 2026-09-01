/**
 * ══════════════════════════════════════════════════════════════════════════
 * CONTRATO `EvidenceSource` — sobre de recuperación provider-neutral (#314)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * PORQUÉ EXISTE. El repo ya sabe representar evidencia ANCLADA: `src/types/
 * evidence.ts` define `Source`/`Passage`/`Claim` y hace cumplir, por compilador
 * y por runtime, que «una afirmación sin pasaje de respaldo no puede
 * construirse». Eso resuelve la SÍNTESIS.
 *
 * Lo que NO existía es la otra mitad: **el acto de recuperar**. Hoy
 * `src/app/api/consultor-evidencia/route.ts` llama a PubMed y, si falla, cae en
 * un `catch` que devuelve menos artículos. El médico no puede distinguir
 * «PubMed dijo que no hay nada» de «PubMed no contestó». Esas dos frases tienen
 * consecuencias clínicas opuestas y hoy se pintan igual.
 *
 * Este módulo introduce el SOBRE DE RECUPERACIÓN: un registro explícito de qué
 * proveedor se consultó, cuándo, con qué resultado, con qué licencia y —cuando
 * falló— por qué. La regla que lo gobierna cabe en una frase:
 *
 *   ╔══════════════════════════════════════════════════════════════════════╗
 *   ║  UN PROVEEDOR NO DISPONIBLE JAMÁS SE PINTA COMO PROVEEDOR CONSULTADO ║
 *   ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Se hace cumplir por DOS puertas, igual que el modelo de claims:
 *   1. EL COMPILADOR — el sobre es una unión discriminada por `estado`. El campo
 *      `fuentes` SÓLO existe en las variantes `available`/`partial`. Escribir
 *      `sobre.fuentes` sobre un `unavailable` NO COMPILA.
 *   2. EL RUNTIME — `sobreDisponible()` y hermanas son las únicas puertas, y un
 *      sobre que vuelve de JSON no es un sobre hasta pasar por `sobreDesdeJSON`.
 *
 * QUÉ NO HACE ESTE ARCHIVO, A PROPÓSITO:
 *  · NO define jerarquía de evidencia (que una guía pese más que un ECA es
 *    criterio metodológico, no de software). Eso es `seleccion.ts` y sólo ordena
 *    por señales declaradas, nunca por autoridad inventada.
 *  · NO habla con ningún proveedor. Los adaptadores viven en `adaptadores/`.
 *  · NO redefine `Source`/`Passage`/`Claim`. Los REUSA. Crear un segundo modelo
 *    de evidencia sería exactamente la duplicación que CLAUDE.md prohíbe.
 *
 * ALCANCE (#314, PREPARED_ONLY): esto es la arquitectura y el adaptador
 * determinista. Ningún proveedor propietario está integrado; ver `catalogo.ts`.
 */

import type { Source, ProveedorHabilitado } from '@/types/evidence'
import {
  type ProveedorDeEvidencia,
  type RolDeEvidencia,
  type EstadoDeLicencia,
  entradaDeCatalogo,
  esProveedorDeEvidencia,
} from './catalogo'

// ---------------------------------------------------------------------------
// 1. Estado de recuperación — la unión que hace imposible fingir una consulta
// ---------------------------------------------------------------------------

/**
 * Los seis estados en que puede terminar una recuperación. NO hay un séptimo:
 * un estado nuevo obliga a tocar la unión y, con ella, a todos los `switch`.
 *
 * · `available`      — se consultó y contestó completo.
 * · `partial`        — se consultó y contestó, pero se sabe que falta material
 *                      (recorte por cuota, página incompleta, límite de tasa).
 *                      NO es lo mismo que «contestó cero resultados»: eso es
 *                      `available` con `fuentes: []`.
 * · `unavailable`    — se intentó y no contestó (red, 5xx, timeout).
 * · `not_authorized` — contestó que NO (401/403, cuota agotada, término no
 *                      permitido). El proveedor existe y nos rechazó.
 * · `not_configured` — NUNCA se intentó porque falta credencial, contrato o
 *                      bandera. Es el estado de todos los adaptadores
 *                      propietarios de #314 mientras no haya licencia.
 * · `not_permitted`  — la POLÍTICA de este repo lo impide (licencia
 *                      `LICENSE_PROHIBITED`, o rol incompatible con la consulta).
 *                      No se intentó, y no se debe intentar.
 */
export type EstadoDeRecuperacion =
  | 'available'
  | 'partial'
  | 'unavailable'
  | 'not_authorized'
  | 'not_configured'
  | 'not_permitted'

/** Los estados en los que hubo material recuperado. Los demás NO tienen fuentes. */
export type EstadoConMaterial = 'available' | 'partial'

/**
 * Estados que significan «este proveedor NO aportó nada a esta respuesta».
 * Se exporta porque la interfaz los tiene que pintar distinto del silencio.
 */
export const ESTADOS_SIN_MATERIAL = [
  'unavailable', 'not_authorized', 'not_configured', 'not_permitted',
] as const satisfies readonly EstadoDeRecuperacion[]

// ---------------------------------------------------------------------------
// 2. Telemetría y correlación — sin PHI, nunca
// ---------------------------------------------------------------------------

/**
 * Medidas de la llamada. Todas OPCIONALES salvo la latencia, porque un
 * proveedor puede no exponer costo ni versión y **declararlo ausente es
 * información; inventarlo es un defecto**.
 */
export interface TelemetriaDeRecuperacion {
  /** Milisegundos de pared. Lo mide el adaptador, no el reloj de este módulo. */
  readonly latenciaMs: number
  /**
   * Costo estimado en USD, si el proveedor lo expone o si el adaptador conoce
   * su tarifa. `undefined` = no medible, NO «gratis».
   */
  readonly costoUsd?: number
  /** Cuántos resultados dijo tener el proveedor, si lo dice. */
  readonly totalDeclarado?: number
  /** Reintentos consumidos. 0 es un dato; ausente no. */
  readonly reintentos?: number
}

/**
 * Identificador de correlación de la petición. **NUNCA lleva PHI**: no es el
 * id del paciente, ni el texto de la pregunta, ni el id del encuentro.
 *
 * Es una marca opaca para poder cruzar un log del servidor con un sobre sin que
 * el log revele nada del paciente (`.claude/rules/security-tenant.md`).
 */
export type IdDeCorrelacion = string

/** ¿Este identificador es seguro para logs? Barato y conservador. */
export function correlacionSegura(id: unknown): id is IdDeCorrelacion {
  return typeof id === 'string' && /^[a-z0-9][a-z0-9-]{7,63}$/i.test(id)
}

// ---------------------------------------------------------------------------
// 3. Metadatos de frescura/versión, tal como los expone (o no) el proveedor
// ---------------------------------------------------------------------------

/**
 * Frescura DECLARADA POR LA FUENTE, no calculada por nosotros.
 *
 * Distinción que cuesta dinero olvidar: `recuperadoEn` (cuándo lo bajamos) NO es
 * `revisadoEn` (cuándo la fuente se revisó por última vez). Una guía de 2019
 * recuperada hoy es un documento fresco de contenido viejo. `frescura.ts`
 * calcula el veredicto; aquí sólo se transporta el dato crudo.
 */
export interface FrescuraDeclarada {
  /** Versión/edición que el proveedor declara ('2024.3', 'CD004523.pub5'…). */
  readonly version?: string
  /** ISO de la última revisión declarada por la fuente. */
  readonly revisadoEn?: string
  /**
   * Por qué NO hay dato de frescura, cuando no lo hay. Escribir esto es
   * obligatorio para no confundir «no lo dice» con «no se miró».
   */
  readonly ausenciaPorque?: 'proveedor_no_lo_expone' | 'no_extraido_todavia' | 'no_aplica'
}

// ---------------------------------------------------------------------------
// 4. Marca fantasma — un sobre sólo nace en este archivo
// ---------------------------------------------------------------------------

/**
 * MARCA INVARIANTE — NO BORRAR. Mismo patrón (y misma razón) que las marcas de
 * `src/types/evidence.ts`: sin exportarla, es IMPOSIBLE escribir a mano un
 * objeto y hacerlo pasar por `SobreDeRecuperacion`. La única puerta son las
 * fábricas de abajo, que son las que hacen cumplir el invariante.
 *
 * CONTROL NEGATIVO EJECUTADO: sustituyéndola por `readonly marca?: never`, el
 * caso negativo «sobre inventado con estado unavailable y fuentes» COMPILA.
 * Hay un guardián en src/__tests__/evidence-integrations-contrato.test.ts.
 */
declare const MARCA_SOBRE: unique symbol

// ---------------------------------------------------------------------------
// 5. El sobre — unión discriminada por `estado`
// ---------------------------------------------------------------------------

/** Lo común a todo sobre, salga bien o mal. */
interface SobreBase {
  /** Proveedor del catálogo. Identidad, no marca comercial libre. */
  readonly proveedor: ProveedorDeEvidencia
  /** Qué puede hacer este material: respaldar, sólo descubrir, o dar contexto. */
  readonly rol: RolDeEvidencia
  /** Estado de licencia VIGENTE en el catálogo al momento de recuperar. */
  readonly licencia: EstadoDeLicencia
  /** Instante ISO en que se INTENTÓ la recuperación. Siempre existe. */
  readonly intentadoEn: string
  readonly correlacion: IdDeCorrelacion
  readonly telemetria: TelemetriaDeRecuperacion
  readonly [MARCA_SOBRE]: (s: 'sobre') => 'sobre'
}

/**
 * Recuperación con material. `fuentes` son `Source` CANÓNICOS
 * (`src/types/evidence.ts`) — no un tipo paralelo: así el retrieval de cualquier
 * proveedor desemboca en el mismo modelo de claims que ya existe.
 */
export interface SobreConMaterial extends SobreBase {
  readonly estado: EstadoConMaterial
  readonly fuentes: readonly Source[]
  readonly frescura: FrescuraDeclarada
  /**
   * Sólo en `partial`: qué falta y por qué. En `available` no existe.
   * Un `partial` sin esta frase sería un `available` disfrazado.
   */
  readonly recorte?: string
}

/**
 * Recuperación SIN material. **No tiene campo `fuentes`.** Ése es el invariante
 * de compilación: no se puede leer evidencia de un proveedor que no contestó.
 */
export interface SobreSinMaterial extends SobreBase {
  readonly estado: Exclude<EstadoDeRecuperacion, EstadoConMaterial>
  /**
   * Motivo LEGIBLE POR EL MÉDICO, no un stack. Es lo que la interfaz enseña
   * cuando dice «no se pudo consultar X». Obligatorio: un fallo sin motivo es
   * un fallo silencioso con otro nombre.
   */
  readonly motivo: string
  /** Clase técnica del fallo, para telemetría y runbooks. Sin PHI. */
  readonly clase: ClaseDeFallo
}

export type ClaseDeFallo =
  | 'red'                 // no se llegó al proveedor
  | 'timeout'
  | 'limite_de_tasa'
  | 'credencial_ausente'  // not_configured: no hay con qué autenticarse
  | 'credencial_rechazada'
  | 'sin_contrato'        // el proveedor existe pero no hay acuerdo comercial
  | 'politica_del_repo'   // lo impide el catálogo/licencia, no el proveedor
  | 'respuesta_invalida'  // contestó algo que no se pudo interpretar
  | 'desconocido'

export type SobreDeRecuperacion = SobreConMaterial | SobreSinMaterial

// ---------------------------------------------------------------------------
// 6. Predicados — la puerta de RUNTIME
// ---------------------------------------------------------------------------

/**
 * ÚNICA forma legítima de llegar a `fuentes`. Se usa como guarda de tipo:
 *
 *   if (tieneMaterial(sobre)) { sobre.fuentes }   // ✔ compila
 *   sobre.fuentes                                  // ✘ NO compila
 */
export function tieneMaterial(s: SobreDeRecuperacion): s is SobreConMaterial {
  return s.estado === 'available' || s.estado === 'partial'
}

/**
 * ¿Puede este sobre RESPALDAR una afirmación clínica?
 *
 * Tener material NO basta. Un resultado de Perplexity (rol `descubrimiento`) o
 * una nota de Obsidian (rol `conocimiento_personal`) pueden traer texto y aun
 * así no poder sostener nada: reglas 7 y 8 de #314. La regla vive AQUÍ, en el
 * servidor, no en un prompt.
 */
export function puedeRespaldar(s: SobreDeRecuperacion): s is SobreConMaterial {
  return tieneMaterial(s) && s.rol === 'respaldo'
}

/**
 * Frase para el médico. Existe para que ninguna pantalla improvise la suya y
 * acabe escribiendo «sin resultados» donde debía decir «no se pudo consultar».
 */
export function comoSeLeDiceAlMedico(s: SobreDeRecuperacion): string {
  const nombre = entradaDeCatalogo(s.proveedor).nombre
  // Se estrecha con el PREDICADO, no con el discriminante suelto: así la única
  // ruta hasta `fuentes` en todo el repo sigue siendo `tieneMaterial`.
  if (!tieneMaterial(s)) return `${nombre}: NO CONSULTADO — ${s.motivo}`
  if (s.estado === 'partial') {
    return `${nombre}: consultado parcialmente (${s.recorte ?? 'material incompleto'}). ${s.fuentes.length} fuente(s).`
  }
  return s.fuentes.length === 0
    ? `${nombre}: consultado, sin resultados para esta búsqueda.`
    : `${nombre}: consultado, ${s.fuentes.length} fuente(s).`
}

// ---------------------------------------------------------------------------
// 7. Fábricas — totales, no lanzan, devuelven motivo
// ---------------------------------------------------------------------------

/** Mismo `Resultado` que el modelo canónico: se reusa, no se redefine. */
export type { Resultado } from '@/types/evidence'
import type { Resultado } from '@/types/evidence'

const ok = <T>(valor: T): { readonly ok: true; readonly valor: T } => ({ ok: true, valor })
const mal = <M extends string>(motivo: M, detalle: string): { readonly ok: false; readonly motivo: M; readonly detalle: string } =>
  ({ ok: false, motivo, detalle })

export type MotivoRechazoSobre =
  | 'PROVEEDOR_DESCONOCIDO'
  | 'CORRELACION_INSEGURA'
  | 'INSTANTE_INVALIDO'
  | 'LATENCIA_INVALIDA'
  | 'MOTIVO_AUSENTE'
  | 'RECORTE_AUSENTE'
  | 'FUENTE_DE_OTRO_PROVEEDOR'
  | 'ROL_NO_PUEDE_APORTAR_FUENTES'

export interface EntradaSobreConMaterial {
  readonly proveedor: ProveedorDeEvidencia
  readonly estado: EstadoConMaterial
  readonly intentadoEn: string
  readonly correlacion: IdDeCorrelacion
  readonly telemetria: TelemetriaDeRecuperacion
  readonly fuentes: readonly Source[]
  readonly frescura?: FrescuraDeclarada
  readonly recorte?: string
}

/**
 * Construye un sobre CON material.
 *
 * Comprueba tres cosas que el compilador no puede ver porque las fuentes vienen
 * de la red:
 *  1. que el proveedor esté en el catálogo;
 *  2. que **cada `Source` venga del proveedor que dice el sobre** — un sobre de
 *     Cochrane no puede transportar un `Source` de PubMed y heredarle la
 *     autoridad de Cochrane (ése es el modo de fallo «cita prestada»);
 *  3. que un `partial` diga QUÉ le falta.
 */
export function sobreConMaterial(e: EntradaSobreConMaterial): Resultado<SobreConMaterial, MotivoRechazoSobre> {
  // El compilador ya limita `proveedor` al catálogo, pero un sobre puede nacer
  // de JSON o de un `as`: la comprobación de runtime no es redundante.
  if (!esProveedorDeEvidencia(e.proveedor)) {
    return mal('PROVEEDOR_DESCONOCIDO', `"${String(e.proveedor)}" no está en el catálogo de proveedores`)
  }
  const cat = entradaDeCatalogo(e.proveedor)
  if (!correlacionSegura(e.correlacion)) {
    return mal('CORRELACION_INSEGURA', 'la correlación debe ser opaca (8-64 alfanuméricos/guiones) y NUNCA contener PHI')
  }
  if (typeof e.intentadoEn !== 'string' || Number.isNaN(Date.parse(e.intentadoEn))) {
    return mal('INSTANTE_INVALIDO', `intentadoEn "${String(e.intentadoEn)}" no es un instante ISO válido`)
  }
  if (typeof e.telemetria?.latenciaMs !== 'number' || !Number.isFinite(e.telemetria.latenciaMs) || e.telemetria.latenciaMs < 0) {
    return mal('LATENCIA_INVALIDA', 'la latencia es obligatoria: sin ella el benchmark de #314 no puede medir nada')
  }
  if (e.estado === 'partial' && !e.recorte?.trim()) {
    return mal('RECORTE_AUSENTE', 'un `partial` sin decir QUÉ falta es un `available` disfrazado')
  }
  // Un rol que no puede respaldar TAMPOCO puede traer `Source` canónicos: un
  // `Source` es, por definición, material anclable. Ver reglas 7 y 8 de #314.
  if (cat.rol !== 'respaldo' && e.fuentes.length > 0) {
    return mal('ROL_NO_PUEDE_APORTAR_FUENTES',
      `${cat.nombre} tiene rol "${cat.rol}": su material no puede entrar como Source anclable. Debe re-groundearse en una fuente verificable antes de respaldar nada.`)
  }
  const canonico = cat.proveedorCanonico
  for (const f of e.fuentes) {
    if (canonico && f.proveedor !== canonico) {
      return mal('FUENTE_DE_OTRO_PROVEEDOR',
        `el sobre dice "${e.proveedor}" pero transporta un Source de "${f.proveedor}": una fuente no hereda la autoridad del sobre que la lleva`)
    }
  }
  const s: Omit<SobreConMaterial, typeof MARCA_SOBRE> = {
    proveedor: e.proveedor,
    rol: cat.rol,
    licencia: cat.licencia,
    estado: e.estado,
    intentadoEn: e.intentadoEn,
    correlacion: e.correlacion,
    telemetria: e.telemetria,
    fuentes: e.fuentes,
    frescura: e.frescura ?? { ausenciaPorque: 'proveedor_no_lo_expone' },
    ...(e.recorte ? { recorte: e.recorte } : {}),
  }
  return ok(s as SobreConMaterial)
}

export interface EntradaSobreSinMaterial {
  readonly proveedor: ProveedorDeEvidencia
  readonly estado: Exclude<EstadoDeRecuperacion, EstadoConMaterial>
  readonly intentadoEn: string
  readonly correlacion: IdDeCorrelacion
  readonly telemetria: TelemetriaDeRecuperacion
  readonly motivo: string
  readonly clase: ClaseDeFallo
}

/**
 * Construye un sobre SIN material. Es la fábrica que hace posible el punto 9 de
 * #314: «jamás fingir que un proveedor fue consultado».
 *
 * Exige `motivo` NO VACÍO. Un fallo sin motivo legible es lo que hoy produce el
 * `catch {}` de las rutas: el médico ve menos evidencia y no sabe que faltó
 * algo.
 */
export function sobreSinMaterial(e: EntradaSobreSinMaterial): Resultado<SobreSinMaterial, MotivoRechazoSobre> {
  // El compilador ya limita `proveedor` al catálogo, pero un sobre puede nacer
  // de JSON o de un `as`: la comprobación de runtime no es redundante.
  if (!esProveedorDeEvidencia(e.proveedor)) {
    return mal('PROVEEDOR_DESCONOCIDO', `"${String(e.proveedor)}" no está en el catálogo de proveedores`)
  }
  const cat = entradaDeCatalogo(e.proveedor)
  if (!correlacionSegura(e.correlacion)) {
    return mal('CORRELACION_INSEGURA', 'la correlación debe ser opaca y NUNCA contener PHI')
  }
  if (typeof e.intentadoEn !== 'string' || Number.isNaN(Date.parse(e.intentadoEn))) {
    return mal('INSTANTE_INVALIDO', `intentadoEn "${String(e.intentadoEn)}" no es un instante ISO válido`)
  }
  if (typeof e.telemetria?.latenciaMs !== 'number' || !Number.isFinite(e.telemetria.latenciaMs) || e.telemetria.latenciaMs < 0) {
    return mal('LATENCIA_INVALIDA', 'la latencia es obligatoria incluso al fallar: un timeout de 30 s es un dato de SLO')
  }
  const motivo = typeof e.motivo === 'string' ? e.motivo.trim() : ''
  if (!motivo) {
    return mal('MOTIVO_AUSENTE', 'un fallo sin motivo legible es un fallo silencioso: el médico tiene que poder leer por qué faltó la fuente')
  }
  const s: Omit<SobreSinMaterial, typeof MARCA_SOBRE> = {
    proveedor: e.proveedor,
    rol: cat.rol,
    licencia: cat.licencia,
    estado: e.estado,
    intentadoEn: e.intentadoEn,
    correlacion: e.correlacion,
    telemetria: e.telemetria,
    motivo,
    clase: e.clase,
  }
  return ok(s as SobreSinMaterial)
}

// ---------------------------------------------------------------------------
// 8. La interfaz del adaptador
// ---------------------------------------------------------------------------

/**
 * Consulta NORMALIZADA que reciben todos los adaptadores.
 *
 * NO lleva PHI: lleva la pregunta clínica ya despersonalizada por quien la
 * construyó. Los adaptadores no minimizan PHI — no es su trabajo y confiar en
 * que lo hagan reparte la responsabilidad entre 7 sitios en vez de uno.
 */
export interface ConsultaDeEvidencia {
  /** Pregunta clínica en lenguaje natural, ya sin datos identificables. */
  readonly pregunta: string
  /** Términos de búsqueda, si quien llama ya los estructuró (p. ej. desde PICO). */
  readonly terminos?: readonly string[]
  /** Máximo de fuentes deseadas. El adaptador puede devolver menos, nunca más. */
  readonly maximo: number
  /** Especialidad, para `seleccion.ts`. No cambia lo que se busca, sí el orden. */
  readonly especialidad?: string
  /** Años hacia atrás que interesan. Ausente = sin límite declarado. */
  readonly aniosRecientes?: number
}

/** Contexto de ejecución. Explícito para que los adaptadores sean deterministas. */
export interface ContextoDeRecuperacion {
  /**
   * Instante ISO del intento. Se PASA, no se toma de `Date.now()`, por la misma
   * razón que `Source.recuperadoEn`: fábricas puras y tests reproducibles.
   */
  readonly ahora: string
  readonly correlacion: IdDeCorrelacion
  readonly signal?: AbortSignal
  /**
   * Consultorio dueño de la consulta. Lo usa la compuerta de caché
   * (`compuertas.ts`) para que jamás se cruce material entre inquilinos.
   */
  readonly clinicId?: string
}

/**
 * EL CONTRATO. Todo proveedor —abierto, licenciado, propietario o personal— se
 * expone así y sólo así.
 *
 * `recuperar` NO LANZA. Un adaptador que lanza rompe el invariante: el sobre de
 * fallo es el producto, no la excepción. Los adaptadores de este repo envuelven
 * su propio `try/catch` y devuelven `sobreSinMaterial`.
 */
export interface AdaptadorDeEvidencia {
  readonly proveedor: ProveedorDeEvidencia
  /**
   * ¿Está este adaptador listo para hablar con su proveedor? Separado de
   * `recuperar` para que la interfaz pueda decir «UpToDate: requiere licencia»
   * sin gastar una llamada ni fingir un intento.
   */
  disponibilidad(): DisponibilidadDeclarada
  recuperar(c: ConsultaDeEvidencia, ctx: ContextoDeRecuperacion): Promise<SobreDeRecuperacion>
}

/**
 * Por qué un adaptador puede o no operar HOY. Es lo que separa «se intentó y
 * falló» de «nunca se pudo intentar», que es la distinción del punto 9 de #314.
 */
export interface DisponibilidadDeclarada {
  readonly operativo: boolean
  /** Si no es operativo: qué falta EXACTAMENTE. Legible por una persona. */
  readonly faltante?: string
  /** Qué acción humana lo desbloquea. Nunca «reintentar» si no es reintentable. */
  readonly desbloqueaCon?: 'credencial' | 'contrato_o_licencia' | 'bandera' | 'decision_del_dueno'
}
