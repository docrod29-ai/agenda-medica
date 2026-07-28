# E0-09 — Eventos hospitalarios críticos append-only · DISEÑO

> **Estado:** diseño. NO implementado. No se tocó una sola línea de código en esta unidad.
> **Etapa:** E0 (hardening). **Riesgo declarado en backlog:** medio. **Dependencias:** ninguna.

## 1. Qué pide la unidad

- **Objetivo:** MAR, órdenes y eventos de UCI **no se pueden editar ni borrar: sólo se anexa corrección**.
- **Entregables:** (a) reglas append-only; (b) UI de corrección; (c) tests.
- **Aceptación:** *un update sobre un evento sellado es rechazado por reglas.*

## 2. Qué existe YA en el repo (no rehacer)

| Pieza | Dónde | Estado real |
|---|---|---|
| Doc de internamiento **cerrado al cliente** | `firestore.rules:234` — `allow create, update, delete: if false` | Ya blindado. Todo cambio pasa por el gateway servidor. |
| Gateway con RBAC por acción | `src/app/api/hospital/mutar/route.ts:20` (`GATES`) y `:259` (`tx.update`) | Admin SDK, transacción, autor y hora **sellados por el servidor** (`:113-118`). |
| Subcolección append-only **`registros`** | `mutar/route.ts:263` — `tx.set(ref.collection('registros').doc(), durable)` | **YA EXISTE** y es la "fuente de verdad legal (sin truncar)" declarada en `registro-durable.ts:1-11`. |
| Constructor puro del evento durable | `src/lib/hospital/registro-durable.ts:14` — `registroDurable()` | Cubre **sólo 3 acciones**: `balance`, `escala`, `sbar` (`:19-21`). Todo lo demás → `null` (`:22`). |
| Test del constructor | `src/__tests__/hospital-registro-durable.test.ts` | `:24` **afirma explícitamente** que `administrar` devuelve `null`. |
| Guardas de inmutabilidad ya vigentes en el servidor | `mutar/route.ts:70-79` (`indicacion_editar` / `indicacion_borrar` bloqueados si `administraciones.length > 0`), `:82-112` (`administrar` exige episodio activo + indicación activa) | Buenas. No hay ninguna acción que edite o borre una administración ya registrada. |
| Patrón "append + corrección" ya aceptado en el repo | `firestore.rules:187-199` — `notas/{id}/versions` y `notas/{id}/adendas` con `allow create: …; allow update, delete: if false;` | **Es el molde exacto** que pide esta unidad. Reusarlo, no inventar otro. |
| Historial de resultados de lab sin pérdida | `src/lib/hospital/firestore.ts:305-330` (`cargarResultadosLab` → `historialResultados`) + `types/hospital.ts` `CargaResultadoLab` | Ya conserva cargas previas (por código, no por reglas). |
| Guardián estático de reglas | `src/__tests__/firestore-rules-guard.test.ts` | Patrón aceptado: lee `firestore.rules` y fija invariantes por regex. **Es el único gate de reglas que hay hoy** (no hay emulador — eso es E0-08). |
| Eventos de UCI | `src/app/(dashboard)/uci/page.tsx` | El panel de UCI **no persiste eventos**: calcula en memoria y desemboca en una nota `evolucion_uci` (`uci/page.tsx:318-320`) que ya cae bajo la inmutabilidad de notas firmadas + adendas. `ICUObservation` (`src/types/uci.ts:62`) **no tiene capa de almacenamiento: cero consumidores** (verificado por grep). |

## 3. Los tres huecos REALES (con evidencia)

### H1 · El MAR no llega al libro append-only

`registroDurable` devuelve `null` para `administrar`, `indicacion_agregar`, `indicacion_suspender` y `verificar_farmacia` (`registro-durable.ts:22`, confirmado por el test `hospital-registro-durable.test.ts:24-27`). El registro de administración vive **sólo** dentro del array anidado `indicaciones[].administraciones[]` del doc de internamiento (`mutar/route.ts:120`).

Consecuencias:

1. **Las reglas no pueden protegerlo, ni ahora ni nunca**: es un array anidado dentro de un doc que escribe el **Admin SDK**, y el Admin SDK **ignora** las Firestore Rules por diseño. La aceptación de esta unidad ("un update es rechazado por reglas") es **inalcanzable** mientras el evento del MAR sea un elemento de array del doc.
2. Ese array **no tiene tope** (a diferencia de `balanceHidrico`/`escalas`/`sbar`, acotados con `.slice(-100)` en `mutar/route.ts:167-172`). Una estancia larga acerca el doc al límite de 1 MB de Firestore, y el modo de falla sería perder escrituras del MAR.

### H2 · `signos` permite `update` desde el cliente, y el botón de borrar está ROTO

`firestore.rules:240` — `allow read, create, update: if isClinicoHospital(clinicId)`. Un cliente autenticado con rol clínico **puede sobrescribir en el sitio** una lectura de signos vitales: la SpO₂ anterior desaparece sin rastro. Es exactamente "editar un evento sellado", permitido hoy por reglas.

Y al revés: `firestore.rules:241` niega `delete`, pero la ficha ofrece el botón **"Borrar registro mal capturado"** (`hospitalizacion/[internamientoId]/page.tsx:579` → `borrarSignos`, `lib/hospital/firestore.ts:218`). **Ese botón no puede funcionar en producción**: `deleteDoc` desde el cliente choca contra la regla y cae en el `catch` que muestra "No se pudo borrar". Es el hueco de UX que esta unidad debe cerrar con una **corrección**, no con un borrado.

> Dato que baja el riesgo: **ningún** punto del código llama a `updateDoc` sobre `signos` (verificado por grep: sólo `agregarSignos` y `borrarSignos`). Cerrar `update` **no rompe nada existente**.

### H3 · `registros` no tiene regla propia ni se lee nunca

No hay `match /registros/{…}` bajo `internamientos/{intId}`, así que cae en el catch-all `firestore.rules:620` (`if false`). Está **cerrado por omisión, no por declaración**: nadie puede leerlo, ni siquiera para mostrar el historial de correcciones, y ningún test fija que su escritura deba seguir cerrada. Es la definición de invariante frágil.

## 4. Diseño del cambio mínimo

**Principio rector:** el doc de internamiento sigue siendo **caché de display** (ya lo dice `mutar/route.ts:161-166`); el **libro legal append-only** es la subcolección `registros`, y **ahí** es donde las reglas cumplen la aceptación. Así se obtiene el append-only real **sin migrar el MAR fuera del doc**, que es la operación que rompería censo, ficha, NEWS2, conciliación y export FHIR.

### 4.1 Archivos que se tocan

| Archivo | Acción | Por qué |
|---|---|---|
| `firestore.rules` (bloque `internamientos`, líneas 227-243) | MODIFICAR | Declara el append-only. **Aquí vive la aceptación.** |
| `src/types/hospital.ts` | MODIFICAR | Tipos `EventoClinico` / `TipoEventoClinico` / `CorreccionEvento`; `RegistroSignos` gana `corrigeA`/`motivoCorreccion`. |
| `src/lib/hospital/registro-durable.ts` | MODIFICAR | Cubrir el MAR y las órdenes; devolver `EventoClinico` tipado en vez de `Record<string, unknown>`. |
| `src/app/api/hospital/mutar/route.ts` | MODIFICAR | Nueva acción `corregir` + su gate. El `tx.set(...registros...)` de `:263` ya existe: no se toca. |
| `src/lib/hospital/eventos.ts` | **NUEVO** | Núcleo **puro**: `proyectarSignos()` y `proyectarEventos()` (aplican correcciones sin mutar nada). |
| `src/lib/hospital/firestore.ts` | MODIFICAR | `corregirSignos()` sustituye a `borrarSignos()`; `getEventos()` lee `registros`. |
| `src/app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx` | MODIFICAR | UI de corrección (signos + MAR); se retira el botón de borrar roto. |
| `src/__tests__/hospital-registro-durable.test.ts` | MODIFICAR | El caso `:24` (`administrar` → `null`) **deja de ser cierto a propósito**. |
| `src/__tests__/firestore-rules-guard.test.ts` | MODIFICAR | Fija la aceptación en el texto de las reglas. |
| `src/__tests__/hospital-eventos-append-only.test.ts` | **NUEVO** | Tests del núcleo puro + de las reglas. |
| `docs/audit/regression-ledger.md` | MODIFICAR | Alta de **REG-044** (H1), **REG-045** (H2). Último id usado: REG-043. |

### 4.2 Reglas — el cambio literal (entregable *a*)

```
match /internamientos/{intId} {
  allow read: if isClinicoHospital(clinicId);
  allow create, update, delete: if false;

  // Signos vitales seriados: APPEND-ONLY (E0-09).
  // Una lectura registrada es un hecho clínico: no se edita ni se borra.
  // Un error se corrige ANEXANDO otro registro con `corrigeA`.
  match /signos/{signoId} {
    allow read:   if isClinicoHospital(clinicId);
    allow create: if isClinicoHospital(clinicId) && clinicaPuedeEscribir(clinicId);
    allow update, delete: if false;          // ← ACEPTACIÓN E0-09
  }

  // Libro clínico-legal del episodio (MAR, órdenes, enfermería, correcciones).
  // Lo escribe SÓLO el servidor (Admin SDK, /api/hospital/mutar). Se lee para
  // mostrar el historial y las correcciones.
  match /registros/{registroId} {
    allow read: if isClinicoHospital(clinicId);
    allow create, update, delete: if false;  // ← ACEPTACIÓN E0-09
  }
}
```

Tres notas de diseño:

- `update, delete: if false` es **la misma frase** que ya protege `notas/{id}/versions` y `notas/{id}/adendas` (`firestore.rules:190`, `:198`). Consistencia, no invención.
- Se añade `clinicaPuedeEscribir(clinicId)` al `create` de `signos` para alinearlo con el paywall del resto de las capturas (`firestore.rules:175-183`). **Falla-abierto** por construcción de esa función, así que no atrapa a una clínica legítima.
- `registros` pasa de "cerrado por omisión" (catch-all) a "cerrado por declaración", **y se abre la lectura** al mismo público que ya lee el doc padre (`isClinicoHospital`): sensibilidad idéntica, cero ampliación real de superficie.

### 4.3 Contrato de lo nuevo

```ts
// src/types/hospital.ts
export type TipoEventoClinico =
  | 'administracion' | 'indicacion_alta' | 'indicacion_suspension'
  | 'verificacion_farmacia' | 'conciliacion' | 'traslado' | 'egreso'
  | 'balance' | 'escala' | 'sbar'
  | 'correccion'

/** Un hecho ya ocurrido en el episodio. Inmutable por reglas (E0-09). */
export interface EventoClinico {
  tipo: TipoEventoClinico
  fecha: string          // ISO — reloj del SERVIDOR, nunca el del cliente
  por: string            // autor REAL sellado por el servidor
  porUid?: string
  indicacionId?: string  // a qué orden pertenece (MAR)
  detalle?: Record<string, string | number | boolean | null>
  // Sólo cuando tipo === 'correccion':
  corrigeEventoId?: string
  motivo?: string
  /** Qué afirma la corrección sobre el evento original. */
  efecto?: 'anula' | 'sustituye' | 'aclara'
}

// src/lib/hospital/eventos.ts  (PURO: sin Firestore, sin red, sin fechas propias)
export function proyectarSignos(
  raw: RegistroSignos[],
): { vigentes: RegistroSignos[]; corregidos: Map<string, RegistroSignos> }

export function proyectarEventos(
  raw: (EventoClinico & { id: string })[],
): { vigentes: (EventoClinico & { id: string })[]; correcciones: Map<string, EventoClinico[]> }
```

`RegistroSignos` gana dos campos **opcionales** (`corrigeA?: string`, `motivoCorreccion?: string`): los documentos ya guardados siguen siendo válidos sin migración.

Nueva acción del gateway, con su gate:

```ts
corregir: ['medico', 'admin', 'enfermeria'],   // ← ver §6, pregunta Q2
```

`corregir` **no toca** el evento original: sólo hace `tx.set(ref.collection('registros').doc(), { tipo:'correccion', corrigeEventoId, motivo, efecto, fecha: now, por: actor.nombre, porUid: actor.uid })`. La corrección de un signo se anexa igual: **un documento nuevo** en `signos` con `corrigeA`.

### 4.4 UI de corrección (entregable *b*)

1. **Signos** (`page.tsx:579`): el botón papelera "Borrar registro mal capturado" → **"Corregir"**. Abre el mismo modal de captura precargado con los valores del registro erróneo + un campo **motivo obligatorio**. Al guardar se **anexa** un registro nuevo con `corrigeA: <id original>`. La tabla muestra el original **tachado y atenuado** con la etiqueta "corregido", y el nuevo con "corrección de las HH:MM". Nada desaparece.
2. **MAR** (`page.tsx:504-510`, lista de administraciones): cada administración gana "Corregir" → motivo obligatorio + `efecto` (`anula` = no se administró / `aclara` = se corrige un dato). Emite `corregir`. La administración original **sigue visible**, con su corrección debajo.
3. Se **retira** `borrarSignos` de `lib/hospital/firestore.ts:218` y de la ficha: hoy no funciona (§3-H2) y es contrario a la unidad.

### 4.5 Qué NO entra (y por qué)

- **Migrar `indicaciones[].administraciones[]` a subcolección.** Es la solución "bonita", y es exactamente lo que la carta operativa manda no ejecutar a ciegas: toca censo, ficha, NEWS2, conciliación, export FHIR (`fhir-export.ts:302-390`) y el prompt de IA. Con este diseño **el registro legal ya es append-only y verificado por reglas**; el array queda como caché. Si el Dr. quiere la migración, es su propia unidad con su plan de doble escritura y backfill.
- **Persistir `ICUObservation`.** No existe capa de almacenamiento y no la pide esta unidad; es del loop `nexusmed-icu-00X`. Los eventos de UCI que **sí** se persisten hoy (signos, escalas, balance, administraciones, nota `evolucion_uci`) quedan cubiertos.
- **`laboratorio/{ordenId}`.** Sus resultados ya conservan historial por código (`firestore.ts:305`), pero sus reglas permiten `update`/`delete` a `isLabStaff` (`firestore.rules:262`). Es el mismo defecto de fondo; **no es "MAR, órdenes ni UCI"** y cerrarlo rompería la carga de resultados. Se **documenta como REG-046 candidato**, no se toca aquí.

## 5. Tests (entregable *c*)

**Puros (vitest, sin emulador) — `src/__tests__/hospital-eventos-append-only.test.ts`:**

1. `proyectarSignos`: un registro con `corrigeA` marca el original como corregido y **no lo elimina** del arreglo devuelto.
2. Cadena de correcciones (A ← B ← C): sólo C queda vigente; A y B quedan marcados; **sin recursión infinita** ante un ciclo malformado (`corrigeA` que se apunta a sí mismo).
3. Corrección cuyo original quedó **fuera de la ventana** de `getSignos` (tope 200, `firestore.ts:186`): se devuelve como registro autónomo, nunca se descarta.
4. `proyectarEventos`: una `correccion` con `efecto:'anula'` sobre una administración deja la original visible y marcada; el conteo de dosis administradas vigentes baja en 1.
5. Determinismo: la proyección **no muta** la entrada (`toEqual` contra una copia congelada) y es estable ante reordenamientos.
6. `registroDurable('administrar', …)` ahora **devuelve un `EventoClinico`** con `por` sellado por el servidor y `fecha` del servidor, ignorando cualquier `p.por`/`p.fecha` del cliente (mismo contrato ya probado en `hospital-registro-durable.test.ts:11-22`).
7. Cobertura: **toda** acción de `GATES` que representa un hecho clínico produce evento durable (lista blanca explícita en el test → una acción nueva sin evento **rompe el CI**, mismo patrón que E0-03).

**Guardián estático de reglas — `src/__tests__/firestore-rules-guard.test.ts` (AMPLIAR):**

8. `ACEPTACIÓN E0-09`: el bloque `signos/{signoId}` contiene `allow update, delete: if false;` y **no** contiene `update` en la línea de `allow read, create`.
9. El bloque `registros/{registroId}` existe, es legible por `isClinicoHospital` y tiene `allow create, update, delete: if false;`.

> **Límite honesto y declarado.** El test 8-9 prueba el **texto** de la regla, no su ejecución. La prueba **conductual** ("un `updateDoc` real recibe `permission-denied`") exige el emulador de Firestore, que es **E0-08** (`Firebase Emulator + matriz multi-tenant`) y no existe todavía en el repo (`firebase.json` sólo declara `rules`; no hay `@firebase/rules-unit-testing` en `package.json`). **Acción concreta:** E0-09 deja escritos los dos casos en la matriz de E0-08 —`signos.update → DENY`, `registros.create → DENY`— para que al aterrizar el emulador la aceptación quede probada de verdad. Montar el emulador dentro de E0-09 sería duplicar E0-08 y meter Java en el CI por la puerta de atrás.

## 6. Lo que NO puedo decidir yo (NEEDS_CLINICAL_REVIEW)

El **entregable (a) — reglas append-only — no depende de ninguna de estas respuestas** y puede implementarse tal cual. Los entregables (b) UI y su proyección **sí**: son política de expediente y de seguridad clínica, no umbrales que yo pueda deducir del código.

- **Q1 — ¿Un signo vital corregido/anulado debe seguir alimentando NEWS2 y el export FHIR?**
  Hoy NEWS2 usa `signos[signos.length - 1]` sin filtrar (`page.tsx:190-193`) y FHIR exporta el arreglo completo (`fhir-export.ts:382`). Las dos salidas son peligrosas en direcciones opuestas: si una SpO₂ mal capturada de 80 % permanece, se dispara una alerta falsa y la alerta ya se crea en el momento de capturar (`page.tsx:1085`); si se oculta un valor que en realidad era correcto, se **esconde** un deterioro real. Necesito la política, no una corazonada.
- **Q2 — ¿Quién puede corregir, y con qué alcance?** ¿Sólo el autor del registro; cualquier enfermería del turno; sólo el médico tratante? ¿Enfermería puede anular una **administración** de medicamento, o eso queda reservado al médico? (Hoy `administrar` lo puede hacer `enfermeria` — `mutar/route.ts:33`.) Afecta directo al `GATES` de `corregir` propuesto en §4.3.
- **Q3 — ¿Hay ventana de tiempo para corregir?** ¿Se puede corregir un evento de hace 5 días, o de un episodio **ya egresado**? (`administrar` exige episodio activo — `mutar/route.ts:104`; para `corregir` no hay precedente en el repo.)
- **Q4 — ¿La corrección exige motivo escrito obligatorio?** Lo propongo obligatorio por NOM-004, pero es decisión del dueño del expediente: encarece cada corrección y, si estorba, la gente deja de corregir y el registro se degrada.

No inventé respuesta para ninguna. Mientras no estén, se implementa §4.2 (reglas + tests 8-9) y se deja la UI de corrección detrás de la decisión.

## 7. Riesgo de regresión REAL sobre producción

| Cambio | Riesgo | Evidencia / mitigación |
|---|---|---|
| `signos.update → false` | **Muy bajo** | Ningún código llama a `updateDoc` sobre `signos` (grep: sólo `agregarSignos`/`borrarSignos`). Se cierra una puerta que nadie usa. |
| `signos.create` + `clinicaPuedeEscribir` | **Bajo** | Misma condición que ya rige `notas` (`rules:175`). Falla-abierto ante campos ausentes. Una clínica **vencida** dejaría de registrar signos: es el comportamiento deliberado del paywall, pero **conviene el visto bueno del Dr.** antes de aplicarlo a un dato de seguridad del paciente. Si prefiere, se omite esta línea sin afectar la aceptación. |
| Retirar el botón "Borrar" de signos | **Ninguno** | Ese camino ya está roto en producción (§3-H2): choca contra `rules:241`. |
| `registros` legible | **Bajo** | Misma audiencia que ya lee el doc padre. Escritura sigue en `false`. |
| Ampliar `registroDurable` a MAR/órdenes | **Bajo** | Es una **escritura adicional** dentro de la transacción que ya existe (`mutar/route.ts:263`); no cambia el patch del doc ni ninguna lectura. Coste: +1 escritura por acción del MAR. |
| Proyección de correcciones en la ficha | **Medio** ← el punto caliente | Toca la tabla de signos, NEWS2 y el export FHIR. **Depende de Q1.** Mitigación: la proyección es una función **pura y testeada aparte**, y por defecto **no filtra nada** (sólo marca) hasta que el Dr. responda Q1. |
| Test `hospital-registro-durable.test.ts:24` | **Ninguno** en producción | El caso "`administrar` → `null`" deja de ser cierto **a propósito**; se reescribe y se anota en el ledger para que no parezca un test aflojado. |

**Modo de fallo peor imaginable de este diseño:** que el equipo confíe en que "el MAR es append-only por reglas" cuando lo append-only por reglas es el **libro `registros`**, no el array del doc. Por eso el comentario de `firestore.rules` y el encabezado de `registro-durable.ts` deben decirlo con todas sus letras, y por eso H1 queda inscrito en el ledger como **REG-044 (abierto)** hasta que exista la migración.
