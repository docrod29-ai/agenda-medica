# E0-04 — ClinicalQuantity: tipo con unidad obligatoria (núcleo) · DISEÑO

> **Estado:** diseño **verificado con el compilador real del repo** (`node_modules/.bin/tsc` 5.9.3, `strict`). NO implementado: en esta unidad no se tocó una sola línea de código de producción.
> **Etapa:** E0 (hardening). **Riesgo declarado en backlog:** medio. **Riesgo real del cambio tal como está diseñado:** bajo (§7). **Dependencias:** ninguna. **Habilita:** E0-05 (migración de motores, riesgo alto) y E1-01 (`ClinicalFact`).
> **Revisión 2 (2026-07-28, tras E0-03):** re-verificado contra el repo actual; citas de línea corregidas; añadido el caso negativo 6; añadida la §5-bis sobre la interacción con el **trinquete de ADRs** que E0-03 dejó instalado (es el único riesgo nuevo de CI); línea base de tests actualizada a **2051**.

---

## 0. Resumen ejecutivo

La aceptación de E0-04 es una sola frase: **«el compilador rechaza operar cantidades de unidades incompatibles»**. Es *falsable*, y se falsó antes de diseñar.

**Hallazgo principal — el diseño obvio NO cumple la aceptación.** El tipo intuitivo `{ valor, unidad, dimension }` con genérico `ClinicalQuantity<D>` **compila sin error** al sumar mg con mL y al comparar mg/dL con µmol/L: TypeScript infiere `D` como la **unión** de ambas dimensiones y los dos argumentos encajan. Control negativo ejecutado hoy (§3.3): tres de los seis casos negativos —incluidos **los dos que el objetivo del backlog cita textualmente**— pasaban en silencio.

La corrección es una **marca invariante** (`readonly [MARCA]: (d: D) => D`) que vuelve el genérico invariante en `D` e impide el ensanchamiento a unión. Con ella los seis casos negativos fallan la compilación y los positivos siguen compilando (`exit 0`, §3.2).

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

**Nota sobre el nombre `sistema`.** El backlog dice `{valor, unidad, sistema}`. Aquí ese tercer campo se llama **`dimension`**, y es una decisión consciente: lo que bloquea `mg + mL` es la **dimensión física** (masa vs. volumen), no el sistema de medida (SI vs. convencional) — mg y mL son ambos del SI, así que «sistema» no separaría nada. Se documenta para que el cambio de nombre no se lea como deriva.

---

## 2. Qué existe YA en el repo (no rehacer)

El repo **ya sabe que el bug de unidades es su riesgo número uno**. Lo que no tiene es un tipo que lo impida: hoy lo compensa con guardas de rango en tiempo de ejecución, motor por motor.

| Pieza existente | Dónde | Qué hace y qué le falta |
|---|---|---|
| Guarda de unidad de creatinina | `src/lib/expediente/funcion-renal.ts:45-46` (`CREAT_MGDL_MAX = 25`, `CREAT_MGDL_MIN = 0.1`) y `:53` (`creatininaPlausibleMgDl`) | Detecta *a posteriori* que un número «parece µmol/L». Es una **heurística de rango**, no una prueba: 20 µmol/L (= 0.23 mg/dL, valor de un paciente sano) cae dentro de `[0.1, 25]` y **pasa la guarda** como si fueran 20 mg/dL. Con el tipo, ese dato no sería expresable. |
| Mismo patrón duplicado en el copiloto | `src/lib/expediente/copiloto.ts:257-265` | Repite la advertencia «¿µmol/L?» con su propio texto y su propio 88.4 (`:265`). Dos sitios que hay que recordar actualizar. |
| Conversión mg/dL→mmol/L de colesterol | `src/lib/expediente/prevent.ts:21` (`const MMOL = 38.67`), usada en `:55-56` | Constante **privada del módulo**, sin unidad en el tipo. Nada impide que otro motor la copie con otro valor. |
| Unidades ya como *tipos literales* | `src/lib/uci/infusiones.ts:25` (`export type UnidadDosis = 'µg/kg/min' \| 'µg/min' \| 'U/min'`), `:27` y `:33` (`unidadConc: 'µg/mL' \| 'U/mL'`) | **Precedente directo del repo**: el motor más safety-critical ya modela la unidad como unión de literales. Le falta el vínculo valor↔unidad: `dosis` sigue siendo un `number` suelto. |
| Unidad como `string` libre | `src/lib/expediente/laboratorio/analitos.ts:26` (`unidad: string`) con `min`/`max` (`:28-29`) de cortafuegos | El encabezado (`:6-8`) dice explícitamente que `min/max` existen «para descartar valores que vienen en otra unidad». Documenta la unidad; no la impone. |
| Campo `unidades` del registro de motores | `src/lib/clinical/registry.ts:71` (`/** Unidad canónica que el motor espera (safety-critical: evita el bug de escala). */ unidades: string`) | Es **prosa**: `'creatinina mg/dL; edad años; sexo'` (`:106`). Auditable por un humano, invisible para el compilador. E0-04 es la pieza que le da dientes. |
| Coerción numérica única | `src/lib/uci/num.ts` (`num()`, coma decimal mexicana, vacío→`null`, nunca inventa 0) | Precedente de «una sola fuente de verdad para leer números». `ClinicalQuantity` es su equivalente para *unidades*, y se apoya en él (§4.1). |
| Tests de guarda de unidad ya en verde | `src/__tests__/guardas-unidad-clinica.test.ts` (creatinina 88 µmol/L rechazada; albúmina en g/L no corrige el anion gap) | Prueba que el problema es real y recurrente. **No se toca**: sigue siendo la defensa para datos que entran del exterior. |
| Gates de CI | `.github/workflows/ci.yml:22-27` (`npx tsc --noEmit`, `npx vitest run`, `npm run build`) en push a `main` y en cada PR | **Es la pieza que convierte «el compilador rechaza» en un gate real, sin tocar CI.** `next.config.ts` **no** trae `typescript.ignoreBuildErrors`, así que el build también typechea. |
| `@ts-expect-error` ya usado | `src/__tests__/permissions-i18n-branches.test.ts:48` | Patrón ya aceptado. `eslint.config.mjs` no lo prohíbe, y lint **no** es gate de CI (nota al pie de `ci.yml`). |

**Conclusión de la exploración:** no hay ningún módulo de cantidades/unidades que rehacer. Hay **cuatro guardas de rango dispersas** que hoy compensan su ausencia y que E0-05 podrá respaldar (no borrar: quedan como defensa en profundidad en la frontera con el exterior).

---

## 3. La parte falsable: qué rechaza el compilador (verificado hoy)

### 3.1 El tipo

```ts
/** Catálogo cerrado: dimensión → unidades legales de esa dimensión. */
export interface UnidadesPorDimension {
  masa:                      'kg' | 'g' | 'mg' | 'µg'
  volumen:                   'L' | 'dL' | 'mL'
  tiempo:                    'd' | 'h' | 'min' | 's'
  sustancia:                 'mol' | 'mmol' | 'µmol'
  concentracion_masa:        'g/dL' | 'mg/dL' | 'mg/L' | 'µg/mL'
  concentracion_sustancia:   'mol/L' | 'mmol/L' | 'µmol/L'
  concentracion_equivalente: 'mEq/L'
  presion:                   'mmHg' | 'kPa' | 'cmH2O'
  depuracion:                'mL/min' | 'mL/min/1.73m²'
  tasa_volumen:              'mL/h'
  tasa_dosis_peso:           'µg/kg/min' | 'mg/kg/min' | 'mg/kg/día' | 'mg/kg/dosis'
  tasa_dosis:                'µg/min' | 'mg/día' | 'U/min'
  fraccion:                  '%' | 'fracción'
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
   * Verificado con control negativo (DISENO §3.3). No borrar sin repetir esa prueba.
   */
  readonly [MARCA]: (d: D) => D
}
```

Dos propiedades deliberadas:

- **`MARCA` no se exporta** ⇒ desde fuera del módulo es imposible escribir `{ valor: 5, unidad: 'mg', dimension: 'masa' }` y hacerlo pasar por cantidad. **La única puerta de entrada es la fábrica `cantidad()`**, que es donde vive la validación.
- **La marca es una función de `D` a `D`** ⇒ `D` aparece en posición contravariante y covariante a la vez, lo que fuerza **invarianza**. Ese es el mecanismo que produce el rechazo.

### 3.2 Los seis casos negativos que DEBEN fallar (ejecutados hoy)

Prototipo compilado con el `tsc` del propio repo (5.9.3, `--strict --target ES2017 --module esnext --moduleResolution bundler`):

| # | Caso | Resultado |
|---|---|---|
| 1 | `sumar(mg, mL)` — sumar masa con volumen | **rechazado** |
| 2 | `comparar(creat_mgdL, creat_µmolL)` — concentración de masa vs. de sustancia | **rechazado** |
| 3 | `convertir(mg, 'mL')` — convertir a una unidad de otra dimensión | **rechazado** |
| 4 | `cantidad(5, 'mL', 'masa')` — unidad que no pertenece a la dimensión declarada | **rechazado** |
| 5 | `sumar(mg, 500)` — número crudo donde se exige una cantidad | **rechazado** |
| 6 | `sumar(mg, lista[0])` — colar un `CualquierCantidad` donde se exige `<'masa'>` | **rechazado** |
| ✔ | `sumar(mg, cantidad(250,'g','masa'))`, `convertir(creat_mgdL,'mg/L')`, `const lista: CualquierCantidad[] = [mg, mL, mgdl]`, `etiqueta(lista[0])` | **compilan** |

`tsc → exit 0` con los seis `@ts-expect-error` **consumidos**. Si alguno dejara de errar, TS emite `TS2578 Unused '@ts-expect-error' directive` y **rompe el CI**. Ese es literalmente el mecanismo de aceptación de la unidad.

Los casos 1 y 2 son, palabra por palabra, los dos ejemplos del objetivo del backlog.

### 3.3 Control negativo (por qué la marca no es adorno)

Misma compilación cambiando **solo** la marca invariante por una trivial (`readonly [MARCA]: true`), que es lo que sale de escribir este tipo «de forma natural»:

```
proto-sin-marca.ts(32,1): error TS2578: Unused '@ts-expect-error' directive.   ← caso 1: sumar(mg, mL) COMPILA
proto-sin-marca.ts(34,1): error TS2578: Unused '@ts-expect-error' directive.   ← caso 2: comparar(mg/dL, µmol/L) COMPILA
proto-sin-marca.ts(49,1): error TS2578: Unused '@ts-expect-error' directive.   ← caso 6: CualquierCantidad entra como masa
exit=2
```

**Sin la marca invariante, sumar mg con mL y comparar mg/dL con µmol/L pasan el compilador.** El diseño ingenuo habría entregado la unidad con la aceptación aparentemente cumplida (los otros 3 casos sí fallan) y el agujero exacto que la unidad existe para tapar, abierto. Por eso el comentario anti-borrado va **en el código**, no solo aquí, y por eso el Gate 2 (§6) vigila esa línea.

### 3.4 Escape ergonómico para colecciones heterogéneas (verificado)

La invarianza tiene un precio: `ClinicalQuantity<'masa'>` **no** es asignable a `ClinicalQuantity<Dimension>`, así que no se puede tipar una lista mixta con el genérico abierto. Sin salida, E0-05/E1-01 no podrían serializar ni listar cantidades de dimensiones distintas. La salida es una unión distribuida:

```ts
/** Vista de solo lectura para almacenar, serializar o listar cantidades heterogéneas. */
export type CualquierCantidad = { [D in Dimension]: ClinicalQuantity<D> }[Dimension]
```

Comprobado: `const lista: CualquierCantidad[] = [mg, mL, mgdl]` compila; `etiqueta(q: CualquierCantidad)` compila; y **asignar un `CualquierCantidad` donde se exige `ClinicalQuantity<'masa'>` sigue siendo error** (caso negativo 6). La puerta de escape sirve para guardar y mostrar, **no** para colar una cantidad en un motor.

---

## 4. Contrato del módulo

### 4.1 Construcción (única puerta de entrada)

```ts
/** Construye una cantidad. La unidad DEBE pertenecer a la dimensión (lo comprueba el compilador). */
export function cantidad<D extends Dimension>(valor: number, unidad: UnidadDe<D>, dimension: D): ClinicalQuantity<D>

/**
 * Igual que `cantidad`, pero desde un dato del mundo real (formulario, OCR, HL7, voz).
 * Devuelve `null` si el valor no es un número finito — NUNCA inventa un 0.
 * Se apoya en `num()` de src/lib/uci/num.ts (coma decimal mexicana, vacío→null).
 */
export function cantidadDesde<D extends Dimension>(v: unknown, unidad: UnidadDe<D>, dimension: D): ClinicalQuantity<D> | null
```

Atajos legibles para lo más usado (azúcar sobre `cantidad`, sin lógica propia): `mg()`, `mL()`, `kg()`, `mgPorDl()`, `micromolPorL()`, `mmHg()`.

### 4.2 Operaciones (todas rechazan dimensiones distintas en compilación)

```ts
export function sumar<D extends Dimension>(a: ClinicalQuantity<D>, b: ClinicalQuantity<D>): ClinicalQuantity<D>
export function restar<D extends Dimension>(a: ClinicalQuantity<D>, b: ClinicalQuantity<D>): ClinicalQuantity<D>
export function comparar<D extends Dimension>(a: ClinicalQuantity<D>, b: ClinicalQuantity<D>): -1 | 0 | 1
export function escalar<D extends Dimension>(q: ClinicalQuantity<D>, k: number): ClinicalQuantity<D>
export function esMayor<D extends Dimension>(a: ClinicalQuantity<D>, b: ClinicalQuantity<D>): boolean
```

**Regla de implementación no negociable:** `sumar`, `restar` y `comparar` **normalizan primero a la unidad canónica de la dimensión** y operan ahí. Sumar `1 g + 1 mg` sin normalizar daría `2`, que es el bug de escala con otro disfraz. El resultado se devuelve en la unidad del **primer** operando (regla fija y documentada, para que sea determinista y no dependa del orden de conversión).

### 4.3 Salida hacia el mundo (frontera explícita)

```ts
/** Extrae el número EN LA UNIDAD QUE SE EXIGE. Única forma legítima de salir del tipo. */
export function valorEn<D extends Dimension>(q: ClinicalQuantity<D>, unidad: UnidadDe<D>): number
/** Texto para nota, receta o pantalla: "1.2 mg/dL". */
export function formatear<D extends Dimension>(q: ClinicalQuantity<D>, decimales?: number): string
```

`valorEn` es deliberadamente **verbosa**: obliga a nombrar la unidad en el punto exacto donde el número vuelve a ser un `number` suelto. Cuando E0-05 migre CKD-EPI, la firma exigirá `ClinicalQuantity<'concentracion_masa'>` y adentro hará `valorEn(creatinina, 'mg/dL')`. **Ahí muere el bug de la creatinina en µmol/L**, y muere en compilación, no en una guarda de rango.

### 4.4 Conversiones seguras

**(a) Dentro de la misma dimensión — exactas, factores de definición, sin criterio clínico.**

```ts
export function convertir<D extends Dimension>(q: ClinicalQuantity<D>, a: UnidadDe<D>): ClinicalQuantity<D>
```

Tabla `FACTORES: { [D in Dimension]: Record<UnidadDe<D>, number> }` con el factor a la unidad canónica de cada dimensión (masa→mg: `kg 1e6`, `g 1e3`, `mg 1`, `µg 1e-3`). Son definiciones del SI; **no hay nada que inventar ni que validar clínicamente**. La exhaustividad la exige el propio tipo mapeado: **añadir una unidad al catálogo sin darle factor no compila**.

- *Excluidas a propósito:* conversiones **afines** (°C↔°F) — no son un factor, romperían la forma de la tabla y ningún motor de E0-05 las necesita. Se difieren, y el catálogo **no incluye la dimensión temperatura** para no dejar un hueco silencioso.
- *`mmHg ↔ kPa`* (1 mmHg = 0.1333224 kPa) es una definición física, no clínica; entra con su cita en el encabezado.

**(b) Entre dimensiones (masa ↔ sustancia) — bloqueada salvo con analito y fuente.**

`mg/dL → µmol/L` **no es convertible en general**: depende de la masa molar del analito. El tipo ya lo prohíbe por accidente (caso negativo 2). La conversión legítima es una función aparte que **exige el analito**:

```ts
export interface FactorMolar {
  analito: string
  /** mg/dL × factor = µmol/L */
  factorMgDlAMicromolL: number
  fuente: string          // de dónde sale el número, verificable
  usadoTambienEn?: string // archivo + SÍMBOLO del repo que YA usa este factor
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
| `creatinina` | mg/dL × 88.4 = µmol/L | comentario de `funcion-renal.ts:42` («un valor en µmol/L (÷88.4)»), repetido en `copiloto.ts:265` |
| `colesterol` | mg/dL ÷ 38.67 = mmol/L | `prevent.ts:21` (`const MMOL = 38.67`), en uso en `:55-56` |

Un test asegura que **el factor del catálogo es idéntico al que usa `prevent.ts`** (anti-deriva: si alguien cambia uno, el otro lo delata). Añadir un tercer analito exige la cita de su fuente; **no se añade ninguno «de paso»**.

**(c) `mEq/L` no se convierte a `mmol/L` en esta unidad.** La equivalencia depende de la valencia del ion, y el repo usa mEq/L para Na⁺/K⁺/Cl⁻ (`analitos.ts:61-63`) donde el número coincide con mmol/L. Modelarlo como **dimensión propia sin conversión automática** es la opción que no inventa nada: quien necesite el puente lo escribirá explícitamente, con valencia y fuente, en su propia unidad de trabajo.

---

## 5. Archivos que se tocan

| Archivo | Acción | Por qué |
|---|---|---|
| `src/types/clinical-quantity.ts` | **NUEVO** (~230 líneas) | El núcleo: tipos, fábrica, operaciones, conversiones. Va en `src/types/` porque es lo que pide el entregable del backlog y porque **ese directorio ya aloja runtime**, no solo tipos (`src/types/uci.ts:96` `certezaAStatus`, `:107` `esUsableParaCalculo`). |
| `src/__tests__/tipos/clinical-quantity.tipos.ts` | **NUEVO** (~70 líneas) | Los casos negativos con `@ts-expect-error`. **No es un test de vitest: es el gate del compilador.** Termina en `.tipos.ts`, que **no** empareja con `src/__tests__/**/*.test.ts` (`vitest.config.ts:7`) pero **sí** con `**/*.ts` de `tsconfig.json` ⇒ vitest lo ignora, `tsc --noEmit` y `next build` lo verifican. |
| `src/__tests__/clinical-quantity.test.ts` | **NUEVO** (~130 líneas) | Tests de runtime + el guardián del gate (§6). |
| `src/lib/clinical/registry.ts` | **NO se toca** | Ver §5-bis: registrarlo sin ADR **rompe el CI** que instaló E0-03, y este módulo aún no es un motor con callers. |
| Motores clínicos (`funcion-renal`, `gasometria`, `infusiones`, `dosis`, `prevent`) | **NO se tocan** | Es E0-05, riesgo alto, con su propia validación. Mezclarlo aquí sería exactamente lo que prohíbe la regla 5 de la carta operativa. |

**Ningún archivo existente se modifica.** El módulo nace sin un solo importador en producción.

### 5-bis. Interacción con el trinquete de ADRs de E0-03 (riesgo de CI nuevo)

E0-03 dejó `src/__tests__/clinical-registry-adr.test.ts` con dos asertos que **acotan por ambos lados**: la deuda no puede subir de `DEUDA_ADR_CONGELADA = 52` (`src/lib/clinical/adr-cobertura.ts:33`) **y** debe ser exactamente 52 (`expect(sinAdr.length).toBe(DEUDA_ADR_CONGELADA)`).

Consecuencia operativa, que debe quedar escrita para que E0-05 no la descubra con el CI en rojo:

- **Registrar `clinical-quantity` en `CLINICAL_ENGINE_REGISTRY` sin ADR sube la deuda a 53 ⇒ CI ROJO.**
- Registrarlo **con** su ADR en `docs/clinical-decisions/` la deja en 52 ⇒ verde.
- **No registrarlo** (opción de E0-04) no mueve nada: el gate compara el registro contra los ADRs, **no** escanea el sistema de archivos buscando motores. *(Nota lateral: `registry.ts:20-21` remite a `src/lib/clinical/cobertura.ts`, un archivo que **no existe**; la referencia quedó obsoleta al cerrar E0-03. No se corrige aquí — no es de esta unidad — pero conviene anotarlo.)*

**Decisión de E0-04: no registrar.** El módulo no calcula nada clínico —convierte con factores del SI— y no tiene callers. Cuando E0-05 lo meta en un motor, ese motor **ya** tiene su entrada en el registro. Si en algún momento se decide registrarlo como motor de tipo `conversion`, **su ADR entra en el mismo commit**.

---

## 6. Qué lo prueba

**Gate 1 — el compilador (es la aceptación literal).** `src/__tests__/tipos/clinical-quantity.tipos.ts` con los 6 casos negativos de §3.2 más los positivos. Si el tipo deja de rechazar algo, `tsc` emite `TS2578` y **el CI se cae** (`ci.yml:22-23`, y también `npm run build`). Sin dependencias nuevas, sin `tsd`, sin `expect-type`.

**Gate 2 — guardián del gate** (patrón ya usado en el repo: `log-secrets-guard.test.ts`, `firestore-rules-guard.test.ts`): un test de vitest lee `clinical-quantity.tipos.ts`, afirma que existe y conserva **≥ 6** directivas `@ts-expect-error`, y que `clinical-quantity.ts` conserva la línea de la marca invariante. Cierra el hueco de «arreglar» el CI borrando el archivo o comentando los casos.

**Gate 3 — runtime** (`clinical-quantity.test.ts`):

1. `convertir` ida y vuelta es idempotente dentro de tolerancia (`1 kg → g → kg`).
2. **`sumar(1 g, 1 mg)` = 1001 mg y NO 2** — prueba directa del bug de escala de §4.2.
3. `comparar(1 g, 1000 mg) === 0` — igualdad a través de unidades distintas.
4. El resultado se devuelve en la unidad del primer operando (regla determinista).
5. `cantidadDesde(' ', …)` y `cantidadDesde('abc', …)` ⇒ `null`; `cantidadDesde('12,5', …)` ⇒ 12.5 (contrato heredado de `num.ts`).
6. **Exhaustividad de `FACTORES`**: para cada dimensión y cada unidad del catálogo hay un factor finito y > 0 (recorrido en runtime, además del tipo mapeado).
7. `aConcentracionSustancia(q, 'analito-inexistente')` ⇒ `null` (no adivina masas molares).
8. **Anti-deriva:** el factor de colesterol coincide con `MMOL = 38.67` de `prevent.ts`; el de creatinina, con el 88.4 citado en `funcion-renal.ts` / `copiloto.ts`.
9. `formatear` no altera el valor almacenado (el redondeo es de presentación).

**Línea base a preservar: 2051 tests en verde** (`estado.json` tras E0-03). E0-04 sólo suma.

---

## 7. Riesgo de regresión REAL

**Bajo.** No es la valoración cómoda: se deduce de que el cambio sea *aditivo puro*.

- **Cero importadores en producción.** Ninguna ruta, componente, motor clínico, PDF, receta, cobro o firma cambia de comportamiento. El bundle de cliente no crece: nadie importa `clinical-quantity.ts` todavía, y los dos archivos de test viven bajo `src/__tests__/` (fuera del build).
- **Cero migraciones de datos.** No toca Firestore, ni hashes de integridad, ni el sello firmable. No entra en las zonas que la carta operativa marca como delicadas (impresión, cobros, firma).
- **El backlog dice «medio» y tiene razón — pero el riesgo vive en E0-05.** El peligro de `ClinicalQuantity` es el día que un motor en producción empiece a exigirlo. Esa es la unidad siguiente, declarada riesgo **alto**, y por eso este diseño no adelanta ni un motor.

**Los cuatro riesgos que sí existen, todos de compilación/CI y visibles en el acto:**

1. **Falso gate.** Si el módulo se escribe sin la marca invariante, el CI queda verde y la protección no existe (§3.3). *Mitigación:* control negativo ejecutado y documentado, comentario anti-borrado en el código, Gate 2 vigilando esa línea.
2. **El type-test rompe el build si se escribe mal.** Un `@ts-expect-error` sobrante tumba `tsc` **y** `next build`. Es el comportamiento deseado, pero obliga a escribir el archivo correcto de entrada. *Mitigación:* los casos ya están compilados y verificados; se transcriben, no se improvisan.
3. **Trinquete de ADRs (§5-bis).** Registrar el módulo sin ADR pone el CI en rojo. *Mitigación:* no se registra en E0-04, y queda escrito para E0-05.
4. **Ergonomía de la invarianza.** Quien intente `ClinicalQuantity<Dimension>` chocará con un error confuso. *Mitigación:* `CualquierCantidad` (§3.4) + comentario que explique cuándo usar cada uno.

**Rollback:** borrar tres archivos nuevos. No hay estado que revertir.

---

## 8. Validación clínica

**No requerida para esta unidad** — coherente con `validacionClinica: false` del backlog, y sostenible por construcción:

- Los factores intra-dimensión son **definiciones del SI** (1 g = 1000 mg), no criterio médico.
- Los dos únicos factores molares **ya viven en el repo** y se copian con su cita (`funcion-renal.ts:42`, `prevent.ts:21`). **No se introduce ningún número clínico nuevo.**
- No se define ningún umbral, rango de referencia, dosis ni criterio de decisión. `ClinicalQuantity` no interpreta: sólo impide que un número viaje sin su unidad.
- Donde faltaba criterio (mEq/L ↔ mmol/L, °C ↔ °F), **la respuesta del diseño es no convertir**, no inventar un factor.

### Preguntas para el Dr. — **NO bloquean** la implementación

Son decisiones de *alcance*, no de contenido clínico. Con cualquier respuesta, E0-04 se escribe tal cual está diseñada.

1. **¿Qué analitos deben tener conversión masa↔sustancia además de creatinina y colesterol?** (candidatos por lo que ya maneja el repo: glucosa, urea/BUN, bilirrubina, calcio). Cada uno entra **sólo con su fuente citada**; hoy el catálogo arranca con dos y devuelve `null` para el resto, que es el comportamiento seguro.
2. **¿`mEq/L` debe poder convertirse a `mmol/L` automáticamente?** El diseño dice **no** (requiere la valencia del ion). Si se quiere el puente para Na⁺/K⁺/Cl⁻, se hace en unidad aparte con la valencia declarada y su fuente.

---

## 9. Definición de «terminado» para E0-04

- [ ] `src/types/clinical-quantity.ts` con el tipo invariante, `cantidad`/`cantidadDesde`, `sumar`/`restar`/`comparar`/`escalar`/`esMayor`, `convertir`, `valorEn`/`formatear`, `FACTORES`, `FACTORES_MOLARES` (2 entradas citadas) y `CualquierCantidad`.
- [ ] `src/__tests__/tipos/clinical-quantity.tipos.ts` con ≥ 6 `@ts-expect-error` consumidos.
- [ ] `src/__tests__/clinical-quantity.test.ts` con los 9 puntos de §6.
- [ ] `npx tsc --noEmit` en verde **y** demostración de que quitar la marca invariante lo pone en rojo (control negativo reproducido en el repo real).
- [ ] `npx vitest run` ≥ 2051 + nuevos, sin regresiones (incluido `clinical-registry-adr.test.ts`, que debe seguir en 52).
- [ ] `npm run build` en verde.
- [ ] Ningún archivo de producción modificado (`git diff --stat` sólo con los 3 archivos nuevos).
