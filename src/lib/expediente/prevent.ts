/**
 * PREVENT-ASCVD — el motor de riesgo que pide la guía ACC/AHA 2026.
 *
 * Reemplaza a las Pooled Cohort Equations. Diferencias que importan en consulta:
 *  · Aplica desde los 30 años (las PCE, desde los 40).
 *  · NO usa raza como variable.
 *  · Incorpora función renal, y predice a 10 Y a 30 años.
 *  · Sus estimaciones a 10 años son 40% a 50% MÁS BAJAS que las de las PCE para
 *    el mismo perfil, y por eso los umbrales de tratamiento también bajaron.
 *
 * Los coeficientes viven en prevent-coeficientes.ts y están validados contra
 * cuatro valores publicados; ver el encabezado de ese archivo.
 */

import {
  ASCVD_10_MUJER, ASCVD_10_HOMBRE, ASCVD_30_MUJER, ASCVD_30_HOMBRE,
  type Coeficientes,
} from './prevent-coeficientes'

/** mg/dL a mmol/L para colesterol. */
const MMOL = 38.67

export interface EntradaPrevent {
  edad: number
  esMujer: boolean
  /** Presión sistólica en mmHg. */
  tas: number
  /** Colesterol total en mg/dL. */
  colesterolTotal: number
  /** HDL en mg/dL. */
  hdl: number
  /** Tasa de filtrado glomerular estimada (mL/min/1.73 m²). */
  tfg: number
  diabetes: boolean
  fuma: boolean
  tomaAntihipertensivo: boolean
  tomaEstatina: boolean
}

export interface ResultadoPrevent {
  /** Riesgo a 10 años en porcentaje. */
  riesgo10: number
  /** Riesgo a 30 años en porcentaje; null fuera del rango donde tiene sentido. */
  riesgo30: number | null
  categoria: 'bajo' | 'limitrofe' | 'intermedio' | 'alto'
  etiqueta: string
  /** Qué hacer con ese número, según la guía 2026. */
  conducta: string
  fuente: string
}

/** Evalúa el polinomio del modelo con el centrado publicado. */
function logit(c: Coeficientes, e: EntradaPrevent): number {
  const edad = (e.edad - 55) / 10
  const noHDL = (e.colesterolTotal - e.hdl) / MMOL - 3.5
  const hdl = (e.hdl / MMOL - 1.3) / 0.3
  const tasBaja = (Math.min(e.tas, 110) - 110) / 20
  const tasAlta = (Math.max(e.tas, 110) - 130) / 20
  const tfgBaja = (Math.min(e.tfg, 60) - 60) / -15
  const tfgAlta = (Math.max(e.tfg, 60) - 90) / -15
  const dm = e.diabetes ? 1 : 0
  const fuma = e.fuma ? 1 : 0
  const antihta = e.tomaAntihipertensivo ? 1 : 0
  const estatina = e.tomaEstatina ? 1 : 0

  return (
    c.edad * edad +
    (c.edadCuadrado ?? 0) * edad * edad +
    c.noHDL * noHDL +
    c.hdl * hdl +
    c.tasBaja * tasBaja +
    c.tasAlta * tasAlta +
    c.diabetes * dm +
    c.fuma * fuma +
    // El IMC solo pesa en insuficiencia cardiaca y enfermedad cardiovascular
    // total; en el modelo de ASCVD sus coeficientes son cero.
    c.tfgBaja * tfgBaja +
    c.tfgAlta * tfgAlta +
    c.antihipertensivo * antihta +
    c.estatina * estatina +
    c.tasTratada * antihta * tasAlta +
    c.noHDLTratado * estatina * noHDL +
    c.edadXnoHDL * edad * noHDL +
    c.edadXhdl * edad * hdl +
    c.edadXtasAlta * edad * tasAlta +
    c.edadXdiabetes * edad * dm +
    c.edadXfuma * edad * fuma +
    c.edadXtfgBaja * edad * tfgBaja +
    c.constante
  )
}

const pct = (x: number) => Math.round(x * 1000) / 10

/**
 * Calcula el riesgo. Devuelve null cuando el paciente queda fuera del rango
 * en el que las ecuaciones fueron derivadas y validadas (30 a 79 años): dar un
 * número ahí sería inventarlo.
 */
export function prevent(e: EntradaPrevent): ResultadoPrevent | null {
  if (!(e.edad >= 30) || e.edad > 79) return null
  if (!(e.colesterolTotal > 0) || !(e.hdl > 0) || !(e.tas > 0) || !(e.tfg > 0)) return null

  const r10 = 1 / (1 + Math.exp(-logit(e.esMujer ? ASCVD_10_MUJER : ASCVD_10_HOMBRE, e)))
  // El horizonte de 30 años solo se reporta hasta los 59: más allá, proyectar
  // tres décadas rebasa lo que el modelo puede sostener.
  const r30 = e.edad <= 59
    ? 1 / (1 + Math.exp(-logit(e.esMujer ? ASCVD_30_MUJER : ASCVD_30_HOMBRE, e)))
    : null

  const p = pct(r10)
  const cat: ResultadoPrevent['categoria'] =
    p >= 10 ? 'alto' : p >= 5 ? 'intermedio' : p >= 3 ? 'limitrofe' : 'bajo'

  const conducta =
    cat === 'alto'
      ? 'Riesgo alto: se recomienda estatina de alta intensidad buscando reducir el LDL-C al menos 50%, con meta de LDL-C menor de 70 mg/dL y no-HDL-C menor de 100 mg/dL.'
      : cat === 'intermedio'
        ? 'Riesgo intermedio: se recomienda al menos estatina de intensidad moderada para reducir el LDL-C entre 30% y 49%. En el extremo alto del rango, la de alta intensidad aporta beneficio adicional.'
        : cat === 'limitrofe'
          ? 'Riesgo limítrofe: considerar los potenciadores de riesgo para personalizar la decisión. Con proteína C reactiva de alta sensibilidad de 2 mg/L o más en dos ocasiones sin causa aparente, la estatina de alta intensidad puede ser útil.'
          : 'Riesgo bajo: consejería sobre hábitos de salud. Con LDL-C de 160 a 189 mg/dL, o riesgo a 30 años de 10% o más, es razonable una estatina de intensidad moderada para limitar la exposición acumulada.'

  return {
    riesgo10: p,
    riesgo30: r30 == null ? null : pct(r30),
    categoria: cat,
    etiqueta:
      cat === 'alto' ? `Riesgo alto (${p}%)`
      : cat === 'intermedio' ? `Riesgo intermedio (${p}%)`
      : cat === 'limitrofe' ? `Riesgo limítrofe (${p}%)`
      : `Riesgo bajo (${p}%)`,
    conducta,
    fuente: 'Ecuaciones PREVENT de la AHA (Circulation. 2024;149:430-449), aplicadas según la guía ACC/AHA 2026 de dislipidemia',
  }
}

/** Por qué no se pudo calcular, para decirlo en una línea en vez de callar. */
export function motivoSinPrevent(e: Partial<EntradaPrevent>): string | null {
  if (e.edad == null) return 'la edad'
  if (e.edad < 30 || e.edad > 79) return null   // fuera de rango: no es un dato faltante
  const faltan: string[] = []
  if (!(e.colesterolTotal ?? 0)) faltan.push('colesterol total')
  if (!(e.hdl ?? 0)) faltan.push('HDL')
  if (!(e.tas ?? 0)) faltan.push('presión sistólica')
  if (!(e.tfg ?? 0)) faltan.push('TFG (o creatinina)')
  return faltan.length ? faltan.join(', ') : null
}
