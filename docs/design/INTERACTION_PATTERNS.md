# Patrones de interacción — V10 (TRUTH-001, salida 7)

> Se llena por unidad de pantalla, con evidencia de navegador. Ley aplicable:
> V10 §11 (PATIENT → ENCOUNTER → ACTION → FOLLOW-UP), §12 (navegación),
> §13 (comando universal), §38 (compuerta de pérdida de estado).

## Heredado y validado (no rehacer)

- **Mapa de navegación y pérdida de estado**: `NAVIGATION_STATE_AUDIT.md`
  (V9) + reparaciones REG-276…279 (rama V9, sin fusionar).
- **Procedencia tocable**: pulsar una frase de la nota y oír el segundo exacto
  del dictado (REG-213/250) — firma de interacción existente que V10
  **estabiliza, no reinventa** (`.claude/rules/design-system.md`).

## Por documentar

- Patrón canónico de retorno de contexto (Agenda → Paciente → Consulta →
  Resultados → Consulta) como contrato probado (V10 §38).
- `⌘K` comando universal: no existe hoy; unidad futura (V10 §13) — nunca
  ejecuta acciones clínicas consecuentes en silencio.
- Convenciones de teclado de escritorio por flujo (V10 §8.24).
