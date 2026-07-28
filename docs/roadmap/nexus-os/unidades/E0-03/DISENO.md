# E0-03 — Clinical Engine Registry completo + ADRs · DISEÑO

> **Estado:** diseño **re-verificado contra el código** (3ª pasada, 2026-07-28). NO implementado. No se tocó código en esta unidad.
> **Etapa:** E0 (hardening). **Riesgo declarado en backlog:** bajo. **Dependencias:** ninguna.

## 0-bis. Re-verificación (3ª pasada, tras E0-02)

Se volvió a medir cada afirmación del diseño contra el árbol real. **El diseño se sostiene entero**; sólo hay deriva de detalle, más **un defecto pre-existente nuevo** que refuerza la unidad.

**Confirmado tal cual:**

- 15 motores en `CLINICAL_ENGINE_REGISTRY` (`src/lib/clinical/registry.ts:35`); `interface MotorClinico` (`:21`) sigue **sin** `rangoValido` ni `adr`.
- **Único consumidor en todo `src/` = su propio test** (`src/__tests__/clinical-registry.test.ts:7`). Cero acoplamiento a producción ⇒ el "riesgo bajo" es medido, no optimista.
- Número mágico intacto: `toBeGreaterThanOrEqual(15)` (`clinical-registry.test.ts:11`).
- **Punteros rotos de §2.1 siguen rotos:** `registry.ts:139` declara `uci-ckrt.test.ts` y `:146` declara `uci-ecmo.test.ts`; **ninguno existe** en disco. Sí existe `src/__tests__/uci-soportes.test.ts`.
- Conteo de archivos de `DIRECTORIOS_CLINICOS` (sin tests ni `.d.ts`): `uci` 19, `hospital` 10, `expediente` 70, `inmuno` 5, `clinical` 1, `seguridad` 3 ⇒ **108**, exactamente lo previsto en §4.3.
- `src/lib/expediente` tiene los 3 subdirectorios previstos (`antibiograma/`, `laboratorio/`, `cardiometabolico/`) ⇒ **el recorrido RECURSIVO de §4.4 es obligatorio**.
- Las 11 escalas de `CALCULADORAS[]` (`calculadoras.ts:216`–`:387`) siguen sin registrar; de ese archivo sólo `meld` figura en el registro (`registry.ts:56`).
- CI (`.github/workflows/ci.yml:23-31`) corre `tsc --noEmit` + `npx vitest run` + `next build` en push a `main` y en cada PR ⇒ **no hay que tocar CI**.
- Los directorios que §3.2 deja fuera existen y son pequeños (`evidencia` 3, `voz` 2, `ia` 1, `fhir` 1, `hl7` 1, `compliance` 2): ampliar el alcance después es barato.

**Deriva a corregir (3 puntos):**

1. **Los ADRs ya no son 4, son 5**: E0-02 añadió `docs/clinical-decisions/dosis-amoxicilina.md`. §2 debe leer 5 ADRs + `README.md`.
2. **DEFECTO PRE-EXISTENTE NUEVO — `README.md` está desincronizado.** `docs/clinical-decisions/README.md` indexa sólo 4 (`CKD-EPI-2021`, `FIB-4`, `dosis-pediatrica`, `NEWS2`): **`dosis-amoxicilina.md` no está enlazado**. Es exactamente la podredumbre silenciosa que la **aserción 5** (§4.4) existe para cazar. Consecuencia: **hoy fallarían ya DOS aserciones del gate nuevo** (la 4 por los golden tests inexistentes, la 5 por el ADR huérfano), no una. Ambas reparaciones forman parte de esta unidad y son documentación pura.
3. **Números de línea de `seguridad/dosis.ts` movidos por E0-02**: `CATALOGO` está ahora en **`:61`** (no `:48`) y `revisarDosis` en **`:153`** (no `:115`). `tieneAlergiaGrave` sigue en `alergias.ts:44`. El hallazgo de fondo de §4.3 (punto 1 de la 2ª pasada) **no cambia**: ninguno de los tres está registrado. *Lección operativa: los ADRs deben citar `archivo` + símbolo exportado, y usar `archivo:línea` sólo como pista — las líneas se mueven entre unidades.*

Todo lo demás de §1–§8 queda vigente sin cambios.

## 0. Correcciones de la verificación (2ª pasada)

La 1ª pasada de este diseño tenía tres inexactitudes, medidas contra el árbol real:

1. **`src/lib/seguridad` faltaba en `DIRECTORIOS_CLINICOS`** (§4.3). Es un hueco real, no cosmético: ahí vive `seguridad/dosis.ts` con `CATALOGO` (`:48`) y `revisarDosis` (`:115`) — el motor de techos de dosis del adulto, el mismo que E0-02 dejó marcado en E0-02-Q1/Q3 — y `seguridad/alergias.ts` con `tieneAlergiaGrave` (`:44`), la compuerta de alergias. **Ninguno está registrado.** Sin ese directorio, el gate habría dado verde dejando fuera el motor de seguridad farmacológica más citado del programa. Corregido en §4.3.
2. **Ruta equivocada del bloque cardiometabólico.** No es `src/lib/cardiometabolico` (ese directorio **no existe**); es `src/lib/expediente/cardiometabolico/` — `dislipidemia.ts`, `obesidad.ts`, `biomarcadores-lipidos.ts`, `masld.ts`. Lo confirma el propio registro, que ya apunta a `src/lib/expediente/cardiometabolico/masld.ts`. Consecuencia de diseño: **el recorrido de archivos debe ser RECURSIVO** — `src/lib/expediente` tiene 3 subdirectorios (`antibiograma/`, `laboratorio/`, `cardiometabolico/`) y 70 `.ts` contando subdirectorios. Un `readdir` plano se saltaría el antibiograma entero. Explicitado en §4.4.
3. **Conteo de tests desactualizado:** la línea base tras E0-02 es **1947**, no ~1885 (`estado.json`). Corregido en §5.

Lo demás del diseño se confirma tal cual: 15 motores registrados, único consumidor = su propio test, `>= 15` como número mágico, 4 ADRs, y los dos punteros rotos de §2.1.

## 1. Qué pide la unidad

- **Objetivo:** todo motor clínico registrado con **versión, fuente, rango válido** y **ADR** de por qué existe.
- **Entregables:** (a) `registry.ts` cubre 100% de motores; (b) ADR por motor; (c) test que falla si un motor no está registrado.
- **Aceptación:** *un motor nuevo sin registro rompe el CI*.

## 2. Qué existe YA en el repo (no rehacer)

| Pieza | Dónde | Estado real |
|---|---|---|
| Registro estructurado | `src/lib/clinical/registry.ts:35` — `CLINICAL_ENGINE_REGISTRY` | **15 motores** con `id, nombre, especialidad, version, referencia, unidades, redondeo, file, goldenTests, estado` |
| Tipo del registro | `src/lib/clinical/registry.ts:21` — `interface MotorClinico` | sin campo de **rango válido** y sin campo **ADR** |
| Lookup | `src/lib/clinical/registry.ts:152` — `motorPorId` | OK, null-safe |
| Test de integridad | `src/__tests__/clinical-registry.test.ts` | valida unicidad de id y campos no vacíos. **NO valida cobertura**: el umbral es `length >= 15` (`:11`), un número mágico que no detecta motores faltantes |
| ADRs clínicos | `docs/clinical-decisions/` | **solo 5**: `CKD-EPI-2021.md`, `FIB-4.md`, `NEWS2.md`, `dosis-pediatrica.md`, `dosis-amoxicilina.md` (E0-02) (+ `README.md` como índice, que **sólo enlaza 4** — ver §0-bis punto 2) |
| Ledger de regresiones | `docs/audit/regression-ledger.md` | existe; el registry ya lo referencia (`registry.ts:16`) |
| CI | `.github/workflows/ci.yml` | ya corre `tsc --noEmit` + `vitest run` + `next build` en push a `main` y en cada PR ⇒ **un test nuevo en `src/__tests__/` es automáticamente un gate de CI. No hay que tocar CI.** |
| Precedente de "test guardián" que escanea el filesystem | `src/__tests__/log-secrets-guard.test.ts:11` (`walk()` + `readFileSync`), `firestore-rules-guard.test.ts`, `claims-guard.test.ts`, `native-dialogs-guard.test.ts` | patrón ya aceptado en el repo: se reutiliza tal cual |

**Acoplamiento a producción: cero.** El único consumidor de `CLINICAL_ENGINE_REGISTRY` en todo `src/` es su propio test (verificado por grep). Es metadato puro, como declara su encabezado (`registry.ts:12`). Esto es lo que hace que el riesgo de regresión de esta unidad sea real y honestamente **bajo**.

### 2.1 Defecto ya detectado en el registro actual (lo arregla esta unidad)

`registry.ts:139` y `registry.ts:146` declaran como golden tests `uci-ckrt.test.ts` y `uci-ecmo.test.ts`. **Esos archivos no existen.** La cobertura real de CKRT y ECMO está en `src/__tests__/uci-soportes.test.ts` (verificado por grep de `CKRT`/`ECMO` en `src/__tests__`). El registro apunta a evidencia inexistente y nada lo detecta hoy — exactamente la podredumbre que el gate nuevo debe impedir.

## 3. El hueco de cobertura (por qué "100%" no es cosmético)

Motores deterministas **en producción y NO registrados** (evidencia por archivo):

- **UCI** — todos declaran ya su propia constante de versión, así que el propio código admite que son motores:
  `uci/gasometria.ts:22` (`GASOMETRIA_ENGINE_VERSION`, Winters/anion gap), `uci/ventilacion.ts:23` (Kirby, PBW, VT/kg, driving pressure, compliance), `uci/neuro.ts:16` (PPC = PAM − PIC, RASS), `uci/infusiones.ts:19` (**dosis ↔ mL/h**, safety-critical), `uci/tendencias.ts:13`, `uci/seguridad.ts:23`, `uci/extraccion.ts:12` (firewall de plausibilidad/ambigüedad).
- **Hospital** — `hospital/escalas.ts:21` (`calcBraden`) y `:45` (`calcMorse`); `hospital/lab-criticos.ts` (umbrales de valor crítico); `hospital/cds.ts`.
- **Consulta** — `expediente/calculadoras.ts:214` `CALCULADORAS[]`: **11 escalas con `calcular()` y `referencia` propias** (`cha2ds2vasc`, `hasbled`, `wells-tep`, `wells-tvp`, `curb65`, `qsofa`, `centor`, `alvarado`, `heart`, `glasgow`, `child-pugh`) — de ese archivo solo `meld` (`:205`) está registrado.
- **Cardiometabólico** — `expediente/prevent.ts:100` (PREVENT-ASCVD, coeficientes en `prevent-coeficientes.ts`), `expediente/cardiometabolico/dislipidemia.ts`, `.../obesidad.ts`, `.../biomarcadores-lipidos.ts`. (Sólo `.../masld.ts` está registrado hoy.)
- **Seguridad farmacológica del adulto** — `seguridad/dosis.ts:48` (`CATALOGO` de techos `maxTomaMg`/`maxDiaMg`) y `:115` (`revisarDosis`, emite alertas de severidad crítica); `seguridad/alergias.ts:44` (`tieneAlergiaGrave`). **Es el hueco más grave del inventario:** E0-02 ya documentó que este motor contradice a `pediatria.ts` (E0-02-Q1) y que 20 de 25 fármacos no tienen techo adulto (E0-02-Q3), y aun así el motor no figura en ningún registro.
- **Pediatría** — `expediente/oms-crecimiento.ts` (tablas LMS de la OMS → puntuación z; archivo generado, auditable).
- **Gineco-obstetricia** — `expediente/ginecologia.ts` (FUM→FPP/edad gestacional, Bishop, profilaxis con aspirina, conducta ante citología).
- **Seguridad farmacológica** — `expediente/prescripcion-segura.ts`, `expediente/via-parenteral.ts`, `expediente/farmacovigilancia.ts`.
- **Infectología / PROA** — `expediente/antibiograma/mdr.ts` (Magiorakos), `antibiograma/intrinseca.ts`, `expediente/proa.ts`.
- **Inmunocomprometido** — `inmuno/recomendaciones.ts`, `inmuno/farmacos.ts`.

Ninguno de estos hace falta *escribirlo*: hace falta **declararlo**. Todos traen ya la fuente en su encabezado (p. ej. `dislipidemia.ts` cita la guía ACC/AHA 2026 con DOI; `obesidad.ts` cita AACE 2025 y TOS/OMA/OAC 2026; `neuro.ts` cita BTF 2016; `oms-crecimiento.ts` documenta cómo se generó desde los .xlsx de la OMS). **Por eso esta unidad puede completarse sin inventar una sola referencia.**

### 3.1 Regla de granularidad (decisión de diseño, se documenta)

> **Un motor = un punto de entrada exportado con su propia versión y su propia fuente.**
> Las sub-fórmulas que ese punto de entrada calcula se listan en el campo `calculos[]`, no como motores separados.

Ejemplo: `analizarVentilacion` es **un** motor (`ventilacion-protectora`) cuyos `calculos` son `['PBW', 'VT/kg PBW', 'PaFi (Kirby)', 'driving pressure', 'compliance estática']`. Sin esta regla el inventario se dispara a >60 entradas y el registro deja de ser legible. Con ella, el inventario final estimado es **~30–35 motores** (15 actuales + ~18 nuevos).

### 3.2 Directorios DELIBERADAMENTE fuera del alcance del gate

Existen y contienen lógica que roza lo clínico, pero **no** entran en `DIRECTORIOS_CLINICOS` en esta unidad:

| Directorio | Contenido real | Por qué queda fuera |
|---|---|---|
| `src/lib/evidencia` | `pubmed.ts`, `openfda.ts`, `traducir-medico.ts` | recuperación de literatura, no cálculo determinista; es materia de la etapa **E2 (Nexus Evidence)** |
| `src/lib/voz` | `comandos.ts`, `comandos-uci.ts` | interpretación de habla → intención; no emite número clínico |
| `src/lib/ia` | `evaluacion.ts` | evalúa al LLM; es materia de **E7 (NexusBench)** |
| `src/lib/fhir`, `src/lib/hl7` | `recursos.ts`, `v2.ts` | serialización de interoperabilidad |
| `src/lib/compliance` | `country-profiles.ts`, `policy.ts` | regulatorio, no clínico |

Esto es una **decisión de alcance explícita, no un olvido**: ampliarlo después es añadir una cadena al arreglo. Se anota como pregunta 4 en §6 para que el Dr. la confirme o la corrija.

## 4. Diseño del cambio mínimo

### 4.1 Archivos que se tocan

| Archivo | Acción | Por qué |
|---|---|---|
| `src/lib/clinical/registry.ts` | **extender tipo + completar inventario** | el objetivo pide "versión, fuente, **rango válido** y ADR"; hoy faltan `rangoValido` y `adr` |
| `src/lib/clinical/cobertura.ts` | **nuevo** | lista explícita de los módulos de los directorios clínicos que **NO** son motores, con motivo. Es lo que permite que "todo lo demás" sea, por defecto, un motor sin registrar ⇒ CI rojo |
| `src/__tests__/clinical-registry.test.ts` | **actualizar** | quitar el número mágico `>= 15`; validar los campos nuevos; validar que cada `goldenTests[]` existe en disco (esto es lo que caza el defecto de §2.1) |
| `src/__tests__/clinical-registry-cobertura.test.ts` | **nuevo** | el gate de aceptación: motor nuevo sin registro ⇒ falla |
| `docs/clinical-decisions/<motor>.md` × ~18–20 | **nuevos** | "ADR por motor" |
| `docs/clinical-decisions/README.md` | **actualizar índice** | el test exige que el índice liste todos los ADRs |
| `.github/workflows/ci.yml` | **NO se toca** | `vitest run` ya es gate |
| Cualquier archivo de `src/app/**`, motor clínico, impresión, cobros o firma | **NO se tocan** | esta unidad no cambia ni una línea de lógica clínica ni de UI |

### 4.2 Contrato nuevo — `src/lib/clinical/registry.ts`

```ts
export type EstadoMotor = 'validado' | 'pendiente_validacion' | 'experimental'

export type TipoMotor =
  | 'formula'            // CKD-EPI, MELD, PPC
  | 'escala'             // SOFA, NEWS2, Braden, CHA2DS2-VASc
  | 'conversion'         // infusiones dosis↔mL/h, NEE, lb→kg
  | 'regla-de-seguridad' // vía parenteral, prescripción segura, plausibilidad de unidad
  | 'tabla-referencia'   // LMS OMS, coeficientes PREVENT

/**
 * Rango de validez del motor. NO se inventa: o está declarado en el código
 * (y se cita archivo:línea), o está en la fuente publicada (y se cita), o
 * queda explícitamente PENDIENTE de que lo defina el médico responsable.
 */
export type RangoValido =
  | { fuente: 'codigo';     entrada: string; salida: string; ref: string }        // ref = 'src/lib/...:120'
  | { fuente: 'referencia'; entrada: string; salida: string; ref: string }        // ref = cita de la publicación
  | { fuente: 'pendiente_validacion_clinica'; preguntaAlMedico: string }

export interface MotorClinico {
  id: string
  nombre: string
  especialidad: string
  tipo: TipoMotor                 // NUEVO
  version: string
  referencia: string
  unidades: string
  redondeo: string
  rangoValido: RangoValido        // NUEVO  ← "rango válido" del objetivo
  file: string
  /** Punto(s) de entrada exportado(s) que ESTE motor expone. */
  entryPoints: string[]           // NUEVO  p. ej. ['analizarVentilacion']
  /** Sub-cálculos que cubre (regla de granularidad §3.1). */
  calculos?: string[]             // NUEVO
  /** Ruta del ADR, relativa a la raíz del repo. */
  adr: string                     // NUEVO  'docs/clinical-decisions/NEWS2.md'
  /** Nombres de archivo EXACTOS, sin comentarios entre paréntesis. */
  goldenTests: string[]           // se limpia el formato (ver §4.5)
  estado: EstadoMotor
  /** Por qué existe este motor (una línea). El ADR lo desarrolla. */
  porQueExiste: string            // NUEVO  ← "ADR de por qué existe" del objetivo
}

export const CLINICAL_ENGINE_REGISTRY: MotorClinico[] = [ /* ~30–35 entradas */ ]
export const motorPorId: (id: string) => MotorClinico | undefined   // sin cambio
```

Los cinco campos nuevos son **obligatorios**: `tsc --noEmit` obliga a completarlos en las 15 entradas existentes. Eso es deliberado — es el mecanismo que impide dejar el registro a medias.

### 4.3 Contrato nuevo — `src/lib/clinical/cobertura.ts`

```ts
/** Directorios donde vive lógica clínica. Todo .ts aquí debe estar clasificado. */
export const DIRECTORIOS_CLINICOS = [
  'src/lib/uci',        // 19 archivos
  'src/lib/hospital',   // 10
  'src/lib/expediente', // 70 RECURSIVO (incluye antibiograma/, laboratorio/, cardiometabolico/)
  'src/lib/inmuno',     //  5
  'src/lib/clinical',   //  1 (el propio registry)
  'src/lib/seguridad',  //  3 — dosis.ts, alergias.ts, ofuscar-local.ts   ← AÑADIDO en la 2ª pasada
] as const
// Total a clasificar: ~108 archivos.

export interface ModuloNoMotor {
  file: string   // ruta relativa a la raíz, exacta
  motivo: string // por qué NO es un motor clínico (obligatorio, no vacío)
}

/**
 * Módulos de los directorios clínicos que NO son motores deterministas
 * (persistencia, prompts, tipos, parseo de texto, catálogos sin cálculo…).
 * Estar aquí es una decisión CONSCIENTE y revisable, no un silencio.
 */
export const MODULOS_NO_MOTOR: ModuloNoMotor[] = [
  { file: 'src/lib/expediente/firestore.ts', motivo: 'persistencia; no calcula' },
  { file: 'src/lib/expediente/prompts.ts',   motivo: 'texto de prompts para el LLM' },
  // … ~60 entradas más, una por archivo
]
```

Decisión: **lista central en vez de una etiqueta `@motor-clinico` dentro de cada archivo.** La etiqueta sería a prueba de renombres, pero obliga a editar ~105 archivos de producción. La lista central deja el diff completamente fuera del código que corre: se tocan 2 archivos de metadatos, 2 de tests y documentación. Un renombre rompe el test con un mensaje claro (`archivo listado que ya no existe`), que es un fallo deseable, no una regresión.

### 4.4 El gate — `src/__tests__/clinical-registry-cobertura.test.ts`

Seis aserciones. Las tres primeras son el criterio de aceptación; las tres últimas cierran las salidas de escape.

1. **Cobertura (el gate).** Recorre `DIRECTORIOS_CLINICOS` **de forma RECURSIVA** (obligatorio: `expediente/` esconde `antibiograma/`, `laboratorio/` y `cardiometabolico/` en subdirectorios; un `readdir` plano dejaría el motor de antibiograma fuera del gate y daría un verde falso), junta todos los `.ts`/`.tsx` (excluye `*.test.*` y `*.d.ts`). Cada archivo debe estar **o** referenciado por al menos una entrada del registro (`file`), **o** en `MODULOS_NO_MOTOR` con `motivo` no vacío. Si no: falla con
   `motor sin registrar: src/lib/uci/nuevo.ts — regístralo en registry.ts o justifícalo en MODULOS_NO_MOTOR`.
   ⇒ **un motor nuevo sin registro rompe el CI.** ✅ criterio de aceptación.
2. **Antifraude de la lista de exclusión.** Un archivo en `MODULOS_NO_MOTOR` **no puede** contener `export const *_ENGINE_VERSION` / `*_VERSION` de motor, ni un export cuyo nombre empiece por `calcular|calc|score|puntaje|dosis|indice|clasificar|estratificar`. Si lo tiene, es un motor disfrazado ⇒ falla. Esto impide "resolver" el gate metiendo el motor nuevo en la lista de excluidos.
3. **Catálogo de calculadoras.** Todo `CALCULADORAS[].id` de `expediente/calculadoras.ts` debe existir en el registro. (Import de datos puros, sin ciclo: `calculadoras.ts` no importa el registry.) Cubre el caso "motor nuevo dentro de un archivo ya clasificado".
4. **Sin punteros rotos.** Todo `file` del registro existe; todo `file` de `MODULOS_NO_MOTOR` existe; todo `goldenTests[i]` existe bajo `src/__tests__/` (incluidos subdirectorios `nucleo/`, `evidencia/`) y cumple `/^[a-z0-9-]+\.test\.tsx?$/`. **Esta aserción, hoy, ya falla** por §2.1 — el arreglo forma parte de la unidad.
5. **ADRs.** Todo `adr` del registro existe en disco y contiene los encabezados obligatorios (§4.6); todo `.md` de `docs/clinical-decisions/` salvo `README.md` está referenciado por alguna entrada (sin ADRs huérfanos); `README.md` enlaza todos. **Esta aserción, hoy, ya falla**: `dosis-amoxicilina.md` no está indexado en `README.md` (§0-bis punto 2). Repararlo es parte de la unidad.
6. **Rango válido.** Todo motor declara `rangoValido`; si `fuente === 'pendiente_validacion_clinica'`, `preguntaAlMedico` no puede estar vacío. El test **no** exige que ya esté resuelto — exige que la duda esté escrita. (Ver §6.)

`src/__tests__/clinical-registry.test.ts` se conserva y se le quita el `>= 15`: el conteo pasa a derivarse de la cobertura, no de un número a mano.

### 4.5 Limpieza de datos incluida

- `goldenTests` pasa de cadenas con comentario (`'clinical-safety-harness.test.ts (FIB-4 + property-based unidad)'`, `registry.ts:65`) a **nombres de archivo puros**; el comentario se mueve al ADR. Sin esto, la aserción 4 no puede verificar existencia.
- `uci-ckrt.test.ts` / `uci-ecmo.test.ts` → `uci-soportes.test.ts` (§2.1).

### 4.6 Plantilla de ADR (`docs/clinical-decisions/<id>.md`)

Se calca la de `NEWS2.md`, que ya funciona. Encabezados obligatorios (lo que verifica la aserción 5):

```markdown
# ADR — <nombre> (<id>)

- **Por qué existe:** <problema clínico-de-software que resuelve>
- **Fuente de verdad ÚNICA:** `<file>` (`<entryPoints>`). La UI NO recalcula.
- **Referencia:** <cita textual tomada del encabezado del propio archivo>
- **Parámetros / unidades canónicas:** <…>
- **Rango válido:** <declarado en código (archivo:línea) | de la publicación | PENDIENTE DE VALIDACIÓN CLÍNICA: <pregunta>>
- **Redondeo:** <…>
- **Missing data:** <qué hace si falta un dato — bloquea / parcial / no asume normal>
- **Golden:** <tests>
- **Estado:** validado | pendiente_validacion | experimental
- **Fecha / responsable:** <fecha> · <quién>
```

Regla al redactarlos: **el contenido se copia del encabezado del archivo fuente, no de la memoria del que escribe.** Si el archivo no declara un dato (p. ej. el rango), el ADR escribe `PENDIENTE DE VALIDACIÓN CLÍNICA` con la pregunta. No se rellena.

### 4.7 `estado` de las entradas nuevas

Las ~18 entradas nuevas entran como **`pendiente_validacion`**, no como `validado`. Motivo: `validado` significa que el médico responsable dio el visto bueno, y de estos motores no consta ese visto bueno en el repo (la excepción visible es el antibiograma, con `antibiograma-clsi-validado-dr.test.ts`). Subirlos a `validado` sin que el Dr. lo diga sería inventar una validación. Pasa a la lista de preguntas (§6).

## 5. Tests que lo prueban

| Test | Qué prueba | Nuevo/existente |
|---|---|---|
| `clinical-registry-cobertura.test.ts` · aserción 1 | motor nuevo sin registrar ⇒ rojo | nuevo |
| aserción 2 | no se puede esconder un motor en la lista de excluidos | nuevo |
| aserción 3 | escala nueva en `CALCULADORAS` sin registrar ⇒ rojo | nuevo |
| aserción 4 | el registro no apunta a archivos/tests inexistentes | nuevo (hoy fallaría) |
| aserción 5 | cada motor tiene ADR real e indexado | nuevo |
| aserción 6 | cada motor declara rango válido o la pregunta pendiente | nuevo |
| `clinical-registry.test.ts` | integridad de campos, ids únicos, `motorPorId` | existente, actualizado |

**Prueba negativa obligatoria en la implementación** (si no, el gate no está demostrado): crear temporalmente `src/lib/uci/__motor-falso.ts`, correr `vitest run clinical-registry-cobertura`, verificar que **falla** con el mensaje esperado, y borrarlo. Se deja constancia en `RESULTADO.json`.

Gates de la unidad: `npx tsc --noEmit` limpio, `npx vitest run` en verde (la línea base tras E0-02 es **1947** tests, no solo los nuevos), `npm run build` OK. CI (`.github/workflows/ci.yml:26`) ya corre `npx vitest run` en cada PR y en push a `main`, así que **no hay que tocar CI**: un test nuevo bajo `src/__tests__/` es automáticamente el gate que pide la aceptación.

## 6. Decisión clínica que NO está en el repo

Esta unidad está diseñada para **completarse sin respuesta del médico**: lo que falte se codifica como `{ fuente: 'pendiente_validacion_clinica', preguntaAlMedico }` y como sección `PENDIENTE` del ADR, y el CI acepta ese estado. No se bloquea la etapa E0. Pero hay tres cosas que solo el Dr. puede cerrar, y hasta entonces **no se inventan**:

1. **Rango válido de entrada/salida** de los motores cuyo código no lo declara. Para algunos ya está en el código y se cita sin más (p. ej. `creatininaPlausibleMgDl` en `funcion-renal.ts`, `RANGOS` en `ventilacion.ts:29`, los pisos/topes de MELD 6–40). Para el resto (p. ej. rangos plausibles de bilirrubina/INR de entrada, de peso en `infusiones.ts`, de PIC/PAM en `neuro.ts`) hace falta que el Dr. fije el umbral de "esto no puede ser un dato real". **No lo pongo yo.**
2. **Qué motores considera `validado`** y cuáles quedan `pendiente_validacion`. Yo los meto todos como `pendiente_validacion` por omisión.
3. **Si algún módulo que voy a clasificar como motor NO debe serlo** (o al revés). La clasificación borde es: `uci/tendencias.ts`, `uci/correlacion.ts`, `uci/extraccion.ts`, `uci/seguridad.ts`, `expediente/farmacovigilancia.ts`, `hospital/cds.ts`. Mi criterio propuesto: si produce un número o una bandera que el médico puede leer como dato clínico, es motor. Confirmarlo es del Dr.
4. **Alcance de `DIRECTORIOS_CLINICOS` (§3.2).** Propongo cubrir `uci`, `hospital`, `expediente`, `inmuno`, `clinical` y `seguridad`, y dejar fuera `evidencia`, `voz`, `ia`, `fhir`, `hl7` y `compliance`. Si el Dr. considera que alguno de esos últimos emite un dato que él leería como clínico, entra al gate y se registra.

**Ninguna de las cuatro bloquea la unidad:** las cuatro se codifican como estado declarado (`pendiente_validacion_clinica` con su pregunta escrita) y el CI acepta ese estado. Ninguna se resuelve inventando un valor.

## 7. Riesgo de regresión sobre producción

**Bajo, y por una razón verificable, no por optimismo:** `CLINICAL_ENGINE_REGISTRY` no lo importa **ningún** archivo de `src/app/**` ni de `src/lib/**` — solo su propio test (grep de `clinical/registry` y `CLINICAL_ENGINE_REGISTRY` en todo `src/`). Es metadato inerte.

- No se toca ninguna fórmula, ningún umbral, ninguna dosis.
- No se toca impresión, cobros, firma ni hashes de integridad (los frentes que la carta operativa marca como intocables a ciegas).
- El cambio de tipo (`MotorClinico` con campos obligatorios) solo puede romper `registry.ts` y su test — lo caza `tsc` en el acto.
- Riesgo residual real: **el gate nuevo puede dejar `main` en rojo** si clasifico mal un archivo. Se mitiga corriendo `vitest run` completo dentro de la propia unidad antes de darla por hecha (gate del protocolo), no después.
- Segundo riesgo residual: fricción futura. Un archivo nuevo cualquiera en `src/lib/expediente/` (aunque sea un helper) obligará a clasificarlo. Es el costo deliberado de un gate *fail-closed*: es preferible una línea de clasificación a un motor clínico invisible.

## 8. Orden de ejecución sugerido para la implementación

1. Ampliar `MotorClinico` y rellenar las **15 entradas existentes** (incl. arreglo de `goldenTests` §4.5). `tsc` verde.
2. Escribir `cobertura.ts` con `MODULOS_NO_MOTOR` vacío y el test de cobertura ⇒ **rojo con el inventario completo**. Ese listado rojo *es* el inventario que hay que clasificar (más barato y más fiable que enumerarlo a mano).
3. Clasificar: cada archivo del rojo va a registro (motor) o a `MODULOS_NO_MOTOR` (con motivo). Verde.
4. Escribir los ADRs de las entradas nuevas copiando del encabezado de cada archivo fuente. Actualizar `README.md`.
5. Prueba negativa del gate (§5). Gates `tsc` + `vitest` + `build`.
6. `RESULTADO.json` + `estado.json` + `CHECKPOINT.md`; las tres preguntas de §6 a `necesitaValidacionDelDr`.
