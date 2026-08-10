# V10-TRUTH-001 — auditoría de verdad en navegador (parte 1)

> **Programa**: V10 · 10-ago-2026 · primera ejecución real
> **Método**: la aplicación **corriendo** (`next dev`, Chromium 1440×900 y
> 390×844), capturas en `docs/design/screenshots/v10/`, consola y red vigiladas.
> Complementa —no repite— las auditorías estáticas de V9
> (`CURRENT_PRODUCT_DESIGN_AUDIT.md`, `GENERIC_AI_AESTHETIC_AUDIT.md`,
> `NAVIGATION_STATE_AUDIT.md`), que siguen siendo válidas.
> **Alcance de esta parte**: superficie pública + entrada del golden flow
> (`SIGNUP → TRIAL`) + demo clínica offline. Las 33 pantallas `medico` no se
> pueden ver corriendo en este entorno (B-1 en `agent-state/V10_BLOCKERS.md`):
> **no se puntúan** — la spec prohíbe puntuar desde el código.

## §1 — Lo que se vio corriendo

| Ruta | Escritorio | Móvil | Estado |
|---|---|---|---|
| `/` | ✅ vista | ✅ vista | puntuada |
| `/precios` | ✅ vista | capturada | puntuada |
| `/registro` | ✅ vista | ✅ vista | puntuada |
| `/login` | ✅ vista | capturada | puntuada |
| `/demo/interactivo` (agenda → dictado → nota → receta) | ✅ vista | capturada | puntuada |
| `/demo`, `/demo/razonamiento` | capturadas | capturadas | **sin puntuar** — no se miraron con calma |
| `/dashboard` sin sesión | ✅ vista | ✅ vista | redirige limpio a `/login` ✅ |

## §2 — Hallazgos

### D-1 · Desajuste de hidratación en TODAS las páginas — **REPARADO en este run**

El script anti-parpadeo del `<head>` pone `data-theme` en `<html>` antes de que
React hidrate; el HTML del servidor no lo trae. React 19 lo trataba como error
de hidratación **en cada carga de cada página** (consola sucia siempre; en
producción, recuperación re-pintando desde la frontera). Arreglo canónico según
la guía del propio Next incluido en `node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`:
`suppressHydrationWarning` en el `<html>` (silencia **sólo** atributos de ese
elemento). Verificado corriendo: **0 errores de consola** en `/`, `/precios`,
`/login`, `/demo/interactivo` tras el cambio. Guardia de regresión pendiente:
la suite visual (V10-VISUAL-REGRESSION-001) debe afirmar consola limpia.

### D-2 · Afordancias del demo interactivo (P3, sólo demo)

- Las píldoras del paso (`Agenda — Dictado — Nota — Receta/Orden`) **parecen
  pestañas pulsables y no lo son**: son estado. Un visitante que las pulsa no
  recibe respuesta.
- «Generar nota» está habilitado **antes de que exista transcripción** y
  mientras la grabación simulada sigue corriendo. En el producto real esa
  secuencia la protege el flujo clínico; en el demo —el primer contacto de un
  comprador— la secuencia debería guiar igual.

### D-3 · Verdades que ya están bien (que nadie las «arregle»)

- `/dashboard` sin sesión redirige a `/login` sin pantalla rota intermedia.
- El registro móvil oculta el panel de valor y deja **una** columna enfocada:
  revelación progresiva correcta.
- El estado de grabación del demo usa rojo + cronómetro + botón «Detener»
  visible: inconfundible.
- La identidad (oscura, serif de marca, azul contenido, motivo ECG) es
  coherente en las 5 superficies vistas — no hay cara de plantilla.

## §3 — Puntuaciones (evidencia: capturas en `screenshots/v10/`)

Rúbrica: `docs/evals/V10_VISUAL_RUBRIC.md`. Promedio de las 12 dimensiones;
GENERIC_AI_LOOK aparte (menor = mejor). Son pantallas **públicas**, no las
críticas de Practice: la meta ≥9.3 aplica a las críticas, que aún no se pueden
ver (B-1).

| Pantalla | Visual | Generic-AI | Nota dominante |
|---|---:|---:|---|
| `/` | 8.7 | 1.5 | Marca fuerte; el resplandor del hero es decorativo pero contenido; la rejilla de 6 tarjetas de funciones es el patrón más genérico de la página |
| `/precios` | 8.5 | 2.0 | Denso y transparente (tabla clínica por nivel de IA — bien); vocabulario de palomitas y emojis ⚡⭐💎 como iconos de motor |
| `/registro` | 8.8 | 1.0 | Enfocado, etiquetas visibles, móvil de una columna |
| `/login` | 8.8 | 1.0 | Calmado, jerarquía clara |
| `/demo/interactivo` | 8.3 | 1.2 | Flujo tranquilo y coherente; D-2 le cuesta; mucho lienzo vacío en escritorio |

## §4 — Qué falta de V10-TRUTH-001 (parte 2)

1. Ver corriendo las pantallas `medico` (B-1: pedir al dueño V10-O1, o cablear
   emulador sólo-dev cuando se autorice).
2. Puntuar `/demo` y `/demo/razonamiento` mirándolas.
3. Línea base de accesibilidad (axe) y de rendimiento sobre lo público.
4. Matriz competitiva V10 (absorber `docs/competitive/UX_UI_MATRIX.md`).

Herramientas de captura reproducibles: `scripts/design/v10-capturas.mjs` y
`scripts/design/v10-demo-flujo.mjs` (requieren `next dev` en :3005).
