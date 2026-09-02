/**
 * NORMALIZACIÓN DE UNIDAD Y ESTADO DE VALIDACIÓN — §27 y §28 de D-032.
 *
 * ── QUÉ PASABA ANTES ────────────────────────────────────────────────────────
 *
 * El validador tenía UNA respuesta para dos preguntas distintas: si el número no
 * era plausible en la unidad convencional del analito, la fila salía del panel y
 * se guardaba como texto en `noReconocidas`.
 *
 * Eso está bien cuando el número es un disparate. Y está mal cuando el número es
 * correcto **en otra unidad**: una glucosa de 7,2 mmol/L es una glucosa normal
 * reportada en el sistema internacional, y desaparecía de la serie temporal sin
 * que nadie lo dijera. El paciente cuyo laboratorio reporta en unidades del SI
 * se quedaba sin gráfica y sin aviso.
 *
 * ── LA POLÍTICA, QUE ES DEL MÉDICO DUEÑO Y NO MÍA ───────────────────────────
 *
 * Su catálogo (`docs/clinical/CATALOGO-PLAUSIBILIDAD-LABORATORIO.md`) lo ordena
 * en dos sitios. El §1:
 *
 *     Dentro de rango → aceptar.
 *     Fuera de rango  → **aceptar provisionalmente + VERIFY_VALUE_OR_UNIT**.
 *     Nunca truncar. Nunca sustituir automáticamente.
 *     Conservar siempre valor y unidad originales.
 *
 * Y el §28 pone el orden: **primero se normaliza la unidad, DESPUÉS se comprueba
 * la plausibilidad.** Al revés, un valor correcto en otra unidad parece imposible.
 *
 * ── POR QUÉ HAY TAN POCAS CONVERSIONES ──────────────────────────────────────
 *
 * Porque un factor de conversión es una **equivalencia**, y la regla 1 de
 * seguridad clínica las nombra: «o salen de una fuente citada, o no existen».
 *
 * Aquí sólo viven las dos que el propio documento del dueño sostiene. Las demás
 * —empezando por la glucosa mmol/L, que es justo el caso que abrió esto— están
 * en `CONVERSIONES_QUE_FALTAN` esperándolo a él. Escribir 18,0182 «porque todo el
 * mundo lo sabe» sería el fallo caro de siempre: no rompe nada, no falla ninguna
 * prueba, y sale impreso con cédula.
 *
 * Mientras falte el factor, el valor **no se tira y no se convierte**: se acepta
 * con `VERIFY_UNIT` y no entra a la gráfica. Que es exactamente lo que su §1 pide.
 */
import type { Analito } from './analitos'

/** Los estados del §33 que esta capa sabe producir. Ni uno inventado. */
export type EstadoDeValidacion =
  /** Unidad canónica (o convertida con factor citado) y valor plausible. */
  | 'ACCEPTED'
  /** La unidad no es la canónica y no hay factor citado para convertirla. */
  | 'VERIFY_UNIT'
  /** Unidad conocida y valor fuera de los límites de captura. */
  | 'VERIFY_VALUE_OR_UNIT'

export interface Conversion {
  /** Se multiplica el valor original por esto para llegar a la unidad canónica. */
  readonly factor: number
  /** De dónde sale. Un factor sin esto es una equivalencia inventada. */
  readonly fuente: string
}

/** Normaliza una unidad para compararla: minúsculas, sin acentos, µ/μ/u iguales. */
export function claveDeUnidad(u: string | undefined | null): string {
  return (u ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[μµ]/g, 'u')
    .replace(/\s+/g, '')
    .trim()
}

/**
 * LAS ÚNICAS DOS EQUIVALENCIAS QUE EL DOCUMENTO DEL DUEÑO SOSTIENE.
 *
 * Clave del analito → unidad de origen normalizada → cómo llegar a la canónica.
 */
export const CONVERSIONES: Readonly<Record<string, Readonly<Record<string, Conversion>>>> = {
  vitaminaD: {
    'nmol/l': {
      factor: 1 / 2.496,
      fuente:
        'D-032 §6, literal: «25-OH vitamina D: ng/mL × 2.496 ≈ nmol/L». Aquí se '
        + 'usa a la inversa para llegar a ng/mL, que es la unidad canónica del analito.',
    },
  },
  creatinina: {
    'umol/l': {
      factor: 1 / 88.4,
      fuente:
        'D-032 §27.1, del ejemplo trabajado del propio documento: «original_value: 140 · '
        + 'original_unit: µmol/L · canonical_value: 1.58 · canonical_unit: mg/dL». '
        + '140 / 88.4 = 1,5837 → 1,58. El factor es el que reproduce su ejemplo, no uno traído de fuera.',
    },
  },
}

/**
 * LO QUE FALTA, DICHO POR SU NOMBRE.
 *
 * Cada entrada es un caso REAL que hoy se queda en `VERIFY_UNIT`. No se rellenan
 * con «lo habitual»: son equivalencias y las fija el médico dueño.
 */
export const CONVERSIONES_QUE_FALTAN: readonly { readonly analito: string; readonly desde: string; readonly porQue: string }[] = Object.freeze([
  {
    analito: 'glucosa', desde: 'mmol/L',
    porQue:
      'NEEDS_CLINICAL_REVIEW. Es el caso que abrió todo esto (REG-449): una glucosa de 7,2 mmol/L '
      + 'es normal y hoy no entra a la serie. El factor NO está en el catálogo del dueño y no se inventa.',
  },
  {
    analito: 'hemoglobina', desde: 'g/L',
    porQue: 'NEEDS_CLINICAL_REVIEW. Reportada en g/L, una hemoglobina de 134 no es plausible en g/dL.',
  },
  {
    analito: 'colesterolTotal · hdl · ldl · trigliceridos', desde: 'mmol/L',
    porQue: 'NEEDS_CLINICAL_REVIEW. Cada lípido tiene su propio factor: no es uno solo para los cuatro.',
  },
  {
    analito: 'bilirrubinaTotal', desde: 'µmol/L',
    porQue: 'NEEDS_CLINICAL_REVIEW. El §27.1 sólo trae el ejemplo de la creatinina.',
  },
])

export interface Dictamen {
  readonly estado: EstadoDeValidacion
  /** El valor en la unidad canónica del analito. */
  readonly valor: number
  readonly unidad: string
  /** Lo que decía la hoja. NUNCA se pierde (§27.1). */
  readonly valorOriginal: number
  readonly unidadOriginal: string
  /** Con qué factor se convirtió, y de dónde sale. Ausente si no se convirtió. */
  readonly conversion?: Conversion
  /** Sólo entra a la serie temporal lo que está ACEPTADO. */
  readonly graficable: boolean
  readonly porQue: string
}

/**
 * Aplica el §28: normalizar primero, comprobar plausibilidad después.
 *
 * NUNCA rechaza, NUNCA trunca, NUNCA sustituye y NUNCA corrige en silencio. Lo
 * que no puede afirmar, lo marca.
 *
 * @param unidadReportada  tal cual venía en la hoja. Vacía = se asume la
 *   canónica, que es lo que este código ya hacía antes de D-032. Su §33 tiene un
 *   estado propio para eso (`MISSING_UNIT`) y todavía no está: queda declarado.
 */
export function dictaminar(a: Analito, valor: number, unidadReportada?: string): Dictamen {
  const original = (unidadReportada ?? '').trim()
  const uOriginal = claveDeUnidad(original)
  const uCanonica = claveDeUnidad(a.unidad)
  const base = { valorOriginal: valor, unidadOriginal: original || a.unidad }
  const plausible = (v: number) => Number.isFinite(v) && v >= a.min && v <= a.max

  // 1 · Sin unidad, o ya en la canónica: no hay nada que convertir.
  if (uOriginal === '' || uOriginal === uCanonica) {
    return plausible(valor)
      ? { ...base, estado: 'ACCEPTED', valor, unidad: a.unidad, graficable: true, porQue: 'Unidad canónica y valor dentro de los límites de captura.' }
      : { ...base, estado: 'VERIFY_VALUE_OR_UNIT', valor, unidad: a.unidad, graficable: false, porQue: `${valor} queda fuera de ${a.min}–${a.max} ${a.unidad}. Se conserva sin convertir ni truncar: puede ser un decimal corrido, un error de lectura o un valor extraordinario real (§30).` }
  }

  // 2 · Otra unidad, con factor citado: se convierte y SE DICE con qué.
  const conv = CONVERSIONES[a.clave]?.[uOriginal]
  if (conv) {
    const convertido = valor * conv.factor
    return plausible(convertido)
      ? { ...base, estado: 'ACCEPTED', valor: convertido, unidad: a.unidad, conversion: conv, graficable: true, porQue: `Convertido desde ${original} con factor citado.` }
      : { ...base, estado: 'VERIFY_VALUE_OR_UNIT', valor: convertido, unidad: a.unidad, conversion: conv, graficable: false, porQue: `Convertido desde ${original}, y aun así queda fuera de ${a.min}–${a.max} ${a.unidad}.` }
  }

  // 3 · Otra unidad SIN factor citado. No se tira y no se adivina.
  return {
    ...base, estado: 'VERIFY_UNIT', valor, unidad: original, graficable: false,
    porQue: `Reportado en ${original} y la unidad canónica es ${a.unidad}. No hay factor de conversión con fuente, así que el valor se conserva TAL CUAL y no entra a la gráfica: convertirlo a ojo sería inventar una equivalencia.`,
  }
}

export const POR_QUE_NO_SE_TIRA_LA_FILA =
  'Su §1 lo ordena: fuera de rango se acepta PROVISIONALMENTE y se marca para '
  + 'verificar. Tirarla dejaba al paciente cuyo laboratorio reporta en unidades '
  + 'del SI sin serie y sin aviso — el defecto se veía como una gráfica corta, '
  + 'que es como no verse.'

export const POR_QUE_TAN_POCAS_CONVERSIONES =
  'Un factor de conversión es una EQUIVALENCIA, y la regla 1 de seguridad '
  + 'clínica las nombra: o salen de una fuente citada, o no existen. Aquí viven '
  + 'las dos que el documento del dueño sostiene; las demás lo esperan a él.'

export const LO_QUE_ESTA_CAPA_NO_HACE: readonly string[] = Object.freeze([
  'No detecta el decimal desplazado (§29): mirar ×10, ÷10, ×100… y SUGERIR revisión es otra unidad de trabajo.',
  'No distingue «sin unidad» de «unidad canónica»: las dos se tratan igual, como antes de D-032. Su §33 tiene `MISSING_UNIT` y todavía no está.',
  'No trae LOINC ni UCUM (§27.2, §27.3): la identificación estandarizada del analito es otro trabajo, y mapear un LOINC equivocado viaja al exterior dentro de un `Observation` de FHIR.',
  'No es la capa de valores críticos ni la de decisión clínica (§26): esta capa sólo dice si el número se puede creer tal como está escrito.',
])
