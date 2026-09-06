/**
 * DE LO QUE SABE EL EXPEDIENTE A LO QUE EL MOTOR DE APLICABILIDAD PUEDE USAR.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * REG-387 construyó el motor de aplicabilidad (WS-09) con CUATRO dimensiones:
 * edad, embarazo, función renal y alergia. La ruta que lo usa
 * —`/api/expediente/evidencia`— armaba el estado del paciente así:
 *
 *     edadEnAnios  ← ctx.edad
 *     alergenos    ← ctx.alergias
 *
 * y nada más. **La función renal no llegaba nunca.** El evaluador renal existía,
 * estaba probado, y en producción no podía dar otro veredicto que
 * `datos_insuficientes`, porque el campo del que depende no se llenaba jamás.
 *
 * Consecuencia clínica concreta: un estudio que dice «se excluyeron pacientes
 * con TFG < 30» frente a un paciente con TFG de 22 **medida hoy** salía como
 * «faltan datos» en vez de «este paciente no cabe en la población del estudio».
 * El motor señalaba de menos, y no por prudencia: por un cable que no estaba.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Leyendo WS-09 para AÑADIR una quinta dimensión (organismo). Antes de escribir
 * una línea nueva, el §22 del pliego obliga a comprobar qué hay; al mirar el
 * llamador apareció que dos de las cuatro que ya había no recibían su dato.
 *
 * Añadir la quinta habría sido construir más de lo que no está conectado.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * La regla `.claude/rules/el-dato-tiene-que-llegar.md`, en su forma exacta:
 * «conectado, pero el dato no llega». El motor tenía su prueba, el llamador
 * tenía la suya, y entre los dos no había ninguna que mirara del otro lado.
 *
 * ── POR QUÉ LA TFG SE CALCULA AQUÍ Y NO EN LA PANTALLA ──────────────────────
 *
 * Porque CKD-EPI 2021 tiene UNA fuente de verdad en este repositorio
 * (`funcion-renal.ts`, decisión del dueño, L6) y meter la fórmula en un
 * componente sería el segundo sitio donde vive. La pantalla manda la
 * **creatinina con su vigencia**; el número lo hace el servidor con la
 * calculadora canónica.
 *
 * ── LO QUE ESTE MÓDULO SE NIEGA A HACER ─────────────────────────────────────
 *
 * · **No calcula TFG en menores de 18.** CKD-EPI 2021 está validada sólo en
 *   adultos (guarda NEXUS-QUALITY-004). En un niño devuelve `undefined`, que el
 *   motor lee como `datos_insuficientes`. Un número inventado sería peor que no
 *   tener número.
 * · **No calcula TFG sin sexo.** El coeficiente cambia el resultado. Sin sexo no
 *   hay cifra, y no se elige uno «por defecto».
 * · **No deduce el embarazo.** La cuarta dimensión sigue sin cablear a
 *   propósito: hoy ninguna pantalla expone un booleano de embarazo, y sacarlo de
 *   la prosa de los diagnósticos es exactamente lo que REG-364 y REG-365
 *   demostraron que sale mal («embarazo descartado» → «cursa embarazo»). Se
 *   queda `datos_insuficientes` —el veredicto conservador— y queda escrito aquí
 *   qué haría falta: una fuente estructurada, no un `includes('embarazo')`.
 * · **No inventa vigencia.** Si la pantalla no dice si la creatinina sigue
 *   dentro de su ventana (REG-375), no se manda TFG. Un número sin fecha no es
 *   un número.
 */
import { ckdEpi2021, creatininaPlausibleMgDl } from '@/lib/expediente/funcion-renal'
import {
  loQueElExpedienteDiceDelEmbarazo, embarazoParaAplicabilidad,
  type DiagnosticoLeible,
} from '@/lib/expediente/lo-que-el-expediente-dice-del-embarazo'
import { mgPorDl, valorEn } from '@/types/clinical-quantity'
import type { EstadoDelPaciente } from './aplicabilidad'

/** CKD-EPI 2021 está validada sólo en adultos. Por debajo, no hay cifra. */
export const EDAD_MINIMA_CKD_EPI = 18

/** Lo que el llamador sabe del paciente, tal como viaja en `contexto`. */
export interface ContextoDeEvidencia {
  readonly edad?: unknown
  readonly sexo?: unknown
  readonly alergias?: unknown
  /** Creatinina sérica en mg/dL, del cuadro completo (REG-368). */
  readonly creatinina?: unknown
  /** REG-375: ¿esa creatinina sigue dentro de su ventana de vigencia? */
  readonly funcionRenalVigente?: unknown
  /**
   * Los diagnósticos del cuadro, ESTRUCTURADOS —con su `tipo`—, que es la fuente
   * que este módulo declaraba faltarle para el embarazo. Ver REG-560.
   */
  readonly diagnosticos?: unknown
}

/**
 * Por qué el embarazo sigue sin cablear. Se exporta para que una prueba pueda
 * exigir que el motivo siga escrito: un hueco declarado que pierde su motivo se
 * convierte en un hueco olvidado.
 */
export const POR_QUE_EL_EMBARAZO_NO_SE_DEDUCE =
  'NO se deduce del texto, y eso no ha cambiado: deducirlo es lo que REG-364 y ' +
  'REG-365 midieron fallando, «embarazo descartado» se convertía en «cursa ' +
  'embarazo». Lo que cambió (REG-560) es que ya existe la fuente ESTRUCTURADA ' +
  'que este hueco pedía: `lo-que-el-expediente-dice-del-embarazo` lee el `tipo` ' +
  'del diagnóstico, no su cadena. Sólo un embarazo CONFIRMADO manda true y sólo ' +
  'uno DESCARTADO manda false; el diferencial y la sospecha llegan como ' +
  'ausencia, para que el motor conteste datos_insuficientes en vez de afirmar ' +
  'sobre una duda. Sin diagnósticos estructurados, la dimensión sigue ausente.'

/** ¿Se puede estimar la TFG con lo que hay, sin inventar nada? */
export function sePuedeEstimarLaTfg(ctx: ContextoDeEvidencia): boolean {
  return (
    typeof ctx.edad === 'number' && Number.isFinite(ctx.edad) && ctx.edad >= EDAD_MINIMA_CKD_EPI &&
    typeof ctx.sexo === 'string' && ctx.sexo.trim().length > 0 &&
    creatininaPlausibleMgDl(ctx.creatinina) &&
    typeof ctx.funcionRenalVigente === 'boolean'
  )
}

/** Traduce el contexto del llamador al estado que el motor sabe leer. */
export function estadoParaAplicabilidad(ctx: ContextoDeEvidencia): EstadoDelPaciente {
  const edad = typeof ctx.edad === 'number' && Number.isFinite(ctx.edad) ? ctx.edad : undefined
  const alergenos = Array.isArray(ctx.alergias)
    ? ctx.alergias.filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
    : undefined

  let tfg: EstadoDelPaciente['tfg']
  if (sePuedeEstimarLaTfg(ctx)) {
    const esMujer = /^f/i.test(String(ctx.sexo))
    const valor = valorEn(ckdEpi2021(mgPorDl(ctx.creatinina as number), edad as number, esMujer), 'mL/min/1.73m²')
    if (Number.isFinite(valor)) tfg = { valor, vigente: ctx.funcionRenalVigente === true }
  }

  /*
   * El embarazo, por fin, y por donde toca (REG-560).
   *
   * Este módulo declaraba el hueco pidiendo «una fuente estructurada, no un
   * includes('embarazo')». Esa fuente existe: lee el `tipo` del diagnóstico.
   * Una sospecha o un diferencial NO afirman nada aquí — llegan como ausencia,
   * y el motor contesta datos_insuficientes, que es el veredicto conservador.
   */
  const dx = Array.isArray(ctx.diagnosticos) ? (ctx.diagnosticos as DiagnosticoLeible[]) : []
  const embarazo = dx.length > 0
    ? embarazoParaAplicabilidad(loQueElExpedienteDiceDelEmbarazo(dx))
    : undefined

  return {
    ...(edad !== undefined ? { edadEnAnios: edad } : {}),
    ...(alergenos && alergenos.length > 0 ? { alergenos } : {}),
    ...(tfg ? { tfg } : {}),
    ...(embarazo !== undefined ? { embarazo } : {}),
  }
}
