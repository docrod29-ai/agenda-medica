/**
 * CATÁLOGO DE ANALITOS DE LABORATORIO — para el seguimiento longitudinal.
 *
 * Este catálogo hace tres cosas y solo tres:
 *  1. Da una CLAVE canónica a cada analito, para que "Glucosa", "Glu" y "glucemia"
 *     terminen en la misma serie temporal y su gráfica no se parta en tres.
 *  2. Fija la unidad esperada y un rango plausible, para descartar valores que
 *     vienen en otra unidad (que graficados juntos producen un salto falso).
 *  3. Aporta el rango de referencia adulto por defecto SOLO como banda visual en
 *     la gráfica — nunca sustituye al que traiga el propio laboratorio.
 *
 * NO inventa interpretación clínica: la criticidad la decide `evaluarCriticoLab`
 * (motor ya existente y auditado), no este archivo.
 *
 * Puro y determinista → testeable.
 */

export interface Analito {
  /** Clave canónica estable (la serie temporal se agrupa por esto). */
  clave: string
  /** Nombre para mostrar. */
  etiqueta: string
  /** Sinónimos y abreviaturas, como PALABRA (no subcadena). */
  patron: RegExp
  /** Unidad convencional esperada. */
  unidad: string
  /** Rango plausible: fuera de esto casi siempre es otra unidad → no se grafica junto. */
  min: number
  max: number
  /** Banda de referencia adulta (solo visual). Opcional. */
  refMin?: number
  refMax?: number
  /** Grupo para ordenar la vista. */
  grupo: 'renal' | 'hepatico' | 'lipidos' | 'glucemia' | 'hematologia' | 'electrolitos' | 'tiroides' | 'inflamacion' | 'otro'
}

/**
 * El orden importa: los compuestos van primero (hemoglobina glucosilada antes que
 * hemoglobina) para que el patrón específico gane al general.
 */
export const ANALITOS: Analito[] = [
  { clave: 'hba1c', etiqueta: 'Hemoglobina glucosilada (HbA1c)', patron: /\b(hba1c|hemoglobina\s+(glucosilada|glicada)|a1c)\b/i, unidad: '%', min: 3, max: 20, refMin: 4, refMax: 5.6, grupo: 'glucemia' },
  { clave: 'glucosa', etiqueta: 'Glucosa', patron: /\b(glucosa|glucemia|glicemia|glu)\b/i, unidad: 'mg/dL', min: 20, max: 1500, refMin: 70, refMax: 100, grupo: 'glucemia' },
  { clave: 'creatinina', etiqueta: 'Creatinina', patron: /\bcreatinina\b(?!\s*(en\s*)?orina)/i, unidad: 'mg/dL', min: 0.1, max: 25, refMin: 0.6, refMax: 1.3, grupo: 'renal' },
  { clave: 'urea', etiqueta: 'Urea', patron: /\burea\b/i, unidad: 'mg/dL', min: 1, max: 500, refMin: 15, refMax: 45, grupo: 'renal' },
  { clave: 'bun', etiqueta: 'BUN', patron: /\b(bun|nitrogeno ureico)\b/i, unidad: 'mg/dL', min: 1, max: 250, refMin: 7, refMax: 20, grupo: 'renal' },
  { clave: 'tfg', etiqueta: 'TFG (filtrado glomerular)', patron: /\b(tfg|egfr|filtrado glomerular|depuracion de creatinina)\b/i, unidad: 'mL/min', min: 1, max: 200, refMin: 90, refMax: 120, grupo: 'renal' },
  { clave: 'ast', etiqueta: 'AST (TGO)', patron: /\b(ast|tgo|aspartato)\b/i, unidad: 'U/L', min: 1, max: 5000, refMin: 0, refMax: 40, grupo: 'hepatico' },
  { clave: 'alt', etiqueta: 'ALT (TGP)', patron: /\b(alt|tgp|alanino)\b/i, unidad: 'U/L', min: 1, max: 5000, refMin: 0, refMax: 41, grupo: 'hepatico' },
  { clave: 'fosfatasaAlcalina', etiqueta: 'Fosfatasa alcalina', patron: /\b(fosfatasa alcalina|fa|alp)\b/i, unidad: 'U/L', min: 5, max: 3000, refMin: 40, refMax: 130, grupo: 'hepatico' },
  { clave: 'bilirrubinaTotal', etiqueta: 'Bilirrubina total', patron: /\bbilirrubina total\b/i, unidad: 'mg/dL', min: 0.1, max: 50, refMin: 0.2, refMax: 1.2, grupo: 'hepatico' },
  { clave: 'albumina', etiqueta: 'Albúmina', patron: /\balbumina\b/i, unidad: 'g/dL', min: 0.5, max: 7, refMin: 3.5, refMax: 5, grupo: 'hepatico' },
  { clave: 'colesterolTotal', etiqueta: 'Colesterol total', patron: /\bcolesterol total\b/i, unidad: 'mg/dL', min: 50, max: 800, refMin: 0, refMax: 200, grupo: 'lipidos' },
  { clave: 'hdl', etiqueta: 'Colesterol HDL', patron: /\b(hdl|colesterol hdl|c-hdl)\b/i, unidad: 'mg/dL', min: 5, max: 150, refMin: 40, refMax: 100, grupo: 'lipidos' },
  { clave: 'ldl', etiqueta: 'Colesterol LDL', patron: /\b(ldl|colesterol ldl|c-ldl)\b/i, unidad: 'mg/dL', min: 10, max: 500, refMin: 0, refMax: 100, grupo: 'lipidos' },
  { clave: 'trigliceridos', etiqueta: 'Triglicéridos', patron: /\btrigli(c|s)eridos\b/i, unidad: 'mg/dL', min: 20, max: 5000, refMin: 0, refMax: 150, grupo: 'lipidos' },
  { clave: 'hemoglobina', etiqueta: 'Hemoglobina', patron: /\bhemoglobina\b(?!\s*(glucosilada|glicada))/i, unidad: 'g/dL', min: 2, max: 25, refMin: 12, refMax: 17, grupo: 'hematologia' },
  { clave: 'hematocrito', etiqueta: 'Hematocrito', patron: /\b(hematocrito|hto|hct)\b/i, unidad: '%', min: 5, max: 75, refMin: 36, refMax: 50, grupo: 'hematologia' },
  { clave: 'leucocitos', etiqueta: 'Leucocitos', patron: /\b(leucocitos|leucos)\b/i, unidad: '10³/µL', min: 0.1, max: 500, refMin: 4, refMax: 11, grupo: 'hematologia' },
  { clave: 'plaquetas', etiqueta: 'Plaquetas', patron: /\bplaquetas?\b/i, unidad: '10³/µL', min: 1, max: 3000, refMin: 150, refMax: 450, grupo: 'hematologia' },
  { clave: 'sodio', etiqueta: 'Sodio', patron: /\b(sodio|na)\b/i, unidad: 'mEq/L', min: 100, max: 190, refMin: 135, refMax: 145, grupo: 'electrolitos' },
  { clave: 'potasio', etiqueta: 'Potasio', patron: /\b(potasio|k)\b/i, unidad: 'mEq/L', min: 1, max: 10, refMin: 3.5, refMax: 5.1, grupo: 'electrolitos' },
  { clave: 'cloro', etiqueta: 'Cloro', patron: /\b(cloro|cl)\b/i, unidad: 'mEq/L', min: 50, max: 150, refMin: 98, refMax: 107, grupo: 'electrolitos' },
  { clave: 'tsh', etiqueta: 'TSH', patron: /\b(tsh|tirotropina)\b/i, unidad: 'µUI/mL', min: 0.001, max: 200, refMin: 0.4, refMax: 4, grupo: 'tiroides' },
  { clave: 'pcr', etiqueta: 'PCR (proteína C reactiva)', patron: /\b(pcr|proteina c reactiva)\b/i, unidad: 'mg/L', min: 0, max: 600, refMin: 0, refMax: 5, grupo: 'inflamacion' },
]

/** Normaliza texto: minúsculas, sin acentos. */
function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

/**
 * A qué analito canónico corresponde un nombre de estudio. `null` si no se
 * reconoce (mejor no graficar que graficar en la serie equivocada).
 */
export function analitoDe(nombre: string): Analito | null {
  const n = norm(nombre)
  if (!n) return null
  return ANALITOS.find(a => a.patron.test(n)) ?? null
}

/** Busca por clave canónica exacta. */
export function analitoPorClave(clave: string): Analito | null {
  return ANALITOS.find(a => a.clave === clave) ?? null
}

/**
 * ¿El valor es plausible para este analito en su unidad convencional? Si viene en
 * otra unidad (creatinina en µmol/L, hemoglobina en g/L) cae fuera del rango y se
 * marca no-plausible, para no mezclar escalas en la misma gráfica.
 */
export function valorPlausible(clave: string, valor: number): boolean {
  const a = analitoPorClave(clave)
  if (!a) return false
  return Number.isFinite(valor) && valor >= a.min && valor <= a.max
}
