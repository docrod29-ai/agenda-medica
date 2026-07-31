# Pruebas E2E (Playwright)

Dos archivos:

| Archivo | Qué cubre |
|---|---|
| `smoke-publico.spec.ts` | Que el camino público carga (landing, login, páginas legales, robots, sitemap). |
| `seguridad.spec.ts` | Matriz de **seguridad**: cabeceras, CSP, anti-clickjacking, endpoints protegidos (unidad Nexus OS E0-10). |

## Cómo se corre

```bash
# Contra producción (es el baseURL por defecto)
npx playwright test

# Contra un servidor local ya arrancado
npm run build && npm start
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test e2e/seguridad.spec.ts

# Un solo navegador (los binarios de firefox/webkit hay que instalarlos aparte)
npx playwright test --project=chromium
```

Variables:

| Variable | Para qué |
|---|---|
| `PLAYWRIGHT_BASE_URL` | Contra qué URL corre todo. Default: producción. |
| `PLAYWRIGHT_LOCAL=1` | Hace que Playwright arranque `npm run start` él mismo (`webServer`). |
| `PLAYWRIGHT_ENFORCE=1` | Activa el grupo **D**, que exige que la CSP llegue en la cabecera que BLOQUEA. Sólo tiene sentido contra un servidor construido con `CSP_MODE=enforce`. |

## Qué significa cada grupo de `seguridad.spec.ts`

- **A1/A2** — cabeceras de endurecimiento y CSP presentes.
  *Si falla:* alguien tocó el bloque global de `next.config.ts`.
- **A3** — cada ruta privada (`src/lib/security/rutas-privadas.ts`) responde
  `X-Frame-Options: DENY` **y** `frame-ancestors 'none'` en cabecera *enforce*.
  *Si falla contra producción:* es el hallazgo REG-054 — hay pantallas con PHI
  embebibles. Estará rojo hasta que se despliegue la unidad E0-10.
  *Si falla en local:* se sacó una ruta de la lista.
- **A4** — `/reservar` y `/privacidad` **siguen** siendo embebibles.
  *Si falla:* se acaba de romper el widget de agenda que los consultorios
  incrustan en su propia web. Es una regresión visible para clientes.
- **A5** — las rutas con token del paciente no filtran el token por `referer`.
- **B1** — se recorre el camino público escuchando `securitypolicyviolation`.
  El evento se dispara también en report-only, así que esto detecta lo que
  *rompería* el flip antes de hacerlo.
  *Si falla:* la página carga un origen que la política no declara → añadirlo en
  `next.config.ts` (y en el trinquete de `src/__tests__/csp-guard.test.ts`), o
  quitar la dependencia.
- **B2** — ningún recurso del camino público responde ≥400 (401/403 exceptuados).
- **C1/C2** — endpoints protegidos rechazan sin sesión; `/api/csp-report` traga
  cuerpos basura sin caerse y rechaza GET.
- **D** — sólo con `PLAYWRIGHT_ENFORCE=1`: la evidencia de que la política apretada
  no rompe el camino público.

## Limitación honesta

**No hay cuenta de prueba.** Todo esto corre *sin sesión*, así que la zona
autenticada —expediente, nota, receta/impresión, farmacia, UCI— no está cubierta, y
es justo donde una CSP apretada puede romper algo en silencio (un `blob:`, un
worker, una imagen de Storage). Mientras no exista un usuario dedicado con datos
**sintéticos** en una clínica de pruebas, la afirmación «enforce sin romper flujos»
sólo vale para el camino público. El sustituto manual está en
`docs/seguridad/csp-enforce.md` §4.
