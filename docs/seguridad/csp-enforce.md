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

## 2. Probarlo en local antes de tocar producción

```bash
# 1. Modo actual (report-only)
npm run build && npm start
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test e2e/seguridad.spec.ts

# 2. Modo apretado — la evidencia de "enforce sin romper flujos"
CSP_MODE=enforce npm run build && CSP_MODE=enforce npm start
PLAYWRIGHT_ENFORCE=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  npx playwright test e2e/seguridad.spec.ts
```

Resultado medido el 2026-07-29 (proyecto `chromium`): **57/57 en verde con
`CSP_MODE=enforce`**, camino público. Ver §5 para lo que esto NO cubre.

## 3. El flip en producción (decisión del médico dueño)

1. Vercel → Project → Settings → Environment Variables → `CSP_MODE = enforce`
   (**Production**).
2. Redeploy.
3. Comprobar en caliente:
   ```bash
   curl -sI https://<dominio>/ | grep -i content-security-policy
   npx playwright test e2e/seguridad.spec.ts   # contra producción
   ```
4. Recorrer a mano, con sesión, la lista de §4. Es la parte que ningún test
   automático cubre hoy.

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
- **«Enforce sin romper flujos» está probado sólo para el camino público** y sólo
  en `chromium` (los binarios de firefox/webkit no estaban instalados en la máquina
  donde se corrió). La zona autenticada depende del checklist manual de §4.
- El grupo A3 de la matriz **está rojo contra producción** hasta que se despliegue
  esta unidad: 22 de 34 rutas privadas no llevan cabecera anti-iframe (REG-054).
  Ese rojo es el hallazgo, no un test mal escrito.

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

- **`Permissions-Policy: camera=()` vs teleconsulta.** La cabecera global cierra la
  cámara para todo el origen, mientras `teleconsulta/[citaId]/page.tsx` embebe un
  iframe con `allow="camera; microphone"`. Es anterior a esta unidad y no se toca
  aquí, pero conviene verificarlo en la prueba manual de §4.

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
