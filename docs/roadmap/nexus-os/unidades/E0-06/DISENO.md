# E0-06 — Separación de PHI administrativo vs clínico · DISEÑO

> **Estado:** diseño. **NO implementado**: no se escribió una sola línea de código de producción ni se tocó `firestore.rules`.
> **Etapa:** E0 (Hardening). **Riesgo declarado en backlog:** alto. **Riesgo real del cambio tal como está diseñado:** alto (§8) — por eso va en tres fases y la Fase B/C **no debe fusionarse** antes de que el dueño responda D1 y D2 (§9).
> **Depende:** nada. **Habilita:** E0-07 (capabilities — consume la matriz de esta unidad) y E0-08 (emulator — consume la matriz como tabla de casos).

---

## 0. Resumen ejecutivo

La aceptación es una frase falsable: **«Rol recepción: lee cita, no lee nota ni alergias»**. Al probarla contra el repo real, la mitad ya se cumple y la otra mitad no, por dos razones distintas — y apareció un tercer agujero que ninguna de las dos describe.

**Hallazgo 1 — «no lee nota» YA se cumple por el SDK; «no lee alergias» NO, y no es un descuido de las reglas: es imposible arreglarlo en las reglas.**
`firestore.rules:176` ya cierra `patients/{id}/notas` con `isMedico`, igual que `laboratorios` (`:214`) y `fotos` (`:224`). Pero **las alergias no viven en una subcolección: son campos del propio documento del paciente** (`src/types/index.ts:184-186`), y ese documento es `allow read: if isMember` (`firestore.rules:164`). Firestore **no tiene autorización a nivel de campo en lectura**: o se lee el documento entero o no se lee. Mientras `alergias` sea un campo de `patients/{id}`, ninguna regla puede cumplir la aceptación. **El cambio obligado es de modelo de datos, no de reglas.**

**Hallazgo 2 — recepción no solo *puede* leer las alergias: hoy las lee y las escribe por la UI soportada.**
`/pacientes` está declarada `modos: 'ambos'` en la navegación (`src/components/Sidebar.tsx:30`), y su formulario tiene el input **Alergias** (`src/app/(dashboard)/pacientes/page.tsx:539`) y el textarea **Notas** (`:543`). No es un hueco teórico alcanzable desde la consola: es el flujo de alta que el consultorio usa. Por eso el split **cambia el trabajo diario de la asistente** y necesita la decisión D1 (§9) antes de tocar nada.

**Hallazgo 3 — el agujero real está en la API, y es el mismo que ya se cerró una vez en otra ruta y quedó abierto en esta.**
`/api/portal/link` exige solo `verificarMiembro` (`src/app/api/portal/link/route.ts:20`) y devuelve al navegador de quien la llama un **magic-link con token HMAC de 30 días** (`src/lib/patient-token.ts:15,42`). Ese token es aceptado por `/api/portal` acción `documentos`, que devuelve **diagnósticos y medicamentos de las notas FIRMADAS** (`src/app/api/portal/route.ts:245-263`). Es decir: una recepcionista pide el enlace «para mandárselo al paciente por WhatsApp» y con él lee secreto médico, saltándose el gate `isMedico` de las reglas. **Este es exactamente el vector que ya se documentó y se cerró en `/api/telesalud/token`** (ver el comentario de seguridad en `src/app/api/telesalud/token/route.ts:8-13`, que subió esa ruta a `verificarMedico`) — y que en `portal/link` se quedó sin cerrar. El objetivo literal de E0-06 dice «ni por SDK **ni por API**»: esto entra.

**Hallazgo 4 — el rol «recepción» no existe en la base de datos.**
`clinic_members.role` solo admite `admin | medico | secretaria | enfermeria | farmacia | laboratorio` (`src/types/index.ts:52`), y la invitación solo ofrece esos (`src/lib/invitations.ts:19`, UI en `configuracion/page.tsx:1649`). `'recepcion'` y `'facturacion'` solo existen en `src/lib/permissions.ts:9`, un módulo **sin ningún llamador de producción** (`permisosPorRol` solo se importa desde tests). Conclusión operativa: **en producción, «recepción» = `secretaria`**. Toda aserción de la aceptación debe evaluarse para `secretaria` (rol real) **y** para `recepcion` (rol declarado pero no asignable), o el test pasaría en verde probando un rol que nadie tiene.

**Hallazgo 5 — el peligro del arreglo es peor que el del agujero, si se hace ingenuamente.**
Si las alergias pasan a una subcolección y la lectura falla (red, permisos, migración a medias), `patient.alergias` queda `undefined`. Y el repo, en tres sitios, convierte `undefined` en una **negación afirmativa**: `consulta/[patientId]/page.tsx:754` manda a la IA `Alergias: no referidas`; `consultor/page.tsx:61` hace lo mismo; `receta-word.ts:114-125` ya documenta un incidente idéntico ya reparado («imprimía la negación de alergias para un paciente alérgico»). El repo ya tiene el patrón correcto para esto —`pacienteError` en `consulta/[patientId]/page.tsx:505-514`, que **bloquea el guardado** cuando la lectura del paciente falló, precisamente porque si no «BORRABA el nombre y las alergias … y apagaba el cross-check alergia↔fármaco»— y el diseño lo reusa: **la ausencia de dato clínico debe ser un estado explícito (`no_disponible`), nunca la cadena vacía.**

**Cambio propuesto:** 1 bloque nuevo en `firestore.rules`, 3 archivos nuevos de librería, 1 script de migración, 4 archivos de test, y modificaciones acotadas en el embudo de lectura (`src/lib/firestore.ts`) + 11 pantallas que ya consumen datos clínicos. **Cero cambios en el motor de dosis, en la firma, en la impresión y en cobros.**

---

## 1. Qué pide la unidad (backlog literal)

| Campo | Valor |
|---|---|
| Objetivo | Que un rol de recepción no pueda leer contenido clínico **ni por SDK ni por API** |
| Entregables | reglas Firestore por subcolección · matriz de acceso documentada · tests de reglas |
| Aceptación | **Rol recepción: lee cita, no lee nota ni alergias** |
| Depende | — |
| Riesgo | alto |
| `validacionClinica` | **false** |

---

## 2. Qué existe YA en el repo (no rehacer)

| Pieza existente | Dónde | Qué aporta / qué le falta |
|---|---|---|
| Guardas de rol en reglas | `firestore.rules:27` `isMedico`, `:36` `isClinicoHospital`, `:45` `isLabStaff`, `:18` `isAdmin`, `:14` `isMember` | **Ya son la separación**, y están bien pensadas (`isMedico` excluye explícitamente a la secretaria, con el porqué escrito en `:24-26`). E0-06 **no las rediseña**: las declara en una matriz y añade un bloque que faltaba. |
| Subcolecciones clínicas ya cerradas | `firestore.rules:176` (`notas`), `:194` (`versions`), `:202` (`adendas`), `:214` (`laboratorios`), `:224` (`fotos`) | La mitad «no lee **nota**» de la aceptación **ya se cumple hoy**. El patrón a copiar para el bloque nuevo. |
| Aislamiento del episodio hospitalario | `firestore.rules:234-249` | `internamientos` es `isClinicoHospital`: recepción ya queda fuera. Sin cambios. |
| Precedente exacto del hueco de API | `src/app/api/telesalud/token/route.ts:8-13,28` | Ya subió de `verificarMiembro` a `verificarMedico` **por este mismo razonamiento** («un rol no-médico podía obtener secreto médico saltándose el gate `isMedico`»). E0-06 aplica la misma corrección a `portal/link`. |
| Frontera de API | `src/lib/auth-server.ts:72` `verificarMiembro`, `:124` `verificarMedico` | Ya existe el helper de rol médico. **No se inventa nada nuevo**: E0-07 lo generalizará a capabilities; E0-06 solo lo usa donde falta. |
| Guardián estático de reglas | `src/__tests__/firestore-rules-guard.test.ts` | Ya prueba reglas **sin emulador** (lee `firestore.rules` y afirma invariantes con regex). Es el vehículo para «tests de reglas» en esta unidad; el emulador real es **E0-08**, que depende de esta. |
| Normalización de alergias (pura) | `src/lib/seguridad/alergias.ts:28` `alergiasDe`, `:62` `alergiasParaImpreso` | **Único punto donde converge la lectura de alergias** para pantalla e impreso, y ya documenta la regla «nunca afirmar *Negadas* a partir de un campo que no se llenó». El diseño engancha aquí el estado `no_disponible`. |
| Fail-closed ante lectura fallida del paciente | `src/app/(dashboard)/consulta/[patientId]/page.tsx:505-514` (`pacienteError`) | **Patrón ya pagado con un P0.** El estado clínico ausente se enchufa a este mismo flag, no se inventa otro. |
| Embudo de lectura de pacientes | `src/lib/firestore.ts:117` `getPatients`, `:129` `getPatient`, `:146` `updatePatient` | Casi todo el tráfico pasa por 3 funciones. Es lo que hace viable el split sin tocar los ~83 usos de `alergias` (§5.3). |
| Escrituras de paciente fuera del embudo | `src/components/pacientes/ValoracionInmuno.tsx:91,103,168` (`txValoracion*`), `src/lib/agenda/contadores-paciente.ts:71` (contadores, administrativo) | Las únicas 4 escrituras directas. Solo las 3 primeras son clínicas y hay que redirigirlas. |
| Permisos de aplicación (UX) | `src/lib/permissions.ts` | Declara `verExpediente:false` para `secretaria/recepcion/facturacion`, pero **no tiene llamadores de producción**: hoy no gatea nada. E0-06 **no lo cablea** (sería UX, no autorización, y E0-07 lo sustituye); sí lo cruza contra la matriz en un test para que no diverjan. |
| Clamp de modo por rol real | `src/context/ModeContext.tsx:22,34` | `esMedicoReal` viene de Firestore y fuerza modo secretaria. Es buena defensa en profundidad, **no** autorización: la URL directa sigue siendo alcanzable. |

**Conclusión de la exploración:** no hay que construir un sistema de permisos. Hay que (a) mover cuatro campos de sitio, (b) declarar en un solo lugar la matriz que las reglas ya implementan de forma dispersa, y (c) cerrar un bypass de API concreto.

---

## 3. La parte falsable: qué lee hoy `secretaria` (medido contra el repo)

| Recurso | Regla actual | ¿Contenido clínico? | ¿Recepción lo lee hoy? | Veredicto |
|---|---|---|---|---|
| `appointments/{id}` | `isMember` (`:135`) | `motivo` = motivo de consulta | **Sí — y debe seguir** | ✅ lo exige la aceptación («lee cita») |
| `patients/{id}` → `nombre, telefono, email, curp, fechaNacimiento, sexo, seguroMedico` | `isMember` (`:164`) | No (administrativo) | Sí | ✅ correcto |
| `patients/{id}` → **`alergias`, `alergiasEstructuradas`** | `isMember` (`:164`) | **Sí (dato sensible LFPDPPP)** | **Sí** | ❌ **incumple la aceptación** |
| `patients/{id}` → **`notas`** (texto libre) | `isMember` (`:164`) | **Sí en la práctica** | **Sí** | ❌ incumple |
| `patients/{id}` → **`txValoracion*`** (valoración del inmunocomprometido) | `isMember` (`:164`) | **Sí, inequívocamente** | **Sí** | ❌ incumple |
| `patients/{id}` → `tags` (`embarazo`, `cronico`, `alto-riesgo`) | `isMember` (`:164`) | **Mixto** (`pendiente-pago` es administrativo; `embarazo` es dato de salud) | Sí | ⚠️ **decisión D1** |
| `patients/{id}/notas/**` | `isMedico` (`:176`) | Sí | No | ✅ ya cumple |
| `patients/{id}/laboratorios`, `/fotos` | `isMedico` (`:214`,`:224`) | Sí | No | ✅ ya cumple |
| `internamientos/**`, `laboratorio/**`, `hospital_alertas` | `isClinicoHospital` | Sí | No | ✅ ya cumple |
| `audit_log` | `isMedico` (`:360`) | Metadatos | No | ✅ ya cumple |
| **API `/api/portal/link` → token → `/api/portal` `documentos`** | `verificarMiembro` | **Dx + medicamentos de notas firmadas** | **Sí** | ❌ **bypass de API** |
| API `/api/fhir/paciente/[id]` | `verificarMedico` (`:35`) | Sí | No | ✅ ya cumple |
| API `/api/telesalud/token` | `verificarMedico` (`:28`) | Sí (emite token) | No | ✅ ya cumple |
| API `/api/expediente/*` | `verificarModuloIA` (sin rol) | Procesa texto **que envía el cliente**; no lee PHI de la base | n/a | ⚠️ no es fuga de lectura; queda para **E0-07** |

**Tres incumplimientos reales, no diez.** El diseño ataca esos tres.

---

## 4. Contrato de lo nuevo

### 4.1 Modelo de datos — subcolección clínica del paciente

```
clinics/{clinicId}/patients/{patientId}/clinico/resumen     ← NUEVO (doc único, id fijo 'resumen')
```

Documento único (no una colección de N docs) porque se lee y se escribe siempre completo, y así el coste es **1 lectura** por pantalla de paciente.

```ts
// src/types/index.ts  (aditivo)

/** PHI CLÍNICO del paciente. Vive FUERA del documento administrativo porque
 *  Firestore no autoriza por campo: si está en `patients/{id}`, recepción lo lee. */
export interface ResumenClinicoPaciente {
  alergias?: string
  alergiasEstructuradas?: AlergiaEstructurada[]
  /** Antes `Patient.notas` (texto libre; en la práctica antecedentes). */
  notasClinicas?: string
  txValoracion?: Record<string, string>
  txValoracionAt?: string
  txValoracionHist?: { fecha: string; modo: string; huesped: string; texto: string }[]
  actualizadoEn: string
  actualizadoPor: string      // uid
  /** Sello del backfill (§6). Su presencia prueba que el paciente ya migró. */
  migradoEn?: string
}

/** Campos clínicos que SALEN de `Patient`. Fuente única para el splitter de
 *  escritura (§4.3), para el script de migración (§6) y para el test (§7). */
export const CAMPOS_CLINICOS_PACIENTE = [
  'alergias', 'alergiasEstructuradas', 'notas',
  'txValoracion', 'txValoracionAt', 'txValoracionHist',
] as const
```

`Patient` conserva los campos **como opcionales y marcados `@deprecated`** durante la ventana de migración (§6): quitarlos del tipo el día 1 rompe la compilación de ~83 usos de golpe y obliga a un diff gigante e irrevisable. Se eliminan en la Fase C, cuando el backfill ya corrió.

### 4.2 Reglas — bloque nuevo (aditivo, dentro de `match /patients/{docId}`)

```
// PHI CLÍNICO del paciente (alergias, antecedentes, valoración). Mismo secreto
// médico que las notas: Firestore no autoriza por campo, así que lo clínico vive
// en su propia subcolección o recepción lo lee entero (NOM-004 · LFPDPPP).
match /clinico/{docId} {
  allow read:   if isMedico(clinicId);
  allow create, update: if isMedico(clinicId) && clinicaPuedeEscribir(clinicId);
  allow delete: if false;   // un antecedente no se borra desde el cliente
}
```

Correcto por construcción: las reglas de Firestore **no son recursivas** (salvo `{document=**}`), así que `allow read: if isMember` en `patients/{docId}` **no** alcanza a esta subcolección — es la misma propiedad de la que ya depende `notas` desde hace versiones.

### 4.3 Librería

```ts
// src/lib/authz/matriz-acceso.ts  (NUEVO — puro, sin imports de Firebase)
export type Rol = 'admin'|'medico'|'secretaria'|'recepcion'|'facturacion'|'enfermeria'|'farmacia'|'laboratorio'
export type ClasePHI = 'administrativo'|'clinico'|'financiero'|'identidad_profesional'|'plataforma'
export type Guarda = 'isMember'|'isMedico'|'isClinicoHospital'|'isLabStaff'|'isAdmin'|'servidor'|'publico'

export interface RecursoAcceso {
  readonly ruta: string          // 'clinics/{clinicId}/patients/{patientId}/clinico/{docId}'
  readonly clase: ClasePHI
  readonly guardaLectura: Guarda // nombre LITERAL de la función en firestore.rules
  readonly guardaEscritura: Guarda
  readonly porQue: string        // se imprime en la matriz documentada
}
export const MATRIZ_ACCESO: readonly RecursoAcceso[]
/** Roles que satisfacen una guarda. DERIVADO de firestore.rules, no inventado. */
export function rolesDe(g: Guarda): readonly Rol[]
export function puedeLeer(rol: Rol, ruta: string): boolean
export function puedeEscribir(rol: Rol, ruta: string): boolean
/** Roles sin acceso clínico. `recepcion` está aunque hoy no sea asignable (§0 H4). */
export const ROLES_NO_CLINICOS: readonly Rol[] = ['secretaria','recepcion','facturacion']
```

```ts
// src/lib/expediente/paciente-clinico.ts  (NUEVO — SDK cliente)
export type EstadoClinico = 'ok' | 'sin_permiso' | 'error' | 'no_migrado'
export interface LecturaClinica {
  datos: ResumenClinicoPaciente | null
  /** 'ok' incluye "existe y está vacío". NUNCA se colapsa con ausencia. */
  estado: EstadoClinico
}
export async function leerClinico(clinicId: string, patientId: string): Promise<LecturaClinica>
export async function guardarClinico(clinicId: string, patientId: string, uid: string,
                                     parche: Partial<ResumenClinicoPaciente>): Promise<void>
```

```ts
// src/lib/firestore.ts  (MODIFICADO)
/** Sin cambios de firma: sigue devolviendo SOLO lo administrativo. */
export async function getPatient(clinicId: string, patientId: string): Promise<Patient | null>
/** Nuevo: administrativo + clínico fusionado, con el estado de la lectura clínica. */
export async function getPatientCompleto(clinicId: string, patientId: string):
  Promise<{ paciente: Patient | null; estadoClinico: EstadoClinico }>
/** MODIFICADO: reparte el parche por CAMPOS_CLINICOS_PACIENTE — lo clínico va al
 *  subdocumento, lo administrativo al documento del paciente. Firma intacta. */
export async function updatePatient(clinicId: string, id: string, data: Partial<Patient>): Promise<void>
```

`getPatientCompleto` devuelve el objeto **fusionado** (`{...administrativo, ...clinico}`) tipado como `Patient`: por eso los ~83 usos de `patient.alergias` **no cambian**. Lo único que se propaga es `estadoClinico`.

`getPatients` (la lista) **no cambia y no trae nada clínico**. Beneficio colateral medible: hoy `/citas`, `/asistente`, `PaletteBusqueda` y `/hospitalizacion` descargan alergias y antecedentes de **toda** la clínica solo para autocompletar un nombre.

### 4.4 API — cierre del bypass del portal

```ts
// src/lib/patient-token.ts  (MODIFICADO — aditivo en el payload)
export type AlcanceToken = 'agenda' | 'clinico'
export function crearTokenPaciente(clinicId: string, patientId: string,
                                   ttlDias?: number, alcance?: AlcanceToken): string
export interface TokenVerificado { clinicId: string; patientId: string; alcance: AlcanceToken }
// Token viejo SIN campo de alcance → se interpreta 'agenda' (fail-closed).
```

- `/api/portal/link` (`verificarMiembro`, cualquier rol) emite **`alcance: 'agenda'`**.
- `/api/telesalud/token` (ya `verificarMedico`) emite **`alcance: 'clinico'`**.
- `/api/portal` acción `documentos` **exige `alcance === 'clinico'`**; con `'agenda'` responde 403 y el portal muestra «Pide a tu médico el acceso a tus recetas». Las acciones `session/confirmar/cancelar/slots/reagendar` funcionan con ambos.

**Por qué no simplemente subir `portal/link` a `verificarMedico`:** rompería el flujo real (`AppointmentModal.tsx:302-320`: la asistente pulsa y se abre WhatsApp con el enlace). El alcance conserva el trabajo de la asistente y le quita la capacidad clínica. **Coste asumido:** el paciente que recibe el enlace de la asistente deja de ver «Mis recetas» → **decisión D2** (§9).

---

## 5. Archivos que se tocan y por qué

**Nuevos (5)**
| Archivo | Por qué |
|---|---|
| `src/lib/authz/matriz-acceso.ts` | Entregable «matriz de acceso documentada», ejecutable. Carpeta ya elegida por E0-07 (`lib/authz/capabilities.ts`). |
| `src/lib/expediente/paciente-clinico.ts` | Lectura/escritura del subdocumento con estado explícito. |
| `scripts/migrar-phi-clinico.ts` | Backfill Admin SDK, idempotente, `--dry-run` por defecto (§6). |
| `docs/security/matriz-acceso-phi.md` | Matriz en prosa, **generada** desde `MATRIZ_ACCESO` (un test verifica que no divergen). |
| `src/__tests__/matriz-acceso.test.ts`, `phi-separacion.test.ts`, `api-authz-guard.test.ts` | §7. |

**Modificados — núcleo (6)**
`firestore.rules` (bloque `clinico`) · `src/types/index.ts` (tipo + constante, aditivo) · `src/lib/firestore.ts` (`getPatientCompleto`, splitter de `updatePatient`) · `src/lib/patient-token.ts` (alcance) · `src/app/api/portal/route.ts` (exigir alcance en `documentos`) · `src/app/api/portal/link/route.ts` (emitir `agenda`) · `src/app/api/fhir/paciente/[patientId]/route.ts` (leer el subdoc con Admin SDK).

**Modificados — consumidores clínicos (11)**
`consulta/[patientId]` (además: enganchar `estadoClinico` a `pacienteError`) · `expediente/[patientId]` · `receta/[patientId]/[notaId]` · `orden/[patientId]/[notaId]` · `nota/[patientId]/[notaId]` · `referencia/[patientId]` · `uci` · `hospitalizacion/[internamientoId]` · `consultor` (hoy toma alergias de la **lista**; pasa a leer el subdoc del paciente elegido) · `pacientes` (el form separa el bloque clínico) · `migracion` (CSV importa alergias → subdoc) · `components/pacientes/ValoracionInmuno.tsx` (3 `updateDoc` directos → `guardarClinico`).

**Explícitamente NO se tocan:** motor de dosis, `integrity.ts`/sello, impresión y paginación de receta, cobros, Stripe, WhatsApp, antibiograma, reglas de `notas`/`internamientos`/`cobros`.

---

## 6. Migración (lo que de verdad cumple la aceptación)

La regla nueva no cierra nada mientras el campo `alergias` siga **también** en `patients/{id}`. Secuencia obligada:

1. **Fase A (sin migración de datos, cero regresión visible):** matriz + tests + bloque de reglas `clinico` (aún sin datos) + cierre del bypass del portal (§4.4). Ya reduce la superficie real.
2. **Fase B (doble lectura):** `getPatientCompleto` lee el subdoc; si no existe (`estado: 'no_migrado'`), **cae al campo heredado** del documento del paciente. Toda escritura clínica va **solo** al subdoc. Sin ventana de datos rotos.
3. **Fase C (corte):** `scripts/migrar-phi-clinico.ts` copia y **borra con `FieldValue.delete()`** los campos heredados; se elimina el fallback y los campos del tipo `Patient`.

`scripts/migrar-phi-clinico.ts`: idempotente (salta al que ya tiene `migradoEn`), por lotes de 200, `--dry-run` por defecto, `--clinic=<id>` para migrar de a una, e imprime `{pacientes, migrados, yaMigrados, sinDatosClinicos, fallos}`. **No borra si la escritura del subdoc no confirmó.**

**Limitación honesta:** ningún test de este repo puede demostrar que la migración corrió en producción — no hay emulador (es E0-08) ni acceso a datos reales aquí. La verificación es la salida del script en modo `--verificar`, que cuenta pacientes con campos clínicos residuales en el documento administrativo y **debe dar 0**. Eso lo ejecuta el dueño; queda registrado en el RESULTADO de la unidad.

---

## 7. Tests que lo prueban (todos en `vitest`, sin emulador ni servidores)

| Test | Qué afirma |
|---|---|
| `firestore-rules-guard.test.ts` (extendido) | (a) existe `match /clinico/{docId}` con `allow read: if isMedico(clinicId)`; (b) `delete: if false`; (c) **regresión**: `patients/{docId}` sigue con `read: if isMember` (que recepción vea el directorio es parte de la aceptación: «lee cita»); (d) `notas`, `laboratorios`, `fotos` siguen en `isMedico`. |
| `matriz-acceso.test.ts` | (a) **todo** recurso `clase:'clinico'` tiene una guarda cuyo conjunto de roles no intersecta `ROLES_NO_CLINICOS` — incluido `recepcion`, que hoy no es asignable pero mañana sí; (b) cada `guarda` nombrada existe como `function <nombre>(` en `firestore.rules`; (c) cada `match` de `firestore.rules` tiene entrada en la matriz (nadie añade una colección sin clasificarla); (d) `permisosPorRol(rol).verExpediente === false` para todo rol de `ROLES_NO_CLINICOS` (matriz y permisos de UX no divergen); (e) el `.md` publicado coincide con `MATRIZ_ACCESO`. |
| `phi-separacion.test.ts` | (a) `CAMPOS_CLINICOS_PACIENTE` contiene alergias/estructuradas/notas/tx*; (b) el splitter de `updatePatient` manda cada clave a su documento y **no duplica** ninguna; (c) **fail-closed**: con `estado !== 'ok'` el objeto fusionado **no** trae `alergias: ''` y `alergiasParaImpreso` devuelve cadena vacía (nunca «Negadas»); (d) `estado 'ok'` con subdoc vacío ≠ `estado 'sin_permiso'`. |
| `api-authz-guard.test.ts` | Escaneo estático de `src/app/api/**/route.ts` (mismo patrón que `csp-guard.test.ts`): ninguna ruta que lea `collection('notas')`, `collection('clinico')`, `laboratorios` o `fotos` se conforma con `verificarMiembro`; **y** `portal/link` no emite tokens de alcance `clinico`. |
| `portal-alcance.test.ts` (dentro del anterior o suelto) | Token sin campo de alcance → `'agenda'`; `documentos` con `'agenda'` → 403; con `'clinico'` → 200. Puro sobre `patient-token.ts` + el handler. |

Gates: `npx tsc --noEmit`, `npx vitest run src/__tests__/`, `npm run build`. **No** se ejecuta Playwright ni emulador (carta operativa, regla 8).

---

## 8. Riesgo de regresión real

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| **Una pantalla clínica deja de ver alergias** (olvido en el paso a `getPatientCompleto`) | media | **alto (seguridad del paciente)** | Fase B con fallback al campo heredado: mientras no corra el corte, ningún camino se queda sin dato. El estado se pinta como banner rojo, no en silencio. |
| **Alergia ausente interpretada como «negadas»** | media | **muy alto** | El estado `no_disponible` nunca colapsa a `''`; `consulta` bloquea el guardado igual que con `pacienteError` (`:505-514`); `consultor:61` y `consulta:754` dejan de usar `|| 'no referidas'`. Cubierto por test. |
| **Migración a medias** (subdoc escrito, campo no borrado, o al revés) | media | medio | Script idempotente, borrado solo tras confirmación de escritura, `--verificar` que exige 0 residuales, `--dry-run` por defecto. |
| **La asistente deja de poder capturar alergias en el alta** | **alta (es el diseño)** | alto operativo | **D1**: es una decisión del dueño, no del agente. Si la respuesta es «sí puede capturar», la solución es *write-only* para `secretaria` (escribe el subdoc, no lo lee), que las reglas sí expresan. |
| **El paciente deja de ver «Mis recetas»** con enlaces enviados por la asistente | **alta (es el diseño)** | medio | **D2**. Alternativa si el dueño lo rechaza: enviar el enlace por el canal servidor (`whatsapp-send.ts`) sin devolvérselo al navegador del personal — más trabajo, mismo efecto. |
| **Tokens de 30 días ya circulando** pierden `documentos` al desplegar | alta | bajo | Es el fail-closed deliberado. Se reenvía el enlace desde la sesión del médico. Alternativa (más laxa): tratar el token sin alcance como `clinico` durante 30 días. **Recomendación: no.** |
| Coste de lecturas: +1 lectura por pantalla de paciente | alta | bajo | Compensado: `getPatients` deja de bajar PHI clínico de toda la clínica en 6 pantallas. |
| Romper `isMember` para el directorio de pacientes | baja | alto | Test de regresión explícito: recepción **debe** seguir leyendo `patients/{id}` (agendar exige nombre y teléfono). |

**Veredicto:** Fase A es de riesgo **bajo** y se puede implementar ya. Fases B y C son de riesgo **alto** y, conforme a la regla 5 de la carta operativa, **se entregan como plan y esperan la decisión del dueño (D1, D2)**.

---

## 9. Decisiones que NO puede tomar el agente

> Ninguna es un umbral clínico, una dosis ni una regla médica — por eso `necesitaValidacionClinica: false`, coherente con el backlog. Son decisiones **de operación y de privacidad del dueño**, y sin ellas las Fases B/C no deben fusionarse.

**D1 — ¿La asistente/recepción puede *capturar* alergias y antecedentes en el alta, aunque no pueda *leerlos* después?**
Hoy los captura en `/pacientes` (`:539`, `:543`). Tres opciones: (a) **no puede** — el médico las captura en consulta (más estricto, riesgo de que nadie las capture en el alta); (b) **write-only** — puede escribir el subdoc pero no leerlo (expresable en reglas: `allow create, update: if isMember` + `allow read: if isMedico`; rareza de UX: escribe «a ciegas»); (c) **puede leer y escribir alergias, pero no antecedentes ni valoración** (separa el subdoc en dos). **Recomendación del diseño: (a)**, por ser la única que cumple la aceptación literalmente.

**D2 — ¿El enlace del portal que envía la asistente debe seguir mostrando «Mis recetas» (Dx + medicamentos)?**
Si **sí**: la asistente conserva una credencial de 30 días con secreto médico y el bypass sigue abierto — habría que cerrarlo enviando el enlace desde el servidor sin devolverlo al navegador del personal. Si **no**: solo los enlaces emitidos por un médico abren esa pestaña. **Recomendación: no** (alcance `agenda`).

**D3 — ¿`tags` con `embarazo` / `cronico` / `alto-riesgo` son administrativos o clínicos?**
Hoy son visibles a todo el equipo y los usa la agenda/CRM. Moverlos a lo clínico cambia listados que la asistente usa a diario. **Recomendación: dejarlos en el documento administrativo y documentarlo como residual aceptado**, o crear `tagsClinicos` aparte si el dueño prefiere ocultarlos.

**D4 (informativa, no bloqueante) — `appointments.motivo`.** El motivo de consulta es dato de salud y la aceptación exige que recepción lea la cita. Se documenta como **residual aceptado** en la matriz, no se cambia.

---

## 10. Definición de terminado

- [ ] `matriz-acceso.ts` + `docs/security/matriz-acceso-phi.md` generados y coherentes (test).
- [ ] Bloque `clinico` en `firestore.rules` + asserts en `firestore-rules-guard.test.ts`.
- [ ] `portal/link` emite alcance `agenda`; `documentos` exige `clinico`; tests en verde.
- [ ] `getPatientCompleto` + splitter de `updatePatient` + 11 consumidores migrados (Fase B).
- [ ] `--verificar` del script devuelve **0 residuales** en la clínica del dueño (Fase C).
- [ ] `npx tsc --noEmit`, `npx vitest run src/__tests__/`, `npm run build` en verde.
- [ ] D1 y D2 respondidas y anotadas en el RESULTADO.
