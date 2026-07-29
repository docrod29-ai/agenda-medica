# E2-01 — Modelo Claim / Source / Passage · DISEÑO

> **Estado:** diseño **verificado con el compilador real del repo** (`node_modules/.bin/tsc` en modo `strict`). NO implementado: en esta unidad no se tocó una sola línea de código de producción.
> **Etapa:** E2 (Nexus Evidence). **Riesgo declarado en backlog:** bajo. **Riesgo real del cambio tal como está diseñado:** bajo (§8). **Dependencias:** ninguna. **Habilita:** E2-02 (PICO), E2-03 (retrieval multi-fuente), E2-05 (claim-level citation) y E2-06 (verificador de entailment).
> **Línea base de tests del repo:** 2164 (último `run` en `estado.json`, E0-09).

---

## 0. Resumen ejecutivo

La aceptación de E2-01 es una sola frase: **«una afirmación sin pasaje de respaldo no puede construirse»**. Es falsable, y se falsó **contra el compilador del repo antes de escribir este diseño** (§4.3).

**Hallazgo 1 — el agujero es real y está en producción hoy, no es teórico.** En `src/app/(dashboard)/consulta/[patientId]/page.tsx:2698` el render de las citas es:

```ts
const citas = (nums?: number[]) => (nums ?? []).filter(n => arts[n - 1]).map(...)
```

Un índice de cita **fuera de rango se descarta en silencio**. Consecuencia: una afirmación clínica que el modelo respaldó con `citas:[9]` cuando sólo hay 6 artículos se pinta **exactamente igual** que una afirmación sin citar — viñeta, negritas y ninguna marca. Y el prompt del servidor autoriza explícitamente el caso vacío: *«"citas" es un arreglo (posiblemente vacío)»* (`src/app/api/expediente/evidencia/route.ts:153`). Hoy, en la pantalla de consulta, **una afirmación sin pasaje de respaldo no sólo puede construirse: se muestra al médico como hecho**.

**Hallazgo 2 — el diseño obvio NO cumple la aceptación.** Pedir `apoyos: readonly [Passage, ...Passage[]]` (tupla no vacía) bloquea `claim('…', [])`, pero **no** bloquea `claim('…', [{ sourceId:'s1', texto:'x', inicio:0, fin:1 }])`: sin marca fantasma, cualquiera fabrica un `Passage` a mano y la afirmación queda «respaldada» por un pasaje inventado. Control negativo ejecutado hoy (§4.4): al quitar las marcas, **2 de los 6 casos negativos dejan de fallar** y `tsc` sale con `TS2578`. La marca es load-bearing, igual que en E0-04.

**Hallazgo 3 — la mitad del problema no la resuelve el compilador.** El `Claim` no nace de código escrito a mano: nace de **JSON que devuelve un LLM**. Ahí el tipo no protege nada. Por eso el diseño tiene **dos puertas**: la del compilador (§4) y una puerta de entrada en runtime (§5) que devuelve `Resultado` — nunca lanza, nunca inventa y **nunca descarta en silencio**.

**Cambio propuesto: 4 archivos nuevos, 0 archivos de producción modificados.** El cableado de las rutas y el render por afirmación es **E2-05**, deliberadamente fuera de esta unidad.

---

## 1. Qué pide la unidad (backlog literal)

| Campo | Valor |
|---|---|
| Objetivo | Estructura de evidencia con población, diseño, efecto, limitaciones y fecha |
| Entregables | `types/evidence.ts` · tests |
| Aceptación | **Una afirmación sin pasaje de respaldo no puede construirse** |
| Depende | — |
| Riesgo | bajo |
| validacionClinica | **false** |

Los tres nombres del título (`Claim`, `Source`, `Passage`) se conservan en inglés porque son los del backlog; los tipos auxiliares van en español, como el resto del repo (`ArticuloPubMed`, `FuenteEvidencia`). Se documenta para que la mezcla no se lea como deriva.

---

## 2. Qué existe YA en el repo (no rehacer)

| Pieza existente | Dónde | Qué hace y qué le falta |
|---|---|---|
| Cliente de PubMed con throttle | `src/lib/evidencia/pubmed.ts` (`buscarEvidencia`, `buscarEvidenciaMulti`, `textoCompletoPMC`) | **Ya resuelve el retrieval**. E2-01 no lo toca ni lo reemplaza. |
| `ArticuloPubMed` | `src/lib/evidencia/pubmed.ts:17-28` | `{pmid, titulo, revista, anio, resumen, url, tipo?, doi?}`. Es el **Source embrionario**: le falta fecha de recuperación, texto recuperado como campo con contrato, y no tiene pasajes. |
| Jerarquía de evidencia implícita | `src/lib/evidencia/pubmed.ts:60` (`RANK = { 'Meta-análisis':0, 'Guía':1, 'ECA':2, 'Revisión':3, '':4 }`) | **Ya existe una jerarquía, y nadie la validó.** Colapsa todo a 5 cubetas y pone `Guía` por encima de `ECA`. Es criterio metodológico. **E2-01 NO la copia ni la consagra** (§7, pregunta Q1). La jerarquía es E2-03, cuyo `validacionClinica` es `true`. |
| Evidencia estructurada de UCI | `src/lib/uci/evidencia.ts:17-27` (`FuenteEvidencia`) y `:28-41` (`ReglaEvidencia` con `poblacion`, `limitaciones`, `fuerza`, `calidad`) | **Precedente directo del repo** de «regla anclada a fuente, con población y limitaciones». Le falta el **pasaje**: `verified: boolean` es un booleano puesto a mano, no un fragmento literal verificable. **No se toca** (lo importan `src/app/(dashboard)/uci/page.tsx:33` y su test): E2-03/E2-04 lo adaptarán. |
| Contrato claim→cita ya en producción | `src/app/api/expediente/evidencia/route.ts:153` y `:160-164` (`norm`) | El modelo ya devuelve `{punto, sustento, citas:[n]}`: **la intención de claim-level citation existe**. `norm()` acepta cualquier cosa que sea `Array` — no valida rango, no valida no-vacío. |
| Render que descarta citas en silencio | `src/app/(dashboard)/consulta/[patientId]/page.tsx:2698` | El agujero del Hallazgo 1. **No se toca en E2-01** (es E2-05, y toca UI de consulta). |
| Verificación determinista de rango | `src/app/(dashboard)/consultor/page.tsx:24-25` (`citasEnTexto`) y `:173-180` | El Consultor **sí** cuenta las citas fuera de rango y pinta un banner ámbar. Es cosmético (el texto se muestra igual) y vive sólo en esa pantalla. Prueba que el equipo ya sabe que el problema existe. |
| `ClinicalQuantity` (E0-04) | `src/types/clinical-quantity.ts:92-120` | **El patrón que E2-01 replica**: marca fantasma no exportada + fábrica única + `cantidadDesde` que devuelve `null` en vez de inventar. |
| Casos negativos de compilación | `src/__tests__/tipos/clinical-quantity.tipos.ts` + guardián en `src/__tests__/clinical-quantity.test.ts:29-60` | **Infraestructura ya montada**: `tsconfig.json` incluye `**/*.ts` (los `.tipos.ts` sí se typechequean) y `vitest.config.ts` sólo corre `*.test.ts` (no se ejecutan). E2-01 reutiliza el patrón tal cual. |
| Decisiones del Dr. sobre fuentes | `docs/clinical-decisions/DECISIONES-ARQUITECTURA-2026-07-28.md:279-310` (D1, D2, D3) | **Ya respondidas**: catálogo `ENABLED` vs `LICENSE_UNKNOWN`, presupuesto $0, e idioma (fuente en original, síntesis en español). E2-01 las **codifica**; no inventa ninguna. |
| Trinquete de ADRs (E0-03) | `src/lib/clinical/adr-cobertura.ts` (`DEUDA_ADR_CONGELADA = 52`) | Sólo cuenta motores de `CLINICAL_ENGINE_REGISTRY`. E2-01 **no registra motor** (no calcula nada clínico, igual que E0-04) ⇒ **deuda intacta, CI sin impacto**. |

**Conclusión de la exploración:** hay retrieval, hay un contrato claim→cita y hay un precedente de evidencia estructurada. **Lo que no existe en ninguna parte es el `Passage`**: el fragmento literal de la fuente que respalda la afirmación. Eso es exactamente lo que E2-01 aporta, y es lo que convierte «5 referencias al final» en evidencia auditable.

---

## 3. Los tres nombres, y qué invariante protege cada uno

| Tipo | Qué es | Invariante que hace cumplir |
|---|---|---|
| `Source` | Un documento recuperado de un proveedor **habilitado**, con su texto recuperado y **dos fechas distintas**: publicación (con precisión variable) y recuperación. | No se puede construir desde un proveedor `LICENSE_UNKNOWN`, ni sin texto recuperado. |
| `Passage` | Un fragmento **literal** del `textoRecuperado` de un `Source`, con offsets y un id determinista. | **Sólo puede existir si el texto aparece TAL CUAL en la fuente.** Una paráfrasis no es un pasaje. |
| `Claim` | Una afirmación en español (síntesis, D3) + **uno o más** `Passage`. | **No existe `Claim` sin `Passage`.** Ni en compilación ni en runtime. |
| `Estudio` (auxiliar) | Un `Source` + población, diseño, efecto y limitaciones, **cada campo anclado a un pasaje de ese mismo source**. | Cubre el objetivo del backlog («población, diseño, efecto, limitaciones y fecha») sin permitir que ningún campo se rellene de la nada. |

---

## 4. La parte falsable: qué rechaza el compilador (verificado hoy)

### 4.1 El núcleo del tipo

```ts
declare const MARCA_SOURCE:  unique symbol   // NO exportadas: sin fábrica no hay objeto
declare const MARCA_PASAJE:  unique symbol
declare const MARCA_CLAIM:   unique symbol
declare const MARCA_ESTUDIO: unique symbol

/** Tupla NO VACÍA. `Passage[]` no es asignable a esto: hay que probar el primer elemento. */
export type NoVacio<T> = readonly [T, ...T[]]

export interface Passage {
  readonly id: string          // determinista: `${sourceId}#${inicio}-${fin}` (sin Date.now, sin random)
  readonly sourceId: string
  readonly texto: string       // subcadena LITERAL de Source.textoRecuperado
  readonly inicio: number
  readonly fin: number
  readonly [MARCA_PASAJE]: (p: 'passage') => 'passage'
}

export interface Claim {
  readonly id: string
  readonly texto: string              // síntesis en español (D3)
  readonly apoyos: NoVacio<Passage>   // ← LA ACEPTACIÓN, en el tipo
  readonly [MARCA_CLAIM]: (c: 'claim') => 'claim'
}
```

Dos propiedades deliberadas, heredadas de E0-04:

- **Las marcas no se exportan** ⇒ desde fuera del módulo es imposible escribir el objeto a mano y hacerlo pasar por `Passage`/`Claim`. La única puerta es la fábrica.
- **La marca es una función de un literal a un literal** (posición contravariante y covariante a la vez) ⇒ el tipo es invariante y no se ensancha. Con `readonly marca?: never` **no basta**: §4.4.

### 4.2 Los campos que pide el objetivo, sin permitir que se inventen

```ts
export type MotivoAusencia =
  | 'no_reportado_en_la_fuente'   // la fuente no lo dice
  | 'no_extraido_todavia'         // aún no se intentó extraer
  | 'no_aplica_a_este_diseno'     // p. ej. "efecto" en una guía narrativa

/**
 * Un dato de la evidencia: o se conoce Y SE SABE DE QUÉ PASAJE SALIÓ, o se declara
 * ausente con motivo. NO hay tercera forma: `undefined` significando "normal" o
 * "ninguno" es el bug que este tipo existe para impedir (doctrina `missing ≠ 0`
 * del registry y de `num()`).
 */
export type Declarado<T> =
  | { readonly conocido: true;  readonly valor: T; readonly pasajeId: string }
  | { readonly conocido: false; readonly motivo: MotivoAusencia }

/** Taxonomía DESCRIPTIVA. Deliberadamente SIN peso ni rango: la jerarquía es E2-03. */
export type DisenoDeEstudio =
  | 'metaanalisis' | 'revision_sistematica'
  | 'ensayo_clinico_aleatorizado' | 'ensayo_clinico_no_aleatorizado'
  | 'cohorte' | 'casos_y_controles' | 'transversal'
  | 'serie_de_casos' | 'reporte_de_caso'
  | 'guia_de_practica_clinica' | 'documento_regulatorio'
  | 'revision_narrativa' | 'preclinico'
  | 'otro' | 'no_declarado'

export type MedidaDeEfecto =
  | 'HR' | 'RR' | 'OR' | 'diferencia_de_riesgo' | 'diferencia_de_medias'
  | 'NNT' | 'NNH' | 'proporcion' | 'otra'

export interface Efecto {
  readonly medida: MedidaDeEfecto
  readonly valor: number
  readonly ic95?: readonly [number, number]
  readonly p?: number
  readonly unidad?: string
  /** La cifra TAL CUAL aparece en el pasaje. Si no aparece literal, no hay efecto. */
  readonly citaLiteral: string
}

export interface Poblacion {
  readonly descripcion: string
  readonly n?: number
  readonly criteriosInclusion?: readonly string[]
  readonly criteriosExclusion?: readonly string[]
}

export interface Estudio {
  readonly source: Source
  readonly poblacion:    Declarado<Poblacion>
  readonly diseno:       Declarado<DisenoDeEstudio>
  readonly efecto:       Declarado<Efecto>
  readonly limitaciones: Declarado<readonly string[]>
  readonly [MARCA_ESTUDIO]: (e: 'estudio') => 'estudio'
}
```

**Regla explícita sobre `limitaciones`:** `{ conocido: true, valor: [] }` **se rechaza en construcción**. Un arreglo vacío es ambiguo («la fuente no declaró limitaciones» vs. «no las extrajimos»), y la ambigüedad aquí se lee como «este estudio no tiene limitaciones», que es la lectura más peligrosa posible. Hay que decir cuál de las dos es, con `motivo`.

**Las fechas — dos, y con precisión honesta:**

```ts
/** PubMed a veces sólo da el AÑO (`pubmed.ts:119` extrae `<Year>`). Completar a
 *  '2024-01-01' inventa 11 meses; este tipo conserva la precisión que había. */
export type FechaPublicacion =
  | { readonly precision: 'anio';  readonly iso: `${number}` }
  | { readonly precision: 'mes';   readonly iso: `${number}-${number}` }
  | { readonly precision: 'dia';   readonly iso: string }
  | { readonly precision: 'desconocida' }

export interface Source {
  readonly id: string                  // `${proveedor}:${idExterno}` (p. ej. `pubmed:38412345`)
  readonly proveedor: ProveedorHabilitado
  readonly idExterno: string           // PMID, DOI, NCT…
  readonly titulo: string
  readonly contenedor?: string         // revista / organización
  readonly publicado: FechaPublicacion
  readonly recuperadoEn: string        // instante ISO de la recuperación (métrica de freshness, D2)
  /** El texto sobre el que se pueden anclar pasajes. Hoy = abstract público (+ PMC OA). */
  readonly textoRecuperado: string
  readonly url?: string
  readonly [MARCA_SOURCE]: (s: 'source') => 'source'
}
```

### 4.3 Casos negativos — ejecutados hoy con el `tsc` del repo

Prototipo en el scratchpad, compilado con `node_modules/.bin/tsc --noEmit --strict`. **`EXIT=0`**: cada `@ts-expect-error` encontró su error y los casos positivos compilaron.

| # | Caso | ¿Rechaza? |
|---|---|---|
| 1 | `claim('afirmación sin respaldo', [])` | ✅ |
| 2 | `const quizaVacio: Passage[] = []; claim('…', quizaVacio)` (arreglo suelto, posiblemente vacío) | ✅ |
| 3 | `claim('…', [{ sourceId:'s1', texto:'x', inicio:0, fin:1 }])` (pasaje fabricado a mano) | ✅ |
| 4 | `const c: Claim = { texto:'a', apoyos:[p] }` (claim fabricado a mano) | ✅ |
| 5 | `claim('…', [pasaje(s,'no existe')])` (el `Resultado`/`null` de la fábrica no se cuela sin comprobar) | ✅ |
| 6 | `fuente({ proveedor: 'uptodate', … })` (proveedor `LICENSE_UNKNOWN`, §6) | ✅ |

### 4.4 Control negativo (por qué la marca no es adorno)

Sustituyendo las marcas por `readonly marcaClaim?: never` y recompilando el mismo archivo:

```
negativos-sinmarca.ts(20,1): error TS2578: Unused '@ts-expect-error' directive.
negativos-sinmarca.ts(24,1): error TS2578: Unused '@ts-expect-error' directive.
EXIT=2
```

Los casos **3 y 4** dejan de fallar: sin marca, **un `Passage` inventado y un `Claim` inventado compilan**, y la aceptación de E2-01 queda sin cumplir aunque el CI esté verde. Por eso el test guardián (§6) verifica que la línea de la marca siga en el archivo, igual que `clinical-quantity.test.ts:50-56`.

---

## 5. La otra mitad: la puerta de runtime (donde de verdad entra el JSON del LLM)

El compilador no ve el `JSON.parse` de la respuesta del modelo. Todas las fábricas son **totales**: no lanzan, no inventan y **no descartan en silencio**.

```ts
export type Resultado<T, M extends string> =
  | { readonly ok: true;  readonly valor: T }
  | { readonly ok: false; readonly motivo: M; readonly detalle: string }

export type MotivoRechazoPasaje =
  | 'PASAJE_VACIO' | 'PASAJE_NO_LITERAL' | 'PASAJE_DEMASIADO_CORTO' | 'FUENTE_DESCONOCIDA'

export type MotivoRechazoClaim =
  | 'TEXTO_VACIO'
  | 'SIN_PASAJE'          // ← el caso `citas: []` de hoy
  | 'CITA_FUERA_DE_RANGO' // ← el bug de consulta/page.tsx:2698, ahora explícito
  | 'PASAJE_NO_LITERAL'
  | 'CIFRA_NO_LITERAL'    // el efecto reporta un número que no está en el pasaje

export function fuente(input: EntradaSource): Resultado<Source, MotivoRechazoSource>
export function pasaje(s: Source, textoCitado: string, opts?: { minimoCaracteres?: number }): Resultado<Passage, MotivoRechazoPasaje>
export function claim(texto: string, apoyos: NoVacio<Passage>): Resultado<Claim, 'TEXTO_VACIO'>
export function estudio(entrada: EntradaEstudio): Resultado<Estudio, MotivoRechazoEstudio>

/** ÚNICA puerta para datos que vienen de fuera (LLM, Firestore, HTTP). */
export function claimDesde(datos: unknown, fuentes: readonly Source[]): Resultado<Claim, MotivoRechazoClaim>

/** Rehidratar un Claim serializado: la marca sólo existe en el tipo, así que
 *  un objeto que vuelve de Firestore NO es un Claim hasta pasar por aquí. */
export function claimDesdeJSON(datos: unknown, fuentes: readonly Source[]): Resultado<Claim, MotivoRechazoClaim>
```

Reglas de las fábricas:

1. **Literalidad, no entailment.** `pasaje()` exige que `textoCitado` sea **subcadena** de `s.textoRecuperado` tras una normalización **conservadora**: colapsar espacios/saltos y unificar guiones y comillas tipográficas Unicode. **No** se normalizan dígitos, separadores decimales ni acentos: si la fuente escribe `0·72` (estilo *Lancet*) y el modelo escribe `0.72`, **no coincide y se rechaza**. Preferimos un `UNSUPPORTED` honesto a una coincidencia inventada. *Comprobar que el pasaje **implica** la afirmación es E2-06, no esto.*
2. **`minimoCaracteres` (por defecto 40) es una guarda de SOFTWARE, no un umbral clínico.** Un fragmento de 3 caracteres (`"10%"`) es subcadena de casi cualquier abstract y volvería la verificación literal decorativa. Es un parámetro, va documentado como arbitrario y ajustable, y **no aparece en ningún ADR clínico porque no decide nada médico**.
3. **`CITA_FUERA_DE_RANGO` es un rechazo, no un descarte.** Es el punto exacto donde E2-05 dejará de perder información: hoy el índice inválido desaparece y la afirmación se pinta como si nada.
4. **Nada de `Date.now()` ni `Math.random()` dentro de las fábricas.** `Passage.id` y `Claim.id` son deterministas (derivados de `sourceId` + offsets y del texto + ids de apoyos). Un mismo input produce el mismo id ⇒ los tests son reproducibles y los objetos deduplicables (lo necesita E2-04).

---

## 6. Archivos a tocar

**Ninguno de producción se modifica.** Cuatro archivos nuevos:

| Archivo | Qué es | Por qué |
|---|---|---|
| `src/types/evidence.ts` | **NUEVO** — entregable del backlog. Tipos + marcas + fábricas puras. | Sin dependencias de red ni de Firebase. No lee `process.env`. |
| `src/lib/evidencia/desde-pubmed.ts` | **NUEVO** — adaptador `sourceDesdeArticuloPubMed(a: ArticuloPubMed, recuperadoEn: string): Resultado<Source, …>`. | Hace real el tipo sin tocar rutas. **Debe importar `ArticuloPubMed` con `import type`**: `pubmed.ts:15` lee `process.env.NCBI_API_KEY` en el momento del import, y un import de valor arrastraría ese efecto a todo consumidor de los tipos. |
| `src/__tests__/tipos/evidence.tipos.ts` | **NUEVO** — los 6 casos negativos de §4.3, con `@ts-expect-error`. | Lo typechequea `tsc` (incluido por `tsconfig.json`), **no** lo ejecuta vitest (`vitest.config.ts` sólo corre `*.test.ts`). Es *la* prueba de la aceptación. |
| `src/__tests__/evidence-model.test.ts` | **NUEVO** — runtime + guardián del gate del compilador. | Patrón de `clinical-quantity.test.ts:29-60`. |

**PARTE 2 (recomendada, dentro de `src/types/evidence.ts`) — catálogo de proveedores con licencia.** Codifica la decisión **D1 ya tomada por el Dr.** (`DECISIONES-ARQUITECTURA-2026-07-28.md:279-294`), sin añadir criterio nuevo:

```ts
export const PROVEEDORES = {
  pubmed:         { nombre: 'PubMed/MEDLINE',   licencia: 'ENABLED' },
  pmc:            { nombre: 'PubMed Central',   licencia: 'ENABLED' },
  crossref:       { nombre: 'Crossref',         licencia: 'ENABLED' },
  clinicaltrials: { nombre: 'ClinicalTrials.gov', licencia: 'ENABLED' },
  who:            { nombre: 'WHO',              licencia: 'ENABLED' },
  cdc:            { nombre: 'CDC',              licencia: 'ENABLED' },
  fda_dailymed:   { nombre: 'FDA/DailyMed',     licencia: 'ENABLED' },
  ema:            { nombre: 'EMA',              licencia: 'ENABLED' },
  idsa_publica:   { nombre: 'IDSA (pública)',   licencia: 'ENABLED' },
  escmid_publica: { nombre: 'ESCMID (pública)', licencia: 'ENABLED' },
  eucast:         { nombre: 'EUCAST',           licencia: 'ENABLED' },
  uptodate:       { nombre: 'UpToDate',         licencia: 'LICENSE_UNKNOWN' },
  accessmedicine: { nombre: 'AccessMedicine',   licencia: 'LICENSE_UNKNOWN' },
  clinicalkey:    { nombre: 'ClinicalKey',      licencia: 'LICENSE_UNKNOWN' },
  revista_de_pago:{ nombre: 'Revista de pago',  licencia: 'LICENSE_UNKNOWN' },
  clsi:           { nombre: 'CLSI',             licencia: 'LICENSE_UNKNOWN' },
} as const

export type Proveedor = keyof typeof PROVEEDORES
export type ProveedorHabilitado =
  { [K in Proveedor]: (typeof PROVEEDORES)[K]['licencia'] extends 'ENABLED' ? K : never }[Proveedor]
```

Efecto: **construir un `Source` de UpToDate o de CLSI no compila** (caso negativo 6). No es un adorno legal — el propio documento del Dr. advierte que no se debe *«convertir una copia personal del estándar en una base comercial redistribuida»* (`:290-294`). Si esta parte complica la implementación, puede diferirse a E2-03 sin afectar la aceptación de E2-01; el resto del diseño no depende de ella.

### Tests

`src/__tests__/evidence-model.test.ts` — todo con **fixtures sintéticos** (un abstract ficticio escrito para el test; cero PHI, cero red):

**Guardián del gate del compilador** (mismo patrón que E0-04):
1. `src/__tests__/tipos/evidence.tipos.ts` existe.
2. Conserva **≥6 `@ts-expect-error` activos** (no comentados) — comentarlos «arregla» el CI y abre el agujero.
3. Cubre el caso textual de la aceptación (`claim('…', [])`).
4. Las cuatro marcas (`SOURCE`, `PASAJE`, `CLAIM`, `ESTUDIO`) siguen en `src/types/evidence.ts` con la forma `(x: 'literal') => 'literal'` (control negativo de §4.4).
5. Ninguna marca se exporta.

**Aceptación y runtime:**
6. **ACEPTACIÓN:** `claimDesde({ texto:'…', citas: [] }, fuentes)` ⇒ `ok:false`, `motivo:'SIN_PASAJE'`. Nunca devuelve un `Claim`.
7. Índice de cita fuera de rango ⇒ `CITA_FUERA_DE_RANGO` (hoy: descarte silencioso).
8. Paráfrasis que no es subcadena ⇒ `PASAJE_NO_LITERAL`.
9. Coincidencia literal con espacios/saltos distintos y guiones Unicode ⇒ **acepta** (normalización conservadora).
10. `0·72` frente a `0.72` ⇒ **rechaza** (no se normalizan dígitos).
11. Pasaje de 3 caracteres ⇒ `PASAJE_DEMASIADO_CORTO`.
12. `Efecto.citaLiteral` que no aparece en el pasaje ⇒ `CIFRA_NO_LITERAL`.
13. `limitaciones: { conocido:true, valor: [] }` ⇒ rechazado (hay que declarar el motivo).
14. Fecha sólo con año ⇒ `precision:'anio'`, y **no** se completa a `-01-01`.
15. `Declarado` con `conocido:true` cuyo `pasajeId` no pertenece al `Source` del estudio ⇒ rechazado.
16. Ids deterministas: mismo input ⇒ mismo `Passage.id` / `Claim.id`, en dos construcciones separadas.
17. Ida y vuelta por `JSON.stringify` + `claimDesdeJSON` reconstruye un `Claim` equivalente; un JSON manipulado al que se le quitaron los apoyos ⇒ `SIN_PASAJE`.
18. `sourceDesdeArticuloPubMed` sobre un `ArticuloPubMed` ficticio con `resumen: ''` ⇒ `ok:false` (sin texto no hay pasajes posibles), y con resumen ⇒ `ok:true` con `recuperadoEn` = el que se le pasó (no `Date.now()`).

**Prueba de que el test sirve** (exigible en el RESULTADO): quitar la marca de `Claim` ⇒ el guardián #4 y 2 casos de `.tipos.ts` en rojo; sustituir `NoVacio<Passage>` por `readonly Passage[]` ⇒ casos 1, 2 y 6 en rojo.

---

## 7. Lo que E2-01 NO hace (y por qué)

| Fuera de alcance | Dónde vive | Por qué no aquí |
|---|---|---|
| Jerarquía / peso de la evidencia | **E2-03** (`validacionClinica: true`) | Decidir que una guía pesa más que un ECA es criterio metodológico. `DisenoDeEstudio` es una taxonomía **descriptiva sin orden**. |
| Entailment (¿el pasaje **dice** lo que la afirmación afirma?) | **E2-06** | E2-01 sólo garantiza **literalidad y procedencia**. Un pasaje real que no respalda la afirmación pasa este filtro y lo debe atrapar el verificador. Es una limitación **declarada**, no un descuido. |
| Cablear rutas y render por afirmación | **E2-05** | Tocar `consulta/[patientId]/page.tsx` y las dos rutas de evidencia es cambio visible en producción. Regla 5 de la carta operativa. |
| Extraer población/diseño/efecto con un LLM | **E2-02 / E2-03** | E2-01 aporta el **contenedor** y sus reglas de admisión, no el extractor. |
| Migrar `src/lib/uci/evidencia.ts` al nuevo modelo | **E2-03/E2-04** | Lo consume la pantalla de UCI (`uci/page.tsx:33`). Tocarlo hoy es riesgo sin beneficio. |
| Registrar un motor en `CLINICAL_ENGINE_REGISTRY` | — | No calcula nada clínico. Registrarlo sin ADR **subiría la deuda congelada** (`DEUDA_ADR_CONGELADA = 52`) y pondría el CI en rojo. Mismo criterio que E0-04. |

---

## 8. Riesgo de regresión REAL sobre producción

**Bajo.** Cero archivos de producción modificados; el código nuevo **no tiene ningún caller** hasta E2-05.

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| `tsc` en rojo por un `@ts-expect-error` de más en `.tipos.ts` (se typechequea en todo el repo) | media | Los 6 casos ya se compilaron hoy con el `tsc` del repo: `EXIT=0`. El guardián #2 vigila que no se comenten. |
| Import de `pubmed.ts` arrastrando `process.env.NCBI_API_KEY` (`pubmed.ts:15`) a cualquier consumidor de tipos | media | El adaptador usa **`import type`** (se borra al compilar). Verificable con un test que lea el archivo y exija `import type`. |
| Trinquete de ADRs (E0-03) o de invariantes (E0-11) en rojo | baja | No se registra motor ⇒ deuda intacta. `invariantes-clinicos.json` es un trinquete que sólo sube: añadir un archivo de test no lo baja. |
| Peso del bundle / `next build` | muy baja | Tipos + funciones puras sin dependencias; sin callers, se elimina por *tree-shaking*. |
| Colisión de nombres con el «guardián de claims» de marketing (`src/__tests__/claims-guard.test.ts`) | baja | Son cosas distintas (afirmaciones publicitarias vs. afirmaciones clínicas). Se documenta en el encabezado del archivo nuevo para que nadie los fusione. |
| E0-11 sigue **bloqueada**: `describe.skipIf(true)` apaga un archivo entero sin que el gate lo note | — | Heredado, no introducido por E2-01. El test nuevo no debe usar `skipIf`/`runIf`. |

---

## 9. Preguntas para el médico dueño — **NINGUNA BLOQUEA E2-01**

E2-01 se implementa completo sin ninguna decisión clínica: no define umbrales, ni dosis, ni pesos de evidencia. Estas tres quedan **registradas para E2-03/E2-04**, que sí las necesitan:

- **Q1 (E2-03).** `src/lib/evidencia/pubmed.ts:60` ya ordena los resultados con una jerarquía que nadie validó: `Meta-análisis(0) < Guía(1) < ECA(2) < Revisión(3) < sin tipo(4)`. ¿Es aceptable que una **guía** flote por encima de un **ECA**? ¿Y qué se hace con los diseños que hoy no distingue (cohorte, casos y controles, serie de casos, preclínico), que caen todos en la misma cubeta `''`?
- **Q2 (E2-03/E2-06).** Cuando un pasaje es **real** pero **no respalda** la afirmación, ¿qué ve el médico: la afirmación marcada como `UNSUPPORTED`, o no se muestra la afirmación? (D-Bloque C fija los niveles de alerta, pero no este caso.)
- **Q3 (E2-04).** Cuando dos fuentes habilitadas **discrepan** (guía 2023 vs. ECA 2026), ¿se muestran ambas siempre, o hay algún criterio de antigüedad a partir del cual la guía se marca como potencialmente superada? *(El backlog de E2-04 ya dice «se muestra la discordancia»; falta si hay ventana temporal.)*

---

## 10. Definición de «hecho» para esta unidad

1. `src/types/evidence.ts` existe y no importa nada con efectos de import.
2. `src/__tests__/tipos/evidence.tipos.ts` con **≥6 `@ts-expect-error` activos**, y `npx tsc --noEmit` **limpio**.
3. `src/__tests__/evidence-model.test.ts` en verde, con los 18 casos de §6, sobre fixtures sintéticos.
4. Gates: `tsc` PASS · `vitest` PASS (≥ 2164 + los nuevos) · `build` PASS.
5. Prueba de que el test sirve: quitar la marca o la tupla no vacía deja casos en rojo (§6).
6. `RESULTADO.json` escrito **en el mismo commit** que cierra la unidad (regla operativa de `estado.json`).
7. Cero archivos de producción modificados. **No desplegar.**
