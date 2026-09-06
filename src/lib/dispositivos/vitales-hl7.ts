/**
 * SIGNOS VITALES QUE LLEGAN DEL MONITOR — adaptador de dispositivos (fases 6-12).
 *
 * ── QUÉ RESUELVE ─────────────────────────────────────────────────────────────
 *
 * Hoy los signos de un paciente de terapia los teclea una persona. El monitor
 * de cabecera ya los tiene, y casi todos los monitores de hospital hablan HL7:
 * mandan un `ORU^R01` con un `OBX` por parámetro. Este módulo traduce ese
 * mensaje al mismo `RegistroSignos` que ya usan el censo, NEWS2 y la nota.
 *
 * El módulo de laboratorio (`lib/hl7/v2.ts`) ya sabe leer un ORU; lo que faltaba
 * era el vocabulario de signos vitales y —sobre todo— las reglas de seguridad
 * que un dato de máquina necesita y uno tecleado no.
 *
 * ── LAS CUATRO REGLAS ────────────────────────────────────────────────────────
 *
 * 1. **La unidad no se adivina.** Si el monitor manda una unidad que no
 *    conocemos, el valor NO entra: se declara. Una temperatura en Fahrenheit
 *    leída como Celsius es 37 °C donde había 98.6 °F — y NEWS2 puntúa con eso.
 *
 * 2. **La hora es la del DISPOSITIVO** (`OBX-14`), no la del servidor. Un
 *    mensaje que llega con retraso escribiría signos «de ahora» que son de hace
 *    dos horas, y la gráfica de tendencia mentiría.
 *
 * 3. **No pisa lo tecleado.** Lo que llega del monitor se marca con su fuente;
 *    quien lo lea sabe si lo escribió una persona que estaba mirando al paciente
 *    o una máquina que estaba midiendo un cable suelto.
 *
 * 4. **Ningún valor se corrige, se completa ni se promedia.** Lo que no viene,
 *    no viene. Rellenar huecos en signos vitales es inventar una medición.
 *
 * Módulo PURO. No calcula escalas: NEWS2 y compañía ya tienen su motor y éste
 * sólo les entrega el dato.
 */
import type { RegistroSignos } from '@/types/hospital'

/**
 * Código LOINC → campo de `RegistroSignos`, con las unidades ACEPTADAS.
 *
 * Los códigos son los estándar de signos vitales; no son cifras clínicas ni
 * umbrales: son identificadores de «qué se midió». Las unidades listadas son las
 * que este adaptador sabe interpretar sin convertir nada.
 */
export const MAPA_LOINC: Record<string, { campo: keyof RegistroSignos; unidades: string[] }> = {
  '8867-4': { campo: 'fc', unidades: ['/min', 'bpm', '{beats}/min', 'min-1'] },
  '9279-1': { campo: 'fr', unidades: ['/min', '{breaths}/min', 'min-1'] },
  '8310-5': { campo: 'temp', unidades: ['Cel', 'C', '°C'] },
  /**
   * ── DOS CÓDIGOS, UN SOLO CAMPO — Y AHORA ESTÁ DICHO (ZL-005) ─────────────
   *
   * `2708-6` es saturación de oxígeno en sangre —la que reporta una gasometría
   * ARTERIAL— y `59408-5` es la de PULSIOXIMETRÍA. No son la misma medición, y
   * este adaptador las metía las dos en `spo2` sin decirlo: un receptor que
   * distinga SaO₂ de SpO₂ vería registrada una gasometría que nadie hizo.
   *
   * No se quitan ni se separan, y las dos razones son de este repositorio:
   *
   *  · `RegistroSignos` (types/hospital) tiene UN campo de saturación. Añadir
   *    otro es modelo compartido y decisión del dueño (`NEEDS_CLINICAL_REVIEW`:
   *    si la gráfica del hospital quiere SaO₂ aparte).
   *  · Descartar `2708-6` PERDERÍA datos reales: es el código que la propia
   *    exportación FHIR de NexusMED usa para la saturación (fhir-export.ts,
   *    unificado a propósito), así que un ida y vuelta con nuestro propio
   *    formato dejaría de traer la saturación.
   *
   * Lo que sí cambia: la fusión deja de ser silenciosa. `traducirVitales`
   * declara en `avisos` cuándo la saturación entró por el código de gasometría,
   * para que quien guarda o pinta pueda decirlo. Es la regla de siempre — nada
   * se junta en silencio.
   */
  '2708-6': { campo: 'spo2', unidades: ['%'] },
  '59408-5': { campo: 'spo2', unidades: ['%'] },
  '2339-0': { campo: 'glucosa', unidades: ['mg/dL', 'mg/dl'] },
  '3151-8': { campo: 'oxigenoFlujoLpm', unidades: ['L/min', 'l/min'] },
  '3150-0': { campo: 'oxigenoFiO2', unidades: ['%'] },
}

/** Sistólica y diastólica se combinan en el texto `ta` que usa la aplicación. */
export const LOINC_SISTOLICA = '8480-6'
export const LOINC_DIASTOLICA = '8462-4'
const UNIDADES_TA = ['mm[Hg]', 'mmHg']

export interface ObxEntrante {
  codigo: string
  valor: string
  unidad?: string
  /** `OBX-14`, hora de la observación en el dispositivo. */
  medidoEn?: string
}

export interface Descartado {
  codigo: string
  motivo: string
}

export interface VitalesTraducidos {
  /** Lo que sí se pudo interpretar. Sin id ni autor: eso lo pone quien guarda. */
  signos: Partial<RegistroSignos>
  /** La hora del DISPOSITIVO, si vino. */
  medidoEn: string | null
  /** Lo que NO entró, y por qué. Nunca se calla. */
  descartados: Descartado[]
  /**
   * Lo que SÍ entró pero no significa exactamente lo que parece (ZL-005).
   *
   * Hoy sólo hay un caso: una saturación que llegó con el código de gasometría
   * arterial y se guarda en el mismo campo que la de pulsioximetría.
   */
  avisos: string[]
}

/** Código LOINC de saturación ARTERIAL (gasometría), no de pulsioximetría. */
export const LOINC_SATURACION_ARTERIAL = '2708-6'

export const AVISO_SATURACION_ARTERIAL =
  'La saturación llegó con el código de gasometría arterial (LOINC 2708-6) y se ' +
  'guarda en el mismo campo que la de pulsioximetría: la gráfica no las ' +
  'distingue.'

const num = (v: string): number | null => {
  const n = Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : null
}

/** Normaliza una unidad para comparar: sin espacios y en minúsculas. */
const u = (s?: string) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, '')

function unidadAceptada(unidad: string | undefined, aceptadas: string[]): boolean {
  // Sin unidad no se asume la de nuestro país ni la del catálogo: se rechaza.
  if (!String(unidad ?? '').trim()) return false
  return aceptadas.some(a => u(a) === u(unidad))
}

/**
 * Traduce las observaciones de un ORU a signos vitales.
 *
 * @param obs los `OBX` ya parseados (el parser de HL7 vive en `lib/hl7/v2.ts`).
 */
export function traducirVitales(obs: readonly ObxEntrante[]): VitalesTraducidos {
  const signos: Partial<RegistroSignos> = {}
  const descartados: Descartado[] = []
  const avisos: string[] = []
  let sistolica: number | null = null
  let diastolica: number | null = null
  let medidoEn: string | null = null

  for (const o of obs) {
    const codigo = String(o.codigo ?? '').trim()
    if (!codigo) continue

    // La hora del dispositivo: la primera que venga manda para todo el registro.
    if (!medidoEn && o.medidoEn) {
      const iso = fechaHl7AIso(o.medidoEn)
      if (iso) medidoEn = iso
    }

    if (codigo === LOINC_SISTOLICA || codigo === LOINC_DIASTOLICA) {
      if (!unidadAceptada(o.unidad, UNIDADES_TA)) {
        descartados.push({ codigo, motivo: `unidad de presión no reconocida: «${o.unidad ?? 'sin unidad'}»` })
        continue
      }
      const n = num(o.valor)
      if (n === null) { descartados.push({ codigo, motivo: `valor no numérico: «${o.valor}»` }); continue }
      if (codigo === LOINC_SISTOLICA) sistolica = n
      else diastolica = n
      continue
    }

    const def = MAPA_LOINC[codigo]
    if (!def) { descartados.push({ codigo, motivo: 'código no reconocido por el adaptador' }); continue }
    if (!unidadAceptada(o.unidad, def.unidades)) {
      // Una temperatura en Fahrenheit leída como Celsius es 37 donde había 98.6.
      descartados.push({ codigo, motivo: `unidad no reconocida: «${o.unidad ?? 'sin unidad'}» (se esperaba ${def.unidades.join(' o ')})` })
      continue
    }
    const n = num(o.valor)
    if (n === null) { descartados.push({ codigo, motivo: `valor no numérico: «${o.valor}»` }); continue }
    // ZL-005 — la fusión de los dos códigos de saturación se declara.
    if (codigo === LOINC_SATURACION_ARTERIAL && !avisos.includes(AVISO_SATURACION_ARTERIAL)) {
      avisos.push(AVISO_SATURACION_ARTERIAL)
    }
    ;(signos as Record<string, unknown>)[def.campo] = n
  }

  // La presión sólo entra COMPLETA: «120/» no es una presión arterial.
  if (sistolica !== null && diastolica !== null) {
    signos.ta = `${sistolica}/${diastolica}`
  } else if (sistolica !== null || diastolica !== null) {
    descartados.push({
      codigo: sistolica !== null ? LOINC_DIASTOLICA : LOINC_SISTOLICA,
      motivo: 'llegó sólo una de las dos cifras de la presión; media presión no es una presión',
    })
  }

  return { signos, medidoEn, descartados, avisos }
}

/**
 * `YYYYMMDDHHMMSS[.S][+/-ZZZZ]` de HL7 a ISO.
 *
 * Devuelve `null` si no se entiende: mejor sin hora del dispositivo —y que quien
 * guarde lo declare— que con una hora inventada.
 */
export function fechaHl7AIso(ts: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/.exec(String(ts ?? '').trim())
  if (!m) return null
  const [, a, mes, d, h = '00', mi = '00', s = '00'] = m
  const off = /([+-]\d{4})$/.exec(String(ts).trim())?.[1]
  const zona = off ? `${off.slice(0, 3)}:${off.slice(3)}` : 'Z'
  const iso = `${a}-${mes}-${d}T${h}:${mi}:${s}${zona}`
  const t = Date.parse(iso)
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

/** ¿Trae algo que valga la pena guardar? */
export function hayVitales(v: VitalesTraducidos): boolean {
  return Object.keys(v.signos).length > 0
}

export const POR_QUE_NO_SE_ADIVINA_LA_UNIDAD =
  'Porque una temperatura en Fahrenheit leída como Celsius es 37 donde había ' +
  '98.6, y NEWS2 puntúa con ese número. Un valor descartado y declarado se ve; ' +
  'uno convertido mal, no.'

export const POR_QUE_NO_PISA_LO_TECLEADO =
  'Porque quien lee la gráfica tiene que poder distinguir lo que escribió una ' +
  'persona mirando al paciente de lo que midió una máquina conectada a un cable ' +
  'que quizá estaba suelto.'
