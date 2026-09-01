# Seguridad — lo comprobable desde dentro, corrido el 1-sep-2026

> **Qué es esto.** El acta de lo que se puede verificar **sin salir del
> contenedor**, sobre el árbol `97b2a312`. Lo que exige un tercero, un dispositivo
> o el proyecto vivo se declara abajo como `BLOCKED_EXTERNAL`, con la acción
> exacta que lo desbloquea.

## 1 · Las reglas de Firestore, contra el emulador

```bash
npm run test:emulador
→ Test Files 6 passed (6) · Tests 140 passed (140)
```

Es la corrida que importa para el aislamiento: aquí quien decide si un médico del
consultorio A puede leer el expediente del B **es la regla desplegable**, no una
promesa del código de aplicación.

## 2 · La matriz de cabeceras y CSP, contra el servidor local

```bash
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  npm run e2e:seguridad
→ 57 passed · 0 failed · 2 skipped
```

**La primera corrida dio 48 verdes y 9 caídos**, y no por el producto: la
escotilla `PLAYWRIGHT_CHROMIUM_PATH` —para entornos con un Chromium que no es la
build exacta que pide Playwright— estaba **sólo en el proyecto del teléfono**.
Los nueve que caían son justo los que **necesitan navegador** (grupo B, la CSP en
ejecución); los de cabeceras pasan por petición cruda. O sea que el hueco se
llevaba la mitad que sólo se puede ver ejecutando, y dejaba la otra en verde.
Corregido en **REG-430**.

Los 2 saltados son el grupo D, que exige arrancar el servidor con
`CSP_MODE=enforce`: es otra corrida, y se declara en vez de contarse.

## 3 · Aislamiento entre consultorios, medido dos veces más

| Dónde | Qué se midió |
|---|---|
| Arnés de carga (`WS-02.registrados-2000`) | **0 fugas en 156 sondas** de lectura y escritura cruzadas, con `firestore.rules` cargadas |
| Recorrido GP-FINAL | `GP-T2` — el médico de B **no** puede emitir un enlace de un paciente de A (propio 200 · ajeno 403); `GP-T3` — un token no se puede reapuntar a otro consultorio sin romper la firma (401); `TOR-H1/H2/H3` — lo del paciente 2 no aparece en el expediente del 1, comprobado **en la base** |
| Simulacro de recuperación | `ruta-de-otro-consultorio` y `referencia-interna-forastera` → `REVISION_HUMANA`; `re-enraizado-a-otro-consultorio` → **no se escribe** |

## 4 · El portal del paciente

| | |
|---|---|
| Revocación | `GP-31`: un enlace ya emitido pasa de 200 a **401** al revocar |
| Firma alterada | `GP-32`: **401** |
| Enlace de mostrador | `GP-26d`: **403** — no abre el expediente |
| `DRAFT` no sale | `GP-26c`: en la base `DRAFT,RELEASED`; el portal devuelve **sólo** `RELEASED` |
| Freno ante ráfaga | `GP-33`: 40 peticiones en paralelo → **`{200:10, 429:30}`**. El freno cuenta y corta. Ver REG-428: el caso no distinguía «no hay freno» de «no dejó pasar», y ahora lo dice |
| Sin sesión no se escribe | `TOR-P`: **401** |
| IA caída | `TOR-O`: la respuesta **no filtra jerga técnica ni secretos** |

## 5 · PHI en registros

El aviso nuevo de `conRespaldoSinIndice` (REG-424) usa `safeLog` y nombra **sólo
el índice** — ni paciente, ni consultorio, ni contenido. El backfill de
`pesoUrgencia` imprime **recuentos, nunca contenido**, por la regla
`data-privacy.md`.

---

## `BLOCKED_EXTERNAL` — lo que no se puede cerrar desde aquí

| Qué falta | La acción exacta que lo desbloquea |
|---|---|
| **Pentest externo** | Contratar uno. No se marca PASS sin un informe real; ninguna corrida interna lo sustituye |
| **Cabeceras de PRODUCCIÓN** | `npm run e2e:seguridad:prod` **después** de publicar, que es donde son accionables (`deployment-and-flags.md`). Desde este contenedor la red rechaza la conexión al sitio vivo |
| **CSP en modo `enforce`** | Arrancar con `CSP_MODE=enforce` y correr `npm run e2e:seguridad:enforce` — el grupo D. Es una corrida distinta, no un hueco tapado |
| **WebKit / iPhone** | Añadir `cdn.playwright.dev` y `playwright.download.prss.microsoft.com` a la política de red del entorno, o un iPhone real. Comprobado hoy: **403 «request blocked: no rule or allowlist entry allows host»**, confirmado por el proxy como denegación de política |
| **App Check y `OPS_ALERTA_WEBHOOK`** | Confirmarlos en el proyecto vivo |
| **MFA exigido en el servidor** | Sigue `planned` en `security-controls.ts`. Es trabajo de producto, no una corrida |
| **Certificaciones y estudio clínico** | Terceros. Nada interno los sustituye |
