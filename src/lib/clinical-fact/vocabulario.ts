/**
 * VOCABULARIO DE CONCEPTOS CLÍNICOS — Nexus OS E1-02.
 *
 * PORQUÉ EXISTE: E1-01 dejó `ConceptoRef.clave` OPACA a propósito. Este módulo la
 * canoniza: dado un término libre YA EXTRAÍDO («Cr», «creatinina sérica»), dice a
 * qué concepto estable pertenece, o dice honestamente que no lo sabe.
 *
 * ALCANCE DELIBERADO — lo que este módulo NO hace:
 *  - NO extrae conceptos de prosa. Eso es del NER (`lib/expediente/medical-ner.ts`)
 *    y del proyector (E1-03). Mezclar extracción con canonización es exactamente
 *    lo que produce `analitoDe('vitamina K') → potasio` (hallazgo E1-02-H1).
 *  - NO modifica `analitos.ts` ni `analitoDe()`: alimentan gráficas longitudinales
 *    en producción. Regla 5 de la carta operativa.
 *  - NO inventa códigos LOINC de laboratorio (NEEDS_CLINICAL_REVIEW Q1).
 *  - NO decide qué sentido tiene «PCR» (NEEDS_CLINICAL_REVIEW Q2).
 *  - NO calcula, no decide, no tiene umbrales → NO es un motor clínico, y por eso
 *    vive en `lib/clinical-fact/` y no en `lib/clinical/` (territorio del Clinical
 *    Engine Registry y su trinquete de ADRs, E0-03). Misma razón que E1-01 (D1).
 *
 * ANTI-DERIVA: las claves, etiquetas y unidades de laboratorio se IMPORTAN de
 * `analitos.ts` (la fuente de verdad en producción); no se copian a mano. Los
 * LOINC de signos vitales se copian de `lib/fhir/recursos.ts` con su cita.
 *
 * Puro y determinista, sin zod y sin I/O.
 */

import type { ConceptoRef } from '@/types/clinical-fact'
import { ANALITOS, CLAVES_DEL_CATALOGO, type Analito } from '@/lib/expediente/laboratorio/analitos'

/**
 * 1.1.0 (2026-07-30) — cierre de la verificación adversarial de E1-02:
 *  - la procedencia de cada sinónimo pasa de comentario a DATO auditable
 *    (`PROCEDENCIA_SINONIMO` + invariante T-10, que la vuelve falsable por máquina);
 *  - se RETIRAN 3 sinónimos sin fuente en el repo (`dextrostix`, `glucosa capilar`,
 *    `bmi`) a `SINONIMOS_PROPUESTOS_PENDIENTES` — NEEDS_CLINICAL_REVIEW Q6/Q7;
 *  - `opts.dominio` deja de ser pista silenciosa y pasa a FILTRO ESTRICTO.
 * El contenido del catálogo cambió, así que la versión cambia con él.
 */
export const VOCABULARIO_VERSION = '1.1.0'

// ---------------------------------------------------------------------------
// 1. Tipos
// ---------------------------------------------------------------------------

/** Eje del concepto. Determina de qué catálogo salen sus códigos. */
export type DominioConcepto = 'laboratorio' | 'signo-vital' | 'diagnostico'

/**
 * Espécimen. Sólo se declara donde el repo YA lo distingue: `analitos.ts:44`
 * excluye a propósito «creatinina en orina» de la serie de creatinina sérica.
 */
export type Especimen = 'suero' | 'orina' | 'sangre-total'

export interface CodigoEstandar {
  /** Subconjunto de `ConceptoRef['codigo']['sistema']`: sólo lo que la licencia permite. */
  readonly sistema: 'LOINC' | 'CIE-10'
  readonly codigo: string
  /** OBLIGATORIA. De dónde salió el código (archivo:símbolo o publicación). */
  readonly fuente: string
}

export interface ConceptoCanonico {
  /** Clave estable. Para `laboratorio` es LA MISMA de ANALITOS (no se renombra). */
  readonly clave: string
  readonly etiqueta: string
  readonly dominio: DominioConcepto
  readonly especimen?: Especimen
  /**
   * Sinónimos como TÉRMINO COMPLETO ya normalizado (minúsculas, sin acentos).
   * NO son regex y NO casan como subcadena: ésa es la corrección del hallazgo.
   */
  readonly sinonimos: readonly string[]
  /** Vacío ⇒ NO hay código. Nunca se inventa uno para «completar» el catálogo. */
  readonly codigos: readonly CodigoEstandar[]
  /** Copiada de ANALITOS cuando aplica. NO se redecide aquí. */
  readonly unidadConvencional?: string
}

/**
 * Resultado de resolver un término. `ambiguo` es de PRIMERA CLASE — mismo
 * cortafuegos que `lib/uci/extraccion.ts`: ante dos lecturas no se elige una.
 */
export type ResolucionConcepto =
  | { readonly estado: 'resuelto'; readonly concepto: ConceptoCanonico }
  | {
      readonly estado: 'ambiguo'
      readonly termino: string
      /** Claves candidatas (pueden incluir sentidos que aún no son concepto). */
      readonly candidatos: readonly string[]
      readonly nota: string
    }
  | { readonly estado: 'desconocido'; readonly termino: string }

// ---------------------------------------------------------------------------
// 2. Normalización — la MISMA del repo, no una cuarta variante
// ---------------------------------------------------------------------------

/**
 * minúsculas + NFD + sin diacríticos + espacios colapsados.
 * Idéntica a `analitos.ts:69` y `uci/extraccion.ts:32` (ésta además colapsa
 * espacios internos, como la de UCI).
 */
export function normalizarTermino(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// 3. NEEDS_CLINICAL_REVIEW — huecos explícitos, NO valores inventados
// ---------------------------------------------------------------------------

/**
 * NEEDS_CLINICAL_REVIEW · Q2 — «PCR».
 *
 * Un término reservado tiene ≥2 sentidos clínicos reales y el repo NO tiene una
 * decisión registrada de cuál gana. Mientras esté aquí, `resolverConcepto`
 * devuelve `ambiguo` AUNQUE el catálogo tenga un solo candidato: es preferible
 * pedir confirmación a elegir por el médico.
 *
 * Medido hoy en producción: `analitoDe('PCR para influenza')` → `pcr` (proteína
 * C reactiva). Este módulo no repara `analitoDe` (regla 5), pero no hereda el
 * problema.
 *
 * DECISIÓN PENDIENTE DEL MÉDICO DUEÑO: (a) «PCR» a secas = proteína C reactiva y
 * el sentido molecular siempre se escribe completo; (b) siempre ambiguo, la UI
 * pregunta; (c) desambiguar por dominio. Hasta entonces: (b).
 */
export const TERMINOS_RESERVADOS: Readonly<Record<string, { readonly candidatos: readonly string[]; readonly nota: string }>> = {
  pcr: {
    candidatos: ['pcr', 'pcr_molecular'],
    nota: 'NEEDS_CLINICAL_REVIEW (E1-02/Q2): «PCR» puede ser proteína C reactiva o reacción en cadena de la polimerasa. Sin decisión del médico dueño no se elige: confirmar con el usuario.',
  },
  /**
   * REG-553 · §25.2 del catálogo de plausibilidad del dueño (D-041).
   *
   * Éstos no esperan una decisión: son ambiguos POR NATURALEZA, y lo seguirán
   * siendo. La hoja imprime «Neutrófilos» y sólo la unidad dice si es el
   * porcentaje o el absoluto. Colocar 75 en la serie del absoluto es un valor
   * mal leído —el eje que el médico puso en CERO (D-040)— y no se ve, porque
   * tiene la forma correcta.
   */
  neutrofilos: {
    candidatos: ['neutrofilosPct', 'neutrofilosAbs'],
    nota: '«Neutrófilos» no identifica un analito sin su unidad: 75 (%) y 7,5 (×10³/µL) son resultados distintos (§25.2 de D-041). La unidad decide; sin ella se pregunta.',
  },
  neutros: {
    candidatos: ['neutrofilosPct', 'neutrofilosAbs'],
    nota: 'Igual que «neutrófilos»: la abreviatura tampoco dice si es porcentaje o absoluto.',
  },
  linfocitos: {
    candidatos: ['linfocitosPct', 'linfocitosAbs'],
    nota: '«Linfocitos» no identifica un analito sin su unidad: 28 (%) y 2,8 (×10³/µL) son resultados distintos (§25.2 de D-041). La unidad decide; sin ella se pregunta.',
  },
  linfos: {
    candidatos: ['linfocitosPct', 'linfocitosAbs'],
    nota: 'Igual que «linfocitos»: la abreviatura tampoco dice si es porcentaje o absoluto.',
  },
}

/**
 * NEEDS_CLINICAL_REVIEW · Q1 — LOINC de laboratorio.
 *
 * Trinquete: número de conceptos de dominio `laboratorio` SIN ningún código
 * estándar. Hoy son TODOS (218: los 32 escritos a mano más los 186 del catálogo
 * del dueño. Eran 25, luego 33 con los ocho de REG-553, y 218 desde que REG-556
 * cargó el catálogo entero), porque
 * elegir un LOINC no es mecánico —cambia según magnitud (masa vs. sustancia) y
 * espécimen— y un código equivocado viaja al exterior dentro de un `Observation`
 * de FHIR, donde otro sistema lo lee como verdad.
 *
 * Este número sólo puede BAJAR, y sólo cuando el médico dueño valide la tabla
 * concepto→LOINC. El test T-5 lo fija: nadie «completa» el catálogo inventando.
 */
/**
 * SUBE CUANDO ENTRA UN ANALITO, Y ESO NO ES UNA EXCEPCIÓN AL TRINQUETE.
 *
 * Lo que este número vigila es que nadie INVENTE un LOINC, no que el catálogo no
 * crezca. Un analito nuevo sin código es exactamente lo correcto: el §27.3 y el
 * §35 del catálogo del dueño piden LOINC, y elegirlo no es mecánico —cambia con
 * la magnitud y el espécimen— así que lo valida él, no yo.
 *
 * Baja SÓLO cuando el médico dueño valide una fila concepto→LOINC.
 */
export const LAB_SIN_CODIGO_CONGELADO = 218

// ---------------------------------------------------------------------------
// 3.b PROCEDENCIA DE LOS SINÓNIMOS — la afirmación «aquí no se inventó nada»
//     deja de ser un comentario y pasa a ser un dato que una máquina refuta.
//
//     PORQUÉ EXISTE: la verificación adversarial de esta unidad (hallazgo V-1)
//     encontró DOS abreviaturas inventadas ('hb', 'bt') mientras el archivo
//     afirmaba por escrito que sólo 'cr' era nueva. La afirmación no era
//     falsable: ningún test comparaba los sinónimos contra su fuente. Ahora sí
//     (invariante T-10): para CADA sinónimo del catálogo, o lo confirma un motor
//     de producción (`analitoDe` / `extraerSignosVitales`), o es la propia clave
//     o etiqueta del concepto, o es un `display` LOINC de `lib/fhir/recursos.ts`,
//     o está citado aquí con fuente no vacía. Si no, el test se pone ROJO.
// ---------------------------------------------------------------------------

/** Por qué existe un sinónimo que ningún motor de producción confirma por sí solo. */
export interface ProcedenciaSinonimo {
  /** Clave del concepto al que pertenece. Evita citas huérfanas (lo fija T-10). */
  readonly clave: string
  /** OBLIGATORIA y no vacía: archivo:línea, o «backlog E1-02 · aceptación literal». */
  readonly fuente: string
  /** Si la fuente NO es un literal del repo, qué decisión falta. */
  readonly needsClinicalReview?: string
}

/**
 * Sinónimo YA NORMALIZADO → su procedencia. Exportada para que T-10 la audite.
 *
 * Las 9 entradas se midieron una por una contra los motores de producción
 * (`analitoDe`, `extraerSignosVitales`) y contra `grep` sobre `src/`. Ninguna se
 * añade sin fuente: si no hay fuente, el término NO entra al catálogo — va a
 * `SINONIMOS_PROPUESTOS_PENDIENTES` y espera al médico dueño.
 */
export const PROCEDENCIA_SINONIMO: Readonly<Record<string, ProcedenciaSinonimo>> = {
  // El único alias sin fuente en el repo que SÍ entra: lo ordena la aceptación.
  cr: {
    clave: 'creatinina',
    fuente: 'backlog E1-02 · aceptación literal («\'creatinina\', \'Cr\' y \'creatinina sérica\' resuelven al mismo concepto»)',
  },
  /**
   * HALLAZGO E1-02-H2 (medido, NO reparado — regla 5 de la carta operativa):
   * el literal existe en el patrón de `tfg` (analitos.ts:47) pero es CÓDIGO
   * MUERTO: `creatinina` va antes en el array (analitos.ts:44) y `\bcreatinina\b`
   * casa dentro de la frase, así que en producción una depuración de creatinina
   * entra a la serie de creatinina SÉRICA. Aquí se declara la lectura correcta y
   * la divergencia queda explícita; `analitoDe` no se toca.
   */
  'depuracion de creatinina': {
    clave: 'tfg',
    fuente: 'src/lib/expediente/laboratorio/analitos.ts:47 (alternativa literal del patrón de `tfg`)',
    needsClinicalReview: 'E1-02/Q5 — hallazgo E1-02-H2: hoy producción la manda a `creatinina`, no a `tfg`.',
  },
  'creatinina en orina': {
    clave: 'creatinina_orina',
    fuente: 'src/lib/expediente/laboratorio/analitos.ts:44 (exclusión explícita `(?!\\s*(en\\s*)?orina)`)',
    needsClinicalReview: 'E1-02/Q4 — confirmar que «creatinina» a secas es la sérica.',
  },
  'creatinina orina': {
    clave: 'creatinina_orina',
    fuente: 'src/lib/expediente/laboratorio/analitos.ts:44 (misma exclusión, sin la preposición)',
    needsClinicalReview: 'E1-02/Q4',
  },
  /**
   * DIVERGENCIA DELIBERADA Y DECLARADA: la exclusión de analitos.ts:44 sólo mira
   * la palabra «orina», así que `analitoDe('creatinina urinaria')` devuelve
   * `creatinina` (serie sérica). Misma familia que E1-02-H1. No se repara aquí.
   */
  'creatinina urinaria': {
    clave: 'creatinina_orina',
    fuente: 'src/lib/expediente/laboratorio/analitos.ts:44 (exclusión por espécimen; la palabra «urinaria» NO la cubre)',
    needsClinicalReview: 'E1-02/Q4 y Q5 — hoy producción la manda a `creatinina`.',
  },
  // Composición de dos `display` de producción, no un literal: por eso se cita.
  'presion arterial sistolica': {
    clave: 'ta_sistolica',
    fuente: 'composición de src/lib/fhir/recursos.ts:113 («Presión arterial») + :116 («Sistólica»)',
  },
  'presion arterial diastolica': {
    clave: 'ta_diastolica',
    fuente: 'composición de src/lib/fhir/recursos.ts:113 («Presión arterial») + :117 («Diastólica»)',
  },
  // Fuente DÉBIL declarada como tal: existen como claves de campo del formulario
  // de UCI, no como término que el médico dicte. Por eso van a Q7.
  pas: {
    clave: 'ta_sistolica',
    fuente: 'clave de campo del formulario de UCI (src/app/(dashboard)/uci/page.tsx, src/app/demo/interactivo/page.tsx:423)',
    needsClinicalReview: 'E1-02/Q7 — ¿el Dr. usa PAS/PAD al DICTAR, o sólo son nombres de campo?',
  },
  pad: {
    clave: 'ta_diastolica',
    fuente: 'clave de campo del formulario de UCI (src/app/(dashboard)/uci/page.tsx, src/app/demo/interactivo/page.tsx:423)',
    needsClinicalReview: 'E1-02/Q7',
  },
}

/**
 * Trinquete de citas. Sólo puede BAJAR (cuando aparezca una fuente real que haga
 * innecesaria la cita) o cambiar por edición explícita del catálogo. Si SUBE sin
 * tocar esta constante, alguien añadió un sinónimo citado a mano sin declararlo.
 */
export const PROCEDENCIA_CONGELADA = 9

/**
 * Términos PROPUESTOS que NO entran al catálogo hasta que el médico dueño los
 * apruebe. NO se indexan: `resolverConcepto` los devuelve `desconocido` (T-13).
 * Se conservan aquí para no perder la propuesta ni volver a inventarla mañana.
 *
 * Es el mismo criterio con el que se borraron 'hb' y 'bt': si no hay fuente en el
 * repo, el término no entra. Retirar contenido sin fuente NO es una decisión
 * clínica; DARLE sentido sí, y por eso cada uno viaja con su pregunta.
 */
export const SINONIMOS_PROPUESTOS_PENDIENTES: readonly {
  readonly termino: string
  readonly claveSugerida: string
  readonly pregunta: 'Q6' | 'Q7'
  readonly porQueNoEntra: string
}[] = [
  {
    termino: 'glucosa capilar',
    claveSugerida: 'glucometria',
    pregunta: 'Q6',
    porQueNoEntra: 'Sin fuente: `grep -rniE "glucosa capilar" src` = 0 resultados fuera de este archivo. Que la capilar sea la MISMA serie temporal que la de laboratorio (o no) es una decisión de significado clínico.',
  },
  {
    termino: 'dextrostix',
    claveSugerida: 'glucometria',
    pregunta: 'Q6',
    porQueNoEntra: 'Sin fuente: `grep -rniE "\\bdextrostix\\b" src` = 0 resultados fuera de este archivo. Además es un nombre comercial.',
  },
  {
    termino: 'bmi',
    claveSugerida: 'imc',
    pregunta: 'Q7',
    porQueNoEntra: 'Fuente DÉBIL: su única aparición en el repo está DENTRO de una etiqueta de texto (src/lib/expediente/preop.ts:201, «IMC > 35 kg/m² (B - BMI)»), no como término de entrada.',
  },
]

/**
 * Sentidos citados en `TERMINOS_RESERVADOS[].candidatos` que TODAVÍA no son un
 * concepto del catálogo. Cierra el hallazgo V-4: el consumidor recibe una clave
 * candidata que `conceptoPorClave` no resuelve, y eso es deliberado — no se
 * fabrica el concepto antes de que el médico dueño decida el sentido.
 */
export const SENTIDOS_NO_CATALOGADOS: readonly { readonly clave: string; readonly porQue: string }[] = [
  {
    clave: 'pcr_molecular',
    porQue: 'NEEDS_CLINICAL_REVIEW E1-02/Q2: el sentido molecular de «PCR» se cita como candidato para que la UI pueda ofrecerlo, pero NO se crea como concepto (no tiene unidad, ni analito, ni código validado) hasta que el médico dueño decida la política de desambiguación.',
  },
]

// ---------------------------------------------------------------------------
// 4. Sinónimos de laboratorio — derivados de los literales YA presentes en los
//    regex de analitos.ts. No se inventa ninguno, SALVO 'cr' (lo ordena la
//    aceptación del backlog de E1-02).
// ---------------------------------------------------------------------------

/**
 * clave de ANALITOS → sinónimos como TÉRMINO COMPLETO.
 *
 * Regla de derivación (mecánica, auditable): cada alternativa literal del regex
 * de `analitos.ts` se convierte en un sinónimo exacto. Las formas con acento se
 * escriben ya normalizadas. Las variantes de espécimen/adjetivo que el repo ya
 * trataba como el MISMO analito («creatinina sérica») se declaran explícitas,
 * porque con igualdad exacta ya no las cubre ningún `\b`.
 *
 * NEEDS_CLINICAL_REVIEW · Q3: las abreviaturas de 1-3 letras que aquí aparecen
 * (na, k, cl, fa, alp, glu, a1c, bun, hto, hct, tsh) son EXACTAMENTE las que ya
 * están en los regex de producción. Ni una más. Si el médico dueño quiere quitar
 * alguna o añadir las suyas (BH, QS, ES, TP, TTP), es una edición de esta tabla.
 */
const SINONIMOS_LAB: Readonly<Record<string, readonly string[]>> = {
  hba1c: ['hba1c', 'hemoglobina glucosilada', 'hemoglobina glicada', 'a1c'],
  glucosa: ['glucosa', 'glucemia', 'glicemia', 'glu', 'glucosa serica', 'glucosa en ayuno'],
  // 'cr' es el ÚNICO sinónimo nuevo del catálogo: lo ordena la aceptación de E1-02.
  creatinina: ['creatinina', 'cr', 'creatinina serica', 'creatinina en suero', 'creatinina plasmatica'],
  urea: ['urea', 'urea serica'],
  bun: ['bun', 'nitrogeno ureico', 'nitrogeno ureico en sangre'],
  tfg: ['tfg', 'egfr', 'filtrado glomerular', 'tasa de filtrado glomerular', 'depuracion de creatinina'],
  ast: ['ast', 'tgo', 'aspartato', 'aspartato aminotransferasa'],
  alt: ['alt', 'tgp', 'alanino', 'alanino aminotransferasa'],
  fosfatasaAlcalina: ['fosfatasa alcalina', 'fa', 'alp'],
  // 'BT' NO se declara: no está en el `patron` de ANALITOS (analitos.ts:51) ni en
  // ninguna otra parte de src/lib. Se retiró en la reconciliación del 2026-07-29
  // (VERIFICACION.json de E1-02, hallazgo V-1). Añadirla es decisión del médico dueño.
  bilirrubinaTotal: ['bilirrubina total'],
  albumina: ['albumina', 'albumina serica'],
  colesterolTotal: ['colesterol total'],
  hdl: ['hdl', 'colesterol hdl', 'c-hdl'],
  ldl: ['ldl', 'colesterol ldl', 'c-ldl'],
  trigliceridos: ['trigliceridos', 'trigliseridos'],
  // 'Hb' NO se declara: no está en el `patron` de ANALITOS (analitos.ts:57). Mismo
  // motivo y misma fecha que 'BT'. NEEDS_CLINICAL_REVIEW si el Dr. la quiere.
  hemoglobina: ['hemoglobina'],
  hematocrito: ['hematocrito', 'hto', 'hct'],
  leucocitos: ['leucocitos', 'leucos'],
  plaquetas: ['plaquetas', 'plaqueta'],
  sodio: ['sodio', 'na', 'sodio serico'],
  potasio: ['potasio', 'k', 'potasio serico'],
  cloro: ['cloro', 'cl', 'cloro serico'],
  tsh: ['tsh', 'tirotropina'],
  pcr: ['pcr', 'proteina c reactiva'],
  /**
   * REG-556: `creatinina_orina` ya viene de ANALITOS (D-041 §20), pero sus tres
   * términos los decidió una persona en E1-02, no el nombre del documento. Se
   * quedan declarados a mano, que es lo que este mapa significa.
   */
  creatinina_orina: ['creatinina en orina', 'creatinina urinaria', 'creatinina orina'],

  /**
   * ── LOS OCHO DE D-041 (REG-553) ──────────────────────────────────────────
   *
   * Derivados de los literales que están EN los `patron` de `analitos.ts`, como
   * todos los de arriba. Ni uno inventado; el invariante T-10 lo comprueba
   * llamando a `analitoDe` con la unidad del propio concepto.
   */
  acidoUrico: ['acido urico', 'ac urico', 'ac. urico', 'a urico', 'a. urico'],
  ferritina: ['ferritina'],
  vitaminaD: ['vitamina d', '25 oh d', '25-oh d', '25 hidroxi vitamina d', 'calcidiol'],
  vcm: ['vcm', 'mcv', 'volumen corpuscular medio'],
  /**
   * EL DIFERENCIAL LEUCOCITARIO COMPARTE TÉRMINOS A PROPÓSITO — §25.2 de D-041.
   *
   * «Neutrófilos» a secas NO identifica un analito: puede ser 75 (%) o 7,5
   * (×10³/µL), y son dos series distintas. Los términos desnudos se declaran en
   * LOS DOS conceptos para que el resolutor devuelva `ambiguo`, que es la
   * verdad, en vez de elegir uno. Es la misma postura que toma `analitoDe`
   * cuando no le dan unidad: no se adivina.
   *
   * Y por eso las claves son `…Pct` y `…Abs`, y NINGUNA es la palabra desnuda:
   * si una de las dos se llamara `neutrofilos`, esa palabra tendría dueño, y la
   * hoja que imprime «Neutrófilos» no dice cuál de los dos es. Los nombres salen
   * del propio §25.2 (`neutrophils_percent` / `neutrophils_absolute`).
   */
  neutrofilosPct: ['neutrofilos', 'neutros'],
  neutrofilosAbs: ['neutrofilos absolutos', 'neutrofilos', 'neutros', 'anc'],
  linfocitosPct: ['linfocitos', 'linfos'],
  linfocitosAbs: ['linfocitos absolutos', 'linfocitos', 'linfos', 'alc'],
}

/**
 * Claves cuyos sinónimos están DECLARADOS a mano arriba, frente a las que caerían
 * al respaldo `[clave]`. Se expone para que el test T-6 compruebe la DECLARACIÓN y
 * no la FORMA del valor: `hemoglobina` declara exactamente ['hemoglobina'] y eso es
 * correcto — su `patron` en analitos.ts no admite ninguna otra forma.
 */
/**
 * ── LOS 187 DEL CATÁLOGO DECLARAN SU SINÓNIMO SOLOS — REG-556 ───────────────
 *
 * Un analito que viene del documento del médico dueño tiene UN término y es su
 * propio nombre en ese documento: «Procalcitonina», «Anti-Xa», «NT-proBNP». No
 * hay abreviatura que decidir ni criterio que aportar, así que declararlos a
 * mano sería copiar 187 renglones del mismo sitio del que ya salen.
 *
 * Lo que el invariante T-6 protege sigue en pie: un analito escrito A MANO en
 * producción, sin sinónimos declarados, cae al respaldo `[clave]` y el test lo
 * delata. Esa exigencia NO se afloja — sólo deja de aplicarse a los que no
 * tienen nada que declarar. Y T-10 los comprueba igual, uno por uno, contra
 * `analitoDe`.
 */
export const CLAVES_SINONIMOS_DECLARADOS: readonly string[] = [
  ...Object.keys(SINONIMOS_LAB),
  ...CLAVES_DEL_CATALOGO,
]

/** El sinónimo de un analito del catálogo: su nombre en el documento del dueño. */
function sinonimosDelCatalogo(a: Analito): readonly string[] {
  const partes = a.etiqueta.includes(' / ')
    ? a.etiqueta.split('/').map(p => p.trim()).filter(Boolean)
    : [a.etiqueta]
  return [...new Set(partes.map(normalizarTermino))]
}

/**
 * Espécimen declarado, sólo donde el repo YA lo distinguía.
 *
 * NEEDS_CLINICAL_REVIEW · Q4: `creatinina` → suero. El repo lo asume hoy al
 * excluir «en orina» (`analitos.ts:44`) y la aceptación del backlog lo confirma
 * («creatinina sérica» = «creatinina»). Se deja EXPLÍCITO en vez de implícito,
 * pendiente de confirmación del médico dueño, porque fija la semántica de toda
 * serie temporal futura.
 */
const ESPECIMEN_LAB: Readonly<Record<string, Especimen>> = {
  creatinina: 'suero',
}

// ---------------------------------------------------------------------------
// 5. Signos vitales — los 10 LOINC COPIADOS de lib/fhir/recursos.ts
// ---------------------------------------------------------------------------

const FUENTE_LOINC_VITALES = 'src/lib/fhir/recursos.ts → LOINC_VITALES (ya en producción)'
const FUENTE_LOINC_TA = 'src/lib/fhir/recursos.ts → signosAFHIR, componentes de presión arterial (ya en producción)'

const loinc = (codigo: string, fuente: string): CodigoEstandar => ({ sistema: 'LOINC', codigo, fuente })

const CONCEPTOS_VITALES: readonly ConceptoCanonico[] = [
  { clave: 'fc', etiqueta: 'Frecuencia cardiaca', dominio: 'signo-vital', unidadConvencional: '/min', sinonimos: ['fc', 'frecuencia cardiaca', 'pulso'], codigos: [loinc('8867-4', FUENTE_LOINC_VITALES)] },
  { clave: 'fr', etiqueta: 'Frecuencia respiratoria', dominio: 'signo-vital', unidadConvencional: '/min', sinonimos: ['fr', 'frecuencia respiratoria'], codigos: [loinc('9279-1', FUENTE_LOINC_VITALES)] },
  { clave: 'temperatura', etiqueta: 'Temperatura corporal', dominio: 'signo-vital', unidadConvencional: 'Cel', sinonimos: ['temperatura', 'temperatura corporal', 'temp'], codigos: [loinc('8310-5', FUENTE_LOINC_VITALES)] },
  { clave: 'spo2', etiqueta: 'Saturación de oxígeno', dominio: 'signo-vital', unidadConvencional: '%', sinonimos: ['spo2', 'saturacion de oxigeno', 'saturacion'], codigos: [loinc('2708-6', FUENTE_LOINC_VITALES)] },
  { clave: 'peso', etiqueta: 'Peso corporal', dominio: 'signo-vital', unidadConvencional: 'kg', sinonimos: ['peso', 'peso corporal'], codigos: [loinc('29463-7', FUENTE_LOINC_VITALES)] },
  { clave: 'talla', etiqueta: 'Estatura', dominio: 'signo-vital', unidadConvencional: 'cm', sinonimos: ['talla', 'estatura'], codigos: [loinc('8302-2', FUENTE_LOINC_VITALES)] },
  // 'bmi' RETIRADO (Q7): su única aparición en el repo está dentro de una
  // etiqueta de texto (preop.ts:201), no como término de entrada.
  { clave: 'imc', etiqueta: 'Índice de masa corporal', dominio: 'signo-vital', unidadConvencional: 'kg/m2', sinonimos: ['imc', 'indice de masa corporal'], codigos: [loinc('39156-5', FUENTE_LOINC_VITALES)] },
  // 'dextrostix' y 'glucosa capilar' RETIRADOS (Q6): cero fuentes en `src` y la
  // separación capilar/laboratorio es una decisión de significado clínico.
  { clave: 'glucometria', etiqueta: 'Glucometría', dominio: 'signo-vital', unidadConvencional: 'mg/dL', sinonimos: ['glucometria'], codigos: [loinc('2339-0', FUENTE_LOINC_VITALES)] },
  // La TA se emite como DOS observaciones, no una: se conserva esa decisión.
  { clave: 'ta_sistolica', etiqueta: 'Presión arterial sistólica', dominio: 'signo-vital', unidadConvencional: 'mm[Hg]', sinonimos: ['ta sistolica', 'presion arterial sistolica', 'sistolica', 'pas'], codigos: [loinc('8480-6', FUENTE_LOINC_TA)] },
  { clave: 'ta_diastolica', etiqueta: 'Presión arterial diastólica', dominio: 'signo-vital', unidadConvencional: 'mm[Hg]', sinonimos: ['ta diastolica', 'presion arterial diastolica', 'diastolica', 'pad'], codigos: [loinc('8462-4', FUENTE_LOINC_TA)] },
]

/**
 * Los códigos LOINC de vitales, expuestos para el test de no-deriva (T-7).
 * Si `lib/fhir/recursos.ts` cambia un código y aquí no, el test lo delata.
 */
export const LOINC_VITALES_ESPERADOS: Readonly<Record<string, string>> = {
  fc: '8867-4', fr: '9279-1', temperatura: '8310-5', spo2: '2708-6',
  peso: '29463-7', talla: '8302-2', imc: '39156-5', glucometria: '2339-0',
  ta_sistolica: '8480-6', ta_diastolica: '8462-4',
}

// ---------------------------------------------------------------------------
// 6. El catálogo
// ---------------------------------------------------------------------------

const CONCEPTOS_LAB: readonly ConceptoCanonico[] = [
  ...ANALITOS.map((a): ConceptoCanonico => ({
    clave: a.clave,
    etiqueta: a.etiqueta,
    dominio: 'laboratorio',
    /**
     * REG-556: el espécimen lo trae YA el analito. `ESPECIMEN_LAB` sigue mandando
     * donde lo declaró una persona —es más específico que la regla general— y el
     * analito cubre el resto. Antes sólo existía el mapa, así que los 187 del
     * catálogo habrían entrado sin muestra declarada.
     */
    especimen: ESPECIMEN_LAB[a.clave] ?? a.especimen,
    // Si un analito nuevo aparece en producción sin sinónimos declarados aquí,
    // al menos su propia clave lo resuelve; el test T-6 obliga a declararlos.
    sinonimos: SINONIMOS_LAB[a.clave] ?? (CLAVES_DEL_CATALOGO.has(a.clave) ? sinonimosDelCatalogo(a) : [normalizarTermino(a.clave)]),
    codigos: [],                       // NEEDS_CLINICAL_REVIEW · Q1
    unidadConvencional: a.unidad,
  })),
  /**
   * `creatinina_orina` YA NO SE DECLARA AQUÍ — REG-556.
   *
   * Nació en E1-02 como concepto sin analito detrás: existía sólo para que
   * aquella aceptación no se pudiera «cumplir» colapsando orina y suero. Hoy el
   * catálogo del dueño (D-041 §20) trae la creatinina urinaria de verdad, con
   * sus límites de captura, y `analitos.ts` reutiliza ESTA clave para no crear
   * una segunda. Así que ya viene de arriba, como todos.
   *
   * Sus tres sinónimos siguen declarados en `SINONIMOS_LAB`: son términos que
   * decidió una persona, no el nombre del documento.
   */
]

/**
 * Catálogo canónico v1.0.0.
 *
 * Dominio `diagnostico`: 0 entradas propias A PROPÓSITO. `lib/cie10.ts` ya ES el
 * catálogo de diagnósticos (~1400 códigos con búsqueda); duplicarlo aquí sería
 * fabricar una segunda fuente de verdad que puede derivar.
 */
export const CONCEPTOS: readonly ConceptoCanonico[] = [...CONCEPTOS_LAB, ...CONCEPTOS_VITALES]

// ---------------------------------------------------------------------------
// 7. Índice y resolución
// ---------------------------------------------------------------------------

export interface Resolvedor {
  /** Resuelve un término libre YA EXTRAÍDO. Ver `resolverConcepto`. */
  readonly resolver: (termino: string, opts?: { readonly dominio?: DominioConcepto }) => ResolucionConcepto
  /** Busca por clave canónica exacta. */
  readonly porClave: (clave: string) => ConceptoCanonico | null
  /**
   * Claves que declaran ese término (por clave propia o por sinónimo).
   * `length >= 2` es exactamente la condición de ambigüedad: lo expone para que
   * el invariante de unicidad se pueda comprobar sobre TODO el catálogo.
   */
  readonly clavesQueDeclaran: (termino: string) => readonly string[]
}

/**
 * Construye un resolvedor sobre un catálogo cualquiera.
 *
 * Es una fábrica y no una función suelta a propósito: permite ejercitar la rama
 * de ambigüedad (≥2 candidatos) con un catálogo SINTÉTICO en los tests. Con el
 * catálogo real esa rama es inalcanzable —el invariante de unicidad la prohíbe—
 * y un test que no puede alcanzarla no prueba nada.
 */
export function crearResolvedor(
  conceptos: readonly ConceptoCanonico[],
  reservados: Readonly<Record<string, { readonly candidatos: readonly string[]; readonly nota: string }>> = TERMINOS_RESERVADOS,
): Resolvedor {
  const indice = new Map<string, string[]>()
  const add = (termino: string, clave: string) => {
    const t = normalizarTermino(termino)
    if (!t) return
    const ya = indice.get(t)
    if (ya) { if (!ya.includes(clave)) ya.push(clave) }
    else indice.set(t, [clave])
  }
  for (const c of conceptos) {
    add(c.clave, c.clave)
    for (const s of c.sinonimos) add(s, c.clave)
  }
  const porClave = new Map(conceptos.map(c => [c.clave, c]))

  const clavesQueDeclaran = (termino: string): readonly string[] =>
    indice.get(normalizarTermino(termino)) ?? []

  const resolver = (
    termino: string,
    opts?: { readonly dominio?: DominioConcepto },
  ): ResolucionConcepto => {
    const t = normalizarTermino(termino)
    if (!t) return { estado: 'desconocido', termino: t }

    const reservado = reservados[t]
    if (reservado) {
      return { estado: 'ambiguo', termino: t, candidatos: reservado.candidatos, nota: reservado.nota }
    }

    const claves = indice.get(t)
    if (!claves || claves.length === 0) return { estado: 'desconocido', termino: t }

    // `dominio` es FILTRO ESTRICTO, no desempate silencioso (cierra el hallazgo
    // V-3). Antes, con un solo candidato se devolvía el concepto SIN mirar el
    // dominio pedido: `resolverConcepto('creatinina', { dominio: 'signo-vital' })`
    // devolvía el de LABORATORIO. El proyector de E1-03 va a leerlo como filtro,
    // y hoy el cambio sale gratis porque el módulo no tiene ni un importador de
    // producción; con el primer consumidor ya no.
    const candidatos = claves
      .map(k => porClave.get(k))
      .filter((c): c is ConceptoCanonico => !!c)
      .filter(c => !opts?.dominio || c.dominio === opts.dominio)

    if (candidatos.length === 0) return { estado: 'desconocido', termino: t }
    if (candidatos.length === 1) return { estado: 'resuelto', concepto: candidatos[0] }
    return {
      estado: 'ambiguo',
      termino: t,
      candidatos: candidatos.map(c => c.clave),
      nota: `El término «${t}» pertenece a ${candidatos.length} conceptos${opts?.dominio ? ` del dominio «${opts.dominio}»` : ''}. Sin una pista que deje uno solo, no se elige.`,
    }
  }

  return { resolver, porClave: (k) => porClave.get(k) ?? null, clavesQueDeclaran }
}

const RESOLVEDOR = crearResolvedor(CONCEPTOS)

/** Busca por clave canónica exacta. */
export function conceptoPorClave(clave: string): ConceptoCanonico | null {
  return RESOLVEDOR.porClave(clave)
}

/** Claves que declaran ese término. `length >= 2` ⇒ ambigüedad. */
export function clavesQueDeclaran(termino: string): readonly string[] {
  return RESOLVEDOR.clavesQueDeclaran(termino)
}

/**
 * Resuelve un término libre YA EXTRAÍDO a un concepto canónico.
 *
 * REGLA (la parte falsable):
 *  1. Normalizar.
 *  2. Igualdad EXACTA contra clave y sinónimos. Sin `test()`, sin `includes()`,
 *     sin `\b`: el casado por subcadena es lo que hace que «vitamina K» resuelva
 *     a potasio en `analitoDe()` (hallazgo E1-02-H1).
 *  3. Si viene `opts.dominio`, se FILTRA por él SIEMPRE (no es un desempate).
 *  4. 0 candidatos → `desconocido`.  1 → `resuelto`.  ≥2 → `ambiguo`.
 *     NUNCA se elige el primero.
 *  5. Término en `TERMINOS_RESERVADOS` → `ambiguo` aunque haya un solo candidato.
 *
 * PRECIO DECLARADO: no extrae conceptos de prosa («PCR para influenza» →
 * `desconocido`). No es una regresión, es división de trabajo: extraer es del
 * NER y del proyector (E1-03); canonizar lo ya extraído es de aquí.
 *
 * `dominio` NO es una afirmación clínica: es el eje del catálogo. Pedir un
 * dominio que el término no tiene devuelve `desconocido`, nunca el otro concepto.
 */
export function resolverConcepto(
  termino: string,
  opts?: { readonly dominio?: DominioConcepto },
): ResolucionConcepto {
  return RESOLVEDOR.resolver(termino, opts)
}

// ---------------------------------------------------------------------------
// 8. Puente con E1-01
// ---------------------------------------------------------------------------

/**
 * Produce un `ConceptoRef` que `ConceptoRefSchema` (E1-01) acepta.
 *
 * Si el concepto no tiene códigos, la llave `codigo` se OMITE — no se emite
 * `codigo: undefined`, porque el esquema usa `z.strictObject` y la distinción
 * importa al viajar por JSON/Firestore.
 */
export function aConceptoRef(c: ConceptoCanonico): ConceptoRef {
  const primero = c.codigos[0]
  if (!primero) return { clave: c.clave, etiqueta: c.etiqueta }
  return {
    clave: c.clave,
    etiqueta: c.etiqueta,
    codigo: { sistema: primero.sistema, codigo: primero.codigo },
  }
}
