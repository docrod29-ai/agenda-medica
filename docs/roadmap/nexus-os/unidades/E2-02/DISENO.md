# E2-02 — Extractor PICO · DISEÑO

> **Estado:** diseño **verificado con el compilador real del repo** (`node_modules/.bin/tsc`, `--strict`). NO implementado: no se tocó una sola línea de código de producción en esta unidad.
> **Etapa:** E2 (Nexus Evidence). **Riesgo declarado en backlog:** medio. **Riesgo real del cambio tal como está diseñado:** bajo (§10, cero archivos de producción modificados).
> **Depende:** E2-01 (`src/types/evidence.ts`, **completada**, `RESULTADO.json` en disco). **Habilita:** E2-03 (retrieval multi-fuente jerarquizado) y E2-05 (cableado).
> **Línea base de tests del repo:** **2252** (último `run` de `estado.json`, E2-01).

---

## 0. Resumen ejecutivo

La aceptación de E2-02 es una frase: **«la búsqueda se arma desde PICO, no desde embeddings del texto crudo»**. Es falsable, y **hoy el repo la incumple** — no por embeddings (no existen: `grep -rln "embedding\|pgvector\|cosineSimilarity" src` = **0 archivos**), sino por la otra mitad de la frase: **el texto crudo**.

**Hallazgo 1 — hoy la consulta la DICTA el modelo, y el código la pasa tal cual a PubMed.** En `src/app/api/consultor-evidencia/route.ts:145-147` hay un comentario que ya dice *«ángulos PICO»*… pero lo que el `system` pide (`:150`) son **líneas de consulta ya armadas** («cada línea: solo 2-6 términos clave… unidos con AND/OR si aplica»), el código las recoge como cadenas opacas (`:156-157`) y las manda a PubMed sin mirarlas (`:166`). Lo mismo en `src/app/api/expediente/evidencia/route.ts:80-95` (`consultasIA()` devuelve un arreglo de *query strings*) → `:108`. **No hay ninguna estructura entre la pregunta y PubMed:** hay una cadena que nadie puede auditar, deduplicar, relajar ni explicar.

**Hallazgo 2 — además hay tres caminos de TEXTO CRUDO literal**, que son las redes de seguridad «para nunca salir 0»:
- `consultor-evidencia/route.ts:172` → `buscarEvidencia(pregunta)` manda la **pregunta en español, entera, sin tocar** a PubMed.
- `consultor-evidencia/route.ts:168-169` y `expediente/evidencia/route.ts:105` → `traducirBasico()` (`src/lib/evidencia/traducir-medico.ts:100-113`) es **literalmente una bolsa de palabras**: tokeniza, quita *stopwords*, cambia lo que esté en el diccionario y **une todo con espacios**. Sin facetas, sin `OR` entre sinónimos, sin `AND` entre ejes.
- `expediente/evidencia/route.ts:73` → `[dx[0], ...meds.slice(0,2)].join(' ')` **concatena diagnóstico y fármacos en una sola cadena**: población e intervención quedan pegadas y el motor de búsqueda no puede distinguirlas ni relajar una sin la otra.

**Hallazgo 3 — el diseño obvio (un `interface PICO` y ya) NO cumple la aceptación.** Un `PICO` que sea sólo una forma de datos no impide que alguien siga llamando a la búsqueda con una cadena; y no impide lo más probable de todo: que **el modelo devuelva la consulta ya armada dentro de un campo del PICO** (`{poblacion: "(UTI OR cystitis) AND women"}`) y el «PICO» sea un disfraz del texto crudo. Por eso el diseño tiene **dos puertas**, igual que E2-01:

1. **El compilador.** La función que arma la consulta acepta **sólo** un `PICO` con marca fantasma, y la búsqueda acepta **sólo** una `ConsultaPubMed` con marca fantasma. Una cadena no compila; una `ConsultaPubMed` escrita a mano tampoco. **Verificado hoy con el `tsc` del repo: 6 casos negativos, `EXIT=0`**, y con **dos controles negativos ejecutados** (§4.3).
2. **El runtime**, porque el PICO no nace de código escrito a mano: nace del JSON de un LLM. `picoDesdeModelo()` **rechaza con motivo** un campo que traiga operadores booleanos, *field tags* o una frase larga: el modelo aporta **términos**, el ensamblado lo hace **código determinista**.

**Cambio propuesto: 4 archivos nuevos, 0 archivos de producción modificados, 0 callers.** El cableado de las rutas es **E2-05** (o E2-03, que ya toca retrieval), deliberadamente fuera de esta unidad — regla 5 de la carta operativa.

---

## 1. Qué pide la unidad (backlog literal)

| Campo | Valor |
|---|---|
| Objetivo | Convertir la pregunta clínica en población/intervención/comparador/outcome |
| Entregables | `extractor` · `tests con casos ficticios` |
| Aceptación | **La búsqueda se arma desde PICO, no desde embeddings del texto crudo** |
| Depende | E2-01 |
| Riesgo | medio |
| validacionClinica | **false** |

---

## 2. Qué existe YA en el repo (no rehacer)

| Pieza existente | Dónde | Qué hace y qué le falta |
|---|---|---|
| Cliente de PubMed con throttle y multi-consulta | `src/lib/evidencia/pubmed.ts:129` (`buscarEvidencia`), `:186` (`buscarEvidenciaMulti`), `:152` (`textoCompletoPMC`) | **El retrieval ya está resuelto y probado en vivo** (el throttle de `:45-57` fue el fix del bug «a veces no salen citas»). E2-02 **no lo toca ni lo reemplaza**: se le pone una entrada tipada delante. |
| Unión en *round-robin* + dedup por PMID | `pubmed.ts:206-216` | Ya equilibra la cobertura entre sub-consultas. Encaja tal cual con las 1-3 consultas que produce el *backoff* de §7.2. |
| Filtro de alta calidad | `pubmed.ts:178` (`FILTRO_HQ`) | Ya existe y **no se toca**: decidir qué diseño pesa más es E2-03 (`validacionClinica: true`). |
| Jerarquía de evidencia sin validar | `pubmed.ts:60` (`RANK`) | Pone `Guía(1)` por encima de `ECA(2)`. **E2-02 no la copia ni la consagra** (§9, Q1 heredada de E2-01). |
| Traductor determinista ES→EN | `src/lib/evidencia/traducir-medico.ts:100` (`traducirBasico`), `:20-74` (`DIC`, con IVU/DM2/ERC…), `:79-91` (`FARMACOS_EN`), `:116` (`farmacosDetectados`) | **Se REUTILIZA tal cual**, sin modificarlo: es puro, sin red, sin `process.env`, y ya tiene test propio (`src/__tests__/evidencia/traducir-medico.test.ts`). Lo que le falta no es vocabulario: es **saber a qué faceta pertenece cada término**. Eso lo aporta E2-02. |
| Constructor de consultas con LLM (x2) | `consultor-evidencia/route.ts:148-161` · `expediente/evidencia/route.ts:79-95` | **Dos prompts distintos que hacen lo mismo mal**: piden la consulta ya armada. E2-02 los sustituye por **un** contrato de extracción de facetas (§5), pero **no los edita en esta unidad**. |
| Consultas deterministas desde la nota | `expediente/evidencia/route.ts:71-74` (`consultasDet`) | Ya sabe que el **motivo de consulta** manda sobre las comorbilidades. Ese criterio se **conserva** en `picoDesdeNota` (§6.1); lo que cambia es que deja de concatenar (`:73`). |
| Modelo Claim/Source/Passage (E2-01) | `src/types/evidence.ts` | Aporta `NoVacio<T>` (`:60`), `Resultado<T,M>` (`:67`), el patrón de **marca fantasma no exportada** (`:142-145`) y la doctrina de fábrica única. E2-02 **reutiliza los tres**. |
| Guarda de software arbitraria y declarada | `src/types/evidence.ts:287` (`MINIMO_CARACTERES_PASAJE = 40`) | **Precedente exacto** para los topes de §5.2: número arbitrario, parametrizable, documentado como guarda de software y **sin ADR clínico**. |
| Casos negativos de compilación | `src/__tests__/tipos/evidence.tipos.ts` + guardián en `src/__tests__/evidence-model.test.ts` | Infraestructura ya montada: `tsconfig.json` typechequea `**/*.ts`; `vitest.config.ts` sólo ejecuta `*.test.ts`. Se reutiliza el patrón. |
| Trinquete de ADRs (E0-03) | `src/lib/clinical/adr-cobertura.ts` (`DEUDA_ADR_CONGELADA`) | Sólo cuenta motores de `CLINICAL_ENGINE_REGISTRY`. E2-02 **no registra motor** (no calcula nada clínico) ⇒ **deuda intacta, CI sin impacto**. Mismo criterio que E0-04 y E2-01. |
| Embeddings / vectores | **no existen** (`grep` = 0 archivos) | La mitad «no desde embeddings» de la aceptación **ya se cumple por ausencia**. Lo que hay que arreglar es «no desde el texto crudo». Se documenta para que nadie «cumpla» la unidad introduciendo un vector store. |

**Conclusión de la exploración:** hay retrieval bueno, hay traductor y hay un criterio de priorización del motivo. **Lo que no existe es la estructura**: entre la pregunta del médico y PubMed hoy sólo viaja una cadena opaca. E2-02 aporta esa estructura y, sobre todo, **la hace obligatoria en el tipo**.

---

## 3. Qué significa exactamente la aceptación (definición falsable)

«La búsqueda se arma desde PICO» se traduce en **tres invariantes comprobables**:

| # | Invariante | Cómo se falsa |
|---|---|---|
| **A1** | La función de búsqueda **no admite una cadena**. Sólo admite `ConsultaPubMed`, y `ConsultaPubMed` sólo la produce el ensamblador a partir de un `PICO`. | Caso negativo de `tsc` (§4.2, casos 1, 2 y 6). |
| **A2** | **Trazabilidad total**: cada *token* alfanumérico del texto de la consulta pertenece a un `TerminoPICO` declarado en `ConsultaPubMed.procedencia`, o es un operador (`AND`, `OR`, paréntesis). No puede colarse texto que no venga de una faceta. | Test de runtime (§8, caso 10): recorre el texto y compara contra `procedencia`. |
| **A3** | El modelo **no puede dictar la consulta**: si un campo de faceta trae operadores booleanos, *field tags* (`[tiab]`, `[mh]`) o una frase larga, `picoDesdeModelo` **rechaza con motivo**, no la limpia en silencio. | Test de runtime (§8, casos 3-6). |

**Lo que NO se puede prometer y no se promete:** que el PICO sea *clínicamente el correcto*. Que «recurrent UTI» sea la población adecuada para la pregunta del médico es juicio clínico y **este módulo no lo evalúa**. E2-02 garantiza **estructura y procedencia**, igual que E2-01 garantizaba literalidad y no *entailment*. Es una limitación **declarada**.

---

## 4. La parte falsable: qué rechaza el compilador (verificado hoy)

### 4.1 El núcleo del tipo

```ts
declare const MARCA_TERMINO:  unique symbol   // NO exportadas: sin fábrica no hay objeto
declare const MARCA_PICO:     unique symbol
declare const MARCA_CONSULTA: unique symbol

export type Faceta = 'P' | 'I' | 'C' | 'O'

export interface TerminoPICO {
  readonly faceta: Faceta
  /** Tal como venía (español o inglés). Trazabilidad; NO entra a la consulta. */
  readonly original: string
  /** Término que SÍ entra a la consulta (inglés, normalizado). */
  readonly busqueda: string
  /** Sinónimos de LA MISMA faceta: se unen con OR. */
  readonly sinonimos: readonly string[]
  /** De dónde salió: campo estructurado de la nota · diccionario · modelo · literal. */
  readonly origen: OrigenTermino
  readonly [MARCA_TERMINO]: (t: 'termino') => 'termino'
}

export interface PICO {
  /** ← P OBLIGATORIA: sin población/problema no hay pregunta clínica que buscar. */
  readonly poblacion: NoVacio<TerminoPICO>
  readonly intervencion: readonly TerminoPICO[]
  readonly comparador: readonly TerminoPICO[]
  readonly outcome: readonly TerminoPICO[]
  /** La pregunta original, SÓLO para trazar. Nunca se usa para armar la consulta. */
  readonly preguntaOriginal: string
  /** true si se cayó al camino degradado de §6.3 (P = texto sin facetar). */
  readonly degradado: boolean
  readonly [MARCA_PICO]: (p: 'pico') => 'pico'
}

export interface ConsultaPubMed {
  readonly texto: string                        // "(a OR b) AND (c)" — ARMADA, no dictada
  readonly facetas: NoVacio<Faceta>             // qué facetas entraron en ESTA consulta
  readonly procedencia: NoVacio<TerminoPICO>    // ← A2: de dónde salió CADA término
  readonly degradada: boolean
  readonly [MARCA_CONSULTA]: (q: 'consulta') => 'consulta'
}
```

Tres decisiones de tipo, y por qué cada una es *load-bearing*:

1. **`poblacion: NoVacio<TerminoPICO>`.** Es la mitad «de compilación» de la aceptación: un PICO sin ningún eje no es una estructura, es la cadena cruda otra vez. I, C y O sí pueden faltar (hay preguntas legítimas de sólo P, p. ej. pronóstico).
2. **Marca fantasma en `ConsultaPubMed`.** Sin ella, el modo de cumplir la aceptación en apariencia y romperla de hecho es trivial: `buscar({ texto: preguntaCruda, … } as ConsultaPubMed)`. Con ella, **la única forma de obtener una `ConsultaPubMed` es pasar por el ensamblador**, que sólo acepta un `PICO`.
3. **`procedencia: NoVacio<TerminoPICO>` dentro de la consulta.** La consulta **carga consigo** los términos de los que salió. Es lo que hace que A2 sea verificable en un test y, más adelante, mostrable al médico («esta búsqueda salió de: P=IVU recurrente, I=nitrofurantoína»).

### 4.2 Casos negativos — **ejecutados hoy con el `tsc` del repo**

Archivo `src/__tests__/tipos/pico.tipos.ts` (lo typechequea `tsc`; **vitest no lo ejecuta**):

| # | Caso | Por qué no compila |
|---|---|---|
| 1 | `consultaDesdePICO('recurrent urinary tract infection')` | **LA ACEPTACIÓN**: una cadena no es un `PICO`. |
| 2 | `buscarConPICO(['recurrent urinary tract infection'])` | La búsqueda no admite cadenas. |
| 3 | `const t: TerminoPICO = { faceta:'P', original:'x', busqueda:'x', sinonimos:[] }` | Falta la marca fantasma (no exportada). |
| 4 | `pico({ poblacion: [], preguntaOriginal:'q' })` | `[]` no es `NoVacio<TerminoPICO>`. |
| 5 | `const p: PICO = { … }` escrito a mano | Falta la marca fantasma. |
| 6 | `const c: ConsultaPubMed = { texto:'cualquier cosa AND lo que sea', … }` | Falta la marca ⇒ **no se puede disfrazar texto crudo de consulta**. |

Resultado real de hoy, con `node_modules/.bin/tsc --strict` del repo sobre el prototipo (§ scratchpad, no forma parte del repo):

```
EXIT=0        # los 6 @ts-expect-error se consumieron y los casos POSITIVOS compilan
```

### 4.3 Control negativo (por qué las marcas y la tupla no son adorno) — **ejecutado**

| Control | Qué se cambió | Resultado REAL |
|---|---|---|
| **C1** | `readonly [MARCA_CONSULTA]: …` → `readonly marcaConsulta?: never` | `pico.tipos.ts(28,1): error TS2578: Unused '@ts-expect-error' directive.` → **el caso 6 deja de fallar**: una `ConsultaPubMed` con texto arbitrario compila y la aceptación desaparece con el CI en verde. |
| **C2** | `poblacion: NoVacio<TerminoPICO>` → `poblacion: readonly TerminoPICO[]` | `pico.tipos.ts(20,1): error TS2578` → **el caso 4 deja de fallar**: un PICO sin ninguna faceta compila. |

Ambos controles se ejecutaron de verdad y el prototipo se restauró. Por eso el test de runtime lleva un **guardián** (§8, casos 1-2) que exige que el archivo `.tipos.ts` exista, conserve **≥6 `@ts-expect-error` activos** y que las tres marcas sigan con la forma `(x: 'literal') => 'literal'` y **sin exportar**.

---

## 5. La otra mitad: la puerta de runtime (donde entra el JSON del LLM)

El compilador no ve el `JSON.parse` de la respuesta del modelo. Aquí es donde la aceptación se gana o se pierde de verdad.

### 5.1 Contrato con el modelo — **cambia lo que se le pide**

| Hoy | Con E2-02 |
|---|---|
| «Devuelve 1-3 sub-búsquedas de PubMed, cada una en su línea, unidas con AND/OR» (`consultor-evidencia/route.ts:150`) | «Devuelve SOLO este JSON: `{"poblacion":[…],"intervencion":[…],"comparador":[…],"outcome":[…]}`. Cada elemento es **un término** en inglés (1-6 palabras). **Prohibido** usar `AND`, `OR`, `NOT`, paréntesis o *field tags*: la consulta la arma el sistema.» |

El modelo pasa de **redactar la consulta** a **rellenar cuatro casillas**. Ese es el cambio conceptual de la unidad.

### 5.2 `picoDesdeModelo(datos: unknown, preguntaOriginal: string): Resultado<PICO, MotivoRechazoPICO>`

Función **total**: no lanza, no inventa, no descarta en silencio (doctrina de `claimDesde`, `src/types/evidence.ts:469`).

```ts
export type MotivoRechazoPICO =
  | 'ENTRADA_NO_ES_OBJETO'
  | 'SIN_POBLACION'                    // ni P ⇒ no hay estructura, sólo texto
  | 'FACETA_NO_ES_ARREGLO'
  | 'TERMINO_VACIO'
  | 'CONSULTA_DICTADA_POR_EL_MODELO'   // ← el corazón de la aceptación
  | 'TERMINO_DEMASIADO_LARGO'          // una frase no es un término
  | 'FIELD_TAG_NO_VERIFICABLE'         // [tiab] / [mh]: ver §7.3
```

**`CONSULTA_DICTADA_POR_EL_MODELO`** se dispara cuando un elemento de faceta contiene ` AND `, ` OR `, ` NOT `, `(`, `)`, `[`, `]` o `"`. **Es un rechazo, no una limpieza**: si el modelo devolvió `"(UTI OR cystitis) AND women"`, borrarle los paréntesis produciría un término inventado que nadie escribió. Se rechaza y el llamador cae al camino determinista (§6.1) o al degradado explícito (§6.3).

**Topes de software (arbitrarios, parametrizables, sin ADR clínico — precedente `MINIMO_CARACTERES_PASAJE = 40`, `evidence.ts:281-287`):**

| Constante | Valor propuesto | Por qué |
|---|---|---|
| `MAXIMO_PALABRAS_TERMINO` | 6 | Más de 6 palabras es una frase, y una frase en PubMed devuelve 0 (es exactamente el aviso que ya está escrito en `expediente/evidencia/route.ts:80`: *«NO frases largas, que traen 0 resultados»*). |
| `MAXIMO_TERMINOS_POR_FACETA` | 5 | Tope de coste: acota el largo de la consulta y el fan-out de PubMed. |
| `MAXIMO_CARACTERES_TERMINO` | 80 | Corta *prompt injection* / basura larga antes de que llegue a la URL. |

Ninguno decide nada médico. Los tres van documentados en el encabezado del archivo, como en E2-01.

---

## 6. Los tres caminos de extracción (y por qué son tres)

### 6.1 `picoDesdeNota` — DETERMINISTA, sin LLM, desde campos YA etiquetados

Entrada: exactamente los campos que la ruta ya tiene (`expediente/evidencia/route.ts:60-63`) y **ninguno de identidad**:

```ts
export interface EntradaNota {
  readonly motivo: string                     // problema activo de HOY
  readonly diagnosticos: readonly string[]
  readonly medicamentos: readonly string[]
  readonly edad?: number
  readonly sexo?: string
}
export function picoDesdeNota(e: EntradaNota, opts?: OpcionesEncuadre): Resultado<PICO, MotivoRechazoPICO>
```

Mapeo, **sin inferir nada de prosa libre** — se apoya en que la nota ya dice qué campo es qué:

| Campo de la nota | Faceta | Justificación |
|---|---|---|
| `motivo` | **P** (primero) | Conserva el criterio que la ruta ya aplica hoy (`route.ts:68-72`, «prioriza el MOTIVO, no las comorbilidades»). |
| `diagnosticos[i]` | **P** (términos adicionales) | El diagnóstico describe a quién se busca. |
| `medicamentos[i]` | **I** | Encuadre por defecto **declarado**, no inventado; ver Q4 en §11 y `opts.medicamentosComo`. |
| `edad` / `sexo` | **P** (sólo si el llamador lo pide) | Por defecto **NO** entran: acotan de más y son el vector obvio de re-identificación en una URL saliente. |

**PHI:** la entrada no tiene nombre, folio ni identificadores, y la función **no los aceptaría aunque se los pasaran** (no están en el tipo). Los términos salen de `traducirBasico()` (puro) y viajan a PubMed, un tercero. Un test fija que `picoDesdeNota` sólo lee las cinco claves de `EntradaNota`.

Si tras el mapeo **P queda vacía** (nota sin motivo y sin diagnóstico) ⇒ `SIN_POBLACION`. **No se rellena con el resumen libre**: eso sería devolver el texto crudo por la puerta de atrás.

### 6.2 `picoDesdeModelo` — la puerta del LLM (§5.2)

Es la que usa el Consultor, donde la entrada es una pregunta en prosa. **El modelo sólo rellena casillas**; el ensamblado es código.

### 6.3 `picoDegradadoDesdeTexto` — la salida de emergencia, **marcada**

Hoy existen tres redes de seguridad para no devolver 0 resultados (`consultor-evidencia/route.ts:166-173`). Si E2-05 las quita sin sustituto, se **regresa** una funcionalidad que el Dr. ya vio funcionar. Sustituto honesto:

```ts
export function picoDegradadoDesdeTexto(texto: string): Resultado<PICO, MotivoRechazoPICO>
// P = [ traducirBasico(texto) ] · degradado: true · origen: 'literal'
```

**No infiere facetas** (asignar faceta a partir de prosa española sería inventar). Mete todo en P y **marca `degradado: true`**, bandera que viaja hasta `ConsultaPubMed.degradada` y que E2-05 podrá pintar como *«búsqueda amplia, sin estructura»*. Un test fija la propagación de la bandera: **el camino crudo sigue existiendo, pero deja de ser indistinguible del bueno**, que es justo lo que hoy no ocurre.

---

## 7. Cómo se arma la consulta

### 7.1 Ensamblado (determinista, puro, sin `Date.now()` ni `Math.random()`)

```
sinónimos de una misma faceta  → OR      "(uti OR urinary tract infection)"
facetas entre sí               → AND     "(P) AND (I) AND (O)"
orden fijo                     → P, I, C, O   (mismo PICO ⇒ misma cadena, siempre)
```

Booleano de manual, sin criterio clínico. `consultaDesdePICO(p: PICO): ConsultaPubMed` **no puede fallar** (el `PICO` ya está validado: P no vacía) ⇒ devuelve `ConsultaPubMed` directo, no `Resultado`. Propiedad agradable: *PICO válido ⇒ siempre hay consulta*.

### 7.2 *Backoff* determinista `consultasDesdePICO(p): NoVacio<ConsultaPubMed>`

Sustituye a las tres redes de seguridad ad-hoc de hoy por una **relajación explicable**, de más específica a más amplia:

1. `P AND I AND C AND O` (las facetas que existan)
2. `P AND I` (se sueltan O y C — son los que más ceros producen)
3. `P` sola

Encaja tal cual con `buscarEvidenciaMulti` (`pubmed.ts:186`), que ya hace *round-robin* + dedup por PMID. **Todas las consultas contienen P** (test §8, caso 12).

### 7.3 Lo que el ensamblador **NO** hace: *field tags* ni MeSH

No se emite `[tiab]`, `[mh]` ni `[MeSH Terms]`. Motivo: para poner `[mh]` hay que **saber** que el término es un encabezado MeSH válido, y el repo **no tiene diccionario MeSH**. Etiquetarlo a ciegas produce búsquedas que devuelven 0 **en silencio** — el peor fallo posible aquí. Un `EntradaMeSH` verificada es candidata natural de E2-03 (que ya trae adaptadores por fuente).

### 7.4 El puente con la búsqueda

```ts
// src/lib/evidencia/buscar-con-pico.ts
export async function buscarConPICO(
  consultas: NoVacio<ConsultaPubMed>,
  opts?: { max?: number; aniosRecientes?: number; signal?: AbortSignal },
): Promise<ArticuloPubMed[]>
```

Delega en `buscarEvidenciaMulti(consultas.map(c => c.texto), opts)`. **`pubmed.ts` no se modifica** ⇒ el riesgo sobre el retrieval probado en vivo es cero. Este archivo va **separado** de `pico.ts` a propósito: `pubmed.ts:15` lee `process.env.NCBI_API_KEY` **en el momento del import** y monta una cola de throttle en módulo; `pico.ts` debe quedar puro e importable desde cualquier lado (mismo criterio que `desde-pubmed.ts`, que usa `import type`).

---

## 8. Archivos a tocar y tests

**Ninguno de producción se modifica.** Cuatro archivos nuevos:

| Archivo | Qué es | Por qué |
|---|---|---|
| `src/lib/evidencia/pico.ts` | **NUEVO** — el entregable «extractor»: tipos, 3 marcas fantasma, fábricas (`termino`, `pico`), 3 extractores (§6), ensamblador y *backoff* (§7). | Puro: sólo importa `NoVacio`/`Resultado` de `@/types/evidence` y `traducirBasico` de `./traducir-medico` (ambos sin efectos de import). |
| `src/lib/evidencia/buscar-con-pico.ts` | **NUEVO** — el puente de §7.4. | Aísla el import con efectos de `pubmed.ts`. Es la seam que consumirá E2-05. |
| `src/__tests__/tipos/pico.tipos.ts` | **NUEVO** — los 6 casos negativos de §4.2 con `@ts-expect-error`. | Lo typechequea `tsc`, **no** lo ejecuta vitest. Es *la* prueba de A1. |
| `src/__tests__/pico-extractor.test.ts` | **NUEVO** — runtime + guardián del gate del compilador. | Patrón de `evidence-model.test.ts`. |

### Tests (todos con **casos ficticios sintéticos**; cero red, cero reloj, cero PHI)

**Guardián del gate del compilador**
1. `src/__tests__/tipos/pico.tipos.ts` existe y conserva **≥6 `@ts-expect-error` activos** (no comentados).
2. Las tres marcas siguen en `pico.ts` con forma `(x: 'literal') => 'literal'` y **ninguna se exporta** (control negativo C1 de §4.3).

**A3 — el modelo no dicta la consulta**
3. `{poblacion:["(UTI OR cystitis) AND women"]}` ⇒ `CONSULTA_DICTADA_POR_EL_MODELO` (no se limpia).
4. `{poblacion:["urinary tract infection[mh]"]}` ⇒ `FIELD_TAG_NO_VERIFICABLE`.
5. Término de 12 palabras ⇒ `TERMINO_DEMASIADO_LARGO`.
6. `{intervencion:["nitrofurantoin"]}` sin `poblacion` ⇒ **`SIN_POBLACION`** (ni I sola, ni O sola, arman búsqueda).
7. `{poblacion:"recurrent UTI"}` (string en vez de arreglo) ⇒ `FACETA_NO_ES_ARREGLO`.
8. `{poblacion:["  "]}` ⇒ `TERMINO_VACIO`.

**A2 — trazabilidad y ensamblado**
9. Sinónimos de una faceta se unen con `OR`; facetas distintas con `AND`; orden fijo P→I→C→O.
10. **INVARIANTE A2:** todo *token* alfanumérico de `consulta.texto` aparece en algún `busqueda`/`sinonimos` de `consulta.procedencia`; lo único ajeno permitido es `AND`, `OR`, `(`, `)`.
11. **Determinismo:** el mismo PICO produce byte a byte la misma cadena en dos construcciones separadas (sin orden de `Set`, sin reloj).
12. *Backoff*: `consultasDesdePICO` devuelve 1-3 consultas, estrictamente decrecientes en facetas, y **todas contienen P**.
13. Deduplicación case-insensitive de términos repetidos entre facetas, conservando `original` intacto.

**Extractores**
14. `picoDesdeNota({motivo:'IVU recurrente', diagnosticos:['DM2'], medicamentos:['nitrofurantoína']})` ⇒ P contiene `urinary tract infection` y `recurrent` (vía `traducirBasico`, `origen:'diccionario'`), I contiene el fármaco, y **`motivo` va primero**.
15. `picoDesdeNota` con motivo y diagnósticos vacíos ⇒ `SIN_POBLACION` (no se rellena con texto libre).
16. `picoDesdeNota` **no** mete edad ni sexo por defecto; con `opts.incluirDemografia` sí.
17. `opts.medicamentosComo:'P'` mueve los fármacos de faceta (Q4 de §11 queda parametrizada, no cocinada).
18. `picoDegradadoDesdeTexto('¿tratamiento de la IVU recurrente?')` ⇒ `degradado:true`, y `consultaDesdePICO` propaga `degradada:true`.
19. Un PICO no degradado produce `degradada:false` (el flag no se pega solo).

**Puente**
20. `buscar-con-pico.ts` importa `pubmed.ts` y **nada más de producción**; el test verifica por lectura del archivo que `pico.ts` **no** importa `pubmed.ts` (para que siga siendo puro).

**Prueba de que el test sirve** (exigible en el `RESULTADO.json`, doctrina de E2-01):
- Quitar la marca de `ConsultaPubMed` ⇒ caso 6 de `.tipos.ts` en `TS2578` + guardián #2 en rojo. **Ya ejecutado hoy (C1).**
- Cambiar `NoVacio<TerminoPICO>` por `readonly TerminoPICO[]` ⇒ caso 4 en `TS2578`. **Ya ejecutado hoy (C2).**
- Sustituir el rechazo `CONSULTA_DICTADA_POR_EL_MODELO` por una limpieza silenciosa (`replace(/[()\[\]]|AND|OR/g,'')`) ⇒ el caso 3 debe ponerse en rojo. **Pendiente de ejecutar en la unidad de implementación.**

---

## 9. Lo que E2-02 NO hace (y por qué)

| Fuera de alcance | Dónde vive | Por qué no aquí |
|---|---|---|
| Jerarquía/peso de la evidencia; filtrar por diseño según el tipo de pregunta (terapia→ECA, diagnóstico→precisión) | **E2-03** (`validacionClinica: true`) | Es criterio metodológico. `FILTRO_HQ` (`pubmed.ts:178`) y `RANK` (`:60`) **se dejan exactamente como están**. |
| Field tags / MeSH verificado | **E2-03** | Sin diccionario MeSH, etiquetar es producir ceros silenciosos (§7.3). |
| Cablear las dos rutas y los tres prompts | **E2-05** (o E2-03) | Tocar `consultor-evidencia/route.ts` y `expediente/evidencia/route.ts` es cambio visible en producción sobre un flujo que el Dr. ya probó en vivo. Regla 5 de la carta operativa. |
| Juzgar si el PICO es *clínicamente* el adecuado | — | No es software: es juicio clínico (§3). |
| Extraer población/diseño/efecto **del artículo** (`Estudio` de E2-01) | **E2-03** | E2-02 factoriza **la pregunta**, no el artículo. Nombres parecidos, cosas distintas. |
| Registrar un motor en `CLINICAL_ENGINE_REGISTRY` | — | No calcula nada clínico; registrarlo sin ADR subiría `DEUDA_ADR_CONGELADA` y pondría el CI en rojo. Mismo criterio que E0-04 y E2-01. |
| Modificar `traducir-medico.ts` o `pubmed.ts` | — | Ambos tienen comportamiento probado en vivo (el throttle fue un fix de un bug real). Se usan tal cual. |

---

## 10. Riesgo de regresión REAL sobre producción

**Bajo.** Cero archivos de producción modificados; el código nuevo **no tiene ningún caller** hasta E2-05. El backlog declara riesgo *medio* porque asume el cableado; **al separarlo, el riesgo de esta unidad baja a bajo y el riesgo medio se traslada a E2-05**.

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| `tsc` en rojo por un `@ts-expect-error` de más en `.tipos.ts` (se typechequea todo el repo) | media | Los 6 casos ya se compilaron hoy con el `tsc` del repo: `EXIT=0`. El guardián #1 vigila que no se comenten. |
| `pico.ts` arrastra `process.env.NCBI_API_KEY` al importar `pubmed.ts` | media | El puente vive en **otro archivo** (§7.4) y un test lo verifica (caso 20). Mismo fallo que E2-01 previno con `import type`. |
| Al cablear (E2-05) la búsqueda estructurada devuelva **menos** artículos que la cadena cruda de hoy | **media-alta, y es el riesgo real de la unidad** | Por eso existe el *backoff* de §7.2 y el camino degradado de §6.3. **Recomendación explícita para E2-05:** cablear con comparación A/B (misma nota → consulta cruda vs. consulta PICO, contar artículos) **antes** de retirar el camino viejo. No hacerlo a ciegas. |
| Consultas más largas ⇒ más `esearch` ⇒ 429 de PubMed | baja | `MAXIMO_TERMINOS_POR_FACETA = 5` acota el largo; el número de `esearch` lo fija `buscarEvidenciaMulti` (≤4 sub-queries, `pubmed.ts:190`) y el throttle de `:45-57`, que **no se tocan**. |
| Trinquete de ADRs (E0-03) o de invariantes (E0-11) en rojo | baja | No se registra motor ⇒ deuda intacta. Añadir archivos de test no baja el trinquete de invariantes. |
| Peso del bundle / `next build` | muy baja | Funciones puras sin dependencias; sin callers, *tree-shaking*. |
| Fuga de PHI a PubMed (tercero) al construir el PICO desde la nota | **baja pero real** | `EntradaNota` **no tiene** campos de identidad; edad y sexo quedan **fuera por defecto** (§6.1) y hay test. El texto libre de la nota (`resumen`) **no** alimenta `picoDesdeNota`. |
| E0-11 sigue bloqueada: `describe.skipIf(true)` apaga archivos sin que el gate lo note | — | Heredado. Los tests nuevos **no** deben usar `skipIf`/`runIf`. |

---

## 11. Preguntas para el médico dueño — **NINGUNA BLOQUEA E2-02**

E2-02 se implementa completo sin ninguna decisión clínica: no define umbrales, ni dosis, ni pesos de evidencia. Sus tres constantes son guardas de software declaradas (§5.2). Estas quedan **registradas**:

- **Q4 (encuadre, afecta a E2-05).** El fármaco que el paciente **ya toma**: ¿es la **intervención** que se está evaluando (`I`), o parte de la **población** («pacientes con IVU recurrente **en tratamiento con** nitrofurantoína»)? Cambia lo que PubMed devuelve. **Default propuesto y parametrizable:** `I` (`opts.medicamentosComo`). *No bloquea: el default está declarado y es reversible con un parámetro.*
- **Q5 (E2-03).** ¿Se añaden filtros por tipo de estudio según el tipo de pregunta (terapia→ECA/meta-análisis, diagnóstico→estudios de precisión, pronóstico→cohortes)? **E2-02 no los añade**, precisamente porque es criterio metodológico.
- **Q1 (heredada de E2-01, sigue abierta).** `pubmed.ts:60` ordena con `Meta-análisis(0) < Guía(1) < ECA(2) < Revisión(3)`. ¿Es aceptable que una **guía** flote por encima de un **ECA**?

---

## 12. Definición de «hecho» para esta unidad

1. `src/lib/evidencia/pico.ts` existe, es puro y **no importa `pubmed.ts`**.
2. `src/lib/evidencia/buscar-con-pico.ts` existe y sólo delega en `buscarEvidenciaMulti`.
3. `src/__tests__/tipos/pico.tipos.ts` con **≥6 `@ts-expect-error` activos** y `npx tsc --noEmit` limpio.
4. `src/__tests__/pico-extractor.test.ts` en verde con los 20 casos de §8, sobre fixtures sintéticos.
5. Gates: `tsc` PASS · `vitest` PASS (≥ **2252** + los nuevos) · `npm run build` PASS.
6. Controles negativos **ejecutados y documentados** en el `RESULTADO.json` (los dos de §4.3 ya están hechos; falta el de la limpieza silenciosa).
7. `RESULTADO.json` escrito en el mismo commit que cierra la unidad.
8. **Cero archivos de producción modificados. No desplegar. No `git push`.**
