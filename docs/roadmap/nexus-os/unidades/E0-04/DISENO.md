# E0-04 — ClinicalQuantity: tipo con unidad obligatoria (núcleo) · DISEÑO

> **Estado:** diseño **verificado con el compilador real** (TypeScript 5.9.3 del propio repo). NO implementado. En esta unidad no se tocó una sola línea de código de producción.
> **Etapa:** E0 (hardening). **Riesgo declarado en backlog:** medio. **Riesgo real de este cambio tal como está diseñado:** bajo (ver §7). **Dependencias:** ninguna. **Habilita:** E0-05 (migración de motores críticos, riesgo alto).

---

## 0. Resumen ejecutivo

La aceptación de E0-04 es una sola frase: **«el compilador rechaza operar cantidades de unidades incompatibles»**. Es una aceptación *falsable*, y la falsé antes de diseñar.

**Hallazgo principal — el diseño obvio NO cumple la aceptación.** El tipo intuitivo `{ valor, unidad, dimension }` con genérico `ClinicalQuantity<D>` **compila sin error** al sumar mg con mL y al comparar mg/dL con µmol/L, porque TypeScript infiere el genérico como la **unión** de ambas dimensiones y ambos argumentos encajan. Lo comprobé con `tsc` (control negativo en §3.3): dos de los cinco casos negativos —justo los dos que el objetivo del backlog cita textualmente— pasaban en silencio.

La corrección es una **marca invariante** (`readonly [MARCA]: (d: D) => D`) que vuelve el genérico invariante en `D` e impide el ensanchamiento a unión. Con ella, los cinco casos negativos fallan la compilación y los positivos siguen compilando (`exit 0`, §3.2).

**Cambio propuesto: 3 archivos nuevos, 0 archivos de producción modificados.** La migración de motores es E0-05, deliberadamente fuera de esta unidad.

---

## 1. Qué pide la unidad (backlog literal)

| Campo | Valor |
|---|---|
| Objetivo | Tipo algebraico `{valor, unidad, sistema}` que impida sumar mg con mL o comparar mg/dL con µmol/L |
| Entregables | `types/clinical-quantity.ts` · conversiones seguras · tests |
| Aceptación | El compilador rechaza operar cantidades de unidades incompatibles |
| Depende | — |
| Riesgo | medio |
| validacionClinica | false |

**Nota sobre el nombre `sistema`.** El backlog dice `{valor, unidad, sistema}`. En el diseño ese tercer campo se llama **`dimension`**, no `sistema`, y es una decisión consciente: lo que hace falta para bloquear `mg + mL` es la **dimensión física** (masa vs. volumen), no el sistema de medida (SI vs. convencional). «Sistema» sería un campo distinto y *no* separaría mg de mL, que son ambos del SI. Se documenta aquí para que el cambio de nombre no se lea como deriva.

---

## 2. Qué existe YA en el repo (no rehacer)

El repo **ya sabe que el bug de unidades es su riesgo número uno**. Lo que no tiene es un tipo que lo impida; lo resuelve hoy con guardas de rango en tiempo de ejecución, motor por motor.

| Pieza existente | Dónde | Qué hace y qué le falta |
|---|---|---|
| Guarda de unidad de creatinina | `src/lib/expediente/funcion-renal.ts:44-45` (`CREAT_MGDL_MAX = 25`, `CREAT_MGDL_MIN = 0.1`) y `:53` (`creatininaPlausibleMgDl`) | Detecta *a posteriori* que un número «parece µmol/L». Es una **heurística de rango**, no una prueba: una creatinina de 20 µmol/L (0.23 mg/dL, valor real de un paciente sano) cae dentro de `[0.1, 25]` y **pasa la guarda** como si fuera 20 mg/dL. El tipo lo haría imposible de expresar. |
| Mismo patrón duplicado en el copiloto | `src/lib/expediente/copiloto.ts:258-265` | Repite la advertencia «¿µmol/L?» con su propio texto. Dos sitios que hay que recordar actualizar. |
| Conversión mg/dL→mmol/L de colesterol | `src/lib/expediente/prevent.ts:21` (`const MMOL = 38.67`), usada en `:55-56` | Constante **privada del módulo**, sin unidad en el tipo. Nada impide que otro motor la copie con otro valor. |
| Unidades ya como *tipos literales* | `src/lib/uci/infusiones.ts:25` (`export type UnidadDosis = 'µg/kg/min' \| 'µg/min' \| 'U/min'`), `:27` y `:33` (`unidadConc: 'µg/mL' \| 'U/mL'`) | **Precedente directo del repo**: el motor más safety-critical ya modela la unidad como unión de literales. Le falta el vínculo valor↔unidad: `dosis` sigue siendo un `number` suelto. |
| Unidad como `string` libre | `src/lib/expediente/laboratorio/analitos.ts:26` (`unidad: string`), con `min`/`max` (`:28-29`) como cortafuegos de unidad | Documenta la unidad esperada pero no la impone. El comentario del encabezado (`:20-22`) dice explícitamente que `min/max` existen «para descartar valores que vienen en otra unidad». |
| Campo `unidades` del registro de motores | `src/lib/clinical/registry.ts:28` (`/** Unidad canónica que el motor espera (safety-critical: evita el bug de escala). */ unidades: string`) | Es **prosa**: `'creatinina mg/dL; edad años; sexo'`. Auditable por un humano, invisible para el compilador. E0-04 es la pieza que le da dientes. |
| Coerción numérica única | `src/lib/uci/num.ts` (14 módulos la importan) | Precedente de «una sola fuente de verdad para leer números». `ClinicalQuantity` es su equivalente para *unidades*, y se apoya en él (§4.4). |
| Gates de CI | `.github/workflows/ci.yml:23-28` | Corre `tsc --noEmit`, `vitest run` y `next build` en push a `main` y en cada PR. **Es la pieza que convierte «el compilador rechaza» en un gate real, sin tocar CI.** |
| `@ts-expect-error` ya usado | `src/__tests__/permissions-i18n-branches.test.ts:48` | Patrón ya aceptado en el repo. `eslint.config.mjs` no lo prohíbe, y lint **no** es gate de CI (`ci.yml:29-30`). |

**Conclusión de la exploración:** no hay ningún módulo de cantidades/unidades que rehacer. Hay **cuatro guardas de rango dispersas** que hoy compensan su ausencia, y que E0-05 podrá reemplazar (no borrar: quedan como defensa en profundidad para datos que entran del exterior).

---

## 3. La parte falsable: qué rechaza el compilador (verificado)

### 3.1 El tipo

```ts
/** Catálogo cerrado: dimensión → unidades legales de esa dimensión. */
export interface UnidadesPorDimension {
  masa:                     'kg' | 'g' | 'mg' | 'µg'
  volumen:                  'L' | 'dL' | 'mL'
  tiempo:                   'd' | 'h' | 'min' | 's'
  sustancia:                'mol' | 'mmol' | 'µmol'
  concentracion_masa:       'g/dL' | 'mg/dL' | 'mg/L' | 'µg/mL'
  concentracion_sustancia:  'mol/L' | 'mmol/L' | 'µmol/L'
  concentracion_equivalente:'mEq/L'
  presion:                  'mmHg' | 'kPa' | 'cmH2O'
  depuracion:               'mL/min' | 'mL/min/1.73m²'
  tasa_volumen:             'mL/h'
  tasa_dosis_peso:          'µg/kg/min' | 'mg/kg/min' | 'mg/kg/día' | 'mg/kg/dosis'
  tasa_dosis:               'µg/min' | 'mg/día' | 'U/min'
  fraccion:                 '%' | 'fracción'
}
export type Dimension = keyof UnidadesPorDimension
export type UnidadDe<D extends Dimension> = UnidadesPorDimension[D]

declare const MARCA: unique symbol   // NO exportado: nadie puede fabricar el objeto a mano

export interface ClinicalQuantity<D extends Dimension> {
  readonly valor: number
  readonly unidad: UnidadDe<D>
  readonly dimension: D
  /**
   * Marca INVARIANTE. Sin esta línea el tipo NO cumple la aceptación de E0-04:
   * TypeScript ensancha D a la unión de las dimensiones y `sumar(mg, mL)` compila.
   * Verificado con control negativo (E0-04 §3.3). No borrar sin repetir esa prueba.
   */
  readonly [MARCA]: (d: D) => D
}
```

Dos propiedades del diseño, ambas deliberadas:

- **`MARCA` no se exporta** ⇒ desde fuera del módulo es imposible escribir un literal `{ valor: 5, unidad: 'mg', dimension: 'masa' }` y hacerlo pasar por cantidad. **La única puerta de entrada es la fábrica `cantidad()`**, que es donde vive la validación.
- **La marca es una función de `D` a `D`** ⇒ `D` aparece en posición contravariante y covariante a la vez, lo que fuerza **invarianza**. Ese es el mecanismo que produce el rechazo.

### 3.2 Los cinco casos negativos que DEBEN fallar (ejecutados)

Prototipo compilado con el `tsc` del propio repo (`node_modules/.bin/tsc`, 5.9.3, `strict: true`):

| # | Caso | Resultado |
|---|---|---|
| 1 | `sumar(mg, mL)` — sumar masa con volumen | **rechazado** |
| 2 | `comparar(creat_mgdL, creat_µmolL)` — comparar concentración de masa con concentración de sustancia | **rechazado** |
| 3 | `convertir(mg, 'mL')` — convertir a una unidad de otra dimensión | **rechazado** |
| 4 | `cantidad(5, 'mL', 'masa')` — unidad que no pertenece a la dimensión declarada | **rechazado** |
| 5 | `sumar(mg, 500)` — número crudo donde se exige una cantidad | **rechazado** |
| ✔ | `sumar(mg, cantidad(250,'g','masa'))` y `convertir(creat_mgdL, 'mg/L')` | **compilan** |

`tsc -p … → exit 0` con los cinco `@ts-expect-error` **consumidos** (si alguno dejara de errar, TS emite `TS2578 Unused '@ts-expect-error' directive` y **rompe el CI**). Ese es literalmente el mecanismo de aceptación de la unidad.

Los casos 1 y 2 son, palabra por palabra, los dos ejemplos del objetivo del backlog.

### 3.3 Control negativo (por qué la marca no es adorno)

Repetí la compilación cambiando **solo** la marca invariante por una marca trivial (`readonly [MARCA]: true`), que es lo que produciría cualquiera al escribir este tipo «de forma natural»:

```
proto-sin-marca.ts(30,1): error TS2578: Unused '@ts-expect-error' directive.   ← caso 1: sumar(mg, mL) COMPILA
proto-sin-marca.ts(34,1): error TS2578: Unused '@ts-expect-error' directive.   ← caso 2: comparar(mg/dL, µmol/L) COMPILA
exit=2
```

**Sin la marca invariante, sumar mg con mL y comparar mg/dL con µmol/L pasan el compilador.** El diseño ingenuo habría entregado la unidad con la aceptación aparentemente cumplida (los otros 3 casos sí fallan) y el agujero exacto que la unidad existe para tapar, abierto. Por eso el comentario que prohíbe borrar esa línea va **en el código**, no solo aquí.

### 3.4 Escape ergonómico para colecciones heterogéneas (verificado, `exit 0`)

La invarianza tiene un precio: `ClinicalQuantity<'masa'>` **no** es asignable a `ClinicalQuantity<Dimension>`, así que no se puede tipar una lista mixta con el genérico abierto. Sin una salida, E0-05 no podría serializar ni mostrar cantidades de dimensiones distintas en una tabla. La salida es una unión distribuida:

```ts
/** Vista de solo lectura para almacenar, serializar o listar cantidades heterogéneas. */
export type CualquierCantidad = { [D in Dimension]: ClinicalQuantity<D> }[Dimension]
```

Comprobado: `const lista: CualquierCantidad[] = [mg, mL]` compila; `etiqueta(q: CualquierCantidad)` compila; el type-guard `esMasa(q): q is ClinicalQuantity<'masa'>` estrecha bien; y **asignar un `CualquierCantidad` donde se exige `ClinicalQuantity<'masa'>` sigue siendo error**. Es decir: la puerta de escape sirve para guardar y mostrar, no para colar una cantidad en un motor.

---

## 4. Contrato del módulo

### 4.1 Construcción (única puerta de entrada)

```ts
/** Construye una cantidad. La unidad DEBE pertenecer a la dimensión (comprobado por el compilador). */
export function cantidad<D extends Dimension>(valor: number, unidad: UnidadDe<D>, dimension: D): ClinicalQuantity<D>

/**
 * Igual que `cantidad`, pero desde un dato del mundo real (formulario, OCR, HL7, voz).
 * Devuelve `null` si el valor no es un número finito — NUNCA inventa un 0.
 * Se apoya en `num()` de src/lib/uci/num.ts (coma decimal mexicana, vacío→null).
 */
export function cantidadDesde<D extends Dimension>(v: unknown, unidad: UnidadDe<D>, dimension: D): ClinicalQuantity<D> | null
```

Atajos legibles para las dimensiones más usadas (azúcar sobre `cantidad`, sin lógica propia): `mg()`, `mL()`, `kg()`, `mgPorDl()`, `micromolPorL()`, `mmHg()`.

### 4.2 Operaciones (todas rechazan dimensiones distintas en compilación)

```ts
export function sumar<D extends Dimension>(a: ClinicalQuantity<D>, b: ClinicalQuantity<D>): ClinicalQuantity<D>
export function restar<D extends Dimension>(a: ClinicalQuantity<D>, b: ClinicalQuantity<D>): ClinicalQuantity<D>
export function comparar<D extends Dimension>(a: ClinicalQuantity<D>, b: ClinicalQuantity<D>): -1 | 0 | 1
export function escalar<D extends Dimension>(q: ClinicalQuantity<D>, k: number): ClinicalQuantity<D>
export function esMayor<D extends Dimension>(a: ClinicalQuantity<D>, b: ClinicalQuantity<D>): boolean
```

**Regla de implementación no negociable:** `sumar`, `restar` y `comparar` **convierten primero a la unidad canónica de la dimensión** y operan ahí. Sumar `1 g + 1 mg` sin normalizar daría `2`, que es el bug de escala con otro disfraz. El resultado se devuelve en la unidad del **primer** operando (regla fija y documentada, para que el resultado sea determinista y no dependa del orden de conversión).

### 4.3 Salida hacia el mundo (frontera explícita)

```ts
/** Extrae el número EN LA UNIDAD QUE SE EXIGE. Es la única forma legítima de salir del tipo. */
export function valorEn<D extends Dimension>(q: ClinicalQuantity<D>, unidad: UnidadDe<D>): number
/** Texto para nota, receta o pantalla: "1.2 mg/dL". */
export function formatear<D extends Dimension>(q: ClinicalQuantity<D>, decimales?: number): string
```

`valorEn` es deliberadamente **verbosa**: obliga a nombrar la unidad en el punto exacto donde el número vuelve a ser un `number` suelto. Cuando E0-05 migre CKD-EPI, la firma pasará a exigir `ClinicalQuantity<'concentracion_masa'>` y adentro hará `valorEn(creatinina, 'mg/dL')`. **Ahí es donde muere el bug de la creatinina en µmol/L**, y muere en compilación, no en una guarda de rango.

### 4.4 Conversiones seguras

**(a) Dentro de la misma dimensión — exactas, factores de definición, sin criterio clínico.**

```ts
export function convertir<D extends Dimension>(q: ClinicalQuantity<D>, a: UnidadDe<D>): ClinicalQuantity<D>
```

Tabla `FACTORES: { [D in Dimension]: Record<UnidadDe<D>, number> }` con el factor a la unidad canónica de cada dimensión (p. ej. masa→mg: `kg 1e6`, `g 1e3`, `mg 1`, `µg 1e-3`). Son definiciones del SI; **no hay nada que inventar ni que validar clínicamente**. La exhaustividad la exige el propio tipo mapeado: **añadir una unidad al catálogo sin darle factor no compila**.

- *Excluidas a propósito:* conversiones **afines** (°C↔°F) — no son un factor, romperían la forma de la tabla y ningún motor de E0-05 las necesita. Se difieren, y el catálogo **no incluye la dimensión temperatura** para no dejar un hueco silencioso.
- *`mmHg ↔ kPa`* (1 mmHg = 0.1333224 kPa) es una definición física, no clínica; entra con la cita en el encabezado.

**(b) Entre dimensiones (masa ↔ sustancia) — bloqueada salvo con analito y fuente.**

`mg/dL → µmol/L` **no es convertible en general**: depende de la masa molar del analito. El tipo ya prohíbe hacerlo por accidente (caso negativo 2). La conversión legítima es una función aparte que **exige el analito**:

```ts
export interface FactorMolar {
  analito: string
  /** mg/dL × factor = µmol/L */
  factorMgDlAMicromolL: number
  fuente: string          // de dónde sale el número, verificable
  usadoTambienEn?: string // archivo:línea del repo que YA usa este factor
}
export const FACTORES_MOLARES: Readonly<Record<string, FactorMolar>>
/** null si el analito NO está en el catálogo. NUNCA adivina una masa molar. */
export function aConcentracionSustancia(
  q: ClinicalQuantity<'concentracion_masa'>, analito: string,
): ClinicalQuantity<'concentracion_sustancia'> | null
```

**El catálogo arranca SOLO con los dos factores que ya existen en el repo**, para no introducir ni un número nuevo:

| Analito | Factor | Fuente en el repo |
|---|---|---|
| `creatinina` | mg/dL × 88.4 = µmol/L | comentario de `src/lib/expediente/funcion-renal.ts:42` («un valor en µmol/L (÷88.4)»), repetido en `copiloto.ts:265` |
| `colesterol` | mg/dL ÷ 38.67 = mmol/L | `src/lib/expediente/prevent.ts:21` (`const MMOL = 38.67`), en uso en `:55-56` |

Un test asegura que **el factor del catálogo es idéntico al que usa `prevent.ts`** (anti-deriva: si alguien cambia uno, el otro lo delata). Añadir un tercer analito exige la cita de su fuente en el ADR; **no se añade ninguno «de paso»**.

**(c) `mEq/L` no se convierte a `mmol/L` en esta unidad.** La equivalencia depende de la valencia del ion, y el repo usa mEq/L para Na⁺/K⁺/Cl⁻ (`analitos.ts:61-63`) donde el número coincide con mmol/L. Modelarlo como **dimensión propia sin conversión automática** es la opción que no inventa nada: quien necesite el puente lo escribirá explícitamente, con fuente, en su propia unidad de trabajo.

---

## 5. Archivos que se tocan

| Archivo | Acción | Por qué |
|---|---|---|
| `src/types/clinical-quantity.ts` | **NUEVO** (~230 líneas) | El núcleo: tipos, fábrica, operaciones, conversiones. Va en `src/types/` porque es lo que pide el entregable del backlog y porque **ese directorio ya aloja runtime**, no solo tipos (`src/types/uci.ts:96` `certezaAStatus`, `:107` `esUsableParaCalculo`). |
| `src/__tests__/tipos/clinical-quantity.tipos.ts` | **NUEVO** (~60 líneas) | Los casos negativos con `@ts-expect-error`. **No es un test de vitest: es el gate del compilador.** El nombre termina en `.tipos.ts`, que **no** empareja con `src/__tests__/**/*.test.ts` (`vitest.config.ts:6`) pero **sí** con `**/*.ts` de `tsconfig.json:26` ⇒ vitest lo ignora, `tsc --noEmit` y `next build` lo verifican. |
| `src/__tests__/clinical-quantity.test.ts` | **NUEVO** (~120 líneas) | Tests de runtime + el guardián del gate (§6). |
| `src/lib/clinical/registry.ts` | **NO se toca** | Registrar el módulo es materia de E0-03 (que además le añade campos). Tocarlo aquí crearía un conflicto entre dos unidades. |
| Motores clínicos (`funcion-renal`, `gasometria`, `infusiones`, `dosis`) | **NO se tocan** | Es E0-05, riesgo alto, con su propia validación. Mezclarlo aquí sería exactamente lo que prohíbe la regla 5 de la carta. |

**Ningún archivo existente se modifica.** El módulo nace sin un solo importador en producción.

---

## 6. Qué lo prueba

**Gate 1 — el compilador (es la aceptación literal).** `src/__tests__/tipos/clinical-quantity.tipos.ts` contiene los 5 casos negativos de §3.2 más 2 positivos. Si el tipo deja de rechazar algo, `tsc` emite `TS2578` y **el CI se cae** (`ci.yml:23`). Sin dependencias nuevas, sin `tsd`, sin `expect-type`.

**Gate 2 — guardián del gate** (patrón ya usado en el repo: `log-secrets-guard.test.ts`, `firestore-rules-guard.test.ts`): un test de vitest lee `clinical-quantity.tipos.ts` y afirma que el archivo existe y conserva **≥ 5** directivas `@ts-expect-error`. Cierra el hueco de que alguien «arregle» el CI borrando el archivo o comentando los casos. También afirma que `clinical-quantity.ts` conserva la línea de la marca invariante.

**Gate 3 — runtime** (`clinical-quantity.test.ts`):

1. `convertir` ida y vuelta es idempotente dentro de tolerancia (`1 kg → g → kg`).
2. **`sumar(1 g, 1 mg)` = 1001 mg y NO 2** — la prueba directa del bug de escala de §4.2.
3. `comparar(1 g, 1000 mg) === 0` — igualdad a través de unidades distintas.
4. El resultado se devuelve en la unidad del primer operando (regla determinista).
5. `cantidadDesde(' ', …)` y `cantidadDesde('abc', …)` ⇒ `null`; `cantidadDesde('12,5', …)` ⇒ 12.5 (contrato heredado de `num.ts`).
6. **Exhaustividad de `FACTORES`**: para cada dimensión y cada unidad del catálogo existe un factor finito y > 0 (recorrido en runtime, además del tipo mapeado).
7. `aConcentracionSustancia(q, 'analito-inexistente')` ⇒ `null` (no adivina masas molares).
8. **Anti-deriva:** el factor de colesterol del catálogo coincide con `MMOL = 38.67` de `prevent.ts:21`; el de creatinina, con el 88.4 citado en `funcion-renal.ts:42`.
9. Redondeo: `formatear` no altera el valor almacenado (el redondeo es de presentación, coherente con la política del registro, `registry.ts:44`).

**Línea base a preservar: 1947 tests en verde** (`estado.json` tras E0-02). E0-04 sólo suma.

---

## 7. Riesgo de regresión REAL

**Bajo.** No es la valoración cómoda: es lo que se deduce de que el cambio sea *aditivo puro*.

- **Cero importadores en producción.** Ninguna ruta, componente, motor clínico, PDF, receta, cobro o firma cambia de comportamiento. El bundle de cliente no crece: `clinical-quantity.ts` no lo importa nadie todavía, y los dos archivos de test viven bajo `src/__tests__/` (excluidos de `next build`).
- **Cero migraciones de datos.** No toca Firestore, ni hashes de integridad, ni el sello firmable. No entra en conflicto con las zonas que la carta operativa marca como delicadas (impresión, cobros, firma).
- **El backlog dice «medio» y tiene razón — pero el riesgo está en E0-05.** El peligro de `ClinicalQuantity` es el día que un motor en producción empiece a exigirlo. Esa es la unidad siguiente, declarada riesgo **alto**, y por eso este diseño no adelanta ni un motor.

**Los tres riesgos que sí existen, todos de compilación y todos visibles en el acto:**

1. **Falso gate.** Si el módulo se escribe sin la marca invariante, el CI queda verde y la protección no existe (§3.3). *Mitigación:* el control negativo está ejecutado y documentado, el comentario anti-borrado va en el código, y el Gate 2 vigila esa línea.
2. **El type-test rompe el build si se escribe mal.** Un `@ts-expect-error` sobrante tumba `tsc` **y** `next build`. Es el comportamiento deseado, pero obliga a que el archivo se escriba correcto de entrada. *Mitigación:* los 7 casos ya están compilados y verificados en el prototipo; se transcriben, no se improvisan.
3. **Ergonomía de la invarianza.** Un desarrollador que intente `ClinicalQuantity<Dimension>` chocará con un error confuso. *Mitigación:* `CualquierCantidad` (§3.4, verificado) + comentario que explique cuándo usar cada uno.

**Rollback:** borrar tres archivos nuevos. No hay estado que revertir.

---

## 8. Validación clínica

**No requerida para esta unidad** — coherente con `validacionClinica: false` del backlog, y sostenible por construcción:

- Los factores de conversión intra-dimensión son **definiciones del SI** (1 g = 1000 mg), no criterio médico.
- Los dos únicos factores molares **ya viven en el repo** y se copian con su cita (`funcion-renal.ts:42`, `prevent.ts:21`). **No se introduce ningún número clínico nuevo.**
- No se define ningún umbral, rango de referencia, dosis ni criterio de decisión. `ClinicalQuantity` no interpreta: sólo impide que un número viaje sin su unidad.
- Donde faltaba criterio (mEq/L ↔ mmol/L, °C ↔ °F), **la respuesta del diseño es no convertir**, no inventar un factor.

### Preguntas para el Dr. — **NO bloquean** la implementación

Son decisiones de *alcance*, no de contenido clínico. Con cualquiera de las dos respuestas, E0-04 se puede escribir tal cual está diseñada.

1. **¿Qué analitos deben tener conversión masa↔sustancia además de creatinina y colesterol?** (candidatos naturales por lo que ya se maneja en el repo: glucosa, urea/BUN, bilirrubina, calcio). Cada uno entra **sólo con su fuente citada**; hoy el catálogo arranca con dos y devuelve `null` para el resto, que es el comportamiento seguro.
2. **¿`mEq/L` debe poder convertirse a `mmol/L` automáticamente?** El diseño dice **no** (requiere valencia por ion). Si el Dr. quiere el puente para Na⁺/K⁺/Cl⁻, se hace en unidad aparte con la valencia declarada y su fuente.

---

## 9. Definición de «terminado» para E0-04

- [ ] `src/types/clinical-quantity.ts` con el tipo invariante, `cantidad`/`cantidadDesde`, `sumar`/`restar`/`comparar`/`escalar`, `convertir`, `valorEn`/`formatear`, `FACTORES`, `FACTORES_MOLARES` (2 entradas citadas) y `CualquierCantidad`.
- [ ] `src/__tests__/tipos/clinical-quantity.tipos.ts` con ≥ 5 `@ts-expect-error` consumidos.
- [ ] `src/__tests__/clinical-quantity.test.ts` con los 9 puntos de §6.
- [ ] `npx tsc --noEmit` en verde **y** demostración de que quitar la marca invariante lo pone en rojo (control negativo reproducido en el repo real).
- [ ] `npx vitest run` ≥ 1947 + nuevos, sin regresiones.
- [ ] `npm run build` en verde.
- [ ] Ningún archivo de producción modificado (`git diff --stat` sólo con los 3 archivos nuevos).
