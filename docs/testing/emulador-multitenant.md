# Suite de aislamiento multi-tenant contra el emulador de Firestore

> Unidad Nexus OS **E0-08**. Consume la matriz de acceso de **E0-06**
> (`src/lib/authz/matriz-acceso.ts`) como tabla de casos.

## Qué prueba, y por qué no bastaba lo que ya había

`src/__tests__/firestore-rules-guard.test.ts` y `src/__tests__/matriz-acceso.test.ts`
son **análisis de texto**: comprueban que la cadena `memberClinicId() == clinicId`
está escrita en `firestore.rules` y que cada `match` tiene entrada en la matriz. Eso
no verifica que el **motor** de Firestore niegue una lectura cross-tenant. Un cambio
que deje esa cadena intacta pero rompa el aislamiento —un `match` nuevo mal anidado,
un `||` mal puesto, un `get()` que resuelve a otra clínica— pasa en verde.

Esta suite pregunta al motor real. Es la diferencia entre **demostrado** y **asumido**.

Dos afirmaciones:

| | Qué afirma | Por qué existe |
|---|---|---|
| **A** Aislamiento | Todo acceso cross-tenant a un recurso no público se **deniega** (lectura y escritura, los 8 roles, las dos direcciones A→B y B→A) | Es la aceptación de la unidad |
| **B** Control positivo | En su propia clínica, el rol que satisface la guarda **sí** puede, y el que no, **no** | Sin B, A pasaría verde con unas reglas que niegan absolutamente todo (un typo, un `match` mal cerrado, la clínica sin sembrar) |

## Cómo se corre

```bash
npm run test:emulador
```

Eso es `firebase emulators:exec --only firestore --project demo-nexusmed-test "vitest run --config vitest.emulator.config.ts"`.

- **`emulators:exec` TERMINA solo** (levanta → corre → mata → propaga el código de
  salida). `emulators:start` está **prohibido** en este repo: deja un servidor vivo y
  cuelga la corrida.
- **`--project demo-nexusmed-test`**: el prefijo `demo-` hace que el SDK y las
  herramientas **se nieguen a contactar un proyecto real** y no pidan credenciales.
  Es el candado para que una corrida de pruebas no pueda tocar datos de un
  consultorio. Los dos inquilinos (`clinica-alfa`, `clinica-beta`) y todos los ids son
  sintéticos: **aquí no hay ni puede haber PHI**.

### Hace falta Java

El emulador de Firestore es un JAR. Sin JRE no arranca:

```
$ java -version
Unable to locate a Java Runtime.
```

En macOS: `brew install --cask temurin`. En el CI lo provisiona el job
`aislamiento-tenant` con `actions/setup-java` (Temurin 21), fijado a propósito para
que el job no dependa de lo que traiga la imagen del runner.

**La máquina del agente que implementó esta unidad no tiene JRE**, así que la suite se
entregó escrita y en CI pero **sin una primera corrida verde**. Ver
`docs/roadmap/nexus-os/unidades/E0-08/RESULTADO.json`.

## Por qué vive fuera de `src/__tests__/`

`vitest.config.ts` es la config del **gate compartido** del programa
(`npx vitest run src/__tests__/`), que corre en máquinas sin Java. Si los specs del
emulador entraran ahí, ese gate se pondría rojo en cualquier máquina sin emulador
levantado y **tumbaría el lote de todas las demás unidades**. Tres capas de cierre:

1. Los specs viven en `emulator/` con sufijo propio `*.emu.test.ts`.
2. `vitest.config.ts` tiene `exclude: [..., 'emulator/**']` (cinturón además de
   tirantes: el `include` ya los deja fuera).
3. `src/__tests__/emulador-config-guard.test.ts` corre en el gate normal y **afirma
   esas dos cosas**, más que el comando use `emulators:exec`, que el CI tenga el job
   aparte, y que los casos sigan derivándose de la matriz. Si alguien mueve un
   `.emu.test.ts` a `src/__tests__/` o borra el `exclude`, se pone rojo **antes** de
   romper la corrida ajena.

`emulator/` **sí** entra a `npx tsc --noEmit` (`tsconfig.json` incluye `**/*.ts`).
Por eso `@firebase/rules-unit-testing` y `firebase-tools` son devDependencies reales y
pinneadas en `package.json` + `package-lock.json`: resolverlas con `npx --yes` en
tiempo de CI dejaría el typecheck rojo y la corrida sin reproducibilidad.

## Los archivos

| Archivo | Qué es |
|---|---|
| `emulator/casos-tenant.ts` | **Generador puro** de los casos tenant×rol×colección, derivado de `MATRIZ_ACCESO`. Sin Firebase, sin red |
| `emulator/entorno.ts` | Arranque del entorno + siembra sintética de los dos inquilinos |
| `emulator/tenant-aislamiento.emu.test.ts` | Afirmaciones A y B |
| `emulator/reglas-cargan.emu.test.ts` | Humo: `firestore.rules` compila en el motor real (anti-skip silencioso) |
| `vitest.emulator.config.ts` | Config aparte, `fileParallelism: false` |
| `src/__tests__/emulador-config-guard.test.ts` | Guardián estático, corre en el gate normal |

### La siembra no es cosmética

`sembrar()` escribe, para cada inquilino, las 8 membresías (`clinic_members`), el doc
de la clínica y un documento en cada ruta destino. **El doc de la clínica es
obligatorio**: `clinicaPuedeEscribir()` hace `get()` de `clinics/{clinicId}`; si no
existe, la evaluación de la regla revienta y **todo `write` sale denegado por la razón
equivocada** — la Afirmación A pasaría en verde sin haber probado nada. Es el modo de
falso-verde más probable de esta suite, y es exactamente por eso que B es obligatoria.

Se siembran los **8** roles de la matriz aunque `clinic_members.role` en producción
solo admita 6 (`recepcion` y `facturacion` viven hoy solo en
`src/lib/permissions.ts`): Firestore no valida el enum y probar 8 es estrictamente más
fuerte que probar 6.

## Qué NO cubre esta suite

Dicho para que nadie lea de más en un verde:

- **Política por campo** (inmutabilidad de la nota firmada, congelado de los campos de
  facturación, `audit_log create: if false` con validación de contenido). La
  Afirmación B usa payloads válidos escritos a mano justo para no confundir un rojo
  por payload con un rojo por autorización. Verificar las condiciones por campo es
  **E0-09**.
- **`storage.rules`** — necesita el emulador de Storage y su propia matriz de rutas.
- **Rutas de API** — el Admin SDK **ignora** las reglas por diseño. Su autorización la
  cubre `src/__tests__/api-authz-guard.test.ts`.
- **App Check** — no participa en la evaluación de reglas del emulador.

## Controles negativos

La costumbre de este repo es probar que un gate no pasa por vacío. Los del guardián
estático (se corren sin Java, con `npx vitest run src/__tests__/emulador-config-guard.test.ts`):

| Sabotaje | Debe ponerse rojo |
|---|---|
| Borrar `exclude: [..., 'emulator/**']` de `vitest.config.ts` | sí |
| Copiar un `*.emu.test.ts` dentro de `src/__tests__/` | sí |
| Cambiar `emulators:exec` por `emulators:start` | sí |
| Despinnear una devDependency (`5.0.1` → `^5.0.1`) | sí |
| Borrar el job `aislamiento-tenant` del CI | sí |
| Encoger el generador (que una colección deje de aparecer en los casos) | sí |

Los de la suite conductual (**requieren JRE**, no se han ejecutado todavía):

| Sabotaje | Debe ponerse rojo |
|---|---|
| `isMember` → `return isAuth();` | Afirmación **A**, en decenas de casos |
| Borrar el `match /{document=**}` de default-deny | **A** |
| No sembrar `clinics/{t}` | **B** (A seguiría verde: es la demostración de por qué B existe) |

Si se descubre una **fuga real**, no se parchea aquí: se reporta con el caso
reproducible y se abre unidad propia. Un arreglo improvisado dentro de la unidad que
mide es cómo se rompen las reglas de producción.
