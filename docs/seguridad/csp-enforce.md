# CSP: de report-only a enforce — runbook

Unidad Nexus OS **E0-10**. Este documento es lo que hay que leer *antes* de tocar la
variable `CSP_MODE` en Vercel, y lo que hay que seguir *si algo se rompe después*.

---

## 1. Cómo funciona el interruptor

La política vive en `next.config.ts` y se emite bajo una clave u otra según una
variable de entorno **de build**:

| `CSP_MODE` | Cabecera emitida | Efecto |
|---|---|---|
| *(sin definir)* | `Content-Security-Policy-Report-Only` | **Default.** No bloquea nada; sólo reporta a `/api/csp-report`. |
| `enforce` | `Content-Security-Policy` | Bloquea de verdad. |
| cualquier otro valor | `Content-Security-Policy-Report-Only` | Fail-safe: un typo nunca empieza a bloquear. |

Se evalúa en el **build**, no por request: cambiar la variable en Vercel exige
redeploy. A cambio, flip y reversión son una variable, no un cambio de código.

`frame-ancestors` es un caso aparte: **siempre viaja en modo enforce**, en los dos
modos. Antes de E0-10 esto se rompía al flipar (ver REG-055).

## 2. Probarlo en local antes de tocar producción — DOS comandos

Esto es lo que convierte «esperar una semana de reportes» en una corrida, y **no
necesita desplegar nada**. El servidor local lo arranca Playwright solo
(`playwright.config.ts` → `webServer`, activo con `PLAYWRIGHT_LOCAL=1`, ya incluido en
los scripts):

```bash
# 1. Modo actual (report-only) — grupos A/B/C
npm run build && npm run e2e:seguridad

# 2. Modo apretado — la evidencia de "enforce sin romper flujos" (grupos A/B/C/D)
#    CSP_MODE se lee en el BUILD, así que va en las DOS órdenes.
CSP_MODE=enforce npm run build && npm run e2e:seguridad:enforce
```

Con (2) en verde queda demostrada, **en local y con la política apretada**, la mitad
«E2E de seguridad en verde» de la aceptación — que es la evidencia relevante para
autorizar el flip (§3). Contra producción (`npm run e2e:seguridad:prod`) el grupo A3
seguirá **rojo** hasta que se despliegue esta unidad.

> ⚠️ **Nadie ha ejecutado todavía estos dos comandos.** Una versión previa de esta
> sección afirmaba «57/57 en verde con `CSP_MODE=enforce`, medido el 2026-07-29»: esa
> ejecución **no consta** y el agente que escribió la unidad no puede correr Playwright
> (regla 8 de la carta operativa: prohibido lanzar procesos que no terminan solos).
> Corregido el 29-jul-2026. Lo que **sí** está ejecutado y en verde es el guardián
> estático (`npx vitest run src/__tests__/csp-guard.test.ts`, 23 casos) y, tras un
> `npm run build`, `src/__tests__/csp-manifest.test.ts` (4 casos sobre el artefacto real
> del build).

## 3. El flip en producción (decisión del médico dueño)

1. Vercel → Project → Settings → Environment Variables → `CSP_MODE = enforce`
   (**Production**).
2. Redeploy.
3. Comprobar en caliente:
   ```bash
   curl -sI https://<dominio>/ | grep -i content-security-policy
   npm run e2e:seguridad:prod                 # contra producción
   ```
4. Recorrer a mano, con sesión, la lista de §4. Es la parte que ningún test
   automático cubre hoy.

**Paso 0 — determinar la semántica del proxy de Vercel (una sola vez, en un preview).**
El «gana la última cabecera» está leído del servidor Node de Next
(`resolve-routes.js`), **no** del proxy de Vercel que sirve producción. Antes del flip,
sobre un deployment de *preview*:

```bash
curl -sI https://<preview>/ | grep -ci '^content-security-policy'   # ¿1 o 2?
curl -sI https://<preview>/registro | grep -i '^content-security-policy'
```

- **1 cabecera** → reemplaza (lo asumido): nada más que hacer.
- **2 cabeceras** → acumula: el navegador aplica la **intersección**, y las tres rutas
  con política más ancha que la global (`/`, `/registro`, `/configuracion` — congeladas
  en `src/__tests__/csp-guard.test.ts`) perderían los orígenes de Meta bajo enforce:
  el Pixel deja de medir y el alta de WhatsApp deja de funcionar. Es **visible, no
  silencioso**, y se revierte en 2 min. `frame-ancestors` **no** corre riesgo en ninguna
  de las dos semánticas (la política global omite la directiva, así que la intersección
  con `'none'` sigue siendo `'none'`). Salida barata: si el Pixel está apagado
  (decisión D-2), el conjunto de riesgo baja de 3 rutas a 1.

**Reversión (~2 min):** borrar la variable (o ponerla a `report-only`) y redesplegar.
No hay migración de datos, ni estado, ni nada que revertir en Firestore.

## 4. Checklist manual con sesión (lo que el E2E no puede probar)

No existe cuenta de prueba (`playwright.config.ts`), así que la zona autenticada se
verifica a mano. Cada punto es un sitio donde una CSP apretada rompe *en silencio*:

- [ ] Subir un **PDF de laboratorio** y ver que se convierte a imagen (worker de
      pdf.js desde `unpkg.com`).
- [ ] **Antibiograma por foto** y **receta por visión** (mismo worker).
- [ ] **Imprimir / PDF** de nota y receta (`html2pdf.js` usa `blob:` y canvas).
- [ ] **Teleconsulta**: el iframe de Daily muestra vídeo, no un rectángulo en blanco.
- [ ] **Dictado por voz** (micrófono + workers de audio).
- [ ] **Configuración → conectar WhatsApp** (SDK de Facebook).
- [ ] **Pago con Stripe** (checkout embebido).
- [ ] **Login con Google** (popup de `accounts.google.com`).

Si algo falla: mirar la consola del navegador (`Refused to load … because it
violates the following Content Security Policy directive`), anotar el origen y
volver a report-only mientras se añade a la política.

## 5. Lo que esta unidad NO afirma

- **No se ha flipado producción.** Lo entregado es el mecanismo, la política
  corregida y la matriz de pruebas. El flip es decisión del Dr. (§3).
- **«Enforce sin romper flujos» NO está probado en navegador todavía**: la matriz
  nunca se ha ejecutado (§2). Cuando se ejecute, cubrirá el **camino público**; la zona
  autenticada seguirá dependiendo del checklist manual de §4 mientras no exista cuenta
  de prueba (decisión D-4).
- El grupo A3 de la matriz **está rojo contra producción** hasta que se despliegue
  esta unidad: la mayoría de las rutas privadas no llevan cabecera anti-iframe en
  producción (REG-054). Ese rojo es el hallazgo, no un test mal escrito.
- **El guardián estático caza los tres agujeros de la política** (`unpkg.com`,
  `*.daily.co`, pantallas sin cabecera anti-iframe) desde la pasada de cierre. Antes
  sólo cazaba dos: el iframe de Daily monta un `src` dinámico y ninguna regex podía
  verlo; ahora está declarado en `IFRAMES_DE_ORIGEN_DINAMICO` y atado a `frame-src`.
  Control negativo ejecutado: quitar `https://*.daily.co` de `ORIGENES_FRAME` pone el
  CI en rojo (antes quedaba verde con la videoconsulta muerta bajo enforce).

## 6. Hallazgos abiertos anotados aquí

- **`api.qrserver.com` en el enrolamiento de MFA.**
  `src/app/(dashboard)/cumplimiento/seguridad/page.tsx:176` genera el QR de 2FA
  mandando la URL `otpauth://…` —que **contiene el secreto TOTP**— en la query
  string de un tercero. La CSP no lo bloquea (`img-src` permite `https:` en
  general) y por eso está exento en `csp-guard.test.ts`, con este motivo escrito.
  **No es una bendición: es un hallazgo de privacidad pendiente.** El repo ya
  depende de `qrcode`, así que el QR se puede generar en el cliente sin que el
  secreto salga del navegador. Cambiarlo toca el flujo de alta de MFA (regla 5 de
  la carta operativa) → unidad aparte, con prueba manual del enrolamiento.

- **`Permissions-Policy: camera=()` vs teleconsulta — decisión D-8.** La cabecera
  global cierra la cámara para todo el origen, mientras
  `teleconsulta/[citaId]/page.tsx` embebe un iframe con `allow="camera; microphone"`.
  Una Permissions-Policy del documento superior **no** se re-concede desde el `allow`
  del iframe: si la cabecera está activa, el vídeo ya estaría muerto **hoy**, sin
  relación con el flip. Es anterior a esta unidad y no se toca aquí (abrir la cámara del
  origen es aflojar una cabecera de seguridad → unidad aparte). **Pregunta concreta para
  el Dr.: ¿funciona hoy el vídeo de la teleconsulta en producción?** Si no funciona, es
  un fallo vivo previo; si funciona, hay que entender por qué y ajustar la aserción de
  `e2e/seguridad.spec.ts` (A1), que hoy fija `camera=()` como *estado documentado*.
  Requiere una observación en producción que el agente no puede hacer.

## 7. Playwright en CI (pendiente de decisión: coste)

No se añade en esta unidad (≈4-6 min extra por PR con 5 navegadores). El guardián
`src/__tests__/csp-guard.test.ts` sí corre en cada PR y es donde vive el grueso del
valor de regresión. Job listo para pegar en `.github/workflows/ci.yml` cuando el Dr.
acepte el coste:

```yaml
  seguridad-e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npm start &
      - run: npx wait-on http://localhost:3000
      - run: npx playwright test e2e/seguridad.spec.ts --project=chromium
        env:
          PLAYWRIGHT_BASE_URL: http://localhost:3000
```
