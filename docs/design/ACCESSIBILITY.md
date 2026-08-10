# Accesibilidad — V10

> Ley: V10 §27 + `.claude/rules/design-system.md` (WCAG 2.2 AA o mejor).
> Los fallos críticos de accesibilidad que impiden uso seguro **bloquean
> release** (V10 §27). Endurecimiento a fondo en `V10-A11Y-001` (iteración 18).

## Mínimos que fallan la compuerta (ya vigentes en el repo)

- Control interactivo que no es `<button>`.
- Campo sin etiqueta.
- Modal que no atrapa el foco o no cierra con Escape.
- Foco invisible.
- Contraste < 4.5:1 en texto normal.
- Objetivo táctil < 44×44.

`docs/DESIGN_SYSTEM.md` documenta cocientes de contraste calculados a mano en
el propio CSS — esa práctica se conserva.

## Línea base (TRUTH-001 salida 10) — **medida el 10-ago-2026**

Método: axe-core 4.x (WCAG 2.x A/AA, incluidas reglas 2.2) inyectado sobre el
DOM vivo de las 8 pantallas del golden flow, autenticado contra emuladores con
datos sintéticos, en 4 viewports (1440/1024/768/390). Evidencia cruda:
`tests/visual/capturas/axe-<pantalla>--<viewport>.json`. Arnés:
`scripts/design/capturar-golden-flow.mjs`.

### Hallazgos únicos (deduplicados entre viewports)

| # | Pantalla | Regla axe | Impacto | Qué es |
|---|---|---|---|---|
| A1 | consulta | `label` ×4 | **critical** | Los campos de signos vitales (TA/FC/FR/T°…) tienen rótulo visual pero **no asociado**: el lector de pantalla anuncia un textarea sin nombre en plena captura de vitales. Es el hallazgo con relevancia clínica directa. |
| A2 | calendario | `nested-interactive` ×5 | serious | `div[role=button]` (cita) anidado dentro de `div[role=button]` (celda «Agendar a las…»): foco y activación ambiguos con teclado/AT. |
| A3 | calendario, citas, expediente, consulta (390px) | `button-name` ×2-3 | **critical** | Botones de icono sin nombre accesible (navegación del calendario, acciones por fila, cabecera móvil). |
| A4 | citas | `label` ×1 | **critical** | El `input[type=date]` no tiene etiqueta — y además pinta formato 08/09/2026 (EU) junto a «2026-08-09» ISO en el mismo renglón (§28). |
| A5 | citas | `color-contrast` ×4 | serious | «Registrar cobro» (verde-azulado sobre fondo oscuro) bajo 4.5:1. |
| A6 | dashboard | `color-contrast` ×3 | serious | Texto secundario de las filas de agenda bajo 4.5:1. |
| A7 | calendario | `color-contrast` ×1 | serious | Bloque de cita «pendiente-confirmar» (borde discontinuo) bajo umbral. |
| A8 | login | `target-size` ×1 | serious | Botón de mostrar contraseña < 24px de objetivo. |

Cero violaciones en: `pacientes` y `pendientes` (escritorio), `dashboard`
(critical cero; solo contraste), `expediente` (escritorio).

### Lectura

Ninguna pantalla está limpia en móvil. Los dos críticos que tocan la compuerta
de «uso seguro» son **A1** (vitales sin nombre programático) y **A2+A3** en el
calendario (control anidado + botón mudo = agenda no operable con teclado).
Ambos van al backlog como P1 de `V10-A11Y-001`, pero A1 califica para
repararse antes por tocar captura de datos clínicos.
