# ICU-001 · Auditoría y arquitectura — Critical Care OS

```yaml
iteration: ICU-001
mode: AUDIT_AND_ARCHITECTURE
productionWrites: false
destructiveChanges: false
fecha: 2026-07-29
```

Auditoría de **solo lectura**. No se tocó código de producción, no se desplegó, no se
migró nada. Todo lo que sigue son hechos medidos sobre el árbol, o diseño propuesto
marcado como tal.

---

## 0. Resumen para decidir en un minuto

**El charter asume que hay que construir el motor clínico de UCI. Ya existe, y es
grande:** 19 módulos deterministas (3 489 líneas) con **230 casos de prueba**,
incluidos ventilación, gasometría, hemodinamia, POCUS/VExUS, CKRT, ECMO, SOFA,
RASS/GCS y un motor de infusiones **con cálculo bidireccional** (§18) ya migrado a
`ClinicalQuantity`.

**Lo que falta no es el cerebro. Es el expediente.**

> ### 🔴 Hallazgo P0 — el dato clínico de UCI no se guarda
>
> Las lecturas seriadas del panel viven **solo en `localStorage`**, con tope de **24**,
> en la clave `nx.uci.lecturas.<internamientoId>`
> (`src/app/(dashboard)/uci/page.tsx:261,277-281`).
>
> **Consecuencias medidas:**
> - No hay expediente longitudinal: el objetivo central del charter está bloqueado.
> - Otro médico, otra guardia u otro dispositivo **no ven nada**.
> - El cierre de sesión **purga** esas lecturas (correcto para PHI, pero el dato se
>   pierde para siempre: no hay copia servidor).
> - Las «tendencias» y el Morning Brief se calculan sobre ≤24 puntos locales.
> - Nada de eso es auditable ni NOM-024.
>
> **Todo lo demás del charter —timeline, correlación temporal, morning brief,
> handoff, metas diarias, copiloto contextual— depende de arreglar esto primero.**

**Segundo hallazgo estructural:** la cama es un **string** dentro del episodio
(`Internamiento.cama: string`, `src/types/hospital.ts:45`) y la unión cama↔paciente
se hace comparando texto (`camas/page.tsx:49`: `mismaCama(i.cama, cama.etiqueta)`).
No existe `BedAssignment`, ni historia de camas, ni `ICUStay`. Los traslados quedan
como texto libre en `movimientos[].detalle`.

---

## 1. Arquitectura ACTUAL (medida, no supuesta)

### 1.1 Lo que existe y sirve

| Pieza | Dónde | Tamaño | Veredicto |
|---|---|---|---|
| Motores clínicos UCI | `src/lib/uci/*.ts` (19 archivos) | 3 489 líneas | **Reutilizar íntegro** |
| Pruebas UCI | `src/__tests__/uci-*.test.ts` (31 archivos) | **230 casos** | **Reutilizar** |
| Tipos UCI | `src/types/uci.ts` | 111 líneas | **Base del modelo** |
| Nota de evolución UCI | `expediente.ts:21` `'evolucion_uci'` | — | **Reutilizar** |
| Panel UCI | `src/app/(dashboard)/uci/page.tsx` | 871 líneas | **Refactorizar** |
| Copiloto | `src/app/api/uci/copilot/route.ts` | — | Reutilizar |
| Episodio hospitalario | `Internamiento` | — | **Es ya el encounter** |
| Camas | `Cama` + `/hospitalizacion/camas` | — | Ampliar |
| Signos seriados | subcolección `signos` + `proyectarSignos` | — | **Patrón a copiar** |
| Farmacia | `src/lib/farmacia.ts` | — | Reutilizar, no duplicar |

**`src/types/uci.ts` ya tiene lo que el charter pide en §50 (provenance):**
`ICUObservation` con `ICUSource`, `TranscriptRange`, `ClinicalTruthStatus` y
`CertezaNER`. El modelo de procedencia por voz **está diseñado**; lo que no está es
la persistencia.

### 1.2 Cotejo del charter contra la realidad

| § | Pide | Estado real |
|---|---|---|
| 9 | PEEP ≠ PIP, nunca adivinar | ✅ **Ya separado.** `'pip'` → `ppico`, con comentario explícito (`extraccion.ts:119-123`) |
| 13-17 | Motor de infusiones con concentración y peso | ✅ `Dilucion`, `dosisARate`, `ClinicalQuantity` |
| 18 | Calculadora bidireccional | ✅ `rateADosis` existe |
| 23 | Extracción de ventilador por voz | ✅ `ventilacion.ts` + `extraccion.ts` |
| 25-27 | Gasometría · CKRT · ECMO por voz | ✅ los tres motores existen |
| 29 | Copiloto que recibe los motores, no razona crudo | ✅ `copilot.ts` importa los 8 motores |
| 31 | Missing data engine | ⚠️ parcial: hay rangos de plausibilidad, no «falta PBW» |
| 8 | Diccionario por CONTEXTO | ❌ **no existe**: el diccionario es único |
| 33-34 | Timeline y correlación temporal | ⚠️ `correlacion.ts` existe, **sin datos que correlacionar** |
| 30 | Morning Brief | ⚠️ sobre ≤24 lecturas locales |
| 2 | `Hospital/Unit/Room/Bed/BedAssignment` | ❌ solo `Cama` plana |
| 1 | `HospitalEncounter → ICUStay` | ❌ `Internamiento` sin capa UCI |
| 22 | MAR integrado con farmacia | ⚠️ `Indicacion`/`Administracion` existen, sin vista UCI |
| 50 | Provenance de voz | ⚠️ **tipado, no persistido** |

### 1.3 Duplicaciones encontradas

1. **`lecturas` (localStorage) vs subcolección `signos` (Firestore).** Dos almacenes
   de fisiología seriada para el mismo paciente, sin relación. `signos` sí es
   append-only, con `corrigeA` y `proyectarSignos` (REG-060/E0-09).
2. **Estado de cama vs estado clínico.** `EstadoCama` sólo tiene 4 valores y el
   charter §2 pide 7; hoy la ocupación **se deduce** comparando strings.
3. **Modo calculadora vs modo paciente.** La misma pantalla hace las dos cosas con
   `internamientoId` opcional (`uci/page.tsx:104`). No es duplicación de datos, pero
   sí de responsabilidad: un motor de cálculo y un expediente en el mismo archivo de
   871 líneas.

---

## 2. Arquitectura PROPUESTA

### 2.1 La decisión de fondo: NO crear `HospitalEncounter`

El charter pide `PATIENT → HOSPITAL ENCOUNTER → ICU STAY → BED ASSIGNMENT`.

**`Internamiento` ya ES el HospitalEncounter**: tiene paciente, servicio, médico
tratante, diagnóstico de ingreso, estado, fechas de ingreso y egreso, tipo de egreso,
movimientos, interconsultas e indicaciones. Renombrarlo o duplicarlo rompería
`firestore.rules`, la subcolección `signos`, el censo, el MAR, los laboratorios y las
notas de hospitalización — sin ganar nada clínico.

**Propuesta:** las capas que faltan se **añaden encima**, y `Internamiento` se queda
como es.

```
Patient
   ↓
Internamiento            ← YA EXISTE (= HospitalEncounter). NO se toca.
   ↓
ICUStay                  ← NUEVO. Subcolección del internamiento.
   ↓
BedAssignment            ← NUEVO. Append-only, con historia.
   ↓
ICUObservation[]         ← NUEVO. La pieza que arregla el P0.
```

Esto cumple los cinco flujos del §1 (A–E) sin migración destructiva, porque
`ICUStay` es un documento nuevo: un paciente puede entrar y salir de UCI varias
veces dentro del **mismo** internamiento, y cada estancia se conserva.

### 2.2 Modelos nuevos (diseño, no implementados)

```ts
// clinics/{c}/internamientos/{iid}/icu_stays/{stayId}
export interface ICUStay {
  id: string
  internamientoId: string          // ancla al episodio existente
  pacienteId: string               // desnormalizado para reglas y consultas
  estado: 'activa' | 'egresada'
  fechaIngresoUci: string
  fechaEgresoUci?: string
  motivoIngresoUci: string
  /** Soportes ACTIVOS (§32). La UI se adapta a esto: sin ECMO, no hay panel ECMO. */
  soportes: SoporteActivo[]
  /** Peso para dosificación — NO se cambia solo (§16). */
  pesoDosificacion?: { valorKg: number; tipo: 'actual' | 'ingreso' | 'seco' | 'configurado'; fijadoPor: string; fijadoEn: string }
  pbwCm?: number                   // talla, para VT/PBW (§31)
  codigoReanimacion?: string
  aislamiento?: string
  createdAt: string; creadoPor: string
}

export type SoporteActivo =
  | 'vm_invasiva' | 'vm_ni' | 'hfnc'
  | 'vasopresor' | 'inotropico'
  | 'ckrt' | 'ecmo' | 'iabp' | 'impella' | 'monitor_pic'

// clinics/{c}/internamientos/{iid}/bed_assignments/{id}   ← APPEND-ONLY
export interface BedAssignment {
  id: string
  icuStayId?: string               // ausente si la cama es de piso
  camaId: string                   // referencia REAL, no string libre
  desde: string
  hasta?: string                   // abierto = vigente
  motivo?: 'ingreso' | 'traslado' | 'egreso' | 'reserva'
  por: string
}
```

**`ICUObservation` ya está definida** en `src/types/uci.ts:62`. Lo que se propone es
**persistirla**, en una subcolección append-only que copie el patrón ya probado de
`signos`:

```
clinics/{c}/internamientos/{iid}/icu_observations/{obsId}
```

Con `corrigeA` para correcciones (el mismo modelo de REG-060), y la política de
qué entra a un cálculo clínico **heredando la decisión pendiente E0-09/Q1**.

### 2.3 Estados de cama (§2)

`EstadoCama` pasa de 4 a los 7 del charter:
`available · reserved · occupied · cleaning · blocked · maintenance · isolation`.

**Regla del charter que hay que respetar en código:** el estado de la cama es
**localización**, nunca estado clínico. Con `BedAssignment` la ocupación se deriva de
la asignación vigente, no de comparar strings.

---

## 3. Archivos afectados por el primer vertical

El vertical elegido, tal como pide el charter:
**PACIENTE → INGRESO UCI → CAMA → EXPEDIENTE UCI**

| Archivo | Cambio | Riesgo |
|---|---|---|
| `src/types/hospital.ts` | +`ICUStay`, +`BedAssignment`, ampliar `EstadoCama`, `Cama.unidad` | Bajo (aditivo) |
| `src/types/uci.ts` | `ICUObservation` gana `id`/`corrigeA` | Bajo |
| `src/lib/hospital/icu-stay.ts` | **nuevo** — CRUD de estancia | Bajo |
| `src/lib/hospital/bed-assignment.ts` | **nuevo** — asignación append-only + proyección | Medio |
| `src/lib/uci/observaciones.ts` | **nuevo** — persistencia (el arreglo del P0) | **Alto** |
| `firestore.rules` | 3 subcolecciones nuevas | **Alto** |
| `src/app/(dashboard)/uci/page.tsx` | separar calculadora ↔ workspace | Medio |
| `src/app/(dashboard)/hospitalizacion/camas/page.tsx` | leer asignación, no string | Medio |

**Ampliar `EstadoCama` de 4 a 7 valores** obliga a revisar cada `switch`/mapa que lo
consuma; `ESTADO_CAMA_LABEL` es `Record<EstadoCama, string>`, así que **tsc obliga**
a completarlo. Eso es una ventaja: el compilador encuentra los sitios.

---

## 4. Migración propuesta

**Ninguna migración destructiva. Nada se reescribe.**

| Paso | Qué | Reversible |
|---|---|---|
| M1 | Crear las 3 subcolecciones vacías + reglas | Sí (borrar reglas) |
| M2 | `Internamiento.cama` (string) → sembrar un `BedAssignment` abierto por cada internamiento activo | Sí: el string **se conserva** |
| M3 | Estancia UCI implícita → crear `ICUStay` para los internamientos con `servicio` de UCI | Sí (borrar docs) |
| M4 | `lecturas` de localStorage → **no se migran** | N/A |

**M2 es la clave de la compatibilidad:** `Internamiento.cama` **no se borra**. Durante
la transición ambos coexisten y el lector prefiere la asignación si existe, con
respaldo al string. Es el mismo patrón que funcionó en REG-014 con la firma médica.

**Sobre M4, y hay que decirlo claro:** las lecturas que hoy están en el navegador
del Dr. **no se pueden migrar de forma fiable** — son locales, tope 24, se purgan al
cerrar sesión y no hay copia servidor. Lo honesto es declarar que ese histórico
**no existe como dato clínico** y empezar el expediente longitudinal desde el
momento en que se implemente la persistencia. Proponer una migración daría una falsa
sensación de continuidad.

---

## 5. Riesgos

| # | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| R1 | Ampliar `EstadoCama` rompe pantallas | Media | `Record` obliga a tsc; barrer todos los consumidores |
| R2 | Doble fuente de camas (string vs asignación) | **Alta** | Lector con precedencia + test que congela la regla |
| R3 | Persistir observaciones multiplica lecturas de Firestore | Media | Cota como en `getSignos` (TOPE 200); nunca subcolección completa |
| R4 | Reglas nuevas mal escritas = fuga cross-tenant | **Alta** | E0-08 dejó la suite del emulador: **exigirla en el PR** |
| R5 | Refactorizar 871 líneas rompe el panel que ya funciona | **Alta** | Extraer sin cambiar comportamiento; los 230 casos son la red |
| R6 | Q1 de E0-09 sigue abierta (¿un valor corregido alimenta el cálculo?) | **Alta** | `ICUObservation` hereda la MISMA política; no inventar una |
| R7 | El charter pide 5 000 utterances (§41) | Media | Necesita **validación del Dr.**: no se pueden inventar |

---

## 6. Compatibilidad

- **Nada de lo existente deja de funcionar.** Los tres cambios son aditivos.
- El **modo calculadora sin paciente** se conserva: hoy es un valor real del panel
  (`uci/page.tsx:388`) y sacarlo sería una pérdida de función.
- `firestore.rules` es **aditivo**: una regla nueva no puede revocar el acceso que
  otra concede (lección de REG-014). Las subcolecciones nuevas necesitan su propio
  `match`, y hay que verificar que ninguna regla amplia ya las cubra.
- Los **230 casos de UCI** deben seguir en verde sin tocarlos. Si un refactor exige
  cambiar un test de UCI, es señal de que cambió comportamiento: **parar y reportar**.

---

## 7. Tests que exige este vertical

| Nivel | Qué congela |
|---|---|
| Unidad | `BedAssignment`: sin solapes; una sola vigente por cama |
| Unidad | `ICUStay`: dos estancias en un internamiento **no** se sobreescriben (§1) |
| Unidad | Proyección de observaciones: nada se descarta, correcciones marcan sin borrar |
| Integración | Los 5 flujos del §1 (A–E), incluido «UCI → piso → UCI» |
| Integración | Precedencia asignación > string, con respaldo (R2) |
| Reglas | Suite del emulador de E0-08 sobre las 3 subcolecciones (R4) |
| Regresión | Los 230 casos UCI existentes, intactos |
| Guardián | Ningún consumidor llama al cálculo clínico sin política (hereda E0-09/Q1) |
| Adversarial | §43: «PEEP 8, PIP 28» captura AMBOS. Ya hay base en `extraccion.ts` |
| Adversarial | §44: `0.03 / 0.3 / 3 / 30 / 300` con mcg·mg·mL·U |

---

## 8. Rollback

| Si falla | Cómo se revierte | Se pierde |
|---|---|---|
| Reglas nuevas | `firebase deploy --only firestore:rules` al commit anterior | Nada |
| Modelos nuevos | Son documentos nuevos: dejar de leerlos | Nada del core |
| Asignación de camas | El lector cae al `Internamiento.cama` que **nunca se borró** | Nada |
| Refactor del panel | `git revert` del commit del vertical | Nada |
| Persistencia de observaciones | Dejar de escribir; los docs quedan huérfanos e inertes | Las observaciones nuevas |

**Ningún paso de este vertical destruye un dato existente.** Es la condición para
poder revertir con una sola orden.

---

## 9. Backlog

### P0 — bloquean el objetivo del charter

| ID | Qué | Por qué es P0 |
|---|---|---|
| **ICU-P0-1** | Persistir `ICUObservation` en Firestore, append-only | Sin esto NO hay expediente longitudinal. Es *el* hallazgo. |
| **ICU-P0-2** | `BedAssignment` con historia; la cama deja de ser un string | §1: «la cama NO identifica al paciente» |
| **ICU-P0-3** | `ICUStay` con soportes activos | §32: la UI se adapta; hoy no hay dónde guardarlo |
| **ICU-P0-4** | Reglas de las 3 subcolecciones + suite del emulador | R4: fuga cross-tenant de PHI de UCI |

### P1 — valor clínico alto, no bloqueante

| ID | Qué |
|---|---|
| ICU-P1-1 | Diccionario **por contexto** (§8): hoy es único |
| ICU-P1-2 | Desambiguación con candidatos y confianza (§9); PEEP/PIP ya separados, falta el diálogo |
| ICU-P1-3 | `Infusion` como REGISTRO persistido (hoy el motor calcula, no guarda): §13 con `verified`, `pumpChannel`, `source` |
| ICU-P1-4 | Timeline única (§33) — habilitada por ICU-P0-1 |
| ICU-P1-5 | Reconciliación dictado vs calculado (§24): «driving pressure 20 vs 14 calculado». **Alto valor, no existe** |
| ICU-P1-6 | Missing data engine (§31): «falta talla/PBW» |
| ICU-P1-7 | Vista MAR de UCI sobre la farmacia existente (§37), sin duplicar inventario |

### P2 — después del core

| ID | Qué |
|---|---|
| ICU-P2-1 | Estados de cama 4 → 7 (§2) |
| ICU-P2-2 | Morning Brief sobre datos persistidos (§30) |
| ICU-P2-3 | Handoff (§36) |
| ICU-P2-4 | Metas diarias (§35) |
| ICU-P2-5 | Vista de enfermería (§40) — el charter dice: después del core médico |
| ICU-P2-6 | Landing de UCI con tarjetas (§3) |

### Necesita decisión del Dr. — NO se puede inventar

| ID | Pregunta |
|---|---|
| **ICU-Q1** | Las 5 000 utterances (§41): ¿se graban en su unidad, se escriben a mano, o se acota el benchmark? **No se pueden fabricar.** |
| **ICU-Q2** | Preparaciones de infusión «por hospital» (§14): ¿cuáles son las de su unidad? Sin ellas el catálogo actual es el único, y el §21 prohíbe que una convención local se presente como verdad médica. |
| **ICU-Q3** | ¿Qué observación de UCI entra a un cálculo clínico si fue corregida? **Es la misma E0-09/Q1 que sigue abierta**, ahora aplicada a UCI. |
| **ICU-Q4** | Umbral de confianza para pedir confirmación (§12) sin caer en fatiga de alertas. |

---

## 10. Siguiente iteración

```yaml
iteration:
  id: ICU-002
  mode: IMPLEMENT
  scope: ICU-P0-2 + ICU-P0-3 + ICU-P0-4
  productionWrites: false
  destructiveChanges: false
  entrega: ICUStay + BedAssignment + reglas + suite del emulador
  NO_incluye: persistencia de observaciones (ICU-P0-1 va en ICU-003, sola)
```

**Por qué ICU-P0-1 va sola y después:** es el cambio de mayor riesgo (escribe PHI
nueva, en volumen, con cota de lecturas y política de corrección heredada de una
pregunta abierta). Meterlo en el mismo lote que el modelo de camas haría imposible
revertir uno sin el otro.

**Antes de ICU-002 hace falta una respuesta:** **ICU-Q3** (= E0-09/Q1). `ICUStay`
puede construirse sin ella, pero `ICUObservation` no, y prefiero no construir el
modelo de camas contra una decisión que puede cambiar la forma del vecino.

---

## STOP

ICU-001 termina aquí, como pide el charter. No se implementó nada, no se escribió a
producción, no se migró. El siguiente paso requiere que el Dr. diga **ejecuta
ICU-002**.
