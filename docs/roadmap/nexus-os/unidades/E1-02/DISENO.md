# E1-02 — Vocabulario de conceptos clínicos · DISEÑO

> **Estado:** diseño. **NO implementado**: en esta unidad no se escribió una sola línea de código de producción.
> **Etapa:** E1 (Nexus Context). **Riesgo declarado en backlog:** medio. **Riesgo real del cambio tal como está diseñado:** **bajo** (§7), porque el diseño **no toca** el catálogo que hoy está en producción.
> **Depende:** E1-01 (`ClinicalFact` + `ConceptoRef`, completada). **Habilita:** E1-03 (proyector), E1-07/E1-09 (vistas), y toda exportación FHIR/HL7 con códigos.
> **Necesita validación clínica: SÍ** (§8). El backlog ya lo marcaba (`validacionClinica: true`) y la exploración confirma exactamente **dónde**: en los códigos estándar y en tres abreviaturas ambiguas. Ninguna de esas decisiones se inventa aquí.

---

## 0. Resumen ejecutivo

La aceptación de E1-02 es una frase falsable: **«'creatinina', 'Cr' y 'creatinina sérica' resuelven al mismo concepto»**. La ejecuté contra el repo real antes de diseñar nada. Resultado medido:

| Término | `analitoDe()` hoy | ¿Cumple la aceptación? |
|---|---|---|
| `'creatinina'` | `creatinina` | sí |
| `'creatinina sérica'` | `creatinina` | sí |
| **`'Cr'`** | **`null`** | **NO** |

*(medido ejecutando los patrones reales de `src/lib/expediente/laboratorio/analitos.ts:41-66`; `grep -n "\bcr\b"` sobre ese archivo y sobre `labs-desde-texto.ts` devuelve vacío: el alias no existe en ningún catálogo del repo).*

Así que la unidad tiene trabajo real, pero es **un tercio del enunciado**. Al intentar falsar el resto aparecieron tres cosas que el diseño obvio («añadir `cr` al regex») no resuelve y que además empeoraría.

**Hallazgo 1 — el resolvedor de hoy produce falsos positivos MEDIDOS, y uno de ellos llega a una gráfica clínica.** Los patrones casan **como palabra dentro de una frase**, no como término completo. Ejecutado:

| Entrada | Resuelve a | Correcto |
|---|---|---|
| `'vitamina K'` | **`potasio`** | ❌ |
| `'PCR para influenza'` | **`pcr` (proteína C reactiva)** | ❌ |
| `'depuración de Cl de creatinina'` | `creatinina` | ⚠️ por accidente |

El primero no es teórico: `analitoDe()` se consume en `src/lib/expediente/laboratorio/extraccion.ts:97` sobre el **nombre de fila** de un panel de laboratorio leído por visión. Una fila «Vitamina K … 10» resuelve a `potasio`, y `valorPlausible('potasio', 10)` devuelve **`true`** (rango `[1, 10]`, `analitos.ts:62`) → el punto **entra a la serie temporal de potasio** como 10 mEq/L. Ver §9: se reporta como hallazgo, **no se repara en esta unidad** (regla 5 de la carta operativa: tocar `analitoDe` cambia una gráfica en producción).

**Hallazgo 2 — añadir `cr` al regex actual es la peor forma de cumplir la aceptación.** Con casado por subcadena-palabra, `\b(creatinina|cr)\b` haría que `'Cr'` funcione **y** que `'proteína C reactiva'`, `'CR-39'`, `'cr'` dentro de cualquier frase entren a la serie de creatinina. Se cumpliría el criterio literal ampliando el agujero del hallazgo 1. **El diseño resuelve por término COMPLETO normalizado, no por regex.**

**Hallazgo 3 — «resuelven al mismo concepto» tiene un anticumplimiento trivial.** Un resolvedor que colapse todo lo que contenga «creatinina» pasa la aceptación… y también manda `'creatinina en orina'` al mismo concepto, borrando una distinción que el repo **ya protege a propósito** (`analitos.ts:44`, el `(?!\s*(en\s*)?orina)`). El diseño fija el contra-test: **la aceptación no vale si `'creatinina en orina'` cae en el mismo concepto** (§5, T-2).

**Cambio propuesto: 3 archivos nuevos. 0 archivos de producción modificados. 0 pantallas, 0 rutas de API, 0 reglas de Firestore, 0 impresión, 0 cobros.**

---

## 1. Qué pide la unidad (backlog literal)

| Campo | Valor |
|---|---|
| Objetivo | Catálogo canónico de conceptos con mapeo a códigos estándar **donde la licencia lo permita** (LOINC/ICD-10) |
| Entregables | catálogo de conceptos · resolvedor de sinónimos · tests |
| Aceptación | **'creatinina', 'Cr' y 'creatinina sérica' resuelven al mismo concepto** |
| Depende | E1-01 |
| Riesgo | medio |
| `validacionClinica` | **true** |

---

## 2. Qué existe YA en el repo (no rehacer)

El repo **no tiene** un vocabulario de conceptos, pero tiene **cinco catálogos parciales** y **dos precedentes de política** que E1-02 debe reusar en vez de reinventar.

| Pieza existente | Dónde | Qué aporta / qué le falta |
|---|---|---|
| **Catálogo de analitos** — la semilla real | `src/lib/expediente/laboratorio/analitos.ts:18` (`interface Analito`), `:41` (`ANALITOS`, 24 entradas), `:77` (`analitoDe`), `:84` (`analitoPorClave`), `:93` (`valorPlausible`) | Ya da **clave canónica + etiqueta + sinónimos + unidad convencional + rango plausible + grupo**. Es la fuente de verdad de las claves de laboratorio y **no se duplica**: el vocabulario la **importa**. Le falta: `Cr`, códigos estándar, y el casado es por regex (hallazgo 1). |
| Segundo catálogo de analitos, **privado** | `src/lib/expediente/labs-desde-texto.ts:34` (`ANALITOS` local, 16 entradas) | Mismas claves, patrones ligeramente distintos (`k\+?`, `na\+?`, el `(?<!\bno[\s-]?)` del HDL). Ya es una duplicación existente. E1-02 **no la fusiona** (toca el copiloto); sí la fija con un test de no-deriva de claves (§5, T-6). |
| **8 códigos LOINC ya en producción** | `src/lib/fhir/recursos.ts:80-88` (`LOINC_VITALES`: `8867-4` FC, `9279-1` FR, `8310-5` temperatura, `2708-6` SpO₂, `29463-7` peso, `8302-2` talla, `39156-5` IMC, `2339-0` glucometría) + `:113-117` (TA `85354-9` con sus dos componentes `8480-6`/`8462-4`) | Precedente de que **sí se usan LOINC** en este repo y de que la TA se emite como **dos observaciones**, no una. E1-02 los **copia con su cita**; no elige códigos nuevos. |
| **Catálogo CIE-10** | `src/lib/cie10.ts:45` (`CIE10_CATALOG`, ~120 códigos), `:27` (`cargarCatalogoExtendido` → `/cie10.json`, ~1400), `:282` (`RE_CIE10`), `:294` (`cie10EnCatalogoBase`) | El eje diagnóstico **ya está resuelto** y con búsqueda. E1-02 **no lo reimplementa**: el dominio `diagnostico` del vocabulario delega en él. |
| Vocabulario farmacológico | `src/lib/expediente/vocabulario-atc.ts:335` (`VOCABULARIO_ATC`), `medical-vocabulary.ts:22+`, `medical-dictionary.ts:42` (`ABREVIATURAS`) | Miles de nombres de fármaco por categoría ATC. **Listas planas, sin clave canónica** → no son un vocabulario de conceptos. Fuera del alcance mínimo (§3.5). |
| **Sinónimos con canonización, ya escrita** | `src/lib/uci/extraccion.ts:46` (`SINONIMOS`) y `:54` (`canonizarFarmaco`) | Resuelve por **igualdad exacta normalizada** (`SINONIMOS[t] ?? t`), no por regex. **Es el patrón que E1-02 adopta**, no uno inventado. |
| **Precedente de política nº1: cortafuegos de ambigüedad** | `src/lib/uci/extraccion.ts:7` y `:64` (`ambiguo`, `unidadPendiente`) | «Ante ambigüedad NO se asume — se marca para que la UI pida confirmación». E1-02 lo copia como **estado de resolución de primera clase** (§4.2). |
| **Precedente de política nº2: ante la duda, no se mapea** | `src/lib/expediente/labs-desde-texto.ts:16-18` | «Es preferible no calcular a calcular mal». Justifica que `desconocido` sea una salida legítima y no un fallo. |
| `ConceptoRef` (E1-01) | `src/types/clinical-fact.ts:39` y su esquema `src/lib/clinical-fact/schema.ts:55` | El **destino** del vocabulario: `clave`, `etiqueta?`, `codigo?: { sistema: 'LOINC'\|'CIE-10'\|'SNOMED'\|'ATC'; codigo }`. E1-01 dejó `clave` **opaca a propósito** y declaró (decisión D5) que canonizarla **es esta unidad**. El contrato ya está fijado: E1-02 sólo tiene que producir valores que ese esquema acepte. |
| `norm()` — normalización idéntica en 3 sitios | `analitos.ts:71`, `uci/extraccion.ts:32`, `labs-desde-texto.ts` | minúsculas + `NFD` + quitar diacríticos. Se reusa la misma función (no una cuarta variante). |

**Conclusión de la exploración.** Hay **una semilla real** (`ANALITOS`), **dos catálogos de códigos ya en producción** (LOINC de vitales, CIE-10) y **dos políticas ya decididas** (cortafuegos de ambigüedad, no mapear ante la duda). Lo que **no** existe es: la clave `Cr`, un resolvedor que no produzca falsos positivos, y cualquier mapeo LOINC de laboratorio.

---

## 3. El diseño

### 3.1 Dónde vive

`src/lib/clinical-fact/vocabulario.ts` — **no** `src/lib/clinical/`.

Es la misma razón que E1-01 fijó en su decisión D1: `src/lib/clinical/` es territorio del Clinical Engine Registry y de su trinquete de ADRs (`src/lib/clinical/adr-cobertura.ts:33`, `DEUDA_ADR_CONGELADA = 52`). Un vocabulario **no calcula, no decide y no tiene umbrales**: meterlo ahí lo haría reclamarse como motor sin ADR y subiría la deuda congelada, poniendo el CI en rojo por una clasificación equivocada.

Verificado que no hay gate de escaneo de directorios que lo alcance: los únicos tests que leen el disco son `src/__tests__/clinical-registry-adr.test.ts:109`, que sólo recorre `docs/clinical-decisions/`. **Este DISEÑO vive en `docs/roadmap/`, así que tampoco toca ese gate.**

### 3.2 El contrato

```ts
// src/lib/clinical-fact/vocabulario.ts
import type { ConceptoRef } from '@/types/clinical-fact'

export const VOCABULARIO_VERSION = '1.0.0'

/** Eje del concepto. Determina de qué catálogo salen sus códigos. */
export type DominioConcepto = 'laboratorio' | 'signo-vital' | 'diagnostico'

/**
 * Espécimen. Sólo se declara cuando el repo YA lo distingue: `analitos.ts:44`
 * excluye a propósito «creatinina en orina» de la serie de creatinina sérica.
 */
export type Especimen = 'suero' | 'orina' | 'sangre-total'

export interface CodigoEstandar {
  readonly sistema: 'LOINC' | 'CIE-10'      // subconjunto de ConceptoRef['codigo']['sistema']
  readonly codigo: string
  /** OBLIGATORIA. De dónde salió el código, con archivo:línea o publicación. */
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
   * NO son regex y NO casan como subcadena: es la corrección del hallazgo 1.
   */
  readonly sinonimos: readonly string[]
  /** Vacío ⇒ NO hay código. Nunca se inventa uno para «completar» el catálogo. */
  readonly codigos: readonly CodigoEstandar[]
  /** Copiada de ANALITOS cuando aplica. NO se redecide aquí. */
  readonly unidadConvencional?: string
}

/**
 * Resultado de resolver un término. `ambiguo` es de PRIMERA CLASE —
 * mismo cortafuegos que `uci/extraccion.ts:64`: ante dos lecturas no se elige.
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

export const CONCEPTOS: readonly ConceptoCanonico[]

/** Resuelve un término libre. `dominio` es una PISTA del productor (E1-03). */
export function resolverConcepto(
  termino: string,
  opts?: { readonly dominio?: DominioConcepto },
): ResolucionConcepto

export function conceptoPorClave(clave: string): ConceptoCanonico | null

/** Puente a E1-01: siempre produce un `ConceptoRef` que `ConceptoRefSchema` acepta. */
export function aConceptoRef(c: ConceptoCanonico): ConceptoRef
```

### 3.3 La regla de resolución (la parte falsable)

1. Normalizar el término con la **misma** `norm()` del repo (minúsculas, `NFD`, sin diacríticos, espacios colapsados).
2. Buscar **igualdad exacta** contra `clave` y contra cada `sinonimos[]`. Sin `test()`, sin `includes()`, sin `\b`.
3. **0 coincidencias** → `desconocido`.
4. **1 coincidencia** → `resuelto`.
5. **≥2 coincidencias** → si `opts.dominio` deja exactamente una, `resuelto`; si no, `ambiguo`. **Nunca se elige la primera.**
6. Un término declarado en `TERMINOS_RESERVADOS` (§8, Q2) devuelve `ambiguo` **aunque** el catálogo tenga un solo candidato.

Por qué la igualdad exacta arregla lo medido, sin arreglar nada a mano:

| Entrada | Regla actual (regex) | Regla nueva (término completo) |
|---|---|---|
| `'Cr'` | `null` ❌ | `creatinina` (sinónimo declarado) ✔ |
| `'creatinina sérica'` | `creatinina` ✔ | `creatinina` (sinónimo declarado) ✔ |
| `'vitamina K'` | **`potasio`** ❌ | `desconocido` ✔ |
| `'PCR para influenza'` | **`pcr`** ❌ | `desconocido` ✔ |
| `'creatinina en orina'` | `null` | concepto **distinto** (`creatinina_orina`) ✔ |

El precio, declarado: la regla nueva **no extrae conceptos de prosa**. No es una regresión — es división de trabajo. Extraer el término de una frase dictada es del NER (`medical-ner.ts`) y del proyector (E1-03); **canonizar** el término ya extraído es de esta unidad. Mezclar ambas cosas es exactamente lo que produjo `vitamina K → potasio`.

### 3.4 Qué contiene el catálogo v1.0.0

| Dominio | Entradas | De dónde salen | Códigos |
|---|---|---|---|
| `laboratorio` | **24**, una por cada `clave` de `ANALITOS` | Importadas de `analitos.ts:41` (clave, etiqueta, unidad). Los sinónimos se **derivan a mano de los literales que ya están en cada regex** (p. ej. `glucosa`: `glucosa`, `glucemia`, `glicemia`, `glu`) — no se inventa ninguno **salvo `cr`, que lo ordena la aceptación del backlog**. | **Ninguno** (§8, Q1) |
| `laboratorio` (nuevo) | **1**: `creatinina_orina` | Existe hoy sólo como exclusión (`analitos.ts:44`). Se le da identidad propia para que la aceptación no se cumpla colapsándola. | Ninguno |
| `signo-vital` | **10** (`fc`, `fr`, `ta_sistolica`, `ta_diastolica`, `temperatura`, `spo2`, `peso`, `talla`, `imc`, `glucometria`) | Campos de `SignosVitales` (`src/types/expediente.ts:86-98`) | **8 LOINC copiados** de `fhir/recursos.ts:80-88` + los 2 de la TA de `:116-117`, cada uno con `fuente` = ese archivo:símbolo |
| `diagnostico` | **0 entradas propias** | `lib/cie10.ts` ya es el catálogo. El vocabulario expone `resolverDiagnostico()` como delegación fina a `buscarCie10`, sin copiar códigos. | CIE-10, vía `cie10.ts` |

`glasgow` y `escalaDolor` (`expediente.ts:96-97`) quedan **fuera**: son escalas con puntaje, y su unidad («puntos») ni siquiera es expresable en el catálogo de E0-04 — deuda ya declarada y fijada por test en E1-01 (`E1-01-COBERTURA`). Meterlas aquí sería fabricar un concepto que ningún hecho puede instanciar.

### 3.5 Lo que este diseño NO hace (y por qué)

| No hace | Por qué |
|---|---|
| **No modifica `analitos.ts` ni `analitoDe()`** | Alimenta las gráficas longitudinales de laboratorio en producción (`extraccion.ts:97,150`). Regla 5 de la carta operativa: se entrega el plan (§9), no se ejecuta a ciegas. |
| No modifica `labs-desde-texto.ts` | Alimenta al copiloto de la consulta. Mismo motivo. |
| No fusiona los dos catálogos de analitos | La duplicación es preexistente; fusionarla toca dos rutas de producción a la vez. Se fija con un test de no-deriva (T-6) y se propone como unidad aparte. |
| No incorpora fármacos ni microbiología | `VOCABULARIO_ATC` son listas planas sin clave canónica: convertirlas en conceptos es un catálogo entero, con su propia validación clínica. No lo exige esta aceptación. |
| No emite SNOMED | Requiere licencia de miembro; el backlog dice explícitamente «donde la licencia lo permita (LOINC/ICD-10)». `ConceptoRef` ya admite el sistema por si algún día se licencia. |
| No inventa **ni un solo** código LOINC de laboratorio | §8, Q1. Es la regla 1 de la carta operativa aplicada al pie de la letra. |

---

## 4. Contrato de comportamiento, en una tabla

| Entrada | Salida esperada |
|---|---|
| `resolverConcepto('creatinina')` | `{ estado: 'resuelto', concepto.clave: 'creatinina' }` |
| `resolverConcepto('Cr')` | idem |
| `resolverConcepto('CR')` / `'  cr  '` | idem (normalización) |
| `resolverConcepto('creatinina sérica')` | idem |
| `resolverConcepto('creatinina serica')` | idem (sin acento) |
| `resolverConcepto('creatinina en orina')` | `{ estado: 'resuelto', concepto.clave: 'creatinina_orina' }` — **concepto distinto** |
| `resolverConcepto('vitamina K')` | `{ estado: 'desconocido' }` |
| `resolverConcepto('PCR')` | `{ estado: 'ambiguo', candidatos: ['pcr', 'pcr_molecular'], nota }` *(default seguro hasta Q2)* |
| `resolverConcepto('PCR', { dominio: 'laboratorio' })` | `{ estado: 'ambiguo' }` mientras `pcr` esté reservado *(Q2 decide si pasa a `resuelto`)* |
| `resolverConcepto('')` | `{ estado: 'desconocido', termino: '' }` |
| `aConceptoRef(c)` | objeto que `ConceptoRefSchema.parse` acepta, **sin `codigo`** si `c.codigos` está vacío |

---

## 5. Tests que lo prueban

Archivo nuevo: `src/__tests__/clinical-vocabulario.test.ts`. Todos con datos sintéticos; no hay PHI ni nombres de paciente.

| # | Test | Qué protege |
|---|---|---|
| **T-1** | **Aceptación literal**: `'creatinina'`, `'Cr'`, `'creatinina sérica'` → misma `clave`; más las variantes `'CR'`, `'creatinina serica'`, `'  cr '` | El criterio del backlog, con su normalización |
| **T-2** | **Anticumplimiento**: `'creatinina en orina'` **NO** resuelve a `creatinina` | Impide «cumplir» colapsando todo lo que contenga la palabra (hallazgo 3) |
| **T-3** | **Falsos positivos medidos**: `'vitamina K'` ≠ `potasio`; `'PCR para influenza'` ≠ `pcr`; `'no-HDL'` ≠ `hdl` | Fija la corrección del hallazgo 1 en el módulo nuevo. Es el test que hoy **fallaría** contra `analitoDe()` |
| **T-4** | **Invariante de unicidad** (recorre TODO el catálogo): ningún string de sinónimo pertenece a dos conceptos salvo que esté en `TERMINOS_RESERVADOS`; ninguna `clave` se repite; ninguna `clave` aparece como sinónimo de otro concepto | Es el invariante universal de esta unidad, en el espíritu de E0-02: el catálogo no puede crecer con colisiones silenciosas |
| **T-5** | **Trinquete de códigos**: todo `CodigoEstandar` tiene `fuente` no vacía; el número de conceptos de `laboratorio` **sin** código es exactamente `N` (constante `SIN_CODIGO_CONGELADO`) | Nadie «completa» el catálogo inventando LOINC. Si el Dr. valida códigos, el número **baja**; nunca sube |
| **T-6** | **No-deriva con la fuente de verdad**: toda clave de dominio `laboratorio` (salvo `creatinina_orina`) existe en `ANALITOS`, y su `unidadConvencional` es idéntica a `ANALITOS[i].unidad` | Impide que el vocabulario se bifurque del catálogo que sí está en producción |
| **T-7** | **LOINC de vitales copiados, no elegidos**: los 10 códigos coinciden uno a uno con `LOINC_VITALES` de `fhir/recursos.ts` | Anti-deriva contra el único mapeo LOINC ya en producción |
| **T-8** | **Puente con E1-01**: para todo concepto, `ConceptoRefSchema.parse(aConceptoRef(c))` no lanza; y un concepto sin códigos produce un `ConceptoRef` **sin** la llave `codigo` (no `codigo: undefined`, que `strictObject` sí distingue) | El vocabulario produce conceptos válidos para el grafo |
| **T-9** | **Ambigüedad, no adivinanza**: un término reservado devuelve `ambiguo` con ≥2 candidatos, nunca `resuelto`; y `resolverConcepto` **jamás** devuelve `resuelto` cuando hay 2 candidatos sin pista de dominio | El cortafuegos de `uci/extraccion.ts`, aplicado aquí |

**Control negativo obligatorio** (a ejecutar en la implementación, como hizo E1-01): sustituir la igualdad exacta por `includes()` y comprobar que **T-3 se pone en rojo**. Si no cambia nada, el test no prueba lo que dice y hay que rehacerlo.

---

## 6. Archivos que se tocan

| Archivo | Acción | Líneas aprox. |
|---|---|---|
| `src/lib/clinical-fact/vocabulario.ts` | **NUEVO** — catálogo + resolvedor, puro y determinista, sin zod, sin I/O | ~260 |
| `src/__tests__/clinical-vocabulario.test.ts` | **NUEVO** — T-1 … T-9 | ~220 |
| `src/__tests__/fixtures/conceptos.ts` | **NUEVO** — términos sintéticos de entrada (incluye los falsos positivos medidos) | ~40 |
| `docs/roadmap/nexus-os/unidades/E1-02/{DISENO.md, RESULTADO.json}` | documentación de la unidad | — |

**Archivos de producción modificados: 0.** No se toca `analitos.ts`, `labs-desde-texto.ts`, `cie10.ts`, `fhir/recursos.ts`, `schema.ts` ni `clinical-fact.ts`.

---

## 7. Riesgo de regresión REAL

**Bajo.** Fundamentado, no declarado:

- El módulo nace **sin importadores de producción**. Su primer consumidor será E1-03, que todavía no existe. Un `grep` de `vocabulario` tras la implementación debe devolver **sólo** `src/__tests__/`; si devuelve algo más, el diseño se violó.
- **Cero** pantallas, rutas de API, `firestore.rules`, impresión/PDF/Word, firma o cobros — los cinco frentes que la memoria del proyecto marca como sensibles.
- El único acoplamiento a producción es de **lectura**: `import { ANALITOS } from '@/lib/expediente/laboratorio/analitos'`. Es un array de constantes ya evaluado en el bundle actual; importarlo desde un módulo sin consumidores no cambia ningún camino de ejecución vivo.
- El riesgo «medio» del backlog es real **para el diseño obvio** (reescribir `analitoDe`), y por eso el diseño lo evita explícitamente (§3.5) y manda esa parte a §9 como decisión del médico dueño.

**Gates:** `npx tsc --noEmit`, `npx vitest run src/__tests__/`, `npm run build`. Nada de servidores, `--watch` ni Playwright.

---

## 8. NEEDS_CLINICAL_REVIEW — lo que NO decido

Las tres preguntas tienen **default seguro ya aplicado en el diseño**, así que la unidad **no se detiene**: si no hay respuesta, el catálogo se queda en el estado conservador y ninguna de estas decisiones queda inventada en el código.

### Q1 · Códigos LOINC de laboratorio: ¿cuáles, y se envían?
El backlog pide «mapeo a códigos estándar donde la licencia lo permita». Los vitales ya tienen sus 10 códigos **en producción** y se copian. Los 24 analitos **no tienen ninguno**, y elegirlos no es mecánico: para una sola creatinina hay códigos distintos según **magnitud** (masa vs. sustancia) y **espécimen** (suero/plasma vs. orina), y un código equivocado viaja al exterior en el `Observation` de FHIR, donde otro sistema lo interpreta como verdad.
**No los elijo.** *Default aplicado:* `codigos: []` para los 24, con el trinquete T-5 que impide rellenarlos sin cita.
**Lo que necesito:** o (a) la tabla concepto→LOINC que usted valide, o (b) el visto bueno para dejar el laboratorio sin LOINC en v1.0.0 y exportarlo sólo con la clave interna.

### Q2 · `PCR`: en su práctica, ¿proteína C reactiva o reacción en cadena de la polimerasa?
Hoy `analitos.ts:65` resuelve `PCR` → **proteína C reactiva**, sin más. En una app con módulo PROA/infectología, «PCR» aparece constantemente con el otro sentido, y ya está **medido** que `'PCR para influenza'` cae en la serie de proteína C reactiva.
*Default aplicado:* en el vocabulario nuevo, `pcr` es **término reservado** → `ambiguo`. Producción **no cambia**.
**Lo que necesito, una de tres:** (a) `PCR` a secas = proteína C reactiva y el sentido molecular siempre se escribe completo; (b) siempre ambiguo, que la UI pregunte; (c) desambiguar por dominio (en un panel de laboratorio = proteína C reactiva; en microbiología = molecular).

### Q3 · Abreviaturas que pueden resolver solas
La aceptación del backlog ya decide **`Cr` → creatinina**, así que ésa no la pregunto. Pero el catálogo hereda de `analitos.ts` otras que resuelven hoy sin contexto: **`Na`, `K`, `Cl`, `FA`, `Glu`, `ALP`, `A1c`, `BUN`, `Hto`, `Hct`, `TSH`**. Con igualdad exacta ya no producen el falso positivo de `vitamina K`, pero siguen siendo abreviaturas que **usted** usa o no.
*Default aplicado:* se conservan **exactamente** las que ya están en los regex de `analitos.ts` (ni una más), y `Cr`. Nada nuevo se inventa.
**Lo que necesito:** ¿alguna de esas debe dejar de resolver sola? ¿Falta alguna que usted teclea y hoy no existe (p. ej. `BH`, `QS`, `ES`, `TP`, `TTP`)? Cada una que agregue debe venir con su sentido único.

### Q4 · Espécimen: ¿«creatinina» a secas es la sérica?
El repo lo asume hoy al excluir «en orina» (`analitos.ts:44`), y la aceptación del backlog («creatinina sérica» = «creatinina») lo confirma. Lo dejo **explícito** en vez de implícito: `creatinina` → `especimen: 'suero'`, y `creatinina_orina` como concepto separado sin sinónimos compartidos.
*Default aplicado:* eso. **Confirme** que es correcto, porque fija la semántica de toda serie temporal futura.

---

## 9. Hallazgo para el ledger — NO se repara en esta unidad

**`E1-02-H1` · `analitoDe()` casa como palabra dentro de una frase y contamina una serie clínica.**

- **Medido:** `analitoDe('vitamina K')` → `potasio`. `valorPlausible('potasio', 10)` → `true`.
- **Camino real:** panel de laboratorio por visión → `validarPanel` (`extraccion.ts:97`) → `resultados[]` → `seriesDesdeHistorial` → gráfica longitudinal. Una fila «Vitamina K 10» aparece como **potasio 10 mEq/L**, valor de rango letal, en la gráfica de electrolitos del paciente.
- **Segundo caso:** `analitoDe('PCR para influenza')` → `pcr` (proteína C reactiva).
- **Por qué no lo reparo aquí:** cambia el comportamiento de una pantalla en producción. Carta operativa, regla 5 → se entrega el plan y lo decide el médico dueño.
- **Reparación mínima propuesta (unidad aparte):** en `analitoDe`, exigir **término completo** para los alias de 1–3 letras (`na`, `k`, `cl`, `fa`, `glu`, `alp`, `a1c`, `bun`, `hto`, `hct`, `ldl`, `hdl`, `cr`) y dejar el casado por palabra sólo para los nombres largos. Es ~6 líneas y **necesita su propio test de regresión** sobre los casos que hoy sí funcionan (`'Glu'`, `'Hemoglobina glucosilada'`, `'no-HDL'`).
- **Mitigación temporal disponible hoy:** ninguna en código; el dato mal graficado es visible y el médico puede descartarlo.

---

## 10. Definición de terminado (para la implementación)

1. `resolverConcepto` cumple la tabla de §4 completa, no sólo las tres cadenas de la aceptación.
2. T-1 … T-9 en verde, con el **control negativo ejecutado y revertido** (§5).
3. `npx tsc --noEmit` · `npx vitest run src/__tests__/` · `npm run build` en verde, con la línea base de tests **medida antes** de tocar nada (E1-01 cerró en **2211** casos / 181 archivos).
4. `grep -rn "clinical-fact/vocabulario" src/` devuelve **sólo** archivos de `src/__tests__/`.
5. `RESULTADO.json` escrito **en el mismo commit** que cierra la unidad (regla operativa de `estado.json`), con `necesitaValidacionClinica: true` y Q1–Q4 copiadas literalmente.
