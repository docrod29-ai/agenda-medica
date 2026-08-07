// ══════════════════════════════════════════════════════════════
// Valores CRÍTICOS de laboratorio (valores de pánico) — motor determinista.
// Marca crítico por RANGO numérico aunque el técnico olvide el flag manual o
// el LIS no lo etiquete. Red de seguridad para alertar al médico.
//
// ⚠️ PROCEDENCIA DE LOS UMBRALES: los números de abajo vienen de la versión
// anterior de este archivo y NO tienen fuente citada. No se ha cambiado ninguno
// en esta revisión — cambiarlos es una decisión clínica que corresponde al
// médico responsable, no a una corrección de software. Lo que sí se arregló es
// que se comparaban a ciegas (ver UNIDADES y EXCLUSIONES).
// ══════════════════════════════════════════════════════════════

interface RangoCritico {
  re: RegExp
  /** Nombres que NO debe capturar aunque casen con `re`. */
  no?: RegExp
  bajo?: number
  alto?: number
  /**
   * Unidad en la que están expresados `bajo`/`alto`.
   *
   * EL DEFECTO QUE CIERRA: la función no recibía la unidad, y los umbrales están
   * implícitamente en unidades convencionales. Un calcio de 3.5 mmol/L es
   * hipercalcemia SEVERA; contra el umbral en mg/dL (`bajo: 6`) se marcaba
   * crítico *por bajo*, y el médico leía hipocalcemia donde había lo contrario.
   * Una alerta con la dirección invertida es peor que no alertar. Lo mismo con
   * creatinina en µmol/L o hemoglobina en g/L, que además llenaban de falsos
   * positivos el canal que existe para que no se pierda un potasio de 7.2.
   */
  unidad: RegExp
}

/** Unidades habituales, normalizadas (sin espacios, minúsculas). */
const U = {
  /**
   * OJO con los opcionales: `g\/?d?l` casaba también **g/L**, que es la unidad
   * del SI para hemoglobina — 90 g/L es una hemoglobina de 9 g/dL, perfectamente
   * normal, y se marcaba crítica por alta contra el umbral de 20 g/dL. Es
   * exactamente el falso positivo que este cambio venía a eliminar, y lo cazó la
   * prueba. La `d` NO es opcional.
   */
  mgdl:  /^mg\/dl$|^mgdl$/,
  gdl:   /^g\/dl$|^gdl$/,
  meql:  /^m(eq|mol)\/?l$/,          // mEq/L y mmol/L son intercambiables para Na/K
  mmoll: /^mmol\/?l$/,
  miles: /^(x?10\^?3\/?u?l|miles?\/?u?l|k\/?u?l|10\*3\/u?l)$/,  // ×10³/µL
  mmhg:  /^mm?hg$/,
  ngml:  /^ng\/?ml$/,
  sin:   /^$/,                        // adimensional (pH, INR)
  mgdl_o_sin: /^(mg\/?d?l|)$/,
}

const CRITICOS: RangoCritico[] = [
  { re: /potasio|\bk\b|kalio/,          unidad: U.meql,  bajo: 2.5, alto: 6.5 },
  { re: /sodio|\bna\b|natrem/,          unidad: U.meql,  bajo: 120, alto: 160 },
  { re: /glucosa|glicemia|glucemia/,    unidad: U.mgdl,  bajo: 50,  alto: 400 },
  { re: /calcio/,                       unidad: U.mgdl,  bajo: 6,   alto: 13 },
  { re: /magnesio/,                     unidad: U.mgdl,  bajo: 1,   alto: 4.7 },
  /**
   * "fosfat" casaba FOSFATASA ALCALINA, que viene en las pruebas de función
   * hepática: 120 U/L se marcaba crítico contra un umbral de fósforo de 9 mg/dL.
   */
  { re: /fosfor|fosfat/, no: /fosfatasa/, unidad: U.mgdl, bajo: 1, alto: 9 },
  /**
   * "hemoglobina" casaba HEMOGLOBINA GLUCOSILADA: una HbA1c de 6.5 % disparaba
   * alerta de anemia crítica. El otro extractor del repo ya excluía esto
   * (labs-desde-texto.ts); aquí faltaba.
   */
  { re: /hemoglobina|\bhb\b/, no: /glucosilada|glicada|a1c/, unidad: U.gdl, bajo: 7, alto: 20 },
  { re: /plaqueta/,                     unidad: U.miles, bajo: 20,  alto: 1000 },
  { re: /leucocito/,                    unidad: U.miles, bajo: 1,   alto: 50 },
  { re: /lactato/,                      unidad: U.mmoll, alto: 4 },
  { re: /\binr\b/,                      unidad: U.sin,   alto: 5 },
  { re: /fibrinogeno/,                  unidad: U.mgdl,  bajo: 100 },
  /**
   * "\bph\b" casaba el pH del EXAMEN GENERAL DE ORINA, que está en el catálogo
   * de estudios rápidos: un pH urinario de 5.5 (normal) disparaba alerta de
   * acidemia crítica. Se exige que sea gasometría/sangre.
   */
  { re: /\bph\b/, no: /orina|urin|ego|urinario/, unidad: U.sin, bajo: 7.2, alto: 7.6 },
  { re: /pco2|paco2/,                   unidad: U.mmhg,  alto: 60 },
  { re: /po2|pao2/,                     unidad: U.mmhg,  bajo: 55 },
  { re: /troponina/,                    unidad: U.ngml,  alto: 0.04 },
  /** "creatinina" casaba también la creatinina EN ORINA (otra escala por completo). */
  { re: /creatinina/, no: /orina|urin|depuracion|clearance/, unidad: U.mgdl, alto: 4 },
  { re: /bilirrubina/,                  unidad: U.mgdl,  alto: 15 },
]

/**
 * El comparador con el que el laboratorio CENSURÓ el valor: «>400», «<50».
 *
 * `≥` se lee como `>` y `≤` como `<`, la misma normalización que ya hace el
 * antibiograma (`antibiograma/cmi.ts`): dos criterios distintos para el mismo
 * signo en el mismo repositorio es como se cuelan las contradicciones.
 */
export type Censura = '>' | '<'

/** Lee el comparador de una cadena de laboratorio; `undefined` si no lo trae. */
export function censuraDe(v: string | number | undefined | null): Censura | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return /^[>≥]/.test(t) ? '>' : /^[<≤]/.test(t) ? '<' : undefined
}

/**
 * Juzga un valor CENSURADO por intervalo, no por el número pelado.
 *
 * ── EL DEFECTO QUE CIERRA (REG-192) ──────────────────────────────────────────
 *
 * El prompt de visión ordena, literalmente, conservar el «<» o el «>» del
 * reporte. Y llegaba: la IA lo devolvía. Pero `aNumero` lo pelaba y aquí se
 * comparaba el número desnudo con `>` y `<` ESTRICTOS, así que una glucosa
 * «>400» quedaba en `400 > 400` = falso y se archivaba como **normal**. Lo
 * mismo con «<50»: `50 < 50` = falso. El dato cruzaba toda la tubería y moría
 * en la última línea, justo en el valor de pánico.
 *
 * Pelar el signo —lo que hizo REG-036 en UCI— no bastaba aquí: allí los cortes
 * son inclusivos (`k >= 6.5`) y aquí son estrictos. Por eso se razona sobre el
 * intervalo real, que es lo único que el reporte afirma:
 *
 *   «>n»  ⇒  el valor real está en (n, ∞)
 *   «<n»  ⇒  el valor real está en (−∞, n)
 *
 * Cuando el intervalo entero cae del lado crítico, es crítico. Cuando cae
 * entero del lado sano, es sano. Cuando el intervalo CRUZA el umbral —una
 * glucosa «>200» contra un corte de 400— no se sabe, y se dice que no se sabe:
 * ausencia de dato no es dato de ausencia.
 *
 * No se toca ni un umbral: todos son los que ya estaban en `CRITICOS`.
 */
function evaluarCensurado(cen: Censura, v: number, r: RangoCritico): EvaluacionCritico {
  if (cen === '>') {
    // Real ∈ (v, ∞): sólo puede disparar el corte ALTO.
    if (r.alto != null && v >= r.alto) return { critico: true, evaluable: true }
    // Sin corte alto, y ya por encima del bajo, el intervalo entero es sano.
    if (r.alto == null && (r.bajo == null || v >= r.bajo)) return { critico: false, evaluable: true }
  } else {
    // Real ∈ (−∞, v): sólo puede disparar el corte BAJO.
    if (r.bajo != null && v <= r.bajo) return { critico: true, evaluable: true }
    if (r.bajo == null && (r.alto == null || v <= r.alto)) return { critico: false, evaluable: true }
  }
  return {
    critico: false,
    evaluable: false,
    motivo: `valor censurado («${cen}${v}»): el intervalo real cruza el umbral crítico y no se puede juzgar`,
  }
}

/** Normaliza texto para comparar: minúsculas, sin acentos. */
function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Normaliza una unidad: minúsculas, sin espacios ni puntos, µ→u. */
function normUnidad(u: string | undefined | null): string {
  return norm(u ?? '').replace(/µ|μ/g, 'u').replace(/[\s.]/g, '')
}

export interface EvaluacionCritico {
  critico: boolean
  /**
   * `false` = no se pudo juzgar (unidad desconocida o distinta de la del umbral).
   * NO es lo mismo que "normal": quien llama debe poder decirlo, en vez de que
   * un resultado se dé por bueno solo porque el motor no supo leerlo.
   */
  evaluable: boolean
  motivo?: string
}

/** Evalúa un resultado contra los rangos de pánico, respetando la unidad. */
export function evaluarCriticoLab(
  estudio: string,
  valor: string | number,
  unidad?: string | null,
  /**
   * El comparador, cuando quien llama YA peló el número (la ruta del panel de
   * laboratorio pasa por `aNumero`, que lo quita). Si `valor` viene como cadena
   * con su signo, se lee de ahí y no hace falta pasarlo.
   */
  censurada?: Censura,
): EvaluacionCritico {
  const cen = censurada ?? censuraDe(valor)
  const v = typeof valor === 'number'
    ? valor
    : parseFloat(String(valor).replace(',', '.').replace(/^\s*[<>≤≥]+\s*/, ''))
  if (isNaN(v)) return { critico: false, evaluable: false, motivo: 'el valor no es numérico' }
  const n = norm(estudio)
  const u = normUnidad(unidad)

  for (const r of CRITICOS) {
    if (!r.re.test(n)) continue
    if (r.no?.test(n)) continue
    /**
     * Si el laboratorio NO reporta unidad se asume la convencional, que es lo que
     * se hacía antes y lo que hace todo LIS mexicano. Si la reporta y no es la
     * del umbral, no se compara: se dice que no es evaluable.
     */
    if (u && !r.unidad.test(u)) {
      return { critico: false, evaluable: false, motivo: `reportado en ${unidad}, el umbral está en otra unidad` }
    }
    if (cen) return evaluarCensurado(cen, v, r)
    if (r.bajo != null && v < r.bajo) return { critico: true, evaluable: true }
    if (r.alto != null && v > r.alto) return { critico: true, evaluable: true }
    return { critico: false, evaluable: true }
  }
  return { critico: false, evaluable: false, motivo: 'sin rango crítico definido para este estudio' }
}

/** ¿El valor numérico de este estudio cae en rango crítico (pánico)? */
export function esCriticoLab(estudio: string, valor: string | number, unidad?: string | null, censurada?: Censura): boolean {
  return evaluarCriticoLab(estudio, valor, unidad, censurada).critico
}
