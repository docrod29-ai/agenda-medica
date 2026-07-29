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
import { ANALITOS } from '@/lib/expediente/laboratorio/analitos'

export const VOCABULARIO_VERSION = '1.0.0'

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
}

/**
 * NEEDS_CLINICAL_REVIEW · Q1 — LOINC de laboratorio.
 *
 * Trinquete: número de conceptos de dominio `laboratorio` SIN ningún código
 * estándar. Hoy son TODOS (25 = 24 de ANALITOS + creatinina_orina), porque
 * elegir un LOINC no es mecánico —cambia según magnitud (masa vs. sustancia) y
 * espécimen— y un código equivocado viaja al exterior dentro de un `Observation`
 * de FHIR, donde otro sistema lo lee como verdad.
 *
 * Este número sólo puede BAJAR, y sólo cuando el médico dueño valide la tabla
 * concepto→LOINC. El test T-5 lo fija: nadie «completa» el catálogo inventando.
 */
export const LAB_SIN_CODIGO_CONGELADO = 25

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
}

/**
 * Claves cuyos sinónimos están DECLARADOS a mano arriba, frente a las que caerían
 * al respaldo `[clave]`. Se expone para que el test T-6 compruebe la DECLARACIÓN y
 * no la FORMA del valor: `hemoglobina` declara exactamente ['hemoglobina'] y eso es
 * correcto — su `patron` en analitos.ts no admite ninguna otra forma.
 */
export const CLAVES_SINONIMOS_DECLARADOS: readonly string[] = Object.keys(SINONIMOS_LAB)

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
  { clave: 'imc', etiqueta: 'Índice de masa corporal', dominio: 'signo-vital', unidadConvencional: 'kg/m2', sinonimos: ['imc', 'indice de masa corporal', 'bmi'], codigos: [loinc('39156-5', FUENTE_LOINC_VITALES)] },
  { clave: 'glucometria', etiqueta: 'Glucometría', dominio: 'signo-vital', unidadConvencional: 'mg/dL', sinonimos: ['glucometria', 'dextrostix', 'glucosa capilar'], codigos: [loinc('2339-0', FUENTE_LOINC_VITALES)] },
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
    ...(ESPECIMEN_LAB[a.clave] ? { especimen: ESPECIMEN_LAB[a.clave] } : {}),
    // Si un analito nuevo aparece en producción sin sinónimos declarados aquí,
    // al menos su propia clave lo resuelve; el test T-6 obliga a declararlos.
    sinonimos: SINONIMOS_LAB[a.clave] ?? [normalizarTermino(a.clave)],
    codigos: [],                       // NEEDS_CLINICAL_REVIEW · Q1
    unidadConvencional: a.unidad,
  })),
  /**
   * `creatinina_orina` existe hoy sólo como EXCLUSIÓN en `analitos.ts:44`
   * (`(?!\s*(en\s*)?orina)`). Se le da identidad propia para que la aceptación
   * de E1-02 no se pueda «cumplir» colapsando orina y suero en la misma serie.
   * No comparte ni un sinónimo con `creatinina`.
   */
  {
    clave: 'creatinina_orina',
    etiqueta: 'Creatinina en orina',
    dominio: 'laboratorio',
    especimen: 'orina',
    sinonimos: ['creatinina en orina', 'creatinina urinaria', 'creatinina orina'],
    codigos: [],                       // NEEDS_CLINICAL_REVIEW · Q1
  },
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

    if (claves.length === 1) {
      const c = porClave.get(claves[0])
      return c ? { estado: 'resuelto', concepto: c } : { estado: 'desconocido', termino: t }
    }

    if (opts?.dominio) {
      const enDominio = claves
        .map(k => porClave.get(k))
        .filter((c): c is ConceptoCanonico => !!c && c.dominio === opts.dominio)
      if (enDominio.length === 1) return { estado: 'resuelto', concepto: enDominio[0] }
    }
    return {
      estado: 'ambiguo',
      termino: t,
      candidatos: claves,
      nota: `El término «${t}» pertenece a ${claves.length} conceptos. Sin una pista de dominio que deje uno solo, no se elige.`,
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
 *  3. 0 coincidencias → `desconocido`.  1 → `resuelto`.
 *  4. ≥2 → si `opts.dominio` deja exactamente una, `resuelto`; si no, `ambiguo`.
 *     NUNCA se elige la primera.
 *  5. Término en `TERMINOS_RESERVADOS` → `ambiguo` aunque haya un solo candidato.
 *
 * PRECIO DECLARADO: no extrae conceptos de prosa («PCR para influenza» →
 * `desconocido`). No es una regresión, es división de trabajo: extraer es del
 * NER y del proyector (E1-03); canonizar lo ya extraído es de aquí.
 *
 * `dominio` es una PISTA del productor, no una afirmación clínica.
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
