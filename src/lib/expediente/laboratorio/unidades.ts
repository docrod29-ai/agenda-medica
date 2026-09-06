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
import { MOLECULA, VALENCIA, masaMolar, FUENTE_DE_LOS_PESOS } from './masa-molar'

/** Los estados del §33 que esta capa sabe producir. Ni uno inventado. */
export type EstadoDeValidacion =
  /** Unidad canónica (o convertida con factor citado) y valor plausible. */
  | 'ACCEPTED'
  /** La unidad no es la canónica y no hay factor citado para convertirla. */
  | 'VERIFY_UNIT'
  /** Unidad conocida y valor fuera de los límites de captura. */
  | 'VERIFY_VALUE_OR_UNIT'
  /**
   * LA HOJA NO DIJO LA UNIDAD — §33 de D-032, REG-557.
   *
   * Se asume la canónica, que es lo que este código hacía desde siempre y lo que
   * casi siempre acierta. Lo que cambia es que **deja de ser silencioso**: el
   * resultado dice que la unidad se asumió, y `unidadOriginal` se queda VACÍA en
   * vez de rellenarse con la que nadie escribió.
   */
  | 'MISSING_UNIT'

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
    /**
     * `10³/µL` y `10^3/µL` son LA MISMA unidad escrita de dos maneras: el
     * documento del dueño usa el circunflejo y los analitos de producción el
     * superíndice. Es TIPOGRAFÍA, no una equivalencia clínica — no hay factor de
     * por medio, es el mismo número y la misma magnitud, así que esto no es una
     * conversión inventada.
     *
     * Sin esto, media biometría hemática salía marcada `VERIFY_UNIT` por un
     * carácter, y una compuerta que avisa de todo se aprende a cerrar sin leer.
     */
    .replace(/³/g, '^3').replace(/⁶/g, '^6').replace(/²/g, '^2')
    .replace(/\s+/g, '')
    .trim()
}

/**
 * ── LAS CONVERSIONES YA NO SE TECLEAN: SE CALCULAN — REG-558 ────────────────
 *
 * Hasta ayer aquí vivían DOS factores, los únicos que el documento del dueño
 * sostenía, y la glucosa se quedaba fuera aunque 18,0182 se sepa de memoria.
 * Saberse un número no es tener una fuente.
 *
 * Ahora no hay ni un factor tecleado. Hay dos mecanismos, y los dos son
 * aritmética comprobable:
 *
 *  1. **Escala** — `mg/dL` ↔ `mg/L` es dividir entre diez. Prefijos del SI, sin
 *     química de por medio. Aquí entra la PCR reportada en mg/dL, que era el
 *     caso silencioso de REG-554.
 *  2. **Masa molar** — `mmol/L` → `mg/dL` es multiplicar por la masa molar
 *     partida por diez, y la masa molar sale de la fórmula molecular y de los
 *     pesos atómicos de la IUPAC (`masa-molar.ts`).
 *
 * ── Y HAY DOS TESTIGOS ──────────────────────────────────────────────────────
 *
 * El documento del médico dueño trae dos cifras trabajadas, y la derivación las
 * reproduce **sin usarlas**:
 *
 *     §27.1  creatinina 140 µmol/L → 1,58 mg/dL     · derivado: 1,5837 ✔
 *     §6     vitamina D ng/mL × 2,496 ≈ nmol/L      · derivado: 2,4960 ✔
 *
 * No son la fuente: son la prueba. Si la derivación se rompiera, esos dos caen.
 */

/** Volumen del denominador en litros: `mg/dL` → 0,1 L. */
const VOLUMEN: Readonly<Record<string, number>> = Object.freeze({ '/l': 1, '/dl': 0.1, '/ml': 0.001 })
/** Gramos que hay en la unidad de masa: `mg` → 1e-3. */
const MASA: Readonly<Record<string, number>> = Object.freeze({ g: 1, mg: 1e-3, ug: 1e-6, ng: 1e-9, pg: 1e-12 })
/** Moles que hay en la unidad de cantidad: `mmol` → 1e-3. */
const CANTIDAD: Readonly<Record<string, number>> = Object.freeze({ mol: 1, mmol: 1e-3, umol: 1e-6, nmol: 1e-9, pmol: 1e-12 })

function partir(u: string): { numerador: string; denominador: string } | null {
  const i = u.indexOf('/')
  if (i <= 0) return null
  return { numerador: u.slice(0, i), denominador: u.slice(i) }
}

/**
 * ── LA MISMA ARITMÉTICA PARA LAS DOS COSAS, Y NO ES ELEGANCIA ───────────────
 *
 * La primera versión de la escala era una tabla escrita a mano con un factor por
 * unidad. Medida antes de conectarla, daba esto:
 *
 *     ferritina µg/L → ng/mL  =  0,0001
 *
 * Son **la misma unidad**: 1 µg/L es 1 ng/mL. Ese factor habría dividido una
 * ferritina entre diez mil, en silencio, y una ferritina de 200 000 en un HLH
 * habría entrado al expediente como 20.
 *
 * La causa fue hacerme una tabla propia en vez de usar la aritmética que ya
 * estaba: masa partida por volumen. Es el mismo error que el medidor casero de
 * REG-553, en otra capa. Ahora la escala se calcula igual que la molar y con las
 * mismas tablas de masa y volumen — no hay dos maneras de contar lo mismo.
 */
function factorDeEscala(desde: string, hacia: string): number | null {
  const d = partir(desde), h = partir(hacia)
  if (!d || !h) return null
  const masaDesde = MASA[d.numerador], volDesde = VOLUMEN[d.denominador]
  const masaHacia = MASA[h.numerador], volHacia = VOLUMEN[h.denominador]
  if (masaDesde === undefined || volDesde === undefined) return null
  if (masaHacia === undefined || volHacia === undefined) return null
  // (masa/volumen) de origen, pasado a g/L, y de ahí a la unidad de destino.
  return (masaDesde / volDesde) * volHacia / masaHacia
}

/**
 * Factor de una unidad de CANTIDAD a una de MASA, con la masa molar.
 *
 * `mmol/L` → `mg/dL` con M = 180,156:
 *   1 mmol/L = 1e-3 mol/L · 180,156 g/mol = 0,180156 g/L = 18,0156 mg/dL
 */
function factorMolar(desde: string, hacia: string, masaMolarGmol: number): number | null {
  const d = partir(desde), h = partir(hacia)
  if (!d || !h) return null
  const moles = CANTIDAD[d.numerador], volDesde = VOLUMEN[d.denominador]
  const gramos = MASA[h.numerador], volHacia = VOLUMEN[h.denominador]
  if (moles === undefined || volDesde === undefined || gramos === undefined || volHacia === undefined) return null
  // (moles/L) · (g/mol) = g/L ; luego se pasa a la unidad de masa y al volumen.
  const gPorLitro = (moles / volDesde) * masaMolarGmol
  return gPorLitro * volHacia / gramos
}

/**
 * La conversión de una unidad reportada a la canónica del analito, o `null`.
 *
 * NUNCA devuelve un factor sin explicar de dónde sale. Y nunca devuelve uno
 * cuando el analito no es una molécula sola: los triglicéridos usan una masa
 * molar CONVENCIONAL, no una constante, y eso se declara en `LO_QUE_NO_SE_DERIVA`.
 */
export function conversionPara(a: Analito, unidadOrigen: string): Conversion | null {
  const desde = claveDeUnidad(unidadOrigen)
  const hacia = claveDeUnidad(a.unidad)
  if (!desde || desde === hacia) return null

  const escala = factorDeEscala(desde, hacia)
  if (escala !== null) {
    return {
      factor: escala,
      fuente: `Escala del SI: ${unidadOrigen} → ${a.unidad} es un cambio de prefijo (×${escala}). No hay química de por medio.`,
    }
  }

  /**
   * Equivalentes: `mEq/L = mmol/L × |z|`. Es la definición de equivalente y la
   * carga del ion, no una convención de laboratorio.
   */
  const ion = VALENCIA[a.clave]
  if (ion) {
    const d = partir(desde), h = partir(hacia)
    const esCantidad = d && CANTIDAD[d.numerador] !== undefined
    const esEquivalente = h && h.numerador === 'meq' && CANTIDAD['mmol'] !== undefined
    if (d && h && esCantidad && esEquivalente && d.denominador === h.denominador) {
      const factor = (CANTIDAD[d.numerador] / CANTIDAD['mmol']) * ion.z
      return {
        factor,
        fuente:
          `Calculado, no tecleado: un equivalente es un mol por el valor absoluto de la carga `
          + `(${ion.fuente}), así que ${unidadOrigen} → ${a.unidad} = ×${factor}.`,
      }
    }
  }

  const molecula = MOLECULA[a.clave]
  if (!molecula) return null
  const M = masaMolar(molecula.formula)
  if (M === null) return null
  const molar = factorMolar(desde, hacia, M)
  if (molar === null || !Number.isFinite(molar) || molar <= 0) return null
  return {
    factor: molar,
    fuente:
      `Calculado, no tecleado: masa molar de ${molecula.formula} = ${M.toFixed(3)} g/mol `
      + `(${molecula.fuente} Pesos atómicos: ${FUENTE_DE_LOS_PESOS}). `
      + `De ahí, ${unidadOrigen} → ${a.unidad} = ×${molar.toPrecision(6)}.`,
  }
}

/**
 * LOS DOS TESTIGOS DEL MÉTODO — no son la fuente, son la prueba.
 *
 * El documento del dueño trae dos cifras trabajadas. La derivación las reproduce
 * sin usarlas, y su golden lo comprueba. Si el método se rompiera, caen.
 */
export const TESTIGOS_DEL_DOCUMENTO = Object.freeze([
  { que: 'creatinina 140 µmol/L → 1,58 mg/dL', donde: 'D-032 §27.1' },
  { que: 'vitamina D ng/mL × 2,496 ≈ nmol/L', donde: 'D-032 §6' },
])

/**
 * LO QUE FALTA, DICHO POR SU NOMBRE.
 *
 * Cada entrada es un caso REAL que hoy se queda en `VERIFY_UNIT`. No se rellenan
 * con «lo habitual»: son equivalencias y las fija el médico dueño.
 */
export const CONVERSIONES_QUE_FALTAN: readonly { readonly analito: string; readonly desde: string; readonly porQue: string }[] = Object.freeze([
  {
    analito: 'trigliceridos', desde: 'mmol/L',
    porQue:
      'NEEDS_CLINICAL_REVIEW. No es una molécula sola: es una mezcla, y el laboratorio usa una '
      + 'masa molar CONVENCIONAL (la de la trioleína) elegida por acuerdo, no medida. Derivarla '
      + 'sería inventar una equivalencia con aspecto de cálculo.',
  },
  {
    analito: 'hormonas y marcadores en unidades de actividad', desde: 'IU/mL · U/mL',
    porQue:
      'NEEDS_CLINICAL_REVIEW. Una unidad internacional NO es masa: no hay masa molar que la '
      + 'convierta, y el factor depende del ensayo y del fabricante. Se decide por analito.',
  },
  {
    analito: 'calcio · magnesio · fósforo', desde: 'mmol/L',
    porQue:
      'NEEDS_CLINICAL_REVIEW. Son derivables por masa molar (son elementos), pero su unidad '
      + 'canónica aquí viene del catálogo del dueño y todavía no se ha comprobado con un testigo '
      + 'suyo. Se añaden cuando haya con qué comprobarlas, no antes.',
  },
])

/**
 * ── §29 · EL DECIMAL QUE SE CORRIÓ ──────────────────────────────────────────
 *
 * «Antes de marcar un valor como imposible, evaluar candidatos: ×10 ÷10 ×100
 * ÷100 ×1000 ÷1000. Ejemplo: Na = 1400 mmol/L podría ser 140 mmol/L. Pero el
 * sistema debe **sugerir revisión, no corregir automáticamente**.»
 *
 * ── LO QUE ESTO NO PUEDE HACER, Y ES LO IMPORTANTE ──────────────────────────
 *
 * **Sólo se ofrece cuando la unidad ES la canónica.** Y no es un detalle de
 * implementación: es la diferencia entre ayudar y mentir.
 *
 * Una glucosa de 7,2 mmol/L multiplicada por 10 da 72, que es una glucosa
 * perfectamente plausible en mg/dL. La sugerencia sería «¿quizá 72 mg/dL?» y
 * estaría MAL: 7,2 mmol/L son 130 mg/dL. El decimal no se había corrido — lo que
 * pasaba es que la unidad era otra.
 *
 * Cuando la unidad no cuadra, la explicación es la unidad. Ofrecer un decimal
 * ahí es dar una respuesta verosímil a la pregunta equivocada, que es la peor
 * clase de ayuda que puede dar un sistema clínico.
 *
 * ── Y CUANDO HAY VARIOS CANDIDATOS, SE DICEN TODOS ──────────────────────────
 *
 * Una ferritina de 2 000 000 cabe en el rango dividida entre 10, entre 100 y
 * entre 1000. Elegir uno sería adivinar. Se enseñan los tres y se dice que son
 * varios: ante la ambigüedad se pregunta, no se resuelve.
 */
export const FACTORES_DE_DECIMAL: readonly number[] = Object.freeze([10, 0.1, 100, 0.01, 1000, 0.001])

export interface DecimalCorrido {
  /** Los valores que SÍ caerían dentro de los límites, en el orden de §29. */
  readonly candidatos: readonly { readonly factor: number; readonly valor: number }[]
  /** Sólo uno encaja: la sugerencia es fuerte. Con varios, hay que preguntar. */
  readonly unico: boolean
}

/**
 * ¿Este valor imposible se explicaría con un decimal corrido?
 *
 * `null` cuando el valor ya es plausible (no hay nada que sugerir) o cuando
 * ningún desplazamiento lo mete en rango (entonces no es un decimal: es otra
 * cosa, y decirlo sería inventarse una explicación).
 */
export function decimalCorrido(a: Analito, valor: number): DecimalCorrido | null {
  const dentro = (v: number) => Number.isFinite(v) && v >= a.min && v <= a.max
  if (!Number.isFinite(valor) || dentro(valor)) return null
  const candidatos = FACTORES_DE_DECIMAL
    .map(factor => ({ factor, valor: valor * factor }))
    .filter(c => dentro(c.valor))
  if (candidatos.length === 0) return null
  return { candidatos, unico: candidatos.length === 1 }
}

export interface Dictamen {
  readonly estado: EstadoDeValidacion
  /** El valor en la unidad canónica del analito. */
  readonly valor: number
  readonly unidad: string
  /** Lo que decía la hoja. NUNCA se pierde (§27.1). */
  readonly valorOriginal: number
  /**
   * La unidad tal como la imprimió el laboratorio. `undefined` cuando la hoja no
   * la dijo — y ESO es el arreglo de REG-557: antes se rellenaba con la unidad
   * canónica, así que el campo que existe para conservar lo que dijo el
   * laboratorio decía lo que habíamos asumido nosotros. Indistinguible de una
   * hoja que sí lo dijo.
   */
  readonly unidadOriginal?: string
  /** La unidad con la que se juzgó cuando la hoja no la traía. */
  readonly unidadAsumida?: string
  /** Con qué factor se convirtió, y de dónde sale. Ausente si no se convirtió. */
  readonly conversion?: Conversion
  /** Sólo entra a la serie temporal lo que está ACEPTADO. */
  readonly graficable: boolean
  readonly porQue: string
  /**
   * §29 — el decimal que se corrió. SUGERENCIA, nunca corrección: el valor de
   * arriba sigue siendo el que imprimió el laboratorio.
   */
  readonly decimalCorrido?: DecimalCorrido
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
  const laHojaNoLaDijo = uOriginal === ''
  /**
   * REG-557: `unidadOriginal` sólo lleva lo que la hoja dijo. Si no dijo nada, se
   * queda vacía y la asumida viaja aparte. Rellenarla con la canónica era
   * fabricar el dato que este campo existe para conservar (§27.1), y dejaba una
   * hoja muda indistinguible de una que sí declaró la unidad.
   */
  const base = laHojaNoLaDijo
    ? { valorOriginal: valor, unidadAsumida: a.unidad }
    : { valorOriginal: valor, unidadOriginal: original }
  const plausible = (v: number) => Number.isFinite(v) && v >= a.min && v <= a.max

  // 1 · Sin unidad, o ya en la canónica: no hay nada que convertir.
  if (laHojaNoLaDijo || uOriginal === uCanonica) {
    return plausible(valor)
      ? {
        ...base,
        /**
         * SIGUE GRAFICÁNDOSE, y es a propósito. Casi todas las hojas mudas están
         * en la unidad de siempre, y no graficarlas vaciaría las series de medio
         * consultorio por una marca de cautela. Lo que se gana aquí es que la
         * suposición SE VEA — no que se deje de suponer.
         */
        estado: laHojaNoLaDijo ? 'MISSING_UNIT' : 'ACCEPTED',
        valor, unidad: a.unidad, graficable: true,
        porQue: laHojaNoLaDijo
          ? `La hoja no dijo la unidad. Se asumió ${a.unidad}, que es la convencional de este analito, y el valor cabe en sus límites. Si la hoja usaba otra, este número significa otra cosa.`
          : 'Unidad canónica y valor dentro de los límites de captura.',
      }
      : {
        ...base, estado: 'VERIFY_VALUE_OR_UNIT', valor, unidad: a.unidad, graficable: false,
        /** §29: se ofrece el candidato SOLO aquí, donde la unidad ya cuadra. */
        decimalCorrido: decimalCorrido(a, valor) ?? undefined,
        porQue: laHojaNoLaDijo
          ? `${valor} queda fuera de ${a.min}–${a.max} ${a.unidad}, y la hoja NO dijo la unidad. Con las dos cosas en duda, la sugerencia de decimal es sólo una de las explicaciones posibles: la otra es que venga en otra unidad.`
          : `${valor} queda fuera de ${a.min}–${a.max} ${a.unidad}. Se conserva sin convertir ni truncar: puede ser un decimal corrido, un error de lectura o un valor extraordinario real (§30).`,
      }
  }

  // 2 · Otra unidad, con factor citado: se convierte y SE DICE con qué.
  const conv = conversionPara(a, original)
  if (conv) {
    /**
     * `toPrecision(12)` quita el ruido del coma flotante binario —7,2 × 18,0156
     * da 129,71232000000003— y NADA más: doce cifras significativas están muy por
     * encima de lo que cualquier laboratorio reporta, así que esto no redondea el
     * resultado, sólo borra la basura del binario. Truncar de verdad está
     * prohibido por el §1 y no se hace en ningún sitio.
     */
    const convertido = Number((valor * conv.factor).toPrecision(12))
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

export const POR_QUE_EL_DECIMAL_NO_SE_OFRECE_EN_OTRA_UNIDAD =
  'Una glucosa de 7,2 mmol/L por 10 da 72, que es una glucosa plausible en '
  + 'mg/dL — y estaría MAL: 7,2 mmol/L son 130 mg/dL. Cuando la unidad no cuadra, '
  + 'la explicación es la unidad. Ofrecer un decimal ahí es dar una respuesta '
  + 'verosímil a la pregunta equivocada.'

export const LO_QUE_ESTA_CAPA_NO_HACE: readonly string[] = Object.freeze([
  'El decimal desplazado (§29) se SUGIERE y nunca se aplica: el valor que se guarda sigue siendo el que imprimió el laboratorio. Y sólo se sugiere con la unidad canónica.',
  'Con la hoja muda SIGUE graficando: se asume la unidad convencional y se marca `MISSING_UNIT`, pero no se deja de suponer. Dejar de graficar esas filas vaciaría medio expediente por cautela, y eso es una decisión del médico dueño.',
  'Y por eso NO se adoptan los rangos anchos del catálogo (§30) para los analitos que ya existían: con la hoja muda, un rango ancho acepta en silencio un valor que venía en otra unidad. Lo que desbloquearía eso es dejar de graficar lo mudo, que es la decisión de arriba.',
  'No trae LOINC ni UCUM (§27.2, §27.3): la identificación estandarizada del analito es otro trabajo, y mapear un LOINC equivocado viaja al exterior dentro de un `Observation` de FHIR.',
  'No es la capa de valores críticos ni la de decisión clínica (§26): esta capa sólo dice si el número se puede creer tal como está escrito.',
])
