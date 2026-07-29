# E0-07 — Autorización por capabilities · DISEÑO

> Estado: **DISEÑO, sin implementar.** Ningún archivo de producción fue modificado
> en esta unidad. Lo único escrito en disco es este documento.

- **Objetivo (backlog):** reemplazar el binario `verificarMedico`/`verificarMiembro`
  por capacidades explícitas (firmar, prescribir, cobrar, administrar).
- **Aceptación (backlog):** «Cada ruta declara la capacidad que exige; no hay
  any-member implícito.»
- **Riesgo declarado:** alto. **Riesgo real:** ver §8 (Fase A/B bajo, Fase C medio-alto).
- **Depende de:** E0-06 — **NO completada** (ver §9, bloqueo blando).

---

## 1. Qué existe HOY (código real, con archivo:línea)

### 1.1 Los dos helpers que la unidad viene a reemplazar

`src/lib/auth-server.ts`:

- `verificarUsuario(req)` — línea 62. Solo exige ID-token válido. No mira clínica ni rol.
- `verificarMiembro(req, clinicId)` — línea 72. Lee `clinic_members/{uid}`, compara
  `clinicId` y devuelve `role` en el `Acceso`. **Cualquier rol pasa.** Este es
  literalmente el «any-member implícito» del criterio de aceptación.
- `verificarModuloIA(req, modulo)` — línea 98. **No es autorización, es
  entitlement de plan.** Resuelve la clínica del uid y aplica `tieneModulo`. No mira
  el rol en ningún momento.
- `verificarMedico(req, clinicId)` — línea 124. `verificarMiembro` + `role ∈ {medico, admin}`.

### 1.2 Inventario completo: 74 rutas bajo `src/app/api`

| Guardia hoy | Rutas | Observación |
|---|---:|---|
| `verificarModuloIA` | 16 | entitlement de plan, **sin rol** |
| `verificarMedico` | 18 sitios / 16 archivos | `{medico, admin}` |
| `verificarMiembro` | 15 | **any-member** |
| `verificarUsuario` | 11 sitios | solo sesión |
| `verificarSuperadmin` | 6 | plataforma |
| sin guardia | 15 | públicas / webhooks / cron / callbacks OAuth |

Rutas sin guardia (verificadas una a una; **ninguna es un hallazgo nuevo**, todas
tienen su propio mecanismo: HMAC del paciente, firma del webhook, secreto de cron
o son deliberadamente públicas):
`portal`, `public/booking`, `public/resena`, `public/availability/[clinicId]`,
`public/clinic/[clinicId]`, `payment/create-checkout`, `receta/diseno`,
`calendar/callback`, `cron/reminders`, `csp-report`, `demo/evidencia`,
`stripe/webhook`, `whatsapp/webhook`, `whatsapp/360dialog-webhook`,
`whatsapp/360dialog-callback`.

### 1.3 La autorización de hoy vive en CINCO lugares distintos

Este es el hallazgo estructural de la unidad. No hay una fuente de verdad:

1. `src/lib/auth-server.ts:127` — `{medico, admin}` hardcodeado en `verificarMedico`.
2. `src/app/api/hospital/mutar/route.ts:20-39` — `GATES`, mapa de **19 acciones →
   lista de roles** (`administrar: ['enfermeria','medico','admin']`,
   `verificar_farmacia: ['farmacia','medico','admin']`, …). Es lo más parecido a
   capacidades que ya existe en el repo, y es la mejor prueba de que el modelo
   binario no alcanzaba.
3. `src/app/api/hospital/alerta/route.ts:25` — `ROLES_CLINICOS = ['medico','admin',
   'enfermeria','farmacia','laboratorio']`, otra lista suelta.
4. `src/lib/permissions.ts` — 12 permisos × 8 roles. **Cero consumidores en
   producción** (solo tests; lo dice su propio comentario en la línea 101). Módulo
   muerto que sin embargo define el vocabulario correcto.
5. `firestore.rules:18-49` — `isAdmin`, `isMedico`, `isClinicoHospital`
   (`medico|admin|enfermeria|farmacia|laboratorio`), `isLabStaff`
   (`medico|admin|laboratorio`).

### 1.4 Tres uniones de roles incompatibles

| Fuente | Roles |
|---|---|
| `src/types/index.ts:52` (`ClinicMember.role`) | admin, medico, secretaria, enfermeria, farmacia, laboratorio (**6**) |
| `src/lib/permissions.ts:9` (`Rol`) | los 6 + **recepcion** + **facturacion** (**8**) |
| `src/lib/miembros.ts:41` (`cambiarRolMiembro`) | los 6 (**6 asignables**) |

**Consecuencia dura, y afecta a otra unidad:** `recepcion` y `facturacion` **no son
asignables** en ninguna parte de la app. La aceptación de **E0-06** dice «Rol
recepción: lee cita, no lee nota ni alergias» — sobre un rol que hoy **no existe** en
`ClinicMember`. E0-07 debe fijar la unión canónica; E0-06 depende de esa decisión.

### 1.5 El hueco más grande no está en `verificarMiembro`, está en `verificarModuloIA`

Las 16 rutas de IA clínica (`expediente/transcribir`, `expediente/procesar`,
`expediente/verificar-nota`, `uci/copilot`, `inmuno/redactar`,
`consultor-evidencia`, …) exigen **plan**, no **rol**. Hoy un miembro con rol
`laboratorio` o `farmacia` puede hacer `POST /api/expediente/transcribir` con audio
y recibir de vuelta una nota clínica redactada: PHI clínico entregado a un rol no
clínico, por API, saltándose `firestore.rules` (Admin SDK). Es exactamente lo que
E0-06 quiere impedir por reglas, abierto por la puerta de al lado.

### 1.6 Prior art de tests-guardián que se puede copiar

`src/__tests__/log-secrets-guard.test.ts` (walker `readdirSync` + regex sobre
`src/`), `src/__tests__/csp-guard.test.ts`, `src/__tests__/native-dialogs-guard.test.ts`.
El guardián de §5.2 se escribe con ese mismo patrón, ya probado en este repo.

---

## 2. Contrato de lo nuevo

### 2.1 `src/lib/authz/capabilities.ts` — NÚCLEO PURO (entregable del backlog)

Sin `next/server`, sin `firebase-admin`, sin I/O. Testeable sin un solo mock.

```ts
/** Unión CANÓNICA de roles. Única fuente de verdad del repo. */
export const ROLES = ['admin','medico','secretaria','recepcion','facturacion',
                      'enfermeria','farmacia','laboratorio'] as const
export type Rol = typeof ROLES[number]

/** Roles que HOY se pueden asignar desde la app (subconjunto de ROLES). */
export const ROLES_ASIGNABLES: readonly Rol[]   // los 6 de cambiarRolMiembro

export const CAPACIDADES = [
  // clínicas
  'clinico.leer',            // leer PHI clínico (nota, expediente, export FHIR/HL7)
  'clinico.escribir',        // dictar / procesar / IA sobre el expediente
  'firmar',                  // sellar nota o receta (irreversible)
  'prescribir',              // receta e indicaciones farmacológicas
  'medicamento.administrar', // enfermería registra la toma
  // operativas
  'agenda.gestionar',        // citas, sync de calendario, lista de espera, portal
  'mensajeria.enviar',       // WhatsApp saliente al paciente
  'cobrar',                  // registrar cobro / abono
  'facturar',                // CFDI
  'equipo.leer',             // ver el directorio del consultorio
  // administración
  'administrar',             // config, llaves de IA, WhatsApp, suscripción, asientos
  'auditoria.registrar',     // escribir en la bitácora la acción propia
] as const
export type Capacidad = typeof CAPACIDADES[number]

export const CAPACIDADES_POR_ROL: Readonly<Record<Rol, readonly Capacidad[]>>

/** Mínimo privilegio: rol null/undefined/desconocido → SIN capacidades. */
export function capacidadesDe(rol: string | null | undefined): readonly Capacidad[]
export function tieneCapacidad(rol: string | null | undefined, c: Capacidad): boolean
/** Para tests de no-regresión: qué roles satisfacen una capacidad. */
export function rolesCon(c: Capacidad): readonly Rol[]
```

**Matriz propuesta.** Se construye para ser un **superconjunto exacto** de lo que hoy
pasa, salvo los estrechamientos declarados en §4:

| Capacidad | admin | medico | secretaria | recepcion | facturacion | enfermeria | farmacia | laboratorio |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| clinico.leer | ✓ | ✓ | | | | ✓ | ✓ | ✓ |
| clinico.escribir | ✓ | ✓ | | | | | | |
| firmar | ✓ | ✓ | | | | | | |
| prescribir | ✓ | ✓ | | | | | | |
| medicamento.administrar | ✓ | ✓ | | | | ✓ | | |
| agenda.gestionar | ✓ | ✓ | ✓ | ✓ | | | | |
| mensajeria.enviar | ✓ | ✓ | ✓ | ✓ | | | | |
| cobrar | ✓ | ✓ | ✓ | | ✓ | | | |
| facturar | ✓ | ✓ | | | ✓ | | | |
| equipo.leer | ✓ | ✓ | ✓ | | | | | |
| administrar | ✓ | ✓ | | | | | | |
| auditoria.registrar | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Notas de trazabilidad de la matriz (cada fila sale de código existente, no de la
imaginación):
- `firmar`/`prescribir`/`clinico.escribir`/`administrar` = `{medico, admin}` ≡
  `verificarMedico` (`auth-server.ts:127`) y `isMedico` (`firestore.rules:27`).
- `clinico.leer` ≡ `isClinicoHospital` (`firestore.rules:36`) y `ROLES_CLINICOS`
  (`hospital/alerta/route.ts:25`).
- `medicamento.administrar` ≡ `GATES.administrar` (`hospital/mutar/route.ts:34`).
- `auditoria.registrar` a **todos** los roles: es la bitácora de la acción propia;
  negarla abriría huecos en el rastro NOM-024. Es un `todos` **declarado por
  escrito**, no un any-member implícito.
- `medico` mantiene `administrar` porque hoy `verificarMedico` protege
  `stripe/*`, `clinic/ai-keys` POST y `whatsapp/*-connect`: quitárselo sería una
  regresión inmediata en un consultorio de un solo médico (el caso del dueño).

### 2.2 `src/lib/authz/verificar.ts` — guardia de request

Separado de `capabilities.ts` para que el núcleo quede puro y **para no crear ciclo**
(`auth-server.ts` no importa `authz/`; `authz/` importa `auth-server.ts`).

```ts
import type { NextRequest } from 'next/server'
import type { Acceso } from '@/lib/auth-server'

/** Sustituye a verificarMedico y a verificarMiembro en TODA ruta de clínica. */
export async function verificarCapacidad(
  req: NextRequest, clinicId: string, capacidad: Capacidad,
): Promise<Acceso>

/** Entitlement de plan Y capacidad de rol. Sustituye a verificarModuloIA. */
export async function verificarModuloYCapacidad(
  req: NextRequest, modulo: string, capacidad: Capacidad,
): Promise<Acceso>

/** Para rutas con sub-acciones (hospital/mutar). Devuelve 403 con el mismo texto de hoy. */
export function exigeCapacidad(acceso: AccesoOk, c: Capacidad): NextResponse | null
```

Semántica de `verificarCapacidad` (deliberadamente idéntica a la de hoy salvo el
último paso, para que los códigos de estado no cambien):
1. sin token → **401** (mismo texto).
2. `clinicId` vacío → **400**.
3. no es miembro de ESE `clinicId` → **403 'No tienes acceso a esta clínica.'**
4. error de Firestore → **500** (fail-closed, igual que hoy).
5. **nuevo:** `!tieneCapacidad(role, capacidad)` → **403** con mensaje que nombra la
   capacidad. `role` ausente/`undefined` → sin capacidades → 403.

### 2.3 `src/lib/authz/registro-rutas.ts` — la declaración (esto ES la aceptación)

```ts
export type Metodo = 'GET'|'POST'|'PUT'|'PATCH'|'DELETE'
export type ExigenciaRuta =
  | { tipo: 'capacidad';       capacidad: Capacidad }
  | { tipo: 'porMetodo';       metodos: Partial<Record<Metodo, Capacidad>> }
  | { tipo: 'porAccion';       acciones: Record<string, Capacidad>; motivo: string }
  | { tipo: 'entitlementIA';   modulo: string; capacidad: Capacidad }
  | { tipo: 'sesion';          motivo: string }   // login sin clínica (clinic/crear, clinic/unirse)
  | { tipo: 'superadmin' }
  | { tipo: 'publica';         motivo: string }   // booking, availability, resena, portal
  | { tipo: 'webhook';         motivo: string }   // stripe, whatsapp, 360dialog, csp-report
  | { tipo: 'cron';            motivo: string }

/** Clave = ruta relativa a src/app/api SIN '/route.ts'. Ej: 'hospital/mutar'. */
export const REGISTRO_RUTAS: Readonly<Record<string, ExigenciaRuta>>
```

Las variantes `publica`, `webhook`, `cron` y `sesion` **exigen `motivo` no vacío**: se
puede eximir una ruta, pero no en silencio.

### 2.4 `src/lib/permissions.ts` — pasa a DERIVAR, no a definir

`Permisos`/`permisosPorRol`/`puede` se conservan tal cual (firma y semántica) pero se
calculan desde `CAPACIDADES_POR_ROL`. Cero consumidores en producción (§1.3.4) ⇒
riesgo nulo; los 3 tests existentes que lo ejercitan deben seguir en verde **sin
tocarlos** (eso es la prueba de que la derivación es fiel).

---

## 3. Migración ruta por ruta — Fase B (equivalencia EXACTA, 0 cambio de comportamiento)

Las 18 llamadas a `verificarMedico` pasan a `verificarCapacidad(req, clinicId, X)`
con `rolesCon(X) === {medico, admin}`. Es una sustitución demostrablemente neutra:

| Ruta | Capacidad | Roles antes | Roles después |
|---|---|---|---|
| `voz/comandos-config` (GET/POST) | `administrar` | medico, admin | idem |
| `receta/verificacion-url` | `firmar` | medico, admin | idem |
| `telesalud/token` | `clinico.escribir` | medico, admin | idem |
| `mantenimiento/backfill-contadores` | `administrar` | medico, admin | idem |
| `facturacion/solicitar` | `facturar` **(ver ⚠)** | medico, admin | medico, admin, facturacion |
| `clinic/whatsapp-disconnect` | `administrar` | medico, admin | idem |
| `clinic/ai-keys` POST | `administrar` | medico, admin | idem |
| `fhir/paciente/[patientId]` | `clinico.leer` **(ver ⚠)** | medico, admin | + enfermeria/farmacia/laboratorio |
| `whatsapp/manual-connect` | `administrar` | medico, admin | idem |
| `whatsapp/meta-connect` | `administrar` | medico, admin | idem |
| `whatsapp/360dialog-connect` | `administrar` | medico, admin | idem |
| `whatsapp/plantillas-config` (GET/POST) | `administrar` | medico, admin | idem |
| `stripe/portal` · `stripe/recarga` · `stripe/checkout` | `administrar` | medico, admin | idem |
| `stripe/asientos` POST | `administrar` | medico, admin | idem |

⚠ **Dos casos donde la capacidad AMPLÍA.** Ampliar acceso es lo único que este
diseño no se permite hacer sin decisión explícita. Resolución adoptada:

- `fhir/paciente/[patientId]` exporta el expediente completo de un paciente. NO se
  mapea a `clinico.leer` sino a **`clinico.escribir`** (`{medico, admin}`), que es su
  gate real hoy. Un export completo de PHI no es «leer una nota en el pase de visita».
- `facturacion/solicitar` (timbrar CFDI) se mapea a `facturar` **restringido**: la
  fila de `facturacion` en la matriz queda pendiente de §7-Q2, y hasta que el Dr.
  responda, `facturacion` **no es un rol asignable** (§1.4), así que la ampliación es
  teórica: hoy nadie puede tener ese rol. Se implementa la matriz completa y se
  documenta; ningún usuario real gana acceso.

---

## 4. Migración de las 15 rutas `verificarMiembro` — Fase C (aquí SÍ se estrecha)

| Ruta | Capacidad propuesta | ¿Estrecha? | Quién pierde acceso |
|---|---|---|---|
| `appointments` POST | `agenda.gestionar` | sí | enfermeria, farmacia, laboratorio |
| `calendar/sync` | `agenda.gestionar` | sí | idem |
| `portal/link` | `agenda.gestionar` | sí | idem |
| `whatsapp/waitlist-notify` | `mensajeria.enviar` | sí | idem |
| `whatsapp/entregas` GET | `mensajeria.enviar` | sí | idem |
| `facturacion/pagos` GET | `cobrar` | sí | enfermeria, farmacia, laboratorio |
| `facturacion/descargar` GET | `facturar` | sí | secretaria + staff clínico |
| `clinic/miembros` GET | `equipo.leer` | sí | staff clínico (hoy cualquiera enumera correos del equipo) |
| `clinic/ai-keys` GET | `administrar` | sí | todos menos medico/admin |
| `hl7/convertir` | `clinico.leer` | sí | secretaria (convierte PHI a HL7) |
| `stripe/asientos` GET | `administrar` | sí | todos menos medico/admin |
| `auditoria/registrar` POST | `auditoria.registrar` | **no** | nadie (todos, declarado) |
| `hospital/alerta` | `clinico.leer` | **no** | ≡ `ROLES_CLINICOS` actual |
| `hospital/mutar` | `porAccion` (19 acciones) | **no** | ≡ `GATES` actual, 1:1 |
| `telesalud/sala` | `clinico.leer` **como rama OR** | ver ⚠⚠ | — |

⚠⚠ `telesalud/sala` **no** es un guard normal: `verificarMiembro` es la **segunda
rama** de un OR con el token HMAC del paciente (`route.ts:47-58`). La migración debe
conservar el OR intacto (`autorizadoPorToken || autorizadoPorCapacidad`) y, si la
capacidad falla, seguir devolviendo **404** (no 403) para no confirmar que el `citaId`
existe. Cualquier refactor que convierta esto en un `if (!acc.ok) return acc.response`
**reintroduce la fuga de existencia que la auditoría maestra ya cerró.** Test dedicado.

`hospital/mutar`: `GATES` (roles) se sustituye por `ACCION_CAPACIDAD` (capacidades)
manteniendo el conjunto de roles resultante **idéntico acción por acción**. Test de
tabla: para las 19 acciones, `rolesCon(ACCION_CAPACIDAD[a]) === GATES[a]` (con la
tabla vieja copiada literal dentro del test como oráculo). Es la mejor no-regresión
disponible y no cuesta nada.

### Las 16 rutas de IA (`verificarModuloIA`) — el hueco de §1.5

`verificarModuloIA(req, modulo)` → `verificarModuloYCapacidad(req, modulo, capacidad)`:

- `expediente/*` (11 rutas), `receta/detectar-campos`, `inmuno/redactar`,
  `consultor-evidencia` → `clinico.escribir` (`{medico, admin}`).
- `uci/copilot` → **pendiente de §7-Q1**. Si enfermería de UCI lo usa en la práctica,
  necesita una capacidad propia; si no, `clinico.escribir`.

Este es el cambio de mayor valor de seguridad de toda la unidad y también el de mayor
riesgo operativo. No se ejecuta a ciegas: ver §7.

---

## 5. Tests

### 5.1 `src/__tests__/authz-capabilities.test.ts` (puro, sin mocks)
1. Catálogo cerrado: toda capacidad la tiene ≥1 rol; ningún rol declara una capacidad
   fuera de `CAPACIDADES` (exhaustividad por tipos + runtime).
2. **Mínimo privilegio:** `capacidadesDe(null) === []`, `capacidadesDe(undefined) === []`,
   `capacidadesDe('director-general') === []`. (Contrasta con el bug ya reparado de
   `permisosPorRol`, que caía a ADMIN: `permissions.ts:96-103`.)
3. **No escalada:** ningún rol distinto de `admin`/`medico` tiene `administrar`,
   `firmar` ni `prescribir`.
4. **Tabla de no-regresión Fase B:** para cada una de las 18 rutas hoy bajo
   `verificarMedico`, `rolesCon(capacidad) === ['admin','medico']`.
5. **Tabla de no-regresión `hospital/mutar`:** las 19 acciones, contra `GATES` copiado
   literal como oráculo.
6. `permisosPorRol` derivado === tabla actual de `permissions.ts` (copiada como oráculo).

### 5.2 `src/__tests__/authz-rutas-declaradas.test.ts` (GUARDIÁN — es el criterio de aceptación)
Patrón de `log-secrets-guard.test.ts`.
1. **Toda** ruta `src/app/api/**/route.ts` en disco tiene entrada en `REGISTRO_RUTAS`.
   Una ruta nueva sin declarar **rompe el build de tests**.
2. No hay entradas zombis (toda clave del registro existe en disco).
3. **Cero imports de `verificarMiembro` / `verificarMedico` bajo `src/app/api`.** Esta
   es la prueba textual de «no hay any-member implícito».
4. Toda exención (`publica`/`webhook`/`cron`/`sesion`) tiene `motivo` no vacío.
5. Toda ruta declarada `capacidad`/`porMetodo` contiene realmente `verificarCapacidad(`
   en su fuente (el registro no puede mentir sobre el código).
6. **Autocomprobación del walker:** `expect(rutasEnDisco.length).toBeGreaterThan(60)`
   — un guardián que no encuentra archivos pasa vacío y no protege nada.

### 5.3 `src/__tests__/nucleo/autorizacion-servidor.test.ts` (extender, no reescribir)
`verificarCapacidad`: 401 sin token · 400 sin clinicId · 403 cross-tenant (con rol
`admin` de OTRA clínica, que es el caso que más engaña) · 403 rol sin la capacidad ·
403 con `role: undefined` en el doc de membresía · 500 fail-closed si Firestore
revienta · ok con rol que sí la tiene.

### 5.4 `src/__tests__/telesalud-sala-or.test.ts`
El OR de §4: token válido + rol sin capacidad → **entra**; sin token y sin capacidad →
**404** (nunca 403).

### 5.5 Verificación destructiva a documentar en `RESULTADO.json`
- Borrar `'firmar'` de `medico` en la matriz → 5.1.4 debe ponerse rojo.
- Añadir `src/app/api/prueba-guardian/route.ts` vacío → 5.2.1 rojo; borrarlo y verde.
- Sustituir `verificarCapacidad` por `verificarMiembro` en una ruta → 5.2.3 rojo.
Sin estas tres, el guardián puede estar pasando por vacío.

---

## 6. Archivos que se tocan

**Nuevos (5):**
- `src/lib/authz/capabilities.ts` — núcleo puro (entregable literal del backlog).
- `src/lib/authz/verificar.ts` — `verificarCapacidad`, `verificarModuloYCapacidad`, `exigeCapacidad`.
- `src/lib/authz/registro-rutas.ts` — declaración de las 74 rutas.
- `src/__tests__/authz-capabilities.test.ts`, `src/__tests__/authz-rutas-declaradas.test.ts`.
- (+ `src/__tests__/telesalud-sala-or.test.ts` si se ejecuta la Fase C.)

**Modificados:**
- `src/lib/auth-server.ts` — `verificarMiembro` y `verificarMedico` dejan de exportarse
  al exterior: se marcan `@internal` y se re-exportan **solo** para `src/lib/authz/`.
  `verificarUsuario`, `verificarModuloIA` y el tipo `Acceso` no cambian.
- `src/lib/permissions.ts` — pasa a derivar de la matriz (misma firma pública).
- `src/types/index.ts:52` — `ClinicMember.role` pasa a `Rol` importado de `capabilities.ts`
  (**ampliación de tipo**: de 6 a 8 valores; no rompe ningún literal existente).
- Fase B: 16 archivos de ruta (los de `verificarMedico`).
- Fase C: 15 archivos de ruta (`verificarMiembro`) + 16 de IA.

**NO se tocan:** `firestore.rules`, `storage.rules`, impresión/PDF/Word, firma de nota,
flujo de cobro del cliente, ningún motor clínico, ningún componente de UI.

---

## 7. Preguntas al médico dueño (política de acceso — NO son criterio clínico)

Ninguna de estas es una regla clínica, un umbral ni una dosis: son decisiones de
**quién puede hacer qué en su consultorio**, y sólo él las puede responder. Bloquean
la **Fase C**, no la A ni la B.

- **Q1 — UCI y enfermería.** ¿La enfermería de UCI usa `uci/copilot` y el dictado del
  expediente, o sólo el médico? Si sólo el médico, `clinico.escribir = {medico, admin}`
  y cierro el hueco de §1.5 hoy mismo.
- **Q2 — Roles fantasma.** `recepcion` y `facturacion` están en `permissions.ts` pero
  NO son asignables (§1.4). ¿Se activan (y E0-06 puede cumplir su aceptación literal),
  o se borran del catálogo? **E0-06 no puede cerrarse hasta que esto se responda.**
- **Q3 — Directorio del equipo.** ¿Enfermería/farmacia/laboratorio deben poder listar
  los correos del equipo (`clinic/miembros`)? Hoy pueden.
- **Q4 — Cobro y CFDI.** ¿La asistente (`secretaria`) descarga CFDI, o sólo cobra?
- **Q5 — Un solo médico.** En un consultorio de un médico, `medico` conserva
  `administrar` (Stripe, llaves de IA, WhatsApp). ¿Correcto, o `admin` debería ser el
  único que toca la suscripción?

---

## 8. Riesgo de regresión REAL

| Fase | Contenido | Riesgo | Por qué |
|---|---|:-:|---|
| **A** | `capabilities.ts` + `verificar.ts` + `registro-rutas.ts` + tests + `permissions.ts` derivado | **bajo** | aditivo puro; `permissions.ts` tiene 0 consumidores en producción |
| **B** | 18 sitios `verificarMedico` → `verificarCapacidad` | **bajo** | equivalencia de conjuntos demostrada por test de tabla (5.1.4); mismos códigos HTTP |
| **C** | 15 `verificarMiembro` + 16 IA | **medio-alto** | **estrecha acceso a usuarios reales.** Un 403 nuevo en `appointments` deja a alguien sin poder agendar y parece «la app se rompió» |

Riesgos concretos que la Fase C debe respetar (todos vistos en el código, no hipotéticos):
1. **`telesalud/sala`** — romper el OR o cambiar el 404 a 403 reabre una fuga ya cerrada (§4 ⚠⚠).
2. **`hospital/mutar`** — 19 acciones con roles finos; cualquier deriva rompe el pase
   de visita de enfermería o la verificación de farmacia.
3. **`auditoria/registrar`** — si se estrecha, se pierden entradas de bitácora **en
   silencio** (el cliente no muestra el fallo): daño invisible sobre NOM-024.
4. **`whatsapp/waitlist-notify`** — atado al bot y a la lista de espera; un 403 aquí
   corta confirmaciones de cita.
5. **`stripe/*`** — cobros. Cualquier estrechamiento que alcance al dueño le impide
   pagar su propia suscripción.

**Recomendación (regla 5 de la carta):** ejecutar **A y B** en la implementación de
E0-07 —cumplen la aceptación, porque tras B ninguna ruta usa `verificarMedico` y las
75 quedan declaradas en el registro—, y ejecutar **C** en el mismo lote **sólo para
las rutas donde no se pierde acceso a nadie** (`hospital/mutar`, `hospital/alerta`,
`auditoria/registrar`, `telesalud/sala`). Las 11 filas de §4 que sí estrechan y las 16
de IA quedan escritas en el registro con su capacidad definitiva pero **activadas tras
Q1–Q5**. Mientras tanto NO son any-member implícito: están declaradas, con su
capacidad y con la fecha de activación pendiente anotada.

---

## 9. Dependencia E0-06: bloqueo BLANDO

`estado.json` da como completadas E0-01…04, E0-14, E0-15, E1-01, E2-01. **E0-06 no
está** y no tiene `unidades/E0-06/RESULTADO.json`. El backlog declara `E0-07.depende
= ['E0-06']`.

No bloquea el diseño ni las fases A/B (E0-06 vive en `firestore.rules` — SDK cliente;
E0-07 vive en las API routes — Admin SDK; superficies disjuntas). Sí hay un
acoplamiento en un punto, y va en la dirección contraria a la declarada: **E0-06
necesita de E0-07** la unión canónica de roles y la existencia del rol `recepcion`
(§1.4, Q2). Propuesta para el orquestador: dejar `capabilities.ts` como fuente de
verdad de roles y que E0-06 consuma `CAPACIDADES_POR_ROL` al escribir las reglas,
en vez de inventar una cuarta lista de roles dentro de `firestore.rules`.

---

## 10. Gates a correr en la implementación

`npx tsc --noEmit` · `npx vitest run src/__tests__/` · `npm run build`.
Nada de servidores ni `--watch`. Sin despliegue.
