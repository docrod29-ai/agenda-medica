# V10-TRUTH-001 — auditoría de verdad visual (parcial)

**Fecha**: 9-ago-2026 · **Método**: navegador real (Chromium/CDP contra
`next dev` local), escritorio 1440×900 y móvil 390×844, datos ficticios.
**Evidencia**: `docs/design/evidence/v10/2026-08-09/` (10 capturas JPEG).
**Puntuaciones**: `agent-state/V10_VISUAL_SCORECARD.json`.

> **Alcance honesto**: cubre la superficie **pública** (18 pantallas, 10
> inspeccionadas) y el flujo simulado de `/demo/interactivo`. La superficie
> clínica con sesión —donde vive el producto de verdad— **no tiene todavía
> evidencia de navegador** (bloqueo B-1, plan `V10-ENV-001`). Este documento
> no la puntúa ni la describe.

## 1. Lo que ya estaba medido y esta auditoría reutiliza

| Insumo (V9, 8/9-ago-2026) | Qué aporta a V10 |
|---|---|
| `SCREEN_INVENTORY.md` (generado + guardián) | inventario §47.1: 79 pantallas (9 paciente, 33 medico, 10 alpha, 18 publica, 9 interna) |
| `GENERIC_AI_AESTHETIC_AUDIT.md` | §47.5: **la identidad no es genérica** (0 gradientes decorativos, 1 rounded-2xl…), el problema es adopción: 6 065 `style={{` en 88,5 % de archivos |
| `NEXUS_DESIGN_SYSTEM.md` + techos sellados | §47.3: tokens `nx-*` (~35), techos: 565 hex en línea, 2 029 tamaños y 638 radios fuera de escala, 24 sombras |
| `NAVIGATION_STATE_AUDIT.md` + REG-300…303 | §47.8: el ciclo Agenda→Paciente→Consulta→Resultados ya restaura contexto (verificado con guardianes, **no** en navegador) |

## 2. Lo nuevo de hoy: la superficie pública, vista de verdad

### Hallazgo central

La superficie pública es **coherente y está por encima del SaaS genérico**
(identidad oscura, azul `#5B5BF6` aprox., serif editorial de marca, mockups de
producto reales), pero la portada conserva tres rasgos de plantilla que la
especificación V10 marca como deuda (§9):

1. **Rejilla de 6 tarjetas-función con círculos de icono** (V10-P1-004).
2. **Ilustración 3D isométrica decorativa** que no comunica flujo (V10-P1-005).
3. Píldoras de métrica y stepper de píldoras en el demo (V10-P2-006).

### Lo mejor inspeccionado

- **`/demo/interactivo` → Receta** (8.5): documento blanco sobre lienzo oscuro
  con verificación QR al lado — patrón propio, comunica confianza. Candidato a
  semilla del lenguaje `NexusDocument` (§30).
- **`/registro`** (8.5): partido editorial/formulario, limpio y con identidad.

### Hallazgo P1 que NO es visual

**`/precios` nombra modelos internos** (Haiku 4.5, Sonnet 5, Opus 4.8 + GPT-5).
REG-292 registra la regla del dueño: «lo que hace, no cómo lo hace». El barrido
v1166 limpió `/motores` y `/arquitectura` pero no esto. Puede ser omisión o
transparencia deliberada («sin cajas negras» está escrito ahí mismo). Paso
previo obligatorio antes de tocar: revisar el diff de v1166 (V10-P1-003).

### Verificaciones de entorno que esta corrida dejó hechas

- Sin `NEXT_PUBLIC_FIREBASE_*`, `getAuth()` truena **al evaluar el módulo** y
  toda la app devuelve 500 — el «build falla sin credenciales» que V9 anotó
  tiene esa causa raíz. Con claves sintéticas locales renderiza lo público.
- El navegador del contenedor funciona con
  `AGENT_BROWSER_EXECUTABLE_PATH=/opt/pw-browsers/chromium` (la descarga de
  Chrome propia de agent-browser está bloqueada por el proxy).
- La insignia roja «1 Issue» de las capturas es el overlay de desarrollo de
  Next.js (reacciona al fallo de red de Firebase con claves falsas), **no** un
  defecto del producto.

## 3. Qué NO cubre esta auditoría

- Ninguna pantalla con sesión (33 medico, 9 paciente token, 9 interna).
- Accesibilidad automatizada (axe) y rendimiento: sin línea base todavía.
- Estados de error/carga/vacío de lo público: sólo se vio el estado feliz.
- Teclado: no se recorrió tab-a-tab; pendiente con la superficie clínica.

## 4. Siguiente paso

`V10-ENV-001` (emuladores + semilla sintética) y después `V10-TRUTH-001b`
sobre la superficie clínica. Detalle en `agent-state/V10_CURRENT_ITERATION.md`.
