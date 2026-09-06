/**
 * LO QUE YA ESTÁ DECLARADO COMO RIESGO, REUNIDO EN UN SOLO EJE (WS-10).
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El §10 del pliego del dueño manda que Patient State represente
 * longitudinalmente, entre otras cosas, los **riesgos**. No existía: ni
 * proyección, ni eje, ni nada. El médico tenía las alergias en un sitio, los
 * problemas crónicos en otro y las etiquetas del paciente en un tercero, y
 * ninguna pantalla los ponía juntos.
 *
 * ── LO QUE ESTE MÓDULO NO HACE, Y ES LO MÁS IMPORTANTE ──────────────────────
 *
 * **No decide qué es una bandera de riesgo.** Ese catálogo —qué condición
 * cuenta como riesgo y cuál no— es **política clínica del dueño** y no está
 * decidida. Inventarla aquí sería exactamente el fallo más caro que describe la
 * regla 1: no rompe nada, no falla ninguna prueba, y sale impreso con cédula
 * profesional.
 *
 * Lo que hace es más modesto y por eso es seguro: **reúne lo que alguien con
 * autoridad YA declaró**, sin añadir juicio propio.
 *
 *   · una alergia cuya SEVERIDAD quedó registrada    → la declaró el médico
 *   · un diagnóstico marcado `cronico`               → lo marcó el médico
 *   · una etiqueta clínica del paciente              → la puso el consultorio
 *
 * Cada bandera dice **de dónde salió** y **cuándo**. Ninguna se reescribe: el
 * texto que se enseña es el que ya estaba.
 *
 * ── POR QUÉ NO HAY UMBRAL DE SEVERIDAD ──────────────────────────────────────
 *
 * La tentación era «bandera sólo si es grave o anafilaxia». Eso es un punto de
 * corte clínico, y ninguno está validado en este repositorio. Se enseñan
 * **todas las alergias con severidad registrada**, cada una con la suya, y el
 * médico ve el adjetivo que él mismo escribió. Una alergia SIN severidad
 * registrada no entra: no porque sea leve —eso no consta— sino porque nadie
 * declaró nada sobre ella, y ausencia de dato no es dato de ausencia.
 *
 * ── POR QUÉ LAS ETIQUETAS SE PARTEN EN DOS ──────────────────────────────────
 *
 * `PatientTag` mezcla lo clínico con lo administrativo: «alto-riesgo» y
 * «embarazo» conviven con «pendiente-pago» y «requiere-factura». Meter las
 * segundas en un eje de riesgo clínico sería ruido con apariencia de alarma.
 *
 * La partición **no es un juicio de gravedad**: es «esto habla del paciente» vs
 * «esto habla de su expediente administrativo». Está declarada abajo, es
 * EXHAUSTIVA —una etiqueta nueva sin clasificar rompe su guardián— y el dueño
 * puede cambiarla sin tocar una línea de lógica.
 *
 * Módulo PURO.
 */
import type { PatientTag } from '@/types'
import { PATIENT_TAG_CONFIG } from '@/types'
import type { EstadoDeAlergias, AlergiaEnElExpediente } from './alergias-longitudinales'
import { peorSeveridadRegistrada, reaccionRegistrada } from './alergias-longitudinales'
import type { EstadoDeProblemas } from './problemas-activos'

export const VERSION_PROYECCION_BANDERAS = 1

/** De dónde salió la bandera. No hay un cuarto: no se inventa ninguna. */
export type OrigenDeBandera = 'alergia_con_severidad' | 'problema_cronico' | 'etiqueta_clinica'

export interface Bandera {
  readonly origen: OrigenDeBandera
  /** El texto TAL COMO ya estaba escrito. No se resume ni se reescribe. */
  readonly texto: string
  /** Lo que el origen añade con sus propias palabras: severidad, reacción, código. */
  readonly detalle?: string
  /** ISO de cuando se declaró, si el origen lo trae. Vacío cuando no consta. */
  readonly desde: string
  /** Quién lo declaró, para que el médico pueda contrastarlo. */
  readonly declaradoPor: string
}

export interface EstadoDeBanderas {
  /** ISO del instante de la proyección. Se pasa; no se lee el reloj. */
  readonly asOf: string
  readonly version: number
  readonly banderas: readonly Bandera[]
  /**
   * true = el historial del que sale esto vino recortado (REG-350). Entonces
   * «no encontré más» NO significa «no hay más», y la pantalla tiene que decirlo.
   */
  readonly historialRecortado: boolean
}

/**
 * QUÉ ETIQUETAS HABLAN DEL PACIENTE Y CUÁLES DE SU EXPEDIENTE.
 *
 * Exhaustiva a propósito: `Record<PatientTag, …>` obliga a clasificar toda
 * etiqueta nueva, y su guardián falla si alguien añade una y la deja fuera.
 * Una etiqueta sin clasificar no se cuela ni como bandera ni como silencio.
 */
export const ETIQUETA_ES_CLINICA: Readonly<Record<PatientTag, boolean>> = Object.freeze({
  'nuevo': false,
  'seguimiento': false,
  'frecuente': false,
  'alto-riesgo': true,
  'requiere-llamada': false,
  'pendiente-estudios': false,
  'pendiente-pago': false,
  'requiere-factura': false,
  'requiere-consentimiento': false,
  'requiere-interprete': false,
  'embarazo': true,
  'cronico': true,
  'inactivo': false,
})

export const POR_QUE_NO_HAY_UMBRAL_DE_SEVERIDAD =
  'Filtrar por «grave o anafilaxia» sería un punto de corte clínico, y ninguno ' +
  'está validado en este repositorio. Entran todas las alergias con severidad ' +
  'REGISTRADA, cada una con la suya. Una alergia sin severidad no entra porque ' +
  'nadie declaró nada sobre ella — no porque se dé por leve.'

export const POR_QUE_EL_CATALOGO_ES_DEL_DUENO =
  'Qué condición cuenta como bandera de riesgo es política clínica y no está ' +
  'decidida. Este eje NO la decide: reúne lo que el médico o el consultorio ya ' +
  'declararon. El día que exista catálogo, se añade como un cuarto origen con ' +
  'su procedencia, sin tocar los tres que ya están.'

/** Una alergia entra si —y sólo si— alguien registró su severidad. */
function banderaDeAlergia(a: AlergiaEnElExpediente): Bandera | null {
  const peor = peorSeveridadRegistrada(a)
  if (!peor) return null
  const reaccion = reaccionRegistrada(a)
  const detalle = reaccion?.reaccion
    ? `${peor.severidad} · ${reaccion.reaccion}`
    : peor.severidad
  return {
    origen: 'alergia_con_severidad',
    texto: a.alergeno,
    detalle,
    desde: peor.fecha || a.desde || '',
    declaradoPor: a.notasQueLaAfirman > 0 ? 'nota firmada' : 'lista de alergias de hoy',
  }
}

/**
 * El eje de riesgos del expediente.
 *
 * @param alergias  La proyección longitudinal de alergias (WS-10, REG-363).
 * @param problemas La proyección de problemas vigentes.
 * @param etiquetas Las etiquetas operativas del paciente, si las tiene.
 * @param asOf      ISO del momento de la proyección. Se pasa: la función es pura.
 */
export function estadoDeBanderas(
  alergias: Pick<EstadoDeAlergias, 'alergias' | 'historialIncompleto'>,
  problemas: Pick<EstadoDeProblemas, 'problemas' | 'historialRecortado'>,
  etiquetas: readonly PatientTag[] | undefined,
  asOf: string,
): EstadoDeBanderas {
  const banderas: Bandera[] = []

  for (const a of alergias.alergias) {
    const b = banderaDeAlergia(a)
    if (b) banderas.push(b)
  }

  for (const p of problemas.problemas) {
    if (p.diagnostico.estado !== 'cronico') continue
    const cie = String(p.diagnostico.codigoCIE10 ?? '').trim()
    banderas.push({
      origen: 'problema_cronico',
      texto: String(p.diagnostico.descripcion ?? '').trim(),
      ...(cie ? { detalle: cie } : {}),
      desde: p.dichoEn ?? '',
      declaradoPor: 'nota firmada',
    })
  }

  for (const t of etiquetas ?? []) {
    if (ETIQUETA_ES_CLINICA[t] !== true) continue
    banderas.push({
      origen: 'etiqueta_clinica',
      texto: PATIENT_TAG_CONFIG[t]?.label ?? t,
      /* Sin fecha: la etiqueta del paciente no guarda cuándo se puso. Se dice
         vacío en vez de rellenarlo con hoy, que sería fabricar una fecha. */
      desde: '',
      declaradoPor: 'etiqueta del consultorio',
    })
  }

  return {
    asOf,
    version: VERSION_PROYECCION_BANDERAS,
    banderas,
    historialRecortado: alergias.historialIncompleto === true || problemas.historialRecortado === true,
  }
}

/** Lo que la pantalla tiene que decir cuando el historial vino recortado. */
export function avisoDeBanderasIncompletas(e: EstadoDeBanderas): string {
  if (!e.historialRecortado) return ''
  return 'El historial del que sale esto vino recortado: puede haber banderas anteriores que no se están viendo.'
}
