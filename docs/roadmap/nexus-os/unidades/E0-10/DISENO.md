# E0-10 — CSP enforced + E2E de seguridad · DISEÑO

> Estado: **PARTE I implementada** (commits `5e01c35` + `5690e5b`) y **verificada de
> forma adversarial** con veredicto `INCOMPLETA` (`VERIFICACION.json`). El
> `RESULTADO.json` se retiró del disco y la unidad volvió a la cola.
> **El diseño vigente para la pasada de cierre es la [PARTE II](#parte-ii--rediseño-de-cierre-3ª-pasada-2026-07-29) al final de este documento.**
> Etapa E0 · riesgo declarado **medio** · `validacionClinica: false`.
> Aceptación del backlog: *«CSP enforce sin romper flujos; E2E de seguridad en verde.»*

---

## 0. Resumen ejecutivo (lo que cambia respecto a lo que se creía)

La nota de selección en `estado.json:324` decía que el único trabajo ejecutable aquí
era «escribir la matriz Playwright», y que el enforce quedaba fuera por exigir
observación en producción. **Medido contra el código, eso es incompleto en dos
sentidos:**

1. **La observación en producción no es lo único que falta.** El código actual carga
   tres orígenes que la política report-only **no** contempla. Con el flip a enforce
   se romperían hoy mismo, y ningún reporte lo va a "descubrir" mejor de lo que ya lo
   dice el código: `unpkg.com` (worker de pdf.js), `connect.facebook.net` (Meta SDK /
   Pixel) y el dominio de la sala de Daily.co en un `<iframe>`. Están citados en §2.
2. **El flip tiene un efecto colateral que nadie ha nombrado y que NO tiene que ver
   con la lista de orígenes:** al renombrar la cabecera global de
   `Content-Security-Policy-Report-Only` a `Content-Security-Policy`, esa regla pasa a
   colisionar por clave con las reglas por-ruta de `frame-ancestors`, y **gana la
   última** — el propio `next.config.ts:152-158` lo documenta y lo verifiqué en
   producción (§2.4). El resultado sería perder `frame-ancestors 'none'` en la zona
   autenticada. Es una regresión de seguridad *causada por el hardening*.

Además, buscando qué rutas protege hoy el bloque anti-clickjacking apareció un
**agujero real y verificable sin login** que esta unidad puede cerrar: la lista de
rutas privadas de `next.config.ts:100` está desactualizada respecto a
`src/app/(dashboard)/` — `/uci`, `/hospitalizacion`, `/superadmin`, `/receta`,
`/orden`, `/corte-caja` (entre otras) **no llevan ninguna protección anti-iframe hoy
en producción** (§2.5). Ese hallazgo es, en la práctica, el mayor valor de seguridad
que entrega esta unidad, y es 100 % testeable por la matriz Playwright.

**Partición del alcance propuesta:**

| | Alcance | Se puede cerrar aquí |
|---|---|---|
| **A** | Matriz Playwright de seguridad (`e2e/seguridad.spec.ts`) | **Sí** |
| **B** | Guardián estático de la CSP en vitest (cruza código ↔ política) | **Sí** |
| **C** | Corregir la política report-only (3 orígenes faltantes) y la lista de rutas privadas | **Sí** (report-only no bloquea nada → cambio inerte en runtime) |
| **D** | Mecanismo del flip: `CSP_MODE=report-only\|enforce` + `frame-ancestors` por zona, con default **report-only** | **Sí** (por defecto no cambia el comportamiento) |
| **E** | Ejecutar el flip en producción (`CSP_MODE=enforce` en Vercel) | **No** — regla 6 (no desplegar) + regla 5. Decisión del Dr. |

Con A–D la unidad queda **PARCIAL honesta**: el enforce queda *probado en local con
el interruptor puesto* y a un cambio de variable de entorno del Dr., no a un rediseño.

---

## 1. Qué existe ya (medido, con archivo:línea)

| Pieza | Dónde | Estado |
|---|---|---|
| CSP report-only global | `next.config.ts:35-49` (constante) y `next.config.ts:148` (cabecera) | **Existe y está VIVA en producción** — verificado con `curl -I https://agenda-medica-one.vercel.app/`: devuelve `content-security-policy-report-only: default-src 'self'; …` |
| Receptor de reportes | `src/app/api/csp-report/route.ts` | Existe; redacta rutas para no filtrar tokens/PHI (`rutaSegura`, línea 21), acepta formato `report-uri` y `report-to` (línea 40) |
| `report-uri /api/csp-report` | `next.config.ts:48` | Existe. **No** hay `Reporting-Endpoints` + `report-to` (§6.3) |
| `frame-ancestors *` embebibles | `next.config.ts:83-94` (`/reservar`, `/privacidad`) | Existe, en modo enforce |
| `frame-ancestors 'none'` privadas | `next.config.ts:99-105` | Existe, **lista incompleta** (§2.5) |
| Resto de cabeceras (HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP, Origin-Agent-Cluster) | `next.config.ts:108-149` | Existe |
| Rutas con token: `noindex` + `no-referrer` | `next.config.ts:159-165` | Existe y funciona (verificado: `/mi/xyz` → `referrer-policy: no-referrer`) |
| Playwright | `playwright.config.ts` (5 proyectos: chromium/firefox/webkit/iPhone 14/Pixel 7) | Existe, `baseURL` = producción por defecto, **sin `webServer`** |
| E2E actuales | `e2e/smoke-publico.spec.ts` — **único** archivo (10 casos: landing, login, páginas públicas, robots, sitemap, 2 endpoints 401) | Existe |
| CI | `.github/workflows/ci.yml` — jobs `clinical-safety` y `verificar` (tsc + vitest + build) | Existe. **Playwright NO corre en CI** |
| Patrón de "guardián estático de fichero de seguridad" | `src/__tests__/firestore-rules-guard.test.ts` | Existe — es el molde exacto a copiar para el guardián de CSP |

**No hay** ningún test (vitest ni Playwright) que mire la CSP ni las cabeceras. Es el
hueco que llena esta unidad.

---

## 2. Hallazgos que condicionan el diseño

### 2.1 `unpkg.com` — el worker de pdf.js rompe con enforce

```
src/lib/pdf-to-image.ts:74-75
  pdfjs.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${ver}/build/pdf.worker.min.mjs`
```

La política declara `worker-src 'self' blob:` y `script-src` sin `unpkg.com`
(`next.config.ts:39,44`). Con enforce, el worker no carga → **se cae todo el flujo de
"subir PDF y convertirlo a imagen"**, que es la puerta de entrada de laboratorios
(memoria: *Laboratorios IA*), del antibiograma por foto y de la receta por visión.

Dos salidas, y **recomiendo la segunda**:

- (a) añadir `https://unpkg.com` a `script-src` y `worker-src`;
- (b) **auto-alojar el worker**: copiar `pdf.worker.min.mjs` de `node_modules/pdfjs-dist`
  a `public/pdfjs/` en un paso de build y apuntar `workerSrc` a `/pdfjs/pdf.worker.min.mjs`.

(b) elimina a la vez el agujero de CSP y una dependencia de CDN de terceros en caliente
en un flujo clínico (si unpkg cae o es comprometido, hoy ejecuta código en la sesión del
médico). **Pero (b) toca un flujo en producción** → por regla 5 va como *propuesta con
plan*, no se ejecuta a ciegas: ver §7, decisión **D-1** para el Dr.

### 2.2 `connect.facebook.net` — Meta Pixel / SDK rompen con enforce

```
src/components/MetaPixel.tsx:38            …'script','https://connect.facebook.net/en_US/fbevents.js')
src/app/(dashboard)/configuracion/page.tsx:956   s.src = 'https://connect.facebook.net/en_US/sdk.js'
```

`MetaPixel` se monta en `src/app/page.tsx:644` y `src/app/registro/page.tsx:108`, y
**sólo se activa si existe `NEXT_PUBLIC_META_PIXEL_ID`** (`MetaPixel.tsx:11,30`). El
SDK de `configuracion` es el *embedded signup* de WhatsApp. Con enforce y sin entrada
en `script-src`/`connect-src`, el Pixel deja de medir conversiones (impacto comercial,
no clínico) y el alta de WhatsApp deja de funcionar (impacto operativo real).

Nota de privacidad, relevante para decidir: el propio comentario de `MetaPixel.tsx:3-6`
advierte que **nunca** debe montarse en el área autenticada porque las URLs llevan IDs
de paciente. Añadir `connect.facebook.net` a `script-src` **global** debilita esa
garantía. La forma correcta es alcance por ruta. Ver decisión **D-2**.

### 2.3 Daily.co — el `<iframe>` de teleconsulta rompe con enforce

```
src/app/teleconsulta/[citaId]/page.tsx:66   <iframe src={url} …>
src/app/api/telesalud/sala/route.ts:85      fetch('https://api.daily.co/v1/rooms', …)  → room.url
```

`frame-src` (`next.config.ts:46`) no incluye Daily. Con enforce, **la teleconsulta
muestra un iframe en blanco**. El dominio exacto lo devuelve Daily (`room.url`, forma
`https://<subdominio>.daily.co/<sala>`), y el fallback de desarrollo es
`https://meet.example.com/…` (`sala/route.ts:73`). Falta la entrada
`frame-src https://*.daily.co`.

### 2.4 El flip clobbera `frame-ancestors` (efecto colateral no listado)

`next.config.ts` emite hoy dos claves distintas, por eso conviven:

- bloque `/reservar` → `Content-Security-Policy: frame-ancestors *` (enforce)
- bloque global → `Content-Security-Policy-Report-Only: …`

Al renombrar la global a `Content-Security-Policy`, **las dos reglas escriben la misma
clave** y, según el comportamiento que el propio repo documentó y que verifiqué en
producción, **gana la última del array**. Verificación empírica del mecanismo
(`/mi/xyz` devuelve `referrer-policy: no-referrer` y no el `strict-origin-when-cross-origin`
global, siendo su bloque el último — `next.config.ts:159`): last-wins confirmado.

Como el bloque global (`:109`) va **después** de los bloques `frame-ancestors`
(`:84`, `:90`, `:100`), tras el flip:

- `/reservar`, `/privacidad`: pierden `frame-ancestors *`. La política global no
  declara `frame-ancestors`, así que seguirían embebibles — **no se rompe**, pero por
  accidente, no por diseño.
- Zona autenticada: pierde `frame-ancestors 'none'`. Queda sólo `X-Frame-Options: DENY`.
  Protección degradada de dos capas a una, justo en las pantallas con PHI.

**Corrección de diseño (§4.2):** construir la política con una función parametrizada
por `frame-ancestors` y reordenar los bloques para que el más específico vaya **al
final**. Esto es requisito del flip, no un extra.

### 2.5 Agujero real hoy: rutas privadas sin protección anti-clickjacking

`next.config.ts:100` protege
`consulta|expediente|nota|agenda|pacientes|crm|cumplimiento|finanzas|farmacia|configuracion|equipo|reportes|usuarios|valoracion|nueva-consulta|dashboard`.

Contrastado con `ls src/app/(dashboard)` + rutas de nivel superior:

- **Faltan (existen y no están):** `uci`, `hospitalizacion`, `antibiograma`, `asistente`,
  `calendario`, `chat`, `citas`, `consultor`, `corte-caja`, `expedientes`, `guia`,
  `legal`, `lista-espera`, `membresias`, `migracion`, `orden`, `receta`, `referencia`,
  `resenas`, `reactivacion`, `waitlist`, y fuera del grupo: `superadmin`, `setup`.
- **Sobran (no existen como rutas):** `equipo`, `reportes`, `usuarios`, `valoracion`,
  `nueva-consulta`.

Verificado en producción — ninguna de estas devuelve `X-Frame-Options`:

```
/uci /hospitalizacion /superadmin /receta /orden /corte-caja  → 0 cabeceras x-frame-options
```

`/uci`, `/hospitalizacion` y `/receta` renderizan PHI; `/superadmin` es la consola del
dueño. Cerrarlo es barato, no cambia ningún flujo (sólo impide que un tercero las
embeba) y es **verificable por E2E sin necesidad de sesión** — el header viaja incluso
en la respuesta de redirección al login.

### 2.6 Lo que la matriz **no** puede probar (limitación honesta)

`playwright.config.ts:5-6` ya lo dice: no hay cuenta de prueba. La zona autenticada
—expediente, nota, receta/impresión, farmacia, UCI— es exactamente donde el enforce
puede romper algo silencioso (un `blob:`, un `data:`, un worker de `html2pdf.js`, una
imagen de Storage). **Esta unidad no puede afirmar "enforce sin romper flujos" para
la zona autenticada.** Sólo puede afirmarlo para el camino público + los invariantes
de configuración. Eso se declara explícitamente en `RESULTADO.json` y es la razón por
la que **E** queda fuera.

---

## 3. Archivos que se tocan

| Archivo | Acción | Por qué |
|---|---|---|
| `next.config.ts` | **Modificar** | Política parametrizada, interruptor `CSP_MODE`, 3 orígenes faltantes, lista de rutas privadas corregida, reordenado de bloques |
| `e2e/seguridad.spec.ts` | **Crear** | Matriz Playwright de seguridad (entregable) |
| `e2e/README.md` | **Crear** | Cómo correr la matriz en local, contra preview y contra prod; qué significa cada fallo |
| `src/__tests__/csp-guard.test.ts` | **Crear** | Guardián estático: la política es coherente con el código y no se afloja sola |
| `playwright.config.ts` | **Modificar (mínimo)** | Añadir `webServer` **opcional** (sólo si `PLAYWRIGHT_LOCAL=1`) para poder probar `CSP_MODE=enforce` sin desplegar |
| `docs/seguridad/csp-enforce.md` | **Crear** | Runbook del flip: qué observar, cómo revertir en <2 min, checklist de flujos |
| `docs/audit/regression-ledger.md` | **Anotar** | REG nuevos: rutas privadas sin XFO; clobber de `frame-ancestors` |

**NO se toca:** impresión/PDF/Word, firma, cobros, `firestore.rules`, motores clínicos,
`src/lib/pdf-to-image.ts` (queda como decisión D-1), `MetaPixel.tsx`.

---

## 4. Contrato de lo nuevo

### 4.1 Modo de la CSP

```ts
// next.config.ts
type CspMode = 'report-only' | 'enforce'

/** Lee CSP_MODE del entorno de BUILD. Default deliberado: 'report-only'.
 *  Cualquier valor distinto de 'enforce' cae a 'report-only' (fail-open a lo seguro:
 *  nunca bloquear por un typo en la variable). */
function modoCsp(): CspMode

/** Nombre de cabecera derivado del modo. */
function claveCsp(modo: CspMode): 'Content-Security-Policy' | 'Content-Security-Policy-Report-Only'
```

Se evalúa en **build**, no en request: cambiar `CSP_MODE` en Vercel exige un redeploy.
A cambio, el flip y la reversión son **una variable de entorno**, no un cambio de
código — y se puede probar en local con `CSP_MODE=enforce npm run build && npm start`.

### 4.2 Política parametrizada por zona

```ts
type ZonaFrame = 'ninguno' | 'cualquiera' | 'omitir'
//   'ninguno'    → frame-ancestors 'none'   (zona autenticada)
//   'cualquiera' → frame-ancestors *        (páginas embebibles: /reservar, /privacidad)
//   'omitir'     → sin directiva            (resto)

/** Devuelve la CSP completa; `frameAncestors` decide la última directiva. */
function politicaCsp(frameAncestors: ZonaFrame): string
```

Orden final de bloques en `headers()` — **de general a específico**, porque gana el último:

1. `/sw.js` (cache)
2. `/:path*` → cabeceras globales + `claveCsp(modo)`: `politicaCsp('omitir')`
3. `/reservar/:path*`, `/privacidad/:path*` → `claveCsp(modo)`: `politicaCsp('cualquiera')`
4. `RUTAS_PRIVADAS` → `X-Frame-Options: DENY` + `claveCsp(modo)`: `politicaCsp('ninguno')`
5. `/(mi|resena|verificar)/:path*` → `X-Robots-Tag`, `Referrer-Policy: no-referrer`

En modo `report-only` el comportamiento observable **no cambia** respecto a hoy salvo
un detalle deliberado: los bloques 3 y 4 pasan a emitir la política completa en lugar
de sólo `frame-ancestors`. Para que `frame-ancestors` siga siendo **enforce** aunque el
modo sea report-only (hoy lo es, y bajarlo sería una regresión), los bloques 3 y 4
emiten **dos** cabeceras: la `Content-Security-Policy: frame-ancestors …` de siempre
(inalterada, enforce) **más** la política completa bajo `claveCsp(modo)`. En modo
enforce ambas colapsan en la misma clave y gana la completa, que ya lleva su
`frame-ancestors`. Invariante a testear: *en los dos modos, `/agenda` responde con
`frame-ancestors 'none'` en una cabecera **enforce***.

### 4.3 Lista única de rutas privadas

```ts
/** Fuente única de verdad de la zona autenticada. La usan next.config.ts (headers)
 *  y el guardián de tests. Ordenada, sin duplicados, sin rutas inexistentes. */
const RUTAS_PRIVADAS: readonly string[]
const RE_RUTAS_PRIVADAS: string  // `/(a|b|c)(.*)` construido a partir del array
```

Se exporta desde `next.config.ts` (o desde `src/lib/security/rutas-privadas.ts` si el
import desde el test resulta incómodo — `next.config.ts` es TS y vitest puede
importarlo, pero el guardián puede leerlo como texto igual que hace
`firestore-rules-guard.test.ts:12`). **Preferencia: leer como texto**, para no arrastrar
`@next/bundle-analyzer` dentro de vitest.

### 4.4 Directivas nuevas de la política (report-only, fase C)

| Directiva | Se añade | Motivo |
|---|---|---|
| `frame-src` | `https://*.daily.co` | §2.3 teleconsulta |
| `script-src` / `worker-src` | `https://unpkg.com` **o** nada si se auto-aloja | §2.1 (depende de D-1) |
| `script-src` / `connect-src` | `https://connect.facebook.net`, `https://www.facebook.com` | §2.2 (depende de D-2) |

Nada más. **No se relaja nada** (no se añade `*`, ni `data:` en `script-src`, ni se
quitan `object-src 'none'` / `base-uri 'self'`).

---

## 5. Tests que lo prueban

### 5.1 `src/__tests__/csp-guard.test.ts` (vitest, corre en CI)

Molde: `firestore-rules-guard.test.ts`. Lee `next.config.ts` como texto.

1. **La política parsea y tiene las directivas mínimas**: `default-src 'self'`,
   `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `report-uri`.
2. **Nada de comodines peligrosos**: `script-src`, `connect-src`, `frame-src` y
   `default-src` no contienen ` * ` ni `http:` (sí se permite `https://*.dominio`).
3. **Trinquete anti-aflojamiento** (patrón E0-03): la lista de orígenes externos
   permitidos se congela en un array esperado dentro del test; **añadir uno nuevo
   obliga a tocar el test** → nadie amplía la superficie en silencio.
4. **Cruce código ↔ política** (el test que habría cazado los 3 fallos de §2):
   escanea `src/**` buscando literales `https://host` en posiciones de carga de
   navegador — `workerSrc`, `.src =`, `<iframe src`, `createElement('script')` — y
   exige que cada host esté en `script-src`/`worker-src`/`frame-src`, **o** en una
   lista explícita de exenciones con motivo escrito. Fail-closed a propósito.
5. **`RUTAS_PRIVADAS` cubre `src/app/(dashboard)/`**: lista los directorios del grupo
   y falla si alguno no está en la regex. Una pantalla nueva del dashboard sin
   protección anti-iframe **tumba el CI**. (Este es el invariante que impide que
   §2.5 vuelva a pasar.)
6. **`RUTAS_PRIVADAS` no contiene rutas fantasma**: cada entrada existe como
   directorio.
7. **El modo por defecto es `report-only`**: sin `CSP_MODE`, la cabecera emitida es
   `Content-Security-Policy-Report-Only`. Protege contra un enforce accidental.
8. **`frame-ancestors` es enforce en los dos modos** (§4.2).

Coste: ~8 casos, sin red, milisegundos. Candidato natural a entrar en el manifiesto
`scripts/invariantes-clinicos.mjs` del job `clinical-safety` (decisión menor, se puede
dejar sólo en `verificar`).

### 5.2 `e2e/seguridad.spec.ts` (Playwright, 5 navegadores)

Corre contra `baseURL` (prod por defecto, local con `PLAYWRIGHT_BASE_URL`). **Todo
sin sesión.**

**Grupo A — cabeceras (request API, rápido):**
- `A1` HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (con `camera=()`,
  `geolocation=()`, `microphone=(self)`), `COOP`, sin `x-powered-by`.
- `A2` la CSP existe en alguna de las dos claves y contiene `default-src 'self'` y
  `object-src 'none'`.
- `A3` **cada** ruta de `RUTAS_PRIVADAS` responde `X-Frame-Options: DENY` **y**
  `frame-ancestors 'none'` — parametrizado sobre la lista (cierra §2.5 y evita la
  regresión de §2.4). *Este test falla HOY contra producción: es la prueba de que el
  agujero existe.*
- `A4` `/reservar` y `/privacidad` **siguen** embebibles (`frame-ancestors *`,
  sin `X-Frame-Options`). Protege el widget de agenda incrustado de los clientes.
- `A5` `/mi/*`, `/resena/*`, `/verificar/*` → `no-referrer` + `noindex` (regresión
  conocida: el token no debe viajar en el referer).

**Grupo B — violaciones de CSP reales en navegador:**
- `B1` recorre el camino público (`/`, `/precios`, `/seguridad`, `/privacidad`,
  `/terminos`, `/contacto`, `/login`, `/registro`, `/reservar/demo`) escuchando
  `page.on('console')` + el evento `securitypolicyviolation` inyectado por
  `addInitScript`, y **exige cero violaciones**. En modo report-only detecta lo que
  *rompería*; en enforce, lo que *rompió*. Es el test que convierte "esperar una
  semana de reportes" en "una corrida de CI".
- `B2` cero errores de consola no esperados y cero requests fallidas (`response.status() >= 400`)
  en esas mismas rutas, excluyendo una allowlist explícita.

**Grupo C — superficie autenticada (sin credenciales):**
- `C1` rutas privadas sin sesión → redirigen a login o 401/403, nunca 200 con contenido.
- `C2` endpoints protegidos → 401/403 (amplía los 2 casos de
  `smoke-publico.spec.ts:47-52` a una tabla de rutas API).
- `C3` `/api/csp-report` acepta POST con cuerpo basura y responde 204 sin caerse
  (`route.ts:62-65`), y **rechaza** métodos no-POST.

**Grupo D — enforce en local (se salta si no aplica):**
- `D1` `describe.skipIf(!process.env.PLAYWRIGHT_LOCAL)`: arranca el server con
  `CSP_MODE=enforce` y repite A+B. Es la evidencia reproducible de «enforce sin
  romper flujos» **para el camino público**.
  *Ojo E0-11:* el `skipIf` es exactamente el bypass que esa unidad señaló. Mitigación:
  el job de CI que lo ejecute debe exportar `PLAYWRIGHT_LOCAL=1`, y el guardián §5.1
  añade un caso que verifica que el workflow lo exporta.

### 5.3 CI

Playwright **no** entra en `.github/workflows/ci.yml` en esta unidad: instalar 5
navegadores multiplica el tiempo de PR y no hay presupuesto acordado. Se entrega un
job **comentado y listo** en `docs/seguridad/csp-enforce.md`, y el guardián de vitest
(§5.1) sí corre en cada PR — que es donde vive el 80 % del valor de regresión.

---

## 6. Riesgo de regresión REAL sobre producción

| # | Riesgo | Probabilidad | Impacto | Mitigación en este diseño |
|---|---|---|---|---|
| R1 | El flip rompe un flujo **autenticado** no observable sin cuenta de prueba (§2.6) | **Alta si se hace a ciegas** | Alto (PHI/impresión) | El flip **no se ejecuta aquí**. Queda tras `CSP_MODE` + runbook + checklist manual del Dr. |
| R2 | Pierde `frame-ancestors 'none'` al flipar (§2.4) | Certeza si no se corrige | Medio | §4.2 reordena bloques y parametriza la política; A3 lo prueba |
| R3 | Reordenar los bloques de `headers()` altera alguna cabecera por efecto last-wins | Media | Medio | A4 y A5 fijan el comportamiento actual **antes** de tocar nada (se escriben y corren contra producción primero: red-green explícito) |
| R4 | Auto-alojar el worker de pdf.js rompe labs/antibiograma/receta-visión | Media | Alto | **No se hace en esta unidad** → decisión D-1 |
| R5 | Añadir `connect.facebook.net` global debilita la garantía de `MetaPixel.tsx:3-6` | — | Medio (privacidad) | Alcance por ruta, no global → decisión D-2 |
| R6 | El guardián §5.1-4 (cruce código↔política) da falsos positivos con literales de URL en comentarios/docs | Media | Bajo (CI rojo molesto) | Escanear sólo posiciones de carga conocidas + allowlist con motivo; el test se estrena en verde sobre el árbol actual |
| R7 | A3 deja el E2E **rojo** desde el minuto uno contra producción | Certeza | Bajo | Es lo correcto: el rojo *es* el hallazgo §2.5. Se documenta y se arregla en el mismo commit (la corrección de la lista de rutas no cambia ningún flujo) |

**Nada de esto toca** impresión, PDF, Word, firma, cobros ni reglas de Firestore.

### 6.1 Sobre `report-uri` (deprecado)

`report-uri` está deprecado en favor de `Reporting-Endpoints` + `report-to`. Chrome
todavía lo honra; Firefox y Safari tienen soporte parcial de `report-to`. Propuesta:
**emitir ambos** (`Reporting-Endpoints: csp="/api/csp-report"` + `report-to csp` junto
al `report-uri` actual). El receptor ya entiende los dos formatos
(`csp-report/route.ts:40-51`), así que es cambio de una línea y sube la cobertura de
navegadores de la fase de observación. Sin riesgo: son cabeceras informativas.

---

## 7. Decisiones que necesita el médico dueño

Ninguna es clínica (`necesitaValidacionClinica: false`). Son decisiones de **producto,
despliegue y privacidad** que la carta operativa (reglas 5 y 6) me impide tomar solo.

- **D-1 — worker de pdf.js.** ¿Auto-alojarlo en `/public/pdfjs/` (mejor: sin CDN de
  terceros ejecutando código en la sesión del médico) o permitir `unpkg.com` en la
  CSP (menos cambio, mantiene la dependencia externa)? Auto-alojar toca un flujo vivo
  (labs, antibiograma por foto, receta por visión) y merece su propia unidad con
  prueba manual.
- **D-2 — Meta Pixel / SDK de WhatsApp.** ¿Se sigue usando el Pixel
  (`NEXT_PUBLIC_META_PIXEL_ID` definido en Vercel, sí/no) y el *embedded signup* de
  `configuracion`? Si el Pixel está apagado, **no** se añade `connect.facebook.net` a
  la política y la superficie queda más pequeña. Si está encendido, se añade
  **sólo** para `/` y `/registro`.
- **D-3 — el flip.** ¿Autoriza poner `CSP_MODE=enforce` en Vercel tras (a) una semana
  de report-only ya corriendo —lleva desde el commit `f10a6df`— y (b) la matriz E2E en
  verde? La reversión es cambiar la variable y redesplegar (~2 min).
- **D-4 — cuenta de prueba E2E.** Para cubrir la zona autenticada (§2.6) hace falta un
  usuario dedicado con datos **sintéticos** en una clínica de pruebas. Es el mismo
  bloqueo que arrastra `playwright.config.ts:5-6`. Sin esto, «enforce sin romper
  flujos» nunca pasará de "probado en el camino público".
- **D-5 — Playwright en CI.** ¿Se acepta el coste (~4-6 min extra por PR, 5
  navegadores) o la matriz queda como comando manual pre-deploy?

---

## 8. Criterio de "hecho" para la implementación

1. `npx tsc --noEmit` limpio.
2. `npx vitest run` en verde, incluido `csp-guard.test.ts` nuevo (~8 casos).
3. `npm run build` OK **en los dos modos**: sin `CSP_MODE` y con `CSP_MODE=enforce`.
4. `PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test e2e/seguridad.spec.ts`
   en verde en los 5 proyectos, con el server local en **report-only** y en **enforce**.
5. Contra producción, la matriz en verde salvo A3, que queda documentado como el
   hallazgo §2.5 pendiente de deploy (regla 6: no despliego).
6. `RESULTADO.json` declara **PARCIAL** con el alcance E abierto y D-1…D-5 en
   `necesitaValidacionDelDr`.

---

## 9. Lo que este diseño NO hace (y por qué)

- **No cambia la cabecera a enforce en producción.** Regla 6.
- **No toca `src/lib/pdf-to-image.ts`.** Regla 5 → D-1.
- **No mete Playwright en el CI.** Sin presupuesto acordado → D-5.
- **No añade `'nonce-'` a `script-src`.** Quitar `'unsafe-inline'`/`'unsafe-eval'`
  exige nonces por request vía middleware para los dos scripts inline de
  `src/app/layout.tsx:86,98` (anti-flicker de tema y kill-switch del SW) y para el
  payload RSC de Next. Es un endurecimiento **posterior**, con su propio riesgo de
  pantalla en blanco; el `next.config.ts:30-33` ya lo declara fuera de fase. Debería
  ser una unidad aparte del backlog.
- **No inventa umbrales, dosis ni reglas clínicas.** No hay ninguna en esta unidad.

---

## 10. Addendum de verificación — 2026-07-29 (pasada de diseño repetida)

Esta unidad volvió a la selección porque **no tiene `RESULTADO.json`**, no porque
falte trabajo. Re-medido contra el árbol, el diseño de §1–§9 **ya está implementado y
commiteado** en `5e01c35 feat(nexus-os E0-10): CSP parametrizada + cierre de hueco
anti-clickjacking` (12 archivos, +1498 −70). Correspondencia diseño → código:

| Diseño | Estado real | Evidencia |
|---|---|---|
| §4.1 `CspMode` / `modoCsp()` / `claveCsp()` | Implementado | `next.config.ts:41-50` |
| §4.2 `politicaCsp(zona)` + doble cabecera anti-degradación | Implementado | `next.config.ts:113-166` (`cabecerasCsp`) |
| §4.3 lista única de rutas privadas | Implementado como módulo propio | `src/lib/security/rutas-privadas.ts` (34 rutas, `RE_RUTAS_PRIVADAS`), importado en `next.config.ts:3` |
| §4.4 `frame-src https://*.daily.co` | Implementado | `next.config.ts:96` (`ORIGENES_FRAME`) |
| §4.4 `unpkg.com` en `script-src`/`worker-src` | Implementado (rama D-1 = "permitir CDN") | `next.config.ts:66,70` |
| §4.4 Meta por ruta, no global | Implementado | `next.config.ts:106` (`ORIGENES_META`, fuera de la política global) |
| §6.1 `report-to` + `Reporting-Endpoints` | Implementado | `next.config.ts` (directiva `report-to csp`) |
| §5.1 guardián vitest | Implementado, **19 casos** (el diseño estimaba ~8) | `src/__tests__/csp-guard.test.ts` |
| §5.2 matriz Playwright A/B/C/D | Implementado | `e2e/seguridad.spec.ts` (grupos A1-A5, B1-B2, C1-C2, D1-D2) |
| §3 runbook + README E2E | Implementados | `docs/seguridad/csp-enforce.md`, `e2e/README.md` |
| §3 anotación en el ledger | Implementada | `docs/audit/regression-ledger.md` |

Diferencias respecto al texto de §5.2: el gate D usa `PLAYWRIGHT_ENFORCE=1`
(`e2e/seguridad.spec.ts:175`), no `PLAYWRIGHT_LOCAL`; y el bypass quedó además
cubierto por `f7f2afa`, que cerró el patrón `describe.skipIf/runIf` señalado por E0-11.

**Gates re-corridos en esta pasada (2026-07-29):**

- `npx tsc --noEmit` → limpio (exit 0).
- `npx vitest run src/__tests__/csp-guard.test.ts` → **19/19 en verde**, 108 ms.
- Playwright **NO** se ejecutó (regla 8: sólo tsc/vitest/build son gates permitidos).
  Comando documentado para el Dr. en `e2e/README.md`.

**Por tanto no queda diseño pendiente.** Lo único que falta para cerrar la unidad es:

1. Correr `npm run build` en los dos modos (sin `CSP_MODE` y con `CSP_MODE=enforce`)
   como confirmación final — el interruptor se evalúa en build.
2. Escribir `unidades/E0-10/RESULTADO.json` declarando **PARCIAL**: alcance A–D
   entregado, alcance **E (flip a enforce en producción) abierto por regla 6**.
3. Dejar D-1…D-5 (§7) en `necesitaValidacionDelDr`. Ninguna es clínica.

El estado honesto de la aceptación del backlog («CSP enforce sin romper flujos; E2E de
seguridad en verde») es: **el mecanismo del enforce está entregado y probado; el
enforce en producción no se ha ejecutado**, y la afirmación "sin romper flujos" sólo
cubre el camino público — la zona autenticada sigue sin cuenta de prueba E2E (§2.6,
decisión D-4).

---
---

# PARTE II — REDISEÑO DE CIERRE (3ª pasada, 2026-07-29)

> Esta parte **sustituye** al plan de la Parte I como diseño vigente. La Parte I ya
> está implementada en `5e01c35` + `5690e5b`; la verificación adversarial
> (`VERIFICACION.json`, veredicto `INCOMPLETA`) encontró 7 problemas (V-1…V-7) y el
> `RESULTADO.json` se retiró. Nada de lo que sigue propone reimplementar lo que ya
> existe: es el **delta mínimo** entre lo entregado y lo que un agente *puede*
> cerrar sin desplegar (regla 6) ni ejecutar servidores (regla 8).

## II.0 · Punto de partida medido HOY (no heredado)

Comprobado por mí en esta pasada, con el árbol en `fef2a23`:

| Pieza | Dónde | Estado hoy |
|---|---|---|
| Interruptor `CSP_MODE` (fail-safe a report-only) | `next.config.ts:44-52` | Existe. `CSP_MODE` **no** aparece puesto en el repo → el default sigue siendo report-only |
| Política parametrizada por zona | `next.config.ts:126-177` (`politicaCsp`, `cabecerasCsp`) | Existe. En report-only emite DOS cabeceras para no degradar `frame-ancestors` |
| Orden de bloques general → específico | `next.config.ts:210`, `259`, `263`, `274`, `289`, `293`, `297`, `312` | Existe, y está anclado por test |
| Fuente única de rutas privadas | `src/lib/security/rutas-privadas.ts:30-70` (32 entradas) | Existe. Cruzada contra disco: 30 dirs en `src/app/(dashboard)/` + `setup` + `superadmin` = 32 ✔ sin rutas fantasma |
| Guardián estático | `src/__tests__/csp-guard.test.ts` (19 casos) | Existe y es *load-bearing* (el verificador reprodujo los mutantes) |
| Matriz E2E | `e2e/seguridad.spec.ts` (A1-A5, B1-B2, C1-C2, D1-D2) | Existe. **Nunca ejecutada.** Grupo D salta salvo `PLAYWRIGHT_ENFORCE=1` (`e2e/seguridad.spec.ts:175`) |
| Runbook | `docs/seguridad/csp-enforce.md` (126 líneas, §1-§7) | Existe, con checklist manual §4 y job de CI listo para pegar §7 |
| Ledger | `docs/audit/regression-ledger.md:75-76` | **REG-054 y REG-055 ya traen la corrección de V-4** («⚠️ NO se midió contra producción… esa ejecución nunca ocurrió») |
| Contabilidad del roadmap | `estado.json → completadas` | **V-5 ya corregido**: E0-10 no está en `completadas` |

**Conclusión:** de los 7 problemas, V-4 y V-5 están cerrados. Quedan V-1, V-2 (no
cerrables por el agente), V-3, V-6 y V-7 (cerrables, y son el alcance de esta parte).

## II.1 · Qué NO se puede cerrar aquí, y por qué (sin adornos)

- **V-1 — el flip.** `next.config.ts:44-46` devuelve `enforce` sólo con la variable
  puesta. Ponerla es **desplegar** (Vercel → Environment Variables → redeploy):
  regla 6. Queda como decisión **D-3**.
- **V-2 — «E2E en verde».** Correr Playwright está prohibido por la regla 8 (no
  termina solo). Además, contra producción el grupo A3 nace rojo porque el código de
  esta unidad **no está desplegado** — eso no es un test malo, es la falta de deploy.
  Lo que sí puedo hacer es **abaratar la evidencia a un solo comando para un humano**
  (§II.4-A6) y dejar claro que el camino barato es *local*, no producción.

No hay ninguna forma honesta de que un agente marque esta unidad como `completada`.
El objetivo de esta pasada es **dejar de perder valor en cada re-diseño** y cerrar
todo lo que sí es software.

## II.2 · Alcance A — el delta implementable (5 ítems)

### A1 · Matar el mutante que sobrevivió (V-3) — *el ítem más importante*

**El problema, verificado:** `csp-guard.test.ts:12-17` afirma que el archivo habría
cazado los tres agujeros, incluido «el iframe de teleconsulta (Daily) no estaba en
`frame-src`». Es **falso**: el iframe se monta con `src` dinámico
(`src/app/teleconsulta/[citaId]/page.tsx:66-67` → `<iframe src={url}` con `url`
venida de `/api/telesalud/sala`), y ninguna de las 5 regex de `POSICIONES_DE_CARGA`
(`csp-guard.test.ts:163-169`) puede ver un host que no está en el código. Quitar
`https://*.daily.co` de `ORIGENES_FRAME` (`next.config.ts:89-101`) deja el CI verde y
la videoconsulta en blanco bajo enforce.

**Diseño (no basta con corregir el comentario: hay que crear el invariante que falta).**
Añadir a `csp-guard.test.ts` un registro de iframes de origen **dinámico** y dos
casos que lo aten a la política:

```ts
/** iframes cuyo `src` se resuelve en runtime: el host NO está en el código, así que
 *  POSICIONES_DE_CARGA no puede verlo. Cada entrada declara de dónde sale la URL y
 *  el test exige que `frame-src` permita ese origen. */
const IFRAMES_DE_ORIGEN_DINAMICO: { archivo: string; origen: string; porQue: string }[] = [
  {
    archivo: 'src/app/teleconsulta/[citaId]/page.tsx',
    origen: 'https://una-sala.daily.co',
    porQue: 'room.url que devuelve /api/telesalud/sala (Daily). Sin frame-src el iframe sale en blanco.',
  },
]

/** iframes en el código que NO monta esta app (texto que se copia a otro sitio). */
const IFRAMES_EXENTOS: Record<string, string> = {
  'src/app/(dashboard)/configuracion/page.tsx':
    'snippetIframe (línea ~2188) es una CADENA que el consultorio pega en SU web; apunta a /reservar de este mismo origen.',
}

/** Valores de una directiva concreta de la política (p.ej. `frame-src`). */
function directiva(politica: string, nombre: string): string[]
```

Tres casos nuevos:

1. **`frame-src` permite el origen de cada iframe dinámico declarado.** Se comprueba
   con `permitidoPorPolitica(host, directiva(politicaPrivada, 'frame-src'))` — *contra
   `frame-src`, no contra todos los orígenes de la política*, para que quitar
   `https://*.daily.co` **sólo** de `ORIGENES_FRAME` ponga el CI en rojo. Éste es el
   mutante que hoy sobrevive.
2. **La declaración no se podre:** cada `archivo` existe y sigue conteniendo `<iframe`.
3. **Trinquete de completitud:** escanear `src/**/*.tsx` buscando `<iframe` y exigir
   que todo archivo con un `src` **no literal** (`src={`, `src="${`) esté en
   `IFRAMES_DE_ORIGEN_DINAMICO` o en `IFRAMES_EXENTOS` con motivo. Un iframe nuevo de
   un tercero no puede entrar en silencio.

Y **corregir la frase** de `csp-guard.test.ts:12-17`: con A1 pasa a ser verdad; sin
A1 sería mentira. Se corrige **también** en el `RESULTADO` (§II.5).

### A2 · Hacer explícito y no-creciente el riesgo del proxy de Vercel (V-6)

**El problema:** la premisa «gana la última cabecera» está leída del servidor Node de
Next (`node_modules/next/dist/server/lib/router-utils/resolve-routes.js:558-560`), no
del proxy de Vercel, que es quien sirve producción. Si Vercel **acumulara** en vez de
reemplazar, el navegador aplicaría la **intersección** de las dos políticas.

**Análisis que aporta esta pasada (reduce el susto a su tamaño real):** la intersección
sólo daña a las rutas cuya política específica declara orígenes que la global **no**
tiene. Recorridas las 8 reglas de `next.config.ts`, ese conjunto es **exactamente tres**
y todas por `ORIGENES_META` (`next.config.ts:111`): `/` y `/registro/:path*` (Pixel) y
`/configuracion/:path*` (SDK de *embedded signup* de WhatsApp,
`src/app/(dashboard)/configuracion/page.tsx:953-956`). Para `frame-ancestors` **no hay
riesgo en ninguno de los dos modelos**: la política global omite la directiva
(`next.config.ts:148` + la llamada `cabecerasCsp("omitir")` de `next.config.ts:251`),
y una política sin `frame-ancestors` no
restringe el encuadre → la intersección con `'none'` sigue siendo `'none'` y con `*`
sigue siendo embebible. Es decir: **`/reservar`, `/privacidad` y toda la zona privada
son seguras bajo las dos semánticas**; el riesgo se reduce a *«el Pixel y el alta de
WhatsApp podrían dejar de cargar bajo enforce»* — visible, no silencioso, y
reversible en 2 min.

**Diseño:** un caso nuevo en `csp-guard.test.ts` que **congele ese conjunto**:

```ts
/** Rutas que reciben DOS políticas completas con orígenes DISTINTOS. Bajo Next gana
 *  la última; si el proxy de Vercel acumulara, el navegador aplicaría la
 *  INTERSECCIÓN y estas rutas perderían los orígenes que sólo declara la específica.
 *  Lista CONGELADA: que crezca exige una decisión explícita, no un descuido. */
const RUTAS_CON_POLITICA_MAS_ANCHA_QUE_LA_GLOBAL = ['/', '/configuracion/:path*', '/registro/:path*']
```

El test calcula, en modo enforce, los bloques cuyo conjunto de orígenes **no** es
subconjunto del global y compara con la lista. Así V-6 deja de ser un párrafo de
documentación y pasa a ser un invariante medible.

**Y no se hace nada más:** cerrar V-6 "de verdad" exige o (a) un `curl -sI` a un
*preview* desplegado —fuera de mis reglas—, o (b) rediseñar los bloques para que
ninguna ruta reciba dos políticas (fuente global con *negative lookahead*, o meter
Meta en la política global). (a) es un paso de runbook (§II.4-A6); (b) es un cambio
de riesgo medio en las cabeceras de **todas** las rutas y por regla 5 se entrega como
**decisión D-7**, no se ejecuta a ciegas. Además, si el Dr. contesta **D-2** («el
Pixel está apagado»), el conjunto baja de 3 rutas a 1 y el riesgo se vuelve casi
inexistente — es la salida más barata.

### A3 · Convertir la comprobación manual del verificador en un artefacto repetible

El verificador comprobó a mano que `.next/routes-manifest.json` emite
`Content-Security-Policy-Report-Only` sin variable y `Content-Security-Policy` con
`CSP_MODE=enforce`. Eso es **lo que Vercel consume de verdad**, un paso más cerca de
producción que `nextConfig.headers()`.

**Diseño:** `src/__tests__/csp-manifest.test.ts`, opt-in y honesto:

- Si `.next/routes-manifest.json` **no existe** → `it.skip` con mensaje que dice el
  comando exacto. No inventa verde.
- Si existe → comprueba (1) que la clave CSP del bloque `/:path*` corresponde al modo
  con el que se construyó, leído de un marcador propio, y (2) que el bloque privado
  conserva `X-Frame-Options: DENY` y una CSP con `frame-ancestors 'none'` en la clave
  que bloquea.
- Para no adivinar el modo del build: el propio `next.config.ts` ya escribe la clave;
  el test **deriva** el modo de la clave presente y verifica la coherencia interna del
  manifest (que privadas y `/reservar` sigan correctas **en el modo que sea**). Así
  vale para los dos builds y no necesita ninguna variable.

Coste: un archivo de test. Riesgo en producción: **cero** (no toca runtime).

### A4 · `/login` a la zona anti-iframe (V-7a)

`src/app/login` existe (verificado) y **no** está en `RUTAS_PRIVADAS`
(`rutas-privadas.ts:30-70`), así que hoy la pantalla de credenciales es embebible —
el blanco clásico de clickjacking, en la unidad cuyo objetivo es precisamente ése. No
es una regresión de E0-10; es un hueco que esta unidad tiene delante.

**Diseño:** añadir `'login'` al array. Efecto: `/login` empieza a devolver
`X-Frame-Options: DENY` + `frame-ancestors 'none'` (esta última **es enforce ya hoy**,
`next.config.ts:166-170`: en report-only se emite aparte en la clave que bloquea, así
que no espera al flip). El caso A3 del E2E lo cubre automáticamente
(itera `RUTAS_PRIVADAS`), y el test de rutas fantasma sigue pasando porque el
directorio existe.

**Riesgo real:** si alguien embebiera `/login` en un iframe legítimo, se rompería. No
encontré ningún consumidor: el único iframe hacia dentro de la app en todo el código
es el *snippet* de `/reservar` que el consultorio pega en su web
(`configuracion/page.tsx:2188`). Se implementa.

**`/registro` NO se toca** aunque comparta el problema: hoy recibe `zona: 'omitir'`
(`next.config.ts:293-295`) por ser superficie de marketing, y volverlo no-embebible es
una decisión de producto sobre una página de captación → **D-6**, con el cambio
preparado (una línea: `cabecerasCsp("ninguno", { meta: true })` + `X-Frame-Options`).

### A5 · `Permissions-Policy: camera=()` vs teleconsulta (V-7b) — se documenta, no se toca

`next.config.ts:226-236` cierra la cámara para todo el origen (`"camera=()"`, línea 229) mientras
`teleconsulta/[citaId]/page.tsx:69` monta el iframe con
`allow="camera; microphone; fullscreen; speaker; display-capture"`. Una
`Permissions-Policy` del documento superior **no se puede re-conceder** desde el
`allow` del iframe: si la cabecera está activa, la cámara de la videoconsulta ya
estaría muerta **hoy** (es previo a esta unidad y nada de esto depende del flip).

No lo cambio: abrir la cámara del origen es endurecimiento a la inversa y toca un
flujo vivo (regla 5). Y **no puedo** comprobar si el vídeo funciona hoy: eso exige
producción y una cita real. Se entrega como **decisión D-8** con la pregunta concreta,
y `e2e/seguridad.spec.ts:49-51` conserva la aserción con un comentario que la marca
como *estado actual documentado*, no como *estado deseado*.

## II.3 · Archivos que se tocan

| Archivo | Qué | Riesgo |
|---|---|---|
| `src/__tests__/csp-guard.test.ts` | A1 (registro de iframes dinámicos + 3 casos), A2 (1 caso), corregir la frase de las líneas 12-17 | Ninguno en runtime |
| `src/__tests__/csp-manifest.test.ts` **(nuevo)** | A3 | Ninguno en runtime |
| `src/lib/security/rutas-privadas.ts` | A4: `+ 'login'` y la nota de por qué | **Cambia cabeceras de `/login` en producción** (intencionado, reversible) |
| `e2e/seguridad.spec.ts` | A5: comentario en la aserción de `camera=()`; nada funcional | Ninguno (nunca se ejecuta en CI) |
| `docs/seguridad/csp-enforce.md` | §3 gana el paso «curl al preview para determinar la semántica del proxy» (V-6); §5 se corrige (el guardián caza 3 de 3 **tras A1**); §2 gana el comando local que da el verde de la matriz sin desplegar | Documentación |
| `docs/audit/regression-ledger.md` | REG-056 (nuevo): `/login` embebible → cerrado en código, pendiente de despliegue. REG-055 gana el análisis de intersección de A2 | Documentación |
| `src/lib/clinical/invariantes-clinicos.json` | `minCasos` de `csp-guard.test.ts` 19 → 23 (A1 aporta 3 casos, A2 uno; A4 va dentro de un caso existente) y `totalCasos` 1381 → 1385. `csp-manifest.test.ts` **no** se sella: puede saltarse legítimamente y el trinquete cuenta `it(` por texto, así que sellarlo contaría cobertura que a veces no corre | El gate es un trinquete `>=` (`clinical-safety-gate.test.ts:96-121`): subir no rompe |
| `package.json` | scripts `e2e:seguridad` y `e2e:seguridad:enforce` (**definir**, no ejecutar) | Ninguno |
| `docs/roadmap/nexus-os/unidades/E0-10/RESULTADO.parcial.json` | Acta honesta (§II.5) | Documentación |
| `estado.json` | E0-10 a `bloqueadas` con motivo «espera D-3 (flip) + una corrida humana de la matriz»; D-6/D-7/D-8 a `decisionesPendientesDelMedico` | Documentación |

**Nada de lo anterior toca** impresión, PDF, Word, firma, cobros, reglas de Firestore
ni un solo motor clínico. El único cambio de comportamiento en producción es
`/login` no-embebible (A4).

## II.4 · Qué prueba cada cosa (y el control negativo obligatorio)

Gates permitidos: `npx tsc --noEmit`, `npx vitest run src/__tests__/`, `npm run build`.

| Ítem | Prueba | Control negativo que DEBE ponerse rojo (se ejecuta en un sandbox del scratchpad, no en el repo) |
|---|---|---|
| A1 | 3 casos en `csp-guard.test.ts` | Quitar `https://*.daily.co` de `ORIGENES_FRAME` **y** de `ORIGENES_ESPERADOS` → hoy da 19/19 verde; con A1 debe fallar con «frame-src no permite …daily.co». **Este mutante es el criterio de éxito de A1.** Segundo mutante: añadir un `<iframe src={x}>` nuevo sin declararlo → rojo por el trinquete |
| A2 | 1 caso | Añadir `ORIGENES_META` a un cuarto bloque (p.ej. `/precios`) → rojo por lista congelada |
| A3 | `csp-manifest.test.ts` tras `npm run build` en los dos modos | Editar a mano el manifest para que privadas pierdan `X-Frame-Options` → rojo. Y sin `.next/` → skip **con mensaje**, nunca verde vacuo |
| A4 | A3 del E2E (no ejecutable) + `csp-guard.test.ts:262-267` (fantasmas) | Quitar `login` del array tras añadirlo no rompe nada por sí solo → **por eso A4 se acompaña de un caso explícito** en el bloque «cubre las pantallas con PHI y la consola del dueño» que exige `login` en la lista |
| A6 (docs) | — | — |

**A6 · Abaratar la evidencia de V-2 a un solo comando humano.** Lo que hace verde a
la matriz **sin desplegar nada** ya está soportado por `playwright.config.ts:22-45`.
Se documenta en el runbook §2 y como script:

```bash
# 1) report-only (default) — grupos A/B/C
npm run build && PLAYWRIGHT_LOCAL=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  npx playwright test e2e/seguridad.spec.ts --project=chromium

# 2) enforce — grupos A/B/C/D  (CSP_MODE se lee en el BUILD)
CSP_MODE=enforce npm run build && PLAYWRIGHT_LOCAL=1 PLAYWRIGHT_ENFORCE=1 \
  PLAYWRIGHT_BASE_URL=http://localhost:3000 CSP_MODE=enforce \
  npx playwright test e2e/seguridad.spec.ts --project=chromium
```

**No los ejecuto (regla 8).** Con (2) en verde, la mitad *«E2E de seguridad en verde»*
de la aceptación queda demostrada **en local, con la política apretada** — que es la
evidencia relevante para autorizar D-3. Contra producción seguirá roja hasta el deploy.

## II.5 · Criterio de "hecho" de esta pasada (y qué acta se escribe)

1. `npx tsc --noEmit` limpio.
2. `npx vitest run src/__tests__/` verde, con `csp-guard.test.ts` en **23 casos** y
   los dos mutantes de A1 reproducidos y **documentados en el acta**.
3. `npm run build` OK en los dos modos, y `csp-manifest.test.ts` verde tras cada uno.
4. Se escribe **`RESULTADO.parcial.json`**, no `RESULTADO.json`. Razón: el criterio de
   reconciliación (`estado.json → reconciliacionDisco`) trata `RESULTADO.json` como
   *prueba de que la unidad está hecha*, y la aceptación literal **no** se cumple. Un
   `RESULTADO.json` aquí volvería a retirarse en la siguiente pasada: es el bucle que
   ya consumió tres corridas en esta unidad.
5. E0-10 queda en `bloqueadas` con motivo exacto: *«software cerrado; espera D-3
   (variable en Vercel) y una ejecución humana de la matriz — ninguna de las dos la
   puede hacer el agente»*. Así deja de volver a la cola como si faltara diseño.

## II.6 · Decisiones que necesita el médico dueño (ninguna es clínica)

Siguen abiertas **D-1…D-5** (§7). Esta parte añade tres, todas de producto/despliegue:

- **D-6 — ¿`/registro` deja de ser embebible?** Es una página de captación con Pixel.
  Ganancia: cierra el mismo hueco que `/login`. Coste: si alguna landing o socio la
  embebe, se rompe. Cambio preparado, una línea.
- **D-7 — ¿se rediseñan los bloques de cabeceras para que ninguna ruta reciba dos
  políticas CSP?** Elimina para siempre la dependencia de una semántica del proxy de
  Vercel que **nadie ha verificado** (V-6). Coste: toca las cabeceras de *todas* las
  rutas (regla 5). Alternativa barata y recomendada: contestar **D-2** (si el Pixel
  está apagado, el conjunto de riesgo baja de 3 rutas a 1).
- **D-8 — ¿funciona hoy el vídeo de la teleconsulta en producción?** La cabecera
  global declara `camera=()` y el iframe de Daily pide `allow="camera"`. Si el vídeo
  **no** funciona, es un fallo vivo previo a esta unidad y merece su propia unidad
  (abrir `camera=(self)` es aflojar una cabecera de seguridad: no se hace de oficio).
  Si **sí** funciona, hay que entender por qué y ajustar la aserción del E2E. Requiere
  una observación en producción que el agente no puede hacer.

## II.7 · Riesgo de regresión (evaluación honesta)

**Riesgo bajo, y concentrado en un único punto.** Justificación:

- 4 de los 5 ítems son **tests y documentación**: no pueden romper producción.
- El único cambio de comportamiento es `/login` no-embebible (A4). Reversión: borrar
  una línea. Sin consumidores encontrados en el código.
- El default de la CSP **no se mueve**: sigue `report-only` sin `CSP_MODE`
  (`next.config.ts:44-46`), verificado en esta pasada.
- El riesgo *real* de la unidad sigue viviendo fuera del código: el día que alguien
  ponga `CSP_MODE=enforce`, los flujos del checklist manual del runbook §4 (worker de
  pdf.js, Daily, Stripe, SDK de Meta, login de Google) son los que pueden romperse.
  Esta parte no lo cambia; lo que hace es que **quitar uno de esos orígenes por
  descuido tumbe el CI**, que es lo que el guardián no lograba con el iframe dinámico.
