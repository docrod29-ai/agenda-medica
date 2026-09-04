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

import CATALOGO from './catalogo-d032.json'

export interface Analito {
  /** Clave canónica estable (la serie temporal se agrupa por esto). */
  clave: string
  /** Nombre para mostrar. */
  etiqueta: string
  /** Sinónimos y abreviaturas, como PALABRA (no subcadena). */
  patron: RegExp
  /** Unidad convencional esperada. */
  unidad: string
  /**
   * CUANDO EL NOMBRE NO BASTA — regla §25.2 del catálogo del dueño (D-032).
   *
   * «Neutrófilos 75 %» y «Neutrófilos 7.5 ×10³/µL» son resultados DISTINTOS y
   * el nombre impreso es el mismo. Si el analito declara esto, sólo se reconoce
   * cuando la unidad reportada casa: sin unidad **no se adivina**, la fila cae a
   * `noReconocidas` y se conserva como texto.
   *
   * Mapear el porcentaje a la serie del absoluto metería un 75 donde va un 7,5:
   * un valor mal leído, y ése es el eje que el médico puso en CERO (D-031).
   */
  exigeUnidad?: RegExp
  /**
   * EL NOMBRE PELADO, Y SÓLO DENTRO DE SU MUESTRA — REG-453.
   *
   * «LCR glucosa» y «Glucosa en líquido» se llaman «glucosa» a secas en su
   * propia hoja. Dentro de la muestra eso no es ambiguo, porque el filtro de
   * espécimen ya corrió.
   *
   * Va en un campo APARTE y no dentro de `patron` a propósito: hay tres sitios
   * que recorren `ANALITOS` mirando `patron` a pelo sobre texto libre, y con el
   * nombre desnudo ahí dentro un «glucosa» dictado habría casado con la glucosa
   * de LCR. Lo cazó una prueba de UCI, y la lección es que un patrón que sólo es
   * seguro detrás de un filtro no puede vivir donde se lee sin el filtro.
   */
  patronEnSuMuestra?: RegExp
  /** Rango plausible: fuera de esto casi siempre es otra unidad → no se grafica junto. */
  min: number
  max: number
  /** Banda de referencia adulta (solo visual). Opcional. */
  refMin?: number
  refMax?: number
  /** Grupo para ordenar la vista. */
  grupo: GrupoDeAnalito
  /**
   * DE QUÉ MUESTRA ES — REG-453, §26 y §27.3 del catálogo del dueño.
   *
   * Una glucosa en orina y una glucosa en suero NO son el mismo analito, y el
   * nombre impreso se parece demasiado. Sin esto, «Glucosa urinaria» caía en la
   * serie de la glucosa sérica.
   */
  especimen: Especimen
}

export type Especimen = 'suero' | 'orina' | 'lcr' | 'liquido'

export type GrupoDeAnalito =
  | 'renal' | 'hepatico' | 'lipidos' | 'glucemia' | 'hematologia' | 'electrolitos'
  | 'tiroides' | 'inflamacion' | 'coagulacion' | 'gasometria' | 'nutricion'
  | 'endocrino' | 'cardiologia' | 'inmunologia' | 'virologia' | 'micologia'
  | 'tumoral' | 'toxicologia' | 'orina' | 'lcr' | 'liquido' | 'otro'

/**
 * El orden importa: los compuestos van primero (hemoglobina glucosilada antes que
 * hemoglobina) para que el patrón específico gane al general.
 */
const ANALITOS_A_MANO: Analito[] = [
  { clave: 'hba1c', etiqueta: 'Hemoglobina glucosilada (HbA1c)', patron: /\b(hba1c|hemoglobina\s+(glucosilada|glicada)|a1c)\b/i, unidad: '%', min: 3, max: 20, refMin: 4, refMax: 5.6, grupo: 'glucemia', especimen: 'suero' },
  { clave: 'glucosa', etiqueta: 'Glucosa', patron: /\b(glucosa|glucemia|glicemia|glu)\b/i, unidad: 'mg/dL', min: 20, max: 1500, refMin: 70, refMax: 100, grupo: 'glucemia', especimen: 'suero' },
  { clave: 'creatinina', etiqueta: 'Creatinina', patron: /\bcreatinina\b(?!\s*(en\s*)?orina)/i, unidad: 'mg/dL', min: 0.1, max: 25, refMin: 0.6, refMax: 1.3, grupo: 'renal', especimen: 'suero' },
  { clave: 'urea', etiqueta: 'Urea', patron: /\burea\b/i, unidad: 'mg/dL', min: 1, max: 500, refMin: 15, refMax: 45, grupo: 'renal', especimen: 'suero' },
  { clave: 'bun', etiqueta: 'BUN', patron: /\b(bun|nitrogeno ureico)\b/i, unidad: 'mg/dL', min: 1, max: 250, refMin: 7, refMax: 20, grupo: 'renal', especimen: 'suero' },
  { clave: 'tfg', etiqueta: 'TFG (filtrado glomerular)', patron: /\b(tfg|egfr|filtrado glomerular|depuracion de creatinina)\b/i, unidad: 'mL/min', min: 1, max: 200, refMin: 90, refMax: 120, grupo: 'renal', especimen: 'suero' },
  { clave: 'ast', etiqueta: 'AST (TGO)', patron: /\b(ast|tgo|aspartato)\b/i, unidad: 'U/L', min: 1, max: 5000, refMin: 0, refMax: 40, grupo: 'hepatico', especimen: 'suero' },
  { clave: 'alt', etiqueta: 'ALT (TGP)', patron: /\b(alt|tgp|alanino)\b/i, unidad: 'U/L', min: 1, max: 5000, refMin: 0, refMax: 41, grupo: 'hepatico', especimen: 'suero' },
  { clave: 'fosfatasaAlcalina', etiqueta: 'Fosfatasa alcalina', patron: /\b(fosfatasa alcalina|fa|alp)\b/i, unidad: 'U/L', min: 5, max: 3000, refMin: 40, refMax: 130, grupo: 'hepatico', especimen: 'suero' },
  { clave: 'bilirrubinaTotal', etiqueta: 'Bilirrubina total', patron: /\bbilirrubina total\b/i, unidad: 'mg/dL', min: 0.1, max: 50, refMin: 0.2, refMax: 1.2, grupo: 'hepatico', especimen: 'suero' },
  { clave: 'albumina', etiqueta: 'Albúmina', patron: /\balbumina\b/i, unidad: 'g/dL', min: 0.5, max: 7, refMin: 3.5, refMax: 5, grupo: 'hepatico', especimen: 'suero' },
  { clave: 'colesterolTotal', etiqueta: 'Colesterol total', patron: /\bcolesterol total\b/i, unidad: 'mg/dL', min: 50, max: 800, refMin: 0, refMax: 200, grupo: 'lipidos', especimen: 'suero' },
  { clave: 'hdl', etiqueta: 'Colesterol HDL', patron: /\b(hdl|colesterol hdl|c-hdl)\b/i, unidad: 'mg/dL', min: 5, max: 150, refMin: 40, refMax: 100, grupo: 'lipidos', especimen: 'suero' },
  { clave: 'ldl', etiqueta: 'Colesterol LDL', patron: /\b(ldl|colesterol ldl|c-ldl)\b/i, unidad: 'mg/dL', min: 10, max: 500, refMin: 0, refMax: 100, grupo: 'lipidos', especimen: 'suero' },
  { clave: 'trigliceridos', etiqueta: 'Triglicéridos', patron: /\btrigli(c|s)eridos\b/i, unidad: 'mg/dL', min: 20, max: 5000, refMin: 0, refMax: 150, grupo: 'lipidos', especimen: 'suero' },
  { clave: 'hemoglobina', etiqueta: 'Hemoglobina', patron: /\bhemoglobina\b(?!\s*(glucosilada|glicada))/i, unidad: 'g/dL', min: 2, max: 25, refMin: 12, refMax: 17, grupo: 'hematologia', especimen: 'suero' },
  { clave: 'hematocrito', etiqueta: 'Hematocrito', patron: /\b(hematocrito|hto|hct)\b/i, unidad: '%', min: 5, max: 75, refMin: 36, refMax: 50, grupo: 'hematologia', especimen: 'suero' },
  { clave: 'leucocitos', etiqueta: 'Leucocitos', patron: /\b(leucocitos|leucos)\b/i, unidad: '10³/µL', min: 0.1, max: 500, refMin: 4, refMax: 11, grupo: 'hematologia', especimen: 'suero' },
  { clave: 'plaquetas', etiqueta: 'Plaquetas', patron: /\bplaquetas?\b/i, unidad: '10³/µL', min: 1, max: 3000, refMin: 150, refMax: 450, grupo: 'hematologia', especimen: 'suero' },
  { clave: 'sodio', etiqueta: 'Sodio', patron: /\b(sodio|na)\b/i, unidad: 'mEq/L', min: 100, max: 190, refMin: 135, refMax: 145, grupo: 'electrolitos', especimen: 'suero' },
  { clave: 'potasio', etiqueta: 'Potasio', patron: /\b(potasio|k)\b/i, unidad: 'mEq/L', min: 1, max: 10, refMin: 3.5, refMax: 5.1, grupo: 'electrolitos', especimen: 'suero' },
  { clave: 'cloro', etiqueta: 'Cloro', patron: /\b(cloro|cl)\b/i, unidad: 'mEq/L', min: 50, max: 150, refMin: 98, refMax: 107, grupo: 'electrolitos', especimen: 'suero' },
  { clave: 'tsh', etiqueta: 'TSH', patron: /\b(tsh|tirotropina)\b/i, unidad: 'µUI/mL', min: 0.001, max: 200, refMin: 0.4, refMax: 4, grupo: 'tiroides', especimen: 'suero' },
  /**
   * ── AÑADIDOS POR D-032 (REG-450) ───────────────────────────────────────────
   *
   * Los `min`/`max` NO se inventaron: son los del catálogo maestro de
   * plausibilidad del médico dueño, `docs/clinical/CATALOGO-PLAUSIBILIDAD-LABORATORIO.md`
   * §31, entregado el 2-sep-2026. Cada uno es un LÍMITE DE CAPTURA —fuera de
   * esto, casi seguro es otra unidad o un decimal corrido—, no un rango normal.
   *
   * Van SIN `refMin`/`refMax` a propósito: el §1 de ese catálogo dice que el
   * intervalo de referencia lo pone el laboratorio, con su método, sexo, edad y
   * población. Inventar aquí una banda de referencia sería exactamente lo que
   * ese documento prohíbe, y saldría pintada en la gráfica como si fuera suya.
   */
  { clave: 'acidoUrico', etiqueta: 'Ácido úrico', patron: /\b(acido urico|ac\.? urico|a\.? urico)\b/i, unidad: 'mg/dL', min: 0.1, max: 40, grupo: 'renal', especimen: 'suero' },
  { clave: 'ferritina', etiqueta: 'Ferritina', patron: /\bferritina\b/i, unidad: 'ng/mL', min: 0.1, max: 1000000, grupo: 'inflamacion', especimen: 'suero' },
  { clave: 'vitaminaD', etiqueta: 'Vitamina D (25-OH)', patron: /\b(vitamina d|25\s*-?\s*oh\s*d|25\s*hidroxi\s*vitamina\s*d|calcidiol)\b/i, unidad: 'ng/mL', min: 0.1, max: 500, grupo: 'otro', especimen: 'suero' },
  { clave: 'vcm', etiqueta: 'VCM (volumen corpuscular medio)', patron: /\b(vcm|mcv|volumen corpuscular medio)\b/i, unidad: 'fL', min: 30, max: 200, grupo: 'hematologia', especimen: 'suero' },
  /**
   * El diferencial leucocitario, partido en dos como manda el §25.2. El
   * absoluto va PRIMERO: su patrón es el específico («neutrófilos absolutos»,
   * «#neutrófilos», «ANC») y tiene que ganarle al general.
   */
  { clave: 'neutrofilosAbs', etiqueta: 'Neutrófilos absolutos', patron: /\b(neutrofilos?|neutros?|anc)\b/i, unidad: '10³/µL', min: 0, max: 500, grupo: 'hematologia', exigeUnidad: /10|\bµ?u?l\b|celulas|mm3/i, especimen: 'suero' },
  { clave: 'neutrofilosPct', etiqueta: 'Neutrófilos (%)', patron: /\b(neutrofilos?|neutros?)\b/i, unidad: '%', min: 0, max: 100, grupo: 'hematologia', exigeUnidad: /^\s*%\s*$/, especimen: 'suero' },
  { clave: 'linfocitosAbs', etiqueta: 'Linfocitos absolutos', patron: /\b(linfocitos?|linfos?|alc)\b/i, unidad: '10³/µL', min: 0, max: 500, grupo: 'hematologia', exigeUnidad: /10|\bµ?u?l\b|celulas|mm3/i, especimen: 'suero' },
  { clave: 'linfocitosPct', etiqueta: 'Linfocitos (%)', patron: /\b(linfocitos?|linfos?)\b/i, unidad: '%', min: 0, max: 100, grupo: 'hematologia', exigeUnidad: /^\s*%\s*$/, especimen: 'suero' },
  { clave: 'pcr', etiqueta: 'PCR (proteína C reactiva)', patron: /\b(pcr|proteina c reactiva)\b/i, unidad: 'mg/L', min: 0, max: 600, refMin: 0, refMax: 5, grupo: 'inflamacion', especimen: 'suero' },
]

/* ═══════════════════════════════════════════════════════════════════════════
   EL CATÁLOGO COMPLETO DE D-032 — REG-453.

   ── POR QUÉ NO ESTÁ TECLEADO AQUÍ ────────────────────────────────────────────

   Son 220 analitos con dos cifras cada uno. Teclearlos es una tarea mecánica
   larga, y ahí es donde se cuela el dígito cambiado: una ferritina con un cero
   de menos no rompe nada, no falla ninguna prueba, y convierte un límite de
   captura en otro.

   Los números salen del documento del médico dueño leídos por máquina
   (`scripts/laboratorio/catalogo-d032.mjs` → `catalogo-d032.json`). Lo único
   escrito a mano aquí es el VOCABULARIO —qué grupo y qué muestra tiene cada
   sección— y eso son veinte líneas, no cuatrocientas cifras.

   El script además comprueba que el documento no se contradiga a sí mismo:
   repite doce analitos entre secciones (la LDH está en hígado y en hemólisis) y
   las cifras coinciden en los doce. Si un día divergen, se le pregunta al dueño;
   no se elige una.
   ═════════════════════════════════════════════════════════════════════════ */

/** Qué grupo de la vista le toca a cada sección del documento. */
const GRUPO_POR_SECCION: Readonly<Record<number, GrupoDeAnalito>> = {
  2: 'hematologia', 3: 'electrolitos', 4: 'hepatico', 5: 'inflamacion',
  6: 'nutricion', 7: 'hematologia', 8: 'coagulacion', 9: 'gasometria',
  10: 'lipidos', 11: 'glucemia', 12: 'tiroides', 13: 'endocrino',
  14: 'cardiologia', 15: 'inmunologia', 16: 'inmunologia', 17: 'virologia',
  18: 'micologia', 19: 'tumoral', 20: 'orina', 21: 'lcr', 22: 'liquido',
  23: 'renal', 24: 'toxicologia', 31: 'otro',
}

/** De qué muestra habla cada sección. Las que no están aquí son de suero/sangre. */
const ESPECIMEN_POR_SECCION: Readonly<Record<number, Especimen>> = {
  20: 'orina', 21: 'lcr', 22: 'liquido',
}

/**
 * Nombres del documento que YA tienen analito escrito a mano, con su clave.
 *
 * Los treinta y dos de producción llevan patrones con sinónimos («Glu», «TGO»,
 * «Hto») y unidades que ya están en series de pacientes: no se regeneran. Esta
 * lista dice cuáles son para que el generador no cree un duplicado, y hay un
 * guardián que comprueba que cada clave de aquí existe de verdad.
 *
 * Los que NO están en esta lista y ya existían llevan otro nombre en el
 * documento y entran como analito nuevo — eso es correcto: son términos
 * distintos que el catálogo del dueño reconoce y el nuestro no reconocía.
 */
const YA_ESTA_A_MANO: Readonly<Record<string, string>> = {
  'hemoglobina': 'hemoglobina', 'hematocrito': 'hematocrito', 'vcm': 'vcm',
  'leucocitos': 'leucocitos', 'plaquetas': 'plaquetas',
  'neutrófilos': 'neutrofilosPct', 'neutrófilos absolutos': 'neutrofilosAbs',
  'linfocitos': 'linfocitosPct', 'linfocitos absolutos': 'linfocitosAbs',
  'sodio': 'sodio', 'potasio': 'potasio', 'cloro': 'cloro',
  'glucosa': 'glucosa', 'ácido úrico': 'acidoUrico', 'urea': 'urea', 'bun': 'bun',
  'creatinina': 'creatinina', 'tfge / egfr': 'tfg',
  'albúmina': 'albumina', 'ast / tgo': 'ast', 'alt / tgp': 'alt',
  'fosfatasa alcalina': 'fosfatasaAlcalina', 'bilirrubina total': 'bilirrubinaTotal',
  'pcr': 'pcr', 'ferritina': 'ferritina', 'vitamina d 25-oh': 'vitaminaD',
  '25-oh vitamina d': 'vitaminaD',
  'colesterol total': 'colesterolTotal', 'hdl': 'hdl', 'ldl': 'ldl',
  'triglicéridos': 'trigliceridos', 'hba1c': 'hba1c', 'tsh': 'tsh',
}

/**
 * CUANDO EL REPOSITORIO YA TENÍA UNA CLAVE PARA ESE ANALITO — REG-453.
 *
 * `creatinina_orina` nació en E1-02 como concepto del vocabulario, SIN analito
 * detrás: existía sólo para que aquella aceptación no se pudiera «cumplir»
 * colapsando orina y suero en la misma serie. Ahora el catálogo del dueño trae
 * la creatinina urinaria de verdad, con sus límites de captura.
 *
 * Se reutiliza SU clave en vez de crear `creatininaUrinaria`. Dos claves para el
 * mismo analito son dos fuentes de verdad, y gana la que llevaba meses escrita:
 * tiene sinónimos declarados, procedencia citada y una pregunta abierta al
 * médico (E1-02/Q4).
 */
const CLAVE_QUE_YA_EXISTIA: Readonly<Record<string, string>> = {
  'creatinina urinaria': 'creatinina_orina',
}

/**
 * `Colesterol total` → `colesterolTotal`. Determinista, sin inventar nada.
 *
 * Cuando el documento da dos formas —«LDH / DHL»— la clave sale de la PRIMERA.
 * `ldhDhl` no es un término que nadie escriba, y una clave que no se puede
 * escribir no resuelve por su propio nombre.
 */
function claveDesdeNombre(nombre: string): string {
  const primera = nombre.includes(' / ') ? nombre.split('/')[0].trim() : nombre
  const palabras = primera.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/)
  return palabras
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join('')
}

/**
 * El patrón de un analito generado: su nombre del documento, entero.
 *
 * Cuando el documento separa sinónimos con « / » —«AST / TGO», «LDH / DHL»,
 * «Eritroblastos / NRBC»— se aceptan las dos formas. Ese « / » es del propio
 * documento: no es una abreviatura que me haya inventado yo.
 */
function patronDesdeNombre(nombre: string): RegExp {
  const partes = nombre.split('/').map(p => p.trim()).filter(Boolean)
  const formas = partes.length > 1 && nombre.includes(' / ') ? partes : [nombre]
  /**
   * DENTRO DE UNA MUESTRA, EL NOMBRE PELADO YA NO ES AMBIGUO.
   *
   * «LCR glucosa» y «Glucosa en líquido» sólo se buscan entre analitos de LCR y
   * de líquido, porque el filtro de espécimen ya corrió. Así que ahí «glucosa» a
   * secas identifica sin riesgo, y la hoja que escribe «Creatinina en orina» —que
   * antes no casaba con nada— casa.
   *
   * Esto NO se hace en suero: allí el nombre pelado es el caso general y las
   * exclusiones ya existen.
   */
  const alternativas = formas
    .map(f => f.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())
    .map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  return new RegExp(`\\b(${alternativas})\\b`, 'i')
}

/**
 * El nombre sin las palabras de la muestra: «Creatinina urinaria» → «creatinina».
 * `null` en suero, donde el nombre pelado ES el caso general y ya hay patrón.
 */
function patronPelado(nombre: string, especimen: Especimen): { patronEnSuMuestra: RegExp } | null {
  if (especimen === 'suero') return null
  const pelado = nombre
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\b(lcr|urinari[oa]s?|en\s+(el\s+)?liquido|de\s+orina|en\s+orina)\b/g, ' ')
    .replace(/\s+/g, ' ').trim()
  if (pelado.length <= 2) return null
  return { patronEnSuMuestra: new RegExp(`\\b(${pelado.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'i') }
}

const normalizarNombre = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

/**
 * Las llaves de `YA_ESTA_A_MANO` se escriben con acento porque así se leen, y se
 * comparan sin él porque así se comparan los nombres. Escribirlas ya
 * normalizadas era la otra opción y la descarté: una lista ilegible se revisa
 * peor, y esta lista hay que poder revisarla de un vistazo.
 *
 * (Este mapa nació MAL: comparaba «albúmina» contra «albumina» y no casaba
 * ninguna de las tres con acento, así que se generaban duplicados de albúmina,
 * triglicéridos y ácido úrico. Lo cazó el conteo de claves repetidas.)
 */
const YA_ESTA_NORMALIZADO: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(YA_ESTA_A_MANO).map(([k, v]) => [normalizarNombre(k), v]),
)

function analitosDelCatalogo(): Analito[] {
  const porClave = new Map<string, Analito>()
  const out: Analito[] = []
  for (const fila of CATALOGO.filas as { seccion: number; nombre: string; unidad: string; min: number; max: number }[]) {
    if (YA_ESTA_NORMALIZADO[normalizarNombre(fila.nombre)]) continue
    const clave = CLAVE_QUE_YA_EXISTIA[normalizarNombre(fila.nombre)] ?? claveDesdeNombre(fila.nombre)
    /**
     * El documento repite analitos entre secciones —la LDH está en hígado
     * (§4, «LDH / DHL») y en hemólisis (§7, «LDH»)— y las dos formas dan la
     * misma clave. Se queda la primera, pero SÓLO si coinciden: si un día las
     * cifras divergen, este módulo revienta al cargarse en vez de elegir una.
     * Un catálogo que se contradice no se resuelve por descarte.
     */
    const previa = porClave.get(clave)
    if (previa) {
      if (previa.unidad !== fila.unidad || previa.min !== fila.min || previa.max !== fila.max) {
        throw new Error(
          `El catálogo de D-032 se contradice en «${clave}»: ${previa.min}–${previa.max} ${previa.unidad} `
          + `frente a ${fila.min}–${fila.max} ${fila.unidad}. Se le pregunta al médico dueño; no se elige una.`,
        )
      }
      continue
    }
    const nuevo: Analito = {
      clave,
      etiqueta: fila.nombre,
      patron: patronDesdeNombre(fila.nombre),
      ...(patronPelado(fila.nombre, ESPECIMEN_POR_SECCION[fila.seccion] ?? 'suero') ?? {}),
      unidad: fila.unidad,
      min: fila.min,
      max: fila.max,
      grupo: GRUPO_POR_SECCION[fila.seccion] ?? 'otro',
      especimen: ESPECIMEN_POR_SECCION[fila.seccion] ?? 'suero',
    }
    porClave.set(clave, nuevo)
    out.push(nuevo)
  }
  /**
   * Del nombre más largo al más corto: «PCR ultrasensible» tiene que ganarle a
   * «PCR», y «Bilirrubina directa» a cualquier cosa más corta que la contenga.
   */
  return out.sort((a, b) => b.etiqueta.length - a.etiqueta.length)
}

/**
 * TODOS los analitos: los treinta y dos escritos a mano y los del catálogo.
 *
 * Los generados van PRIMERO porque sus patrones son el nombre completo del
 * documento y por tanto los más específicos; los manuales, con sus abreviaturas
 * («Glu», «TGO»), van detrás para recoger lo que aquéllos no nombran.
 */
const DEL_CATALOGO = analitosDelCatalogo()

export const ANALITOS: Analito[] = [...DEL_CATALOGO, ...ANALITOS_A_MANO]

/**
 * Las claves que salen del documento del dueño y no de una decisión de
 * vocabulario. El catálogo de conceptos las trata distinto: su sinónimo ES su
 * nombre en el documento, y no hace falta declararlo a mano.
 */
export const CLAVES_DEL_CATALOGO: ReadonlySet<string> = new Set(DEL_CATALOGO.map(a => a.clave))

/**
 * LOS QUE SE BUSCAN EN TEXTO LIBRE — y son los treinta y dos de siempre.
 *
 * Tres sitios recorren analitos buscando cifras dentro de PROSA: el pase de UCI
 * (`uci/labs-nota.ts`), la extracción desde el dictado
 * (`expediente/labs-desde-texto.ts`) y la discusión de UCI. Ése es un problema
 * distinto del de validar una hoja de laboratorio, y falla distinto: en una hoja,
 * un renglón que dice «Ferritina» es una ferritina; en prosa, «ratio», «bandas»,
 * «pH» o «s» aparecen sin ser un resultado.
 *
 * Los treinta y dos escritos a mano se eligieron y se afinaron para eso. Los 187
 * del catálogo del dueño entraron para validar hojas, y meterlos de golpe en la
 * lectura de prosa sería un cambio de comportamiento que nadie pidió y que nadie
 * midió — con 219 nombres, la prosa clínica empieza a casar sola.
 *
 * No son dos catálogos: es el mismo, con un subconjunto declarado para un uso
 * cuyo modo de fallo es otro. Ampliarlo es una decisión, y se mide antes.
 */
export const ANALITOS_EN_TEXTO: readonly Analito[] = ANALITOS_A_MANO

/**
 * ── DE QUÉ MUESTRA HABLA ESTE RENGLÓN — el defecto que esto vino a cerrar ────
 *
 * Medido el 2-sep-2026, ANTES de tocar nada, sobre el catálogo que había:
 *
 *     «Glucosa urinaria»    → serie de glucosa SÉRICA
 *     «LCR glucosa»         → serie de glucosa SÉRICA
 *     «Sodio urinario»      → serie de sodio SÉRICO
 *     «LCR leucocitos»      → serie de leucocitos en SANGRE
 *     «Creatinina urinaria» → serie de creatinina SÉRICA
 *
 * El último pese a que su patrón ya excluía «orina»: la exclusión no cubría
 * «urinaria». Una defensa escrita a mano, analito por analito, y con un hueco.
 *
 * Un sodio urinario de 20 dibujado como sodio sérico se lee como una
 * hiponatremia mortal. Una glucosuria de 500, como una urgencia diabética.
 *
 * Por eso la muestra se decide UNA vez, sobre el nombre, y no con una exclusión
 * por analito. Si el renglón nombra la orina, sólo puede casar con analitos de
 * orina — y si no hay ninguno, no casa con nada, que es lo correcto: mejor sin
 * reconocer que en la serie equivocada.
 */
const MARCAS_DE_ESPECIMEN: readonly { readonly especimen: Especimen; readonly patron: RegExp }[] = Object.freeze([
  { especimen: 'orina', patron: /\b(urinari[oa]s?|orina|albuminuria|proteinuria|uresis|egos?)\b/i },
  { especimen: 'lcr', patron: /\b(lcr|cefalorraquideo|raquideo)\b/i },
  { especimen: 'liquido', patron: /\ben\s+(el\s+)?liquido\b|\bliquido\s+(pleural|ascitico|peritoneal|sinovial|pericardico)\b/i },
])

/**
 * LO QUE ESTA REGLA NO RESUELVE, y hay que decirlo.
 *
 * La muestra se decide **por renglón**. Una hoja que pone «Química urinaria» en
 * la cabecera y luego escribe «Glucosa» a secas sigue cayendo en la serie de
 * suero: el renglón no nombra la orina y esta función sólo ve el renglón.
 *
 * Cerrarlo pide que el espécimen venga como CAMPO desde la lectura de la hoja,
 * que es el §27.3 del catálogo del dueño y es otra unidad de trabajo. Mientras
 * tanto queda dicho: se vigila el renglón que se nombra, no la sección que lo
 * contiene.
 */
export const LO_QUE_LA_MUESTRA_NO_RESUELVE =
  'La muestra se decide por RENGLÓN. Una hoja con «Química urinaria» en la '
  + 'cabecera y «Glucosa» a secas en el renglón sigue cayendo en la serie de '
  + 'suero. Necesita el espécimen como campo desde la lectura de la hoja (§27.3).'

/** De qué muestra habla el nombre de un estudio. Sin marca, es de suero/sangre. */
export function especimenDe(nombre: string): Especimen {
  const n = normalizarNombre(nombre)
  return MARCAS_DE_ESPECIMEN.find(m => m.patron.test(n))?.especimen ?? 'suero'
}

/** Normaliza texto: minúsculas, sin acentos. */
function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

/**
 * A qué analito canónico corresponde un nombre de estudio. `null` si no se
 * reconoce (mejor no graficar que graficar en la serie equivocada).
 *
 * ── POR QUÉ ADMITE LA UNIDAD (REG-450, regla §25.2 de D-032) ────────────────
 *
 * Hay nombres que NO identifican un analito por sí solos. «Neutrófilos» puede
 * ser 75 (%) o 7,5 (×10³/µL), y son dos series distintas: meter el porcentaje
 * en la serie del absoluto imprime un 75 donde va un 7,5. Eso es un valor mal
 * leído, y ése es el eje que el médico puso en CERO.
 *
 * Cuando el analito declara `exigeUnidad`, la unidad decide. Si no viene
 * unidad, **no se adivina**: devuelve `null` y la fila se conserva como texto.
 */
export function analitoDe(nombre: string, unidad?: string): Analito | null {
  const n = norm(nombre)
  if (!n) return null
  const u = norm(unidad ?? '')
  /** La muestra primero: un renglón de orina no puede caer en una serie de suero. */
  const muestra = especimenDe(nombre)
  return ANALITOS.find(a => {
    if (a.especimen !== muestra) return false
    /** El nombre pelado sólo se acepta DENTRO de la muestra, nunca fuera. */
    if (!a.patron.test(n) && !(a.especimen !== 'suero' && a.patronEnSuMuestra?.test(n))) return false
    if (!a.exigeUnidad) return true
    return u !== '' && a.exigeUnidad.test(u)
  }) ?? null
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
