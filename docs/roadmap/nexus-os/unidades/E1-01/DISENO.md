# E1-01 — Tipo `ClinicalFact` · DISEÑO

> **Estado:** diseño **verificado con el compilador y con zod reales del repo** (`tsc` 5.9.3 `strict`, `zod` 4.4.3). NO implementado: en esta unidad no se escribió una sola línea de código de producción.
> **Etapa:** E1 (Nexus Context). **Riesgo declarado en backlog:** bajo. **Riesgo real del cambio tal como está diseñado:** bajo (§7). **Depende:** E0-04 (`ClinicalQuantity`, completada y verificada). **Habilita:** E1-02 … E1-09 (toda la etapa cuelga de este tipo).
> **Línea base medida hoy:** `npx vitest run src/__tests__/` → 180 archivos, **2164 casos, 1 fallo AJENO** (§7.4). `npx tsc --noEmit` → exit 0.

---

## 0. Resumen ejecutivo

La aceptación de E1-01 es una sola frase: **«un hecho sin unidad o sin procedencia no valida»**. Es falsable, y al intentar falsarla contra el repo aparecieron cuatro cosas que el diseño obvio no resuelve.

**Hallazgo 1 — el parser de cantidades NO se puede escribir fuera de `clinical-quantity.ts`.** Un `ClinicalFact` llega desde Firestore, HL7 o un formulario: valor, unidad y dimensión son `unknown` y hay que validarlos en tiempo de ejecución. El narrowing natural (`cantidad(v, u as UnidadDe<D>, dim)` con `dim: Dimension`) **no compila**: por la marca invariante de E0-04, `ClinicalQuantity<Dimension>` no es asignable a `CualquierCantidad`. Verificado hoy con el compilador real (§3.4, `error TS2322`). Consecuencia práctica: si E1-01 no aporta la puerta de entrada, **cada consumidor la fabricará con `as CualquierCantidad`** — y ahí muere la protección de E0-04. El diseño añade **una función aditiva** a `src/types/clinical-quantity.ts` (`parsearCantidad`), donde la aserción ya está confinada por diseño.

**Hallazgo 2 — la aceptación es VACÍA si no se cierra la fuga por texto.** Un union con variante `texto` deja pasar `{ clase: 'texto', texto: '135' }`: un número sin unidad que **sí valida**. El criterio quedaría formalmente cumplido y el agujero abierto — el mismo patrón que E0-04 encontró con la marca fantasma. El diseño lo prohíbe: un texto que `num()` lee como número no es un hecho de texto (§3.3, caso R-9).

**Hallazgo 3 — `procedencia: {}` pasa cualquier esquema de campos opcionales.** La procedencia se modela como **union discriminada por origen** con campos obligatorios y no vacíos por variante (`humano` · `ia` · `motor` · `externo`), reflejando el invariante 5 del programa (modelVersion, promptVersion, engineVersion, knowledgeVersion, timestamp).

**Hallazgo 4 — hueco de cobertura medido, NO inventado.** El catálogo de E0-04 **no puede expresar 14 de los 35 datos** que el grafo necesitará primero: de `SignosVitales` sólo 3 de 11 (faltan lpm, rpm, °C, cm, kg/m², puntos, y la TA compuesta), y de `ANALITOS` 18 de 24 (faltan `U/L`, `10³/µL`, `µUI/mL`). E1-01 **no amplía el catálogo** (§8.2): ampliarlo toca un guard deliberado de E0-04 y no lo exige esta aceptación. El hueco se fija con un test y se declara **bloqueante para E1-03**, que es quien tendrá productores reales.

**Cambio propuesto: 4 archivos nuevos + 1 función aditiva en un archivo sin consumidores. 0 archivos de producción modificados. 0 pantallas, 0 rutas, 0 reglas.**

---

## 1. Qué pide la unidad (backlog literal)

| Campo | Valor |
|---|---|
| Objetivo | Hecho clínico atómico con concepto, valor, unidad, estado, certeza, fuente, autor, `observedAt`, `validFrom`/`validTo`, `supersedes` y `provenance` |
| Entregables | `types/clinical-fact.ts` · esquema de validación · tests |
| Aceptación | **Un hecho sin unidad o sin procedencia no valida** |
| Depende | E0-04 |
| Riesgo | bajo |
| `validacionClinica` | **false** |

---

## 2. Qué existe YA en el repo (no rehacer)

El repo **ya tiene medio `ClinicalFact`, repartido en cinco sitios**. Ninguno sirve como grafo del paciente, pero todos aportan vocabulario que E1-01 debe **reusar en vez de inventar** (regla 1 de la carta operativa: si el criterio ya está decidido en el repo, copiarlo con su cita, no redecidirlo).

| Pieza existente | Dónde | Qué aporta y qué le falta |
|---|---|---|
| **`ICUObservation`** — lo más parecido a un `ClinicalFact` que existe | `src/types/uci.ts:62-83` | Ya trae `conceptCode` opcional, `display`, `value`, `unit`, `normalizedValue/Unit`, `status`, `effectiveAt`, `source`, `confidence`, `confirmedByPhysician`. **Le falta todo lo temporal y toda la procedencia**: no tiene `validFrom/validTo`, ni `supersedes`, ni autor, ni provenance de IA/motor. Y `unit?: string` es **opcional y libre**: un valor sin unidad es representable, que es exactamente lo que E1-01 debe impedir. Además está **atado al episodio de UCI** (`encounterId` obligatorio): no modela al paciente longitudinal. |
| **`ClinicalTruthStatus`** | `src/types/uci.ts:19-26` | Vocabulario de certeza ya decidido y en uso: `confirmed · negated · unknown · historical · suspected · inferred · conflicting`. Incluye `conflicting`, que es justo lo que E1-08 necesitará. **E1-01 lo adopta tal cual** (§4.2). |
| `CertezaNER` + `certezaAStatus()` | `src/types/uci.ts:89` y `:96` | Puente ya escrito entre el vocabulario del extractor (`medical-ner.ts:32`: `confirmado · sospecha · descartado · historia`) y `ClinicalTruthStatus`. E1-03 lo reusará; E1-01 no lo toca. |
| **Provenance de IA de la nota** | `src/types/expediente.ts:226-247` (`iaAuditoria.provenance`) | Ya existe `modelo · motor · promptVersion · apiVersion · generadoEn · revisadoPorHumano · camposAprobados · pmids`. Es del **documento**, no del hecho, y **todos sus campos son opcionales** (`provenance: {}` es válido hoy). E1-01 **copia los nombres de campo** (anti-deriva) y los vuelve obligatorios por variante. |
| **Sello de procedencia por campo** | `src/lib/expediente/procedencia.ts:20-41` (`OrigenCampo = 'dictado' \| 'ia' \| 'manual'`, `CampoProcedencia`) | Ya clasifica cada dato estructurado de la nota y conserva la **cita textual** (`cita`) y la confianza. Es *derivado* y *por nota*; no persiste como hecho. E1-01 conserva la idea de la cita literal (`citaTextual`). |
| **Libro append-only del episodio** | `src/types/hospital.ts:188-232` (`TipoEventoClinico`, `EfectoCorreccion = anula \| sustituye \| aclara`, `EventoClinico.corrigeEventoId`) y `:170` (`SignosVitales.corrigeA`) | **Precedente directo de `supersedes`**, ya en producción y con reglas de Firestore: un hecho no se edita ni se borra, se anexa otro que lo referencia. E1-01 adopta la misma semántica y el mismo trío de efectos. |
| Catálogo de analitos | `src/lib/expediente/laboratorio/analitos.ts:18-33` | Clave canónica + unidad esperada + rango plausible + sinónimos por RegExp. **Es la semilla de E1-02**, no de E1-01: aquí el `concepto` se deja como referencia opaca. |
| Frontera FHIR ya escrita | `src/lib/fhir/recursos.ts:99-117` | Ya emite `Observation` con `status: 'final'`, `effectiveDateTime` y `valueQuantity` con `system: unitsofmeasure` y códigos **UCUM** (`mm[Hg]`). Justifica alinear `estado` con `Observation.status` y confirma que **UCUM es asunto de la frontera de exportación**, no del tipo interno. |
| Frontera HL7 v2 | `src/lib/hl7/v2.ts:28-40` (`ResultadoLab`: `codigo · sistema · nombre · valor · unidad? · rango? · flag?`) | La entrada externa ya trae unidad como **string opcional**. Es el productor típico de hechos y la razón de que el parser deba validar en runtime, no sólo en tipos. |
| Canonicalización estable para hashes | `src/lib/expediente/integrity.ts:26-37` (`estable`) y `:56` (`HASH_VERSION`) | Lección ya pagada en este repo: Firestore no conserva el orden de llaves y un hash sobre `JSON.stringify` da falsos «alterado». Si E1-04 sella hechos, **reusa `estable`**. E1-01 no sella nada. |
| Coerción numérica única | `src/lib/uci/num.ts:18` (`num()`) | Coma decimal mexicana, vacío→`null`, **nunca inventa 0**. `clinical-quantity.ts:23` ya la importa. E1-01 la usa para la guarda anti-número-disfrazado (§3.3 R-9). |
| `ClinicalQuantity` | `src/types/clinical-quantity.ts` (E0-04) | El núcleo de la unidad obligatoria. **Su única puerta de entrada es `cantidad()`/`cantidadDesde()`, y ninguna sirve para datos `unknown`** → §3.4. |
| zod | `package.json` (`zod ^4.4.3`, en `dependencies`), usado en `extraction-schema.ts:15`, `medical-ner.ts:26`, `antibiograma/vision.ts:17` | Ya es la herramienta de validación del repo. No se añade dependencia. |

**Conclusión de la exploración.** No hay ningún grafo de hechos que rehacer. Hay **un tipo hermano de UCI** (`ICUObservation`) que E1-01 no debe sustituir ni migrar en esta unidad, y **cuatro vocabularios ya decididos** (certeza, efectos de corrección, origen del campo, nombres de provenance) que E1-01 adopta por cita.

---

## 3. La parte falsable

### 3.1 El tipo (forma propuesta)

```ts
/** Referencia a un concepto. E1-02 la canoniza; E1-01 la deja OPACA a propósito. */
export interface ConceptoRef {
  /** Clave canónica del repo si existe (p. ej. `analitos.ts` → 'creatinina'). */
  readonly clave: string
  /** Etiqueta legible para mostrar sin resolver el catálogo. */
  readonly etiqueta?: string
  /** Código estándar cuando la licencia lo permita (LOINC/CIE-10). Lo llena E1-02. */
  readonly codigo?: { readonly sistema: 'LOINC' | 'CIE-10' | 'SNOMED' | 'ATC'; readonly codigo: string }
}

/** El valor del hecho. Union CERRADA: no hay variante «número suelto». */
export type ValorClinico =
  | { readonly clase: 'cantidad';  readonly cantidad: CualquierCantidad }
  | { readonly clase: 'codigo';    readonly concepto: ConceptoRef }        // dx, alérgeno, germen
  | { readonly clase: 'booleano';  readonly presente: boolean }            // presencia/ausencia
  | { readonly clase: 'texto';     readonly texto: string }                // narrativo, NO numérico

/** Ciclo de vida del REGISTRO (subconjunto de FHIR Observation.status). */
export type EstadoHecho = 'preliminar' | 'final' | 'corregido' | 'anulado'

/** Verdad clínica del CONTENIDO. Reusa `ClinicalTruthStatus` de src/types/uci.ts:19. */
export type CertezaHecho = ClinicalTruthStatus

/** De dónde salió el hecho. `documentoId` ancla la trazabilidad a un clic (E1-09). */
export interface FuenteHecho {
  readonly tipo: 'nota' | 'laboratorio' | 'receta' | 'internamiento' | 'signos'
              | 'hl7' | 'fhir' | 'dictado' | 'formulario'
  readonly documentoId?: string
  /** Frase literal que respalda el hecho, si la hay (patrón de procedencia.ts). */
  readonly citaTextual?: string
}

/** Quién responde por el hecho. `uid` obligatorio salvo origen externo. */
export interface AutorHecho {
  readonly uid: string
  readonly nombre?: string
  readonly rol?: 'medico' | 'enfermeria' | 'laboratorio' | 'sistema'
}

/** Procedencia: union discriminada, sin variante «todo opcional». */
export type ProcedenciaHecho =
  | { readonly origen: 'humano'; readonly autor: AutorHecho; readonly registradoEn: string }
  | { readonly origen: 'ia'; readonly autor: AutorHecho; readonly registradoEn: string
      readonly modelo: string; readonly promptVersion: string
      readonly apiVersion?: string; readonly retrieverVersion?: string
      readonly knowledgeVersion?: string; readonly revisadoPorHumano: boolean }
  | { readonly origen: 'motor'; readonly registradoEn: string
      /** id del motor en CLINICAL_ENGINE_REGISTRY. */ readonly engineId: string
      readonly engineVersion: string }
  | { readonly origen: 'externo'; readonly registradoEn: string
      readonly sistema: string; readonly mensajeId?: string }

/** Un hecho clínico atómico. Inmutable: corregir = anexar otro con `supersedes`. */
export interface ClinicalFact {
  readonly id: string
  readonly clinicId: string
  readonly pacienteId: string
  readonly concepto: ConceptoRef
  readonly valor: ValorClinico
  readonly estado: EstadoHecho
  readonly certeza: CertezaHecho
  readonly fuente: FuenteHecho
  readonly procedencia: ProcedenciaHecho
  /** ISO — cuándo ocurrió/se observó en el mundo (NO cuándo se capturó). */
  readonly observedAt: string
  /** Vigencia clínica. `validTo` ausente = sigue vigente (lo resuelve E1-05). */
  readonly validFrom?: string
  readonly validTo?: string
  /** id del hecho que ESTE reemplaza, con qué efecto (semántica de hospital.ts:199). */
  readonly supersedes?: { readonly factId: string; readonly efecto: EfectoCorreccion; readonly motivo?: string }
}
```

**Cada campo tiene UN trabajo, y eso es deliberado** (si se solapan, E1-05 y E1-08 heredan la ambigüedad):

| Campo | Pregunta que responde | Quién lo consume |
|---|---|---|
| `estado` | ¿en qué punto de su ciclo está el REGISTRO? | E1-04 (persistencia) |
| `certeza` | ¿qué tan verdadero es el CONTENIDO? | E1-08 (conflictos), E3 |
| `validFrom/validTo` | ¿en qué ventana fue verdad en el MUNDO? | E1-05 (vigencia) |
| `observedAt` vs `procedencia.registradoEn` | bitemporalidad: cuándo pasó vs cuándo se supo | E1-06 (basales) |
| `supersedes` | ¿qué hecho anterior corrige y cómo? | E1-05, E1-08 |

### 3.2 Casos negativos de COMPILACIÓN (verificados hoy)

Ejecutados contra `node_modules/.bin/tsc` con un archivo `.tipos.ts` real; los `@ts-expect-error` quedaron **consumidos** (si dejaran de serlo, `tsc` emite `TS2578` y tumba `tsc` **y** `next build`).

| # | Intento | Resultado |
|---|---|---|
| C-1 | Fabricar una cantidad a mano: `const q: CualquierCantidad = { valor: 5, unidad: 'mg', dimension: 'masa' }` | **Rechazado** (falta la marca fantasma, no exportada) |
| C-2 | `cantidad(v as number, crudo.unidad, crudo.dimension)` con campos `unknown` | **Rechazado** |
| C-3 | `{ clase: 'cantidad', cantidad: 5 }` — número sin unidad | **Rechazado** |
| C-4 | `{ clase: 'numero', valor: 5 }` — inventar una variante sin unidad | **Rechazado** (union cerrada) |
| C-5 | `{ clase: 'cantidad', cantidad: mg(5) }` | **Compila** (control positivo) |

Pendientes de escribir en la implementación, mismo patrón: hecho sin `procedencia`; hecho sin `unidad` dentro de la cantidad; `supersedes` con `efecto` fuera de `EfectoCorreccion`; `ProcedenciaHecho` variante `ia` sin `modelo`.

### 3.3 Casos negativos de RUNTIME (verificados hoy con zod 4.4.3)

Ejecutados con el zod instalado (`node -e`), no con la documentación:

| # | Entrada | Esperado | Verificado |
|---|---|---|---|
| R-1 | cantidad **sin** `unidad` | falla `invalid_type` | ✅ |
| R-2 | `unidad: ''` | falla (`.min(1)`) | ✅ |
| R-3 | `unidad: 'mL'` con `dimension: 'masa'` | falla `custom` — **cruce de campos**, no basta con «hay un string» | ✅ |
| R-4 | `dimension` fuera del catálogo | falla `custom` | ✅ (misma vía) |
| R-5 | llave extra colada al lado del valor (`{clase:'texto', texto:'…', unidad:'mg'}`) | falla | ✅ con `z.strictObject` (con `z.object` la llave se **descarta en silencio**) |
| R-6 | union discriminada por `clase` | selecciona la variante correcta | ✅ |
| R-7 | `procedencia: {}` | debe fallar | por construcción: union discriminada por `origen`, sin variante vacía |
| R-8 | `procedencia: { origen: 'ia', modelo: '' }` | debe fallar | `.min(1)` en cada string obligatorio |
| R-9 | `{ clase: 'texto', texto: '135' }` | **debe fallar** | `refine`: `num(texto) !== null` ⇒ un número no viaja disfrazado de texto |
| R-10 | `{ clase: 'texto', texto: '120/80' }` | debe **pasar** | `num('120/80') === null` (es texto de verdad) |

**R-5 y R-9 son los que evitan que la aceptación sea decorativa.** Sin `strictObject`, un productor puede adjuntar `unidad` al lado de un texto y creer que el hecho «tiene unidad». Sin R-9, cualquier número entra sin unidad por la puerta del texto.

### 3.4 El hallazgo que cambia el alcance: la invarianza de E0-04 cierra la puerta al parser

Verificado hoy con el compilador real. Esto **no compila**:

```ts
function parsear(v: number, u: string, d: string): CualquierCantidad | null {
  if (!(d in FACTORES)) return null
  const dim = d as Dimension
  if (!(u in (FACTORES[dim] as Record<string, number>))) return null
  return cantidad(v, u as UnidadDe<typeof dim>, dim)   // ← error
}
```

```
src/__tests__/tipos/_scratch_e1_01.ts(24,3): error TS2322:
Type 'ClinicalQuantity<keyof UnidadesPorDimension>' is not assignable to type 'CualquierCantidad | null'.
```

Es el **precio buscado** de la marca invariante de E0-04 (`clinical-quantity.ts:105-119`), no un bug. Pero tiene una consecuencia que ninguna unidad había registrado: **desde fuera del módulo, validar una cantidad en tiempo de ejecución obliga a una aserción**. Las tres salidas posibles, todas comprobadas:

| Salida | Compila | Por qué se elige o se descarta |
|---|---|---|
| `cantidad(...) as CualquierCantidad` en cada consumidor | sí | **DESCARTADA.** Reparte aserciones por todo el código; es la vía por la que la protección de E0-04 se erosiona sin que ningún test se ponga rojo. |
| Helper genérico distributivo (`CantidadDe<D>`) en `clinical-fact.ts` | sí | **DESCARTADA.** Compila, pero esconde la misma aserción en un tipo condicional y la saca del módulo que la posee. |
| **`parsearCantidad()` DENTRO de `src/types/clinical-quantity.ts`** | sí | **ELEGIDA.** El módulo ya declara que la aserción «es inevitable y está CONFINADA aquí» (`:196-203`, función `crear`). Es una función **aditiva**, sin consumidores previos, y deja una sola puerta de entrada para datos `unknown`. |

Firma propuesta (aditiva, en `src/types/clinical-quantity.ts`):

```ts
/**
 * Única puerta de entrada para datos del EXTERIOR (Firestore, HL7, formulario),
 * donde unidad y dimensión son `unknown`. Devuelve null si la dimensión no existe,
 * si la unidad no pertenece a ESA dimensión, o si el valor no es finito.
 * NUNCA adivina la dimensión a partir de la unidad.
 */
export function parsearCantidad(valor: unknown, unidad: unknown, dimension: unknown): CualquierCantidad | null
```

**Nota anti-deriva:** `parsearCantidad` **no** debe inferir la dimensión desde la unidad. `'%'` es `fraccion`, pero `'mL/min'` podría tentar a alguien a mapear `mL/min/1.73m²`; E0-04 separó esas dimensiones justamente porque no hay factor entre ellas (`clinical-quantity.ts:56-64`). Se exige que el productor declare la dimensión.

---

## 4. Contrato del módulo

### 4.1 `src/types/clinical-fact.ts` — tipos puros

Exporta los tipos de §3.1 más:

```ts
/** ¿El hecho es apto para alimentar un motor determinista? */
export function esUsableParaCalculo(f: Pick<ClinicalFact, 'estado' | 'certeza' | 'valor'>): boolean
```

Espejo deliberado de `esUsableParaCalculo` en `src/types/uci.ts:107`, con la misma política: sólo `certeza === 'confirmed' | 'inferred'` y `estado !== 'anulado'`. **No se inventa criterio**: se copia el que ya rige en UCI, citado en el comentario.

**Sin `import { z }`**: este archivo lo importará la UI (E1-09) y no debe arrastrar zod al bundle de cliente. Sí importa `@/types/clinical-quantity` y `@/types/uci` (ambos client-safe).

### 4.2 `src/lib/clinical-fact/schema.ts` — validación

```ts
export const ClinicalFactSchema: z.ZodType<ClinicalFact>   // strictObject en todos los niveles
export function parsearHecho(x: unknown): { ok: true; hecho: ClinicalFact } | { ok: false; errores: string[] }
```

- `ClinicalFactSchema` produce un `ClinicalFact` **ya construido**: la variante `cantidad` pasa por `.transform()` → `parsearCantidad()` → `ctx.addIssue({code:'custom'}) / z.NEVER` cuando la unidad no pertenece a la dimensión (patrón verificado en §3.3).
- `parsearHecho` nunca lanza y **nunca rellena** un campo ausente con un default. Un hecho incompleto **no existe**; no se degrada a uno plausible. (Es la lección ya escrita en `types/expediente.ts:66-77` sobre `Alergia`: «un tipo que obliga a rellenar es un tipo que obliga a inventar».)

**Por qué `src/lib/clinical-fact/` y no `src/lib/clinical/`:** `src/lib/clinical/` es territorio del Clinical Engine Registry y de su trinquete de ADRs (E0-03, `adr-cobertura.ts`, `DEUDA_ADR_CONGELADA = 52`). Este esquema **no es un motor clínico** —no calcula, no decide, no tiene umbrales—; meterlo ahí invita a que un gate futuro lo reclame como motor sin ADR y ponga el CI en rojo por una clasificación equivocada. Mismo criterio que tomó E0-04 (`RESULTADO.json` → decisión D4).

### 4.3 Fixtures

`src/__tests__/fixtures/clinical-facts.ts`: pacientes **ficticios** (`pac_demo_1`, `clinic_demo`), sin PHI. Cubren las cuatro variantes de valor, las cuatro de procedencia, un hecho corregido (`supersedes`) y un hecho con `validTo`.

---

## 5. Archivos que se tocan

| Archivo | Acción | Riesgo |
|---|---|---|
| `src/types/clinical-fact.ts` | **NUEVO** (~180 líneas) | Nulo: nace sin importadores |
| `src/lib/clinical-fact/schema.ts` | **NUEVO** (~150 líneas) | Nulo: nace sin importadores |
| `src/types/clinical-quantity.ts` | **MODIFICADO**: +1 export `parsearCantidad` (~20 líneas) | Bajo: aditivo puro; el módulo sigue sin consumidores de producción (E0-05 no se ha ejecutado) |
| `src/__tests__/clinical-fact.test.ts` | **NUEVO** (~30 casos de runtime) | — |
| `src/__tests__/tipos/clinical-fact.tipos.ts` | **NUEVO** (~9 casos `@ts-expect-error`) | — |
| `src/__tests__/fixtures/clinical-facts.ts` | **NUEVO** (datos sintéticos) | — |
| `docs/roadmap/nexus-os/{estado.json,CHECKPOINT.md,unidades/E1-01/*}` | checkpoint del programa | — |

**Archivos de producción modificados: 1**, y es el módulo aún sin consumidores que esta misma etapa introdujo. **No se toca**: ninguna ruta de API, componente, `firestore.rules`, `storage.rules`, impresión, PDF, Word, firma, cobros, ni `src/types/uci.ts` / `expediente.ts` / `hospital.ts`.

---

## 6. Qué lo prueba

**Compilación** (`src/__tests__/tipos/clinical-fact.tipos.ts`, no lo corre vitest — lo verifican `tsc` y `next build`, patrón de E0-04):
C-1…C-5 de §3.2 más: hecho sin `procedencia`; `procedencia` `ia` sin `modelo`; `supersedes.efecto` inválido; cantidad construida a mano dentro de un hecho.

**Runtime** (`src/__tests__/clinical-fact.test.ts`, ~30 casos en 6 bloques):
1. **Aceptación literal** — R-1…R-4: sin unidad / unidad vacía / unidad ajena a la dimensión ⇒ **no valida**; sin procedencia / procedencia vacía / procedencia incompleta ⇒ **no valida**.
2. **Anti-vaciamiento** — R-5, R-9, R-10: llave extra descartada ⇒ falla; número disfrazado de texto ⇒ falla; `'120/80'` ⇒ pasa.
3. **Ida y vuelta a Firestore** — `JSON.parse(JSON.stringify(hecho))` vuelve a validar y la cantidad conserva valor+unidad+dimensión (la marca es fantasma: **no existe en runtime**, verificado).
4. **`parsearCantidad`** — la unidad debe pertenecer a la dimensión declarada; nunca se infiere la dimensión desde la unidad; valor no finito ⇒ `null` (nunca 0).
5. **`esUsableParaCalculo`** — `unknown`/`suspected`/`negated`/`conflicting` y `estado: 'anulado'` NO alimentan un motor.
6. **Guardián de cobertura (§8.2)** — test que fija **qué unidades del repo hoy NO son expresables** y falla si el hueco crece en silencio.

**Por qué estos tests fallan sin el cambio:** los de runtime ejercitan módulos que no existen. El que de verdad prueba la unidad es el archivo `.tipos.ts`: sus `@ts-expect-error` sólo pasan si el compilador **rechaza de verdad** cada caso; si dejara de rechazarlo, `TS2578` tumba `tsc` y `build`. **Control negativo a ejecutar en la implementación** (obligatorio, como en E0-04): sustituir `z.strictObject` por `z.object` y comprobar que R-5 se pone rojo; quitar el `refine` de R-9 y comprobar que el número disfrazado de texto pasa.

---

## 7. Riesgo de regresión REAL

**7.1 Sobre producción: nulo.** Tres archivos nuevos sin importadores y una función aditiva en un módulo que hoy nadie importa fuera de sus tests (`grep` de importadores de `clinical-quantity` = sólo `src/__tests__/`). Ninguna pantalla, cálculo ni bundle cambia.

**7.2 Sobre E0-04: bajo, pero real y vigilado.** `parsearCantidad` es la primera función del módulo que acepta `unknown`. Su modo de fallo peligroso sería **inferir la dimensión** desde la unidad; el diseño lo prohíbe explícitamente y el test 4 lo fija. Los tests existentes de E0-04 (`clinical-quantity.test.ts`) **no se modifican**: recorren `FACTORES` dinámicamente, así que una función nueva no los altera.

**7.3 Sobre el trinquete de ADRs de E0-03: nulo si se respeta §4.2.** El nuevo código va a `src/lib/clinical-fact/`, fuera del territorio del registro de motores. No sube `DEUDA_ADR_CONGELADA`.

**7.4 Rojo PREEXISTENTE que el implementador va a encontrar (NO lo causa E1-01).** Hoy, con el árbol limpio:

```
npx vitest run src/__tests__/  →  180 archivos · 2164 casos · 1 FALLO
  src/__tests__/clinical-registry-adr.test.ts: "ADR sin motor que lo reclame"
  + [ "PREGUNTAS-ABIERTAS-2026-07-29.md" ]
```

Una corrida anterior creó `docs/clinical-decisions/PREGUNTAS-ABIERTAS-2026-07-29.md` y no lo declaró en `DOCS_NO_ADR` (`src/lib/clinical/adr-cobertura.ts:56-63`). Es **el mismo incidente que E0-04 documentó** como `reparacionForzadaAjena`. El arreglo es una línea —añadir ese nombre a la lista, exactamente lo que el mensaje del propio test indica— y **debe registrarse como reparación ajena**, no colarse como parte de E1-01. Si no se arregla, E1-01 no puede declarar el gate `vitest` en verde.

**7.5 Deuda heredada declarada:** el límite `E0-04-L1` (la marca indexa por dimensión, no por unidad, así que un spread puede cambiar `unidad` sin cambiar el valor) **sigue abierto**. E1-01 no lo agrava —los hechos se construyen por `parsearHecho`/`parsearCantidad`, nunca por spread— pero tampoco lo cierra. Su cierre sigue asignado a E0-05.

---

## 8. Validación clínica

**`necesitaValidacionClinica: false`** — coincide con el backlog. E1-01 **no define ni un umbral, ni una dosis, ni una regla clínica**: define la forma de un dato. Los cuatro vocabularios que usa se copian de sitios donde ya estaban decididos (§2), no se redecide ninguno.

### 8.1 Preguntas para el Dr. — **NO bloquean** la implementación

1. **¿Un mismo hecho puede tener dos certezas a la vez** (p. ej. `historical` + `suspected`: un antecedente que además es sospecha)? Hoy `ClinicalTruthStatus` es un valor único y E1-01 lo respeta. Si la respuesta es sí, es un cambio de forma en E1-08 (conflictos), no aquí.
2. **`estado: 'preliminar'` para labs no validados por el laboratorio**: ¿el grafo debe mostrarlos o esconderlos hasta el `final`? E1-01 los **representa**; quién los muestra lo decide E1-07/E1-09. Hoy `hl7/v2.ts:112` emite todo como `status: 'final'`.
3. **B1 del 28-jul dice «laboratorio → LOINC, unidades → UCUM».** E1-01 deja `codigo` opcional y **no** guarda UCUM en el hecho: la traducción a UCUM ya vive en la frontera FHIR (`fhir/recursos.ts:103,116`). ¿Se confirma que UCUM es asunto de exportación y no del almacenamiento? (Si debiera guardarse, es un campo más en E1-02, no un rediseño.)

### 8.2 NEEDS_CLINICAL_REVIEW diferido — hueco de cobertura de unidades (**bloqueante para E1-03, no para E1-01**)

Medido contra el repo, no estimado:

| Fuente | Expresables hoy con `ClinicalQuantity` | NO expresables |
|---|---|---|
| `SignosVitales` (`types/expediente.ts:86-100`) | 3 / 11 — `peso` (kg), `spo2` (%), `glucometria` (mg/dL) | `fc` (lpm), `fr` (rpm), `temperatura` (°C), `talla` (cm), `imc` (kg/m²), `glasgow` (puntos), `escalaDolor` (puntos), `ta` (**compuesta** «120/80») |
| `ANALITOS` (`laboratorio/analitos.ts`) | 18 / 24 | `U/L` (3 analitos), `10³/µL` (2), `µUI/mL` (1) |

Tres decisiones que **no se toman en E1-01**:

- **Temperatura.** E0-04 excluyó `°C` a propósito y dejó un test guardián (`clinical-quantity.test.ts:221-223`: «no hay dimensión de temperatura: °C↔°F es afín, no un factor»). Añadir `temperatura: '°C'` como dimensión **de una sola unidad** no reintroduce el problema afín (no hay dos unidades entre las que convertir), pero **obliga a reescribir ese guardián**. Reescribir un candado ajeno de puntillas es exactamente lo que la carta operativa manda no hacer a ciegas: va como unidad aparte, con el invariante afinado a «ninguna dimensión contiene `°C` y `°F` a la vez».
- **Cuentas y actividad enzimática** (`10³/µL`, `U/L`, `µUI/mL`): dimensiones nuevas de una sola unidad; aditivo y sin criterio clínico, pero es ampliación de catálogo y le corresponde a quien tenga productores (E1-03).
- **Presión arterial compuesta** (`120/80`): **no es un hecho**, son dos (sistólica y diastólica), como ya hace `fhir/recursos.ts:111-118` con sus dos `component`. Es decisión del proyector E1-03; E1-01 no la prejuzga.

**Mientras tanto, el comportamiento seguro está garantizado:** un dato cuya unidad no está en el catálogo **no puede construirse como hecho numérico**, y tampoco puede colarse como texto (R-9). Es decir: falla ruidosamente en vez de perder la unidad. Queda fijado por el test del bloque 6 y debe anotarse en `estado.json → necesitaValidacionDelDr` como **prerrequisito de E1-03**.

---

## 9. Definición de «terminado» para E1-01

1. `npx tsc --noEmit` → exit 0 con **todos** los `@ts-expect-error` de `clinical-fact.tipos.ts` consumidos.
2. `npx vitest run src/__tests__/` → verde, ≈2164 + ~30 casos, **sin regresiones** (requiere resolver el rojo ajeno de §7.4 y declararlo como tal).
3. `npm run build` → exit 0.
4. **Control negativo ejecutado y documentado**: `strictObject`→`object` pone R-5 en rojo; quitar el `refine` de R-9 deja pasar el número disfrazado de texto.
5. `git diff --stat` muestra **exactamente** los 6 archivos de §5 (+ los de checkpoint) y **un solo** archivo de producción tocado, aditivo.
6. `unidades/E1-01/RESULTADO.json` escrito **en el mismo commit** que cierra la unidad (regla operativa del 29-07), con §8.2 copiado a `necesitaValidacionDelDr`.
