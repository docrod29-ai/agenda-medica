# Rúbrica visual V10

> Cómo se puntúa una pantalla en `agent-state/V10_VISUAL_SCORECARD.json`.
> Regla previa a todas: **sin captura no hay puntuación** (§33-§34 de la
> especificación V10). Puntuar desde el JSX es inválido.

## Los 12 ejes (0–10 cada uno; la nota de pantalla es el promedio)

| Eje | Qué pregunta |
|---|---|
| Jerarquía | ¿Se entiende en ~2 s qué es lo primario? (§8.35) |
| Claridad | ¿El propósito único de la pantalla se puede nombrar en una frase? |
| Coherencia visual | ¿Parece de la misma app que las demás pantallas? |
| Tipografía | ¿Escala del sistema, sin tamaños huérfanos? |
| Espaciado | ¿El espacio establece la jerarquía antes que los bordes? (§8.8) |
| Densidad | ¿Densa donde sirve clínicamente, aireada donde no? (§8.23) |
| Interacción | ¿La siguiente acción segura es obvia? ¿teclado en escritorio? |
| Adaptabilidad | ¿Móvil nativo, no escritorio aplastado? (§27) |
| Accesibilidad | Foco visible, etiquetas, contraste, objetivos 44px, no-sólo-color |
| Rendimiento percibido | ¿Carga y transición sin resets mentales? (§8.20) |
| Confianza clínica | ¿Estados firmado/borrador inequívocos, procedencia inspeccionable? |
| Originalidad de marca | ¿Se reconoce como NexusMED o como plantilla? |

## genericAiLook (0–10, menor es mejor; objetivo ≤1.0 en críticas)

Se suma evidencia de: rejillas de tarjetas sin razón de flujo · degradados
decorativos · radio-en-todo · círculos de icono arbitrarios · chispas de IA ·
píldoras/badges para metadatos ordinarios · sombras arbitrarias · jerarquía
débil · aspecto de librería de componentes · estadísticas de tablero genéricas ·
microcopy inconsistente · ausencia de interacción distintiva. Los conteos
medibles viven en `docs/design/GENERIC_AI_AESTHETIC_AUDIT.md` y el trinquete de
diseño; esta rúbrica añade el juicio sobre la captura.

## Umbrales del programa (§34-§35)

- Críticas de Practice: promedio ≥ **9.3**, ninguna < **9.0**.
- genericAiLook ≤ **1.0** en críticas.
- Pantallas críticas: `/citas`, `/consulta/[patientId]`, `/nota/…`,
  `/receta/…`, `/pacientes`, `/expediente/[patientId]`, `/dashboard`,
  `/pendientes` — y el flujo público de alta (`/`, `/registro`, `/login`).
