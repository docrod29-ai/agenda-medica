import { num } from '@/lib/uci/num'
// ══════════════════════════════════════════════════════════════
// NEWS2 — National Early Warning Score 2 (Royal College of Physicians, NHS).
// Detecta deterioro clínico a partir de los signos vitales. Estándar mundial
// de seguridad del paciente hospitalizado.
// NOTA: se calcula con los parámetros disponibles (FR, SpO2, T°, TA sistólica,
// FC). Asume "alerta" y "aire ambiente" si no se capturan → parcial=true.
// ══════════════════════════════════════════════════════════════

export interface SignosNews2 {
  fr?: number
  spo2?: number
  temp?: number
  ta?: string          // "120/80" → se usa la sistólica
  fc?: number
  // ACVPU completo o legado alerta/alterada. NEWS2: Alert (A/'alerta') = 0;
  // cualquier alteración (C/V/P/U/'alterada') = 3 (RCP). Ver esAlerta().
  conciencia?: 'A' | 'C' | 'V' | 'P' | 'U' | 'alerta' | 'alterada'
  /**
   * ¿Recibe O₂ suplementario? → +2 en NEWS2.
   *
   * ── NO SE DEDUCE DE UN FLUJO REGISTRADO (D-027, 4-sep-2026) ──────────────
   *
   * La pregunta estuvo abierta: si el expediente trae un flujo de O₂ anotado,
   * ¿basta para poner esto en `true`? **El dueño decidió que no.**
   *
   * Un flujo registrado puede ser una indicación, una toma de hace horas o un
   * dato heredado de otro turno; convertirlo en `+2` cambiaría el puntaje de una
   * escala sobre un supuesto, y NEWS2 decide con qué urgencia se ve a alguien.
   *
   * Mientras nadie lo declare explícitamente, el campo queda `undefined` y el
   * panel marca la duda con ⚠ en vez de asumirla. **Ausencia de dato no es dato
   * de ausencia** — y tampoco es dato de presencia.
   */
  oxigeno?: boolean
  /**
   * Escala de SpO₂ (validado por el Dr, auditoría 2026-07):
   *  1 = por defecto.
   *  2 = SOLO para insuficiencia respiratoria hipercápnica con objetivo prescrito
   *      de 88–92%. NO se activa automáticamente por tener diagnóstico de EPOC;
   *      es una indicación clínica explícita.
   */
  escalaSpo2?: 1 | 2
}

/**
 * Puntos de SpO₂ en la Escala 2 (objetivo 88–92%). Tabla del Royal College,
 * validada por el Dr. En ≥93% el puntaje depende de si respira aire u O₂.
 */
export function puntosSpo2Escala2(spo2: number, conOxigeno: boolean): number {
  if (spo2 <= 83) return 3
  if (spo2 <= 85) return 2
  if (spo2 <= 87) return 1
  if (spo2 <= 92) return 0
  // ≥93%
  if (!conOxigeno) return 0            // ≥93% en aire ambiente
  if (spo2 <= 94) return 1
  if (spo2 <= 96) return 2
  return 3                              // ≥97% con O₂
}

export interface News2Param { param: string; valor: string; puntos: number }
export interface News2Result {
  total: number
  riesgo: 'bajo' | 'medio' | 'alto'
  color: string
  /** Falta al menos un parámetro del score: el total SUBESTIMA el riesgo. */
  parcial: boolean
  /** Cuáles faltan, para poder decirlo en pantalla. */
  faltantes: string[]
  parametroRojo: boolean   // algún parámetro individual = 3 (criterio de escalamiento NEWS2)
  detalle: News2Param[]
  recomendacion: string
}

/**
 * EL COLOR DEL SCORE, EN TOKENS.
 *
 * Estaban escritos a mano aquí, en un módulo `.ts`, así que el trinquete de
 * color —que sólo miraba los `.tsx`— no los veía: la insignia de NEWS2, que es
 * el indicador de deterioro, se pintaba con un rojo pensado para fondo oscuro y
 * no cambiaba con el tema. Justo el color que más falta hace que se lea.
 *
 * Son cadenas `var(--x)` y no hexadecimales, así que quien las concatene para
 * hacer un fondo translúcido tiene que usar `color-mix`, no pegarle un sufijo
 * de alfa. Es más ruidoso a propósito: pegar `+ '1f'` a una variable produce
 * silenciosamente un color inválido.
 */
const COLOR = { bajo: 'var(--green)', medio: 'var(--amber)', alto: 'var(--red)' }

function sistolica(ta?: string): number | undefined {
  if (!ta) return undefined
  const n = parseInt(String(ta).split('/')[0], 10)
  return isNaN(n) ? undefined : n
}

/** Calcula NEWS2. Devuelve null si no hay ningún signo válido. */
export function calcularNews2(s: SignosNews2): News2Result | null {
  const det: News2Param[] = []
  let total = 0
  let algun3 = false
  const add = (param: string, valor: string, puntos: number) => { det.push({ param, valor, puntos }); total += puntos; if (puntos === 3) algun3 = true }

  const sys = sistolica(s.ta)
  let algunSigno = false

  if (Number.isFinite(s.fr)) {
    algunSigno = true
    const v = s.fr as number
    add('FR', `${v}/min`, v <= 8 ? 3 : v <= 11 ? 1 : v <= 20 ? 0 : v <= 24 ? 2 : 3)
  }
  if (Number.isFinite(s.spo2)) {
    algunSigno = true
    const v = s.spo2 as number
    const pts = s.escalaSpo2 === 2
      ? puntosSpo2Escala2(v, !!s.oxigeno)
      : (v >= 96 ? 0 : v >= 94 ? 1 : v >= 92 ? 2 : 3)   // Escala 1 (por defecto)
    add(`SpO₂${s.escalaSpo2 === 2 ? ' (escala 2)' : ''}`, `${v}%`, pts)
  }
  if (s.oxigeno) add('O₂ suplementario', 'sí', 2)
  if (Number.isFinite(s.temp)) {
    algunSigno = true
    const v = s.temp as number
    add('T°', `${v}°C`, v <= 35 ? 3 : v <= 36 ? 1 : v <= 38 ? 0 : v <= 39 ? 1 : 2)
  }
  if (typeof sys === 'number') {
    algunSigno = true
    add('TA sistólica', `${sys} mmHg`, sys <= 90 ? 3 : sys <= 100 ? 2 : sys <= 110 ? 1 : sys <= 219 ? 0 : 3)
  }
  if (Number.isFinite(s.fc)) {
    algunSigno = true
    const v = s.fc as number
    add('FC', `${v}/min`, v <= 40 ? 3 : v <= 50 ? 1 : v <= 90 ? 0 : v <= 110 ? 1 : v <= 130 ? 2 : 3)
  }
  // Conciencia (ACVPU): Alert = 0; cualquier otra (Confusion/Voice/Pain/Unresponsive
  // o el legado 'alterada') = 3. Se deriva de la letra real conservada.
  if (s.conciencia !== undefined && s.conciencia !== 'A' && s.conciencia !== 'alerta') {
    add('Conciencia', String(s.conciencia), 3)
  }

  if (!algunSigno) return null

  const riesgo: News2Result['riesgo'] = total >= 7 ? 'alto' : (total >= 5 || algun3) ? 'medio' : 'bajo'
  const recomendacion = riesgo === 'alto'
    ? 'Respuesta urgente: valoración médica inmediata y monitoreo continuo.'
    : algun3
      ? 'Parámetro individual en rojo: requiere revisión médica urgente.'
      : riesgo === 'medio'
        ? 'Revisión por médico y aumento de la frecuencia de monitoreo.'
        : 'Continuar monitoreo de rutina.'

  /**
   * `parcial` = FALTA ALGÚN PARÁMETRO DEL SCORE, no solo conciencia y oxígeno.
   *
   * Un parámetro ausente no suma puntos, así que un NEWS2 construido sobre 1 de 7
   * parámetros da un total BAJO y se presentaba con la misma autoridad visual que
   * uno completo: badge verde, "continuar monitoreo de rutina", ninguna alerta.
   *
   * El caso real: enfermería registra solo FC y conciencia —el formulario no exige
   * ningún campo— y el paciente puede estar en insuficiencia respiratoria sin FR
   * ni SpO₂. El score decía 0 y `parcial` decía false, porque solo miraba
   * conciencia y oxígeno.
   *
   * Es exactamente la subestimación del deterioro que el score existe para evitar.
   */
  const faltantes: string[] = []
  if (!Number.isFinite(s.fr)) faltantes.push('FR')
  if (!Number.isFinite(s.spo2)) faltantes.push('SpO₂')
  if (!Number.isFinite(s.temp)) faltantes.push('T°')
  if (typeof sys !== 'number') faltantes.push('TA sistólica')
  if (!Number.isFinite(s.fc)) faltantes.push('FC')
  if (s.conciencia === undefined) faltantes.push('conciencia')
  if (s.oxigeno === undefined) faltantes.push('O₂ suplementario')

  const parcial = faltantes.length > 0
  const recomendacionFinal = parcial
    ? `${recomendacion} ⚠️ SCORE INCOMPLETO: falta ${faltantes.join(', ')}. Un parámetro ausente NO suma puntos, así que este total SUBESTIMA el riesgo — complétalo antes de decidir.`
    : recomendacion

  return { total, riesgo, color: COLOR[riesgo], parcial, faltantes, parametroRojo: algun3, detalle: det, recomendacion: recomendacionFinal }
}

/* ════════════════════════════════════════════════════════════════════════
   Color de un signo suelto — derivado del MISMO motor
   ════════════════════════════════════════════════════════════════════════ */

/** Qué tan lejos de lo normal está un signo, según NEWS2. */
export type NivelSigno = 'normal' | 'aviso' | 'critico'

/**
 * Nivel de un signo aislado, con los puntos que le da NEWS2.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * La tabla de signos del episodio pintaba en rojo con umbrales escritos a mano
 * —`spo2 < 92`, `temp >= 38`, `fc > 100 || fc < 50`— mientras el score usaba los
 * del Royal College. **Las dos decían cosas distintas del mismo número:** una
 * SpO₂ de 92 salía en negro en la tabla y sumaba DOS puntos en el NEWS2 de
 * arriba, en la misma pantalla.
 *
 * Eso no es un detalle de color. Es la aplicación contradiciéndose delante del
 * médico, y la contradicción se resuelve siempre igual: se cree lo que se ve, no
 * lo que hay que ir a buscar.
 *
 * Aquí no hay ningún umbral nuevo: se llama al motor con ese único signo y se
 * traduce su puntaje. Si mañana cambia la tabla del Royal College, cambia en un
 * solo sitio.
 */
export function nivelDeSigno(campo: 'fr' | 'spo2' | 'temp' | 'fc' | 'sys', valor: unknown,
                             ctx?: { oxigeno?: boolean; escalaSpo2?: 1 | 2 }): NivelSigno {
  /**
   * `num()`, no `Number()`.
   *
   * `Number('')` y `Number('  ')` son CERO, así que un campo vacío salía como
   * una SpO₂ de 0 % — crítico. Es el mismo «vacío no es 0» que ya costó un
   * arreglo en los motores de UCI, y volvió a aparecer aquí en cuanto se
   * escribió una coerción a mano. Por eso la coerción numérica clínica tiene un
   * solo sitio.
   */
  const v = num(valor)
  if (v === null) return 'normal'
  const entrada: SignosNews2 = campo === 'sys'
    ? { ta: `${v}/70` }
    : { [campo]: v, ...(campo === 'spo2' ? { oxigeno: ctx?.oxigeno, escalaSpo2: ctx?.escalaSpo2 } : {}) }
  const r = calcularNews2(entrada)
  // Se busca el parámetro por sus PUNTOS, no por su nombre: la etiqueta cambia
  // con la escala («SpO₂» contra «SpO₂ (escala 2)») y comparar cadenas se
  // rompería en silencio.
  const pts = r?.detalle[0]?.puntos ?? 0
  return pts >= 3 ? 'critico' : pts >= 1 ? 'aviso' : 'normal'
}

export const POR_QUE_EL_COLOR_SALE_DEL_MOTOR =
  'La tabla pintaba con umbrales propios mientras el score usaba los del Royal ' +
  'College, así que una SpO₂ de 92 salía normal en la tabla y sumaba dos puntos ' +
  'en el NEWS2 de la misma pantalla. Una aplicación que se contradice delante ' +
  'del médico pierde las dos veces: se cree lo que se ve.'
