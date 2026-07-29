# E0-07 — Autorización por capabilities · DISEÑO

> Estado: **DISEÑO, sin implementar.** Ningún archivo de producción fue modificado
> en esta unidad. Lo único escrito en disco es este documento.
>
> **Revisión 2 (2026-07-29).** La revisión 1 se escribió cuando E0-06 aún NO había
> aterrizado. E0-06 ya está en `main` (commit `4fcd88b`) y **cambia tres cosas de este
> diseño**: creó `src/lib/authz/`, creó la fuente canónica de roles, y dejó un test
> que **bloquea literalmente la Fase B**. Ver §0.

- **Objetivo (backlog):** reemplazar el binario `verificarMedico`/`verificarMiembro`
  por capacidades explícitas (firmar, prescribir, cobrar, administrar).
- **Aceptación (backlog):** «Cada ruta declara la capacidad que exige; no hay
  any-member implícito.»
- **Riesgo declarado:** alto. **Riesgo real:** ver §8 (Fase A/B bajo, Fase C medio-alto).
- **Depende de:** E0-06 — aterrizada como `necesita_validacion` (Fase A completa,
  Fases B/C diferidas). Ver §9.

---

## 0. Qué cambió desde la revisión 1 (todo verificado en el código de hoy)

| # | Hallazgo | Consecuencia para E0-07 |
|---|---|---|
| 0.1 | `src/lib/authz/` **ya existe**, con `matriz-acceso.ts` (505 líneas). | El entregable `lib/authz/capabilities.ts` es un archivo *nuevo dentro de un módulo existente*, no un módulo nuevo. |
| 0.2 | La unión canónica de roles **ya está escrita**: `matriz-acceso.ts:34-38` exporta `ROLES` (los 8) y `type Rol`. | `capabilities.ts` **NO debe redeclararla.** La rev. 1 proponía crearla y habría producido la 5.ª lista de roles del repo — exactamente el defecto que la unidad viene a cerrar. Ver §2.1. |
| 0.3 | `matriz-acceso.ts:69-80` exporta `rolesDe(guarda)` con los roles de cada guarda de `firestore.rules`, transcritos y probados. | La matriz de capacidades no se justifica con prosa: se **verifica contra `rolesDe()`** en el test. Ver §5.1.7. |
| 0.4 | **BLOQUEADOR.** `src/__tests__/api-authz-guard.test.ts` fija los nombres de los helpers viejos en el texto fuente de las rutas (3 asserts). | La Fase B pone **ese test en rojo**. Es un conflicto duro entre la aceptación de E0-06 y la de E0-07. Ver §3.0 — es el trabajo nuevo más importante de esta unidad. |
| 0.5 | `GATES` de `hospital/mutar` tiene **18** acciones, no 19 (`route.ts:20-39`, contadas). | Corrige §4, §5.1.5 y §8.2 de la rev. 1. Un oráculo con el número mal delata que se copió a ojo. |
| 0.6 | `permisosPorRol` ya cae a `RECEPCION` (mínimo privilegio) en `permissions.ts:104-107`; el bug del `?? 'admin'` está reparado. | La derivación de §2.4 debe **conservar ese fallback**, que NO es «sin capacidades». Asimetría explícita en §2.4. |
| 0.7 | `matriz-acceso.test.ts:165-172` ya cruza `permisosPorRol` contra la matriz de E0-06. | Tocar `permissions.ts` toca ese test. Es una restricción a respetar, no un test a editar. |
| 0.8 | Recuento de rutas re-verificado **ignorando comentarios** (los comentarios de este repo citan a propósito los nombres de los guardianes). | Cifras firmes: **74** rutas · `verificarMedico` 16 archivos / **18 llamadas** · `verificarMiembro` 15 archivos / **15 llamadas** · `verificarModuloIA` 16 · `verificarUsuario` 10 · `verificarSuperadmin` 6 · **15 sin guardia**. Un `grep` ingenuo dice 17 archivos con `verificarMiembro`: los 2 extra (`telesalud/token`, `fhir/paciente`) sólo lo mencionan en un comentario. |

---

## 1. Qué existe HOY (código real, con archivo:línea)

### 1.1 Los cuatro helpers de `src/lib/auth-server.ts`

- `verificarUsuario(req)` — **línea 62**. Solo exige ID-token válido. No mira clínica ni rol.
- `verificarMiembro(req, clinicId)` — **línea 72**. Lee `clinic_members/{uid}`, compara
  `clinicId` y devuelve `role` en el `Acceso`. **Cualquier rol pasa.** Este es
  literalmente el «any-member implícito» del criterio de aceptación.
- `verificarModuloIA(req, modulo)` — **línea 98**. **No es autorización, es
  entitlement de plan.** Resuelve la clínica del uid y aplica `tieneModulo`. No mira
  el rol en ningún momento. Ojo con su semántica de error, que hay que preservar:
  **fail-OPEN** ante fallo de Firestore para módulos de consulta y **fail-CLOSED (503)**
  para `MODULOS_OPT_IN` (`líneas 112-120`).
- `verificarMedico(req, clinicId)` — **línea 124**. `verificarMiembro` + `role ∈ {medico, admin}`
  (`línea 127`), mensaje `'Requiere rol de médico.'`.

### 1.2 Inventario de las 74 rutas bajo `src/app/api`

| Guardia hoy | Archivos | Observación |
|---|---:|---|
| `verificarModuloIA` | 16 | entitlement de plan, **sin rol** |
| `verificarMedico` | 16 (18 llamadas) | `{medico, admin}` |
| `verificarMiembro` | 15 | **any-member** |
| `verificarUsuario` | 10 | solo sesión |
| `verificarSuperadmin` | 6 | plataforma |
| sin guardia | 15 | públicas / webhooks / cron / callbacks OAuth |

Las 15 sin guardia, verificadas una a una (**ninguna es un hallazgo nuevo**; todas
tienen su propio mecanismo: HMAC del paciente, firma del webhook, secreto de cron, o
son deliberadamente públicas): `portal`, `public/booking`, `public/resena`,
`public/availability/[clinicId]`, `public/clinic/[clinicId]`, `payment/create-checkout`,
`receta/diseno`, `calendar/callback`, `cron/reminders`, `csp-report`, `demo/evidencia`,
`stripe/webhook`, `whatsapp/webhook`, `whatsapp/360dialog-webhook`,
`whatsapp/360dialog-callback`.

### 1.3 La autorización de hoy vive en SEIS lugares distintos

Este es el hallazgo estructural de la unidad. No hay una fuente de verdad:

1. `src/lib/auth-server.ts:127` — `{medico, admin}` hardcodeado en `verificarMedico`.
2. `src/app/api/hospital/mutar/route.ts:20-39` — `GATES`, mapa de **18 acciones →
   lista de roles** (`administrar: ['enfermeria','medico','admin']`,
   `verificar_farmacia: ['farmacia','medico','admin']`, …). Es lo más parecido a
   capacidades que ya existe, y la mejor prueba de que el modelo binario no alcanzaba.
3. `src/app/api/hospital/alerta/route.ts:25` — `ROLES_CLINICOS = ['medico','admin',
   'enfermeria','farmacia','laboratorio']`, otra lista suelta, comprobada en la `:37`.
4. `src/lib/permissions.ts` — 12 permisos × 8 roles. **Cero consumidores en
   producción** (verificado: el único import fuera de `src/__tests__/` es una mención
   en un comentario de `matriz-acceso.ts:30`). Módulo inerte que define el vocabulario
   correcto.
5. `firestore.rules:18-49` — `isAdmin`, `isMedico`, `isClinicoHospital`, `isLabStaff`.
6. **NUEVO (E0-06)** `src/lib/authz/matriz-acceso.ts` — 44 recursos clasificados,
   `ROLES` canónico (`:34`), `rolesDe(guarda)` (`:419`), `ROLES_NO_CLINICOS` (`:83`).
   **Este sexto lugar es el bueno** y es el único con tests que lo atan a las reglas.
   E0-07 debe *extenderlo*, no competir con él.

### 1.4 Uniones de roles incompatibles: quedan TRES

| Fuente | Roles |
|---|---|
| `src/types/index.ts:52` (`ClinicMember.role`) | admin, medico, secretaria, enfermeria, farmacia, laboratorio (**6**) |
| `src/lib/permissions.ts:9` (`Rol`) | los 6 + **recepcion** + **facturacion** (**8**) |
| `src/lib/authz/matriz-acceso.ts:34` (`ROLES`) | los **8** — canónica, con tests |
| `src/lib/miembros.ts:41` (`cambiarRolMiembro`) | los 6 (**6 asignables**) |

**Consecuencia dura:** `recepcion` y `facturacion` siguen **no siendo asignables** en
la app. E0-06 lo dejó documentado en `matriz-acceso.ts:28-32` y lo evalúa igual, para
que el candado esté puesto el día que se activen. E0-07 hereda esa postura: la matriz
de capacidades **cubre los 8 roles**, y `ROLES_ASIGNABLES` (los 6) se declara aparte
para que ampliar acceso a un rol fantasma no amplíe acceso a nadie real.

### 1.5 El hueco más grande no está en `verificarMiembro`, está en `verificarModuloIA`

Las 16 rutas de IA clínica (`expediente/*` ×11, `receta/detectar-campos`,
`inmuno/redactar`, `consultor-evidencia`, `uci/copilot`) exigen **plan**, no **rol**.
Hoy un miembro con rol `laboratorio` o `farmacia` puede hacer
`POST /api/expediente/transcribir` con audio y recibir una nota clínica redactada: PHI
clínico entregado a un rol que `firestore.rules` mantiene fuera del expediente, por
API, saltándose las reglas (Admin SDK). Es exactamente lo que E0-06 cerró por reglas y
por el token del portal, abierto por la puerta de al lado.

### 1.6 Prior art de tests-guardián que se puede copiar

`src/__tests__/api-authz-guard.test.ts` (E0-06, walker `readdirSync` + limpieza de
comentarios — **el molde más cercano**), `log-secrets-guard.test.ts`,
`csp-guard.test.ts`, `firestore-rules-guard.test.ts`.

---

## 2. Contrato de lo nuevo

### 2.1 `src/lib/authz/capabilities.ts` — NÚCLEO PURO (entregable del backlog)

Sin `next/server`, sin `firebase-admin`, sin I/O. Testeable sin un solo mock.
**Reutiliza los roles de E0-06; no los redeclara** (§0.2).

```ts
import { ROLES, type Rol } from './matriz-acceso'   // ← fuente canónica (E0-06)
export type { Rol }

/** Roles que HOY se pueden asignar desde la app (subconjunto de ROLES).
 *  Espejo de cambiarRolMiembro (miembros.ts:41) y del enum de ClinicMember.role. */
export const ROLES_ASIGNABLES: readonly Rol[]   // los 6

export const CAPACIDADES = [
  // clínicas
  'clinico.leer',            // leer PHI clínico en el pase de visita (≡ isClinicoHospital)
  'clinico.escribir',        // dictar / procesar IA / exportar el expediente
  'firmar',                  // sellar nota o receta (irreversible)
  'prescribir',              // receta e indicaciones farmacológicas
  'medicamento.administrar', // enfermería registra la toma
  // operativas
  'agenda.gestionar',        // citas, sync de calendario, lista de espera, magic-link
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
/** Para los tests de no-regresión: qué roles satisfacen una capacidad. */
export function rolesCon(c: Capacidad): readonly Rol[]
```

**Matriz propuesta.** Superconjunto exacto de lo que hoy pasa, salvo los
estrechamientos declarados en §4:

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

Trazabilidad — cada fila sale de código existente, no de la imaginación, y el test de
§5.1.7 lo comprueba contra E0-06 en vez de confiar en esta tabla:

- `firmar`/`prescribir`/`clinico.escribir`/`administrar` = `{medico, admin}` ≡
  `verificarMedico` (`auth-server.ts:127`) ≡ `rolesDe('isMedico')` (`matriz-acceso.ts:72`).
- `clinico.leer` ≡ `rolesDe('isClinicoHospital')` (`matriz-acceso.ts:73`) ≡
  `ROLES_CLINICOS` (`hospital/alerta/route.ts:25`).
- `medicamento.administrar` ≡ `GATES.administrar` (`hospital/mutar/route.ts:34`).
- **Coherencia con E0-06:** ningún rol de `ROLES_NO_CLINICOS`
  (`secretaria, recepcion, facturacion`) tiene `clinico.leer` ni `clinico.escribir`.
  Esa es la aceptación de E0-06 expresada en capacidades, y se prueba (§5.1.7).
- `auditoria.registrar` a **todos** los roles: es la bitácora de la acción propia;
  negarla abriría huecos en el rastro NOM-024. Es un `todos` **declarado por escrito**,
  no un any-member implícito.
- `medico` conserva `administrar` porque hoy `verificarMedico` protege `stripe/*`,
  `clinic/ai-keys` POST y `whatsapp/*-connect`: quitárselo es una regresión inmediata
  en el consultorio de un solo médico (el caso del dueño). Sujeto a Q5.

### 2.2 `src/lib/authz/verificar.ts` — guardia de request

Separado de `capabilities.ts` para que el núcleo quede puro y **para no crear ciclo**
(`auth-server.ts` no importa `authz/`; `authz/` importa `auth-server.ts`).

```ts
import type { NextRequest, NextResponse } from 'next/server'
import type { Acceso, AccesoOk } from '@/lib/auth-server'
import type { Capacidad } from './capabilities'

/** Sustituye a verificarMedico y a verificarMiembro en TODA ruta de clínica. */
export async function verificarCapacidad(
  req: NextRequest, clinicId: string, capacidad: Capacidad,
): Promise<Acceso>

/** Entitlement de plan Y capacidad de rol. Sustituye a verificarModuloIA. */
export async function verificarModuloYCapacidad(
  req: NextRequest, modulo: string, capacidad: Capacidad,
): Promise<Acceso>

/** Para rutas con sub-acciones (hospital/mutar). null = permitido. */
export function exigeCapacidad(acceso: AccesoOk, c: Capacidad): NextResponse | null
```

Semántica de `verificarCapacidad`, deliberadamente idéntica a la de hoy salvo el
último paso, para que **ningún código de estado cambie**:
1. sin token → **401**, mismo texto `'No autenticado. Inicia sesión nuevamente.'`
2. `clinicId` vacío → **400** `'Falta clinicId'`.
3. no es miembro de ESE `clinicId` → **403** `'No tienes acceso a esta clínica.'`
4. error de Firestore → **500** `'Error verificando membresía'` (fail-closed, igual que hoy).
5. **nuevo:** `!tieneCapacidad(role, capacidad)` → **403** con mensaje que nombra la
   capacidad. `role` ausente/`undefined` → sin capacidades → 403.

`verificarModuloYCapacidad` **debe preservar la asimetría de error de
`verificarModuloIA`** (`auth-server.ts:112-120`): fail-OPEN para módulos de consulta,
**503 fail-CLOSED** para `MODULOS_OPT_IN`. En el camino fail-OPEN el `role` viene
`undefined` (`línea 119`) ⇒ con la comprobación de capacidad encima, ese camino pasaría
a 403 y **tumbaría la IA a todos ante un fallo transitorio de Firestore**. Regla del
diseño: si el entitlement se resolvió por fail-OPEN, la capacidad **no se evalúa** y se
registra en bitácora; el rol se comprueba sólo cuando se pudo leer la membresía. Test
dedicado (§5.3).

### 2.3 `src/lib/authz/registro-rutas.ts` — la declaración (esto ES la aceptación)

```ts
export type Metodo = 'GET'|'POST'|'PUT'|'PATCH'|'DELETE'
export type ExigenciaRuta =
  | { tipo: 'capacidad';     capacidad: Capacidad }
  | { tipo: 'porMetodo';     metodos: Partial<Record<Metodo, Capacidad>> }
  | { tipo: 'porAccion';     acciones: Record<string, Capacidad>; motivo: string }
  | { tipo: 'entitlementIA'; modulo: string; capacidad: Capacidad }
  | { tipo: 'tokenPaciente'; capacidadAlternativa?: Capacidad; motivo: string } // OR con HMAC
  | { tipo: 'sesion';        motivo: string }   // login sin clínica (clinic/crear, clinic/unirse)
  | { tipo: 'superadmin' }
  | { tipo: 'publica';       motivo: string }
  | { tipo: 'webhook';       motivo: string }
  | { tipo: 'cron';          motivo: string }

/** Clave = ruta relativa a src/app/api SIN '/route.ts'. Ej: 'hospital/mutar'. */
export const REGISTRO_RUTAS: Readonly<Record<string, ExigenciaRuta>>
```

`publica`, `webhook`, `cron`, `sesion`, `porAccion` y `tokenPaciente` **exigen `motivo`
no vacío**: se puede eximir una ruta, pero **no en silencio**. La variante
`tokenPaciente` es nueva respecto a la rev. 1 y existe para modelar honestamente los
dos OR reales del repo (`telesalud/sala` y `portal`) en lugar de meterlos en `publica`.

### 2.4 `src/lib/permissions.ts` — pasa a DERIVAR, no a definir

`Permisos`/`permisosPorRol`/`puede` conservan firma y semántica, pero se calculan desde
`CAPACIDADES_POR_ROL`. Cero consumidores en producción (§1.3.4) ⇒ riesgo nulo.
Dos restricciones que la derivación **no puede romper** (ambas ya probadas):

- `permisosPorRol(null | undefined | 'desconocido') === RECEPCION`
  (`permissions.ts:104-107`, `nucleo/autorizacion-servidor.test.ts:187-199`).
  **Asimetría deliberada:** `capacidadesDe(null) === []` (mínimo privilegio en el
  servidor) pero el helper de UX sigue devolviendo el objeto `RECEPCION` — es una capa
  de presentación y devolver `undefined` reventaría al llamador que haga `.verAgenda`.
- `matriz-acceso.test.ts:165-172`: `verExpediente`/`editarExpediente` `false` para los
  3 `ROLES_NO_CLINICOS` y `true` para `medico`.

Los 3 tests que hoy ejercitan `permissions.ts` deben seguir en verde **sin tocarlos**:
eso es la prueba de que la derivación es fiel.

---

## 3. Fase B — las 18 llamadas a `verificarMedico`

### 3.0 BLOQUEADOR: el guardián de E0-06 fija los nombres viejos (§0.4)

`src/__tests__/api-authz-guard.test.ts` no razona sobre autorización: razona sobre el
**texto** de los archivos de ruta. Tres asserts se rompen con la Fase B:

| Línea | Assert | Qué pasa al migrar |
|---|---|---|
| `:60` | `conGuardaFuerte = src.includes('verificarMedico') \|\| src.includes('verificarTokenPaciente')` | Toda ruta que lea `notas`/`laboratorios`/`fotos`/`clinico` y pase a `verificarCapacidad` se cuenta como **infractora** ⇒ rojo. |
| `:83` | `expect(codigo(LINK)).toContain('verificarMiembro')` | `portal/link` **debe** contener `verificarMiembro`. Migrarla a `agenda.gestionar` ⇒ rojo. |
| `:95-97` | `telesalud/token` debe contener `'verificarMedico'` y **no** `'verificarMiembro'` | Migrarla a `clinico.escribir` ⇒ rojo. |

Además `:61` usa `src.includes('verificarMiembro')` como señal de guarda débil: el
propio nombre del helper es el detector. Eliminar el helper elimina el detector.

**No es un test que «haya que actualizar de paso»: es la aceptación de E0-06 escrita
contra una implementación que E0-07 sustituye.** Trabajo obligatorio de esta unidad,
antes de tocar una sola ruta:

1. Reescribir `api-authz-guard.test.ts` para que la señal sea la **capacidad
   declarada**, no el nombre del helper: para cada ruta que lea una colección de
   `COLECCIONES_CLINICAS`, exigir que `REGISTRO_RUTAS[ruta]` pida una capacidad cuyo
   `rolesCon()` **no incluya** ningún `ROLES_NO_CLINICOS` (o sea `tokenPaciente`).
   Queda más fuerte que hoy: hoy basta con que la cadena `verificarMedico` aparezca en
   alguna parte del archivo; después habrá que declararlo y el guardián de §5.2.5
   comprueba que el código coincide con la declaración.
2. Conservar **intactas** las 3 propiedades de E0-06, re-expresadas:
   `portal/link` sigue accesible a **cualquier miembro** (capacidad `agenda.gestionar`,
   que la asistente tiene) y sigue emitiendo alcance `'agenda'`, nunca `'clinico'`;
   `telesalud/token` sigue exigiendo `{medico, admin}` (`clinico.escribir`) para emitir
   alcance `'clinico'`; `/api/portal` sigue exigiendo `alcance !== 'clinico'` → 403
   antes de tocar `collection('notas')`.
3. Ejecutar el control negativo de E0-06 sobre el test reescrito (bajar `portal/link` a
   una capacidad de médico ⇒ debe ponerse rojo por *romper a la asistente*; subirla a
   una que incluya a `laboratorio` ⇒ rojo por fuga). Si el test reescrito no se pone
   rojo en ambos sentidos, la reescritura degradó el guardián y **no se acepta**.

⚠️ Ojo con `portal/link`: es la única ruta donde la rev. 1 y E0-06 se contradicen de
fondo. La rev. 1 la mandaba a `agenda.gestionar`, que **estrecha** (deja fuera a
enfermería/farmacia/laboratorio); E0-06 fijó por test que «no rompe a la asistente»,
que es compatible. El estrechamiento sigue siendo Fase C (§4), no B.

### 3.1 Sustitución neutra, ruta por ruta

Cada una pasa a `verificarCapacidad(req, clinicId, X)` con `rolesCon(X) === {medico, admin}`:

| Ruta | Capacidad | Roles antes | Roles después |
|---|---|---|---|
| `voz/comandos-config` (GET/POST) | `administrar` | medico, admin | idem |
| `receta/verificacion-url` | `firmar` | medico, admin | idem |
| `telesalud/token` | `clinico.escribir` | medico, admin | idem |
| `mantenimiento/backfill-contadores` | `administrar` | medico, admin | idem |
| `facturacion/solicitar` | `facturar` **(⚠ amplía)** | medico, admin | + facturacion |
| `clinic/whatsapp-disconnect` | `administrar` | medico, admin | idem |
| `clinic/ai-keys` POST | `administrar` | medico, admin | idem |
| `fhir/paciente/[patientId]` | `clinico.escribir` **(⚠ ver nota)** | medico, admin | idem |
| `whatsapp/manual-connect` | `administrar` | medico, admin | idem |
| `whatsapp/meta-connect` | `administrar` | medico, admin | idem |
| `whatsapp/360dialog-connect` | `administrar` | medico, admin | idem |
| `whatsapp/plantillas-config` (GET/POST) | `administrar` | medico, admin | idem |
| `stripe/portal` · `stripe/recarga` · `stripe/checkout` | `administrar` | medico, admin | idem |
| `stripe/asientos` POST | `administrar` | medico, admin | idem |

⚠ **Ampliar acceso es lo único que este diseño no se permite hacer sin decisión
explícita.** Resolución adoptada:

- `fhir/paciente/[patientId]` exporta el expediente completo. **NO** se mapea a
  `clinico.leer` (que incluiría a enfermería/farmacia/laboratorio) sino a
  `clinico.escribir` = `{medico, admin}`, su gate real de hoy. Un export completo de
  PHI no es «leer una nota en el pase de visita». El nombre de la capacidad queda
  imperfecto; la alternativa —una capacidad `clinico.exportar` propia— se propone para
  E0-08 si el Dr. quiere separar export de dictado (no lo decido yo).
- `facturacion/solicitar` (timbrar CFDI) → `facturar`, cuya fila de `facturacion`
  queda pendiente de **Q4**. La ampliación es **teórica**: `facturacion` no está en
  `ROLES_ASIGNABLES` (§1.4), así que hoy nadie puede tenerlo. Se implementa la matriz
  completa y se documenta; **ningún usuario real gana acceso**, y el test de §5.1.8 lo
  fija: toda ampliación respecto al gate de hoy debe recaer sólo en roles no asignables.

---

## 4. Fase C — las 15 llamadas a `verificarMiembro` (aquí SÍ se estrecha)

| Ruta | Capacidad propuesta | ¿Estrecha? | Quién pierde acceso |
|---|---|---|---|
| `appointments` POST | `agenda.gestionar` | sí | enfermeria, farmacia, laboratorio |
| `calendar/sync` | `agenda.gestionar` | sí | idem |
| `portal/link` | `agenda.gestionar` | sí | idem (§3.0 ⚠) |
| `whatsapp/waitlist-notify` | `mensajeria.enviar` | sí | idem |
| `whatsapp/entregas` GET | `mensajeria.enviar` | sí | idem |
| `facturacion/pagos` GET | `cobrar` | sí | enfermeria, farmacia, laboratorio |
| `facturacion/descargar` GET | `facturar` | sí | secretaria + staff clínico |
| `clinic/miembros` GET | `equipo.leer` | sí | staff clínico (hoy cualquiera enumera los correos del equipo) |
| `clinic/ai-keys` GET | `administrar` | sí | todos menos medico/admin |
| `hl7/convertir` | `clinico.leer` | sí | secretaria (convierte PHI a HL7) |
| `stripe/asientos` GET | `administrar` | sí | todos menos medico/admin |
| `auditoria/registrar` POST | `auditoria.registrar` | **no** | nadie (todos, declarado) |
| `hospital/alerta` | `clinico.leer` | **no** | ≡ `ROLES_CLINICOS` actual |
| `hospital/mutar` | `porAccion` (**18** acciones) | **no** | ≡ `GATES` actual, 1:1 |
| `telesalud/sala` | `tokenPaciente` + `clinico.leer` | ver ⚠⚠ | — |

⚠⚠ `telesalud/sala` **no es un guard normal**: `verificarMiembro` es la **segunda rama
de un OR** con el token HMAC del paciente (`route.ts:47-58`), y el fallo devuelve
**404, no 403**, para no confirmar que el `citaId` existe (`:56-58`, cerrado por la
auditoría maestra 2026-07 — el comentario del archivo lo dice). La migración debe
conservar: (a) el OR, (b) que el token se evalúe **primero** y la membresía sólo si el
token falla (`:50-53`), (c) el **404**. Cualquier refactor que lo convierta en
`if (!acc.ok) return acc.response` **reintroduce la fuga de existencia ya cerrada**.
Test dedicado (§5.4).

`hospital/mutar`: `GATES` (roles) → `ACCION_CAPACIDAD` (capacidades) manteniendo el
conjunto de roles resultante **idéntico acción por acción**. Test de tabla: para las
**18** acciones, `rolesCon(ACCION_CAPACIDAD[a]) === GATES[a]`, con la tabla vieja
copiada literal dentro del test como oráculo. Mejor no-regresión disponible, coste cero.

### Las 16 rutas de IA (`verificarModuloIA`) — el hueco de §1.5

`verificarModuloIA(req, modulo)` → `verificarModuloYCapacidad(req, modulo, capacidad)`,
respetando la asimetría fail-OPEN/503 de §2.2:

- `expediente/*` (11), `receta/detectar-campos`, `inmuno/redactar`,
  `consultor-evidencia` → `clinico.escribir` (`{medico, admin}`).
- `uci/copilot` → **pendiente de Q1.** Si la enfermería de UCI lo usa en la práctica,
  necesita capacidad propia; si no, `clinico.escribir`.

Cambio de mayor valor de seguridad de la unidad **y** de mayor riesgo operativo. No se
ejecuta a ciegas: ver §7 y §8.

---

## 5. Tests

### 5.1 `src/__tests__/authz-capabilities.test.ts` (puro, sin mocks)
1. Catálogo cerrado: toda capacidad la tiene ≥1 rol; ningún rol declara una capacidad
   fuera de `CAPACIDADES`; `CAPACIDADES_POR_ROL` cubre **exactamente** `ROLES`.
2. **Mínimo privilegio:** `capacidadesDe(null) === []`, `capacidadesDe(undefined) === []`,
   `capacidadesDe('director-general') === []`.
3. **No escalada:** ningún rol distinto de `admin`/`medico` tiene `administrar`,
   `firmar`, `prescribir` ni `clinico.escribir`.
4. **No-regresión Fase B:** para cada una de las 18 llamadas hoy bajo
   `verificarMedico`, `rolesCon(capacidad) ⊇ ['admin','medico']` y (salvo las 2 de §3.1 ⚠)
   `=== ['admin','medico']`.
5. **No-regresión `hospital/mutar`:** las **18** acciones contra `GATES` copiado literal
   como oráculo, incluida la comprobación de que el oráculo tiene 18 entradas.
6. `permisosPorRol` derivado === tabla actual de `permissions.ts` (copiada como oráculo),
   incluido el fallback `RECEPCION` de §2.4.
7. **NUEVO — puente con E0-06 (esto es lo que evita inventar la matriz):**
   `rolesCon('clinico.escribir') === rolesDe('isMedico')`;
   `rolesCon('clinico.leer') === rolesDe('isClinicoHospital')`;
   y para todo `rol ∈ ROLES_NO_CLINICOS`, `capacidadesDe(rol)` no contiene
   `clinico.leer` ni `clinico.escribir` (aceptación de E0-06 en capacidades).
8. **NUEVO — ninguna ampliación alcanza a un usuario real:** para cada ruta migrada,
   `rolesCon(cap) \ rolesHoy ⊆ (ROLES \ ROLES_ASIGNABLES)`. Es el invariante que hace
   segura la Fase B con la matriz completa de 8 roles.

### 5.2 `src/__tests__/authz-rutas-declaradas.test.ts` (GUARDIÁN — es el criterio de aceptación)
Molde: `api-authz-guard.test.ts` (incluida su limpieza de comentarios, obligatoria aquí:
sin ella los comentarios de `telesalud/token` y `fhir/paciente` producen 2 falsos
positivos — §0.8).
1. **Toda** ruta `src/app/api/**/route.ts` en disco tiene entrada en `REGISTRO_RUTAS`.
   Una ruta nueva sin declarar **rompe los tests**.
2. No hay entradas zombis (toda clave del registro existe en disco).
3. **Cero llamadas a `verificarMiembro` / `verificarMedico` bajo `src/app/api`** (sobre
   el código sin comentarios). Prueba textual de «no hay any-member implícito».
   *Depende de §3.0: este assert y el `api-authz-guard.test.ts` de hoy no pueden
   coexistir.*
4. Toda exención (`publica`/`webhook`/`cron`/`sesion`/`tokenPaciente`/`porAccion`) tiene
   `motivo` no vacío.
5. Toda ruta declarada `capacidad`/`porMetodo` contiene realmente `verificarCapacidad(`
   en su fuente: **el registro no puede mentir sobre el código.**
6. **Autocomprobación del walker:** `expect(rutasEnDisco.length).toBe(74)` (o
   `>= 70` si se prefiere tolerar crecimiento) — un guardián que no encuentra archivos
   pasa vacío y no protege nada.
7. Las 15 rutas sin guardia de §1.2 están declaradas **exactamente** como
   `publica`/`webhook`/`cron`/`tokenPaciente`; si alguien añade una 16.ª, falla.

### 5.3 `src/__tests__/nucleo/autorizacion-servidor.test.ts` (extender, no reescribir)
`verificarCapacidad`: 401 sin token · 400 sin `clinicId` · 403 cross-tenant **con rol
`admin` de OTRA clínica** (el caso que más engaña) · 403 rol sin la capacidad · 403 con
`role: undefined` en el doc de membresía · 500 fail-closed si Firestore revienta · ok
con rol que sí la tiene.
`verificarModuloYCapacidad`: módulo sin entitlement → 403 · `MODULOS_OPT_IN` con
Firestore caído → **503** · módulo de consulta con Firestore caído → **pasa** (fail-OPEN
de §2.2) y **no** se convierte en 403 por falta de rol · entitlement ok + rol sin la
capacidad → 403.

### 5.4 `src/__tests__/telesalud-sala-or.test.ts`
El OR de §4 ⚠⚠: token válido + rol sin capacidad → **entra**; sin token y sin capacidad
→ **404**, nunca 403; token de OTRA cita → 404; y el token se evalúa antes de leer la
membresía.

### 5.5 `api-authz-guard.test.ts` reescrito (§3.0)
Con los 2 controles negativos de §3.0.3 documentados en `RESULTADO.json`.

### 5.6 Verificación destructiva obligatoria en `RESULTADO.json`
- Borrar `'firmar'` de `medico` en la matriz → §5.1.4 rojo.
- Añadir `src/app/api/prueba-guardian/route.ts` vacío → §5.2.1 rojo; borrarlo → verde.
- Sustituir `verificarCapacidad` por `verificarMiembro` en una ruta → §5.2.3 y §5.2.5 rojo.
- Dar `clinico.leer` a `secretaria` → §5.1.7 rojo (puente con E0-06).
Sin estas cuatro, el guardián puede estar pasando por vacío.

---

## 6. Archivos que se tocan

**Nuevos (5-6):**
- `src/lib/authz/capabilities.ts` — núcleo puro (entregable literal del backlog).
- `src/lib/authz/verificar.ts` — `verificarCapacidad`, `verificarModuloYCapacidad`, `exigeCapacidad`.
- `src/lib/authz/registro-rutas.ts` — declaración de las 74 rutas.
- `src/__tests__/authz-capabilities.test.ts`, `src/__tests__/authz-rutas-declaradas.test.ts`.
- `src/__tests__/telesalud-sala-or.test.ts` (si se ejecuta la Fase C).

**Modificados:**
- `src/__tests__/api-authz-guard.test.ts` — **reescritura obligatoria (§3.0).** Único
  test existente que este diseño autoriza a tocar, y sólo porque su implementación
  quedó obsoleta; sus propiedades se conservan una por una.
- `src/lib/auth-server.ts` — `verificarMiembro` y `verificarMedico` se marcan
  `@internal` y quedan para uso exclusivo de `src/lib/authz/`. `verificarUsuario`,
  `verificarModuloIA` y el tipo `Acceso` no cambian.
- `src/lib/permissions.ts` — pasa a derivar de la matriz (misma firma pública).
- `src/types/index.ts:52` — `ClinicMember.role` pasa a `Rol` importado de
  `matriz-acceso.ts` (**ampliación de tipo**: 6 → 8 valores; no rompe ningún literal
  existente). Cierra la 1.ª de las tres uniones de §1.4.
- `src/lib/authz/matriz-acceso.ts` — **sólo si hace falta** un `export` extra. No se
  reordena ni reclasifica nada: sus tests son de E0-06.
- Fase B: 16 archivos de ruta. Fase C: 15 de `verificarMiembro` + 16 de IA.

**NO se tocan:** `firestore.rules`, `storage.rules`, impresión/PDF/Word, firma de nota,
flujo de cobro del cliente, ningún motor clínico, ningún componente de UI,
`matriz-acceso.test.ts`, `firestore-rules-guard.test.ts`, `portal-alcance.test.ts`.

---

## 7. Preguntas al médico dueño (política de acceso — NO es criterio clínico)

Ninguna es una regla clínica, un umbral ni una dosis: son decisiones de **quién puede
hacer qué en su consultorio**, y sólo él las puede responder. Bloquean la **Fase C**,
no la A ni la B.

- **Q1 — UCI y enfermería.** ¿La enfermería de UCI usa `uci/copilot` y el dictado del
  expediente, o sólo el médico? Si sólo el médico, `clinico.escribir = {medico, admin}`
  y el hueco de §1.5 se cierra en este lote.
- **Q2 — Roles fantasma.** `recepcion` y `facturacion` existen en `permissions.ts` y en
  la matriz de E0-06, pero **no son asignables** (§1.4). ¿Se activan o se borran?
  E0-06 quedó en `necesita_validacion` en parte por esto.
- **Q3 — Directorio del equipo.** ¿Enfermería/farmacia/laboratorio deben poder listar
  los correos del equipo (`clinic/miembros`)? **Hoy pueden.**
- **Q4 — Cobro y CFDI.** ¿La asistente (`secretaria`) descarga CFDI, o sólo cobra?
  Determina la fila `facturar` y con ella la ampliación teórica de §3.1.
- **Q5 — Un solo médico.** En un consultorio de un médico, `medico` conserva
  `administrar` (Stripe, llaves de IA, WhatsApp). ¿Correcto, o `admin` debería ser el
  único que toca la suscripción?

---

## 8. Riesgo de regresión REAL

| Fase | Contenido | Riesgo | Por qué |
|---|---|:-:|---|
| **A** | `capabilities.ts` + `verificar.ts` + `registro-rutas.ts` + tests + `permissions.ts` derivado | **bajo** | aditivo puro; `permissions.ts` tiene 0 consumidores en producción |
| **A′** | reescritura de `api-authz-guard.test.ts` (§3.0) | **medio** | no toca producción, pero **puede degradar un guardián de PHI vivo**. Mitigación: los 2 controles negativos de §3.0.3 son obligatorios |
| **B** | 18 llamadas `verificarMedico` → `verificarCapacidad` | **bajo** | equivalencia de conjuntos demostrada por §5.1.4 y §5.1.8; mismos códigos y textos HTTP |
| **C** | 15 `verificarMiembro` + 16 IA | **medio-alto** | **estrecha acceso a usuarios reales.** Un 403 nuevo en `appointments` deja a alguien sin poder agendar y se lee como «la app se rompió» |

Riesgos concretos que la Fase C debe respetar (todos vistos en el código, ninguno
hipotético):
1. **`telesalud/sala`** — romper el OR, invertir el orden o cambiar el 404 por 403
   reabre una fuga de existencia ya cerrada (§4 ⚠⚠).
2. **`hospital/mutar`** — 18 acciones con roles finos; cualquier deriva rompe el pase
   de visita de enfermería o la verificación de farmacia.
3. **`auditoria/registrar`** — si se estrecha, se pierden entradas de bitácora **en
   silencio** (el cliente no muestra el fallo): daño invisible sobre NOM-024.
4. **`whatsapp/waitlist-notify`** — atado al bot y a la lista de espera; un 403 aquí
   corta confirmaciones de cita.
5. **`stripe/*`** — cobros. Cualquier estrechamiento que alcance al dueño le impide
   pagar su propia suscripción.
6. **IA + fail-OPEN** — evaluar la capacidad en el camino fail-OPEN de
   `verificarModuloIA` tumba la IA a **todos** ante un fallo transitorio de Firestore
   (§2.2). Es el modo de fallo más fácil de introducir sin notarlo.

**Recomendación (regla 5 de la carta operativa):** ejecutar **A + A′ + B**, y de la
Fase C **sólo las 4 rutas donde no se pierde acceso a nadie** (`hospital/mutar`,
`hospital/alerta`, `auditoria/registrar`, `telesalud/sala`). Con eso la aceptación se
cumple: tras B ninguna ruta usa `verificarMedico`, las 74 quedan declaradas en el
registro, y el guardián de §5.2 impide que aparezca una nueva sin declarar. Las 11
filas de §4 que sí estrechan y las 16 de IA se escriben en el registro **con su
capacidad definitiva** y se activan tras Q1–Q5. Mientras tanto **no son any-member
implícito**: están declaradas, con capacidad y con la activación pendiente anotada por
escrito.

---

## 9. Dependencia E0-06: satisfecha en lo que importa, con dos hilos abiertos

E0-06 aterrizó (`4fcd88b`) con estado `necesita_validacion`: **Fase A completa** (matriz
ejecutable, subdocumento `clinico` en las reglas, cierre del bypass de alcance del
portal), Fases B y C diferidas por decisión del dueño (D1/D2/D3).

Para E0-07 eso es suficiente y además **favorable**: la unión canónica de roles y
`rolesDe()` ya existen, así que E0-07 no crea una lista más, sino que **cierra** la de
`types/index.ts` (§6). Quedan dos hilos:

- **Q2 (`recepcion`/`facturacion` no asignables)** sigue abierto en ambas unidades. No
  bloquea las fases A/A′/B gracias al invariante de §5.1.8.
- El acoplamiento va **en la dirección contraria a la declarada** en el backlog: E0-06
  necesitaba de E0-07 la unión canónica de roles, y la resolvió por su cuenta creando
  `matriz-acceso.ts`. Nota para el orquestador: la fuente de verdad de **roles** es
  `matriz-acceso.ts`; la de **capacidades** será `capabilities.ts`; ninguna unidad
  posterior debería declarar una cuarta lista de roles.

---

## 10. Gates a correr en la implementación

`npx tsc --noEmit` · `npx vitest run src/__tests__/` · `npm run build`.
Nada de servidores ni `--watch`. Sin despliegue. Sin `git push`.
