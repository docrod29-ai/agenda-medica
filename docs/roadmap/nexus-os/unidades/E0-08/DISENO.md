# E0-08 — Firebase Emulator + matriz multi-tenant (DISEÑO)

> **Unidad:** E0-08 · etapa E0 · riesgo declarado **medio** · `validacionClinica: false`
> **Objetivo (backlog):** «Suite que prueba aislamiento entre clínicas contra el emulador real, no contra mocks.»
> **Aceptación (backlog):** «Cross-tenant leakage = 0 **demostrado**, no asumido.»
> **Depende de:** E0-06 (entregó la matriz de acceso ejecutable — esta unidad la consume como tabla de casos).
> **Estado:** DISEÑO. No se implementó nada. No se instaló ninguna dependencia.

---

## 1. Qué existe ya (no construir de cero)

| Pieza | Dónde | Qué cubre hoy |
|---|---|---|
| Reglas reales | `firestore.rules` (682 líneas, 45 bloques `match`) | La autorización de producción. `isMember/isAdmin/isMedico/isClinicoHospital/isLabStaff` en `firestore.rules:6-49`; default-deny en el `match /{document=**}` final |
| **Matriz de acceso ejecutable** | `src/lib/authz/matriz-acceso.ts:100-416` | 45 recursos clasificados (`clase`, `guardaLectura`, `guardaEscritura`, `porQue`) + helpers `puedeLeer()` / `puedeEscribir()` / `normalizarRuta()` / `rolesDe()` (`:419-449`) |
| Guardián **estático** de reglas | `src/__tests__/firestore-rules-guard.test.ts` (119 líneas) | Comprueba por *texto* que el aislamiento existe: `expect(sinComentarios).toMatch(/memberClinicId\(\)\s*==\s*clinicId/)` (`:22-25`), default-deny (`:17-20`), inmutabilidad de nota firmada, `audit_log` append-only, `secretos` cerrados |
| Coherencia matriz ↔ reglas | `src/__tests__/matriz-acceso.test.ts` (193 líneas) | Que cada `match` de las reglas tiene entrada en la matriz y que cada guarda nombrada existe como `function` |
| CI | `.github/workflows/ci.yml` | 2 jobs: `clinical-safety` (rápido, *required status check*) y `verificar` (tsc + vitest + build) |

**El hueco exacto de esta unidad, dicho sin adornos:** todo lo anterior es **análisis de texto**. `firestore-rules-guard.test.ts` verifica que la *cadena* `memberClinicId() == clinicId` está escrita en el archivo; **no** verifica que el motor de Firestore niegue una lectura cross-tenant. Un cambio que deje esa cadena intacta pero rompa el aislamiento —un `match` nuevo mal anidado, un `||` mal puesto, un `get()` que resuelve a otra clínica— pasa hoy en verde. Eso es precisamente el «asumido» que la aceptación prohíbe.

**Confirmado por `grep`: en el repo NO hay emulador.** `firebase.json` solo declara `rules` (sin bloque `emulators`); `package.json` no tiene `firebase-tools` ni `@firebase/rules-unit-testing`; `node_modules/@firebase/` no contiene `rules-unit-testing`; `node_modules/.bin` no tiene `firebase`. Lo dejó dicho E0-09 en su propio diseño (`docs/roadmap/nexus-os/unidades/E0-09/DISENO.md:225,273`): «la aceptación conductual sigue siendo de E0-08».

---

## 2. Restricción DURA del entorno: no hay Java en esta máquina

```
$ java -version
The operation couldn’t be completed. Unable to locate a Java Runtime.
```

El emulador de Firestore es un JAR: **sin JRE no arranca**. Consecuencias que el diseño asume y no esconde:

1. La suite **no se puede ejecutar en este entorno**. Se escribe y se pone en CI (los runners `ubuntu-latest` traen Java 17/21; aun así el job lo fija con `actions/setup-java` para que no dependa de la imagen).
2. La palabra **«demostrado»** de la aceptación **no la puede firmar el agente que implemente esta unidad desde aquí**. Se cumple cuando la suite corre verde *y sus controles negativos rojos* en algún sitio con JRE (CI o la máquina del Dr. con `brew install --cask temurin`).
3. Por eso la unidad de implementación debe entregar `estado: "parcial"` si no puede exhibir una corrida real. **Escribir «cross-tenant leakage = 0 demostrado» con la suite nunca ejecutada sería exactamente la falla que la aceptación quiere impedir.** Queda como criterio de cierre en §7.
4. `npm run test:emulador` **no se agrega a los tres gates** (`tsc --noEmit`, `vitest run src/__tests__/`, `npm run build`). Los gates deben seguir corriendo en máquinas sin Java.

---

## 3. Riesgo #1 y cómo se cierra: no contaminar el gate compartido

`vitest.config.ts:7` tiene `include: ['src/__tests__/**/*.test.ts']`. **Si los specs del emulador se ponen ahí, `npx vitest run src/__tests__/` —gate de TODA la corrida del programa— se pone rojo en cualquier máquina sin emulador levantado, y tumba el lote entero de todas las demás unidades.** Es el riesgo más caro de esta unidad y es de infraestructura, no de reglas.

Cierre en tres capas:

1. Los specs viven **fuera** de `src/__tests__/`, en `emulator/`, con sufijo propio `*.emu.test.ts`.
2. `vitest.config.ts` gana un `exclude` explícito (cinturón además de tirantes) — el `include` ya los deja fuera, pero un `include` más laxo en el futuro no debe arrastrarlos.
3. Un test **estático** nuevo, dentro del gate normal, afirma esas dos cosas: si alguien mueve un `.emu.test.ts` a `src/__tests__/` o borra el `exclude`, se pone rojo *antes* de romper la corrida ajena.

Nota de `tsconfig.json`: `include: ["**/*.ts"]` con `exclude: ["node_modules","scripts"]` → **el directorio `emulator/` SÍ entra a `npx tsc --noEmit`**. Por eso las dependencias tienen que ser `devDependencies` reales en `package.json` + `package-lock.json`; resolverlas con `npx --yes` en tiempo de CI dejaría el typecheck rojo. Es la razón técnica de la decisión de §5.

---

## 4. Archivos que se tocan

### Nuevos

| Archivo | Por qué |
|---|---|
| `emulator/casos-tenant.ts` | **Generador** de la matriz tenant×rol×colección **derivada de `MATRIZ_ACCESO`**. No una lista a mano: una lista a mano se queda vieja en cuanto alguien añade un `match` (el problema que E0-06 ya resolvió para el .md) |
| `emulator/entorno.ts` | Arranque de `initializeTestEnvironment`, siembra con `withSecurityRulesDisabled`, helpers `contextoDe(rol, tenant)` |
| `emulator/tenant-aislamiento.emu.test.ts` | Afirmación A (aislamiento) + B (control positivo). El corazón de la unidad |
| `emulator/reglas-cargan.emu.test.ts` | Humo: las reglas **compilan** en el motor real. Un error de sintaxis debe ser rojo, no un skip silencioso |
| `src/__tests__/emulador-config-guard.test.ts` | Guardián estático, corre en el gate normal (§6, tests 4-8) |
| `docs/testing/emulador-multitenant.md` | Cómo correrlo, por qué hace falta Java, qué NO cubre |

### Modificados

| Archivo | Cambio | Riesgo |
|---|---|---|
| `firebase.json` | Añadir bloque `emulators` (firestore `8080`, `singleProjectMode: true`, UI off) | **Nulo en producción.** `firebase.json` solo se lee al desplegar reglas o al levantar emuladores; Vercel no lo mira. Aditivo: no toca las claves `firestore.rules` / `storage.rules` |
| `package.json` | 2 devDependencies pinneadas + script `test:emulador` | Ver §5 |
| `vitest.config.ts` | `exclude: ['emulator/**']` | Bajo, pero es el archivo del gate compartido: cambio de una línea, y el guardián estático lo vigila |
| `.github/workflows/ci.yml` | Job **nuevo** `aislamiento-tenant` | Job separado a propósito: no se mete en `verificar` ni en `clinical-safety`. Si el emulador falla por flakiness de red/Java, no debe teñir de rojo el gate clínico que es *required status check* |

**`firestore.rules` NO se toca.** Esta unidad *mide*, no cambia política. Si la suite descubre una fuga real, el arreglo es otra unidad con su propia decisión — no un parche a ciegas dentro de la que estaba midiendo.

---

## 5. Contrato

### 5.1 Dependencias (pin exacto, sin `^`)

```jsonc
"devDependencies": {
  "@firebase/rules-unit-testing": "5.0.0",   // API oficial: assertFails/assertSucceeds
  "firebase-tools": "14.x.y"                 // solo por `firebase emulators:exec`
}
```

**Costo declarado:** `firebase-tools` es grande (centenares de dependencias transitivas) y **alarga `npm ci` en los dos jobs de CI que hoy existen**, aunque no lo usen. Alternativas consideradas y por qué no:
- `npx --yes firebase-tools@X` dentro del job: no queda en el lockfile → no reproducible (regla 4: reproducibilidad > rendimiento) **y deja `npx tsc --noEmit` rojo** por lo de §3.
- `setup-firebase-emulator` de terceros: dependencia de un tercero no auditado en la ruta de un gate de seguridad. No.

Se acepta el costo de `npm ci`; el `cache: npm` ya configurado en los dos jobs lo amortigua.

### 5.2 `firebase.json` (aditivo)

```jsonc
{
  "firestore": { "rules": "firestore.rules" },
  "storage":   { "rules": "storage.rules" },
  "emulators": {
    "firestore": { "port": 8080 },
    "ui": { "enabled": false },
    "singleProjectMode": true
  }
}
```

### 5.3 Script y comando (NO lo ejecuta el agente que diseña, ni el que implemente si no tiene JRE)

```jsonc
"test:emulador": "firebase emulators:exec --only firestore --project demo-nexusmed-test \"vitest run --config vitest.emulator.config.ts\""
```

Dos detalles deliberados:
- **`emulators:exec` TERMINA solo** (levanta → corre → mata → propaga el código de salida). Cumple la regla 8: no es un servidor colgado. `emulators:start` está **prohibido** en este repo.
- **`--project demo-nexusmed-test`**: el prefijo `demo-` hace que el SDK y las herramientas **rechacen contactar un proyecto real** y no pidan credenciales. Es el candado contra que una corrida de tests toque los datos del Dr.

`vitest.emulator.config.ts`: `environment: 'node'`, `include: ['emulator/**/*.emu.test.ts']`, `fileParallelism: false` (un solo emulador compartido; paralelizar ficheros contra un mismo `projectId` produce carreras de siembra → flakiness, y un test de seguridad flaky se acaba desactivando), `testTimeout: 20_000`, sin `setupFiles` (los stubs de `src/__tests__/setup.ts` son para el SDK cliente de la app; aquí no aplican).

### 5.4 Tipos del generador de casos

```ts
// emulator/casos-tenant.ts
import { MATRIZ_ACCESO, ROLES, puedeLeer, puedeEscribir, type Rol, type Guarda } from '@/lib/authz/matriz-acceso'

/** Los dos inquilinos sintéticos. Nunca datos reales (regla 2). */
export const TENANT_A = 'clinica-alfa'
export const TENANT_B = 'clinica-beta'

export type Operacion = 'read' | 'write'
export type Esperado = 'permitido' | 'denegado'

export interface CasoTenant {
  /** Ruta CONCRETA ya instanciada (comodines → ids sintéticos fijos). */
  readonly ruta: string
  /** Ruta con comodines, tal cual en MATRIZ_ACCESO (para el mensaje de error). */
  readonly plantilla: string
  readonly tenantDelRecurso: typeof TENANT_A | typeof TENANT_B
  /** Clínica a la que pertenece el usuario que intenta la operación. */
  readonly tenantDelUsuario: typeof TENANT_A | typeof TENANT_B
  readonly rol: Rol
  readonly operacion: Operacion
  readonly esperado: Esperado
  /** true cuando tenantDelUsuario !== tenantDelRecurso. */
  readonly esCrossTenant: boolean
  /** Guarda declarada en la matriz. Se imprime en el fallo. */
  readonly guarda: Guarda
}

/** Instancia los comodines de una plantilla con ids sintéticos deterministas. */
export function instanciar(plantilla: string, clinicId: string, uid: string): string

/**
 * Recursos que la matriz declara `publico` — los ÚNICOS donde un acceso
 * cross-tenant NO es una fuga. Se DERIVA de MATRIZ_ACCESO, no se escribe a mano:
 * así nadie puede añadir una excepción tocando un solo archivo.
 */
export function rutasPublicas(op: Operacion): readonly string[]

/** El producto cartesiano completo. Puro y determinista: sin red, sin Firebase. */
export function generarCasos(): readonly CasoTenant[]
```

Reglas de `esperado` en el generador — **esta es la lógica que hay que revisar con lupa**:

| Situación | `esperado` | Fuente |
|---|---|---|
| Cross-tenant, guarda ≠ `publico` | `denegado` | **La aceptación de la unidad.** No se consulta la matriz: la respuesta correcta es siempre negar |
| Cross-tenant, guarda `publico` | `permitido` | Excepción explícita y enumerada: `reviews/{reviewId}` (read), `clinic_review_requests/{token}`, `clinic_invitations/{code}`, `arco_requests` (write) |
| Mismo tenant | `puedeLeer(rol, ruta)` / `puedeEscribir(rol, ruta)` | La matriz de E0-06 |

Volumen: 39 recursos bajo `clinics/{clinicId}/…` × 8 roles × 2 operaciones × (propio + ajeno) ≈ **1 250 casos**. Con `fileParallelism: false` y un solo `RulesTestEnvironment` reutilizado, es del orden de un minuto — aceptable para un job aparte, inaceptable dentro del gate rápido (otra razón de §3).

Los 6 recursos de raíz (`clinic_members/{uid}`, `clinic_invitations/{code}`, `clinic_review_requests/{token}`, `googleTokens/{uid}`, `platform_*`, `{document=**}`) **no tienen `clinicId` en la ruta**: su aislamiento no es posicional sino por contenido (`resource.data.clinicId`, `firestore.rules:618-630`). Van en un bloque de casos escrito a mano, corto y explícito — con el caso que más importa: **un miembro de A hace `get` de `clinic_members/{uid-de-B}` → debe negar**, y `list` de `clinic_members` → debe negar (enumeración del directorio, `firestore.rules:630`).

### 5.5 Siembra (`emulator/entorno.ts`)

```ts
export async function abrirEntorno(): Promise<RulesTestEnvironment>
/** uid determinista: `u-${tenant}-${rol}`. */
export function uidDe(tenant: string, rol: Rol): string
export function contextoDe(env: RulesTestEnvironment, tenant: string, rol: Rol): RulesTestContext
export async function sembrar(env: RulesTestEnvironment): Promise<void>
```

`sembrar()` corre dentro de `withSecurityRulesDisabled` y escribe, para **cada** tenant:

1. `clinic_members/{uidDe(t, rol)} = { clinicId: t, role: rol }` para los 8 roles.
   Sobre los 8: `clinic_members.role` en producción solo admite `admin|medico|secretaria|enfermeria|farmacia|laboratorio`; `recepcion` y `facturacion` solo existen en `src/lib/permissions.ts`. Se siembran igual — Firestore no valida el enum y la matriz de E0-06 los evalúa a propósito (`matriz-acceso.ts:24-33`). Probar 8 es estrictamente más fuerte que probar 6.
2. `clinics/{t} = { ownerId, status: 'active', paseLibre: false }`.
   **Obligatorio, no cosmético:** `clinicaPuedeEscribir()` (`firestore.rules:83-86`) hace `get()` del doc de la clínica. Si no existe, la evaluación de la regla revienta y **todo `write` sale denegado por la razón equivocada** — la Afirmación A pasaría en verde sin haber probado nada. Es el modo de falso-verde más probable de esta suite y por eso el control positivo de §5.6 es obligatorio.
3. Un documento en cada ruta destino (ambos tenants), para que `read` tenga `resource` y las reglas que dereferencian `resource.data` no fallen por ausencia.

### 5.6 Las dos afirmaciones del spec

**Afirmación A — aislamiento (ES la aceptación).**
Para todo caso con `esCrossTenant && guarda !== 'publico'`: `assertFails(...)`. Vale para `read` y para `write`, y es **inmune al contenido del payload**: un `deny` es un `deny` sea el payload válido o no. Aquí no hay ambigüedad posible.

**Afirmación B — control positivo (impide el falso verde).**
Sin B, la Afirmación A pasaría verde con unas reglas que niegan absolutamente todo (typo, `match` mal cerrado, clínica sin sembrar). B usa una **lista curada** de ~8 rutas representativas —una por guarda: `appointments` (isMember), `patients/{id}/notas` (isMedico), `internamientos/{id}/signos` (isClinicoHospital), `laboratorio` (isLabStaff), `clinics` (isAdmin), `secretos` (servidor), `reviews` (publico), `patients/{id}/clinico` (el bloque nuevo de E0-06)— con payloads **válidos y escritos a mano**, y afirma para cada una: el rol que satisface la guarda **en su propio tenant** → `assertSucceeds`; un rol que no la satisface → `assertFails`.

**Por qué B es curada y no generada:** varias reglas tienen condiciones **por campo**, no solo por rol (`clinics` update congela `plan/status/...`, `firestore.rules:118+`; nota firmada inmutable; `audit_log create: if false`; `clinics create` exige `status:'trial'` con reloj ≤15 días). Un `set()` genérico sobre las 39 rutas produciría rojos por payload inválido, no por autorización — ruido que acaba con la suite desactivada. Verificar esas condiciones de campo es trabajo de **E0-09** (política por campo), no de E0-08 (aislamiento). Está dicho aquí para que nadie lea la suite y crea que cubre más de lo que cubre.

---

## 6. Qué tests lo prueban

**En `emulator/` (job aparte, requiere JRE):**

1. `tenant-aislamiento.emu.test.ts` → Afirmación A sobre los ~1 250 casos generados + el bloque de raíz de §5.4.
2. `tenant-aislamiento.emu.test.ts` → Afirmación B (control positivo, ~16 aserciones).
3. `reglas-cargan.emu.test.ts` → el motor real compila `firestore.rules` (humo anti-skip).

**En `src/__tests__/emulador-config-guard.test.ts` (gate normal, sin JRE, sin red):**

4. `vitest.config.ts` excluye `emulator/**` y su `include` no alcanza los `.emu.test.ts` → protege el gate compartido (§3).
5. No existe ningún `*.emu.test.ts` dentro de `src/__tests__/`.
6. `firebase.json` declara el bloque `emulators` con `singleProjectMode: true`, y **sigue** declarando `firestore.rules` y `storage.rules` (regresión: que nadie reescriba el archivo y se lleve el deploy de reglas).
7. `package.json` tiene `test:emulador`, el comando usa `emulators:exec` (**nunca** `emulators:start` — regla 8) y un `--project demo-*`.
8. **Anti-encogimiento:** `generarCasos()` cubre **el 100 %** de las entradas de `MATRIZ_ACCESO` cuya ruta empieza por `clinics/{clinicId}/`, y `rutasPublicas()` es **exactamente** el conjunto de entradas con guarda `publico`. Si alguien añade un `match` nuevo y no aparece en los casos, o mete una excepción «pública» a mano, se pone rojo en el gate rápido. Este test es el que impide que la suite se vacíe con el tiempo.
9. `.github/workflows/ci.yml` contiene el job `aislamiento-tenant` y **no** metió `test:emulador` dentro de `clinical-safety` ni de `verificar`.

**Controles negativos que la unidad de implementación DEBE ejecutar y transcribir** (la costumbre de este repo: probar que los gates no pasan por vacío):

- Cambiar `isMember` a `return isAuth();` → la Afirmación A debe ponerse roja en decenas de casos. *Restaurar.*
- Borrar el `match /{document=**}` de default-deny → rojo. *Restaurar.*
- No sembrar `clinics/{t}` → **B** roja (A seguiría verde: es la demostración de por qué B existe). *Restaurar.*
- Añadir una entrada a `MATRIZ_ACCESO` sin tocar el generador → test 8 rojo. *Restaurar.*

---

## 7. Criterio de cierre honesto

| Condición | Cómo se comprueba |
|---|---|
| Los 3 gates verdes (`tsc --noEmit`, `vitest run src/__tests__/`, `npm run build`) | En esta máquina. Obligatorio: la unidad no debe romper nada |
| Tests 4-9 verdes | En el gate normal, sin JRE |
| Afirmaciones A y B verdes **en una corrida real del emulador** | CI (job nuevo) o máquina con JRE |
| Los 4 controles negativos rojos y restaurados | Igual que arriba |

**Si las dos últimas filas no se pueden exhibir, la unidad se cierra `estado: "parcial"`** con la aceptación marcada `cumplida: false` y la razón «suite escrita y en CI; falta la primera corrida verde con controles negativos — no hay JRE en el entorno del agente». Precedente en este mismo programa: E0-06 hizo exactamente eso (`RESULTADO.json`, `porQueNecesitaValidacion`).

---

## 8. Riesgo de regresión sobre producción

| Riesgo | Nivel | Realidad |
|---|---|---|
| Romper el gate compartido `vitest run src/__tests__/` y tumbar el lote de otras unidades | **ALTO si se implementa mal** → bajo con §3 | Es el riesgo #1 y es de infraestructura. Tres capas de cierre + test 4/5 |
| `firebase.json` mal editado → `firebase deploy --only firestore:rules` deja de encontrar las reglas | Medio → bajo | Cambio aditivo + test 6 lo fija |
| `npm ci` más lento en los dos jobs existentes | Bajo, aceptado | Costo declarado en §5.1 |
| Tocar `firestore.rules` | **Nulo** | La unidad no lo modifica (§4) |
| PHI | **Nulo** | Dos tenants sintéticos, `--project demo-*` que no puede contactar un proyecto real, emulador en memoria |
| Suite flaky que acabe desactivada | Medio | `fileParallelism: false`, un solo entorno reutilizado, job separado del *required status check* |
| Descubrir una fuga real | — | **No se parchea aquí.** Se reporta con caso reproducible y se abre unidad propia. Un arreglo improvisado dentro de la unidad que mide es cómo se rompen las reglas de producción |

## 9. Fuera de alcance (nombrado, no escondido)

- **`storage.rules`** — el aislamiento del Storage necesita el emulador de Storage y su propia matriz de rutas. No está en los entregables de E0-08 (que hablan de «colección»). Queda como candidato de seguimiento.
- **Rutas de API / Admin SDK** — el Admin SDK **ignora** las reglas por diseño; su autorización ya la cubre `src/__tests__/api-authz-guard.test.ts` (E0-06). Esta suite no dice nada sobre ellas, y decir lo contrario sería mentir sobre la cobertura.
- **Política por campo** (inmutabilidad de nota firmada, congelado de facturación) — es E0-09.
- **App Check** — no participa en la evaluación de reglas del emulador.

## 10. Decisiones pendientes

- **Clínicas: ninguna.** `necesitaValidacionClinica: false`, igual que declara el backlog. No hay umbral, dosis ni tabla de resistencias en juego: es aislamiento de datos.
- **Operativa, para el médico dueño (no bloquea el diseño; sí bloquea la palabra «demostrado» si se contesta que no):**
  1. ¿Se acepta que el CI gane un job de ~2-3 min y que `npm ci` se alargue por `firebase-tools`?
  2. ¿Se instala un JRE en la máquina de trabajo (`brew install --cask temurin`) para poder correr la suite localmente, o el aislamiento se demuestra solo en CI?
