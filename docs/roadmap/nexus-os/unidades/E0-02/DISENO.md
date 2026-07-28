# E0-02 — Invariantes property-based de dosis pediátrica y aminoglucósidos

**Estado:** DISEÑO (no implementado).
**Etapa:** E0 · **Riesgo declarado:** bajo · **Depende de:** nada.

**Objetivo (backlog):** extender REG-013/REG-018 a property-based sobre todo el catálogo:
`porToma ≤ porDía ≤ tope`, unidad obligatoria.
**Aceptación (backlog):** *"Ningún fármaco del catálogo puede producir dosis/toma por encima
de su tope."*

---

## 1. Qué existe ya (no rehacer)

| Pieza | Dónde | Estado |
|---|---|---|
| Motor determinista de dosis pediátrica | `src/lib/expediente/pediatria.ts:149` `calcularDosisPediatrica` | completo; aplica en orden `topeDosis` → `topeDia` → `topeMgKgDia`, propagando los dos últimos **de regreso a `porToma`** (`pediatria.ts:196-217`) |
| Catálogo pediátrico (25 fármacos) | `src/lib/expediente/pediatria.ts:53` `FARMACOS_PED` | completo |
| Tomas/día implícitas en el intervalo | `src/lib/expediente/pediatria.ts:238` `tomasPorIntervalo` | **privada** (no exportada) |
| Seguridad de unidad de peso (REG-013) | `src/lib/expediente/pediatria.ts:135` `revisarPesoPediatrico`, `libraAKg` | completo + `src/__tests__/peso-pediatrico-seguridad.test.ts` |
| Verificador de dosis adulto | `src/lib/seguridad/dosis.ts:115` `revisarDosis` + `CATALOGO` (10 fármacos, `dosis.ts:48`) | completo + `src/__tests__/seguridad-dosis.test.ts` |
| Invariante REG-018 (parcial) | `src/__tests__/clinical-safety-harness.test.ts:255-281` | **solo `porToma ≤ porDía`**, 5 pesos fijos, edad fija 60 m. **No comprueba `porToma ≤ tope`** — que es exactamente el criterio de aceptación |
| Bloque "PROPERTY-BASED" existente | `src/__tests__/clinical-safety-harness.test.ts:283-336` | mallas deterministas sin `Math.random`, para CKD-EPI/CG/FIB-4/MELD. **Este es el estilo de la casa: se reutiliza, no se inventa otro** |
| CI | `.github/workflows/ci.yml:25` `npx vitest run` | ya corre todo `src/__tests__/**/*.test.ts` (`vitest.config.ts`) → **no hay que tocar el CI** |
| ADR | `docs/clinical-decisions/dosis-pediatrica.md` | describe el pipeline de topes; hay que añadir el invariante nuevo |
| Registro de motores | `src/lib/clinical/registry.ts:127` (`dosis-pediatrica`) | listar el test nuevo en `goldenTests` |

**No hay `fast-check` ni ninguna librería property-based** en `package.json`. El repo ya resuelve
esto con mallas deterministas. **Decisión: no agregar dependencia**; se implementa un arnés
propio de ~60 líneas (reproducible, sin `Math.random`, contraejemplo legible).

---

## 2. Verificación empírica hecha ANTES de diseñar

Se corrió un barrido exhaustivo (test temporal, ya borrado; el repo quedó limpio) sobre
`FARMACOS_PED` × pesos 0.5–120 kg en pasos de 0.1 kg (≈ 30 000 combinaciones):

- **`porToma.max ≤ topeDosis`: 0 violaciones.**
- **`porDia.max ≤ topeDia` y `porDia.max ≤ topeMgKgDia × peso`: 0 violaciones.**
- **`porToma ≤ porDía`, `min ≤ max`: 0 violaciones.**
- **Monotonía en peso** (`porToma.max` no decrece al subir el peso): 0 violaciones.
- **Estructura del catálogo:** los 25 fármacos tienen `unidad` no vacía, ≥1 tope declarado,
  rango ordenado, `tomas ≥ 1` cuando usan `mgKgDia`, `dosisMinima ≤ topeDosis`.
- **`CATALOGO` adulto:** internamente coherente (`maxTomaMg ≤ maxDiaMg`, `maxDiaOralMg ≤ maxDiaMg`,
  `pedMaxMgKgToma ≤ pedMaxMgKgDia`, ningún fármaco sin techo).

**Conclusión: el criterio de aceptación YA se cumple hoy.** E0-02 no es una reparación: es
**convertirlo en un invariante permanente que no se pueda romper en silencio** al agregar el
fármaco número 26. Eso cambia el diseño: el valor está en las propiedades **fail-closed sobre la
FORMA del catálogo**, no en parchear el motor.

Dos hallazgos reales del barrido:

1. **Overshoot por redondeo (máx. medido 0.1 mg/día).** El motor redondea a 1 decimal
   (`pediatria.ts:224`), y ese redondeo es **hacia el más cercano**, no hacia abajo. Ejemplos:
   Metronidazol @66.7 kg → `porToma.max` 666.7 × 3 tomas = **2000.1 mg** contra `topeDia` 2000;
   Gentamicina neonatal @51.3 kg → 128.3 × 2 = **256.6** contra tope 256.5 mg/kg/día.
   Es clínicamente despreciable pero **el invariante debe declarar su tolerancia de forma
   explícita y acotada** (§4, P2c), no esconderla en un `toBeCloseTo` cualquiera.
2. **Contradicción entre los dos catálogos (ver §6).** `FARMACOS_PED` puede emitir
   Amoxicilina **1500 mg por toma** (≥33.3 kg) mientras `CATALOGO` adulto declara
   `maxTomaMg: 1000` (`dosis.ts:54`). Los dos motores deterministas no coinciden en el techo
   por toma del mismo fármaco. **Requiere decisión del médico; no se resuelve aquí.**

---

## 3. Archivos que se tocan

| Archivo | Acción | Por qué |
|---|---|---|
| `src/__tests__/_harness/property.ts` | **NUEVO** (no es `*.test.ts` → `vitest.config.ts` no lo ejecuta como suite) | arnés property-based reutilizable: PRNG determinista, mallas, reporte de contraejemplo |
| `src/__tests__/dosis-invariantes-property.test.ts` | **NUEVO** | las 6 propiedades de §4; es el "invariante universal en CI" |
| `src/lib/expediente/pediatria.ts` | **refactor puro mínimo**: extraer y **exportar** `tomasDiaDe(f: FarmacoPed): number` (la expresión ya inline en `pediatria.ts:170`) y exportar `tomasPorIntervalo` | el test necesita las tomas/día para comprobar `porToma × tomas ≤ topeDia`. **Re-implementarlas en el test sería inaceptable**: el test coincidiría con el bug del motor. Cero cambio de comportamiento |
| `docs/clinical-decisions/dosis-pediatrica.md` | editar | añadir el invariante nuevo y la tolerancia de redondeo declarada |
| `src/lib/clinical/registry.ts:132` | editar | añadir `dosis-invariantes-property.test.ts` a `goldenTests` del motor `dosis-pediatrica` |
| `docs/audit/regression-ledger.md` | editar | REG-013/REG-018 pasan a citar también el test property-based |
| `.github/workflows/ci.yml` | **no se toca** | `npx vitest run` ya lo recoge |

**No se toca** `calcularDosisPediatrica` en su lógica, ni `PanelPediatria.tsx`, ni
`copiloto.ts`, ni `clinical-safety-harness.test.ts` (el bloque REG-018 de ahí está citado por el
ledger y por el registry: **se deja intacto**, el archivo nuevo lo amplía, no lo sustituye).

---

## 4. Contrato de lo nuevo

### 4.1 Arnés — `src/__tests__/_harness/property.ts`

```ts
/** PRNG determinista (LCG). Sin Math.random: la misma semilla da la misma corrida. */
export function prng(semilla: number): () => number

/**
 * Malla de pesos pediátricos en kg: rejilla fija (bordes + valores clínicos típicos)
 * ∪ `extra` pesos pseudoaleatorios reproducibles en [0.5, 120].
 * Tope 120 kg = límite de `revisarPesoPediatrico` (arriba de eso hay hard-stop, no dosis).
 */
export function mallaPesosKg(opts?: { semilla?: number; extra?: number }): number[]

/** Malla de edades en meses. INCLUYE `undefined`: `copiloto.ts:211` llama sin edad. */
export const MALLA_EDADES_MESES: readonly (number | undefined)[]

/**
 * Recorre todos los casos y aplica `prop`. Al primer fallo, el mensaje incluye el
 * caso EXACTO (contraejemplo reproducible) — el sustituto honesto del shrinking.
 */
export function paraTodo<T>(
  casos: Iterable<T>,
  etiqueta: (caso: T) => string,
  prop: (caso: T) => void,
): void
```

### 4.2 Refactor puro — `src/lib/expediente/pediatria.ts`

```ts
/** Tomas al día que realmente aplica el motor. Puro. (Antes inline en el cálculo.) */
export function tomasDiaDe(f: FarmacoPed): number   // = f.mgKgDosis ? tomasPorIntervalo(f.intervalo) : (f.tomas ?? 1)
export function tomasPorIntervalo(intervalo: string): number   // ya existe; solo se exporta
```

`calcularDosisPediatrica` pasa a usar `tomasDiaDe(f)`. Mismo valor, mismo orden, misma salida.

### 4.3 Propiedades — `src/__tests__/dosis-invariantes-property.test.ts`

Constantes declaradas **en el test**, con su razón:

```ts
/** El motor redondea a 1 decimal AL MÁS CERCANO → hasta 0.05 mg de holgura por toma. */
const TOL_TOMA = 0.05
/** Unidades permitidas hoy en FARMACOS_PED. Fail-closed: una unidad nueva ROMPE el CI a propósito. */
const UNIDADES_PERMITIDAS = ['mg', 'mg de TMP'] as const
```

**P1 — Forma del catálogo (fail-closed, protege al fármaco nº 26).** Para cada `FarmacoPed`:
nombre único y no vacío; `unidad ∈ UNIDADES_PERMITIDAS`; declara **al menos un** tope
(`topeDosis | topeDia | topeMgKgDia`) — si no, el invariante de aceptación sería *vacuamente*
cierto; exactamente uno de `mgKgDosis | mgKgDia`; rango ordenado y finito y > 0; `tomas ≥ 1`
cuando usa `mgKgDia`; `dosisMinima ≤ topeDosis`; `edadMinimaMeses ≥ 0` implica
`restriccionEdad` no vacío.

**P2 — ACEPTACIÓN. `∀ fármaco × peso ∈ mallaPesosKg({extra:200}) × edad ∈ MALLA_EDADES_MESES`:**
 a. `porToma.max ≤ topeDosis` (si está declarado).
 b. `porDia.max ≤ topeDia` y `porDia.max ≤ topeMgKgDia × peso` (si están declarados).
 c. `porToma.max × tomasDiaDe(f) ≤ tope + TOL_TOMA × tomasDiaDe(f)` — **es la dosis por toma la
    que se escribe en la receta**, así que el techo diario debe sostenerse al multiplicarla.
    La tolerancia es el presupuesto de redondeo, explícito y acotado.
 d. `porToma.min ≤ porToma.max`, `porDia.min ≤ porDia.max`, `porToma ≤ porDía` (REG-018).
 e. Todo finito, no negativo, sin `NaN`.

**P3 — Monotonía en peso.** A edad fija, `porToma.max` y `porDia.max` son no decrecientes al
subir el peso (con topes: no decrecientes, nunca decrecientes). Caza un tope mal propagado que
haga "bajar" la dosis al subir el peso.

**P4 — Contraindicación por edad domina.** Si `edadMeses < edadMinimaMeses` ⇒
`contraindicadoPorEdad === true` **y** `porToma = porDia = {min:0,max:0}` **y** `motivoEdad` no
vacío. Nunca una dosis usable por debajo de la edad mínima.

**P5 — Unidad obligatoria en el verificador adulto** (`src/lib/seguridad/dosis.ts`):
`extraerMg` sobre texto solo-volumen (`"5 mL"`, `"1 cc"`) ⇒ `null` en toda la malla (nunca lee
mL como mg); `revisarDosis` de un fármaco fuera del catálogo ⇒ **siempre** alerta
`sin_referencia` (ausencia de alerta jamás significa "seguro"); si `dosisMg > maxTomaMg` ⇒
existe alerta crítica; si `dosisMg × tomas > maxDia` ⇒ existe `sobre_maximo_diario`;
`CATALOGO` internamente coherente (`maxTomaMg ≤ maxDiaMg`, `maxDiaOralMg ≤ maxDiaMg`,
`pedMaxMgKgToma ≤ pedMaxMgKgDia`).

**P6 — Coherencia ENTRE los dos motores.** Para cada fármaco pediátrico que `buscarFarmaco`
encuentre en el `CATALOGO` adulto, la dosis que emite el motor pediátrico **no** debe disparar
una alerta de severidad ≥ `alta` en `revisarDosis`. Hoy **falla** en Amoxicilina y
Amoxicilina-clavulanato (§6) ⇒ se implementa con una lista de excepción **explícita y
nominal**:

```ts
/** NEEDS_CLINICAL_REVIEW — contradicciones conocidas entre catálogos, pendientes del Dr.
 *  Cada entrada cita la pregunta abierta. Una contradicción NUEVA rompe el CI. */
const INCOHERENCIAS_CONOCIDAS = ['Amoxicilina', 'Amoxicilina-clavulanato'] as const
```

Así el hallazgo queda **visible y versionado**, el CI no se cae hoy, y ninguna contradicción
nueva puede entrar en silencio. **No se elige ningún techo: eso lo decide el médico.**

---

## 5. Riesgo de regresión REAL

**Bajo.**

- Lo nuevo es 100 % test + un arnés que **no se importa desde `src/lib` ni desde la app** →
  no entra al bundle de producción, no toca impresión, cobros, firma ni PHI.
- El único cambio en código de producción es extraer/exportar `tomasDiaDe` y `tomasPorIntervalo`
  en `pediatria.ts`: funciones puras, misma expresión, mismo resultado; cubiertas por
  `pediatria.test.ts` y por el bloque REG-018 de `clinical-safety-harness.test.ts`.
- Riesgo residual real: **un invariante fail-closed (P1/P6) puede tumbar el CI en el futuro** al
  agregar un fármaco con unidad nueva o sin tope. **Es el efecto buscado** (obliga a revisión
  clínica explícita), y está documentado en el ADR para que no sorprenda.
- Coste: la malla P2 son ~25 fármacos × ~240 pesos × 9 edades ≈ 54 000 evaluaciones de una
  función pura; el barrido equivalente corrió en <15 ms. No frena el CI.

---

## 6. NEEDS_CLINICAL_REVIEW — preguntas concretas para el médico

Ninguna bloquea la implementación de E0-02 (se entrega con la excepción documentada de P6);
las tres piden un dato que **no está en el repo y que no voy a inventar**.

1. **Amoxicilina, techo POR TOMA en pediatría.** `FARMACOS_PED` (`pediatria.ts:56`) da
   45–90 mg/kg/día en 2 tomas con `topeDia` 3000 mg ⇒ desde ~33.3 kg emite **1500 mg por toma**.
   `CATALOGO` adulto (`dosis.ts:54`) declara `maxTomaMg: 1000`, así que `revisarDosis` marca esa
   misma receta como `sobre_maximo_dosis` (crítica). ¿Cuál manda: 1000 mg/toma (y entonces
   `FARMACOS_PED` necesita `topeDosis: 1000`) o 1500 mg/toma (y entonces sube `maxTomaMg` en el
   catálogo adulto)? Aplica igual a Amoxicilina-clavulanato, que se dosifica por el componente
   amoxicilina.
2. **Dirección del redondeo en el techo.** El motor redondea a 1 decimal al más cercano, lo que
   puede dejar el total diario 0.1 mg por encima del tope (Metronidazol @66.7 kg = 2000.1 vs
   2000; Gentamicina neonatal @51.3 kg = 256.6 vs 256.5). ¿Se acepta esa tolerancia declarada
   (±0.05 mg por toma) o el motor debe **redondear siempre HACIA ABAJO cuando toca un tope**?
   (La segunda opción es un cambio de comportamiento del motor, fuera del alcance de E0-02.)
3. **Cobertura del catálogo adulto.** 22 de los 25 fármacos pediátricos (todos los antibióticos
   salvo amoxicilina, más prednisona, ondansetrón, etc.) **no existen** en el `CATALOGO` de
   `seguridad/dosis.ts` ⇒ `revisarDosis` devuelve `sin_referencia` y no impone ningún techo al
   prescribirlos a un adulto. ¿Se amplía ese catálogo? Requiere que usted aporte
   `maxTomaMg`/`maxDiaMg` por fármaco: no se derivan de las cifras pediátricas.

---

## 7. Definición de terminado

1. `npx vitest run` verde con el archivo nuevo (y los ~1885 tests previos intactos).
2. `npx tsc --noEmit` verde.
3. Se comprueba que P2 **detecta** la regresión: bajando a mano `topeMgKgDia` de Amikacina a 10
   sin tocar el motor, la propiedad debe fallar señalando fármaco y peso exactos (y luego se
   revierte). Sin esa comprobación, un invariante verde no prueba nada.
4. ADR, registry y regression-ledger actualizados; `estado.json` con E0-02 completada y las
   3 preguntas en `necesitaValidacionDelDr`.
