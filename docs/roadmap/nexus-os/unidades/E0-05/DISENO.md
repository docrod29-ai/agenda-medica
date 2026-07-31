# E0-05 — ClinicalQuantity: migración de motores críticos · DISEÑO

> **Estado:** diseño. **NO implementado**: en esta unidad no se modificó ni una línea de producción.
> **Etapa:** E0 (hardening). **Riesgo declarado en backlog:** alto. **Riesgo real del cambio tal como está diseñado:** medio (§8).
> **Depende de:** E0-04 (`src/types/clinical-quantity.ts`, cerrada — ver `unidades/E0-04/RESULTADO.json`).
> **Verificación hecha hoy:** el mecanismo de aceptación se probó con el compilador REAL del repo sobre un archivo temporal (`npx tsc --noEmit` → exit 0 con todos los `@ts-expect-error` consumidos) y con control negativo (al volver legal el caso de µmol/L, `tsc` emitió `TS2578` y falló). El archivo temporal se borró; `git status` quedó limpio. Detalle en §4.4.

---

## 0. Resumen ejecutivo

La aceptación de E0-05 es una frase falsable: **«creatinina en µmol/L ya no puede llegar cruda a CKD-EPI»**.

Hoy **no se cumple**, y hay un sitio donde ni siquiera la guarda de rango la protege:

```
src/lib/expediente/copiloto.ts:677-679
  const tfg = e.labs?.tfg ?? (e.labs?.creatinina && e.edad
    ? ckdEpi2021(e.labs.creatinina, e.edad, !!e.sexo && /^f/i.test(e.sexo))
    : undefined)
```

Los otros tres call sites de `ckdEpi2021` en ese mismo archivo (`:269`, `:492`, `:597`) **sí** filtran antes con `creatininaPlausibleMgDl`. Éste **no**. Una creatinina de 88 (µmol/L, paciente normal) entra cruda, sale una TFG de ~5 mL/min/1.73 m² y alimenta el cálculo de riesgo PREVENT. Es literalmente el bug que nombra la aceptación, vivo en producción.

**El cambio propuesto:** las cuatro familias de motores dejan de recibir `number` suelto y reciben `ClinicalQuantity<D>` de la dimensión correcta. La aritmética interna **no cambia** (se desenvuelve con `valorEn()` en la primera línea y se re-envuelve al salir), así que **ningún número que hoy sale de un motor cambia**. Lo que cambia es que el compilador enumera y rechaza cada puerta por la que hoy entra un número sin unidad.

**Un solo cambio de comportamiento, intencional y declarado:** cerrar el hueco de `copiloto.ts:678` alineándolo con el patrón que el propio archivo ya usa en `:596`. Consecuencia: con una creatinina implausible, PREVENT recibe `tfg = 0` y **devuelve `null`** (`src/lib/expediente/prevent.ts:102`), es decir, deja de mostrar un riesgo calculado sobre un dato basura y declara el dato faltante (`:146`).

**Se entrega en 4 lotes independientes**, cada uno con sus tres gates en verde antes del siguiente. El lote 1 es el que cumple la aceptación; los lotes 2-4 completan el objetivo del backlog. El lote 4 toca la pantalla de receta y va al final (§8.3).

---

## 1. Qué pide la unidad (backlog literal)

| Campo | Valor |
|---|---|
| Objetivo | Migrar función renal, gasometría, infusiones y dosis a ClinicalQuantity |
| Entregables | motores migrados · tests de unidad cruzada |
| Aceptación | Creatinina en µmol/L ya no puede llegar cruda a CKD-EPI |
| Depende | E0-04 |
| Riesgo | alto |
| validacionClinica | false |

---

## 2. Qué existe YA (no rehacer)

| Pieza | Dónde | Estado para E0-05 |
|---|---|---|
| El tipo, conversiones, operaciones, `parsearCantidad`, `valorEn`, `formatear` | `src/types/clinical-quantity.ts` (E0-04) | **Completo y sin importadores.** E0-05 es su primer consumidor. No se rehace nada; se le añaden 2 piezas (§3.5). |
| Gate de compilación con `@ts-expect-error` | `src/__tests__/tipos/clinical-quantity.tipos.ts` + guardián en `clinical-quantity.test.ts:41` | **Patrón ya probado en el repo** (lo repiten `clinical-fact.tipos.ts`, `evidence.tipos.ts`, `pico.tipos.ts`). E0-05 añade un archivo hermano; no inventa mecanismo. |
| Guarda de rango de creatinina | `funcion-renal.ts` → `CREAT_MGDL_MIN/MAX`, `creatininaPlausibleMgDl` | **SE CONSERVA TAL CUAL.** Es la única defensa contra un número que *es* µmol/L pero viene *etiquetado* mg/dL (§7). El tipo no la sustituye: la complementa. |
| Motor renal | `src/lib/expediente/funcion-renal.ts` (213 líneas) | Migrar (lote 1). |
| Motor de gasometría | `src/lib/uci/gasometria.ts` (228 líneas) | Migrar (lote 2). |
| Motor de infusiones | `src/lib/uci/infusiones.ts` (135 líneas) | Migrar (lote 3). |
| Motor de seguridad de dosis | `src/lib/seguridad/dosis.ts` (323 líneas) | Migrar (lote 4). |
| Registro de motores | `src/lib/clinical/registry.ts` — `ckd-epi-2021` (:102), `cockcroft-gault` (:124), `ajuste-renal-antimicrobianos` (:143), `gasometria-acidobase` (:437), `infusiones-dosis-rate` (:476), dosis (:776) | El campo `unidades` es **prosa** hoy. Se actualiza a la firma real; NO se añaden motores nuevos (§8.4 — trinquete de ADRs). |
| Unidad como literal de tipo | `infusiones.ts:25` (`UnidadDosis`), `:27`/`:33` (`unidadConc`) | Precedente del propio repo. La migración lo sustituye por la dimensión, sin cambiar los strings. |
| Unidad declarada por analito | `laboratorio/analitos.ts` — creatinina `mg/dL` (:44), Na/K/Cl `mEq/L` (:61-63), albúmina `g/dL` (:52) | **Fuente de la etiqueta** en la frontera. Es de donde el caller sabe qué dimensión construir. |
| Coerción numérica única | `src/lib/uci/num.ts` → `num()` | `cantidadDesde()` ya se apoya en ella. No se toca. |

**Conclusión:** no hay nada que construir de cero. E0-05 es cableado + 2 adiciones mínimas al núcleo.

---

## 3. El contrato nuevo

### 3.1 Regla general de migración (el patrón, una sola vez)

```ts
// ANTES
export function motor(x: number, y: number): number { return f(x, y) }

// DESPUÉS  — misma aritmética, misma salida numérica
export function motor(x: ClinicalQuantity<'concentracion_masa'>, y: number): number {
  const xNum = valorEn(x, 'mg/dL')   // ← la unidad se NOMBRA aquí, o no compila
  return f(xNum, y)
}
```

Tres reglas que la implementación **no** puede romper:

1. **La aritmética interna no se toca.** `ClinicalQuantity` no tiene multiplicación ni división entre dimensiones (E0-04 lo dejó fuera a propósito: `escalar` sólo admite un escalar adimensional). Expresar `mL/h = dosis · peso · 60 / conc` en álgebra dimensional exigiría un motor de dimensiones derivadas — **eso NO es E0-05**. El tipo protege **entradas y salidas**; los pasos intermedios siguen siendo `number`. Decirlo es parte del entregable: ocultarlo sería vender una protección que no existe.
2. **Ningún valor esperado de un test existente cambia.** Si al migrar un test hay que tocar un número esperado, **hay que parar**: eso no es migración, es regresión (§6.3).
3. **Sólo se tipa lo que tiene ambigüedad de unidad real.** `edad` sigue siendo `number` en años (§3.6).

### 3.2 Lote 1 — función renal (**es el lote de la aceptación**)

`src/lib/expediente/funcion-renal.ts`:

```ts
import type { ClinicalQuantity } from '@/types/clinical-quantity'
import { cantidad, valorEn } from '@/types/clinical-quantity'

/** Creatinina sérica: concentración de MASA. µmol/L es otra dimensión y no compila. */
type CreatininaSerica = ClinicalQuantity<'concentracion_masa'>

export function ckdEpi2021(creatinina: CreatininaSerica, edad: number, sexo: Sexo | boolean)
  : ClinicalQuantity<'depuracion_indexada'>

export function cockcroftGault(creatinina: CreatininaSerica, edad: number, sexo: Sexo, peso: ClinicalQuantity<'masa'>)
  : ClinicalQuantity<'depuracion'>

/**
 * Depuración usada para dosificar, CON SU PROCEDENCIA. No puede ser un solo
 * ClinicalQuantity<D>: 'depuracion' (mL/min, Cockcroft) y 'depuracion_indexada'
 * (mL/min/1.73m², CKD-EPI) son dimensiones SEPARADAS por decisión D2 de E0-04
 * —no existe factor entre ellas sin la superficie corporal del paciente— y hoy
 * `depuracionParaDosis: number` las mezcla en un mismo campo (`crcl ?? egfr`).
 * La unión discriminada NO cambia el comportamiento: lo hace visible.
 */
export type DepuracionParaDosis =
  | { base: 'cockcroft-gault'; q: ClinicalQuantity<'depuracion'> }
  | { base: 'ckd-epi';         q: ClinicalQuantity<'depuracion_indexada'> }

export interface ResultadoRenal {
  egfrCkdEpi: ClinicalQuantity<'depuracion_indexada'> | null   // era number (NaN si no aplicaba)
  crClCockcroft: ClinicalQuantity<'depuracion'> | null
  estadio: string
  estadioDesc: string
  depuracionParaDosis: DepuracionParaDosis | null              // era number
  noAplicablePorEdad?: boolean
  datoImplausible?: boolean
}

export function evaluarFuncionRenal(
  creatinina: CreatininaSerica, edad: number, sexo: Sexo, peso?: ClinicalQuantity<'masa'>,
): ResultadoRenal

export function ajusteRenalFarmacos(
  medicamentos: { nombre?: string }[], dep: DepuracionParaDosis,
): AlertaRenal[]
```

Notas obligatorias del lote 1:

- **`NaN` → `null`.** Hoy `egfrCkdEpi: NaN` señala "no calculado" y la pantalla lo filtra con `Number.isFinite` (`receta/…/page.tsx:616`). Con el tipo, `null` dice lo mismo sin poder colarse en una resta. `clasificarTFG` conserva su guarda de finitud intacta.
- **`ajusteRenalFarmacos` NO cambia sus textos.** Las plantillas `mensaje: (c) => \`… CrCl ${c} …\`` reciben el mismo número que hoy (`valorEn(dep.q, …)`). El mensaje *podría* ganar la procedencia ("TFG indexada, sin peso") — es una mejora real, pero cambia texto clínico impreso y **queda fuera de esta unidad** (§9, Q2).
- **Callers a migrar (5, enumerados por `tsc`):** `copiloto.ts:269, 492, 597, 678` y `receta/[patientId]/[notaId]/page.tsx:161,167`. El re-export de `calculadoras.ts:202` sigue igual (sólo cambia el tipo que reexporta).
- **El hueco de `:678` se cierra** replicando el patrón de `:596`: filtrar con `creatininaPlausibleMgDl` antes de construir la cantidad. Único cambio de comportamiento de toda la unidad (§0, §8.2).

### 3.3 Lote 2 — gasometría

`src/lib/uci/gasometria.ts` — `EntradaGasometria` pasa de `number | string` a cantidades:

```ts
export interface EntradaGasometria {
  ph?: number                                          // ADIMENSIONAL (§3.6)
  paco2?: ClinicalQuantity<'presion'>                   // mmHg
  hco3?: ClinicalQuantity<'concentracion_equivalente'>  // mEq/L  ← ver Q1
  na?:   ClinicalQuantity<'concentracion_equivalente'>
  cl?:   ClinicalQuantity<'concentracion_equivalente'>
  albumina?: ClinicalQuantity<'concentracion_masa'>     // g/dL
  cronicidadRespiratoria?: 'aguda' | 'cronica'
}
```

- **Por qué `mEq/L` y no `mmol/L` para HCO₃:** el anion gap `Na − (Cl + HCO3)` (`gasometria.ts:168`) es una resta y **exige las tres en la misma dimensión**. `analitos.ts:61,63` declara Na y Cl en `mEq/L`, y `registry.ts:441` declara el motor entero en `mEq/L`. El comentario del código (`gasometria.ts:36`) dice `mmol/L`. **Numéricamente son idénticos** (los tres iones son monovalentes) así que ningún número cambia; lo que hay que unificar es la **etiqueta**. Se adopta la del registro y se corrige el comentario. Queda como pregunta **no bloqueante** al Dr. (Q1). *No se añade ningún puente mEq↔mmol al núcleo:* E0-04 lo prohibió a propósito (depende de la valencia) y aquí no hace falta.
- La corrección del AG por albúmina (`agCorr = ag + 2.5·(4 − alb)`, `:174`) mezcla g/dL dentro de un resultado en mEq/L: el `2.5` es un coeficiente **con unidades implícitas** de la fórmula publicada, ya presente en el código. Se conserva idéntico, desenvolviendo con `valorEn(alb,'g/dL')`. No se toca el coeficiente ni la guarda de rango `[1,6] g/dL` de `:172`.
- **Callers a migrar (4):** `uci/page.tsx:196`, `uci/nota.ts:54`, `uci/copilot.ts:40`, `uci/benchmark.ts`. Todos construyen desde un formulario con `n('...')` → pasan a `cantidadDesde(...)`, que devuelve `null` con la misma semántica de "faltante" que `num()` ya tenía.

### 3.4 Lote 3 — infusiones

`src/lib/uci/infusiones.ts`. Es el motor que el propio registro llama *"la conversión con mayor potencial de daño de toda la UCI"* (`registry.ts:494`).

```ts
export interface ResultadoInfusion {
  ok: boolean; bloqueado: boolean; motivoBloqueo: string | null
  dosis: CualquierCantidad | null        // µg/kg/min | µg/min | U/min → 3 dimensiones
  rateMlH: ClinicalQuantity<'tasa_volumen'> | null
  concentracion: CualquierCantidad | null // µg/mL (concentracion_masa) | U/mL (nueva)
  advertencias: string[]; interpretacion: string
  // `unidadDosis`/`unidadConc` desaparecen: la unidad ya viaja DENTRO de la cantidad.
}
```

- `dosis` usa **`CualquierCantidad`** porque las tres unidades del catálogo viven en tres dimensiones distintas por decisión D3 de E0-04 (`tasa_dosis_peso`, `tasa_dosis`, `tasa_actividad`). `CualquierCantidad` es exactamente el tipo que E0-04 creó para almacenar/serializar/mostrar heterogéneo, y **sigue sin poder colarse** donde se exige una dimensión concreta.
- **Adición requerida al núcleo:** `U/mL` **no existe** en el catálogo de E0-04 (verificado: `FACTORES` no la contiene). Se añade la dimensión `concentracion_actividad: 'U/mL'`, separada de `concentracion_masa` por el mismo motivo que `tasa_actividad` está separada de `tasa_dosis`: la equivalencia UI↔masa depende del fármaco y del estándar. Es aditivo y **no introduce ningún número clínico** (factor 1, unidad única).
- El `rango?: [number, number]` de cada fármaco (`infusiones.ts:35`) queda **como está** en esta unidad: tiparlo obliga a un `[CualquierCantidad, CualquierCantidad]` por fármaco y multiplica la superficie de cambio del catálogo sin cerrar ningún hueco nuevo (la dosis ya llega tipada). Se anota como candidato a E0-05-bis.
- **Callers a migrar (2 de producción + 1 demo):** `uci/page.tsx:308-309`, `demo/interactivo/page.tsx:520`.

### 3.5 Adiciones al núcleo `src/types/clinical-quantity.ts` (2, ambas aditivas)

```ts
/** Dimensión nueva: concentración de ACTIVIDAD biológica (U/mL). Ver §3.4. */
concentracion_actividad: 'U/mL'

/**
 * Inversa de `aConcentracionSustancia`: µmol/L → mg/dL con la masa molar del
 * analito. Es la ÚNICA puerta legítima para que un laboratorio reportado en
 * µmol/L llegue a CKD-EPI, y obliga a nombrar el analito. Devuelve null si el
 * analito no está en FACTORES_MOLARES: NUNCA adivina una masa molar.
 * NO añade ningún analito ni ningún factor nuevo — reutiliza UMOL_CREATININA (88.4),
 * ya citado en el repo.
 */
export function aConcentracionMasa(
  q: ClinicalQuantity<'concentracion_sustancia'>, analito: string,
): ClinicalQuantity<'concentracion_masa'> | null
```

Cuidado con dos tests existentes de E0-04 al añadir la dimensión: `clinical-quantity.test.ts:217` (dimensiones que deben declarar **exactamente 1** unidad — hay que incluir la nueva en esa lista) y `:273` (`FACTORES_MOLARES` debe seguir siendo exactamente `['colesterol','creatinina']` — `aConcentracionMasa` **no** puede añadir analitos).

### 3.6 Lo que deliberadamente NO se tipa

| Cantidad | Por qué se queda como `number` |
|---|---|
| `edad` (años) | El catálogo de `tiempo` es `d/h/min/s`. Añadir `'año'` obliga a fijar 365 vs 365.25 días — una decisión definicional que **nadie ha tomado** y que no cierra ningún bug (en este dominio la edad tiene una sola unidad convencional). Inventarla sería exactamente lo que la carta prohíbe. |
| `pH` | Es adimensional (logaritmo de actividad). Una dimensión `ph` con una sola "unidad" sería ceremonia sin protección. |
| `tomasDia`, `dilucionIdx`, `sexo`, banderas | Conteos y categorías, no cantidades físicas. |
| Pasos intermedios de la aritmética | §3.1 regla 1. |

---

## 4. Lote 4 — dosis (`src/lib/seguridad/dosis.ts`) y por qué va al final

Es el lote de **mayor valor** y **mayor riesgo de pantalla**.

```ts
// HOY: la unidad viaja en un BOOLEANO paralelo al número
export interface EntradaDosis {
  farmaco: string
  dosisMg: number
  dosisPorKg?: boolean   // ← si esto se pierde, "50 mg/kg" se lee como 50 mg
  pesoKg?: number; tomasDia?: number; via?: string; edadAnios?: number
}

// PROPUESTA: la unidad ES el tipo; el booleano desaparece
export type DosisPrescrita =
  | ClinicalQuantity<'masa'>            // 'mg'          — dosis absoluta
  | ClinicalQuantity<'dosis_por_peso'>  // 'mg/kg/dosis' — dosis por kilo
export interface EntradaDosis {
  farmaco: string
  dosis: DosisPrescrita
  peso?: ClinicalQuantity<'masa'>
  tomasDia?: number; via?: string; edadAnios?: number
}
```

`dosis.ts:135-141` documenta el P0 que esto cierra por construcción: *"`extraerMg("50 mg/kg")` devolvía 50, y `revisarDosis` lo trataba como 50 mg ABSOLUTOS"*. Con `DosisPrescrita` **ese estado no es representable**: el discriminante ya no es un flag que se puede olvidar, es la dimensión.

**Por qué va al final:** su único caller de producción es `receta/[patientId]/[notaId]/page.tsx:146`, dentro del flujo de receta — el área que la carta operativa (regla 5) marca como sensible. El cambio vive en un `useMemo` que arma el panel de alertas, **no** en el render impreso, pero exige verificación visual de la pantalla de receta antes de cerrar. `esDosisPorKg()` sigue existiendo: es el **parser de texto** que decide qué constructor usar en la frontera; no desaparece, se convierte en la fábrica de la cantidad.

### 4.4 Verificación del mecanismo de aceptación (ejecutada hoy)

Se escribió un archivo temporal `src/__tests__/tipos/__scratch_e005.tipos.ts` con la firma propuesta y se corrió el compilador real del repo:

| Caso | Resultado |
|---|---|
| `ckdEpiQ(cantidad(1.2,'mg/dL','concentracion_masa'), 60)` | **compila** ✔ |
| `ckdEpiQ(cantidad(106,'µmol/L','concentracion_sustancia'), 60)` | **rechazado** ✔ (es la aceptación literal) |
| `ckdEpiQ(1.2, 60)` — número crudo | **rechazado** ✔ |
| `{ base:'cockcroft-gault', q: cantidad(60,'mL/min/1.73m²','depuracion_indexada') }` | **rechazado** ✔ (la unión discriminada no se puede mal-etiquetar) |
| `cantidad(0.2,'U/mL','concentracion_masa')` | **rechazado** ✔ (confirma que falta la dimensión de §3.4) |

`npx tsc --noEmit` → **exit 0** con los cinco `@ts-expect-error` consumidos.
**Control negativo:** al sustituir el caso de µmol/L por uno legal, `tsc` emitió `TS2578 Unused '@ts-expect-error' directive` y falló — el gate no pasa "por vacío". Archivo borrado; `git status` limpio.

---

## 5. Archivos que se tocan

| Archivo | Lote | Qué se hace |
|---|---|---|
| `src/types/clinical-quantity.ts` | 1,3 | +`concentracion_actividad`, +`aConcentracionMasa`. Aditivo. |
| `src/lib/expediente/funcion-renal.ts` | 1 | Firmas + `DepuracionParaDosis`. Aritmética y umbrales intactos. |
| `src/lib/expediente/copiloto.ts` | 1 | 4 call sites + cierre del hueco de `:678`. |
| `src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx` | 1,4 | Frontera: `cantidadDesde` para creatinina/peso; lectura de `renal.*` y `revisarDosis`. |
| `src/lib/uci/gasometria.ts` | 2 | `EntradaGasometria` tipada; comentario `mmol/L`→`mEq/L`. |
| `src/lib/uci/{nota,copilot,benchmark}.ts`, `src/app/(dashboard)/uci/page.tsx` | 2,3 | Fronteras `n()`→`cantidadDesde`. |
| `src/lib/uci/infusiones.ts` | 3 | `ResultadoInfusion` tipado; `unidadDosis`/`unidadConc` fuera. |
| `src/app/demo/interactivo/page.tsx` | 3 | Un call site. |
| `src/lib/seguridad/dosis.ts` | 4 | `EntradaDosis` → `DosisPrescrita`. |
| `src/lib/clinical/registry.ts` | 1-4 | Campo `unidades` de 6 motores: prosa → firma real. Sin motores nuevos. |
| `src/__tests__/tipos/motores-unidad.tipos.ts` | 1-4 | **NUEVO** — gate de compilación. |
| `src/__tests__/motores-unidad-cruzada.test.ts` | 1-4 | **NUEVO** — equivalencia numérica y fronteras. |
| 12 archivos de `src/__tests__/` existentes | 1-4 | Migración mecánica de ~119 call sites (§6.3). |

**Total de producción: 12 archivos.** Ninguno de impresión/PDF/Word/firma/cobros/reglas de Firestore.

---

## 6. Tests

### 6.1 `src/__tests__/tipos/motores-unidad.tipos.ts` (el gate de la aceptación)

Mismo patrón que `clinical-quantity.tipos.ts` (no lo recoge vitest; lo verifican `tsc` y `next build`). Casos negativos mínimos, uno por puerta cerrada:

1. `ckdEpi2021(106 µmol/L, …)` — **la aceptación literal**.
2. `ckdEpi2021(1.2, …)` — `number` crudo.
3. `cockcroftGault(cr, edad, sexo, 70)` — peso como `number` crudo.
4. `cockcroftGault(cr, edad, sexo, cantidad(70,'L','volumen'))` — peso como volumen.
5. `ajusteRenalFarmacos(meds, 45)` — depuración cruda.
6. `ajusteRenalFarmacos(meds, { base:'cockcroft-gault', q: <indexada> })` — mal etiquetada.
7. `analizarGasometria({ paco2: cantidad(40,'mEq/L',…) })` — presión con dimensión de electrolito.
8. `analizarGasometria({ albumina: cantidad(40,'mEq/L',…) })` — el bug real de albúmina en g/L, ahora también en tipos.
9. `dosisARate({ dosis: 0.1 })` — dosis cruda.
10. `revisarDosis({ dosis: cantidad(50,'mg','masa') })` donde se prescribió mg/kg — el P0 de pediatría, no representable.
11. `sumar(<TFG indexada>, <CrCl cruda>)` — no hay factor sin superficie corporal.
12. Positivos de control (5): cada motor con la cantidad correcta **debe compilar**.

Más un guardián en el test de runtime que cuente los `@ts-expect-error` activos (patrón de `clinical-quantity.test.ts:41`): comentarlos no puede ser la forma de poner el CI en verde.

### 6.2 `src/__tests__/motores-unidad-cruzada.test.ts` (entregable «tests de unidad cruzada»)

- **Equivalencia numérica congelada:** rejilla de fixtures **sintéticos** (creatinina 0.6/1.2/3.4 mg/dL × edad 30/65/85 × ambos sexos × con y sin peso; gasometrías de acidosis metabólica / alcalosis respiratoria; norepinefrina 0.1 µg/kg/min a 70 kg; vasopresina 0.03 U/min) cuyos valores esperados se calculan **con el motor de HOY** antes de migrar y se congelan como literales. Si un solo número se mueve, el test se pone rojo. Es la red de regresión de toda la unidad.
- **Ida y vuelta de unidad:** `aConcentracionMasa(µmol/L, 'creatinina')` → mg/dL → CKD-EPI produce la misma TFG que la creatinina en mg/dL equivalente (106 µmol/L ÷ 88.4 = 1.199…). Y `aConcentracionMasa(q,'analito_inexistente') === null`.
- **La guarda de rango sigue viva:** una cantidad **bien tipada pero mal etiquetada** (`cantidad(88,'mg/dL',…)` sobre un valor que era µmol/L) sigue produciendo `datoImplausible: true`. Prueba explícita de que el tipo **no** sustituye a la defensa en profundidad (§7).
- **El hueco cerrado:** con `labs.creatinina = 88`, `riesgoCardiovascular` deja de emitir un riesgo PREVENT calculado sobre una TFG fantasma. Este test **falla hoy** — es la prueba de que la unidad arregla algo real.

### 6.3 Migración de los 12 archivos de test existentes (~119 call sites)

Todos de la misma forma: `ckdEpi2021(1.2, …)` → `ckdEpi2021(mgPorDl(1.2), …)` (el atajo ya existe: `clinical-quantity.ts:267`). **Ningún valor esperado cambia.** `tsc` enumera cada sitio pendiente, así que la migración no se puede dejar a medias en silencio.

Los tests que **no** se pueden debilitar bajo ningún concepto: `guardas-unidad-clinica.test.ts`, `funcion-renal-plausibilidad.test.ts`, `clinical-safety-harness.test.ts`, `dosis-invariantes-property.test.ts`, `peso-pediatrico-seguridad.test.ts`.

---

## 7. Qué NO garantiza esta unidad (dicho antes de implementarla)

| Amenaza | ¿Cerrada? |
|---|---|
| Un `number` sin unidad llega a un motor | **Sí**, en compilación. |
| Una cantidad en µmol/L llega a CKD-EPI | **Sí**, en compilación (es la aceptación). |
| Una TFG indexada se usa como si fuera CrCl sin dejar rastro | **Sí**: la unión discriminada obliga a declarar la procedencia. |
| Un laboratorio en µmol/L **etiquetado como mg/dL** en la frontera | **NO.** Ningún sistema de tipos ve el papel del laboratorio. Sólo lo atrapa la guarda de rango (`creatininaPlausibleMgDl`), que por eso **se conserva**. Un valor sano en µmol/L (p.ej. 20) sigue cayendo dentro de `[0.1, 25]` y pasando. Cerrar esto exige que el laboratorio traiga su unidad desde el origen — es E1 (`ClinicalFact`), no E0-05. |
| Errores de escala en los pasos intermedios de una fórmula | **NO** (§3.1 regla 1). |

---

## 8. Riesgo de regresión real

### 8.1 Superficie
12 archivos de producción. **Cero** de impresión, PDF, Word, firma, cobros, Stripe, WhatsApp o reglas de Firestore. El bundle de cliente no crece de forma apreciable (`clinical-quantity.ts` son funciones puras; la marca es `declare`, no existe en runtime).

### 8.2 Comportamiento
**Un solo cambio intencional**: `copiloto.ts:678` deja de calcular una TFG con creatinina implausible. Efecto observable: en ese caso la tarjeta de riesgo cardiovascular deja de mostrarse (PREVENT devuelve `null`, `prevent.ts:102`) y el motivo se declara (`:146`). Sólo se dispara con un dato fuera de `[0.1, 25] mg/dL`, es decir, con un error de captura o de unidad. **Requiere el visto bueno del Dr. antes de desplegar** por ser un cambio visible en pantalla, aunque sea en la dirección segura.
Todo lo demás: mismos números, mismos textos, mismos umbrales, mismas alertas.

### 8.3 Orden de ejecución obligatorio
`L1 (renal, cumple la aceptación) → L2 (gasometría) → L3 (infusiones) → L4 (dosis + receta)`.
Cada lote cierra con `npx tsc --noEmit`, `npx vitest run src/__tests__/` y `npm run build` en verde antes de empezar el siguiente. Si los créditos se acaban a mitad, la unidad queda **parcial pero coherente y desplegable**, y `estado.json` dice en qué lote se quedó. **Nunca se dejan dos lotes a medias a la vez.**

### 8.4 Riesgos de CI conocidos (heredados)
- **Trinquete de ADRs de E0-03** (`clinical-registry-adr.test.ts`): la deuda está congelada. E0-05 **no registra motores nuevos** — sólo actualiza el campo `unidades` de 6 entradas existentes — así que el contador no se mueve. Registrar `ClinicalQuantity` como motor pondría el CI en rojo (era la decisión D4 de E0-04): **no se hace aquí**.
- **Gate de cobertura** (`clinical-registry-cobertura.test.ts`): no se crean archivos nuevos en directorios clínicos, así que no exige entradas nuevas.
- **Tests de exhaustividad de E0-04**: `clinical-quantity.test.ts:217` y `:273` (§3.5).
- Línea base de tests a confirmar al empezar (último cierre registrado: **2322**, E1-02/E2-02). E0-05 debe terminar con esa cifra **más** los casos nuevos y **ninguno menos**.

---

## 9. Preguntas al médico (NO bloquean la ejecución)

Ninguna de las tres impide implementar E0-05: el diseño **preserva el comportamiento actual** en los tres casos. Se registran porque el tipo las vuelve visibles y en algún momento hay que decidirlas.

- **Q1 — Etiqueta del bicarbonato.** El registro de motores dice `HCO₃ mEq/L` (`registry.ts:441`); el comentario del motor dice `mmol/L` (`gasometria.ts:36`). Al ser monovalente **el número es el mismo**, pero la etiqueta que se imprime en la nota no. ¿Cuál se adopta como oficial? *(El diseño adopta `mEq/L` por coherencia con Na/Cl de `analitos.ts` y con el registro; cambiarlo después es una línea.)*
- **Q2 — Depuración para dosificar sin peso.** Hoy, si no hay peso, `depuracionParaDosis` cae en la TFG **indexada** (mL/min/1.73 m²) y se compara contra umbrales de ajuste expresados en **mL/min**. Es el comportamiento vigente y **no se cambia** en esta unidad; la regla de enoxaparina (`funcion-renal.ts:182`) ya advierte *"usa la depuración de creatinina, no la TFG indexada"*. ¿Debe el sistema (a) seguir igual, (b) mostrar la procedencia en el texto de la alerta, o (c) no emitir alerta de ajuste renal sin peso?
- **Q3 — Analitos con conversión masa↔sustancia.** `FACTORES_MOLARES` sólo tiene creatinina y colesterol (los dos que ya existían en el repo). ¿Se añaden glucosa, urea/BUN, bilirrubina, calcio? Cada uno exige su fuente citada. Hoy el catálogo devuelve `null` para el resto, que es el comportamiento seguro. *(Heredada de E0-04.)*

---

## 10. Definición de terminado

1. `src/__tests__/tipos/motores-unidad.tipos.ts` con ≥12 casos negativos, todos consumidos (`tsc` exit 0) **y** control negativo ejecutado y revertido: al volver legal el caso de µmol/L, `tsc` debe fallar con `TS2578`.
2. `motores-unidad-cruzada.test.ts` en verde, incluido el caso que **hoy falla** (§6.2, hueco de `copiloto.ts:678`).
3. Los 12 archivos de test existentes migrados **sin cambiar un solo valor esperado**.
4. `npx tsc --noEmit`, `npx vitest run src/__tests__/` y `npm run build` en verde tras **cada** lote.
5. `grep -n "ckdEpi2021(" src` no devuelve ninguna llamada con un `number` como primer argumento.
6. `registry.ts` con el campo `unidades` de los 6 motores reflejando la firma real, y el contador de deuda de ADRs sin moverse.
7. `RESULTADO.json` + `estado.json` + `CHECKPOINT.md` actualizados en el **mismo commit** que cierra la unidad.
