# V15-RELEASE-GATE-001 — ¿es este árbol un candidato de publicación?

**Rama canónica:** `v15/structural-uiux` · **PR:** #292 ·
**SHA de partida:** `7e593451900b7fe5a2e574df8df951c79be31bfe` — el árbol que
`V15-FINAL-COHERENCE-INDEPENDENT-CLOSURE-001` cerró con **PASS**
(`P0 = 0`, `BLOQUEANTES P1 = 0`).

Iteración **19 de 19** del programa V15. Es la última de implementación y
compuerta. Después de ésta **sólo** queda la Auditoría Final de Verdad
independiente y, si pasa, la aceptación del dueño.

## La pregunta

> ¿El árbol **exacto** que hay hoy es un candidato de publicación válido para
> la Auditoría Final de Verdad?

No es «¿está bonito?», ni «¿se puede hacer el trabajo?» (eso lo contestó el
banco de flujos con 20/20), ni «¿se comporta como un producto?» (eso lo
contestó la matriz de coherencia). Es la de al lado: **¿está el paquete
completo, es cierto lo que dice de sí mismo, y no hay nada bloqueante
suelto?**

Y una advertencia que se escribe antes que los resultados, porque gobierna
cómo se leen: **quien escribe esta acta no es el juez.** El veredicto de esta
corrida no cierra V15. `V15_COMPLETE = NO`.

---

## 0. Identidad del candidato

| propiedad | valor |
|---|---|
| `START_SHA` | `7e593451900b7fe5a2e574df8df951c79be31bfe` |
| rama canónica V15 | `v15/structural-uiux` |
| PR canónico V15 | #292 (uno solo) |
| `origin/v15/structural-uiux` al arrancar | `7e593451` — **idéntico** |
| árbol de trabajo al arrancar | limpio (`git status --porcelain` vacío) |
| ramas de integración V15 | **una** |

La rama de ejecución de Claude (`claude/ausculta-v15-release-gate-ai5fmg`)
nació **en el mismo SHA** y no lleva trabajo V15 divergente sin integrar: no
cuenta como una segunda rama de integración, igual que no contaron las de las
iteraciones anteriores.

---

## 1. Lo primero, porque cambia cómo se lee lo demás

**El contenedor llegó otra vez sin `node_modules` y sin `.env.local`.** Las
dos son del entorno, no del árbol, y las dos ya tienen antecedente escrito —
la Iteración 18 documentó la primera. La segunda es nueva en el acta y merece
decirse con precisión, porque **produjo un build rojo que no era del
producto**:

```
Error: Failed to collect page data for /dr/[clinicId]
  [cause]: FirebaseError: Firebase: Error (auth/invalid-api-key)
```

`.env*` está en `.gitignore`, así que un contenedor recién clonado **nunca**
tiene las `NEXT_PUBLIC_FIREBASE_*`. `src/lib/firebase.ts` llama a
`initializeApp` **al importarse**, y `/dr/[clinicId]` usa el SDK del navegador
de forma legítima, así que el build las exige. El propio CI lo tiene
documentado y resuelto desde hace tiempo con placeholders sintéticos
(`.github/workflows/ci.yml`, job `verificar`), y no son secretos: la
configuración `NEXT_PUBLIC_FIREBASE_*` viaja en el bundle a todos los
navegadores por diseño.

Con un `.env.local` de forma válida —proyecto `demo-nexusmed-test`, la misma
convención de los arneses— **el build compila limpio**. Se deja dicho porque
un rojo así, leído deprisa, se atribuye al árbol: y habría sido el error más
caro de esta corrida.

Y un segundo defecto de método, **propio y del instrumento de esta corrida**:
el primer `npm run build` se lanzó con `| tail -60`, así que el código de
salida que se recogió era el de `tail` —cero— mientras el build había fallado.
Un build roto se leyó como verde durante un minuto. Se repitió capturando
`$?` de verdad. Es la misma familia que esta casa ya tiene fichada: **una
medición que no puede fallar no es una medición.**

---

## 2. La reconciliación de la evidencia (§8)

La lectura independiente de la Iteración 18 dejó cuatro observaciones **no
bloqueantes**. Ninguna se olvida; y **dos resultaron ser algo distinto de lo
que parecían**.

### A · «el instrumento midió 12 superficies × 2 anchos = 24 filas, no 11»

**Cierto, y a la vez incompleto.** Contadas del acta cruda:

| corrida | superficies | filas |
|---|---|---|
| ANTES (`antes/acta-coherencia-antes.json`) | **11** | **22** |
| DESPUÉS (`acta-coherencia.json`) | **12** | **24** |

Las dos corridas **no miden lo mismo**, y eso no es un defecto: la superficie
número 12 es `/chat`, que entró al instrumento **durante** la iteración,
cuando el inventario de encabezados de las 45 pantallas la señaló como
defecto real (C-02). No se puede medir un ANTES de algo que aún no se sabía
que había que medir. **Lo que sí era defecto es no haberlo dicho**: quien
compara las dos actas cuenta 22 y 24 y se queda sin explicación.

**PAGADO** — corregido en `V15-COHERENCIA-DE-PRODUCTO.md`, con la tabla de
las dos corridas y el motivo, delante de la matriz.

### B · «la evidencia cruda registra errores de consola en Chat que la prosa omitió»

**Cierto, y era el más serio de los cuatro.** El acta decía que los dos `500`
de `/receta` eran «los únicos errores de consola de la corrida» y que «las
otras diez superficies corrieron con 0». El acta cruda dice otra cosa:

```
receta  escritorio  2 × «500 (Internal Server Error)»
receta  movil       2 × «500 (Internal Server Error)»
chat    escritorio  1 × «false for 'get' @ L1094»
chat    movil       1 × «false for 'get' @ L1094»
```

Cuatro filas con error, no dos. Diez superficies limpias, no once. El dato
**estaba** en el volcado desde el principio; lo que falló fue la prosa, escrita
contra la corrida del ANTES —donde `/chat` no se medía— y no releída contra la
del DESPUÉS. Es, cometido en el acta, exactamente el defecto que esta casa
persigue en el producto: **el dato tiene que LLEGAR.**

**PAGADO** — corregido en el acta, sin borrar el error.

**Y detrás había un hallazgo de producto que nadie había mirado.** `L1094` de
`firestore.rules` es el cierre por defecto
(`match /{document=**} { allow read, write: if false }`). `/chat` lee y
escribe `clinics/{clinicId}/members/{uid}` para el nombre visible del médico
(`src/app/(dashboard)/chat/page.tsx`), y **esa ruta no tiene regla propia**:
la pertenencia vive en la colección de primer nivel `clinic_members/{uid}`
(L1027). El `get` cae al cierre por defecto y se deniega.

Clasificado, no reparado:

- **deniega hacia el lado seguro** — no expone nada, no hay fuga entre
  consultorios, no toca PHI, no es superficie clínica crítica y ningún flujo
  del banco lo atraviesa;
- pero **deja una función muerta en silencio**: editar el nombre visible no
  persiste, y el `setDoc` de `guardarNombre` se rechaza sin `catch`;
- **repararlo exige tocar `firestore.rules`** — o sea semántica de
  autorización, que §17 congela y §5 prohíbe cambiar en esta iteración.

**P2 · ESCALATED_WITH_EVIDENCE. No pagado, y con motivo escrito.**

### C · «la medición de primarias tiene un punto ciego en Consulta / Expediente»

**Cierto, y verificado en el fuente esta corrida** — no heredado de palabra.
El instrumento cuenta `.btn-primary, .prox-hero-cta` dentro de `<main>`
(`medir-coherencia-de-producto-v15.mjs:132`). Y:

```
expediente/[patientId]/page.tsx:239   <button … style={primaryBtn}>   ← «Nueva consulta»
expediente/[patientId]/page.tsx:961   const primaryBtn = { background: 'var(--nexus-solido)', … }
consulta/[patientId]/page.tsx:5500    <button … style={{ background: 'var(--nexus-solido)', … }}>
```

Las dos pintan su acción primaria con estilo **en línea**, no con la clase. El
«0 primarias» de esas dos filas es **artefacto de medición, no ausencia de
acción**. **RECORDED** — ya estaba declarado en el acta de la Iteración 18 y
se confirma aquí midiendo el fuente. Sigue **UNCHANGED_DEBT (P3)**: repararlo
es trabajo del sistema de botones, que el trinquete de diseño ya gobierna.

### D · «`/referencia` es un contexto documental distinto»

**Confirmado, y se queda.** Su `<h1>` («CARTA DE REFERENCIA») está **dentro
del papel**, como título del propio oficio, no como cromo de pantalla.
Cambiarlo cambiaría un documento medicolegal emitido — justo lo que §1 congela
y §7 prohíbe aplanar.

Clasificación independiente respetada:
`LEGITIMATE_CONTEXTUAL_DIFFERENCE` · `PATIENT_SAFETY_IMPACT = NONE`.
**UNCHANGED_DEBT (P3).**

---

## 3. La matriz de calidad, corrida entera sobre ESTE árbol

Todo con los comandos reales del repositorio, descubiertos antes de
ejecutarlos — no inventados. (La lectura independiente no pudo correr el
trinquete de diseño porque adivinó una ruta que no existe; el comando de
verdad es `node scripts/design/trinquete-de-diseno.mjs` y aquí se corrió.)

| compuerta | comando | resultado |
|---|---|---|
| Suite completa | `npx vitest run` | **9696 pasan · 1 falla** (705 archivos) — la única roja es el ambiental probado, abajo |
| Typecheck | `npx tsc --noEmit` | **limpio** (exit 0, sin salida) |
| Trinquete de lint | `node scripts/lint-trinquete.mjs` | **96 = techo. Sin deuda nueva.** |
| Trinquete de diseño | `node scripts/design/trinquete-de-diseno.mjs` | **los 9 techos intactos. Sin deuda nueva.** |
| Build de producción | `npm run build` | **compila** (exit 0, con `.env.local` de forma válida) |
| Compuerta de seguridad clínica | `npx vitest run src/__tests__/clinical-safety-gate.test.ts` | **37 pasan** |
| Sello de invariantes | `npx vitest run … $(node scripts/invariantes-clinicos.mjs)` | **328 archivos · 5508 casos pasan** |
| REG-319 / REG-320 / REG-321 / REG-322 | los cuatro guardianes | **4 archivos · 32 casos pasan** |
| Contexto de paciente / encuentro | 5 guardianes de identidad | **38 casos pasan** |
| Navegación e inventario | 6 guardianes estructurales | **61 casos pasan** |
| Versión del service worker | `node scripts/version-sw.mjs` | `nexusmed-v1171`, **coherente** (árbol sigue limpio) |
| Smoke público + cabeceras (LOCAL) | `PLAYWRIGHT_LOCAL=1 … e2e/smoke-publico.spec.ts e2e/seguridad.spec.ts` | **67 pasan · 2 saltadas · 0 fallan** |

### El E2E público: cómo estuvo a punto de publicarse un rojo falso

La primera corrida dio **16 fallos**. Ninguno era del producto:

```
Error: browserType.launch: Executable doesn't exist at
  /opt/pw-browsers/chromium_headless_shell-1228/…
```

El `@playwright/test` instalado pide los navegadores **-1228**; el contenedor
trae **-1194** y `/opt/pw-browsers/chromium`. Es **exactamente** el fallo de
instrumento que la Iteración 18 ya había documentado y resuelto en sus
medidores `.mjs` cayendo a `/opt/pw-browsers/chromium` — pero
`playwright.config.ts` **no hereda esa convención**, así que los 16 casos que
necesitan navegador morían al arrancarlo y los 51 que hablan por HTTP pasaban.
Un rojo de 16 sobre una matriz de seguridad es justo el que se copia a un
informe sin mirar.

Repetido con el navegador del contenedor —config temporal, **fuera del
repositorio y borrada al terminar**: no se tocó `playwright.config.ts`, porque
en CI el navegador se instala y coincide— la matriz entera pasa: A1–A5
(cabeceras, anti-clickjacking, tokens que no se filtran por referer), B1–B2
(CSP en las ocho rutas públicas), C1–C2 (rutas que rechazan sin sesión).

Las **2 saltadas** son `D1`/`D2`, que exigen un build con `CSP_MODE=enforce`
—la variable se lee en el BUILD— y por tanto miden otro artefacto.
`HARNESS_FAILURE`, no `PRODUCT_FAILURE`.

**No se corrió `e2e:seguridad:prod`**, y es deliberado: la regla del
repositorio dice que esa comprobación va **después** de publicar, contra el
sitio vivo, porque una rama que añade pantallas hace fallar A3 contra
producción hasta desplegar y ese rojo no dice nada de la rama. Es un paso del
dueño.

### La suite completa: lo que hay que decir, no el titular

Se corrió **tres veces**, y el resultado **no fue el mismo las tres**:

| corrida | resultado |
|---|---|
| 1ª (antes del build) | 9693 pasan · 1 saltada · **0 fallan** |
| 2ª (mismo árbol, sin tocar nada) | **1 falla**: `ops-timeout-y-punto-ciego` |
| 3ª (final, ya con `.next`) | 9696 pasan · **1 falla**: la misma |

La saltada de la 1ª deja de saltarse en la 3ª —por eso el total sube de 9694 a
9697—, y el caso rojo es siempre el mismo. **No es flaky de los que se encogen
de hombros; tiene causa, y se midió:**

```
$ node -e "fetch('http://10.255.255.1/nunca')"
RESPONDED 403 in 118 ms
```

La premisa del caso es **un servidor que nunca contesta**. En este contenedor
esa IP **sí contesta**: el proxy del entorno la intercepta y devuelve `403`.
Con un presupuesto de 30 ms, que el caso pase o falle depende de si el proxy
tarda más o menos que eso — de ahí que una corrida lo diera verde y la
siguiente rojo. El error real de la aserción lo confirma: no es «no abortó
bien», es que `fetchConTimeout` **resolvió con éxito** y el caso cayó en su
propio `throw new Error('debió agotarse')`.

**Y no se dio por ambiental sin probarlo.** Contra un servidor que de verdad
acepta la conexión y nunca responde:

```
instancia TiempoAgotado: true
ms: 30 | host: 127.0.0.1:42573 | transcurrido: 55 ms
```

El producto hace exactamente lo que promete. **`ENVIRONMENT_FAILURE`,
demostrado por construcción y no supuesto.** Sigue siendo el mismo
`UNVERIFIABLE` ambiental que las Iteraciones 17 y 18 ya habían declarado, y
**no se convierte a PASS**.

### La saltada

`csp-manifest.test.ts` se salta cuando no hay `.next/routes-manifest.json`
—es decir, cuando no se ha construido—. **Tras el build corre y pasa (4
casos).** No es un caso desactivado: es uno que exige artefacto de build, y lo
dice en su propio nombre de caso.

### Los rojos que la Iteración 18 vio y aquí NO reproducen

- `la-agenda-es-un-riel` (timeout de importación) — **pasa**, corrido aislado
  y dentro de la suite.
- `la-cifra-de-seguridad-no-se-pudre` (discrepancia con `npm audit` en vivo) —
  **pasa**.
- El build que no podía traer las tipografías de Google — **no reproduce**: el
  build compila y no hay ninguna advertencia de fuentes en su salida.

Se dicen porque desaparecer en silencio también es una forma de mentir: eran
ambientales, y el ambiente de hoy es otro.

---

## 3-bis. Accesibilidad: donde el instrumento no había mirado nunca

`axe-encuentro-v15.mjs` cubre seis superficies y **la familia documental no
está entre ellas**. Eso no es sospecha: es el hallazgo escrito de la Iteración
18, que explicó así por qué ninguna corrida de axe había visto que `/nota` no
tenía **ningún** `<h1>`.

Sobre las seis de siempre, esta corrida da **paridad exacta con la línea base
comprometida**:

```
escritorio  pacientes   target-size(3)   ← idéntico al acta comprometida
todo lo demás                 limpio      (12 mediciones: 6 superficies × 2 anchos)
```

Pero §7 exige que las propiedades obligatorias de accesibilidad pasen en las
pantallas **críticas**, y nota/receta/orden lo son: es donde el médico emite un
documento que cambia el tratamiento. **Declarar «ACCESIBILIDAD: PASA»
apoyándose en un instrumento que nunca las visitó sería un falso verde de
manual — verde por no mirar** (§23). Así que se miraron, con medidor propio
(`scripts/design/axe-familia-documental-v15.mjs`, acta en
`v15-release-gate/acta-axe-familia-documental.json`), sin tocar el instrumento
de la iteración cerrada:

```
escritorio  nota        limpio                h1 «Aurelio Domínguez Peña» 20px
escritorio  receta      color-contrast(1)     h1 «Luz María Cervantes Ochoa» 20px
escritorio  orden       color-contrast(1)     h1 «Aurelio Domínguez Peña» 20px
escritorio  referencia  limpio                h1 «CARTA DE REFERENCIA» 15px
movil       las cuatro  limpio
```

De paso confirma REG-321 **en un segundo instrumento independiente**: las tres
superficies de la familia encabezan con el nombre del paciente.

### El hallazgo nuevo, medido hasta el nodo antes de clasificarlo

Un conteo no basta para decidir si algo bloquea una publicación: no es lo mismo
un texto clínico que un rótulo. Se midió el nodo
(`scripts/design/axe-detalle-contraste-v15.mjs`):

```
selector   .receta-sheet > div:nth-child(2) > div:nth-child(1)
texto      «Receta Médica» / «Orden Médica»
etiqueta   DIV · ¿control? NO · ¿dentro de la vista previa del papel? SÍ
tinta      #14b8a6 sobre #ffffff · 11px/700
contraste  2.48:1   ·   exigido 4.5:1
```

Es un **incumplimiento real de WCAG AA**, de impacto `serious`. Y es
**preexistente**: el diff `89865c2f..HEAD` no toca `receta-sheet` **ni una
vez**, y `RecetaDocumento.tsx` no se modificó. No es una regresión de V15: es
deuda que sólo se ve ahora porque ahora se mira.

**Por qué NO se repara aquí, con la dependencia dicha por su nombre.** Ese
teal no es una decisión de hoja de estilos: es
`recetaConfig.colorAccento ?? '#14b8a6'` — **el color de membrete que el médico
configura para su receta**. Vive **dentro del papel** (`.receta-sheet`), o sea
en el documento medicolegal que se imprime y se entrega. Cambiarlo cambiaría
todas las recetas que ese médico emite, y es un valor **del dueño**, no del
implementador. §1 congela el contenido de los artefactos medicolegales y §17
prohíbe cambiarlos en esta iteración.

**P2 · `ESCALATED_WITH_EVIDENCE`. No pagado, y decidible sólo por el dueño.**

No es bloqueante: §19 llama bloqueante al defecto de accesibilidad **sobre una
acción crítica**, y esto es un rótulo de 11px no interactivo dentro de una
vista previa. Se registra para que la Auditoría Final de Verdad lo tenga
delante, no para pagarlo con prisa.

---

## 4. El banco de flujos, re-corrido entero (§14)

Mismo arnés, misma siembra, sobre el árbol candidato:

```
20 corridas (10 flujos × 2 anchos)
20 COMPLETA · 0 pérdidas de contexto · 0 callejones · 0 atajos inseguros
consola: 10 — WF-04 ×2 anchos (503 del proveedor de transcripción)
              WF-05 ×2 anchos (500 de PORTAL_PACIENTE_SECRET)
```

**Paridad exacta** con la Iteración 17 y con la re-corrida de la 18, incluidos
los diez errores de consola, que son los mismos dos grupos ambientales y
ningún otro. `CONSOLE_DELTA = 0`.

`WF-07` y `WF-08` —la cadena de §21, `hecho → inspeccionar → fuente → vuelta
exacta`— completan en los dos anchos, con testigo de regreso en la URL, rótulo
de vuelta, scroll idéntico (`120 → 120`) y el foco devuelto a un control:
**Source Reveal no regresó.**

Las dos deudas conocidas siguen visibles en el propio banco, sin disimular:

- `WF-03` móvil mide **15.85 pantallas** de scroll en el expediente (P2);
- `WF-05` reporta **«el cierre recuerda lo hecho: false»** (P3).

**La evidencia de `v15-flujos/` se restauró a la de la Iteración 17** después
de leer el resultado: esa iteración está cerrada por lectura independiente y
su acta es inmutable. El resultado de esta re-corrida vive aparte, en
`docs/design/capturas/v15-release-gate/acta-flujos-release-gate.json`.

---

## 5. Congelación funcional (§17)

Verificado sobre el diff `89865c2f..HEAD` (51 archivos) y sobre el trabajo de
esta iteración: **ninguna** de las áreas congeladas se tocó.

algoritmos clínicos · reglas de seguridad médica · lógica de medicamentos ·
semántica de evidencia · esquema de Firestore · autenticación/autorización ·
facturación · contratos de API · semántica de documento firmado · semántica de
bitácora.

`FROZEN_LOGIC_VIOLATION = NO`.

El único punto donde esta iteración **rozó** una frontera congelada fue el
hallazgo de `/chat` (§2.B): repararlo habría exigido tocar `firestore.rules`.
**Se paró y se escribió la dependencia**, que es lo que §17 manda.

---

## 6. Higiene de publicación (§18) — acotada, no un programa de endurecimiento

| propiedad | resultado |
|---|---|
| PHI en artefactos de publicación | **NINGUNA** — los únicos nombres de la evidencia son `Aurelio Domínguez Peña` y `Luz María Cervantes Ochoa`, los pacientes sintéticos de `sembrar-capturas.mjs` («TODO inventado») |
| secreto nuevo expuesto por V15 | **NINGUNO** — el único literal que casa un patrón de credencial en el diff es `PASSWORD = 'captura-v10-demo'`, usuario del **emulador** en los arneses, convención preexistente y ausente de `src/` |
| credenciales de producción en capturas | **ninguna** |
| ruta de depuración vuelta primaria/pública | **ninguna** |
| utillaje de datos sintéticos en runtime de producción | **no** — vive en `scripts/design/`, fuera del árbol de la app |
| mutación accidental de Stripe de producción | **no** — no se tocó |
| PHI añadida a URLs por V15 | **no** |
| `.env.local` creado para esta corrida | **ignorado por git** (`git check-ignore` lo confirma); no se commitea |

`npx vitest run src/__tests__/firestore-rules-guard.test.ts src/__tests__/subencargados.test.ts` → **36 casos pasan.**

---

## 6-bis. La deuda, una por una (§9)

Nada se pierde y nada se paga con prisa. **P2/P3 no bloquea por el hecho de
que esta iteración se llame Release Gate.**

| deuda | estado |
|---|---|
| **P2** · Hoy mezcla reloj de consultorio y de dispositivo | `UNCHANGED_DEBT` — el arnés la esquiva fijando `timezoneId` y lo dice |
| **P2** · el expediente mide ~15.9 pantallas en el teléfono | `UNCHANGED_DEBT` — re-medido esta corrida: **15.85** en WF-03 móvil. Carga de lectura, no defecto; no bloquea el flujo, que completa |
| **P3** · el cierre del encuentro no acusa la receta hecha | `UNCHANGED_DEBT` — re-observado esta corrida: WF-05 reporta «el cierre recuerda lo hecho: **false**» en los dos anchos. Diagnóstico de la Iteración 18 intacto (`hechosCierre` se inicializa de `?nota=`); repararlo exige tocar la continuidad de `/consulta` |
| **P3** · `/referencia` encabeza «CARTA DE REFERENCIA» | `UNCHANGED_DEBT` — confirmado `LEGITIMATE_CONTEXTUAL_DIFFERENCE`, `PATIENT_SAFETY_IMPACT = NONE`. Su `<h1>` está dentro del papel |
| **P3** · medición de primarias ciega al estilo en línea | `RECORDED` (y verificado en el fuente esta corrida: `expediente:239/961`, `consulta:5500`) · sigue `UNCHANGED_DEBT` |
| **P2** · `/chat` lee `clinics/{id}/members/{uid}`, sin regla | **`ESCALATED_WITH_EVIDENCE`** — NUEVA. Deniega hacia el lado seguro; deja muerta la edición del nombre visible. Repararla toca `firestore.rules` (§17 congela autorización) |
| **P2** · contraste 2.48:1 del rótulo del papel en receta/orden | **`ESCALATED_WITH_EVIDENCE`** — NUEVA. Preexistente (el diff no toca `receta-sheet`); el color es el membrete configurable del médico, dentro del artefacto medicolegal. **Decisión del dueño** |
| Precisión de prueba WF-03 / WF-07 / WF-08 / WF-10 | `UNCHANGED_DEBT` — son del banco de la Iteración 17, cerrada por lectura independiente. Reabrirlas aquí sería reabrirla |
| Heredadas · capa de notificaciones | `UNCHANGED_DEBT` — no se tocó |
| Heredadas · formato de `alergiasDe` | `UNCHANGED_DEBT` — vive en `src/lib/seguridad/alergias.ts`, que §1 congela |
| Heredadas · divergencia orden/receta en `mostrarAlergias` | `UNCHANGED_DEBT` — congelada por su guardián, esperando al dueño |
| Heredadas · RTC-12(a) | `UNCHANGED_DEBT` — nombrada, con el refactor del monolito |
| Heredadas · la compuerta de firma no mira la prosa | `UNCHANGED_DEBT` — decisión del dueño, no trabajo de Claude |
| `UNVERIFIABLE` · proveedor de transcripción | `UNCHANGED` — WF-04 lo declara por su nombre en los dos anchos |
| `UNVERIFIABLE` · la nota que nace de la transcripción | `UNCHANGED` — misma dependencia |
| `UNVERIFIABLE` · comunicación real al paciente | `UNCHANGED` — y mandar mensajes reales está prohibido sin el dueño |
| `UNVERIFIABLE` · `PORTAL_PACIENTE_SECRET` | `UNCHANGED` — los dos `500` de `/receta`, en los dos anchos |
| `UNVERIFIABLE` · `ops-timeout` ambiental | `UNCHANGED` — y esta vez **demostrado** ambiental por construcción (§3) |

Ninguna se asciende de severidad. Ninguna se convierte a PASS.

---

## 7. Lo que esta corrida NO hizo, y es deliberado

- **No fusionó a `main`.** No lo puede hacer.
- **No desplegó a producción.** Prohibido sin autorización del dueño.
- **No corrió `e2e:seguridad:prod`.** La regla del repositorio dice
  explícitamente que esa comprobación va **después** de publicar, contra el
  sitio vivo, y que hacerla contra un árbol no desplegado produce un rojo que
  no dice nada de la rama. Es un paso del dueño.
- **No pagó deuda P2/P3.** Release Gate no es un barrido de limpieza.
- **No reabrió las Iteraciones 16, 17 ni 18.** Ninguna regresión lo pidió.
- **No tocó el cuerpo del PR #292.** Es prosa histórica y ninguna regla
  canónica del repositorio obliga a refrescarla.
- **No se autocertificó.** `V15_COMPLETE = NO`.

---

## 8. Veredicto

```
RELEASE_GATE_VERDICT            PASS
P0                              0
BLOQUEANTES P1                  0
P2 nuevas (escaladas)           2
P3                              3 (sin cambio)
FROZEN_LOGIC_VIOLATION          NO
ONE_CANONICAL_V15_BRANCH_PR     PASS
READY_FOR_FINAL_TRUTH_AUDIT     YES
V15_COMPLETE                    NO
```

Las dos P2 nuevas son **hallazgos, no reparaciones pendientes de esta
iteración**: las dos exigen tocar algo que V15 congela —`firestore.rules` una,
el artefacto medicolegal la otra— y las dos se registran con su evidencia para
que las decida quien puede.

**Lo que esta acta NO es.** No es la aceptación de V15. Quien escribió el
código no puede firmar que el código está bien: ésa ha sido la regla de las
tres iteraciones anteriores y no cambia en la última. El siguiente paso es la
**Auditoría Final de Verdad independiente** sobre el SHA congelado, y después
la aceptación del dueño.

No se fusiona. No se despliega. No se empieza nada de después de V15:
`AUSCULTA-AUTONOMOUS-CONTROL-PLANE-001` y
`AUSCULTA-PROFESSIONAL-HARDENING-001` siguen **EN COLA**.
