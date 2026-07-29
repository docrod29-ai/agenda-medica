# E0-12 — El sello de integridad cubre TODO el contenido firmable · DISEÑO (no implementado)

> **Objetivo (backlog):** «Cerrar el hueco de preop/hospital/infectología fuera del hash (NOM-024), con `hashVersion` 3 y migración explícita.»
> **Aceptación:** «Alterar `preop.resultados` de una nota firmada la marca `'alterada'`.»
> **Entregables:** `contenidoCanonico` completo · `hashVersion` 3 · plan de migración de notas legadas.
> **Riesgo:** alto. **Validación clínica:** no. **Depende de:** nada.

---

## 0. Qué YA existe (no se construye de cero)

| Pieza | Dónde | Qué hace hoy |
|---|---|---|
| Motor del sello | `src/lib/expediente/integrity.ts:12-18` | `sha256Hex` con Web Crypto (navegador + Node 18 + Edge). Sin dependencias. |
| Canonicalización estable | `src/lib/expediente/integrity.ts:26-37` | `estable()`: ordena llaves recursivamente y omite `undefined`. Existe porque Firestore **no** conserva el orden de llaves de los mapas; sin esto una nota intacta daba falso `'alterada'`. |
| Contenido canónico actual | `src/lib/expediente/integrity.ts:40-53` | **10 campos**: `metadata.id`, `tipo`, `pacienteId`, `metadata.medicoId`, `fechaConsulta`, `secciones→{k,v}`, `diagnosticos`, `medicamentos`, `alergias`, `signosVitales ?? null`. |
| Versión del algoritmo | `src/lib/expediente/integrity.ts:56` | `HASH_VERSION = 2`. |
| Verificación | `src/lib/expediente/integrity.ts:81-91` | `verificarIntegridadEstado`: `'sin-sello'` \| `'legado'` (`hashVersion` ausente/1) \| `'verificada'` \| `'alterada'`. |
| Único punto que sella | `src/app/(dashboard)/consulta/[patientId]/page.tsx:1742-1761` | `firmar()`: calcula el hash sobre `construirNota('firmada')` y luego adjunta `metadata.hashVersion` y `firma`. |
| Único punto que verifica | `src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx:68,152-153,427-467` | Estado en un union literal en el `useState` (línea 68); alarma roja para `'alterada'` (427-439), aviso neutro para `'legado'` (442-453). |
| Inmutabilidad de la firmada | `firestore.rules:189-190` | `allow update/delete: if isMedico(clinicId) && resource.data.estado != 'firmada'` → **el cliente no puede reescribir una nota firmada.** |
| Normalización al leer | `src/lib/expediente/firestore.ts:22-32` | `normNota` **sobrescribe el `id` de nivel superior con el `doc.id`** y rellena 4 arreglos ausentes con `[]`. |
| Simetría con `undefined` | `src/lib/expediente/firestore.ts:66-79` | `stripUndefined` recursivo antes de escribir (Firestore rechaza `undefined`). |
| Tests del sello | `src/__tests__/integrity.test.ts` | 6 casos: reorden de llaves, cambio de contenido, `verificada`, `alterada`, `legado`, `sin-sello`. |

### 0-bis. El hueco medido (por qué esta unidad existe)

`NotaMedica` (`src/types/expediente.ts:153-264`) tiene **24 campos**. El sello v2 cubre 10.
Lo que hoy se puede alterar en una nota **firmada** sin que el sello se entere:

| Campo fuera del sello | Dónde se escribe hoy | Consecuencia de alterarlo |
|---|---|---|
| `preop` (`inputs` + `resultados`) | `consulta/…/page.tsx:1289`; lo produce `PreopAssessment.tsx:181-182` (RCRI, DASI, Caprini, STOP-BANG, ARISCAT, CHA₂DS₂-VASc, HAS-BLED) | **Es la aceptación de esta unidad.** Se puede cambiar el puntaje de riesgo quirúrgico de una valoración firmada y la nota sigue diciendo «integridad verificada». |
| `hospital` (servicio, cama, día, condición, balance hídrico) | tipo declarado (`expediente.ts:183-191`); **ningún camino lo escribe hoy** | Hueco latente: el día que el módulo hospitalario lo escriba, nace fuera del sello. |
| `infectologia` (día de antibiótico, esquema, desescalada, cultivos) | tipo declarado (`expediente.ts:194-200`); **ningún camino lo escribe hoy** | Igual: PROA/NOM-045 quedaría fuera del sello por omisión. |
| `resumenEjecutivo` | `page.tsx:1265` | Es la primera línea que se **imprime** de la nota. |
| `secciones[].label` | `page.tsx:1266` | El documento renderiza `s.label` (`nota/…/page.tsx:358`): cambiar «Objetivo» por «Subjetivo» cambia lo que el documento afirma. v2 sólo sella `{k,v}`. |
| `estudiosOrden` | `page.tsx:1287` | Pre-pobla la orden médica (`orden/…/page.tsx:376`). |
| `internamientoId` | `page.tsx:1288` | Mover una nota de episodio de internamiento es reescribir el contexto clínico. |
| `iaAuditoria` (incluye `provenance`) | `page.tsx:1290-1314` | La procedencia de la IA es un **invariante del programa** («cada respuesta clínica almacena su procedencia para reconstruir cualquier incidente»). Hoy se puede editar el modelo, el `promptVersion` o `revisadoPorHumano` de una nota firmada. |
| `transcripcionCruda`, `dialogoDiarizado` | `page.tsx:1315-1316` | Es la **fuente** del expediente (dictado re-proyectable). Sin sello, la evidencia de origen es editable. |
| `pacienteNombre` | `page.tsx:1237` | Identidad impresa en el documento legal. (REG-040 ya impide firmar con nombre vacío.) |
| `metadata`: `tipoNota`, `clinicId`, `cedulaProfesional`, `especialidad`, `establecimiento`, `fechaCreacion`, `fuenteGeneracion` | `page.tsx:1239-1264` | Cédula y establecimiento son el encabezado medicolegal; `fuenteGeneracion` afirma si la nota la produjo la voz/IA o la mano. |
| `creadoPor` | `page.tsx:1321` | Autor real del documento. |

**Nota honesta:** el riesgo NO es que el médico edite su nota desde la app — `firestore.rules:189` lo impide. El riesgo es (a) escritura por Admin SDK / consola / import, (b) un bug futuro que reescriba una firmada, (c) un compromiso de credenciales. Exactamente los escenarios para los que existe NOM-024 y un hash: el sello no previene la alteración, la vuelve **detectable**. Hoy es detectable en 10 campos de 24.

---

## 1. Cambio mínimo propuesto

**4 archivos: 2 nuevos, 2 modificados. Cero cambios de comportamiento en el flujo de firma.**

| Archivo | Acción | Por qué |
|---|---|---|
| `src/lib/expediente/integrity.ts` | **modificar** (el 90 % del trabajo) | canonizador v3 + v2 congelado + verificación por versión declarada + partición sellado/no-sellado. |
| `src/lib/expediente/serializacion.ts` | **nuevo** | mueve `stripUndefined` (hoy privado en `firestore.ts:66-79`) a un módulo **puro** para poder simular el viaje a Firestore en los tests sin importar el SDK. `firestore.ts` lo re-exporta/importa: **cero** cambios en llamadores. |
| `src/__tests__/e0-12-sello-integridad.test.ts` | **nuevo** | aceptación + trampas de round-trip + retro-compat + trinquete de cobertura. |
| `src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx` | **modificar (mínimo, ~12 líneas)** | mostrar la **cobertura** del sello en notas v2 (aviso neutro, sin alarma). Ver §4: es opcional para la aceptación y es lo único que toca UI. |

**NO se toca** `consulta/[patientId]/page.tsx`: `firmar()` ya llama `generarHashIntegridad(nota)` y escribe `hashVersion: HASH_VERSION` (línea 1748). Subir la constante a 3 basta para que las notas nuevas nazcan con el sello completo. Es deliberado: el flujo de firma es el código de mayor riesgo del repo (REG-017, REG-040) y esta unidad no necesita entrar ahí.

### 1.1 Contrato de `src/lib/expediente/integrity.ts`

```ts
/** Versión del algoritmo de sello que usan las notas NUEVAS. */
export const HASH_VERSION = 3

/** Versiones que este build sabe RE-VERIFICAR (v1 no: dependía del orden de llaves). */
export const VERSIONES_VERIFICABLES = [2, 3] as const
export type VersionSello = (typeof VERSIONES_VERIFICABLES)[number]

/**
 * Partición EXPLÍCITA de los campos de NotaMedica bajo el sello v3.
 * Cada campo está en una lista o en la otra, con su razón escrita. El test de
 * cobertura falla si un campo nuevo del tipo no aparece en ninguna: un campo
 * firmable no puede quedar fuera del sello por descuido (como pasó con `preop`).
 */
export const CAMPOS_SELLADOS_V3: readonly string[]
export const CAMPOS_NO_SELLADOS_V3: readonly { campo: string; razon: string }[]

/** Qué cubre cada versión del sello, para poder DECIRLO en la nota. */
export const COBERTURA_SELLO: Record<VersionSello, { cubre: readonly string[]; noCubre: readonly string[] }>

/** Hash del contenido clínico. `version` permite re-verificar sellos antiguos. */
export function generarHashIntegridad(nota: NotaMedica, version?: VersionSello): Promise<string>

export type EstadoIntegridad = 'verificada' | 'alterada' | 'legado' | 'sin-sello'  // SIN CAMBIOS

export function verificarIntegridadEstado(nota: NotaMedica): Promise<EstadoIntegridad>  // firma sin cambios

/** Nuevo: el estado MÁS su cobertura, para el aviso de la pantalla de nota. */
export interface DetalleIntegridad {
  estado: EstadoIntegridad
  /** Versión declarada en la nota (`undefined` si no hay sello). */
  version?: number
  /** true si la versión del sello es la actual (cubre todo lo firmable). */
  cobreTodo: boolean
  /** Campos que ESE sello no cubre (vacío en v3). */
  noCubre: readonly string[]
}
export function verificarIntegridadDetalle(nota: NotaMedica): Promise<DetalleIntegridad>
```

`generarHashFirma` y `verificarIntegridad` (booleano) **no cambian de firma**.

### 1.2 El canonizador v3 — partición campo por campo

`estable()` no cambia (ya resuelve el orden de llaves). El objeto canónico v3:

```ts
function canonicoV3(nota: NotaMedica): string {
  return JSON.stringify(estable({
    v: 3,                                  // literal, NO nota.metadata.hashVersion — ver trampa T5
    // ── identidad del documento
    id: nota.metadata.id,                  // metadata.id, NO el id de nivel superior — trampa T1
    clinicId: nota.clinicId ?? null,
    pacienteId: nota.pacienteId,
    pacienteNombre: nota.pacienteNombre ?? '',
    tipo: nota.tipo,
    fechaConsulta: nota.fechaConsulta,
    createdAt: nota.createdAt ?? null,
    creadoPor: nota.creadoPor ?? '',
    // ── encabezado medicolegal (metadata; ver exclusiones abajo)
    meta: {
      tipoNota: nota.metadata.tipoNota,
      clinicId: nota.metadata.clinicId,
      pacienteId: nota.metadata.pacienteId,
      medicoId: nota.metadata.medicoId,
      cedulaProfesional: nota.metadata.cedulaProfesional ?? '',
      especialidad: nota.metadata.especialidad ?? '',
      establecimiento: nota.metadata.establecimiento ?? '',
      fechaCreacion: nota.metadata.fechaCreacion ?? null,
      fuenteGeneracion: nota.metadata.fuenteGeneracion ?? null,
    },
    // ── cuerpo clínico
    resumenEjecutivo: nota.resumenEjecutivo ?? '',
    secciones: nota.secciones,             // objeto COMPLETO (incluye `label`, que se imprime)
    signosVitales: nota.signosVitales ?? null,
    diagnosticos: nota.diagnosticos,
    medicamentos: nota.medicamentos,
    alergias: nota.alergias,
    // ── los tres huecos que nombra el backlog
    preop: nota.preop ?? null,
    hospital: nota.hospital ?? null,
    infectologia: nota.infectologia ?? null,
    // ── contexto y trazabilidad
    estudiosOrden: nota.estudiosOrden ?? null,
    internamientoId: nota.internamientoId ?? null,
    iaAuditoria: nota.iaAuditoria ?? null,
    transcripcionCruda: nota.transcripcionCruda ?? null,
    dialogoDiarizado: nota.dialogoDiarizado ?? null,
  }))
}
```

**Lo que queda FUERA del sello, con su razón (`CAMPOS_NO_SELLADOS_V3`):**

| Campo | Razón de excluirlo |
|---|---|
| `id` (nivel superior) | `normNota` (`firestore.ts:26-27`) lo **sobrescribe con el `doc.id`** al leer, y al firmar vale `notaId ?? ''` (`page.tsx:1234`), que en el camino rápido es `''`. Sellarlo marcaría `'alterada'` **toda** nota firmada sin borrador previo. La identidad se sella vía `metadata.id`, que se guarda literal (y que ya tiene su propio candado documentado en `page.tsx:1240-1250`). |
| `metadata.fechaModificacion` | se fija **después** de calcular el hash (`page.tsx:1748`). |
| `updatedAt` | `updateNota` lo reescribe en cada escritura (`firestore.ts:219`). |
| `metadata.hashIntegridad` | auto-referencia. |
| `metadata.hashVersion` | vale `undefined` cuando se calcula el hash y `3` cuando se lee. Se sella el literal `v: 3` en su lugar: un sello v3 al que se le baje `hashVersion` a 2 se recalcula con el juego de campos v2 → **no coincide → `'alterada'`** (el ataque de degradación queda cubierto, con test). |
| `metadata.version` | contador de versiones del documento; lo mueve el versionado (`firestore.ts:199-217`). |
| `estado` y `metadata.estado` | `'cancelada'` es una transición **legítima** posterior a la firma; sellarla convertiría una cancelación en «alterada». |
| `firma` | se adjunta **después** de calcular el hash (`page.tsx:1749-1760`); sellarla haría que toda nota firmada saliera `'alterada'`. Su integridad va por `hashFirma`. **Residual declarado** → §6. |

### 1.3 v2 se **congela**, no se borra

```ts
/** CONGELADO. No editar: notas ya firmadas dependen de esta función exacta. */
function canonicoV2(nota: NotaMedica): string { /* … idéntico a integrity.ts:40-53 de hoy … */ }

const CANONICO: Record<VersionSello, (n: NotaMedica) => string> = { 2: canonicoV2, 3: canonicoV3 }

export async function verificarIntegridadEstado(nota: NotaMedica): Promise<EstadoIntegridad> {
  if (!nota.metadata.hashIntegridad) return 'sin-sello'
  const v = nota.metadata.hashVersion ?? 1
  const canon = CANONICO[v as VersionSello]
  if (!canon) return 'legado'          // v1 (no re-verificable) y versiones futuras desconocidas
  return (await sha256Hex(canon(nota))) === nota.metadata.hashIntegridad ? 'verificada' : 'alterada'
}
```

Que una versión **futura** desconocida caiga en `'legado'` (aviso neutro) y no en `'alterada'` (alarma roja) es deliberado: durante un despliegue parcial un cliente viejo puede leer una nota sellada por un cliente nuevo, y eso no es una alteración.

---

## 2. Plan de migración de notas legadas (entregable 3)

### 2.1 Lo que NO se hace, y por qué

**No se re-sella ninguna nota firmada.** Dos razones independientes, cada una suficiente:

1. **Legal.** Un sello afirma «éste era el contenido *en el momento de la firma*». Recalcularlo hoy afirmaría eso sobre un contenido observado hoy: es fabricar evidencia. Si la nota fue alterada en 2026-05, el re-sello **bendice la alteración** y destruye la única prueba.
2. **Técnica.** `firestore.rules:189` prohíbe al cliente actualizar una nota firmada. Sólo el Admin SDK podría, es decir: exactamente el vector de riesgo del que el sello debe proteger.

**Tampoco se escribe un script de censo que lea producción.** Contar cuántas notas firmadas son v1/v2/v3 exige credenciales y lectura de PHI real → regla 2. El conteo lo obtiene el dueño desde su consola; el dato **por nota** ya lo muestra la propia pantalla (§4).

### 2.2 Lo que sí se hace: verificar cada nota con SU versión

Este es el corazón del plan, y también la regresión que hay que evitar:

> Si `HASH_VERSION` sube a 3 **sin** el despacho por versión de §1.3, la condición actual `if ((nota.metadata.hashVersion ?? 1) < HASH_VERSION) return 'legado'` (`integrity.ts:83`) convierte **todas** las notas v2 —hoy `'verificada'`— en `'legado'`: un build pierde de golpe la verificabilidad de todo el histórico firmado. Es un retroceso de cumplimiento disfrazado de mejora.

Con el despacho por versión: v2 sigue `'verificada'` bit a bit igual que hoy (test 5 + vector golden), v3 nace cubriendo todo, v1 sigue `'legado'`. **Cero notas cambian de estado por este cambio.**

### 2.3 Migración por convergencia natural, con la cobertura a la vista

- Nada que migrar en los datos: la población v2 se extingue por sí sola (cada nota nueva nace v3).
- Mientras coexistan, la pantalla de nota dice la verdad completa: v2 = «sello verificado, cubre el cuerpo de la nota; **no** cubre valoración preoperatoria, datos hospitalarios, infectología ni trazabilidad de IA». Eso es honesto y no alarma: no hay indicio de alteración.
- Una nota v2 que necesite quedar sellada completa se corrige por el mecanismo que ya existe y que sí es legal: **adenda** (`Adenda`, `firestore.ts:251`, subcolección inmutable), que nace bajo el régimen actual.

### 2.4 Opción que requiere decisión del dueño (NO se implementa aquí)

«Constancia de estado observado»: subcolección `notas/{id}/sellos/{selloId}` escrita por Admin SDK con `{ hashV3, observadoEn, porQuien, etiqueta: 'hash de estado observado en la fecha indicada — NO es el sello de la firma' }`. Da detección de alteraciones **de aquí en adelante** para el histórico, sin fingir cobertura retroactiva. Es una decisión de semántica legal del expediente, no una derivable del código → **queda como propuesta, fuera del alcance de esta unidad.**

---

## 3. Tests (`src/__tests__/e0-12-sello-integridad.test.ts`)

Fixture `notaV3Completa()`: **todos** los campos de `NotaMedica` poblados con datos **sintéticos** (paciente ficticio), incluido `preop.resultados` con la forma real que produce `PreopAssessment.tsx:181-182` y bloques `hospital`, `infectologia`, `iaAuditoria.provenance`.

| # | Caso | Espera |
|---|---|---|
| **1** | **ACEPTACIÓN.** Nota v3 firmada; se altera `preop.resultados.rcri.puntos` | `'alterada'` |
| 2 | Tabla parametrizada, **una hoja alterada por caso**: `preop.inputs.*`, `hospital.cama`, `hospital.balanceHidrico.balance`, `infectologia.diaAntibiotico`, `infectologia.candidatoDesescalada`, `resumenEjecutivo`, `secciones[0].label`, `secciones[0].value`, `estudiosOrden[0]`, `internamientoId`, `transcripcionCruda`, `dialogoDiarizado[0].text`, `iaAuditoria.provenance.modelo`, `iaAuditoria.provenance.revisadoPorHumano`, `pacienteNombre`, `metadata.cedulaProfesional`, `metadata.establecimiento`, `metadata.fuenteGeneracion`, `creadoPor` | `'alterada'` en los 19 |
| 3 | **Negativos** (no deben alarmar), uno por caso: adjuntar `firma`; cambiar `metadata.fechaModificacion`; `updatedAt`; `metadata.version`; `estado: 'cancelada'`; sustituir el `id` de nivel superior por un `doc.id` distinto | `'verificada'` |
| 4 | **Round-trip simulado completo**: `stripUndefined` (módulo nuevo) → barajado profundo de llaves → defaults de `normNota` → las 5 mutaciones post-hash juntas | `'verificada'` |
| 5 | **Retro-compat v2**: nota sellada con `generarHashIntegridad(n, 2)` y `hashVersion: 2` | `'verificada'` (**no** `'legado'`) |
| 6 | **Vector golden v2** (congela el algoritmo legado; con la fixture de `integrity.test.ts`): `generarHashIntegridad(nota, 2) === '939119bcc0b4738acde02fdb9ce8740ecdafbb45b604c649c270b9dfde029b8d'` *(calculado con el código actual de `integrity.ts`; si alguien edita `canonicoV2`, rojo)* | igualdad exacta |
| 7 | **Degradación**: nota v3 con `hashVersion` bajado a 2 | `'alterada'` |
| 8 | Versión desconocida (`hashVersion: 99`) | `'legado'` |
| 9 | v1 / ausente sigue `'legado'`; sin hash sigue `'sin-sello'` | igual que hoy |
| **10** | **Trinquete de cobertura**: las llaves de `notaV3Completa()` (y de su `metadata`) ⊆ `CAMPOS_SELLADOS_V3 ∪ CAMPOS_NO_SELLADOS_V3`, intersección vacía, y toda exclusión trae `razon` no vacía | un campo nuevo sin clasificar **rompe el CI** |
| 11 | `COBERTURA_SELLO[3].noCubre` es vacío para lo firmable; `COBERTURA_SELLO[2].noCubre` incluye `preop`, `hospital`, `infectologia` | igualdad |

`src/__tests__/integrity.test.ts` **no se modifica** (sus 6 casos deben seguir verdes tal cual: son la prueba de que v2 no se movió). Registro en `docs/audit/regression-ledger.md` como **REG-059** y alta en `CLINICAL_ENGINE_REGISTRY[].goldenTests` si el sello figura como motor, para que E0-11 lo proteja.

---

## 4. Cambio de UI (mínimo y opcional para la aceptación)

En `nota/[patientId]/[notaId]/page.tsx`: cambiar la llamada de `verificarIntegridadEstado` a `verificarIntegridadDetalle` (línea 152-153), guardar el detalle en el `useState` de la línea 68 y, cuando `estado === 'verificada' && !cobreTodo`, añadir un renglón neutro al bloque ya existente de la línea 456: «sello v2 — cubre el cuerpo de la nota; no cubre: valoración preoperatoria, datos hospitalarios, infectología, trazabilidad de IA». **No se toca** la alarma roja de `'alterada'` (427-439) ni el aviso de `'legado'` (442-453), ni nada del área de impresión (`no-print` ya está puesto en los avisos).

Si el dueño prefiere no tocar esa pantalla en este lote, la unidad **igual cumple la aceptación** (que es sobre el motor): el detalle queda disponible en la API y la UI se conecta después.

---

## 5. Riesgo de regresión REAL

| Riesgo | Probabilidad | Mitigación / prueba |
|---|---|---|
| **Falso `'alterada'` en notas nuevas** por un campo que no sobrevive el viaje a Firestore. Es el modo de falla grave: una alarma roja de «documento posiblemente alterado» sobre notas legítimas destruye la confianza en el sello (ya pasó una vez: memoria «Sello de integridad vs Firestore»). | Media si se sella a ciegas; **baja** con este diseño | Las 5 trampas están identificadas (T1 `id`, T2 `fechaModificacion`, T3 `updatedAt`, T4 `firma`, T5 `hashVersion`) y **excluidas con razón escrita**; tests 3 y 4 las prueban juntas; `estable()` + `stripUndefined` cubren reorden y `undefined`. |
| **Notas v2 pierden verificabilidad** al subir la constante | Alta si se implementa la versión ingenua | §1.3 despacha por versión declarada; tests 5 y 6. |
| Alarma sobre `preop.inputs` con `NaN` (`Number('abc')` en `PreopAssessment`) | Baja | `JSON.stringify(NaN) → null` en ambos lados (antes de escribir y al leer de Firestore) → simétrico. `Infinity` sí rompería, pero Firestore ya lo rechaza al **escribir**, así que no puede existir en un documento firmado. |
| `iaAuditoria.extraction` es un blob libre del LLM | Baja | Ya se escribe hoy tal cual (si no round-trippeara, el guardado actual ya fallaría). Arreglos anidados —lo único que Firestore rechaza— no pueden existir en un documento guardado. |
| Coste de CPU del hash (ahora incluye transcripción + diálogo, decenas–cientos de KB) | Baja | SHA-256 sobre ≤1 MB (tope duro del documento, `firestore.ts:96,236`) es del orden de milisegundos; se calcula **una vez** al firmar y una al abrir. |
| Impresión / PDF / receta | **Ninguna** | Este diseño no toca el área imprimible: los avisos son `no-print` y el pie del sello (línea 456-467) sólo suma un renglón `no-print` opcional. |
| Cobros, flujo de firma, agenda | **Ninguna** | `consulta/…/page.tsx` no se modifica; `firestore.ts` sólo mueve una función privada pura. |

---

## 6. Residuales que este diseño NO cierra (declarados, no escondidos)

1. **`firma` fuera del sello de contenido.** `hashFirma = sha256(notaId|medicoId|timestamp)` (`integrity.ts:64-70`) no cubre `nombreMedico`, `cedulaProfesional`, `especialidad`, `institucion` ni `imagenDataUrl`. v3 sí sella `metadata.cedulaProfesional/especialidad/establecimiento`, así que un cambio en el bloque `firma` se puede **detectar por contradicción** con la metadata sellada, pero el hash por sí solo no lo ve. Propuesta acotada (fuera de esta unidad, porque toca el flujo de firma y la impresión): `hashFirma` v2 = `sha256(notaId|medicoId|timestamp|cedula|nombre)`, con el mismo despacho por versión.
2. **`estado`/`version` deliberadamente fuera:** una cancelación indebida no la detecta el sello. Es responsabilidad de las reglas y del log de auditoría (`src/lib/expediente/audit-log.ts`), no del hash.
3. **`hospital` e `infectologia` no los escribe nadie hoy.** Sellarlos es blindaje preventivo; el test 2 los prueba con fixtures sintéticas y no con un camino de producción existente.
4. **Notas v1 siguen sin ser re-verificables** — por diseño del algoritmo original, no por esta unidad.

---

## 7. Orden de implementación sugerido

1. `src/lib/expediente/serializacion.ts` (mover `stripUndefined`, re-exportar desde `firestore.ts`) → `npx tsc --noEmit`.
2. `canonicoV2` congelado + despacho por versión, **manteniendo `HASH_VERSION = 2`** → correr `integrity.test.ts` + tests 5/6/8/9 → todo verde = v2 intacto.
3. `canonicoV3` + `CAMPOS_SELLADOS_V3` / `CAMPOS_NO_SELLADOS_V3` + `COBERTURA_SELLO` + `verificarIntegridadDetalle`.
4. Subir `HASH_VERSION = 3` → tests 1/2/3/4/7/10/11.
5. UI (§4) si el dueño lo aprueba en este lote.
6. Gates: `npx tsc --noEmit` · `npx vitest run src/__tests__/` · `npm run build`. Ledger REG-059.

**Validación clínica: NO se requiere.** Ningún umbral, dosis ni regla clínica se decide aquí: la unidad sólo amplía qué bytes entran a un SHA-256. Las únicas decisiones son de ingeniería/legales del expediente, y la única que no se puede derivar del código (§2.4, constancia de estado para el histórico) queda marcada como propuesta al dueño, sin implementar.
