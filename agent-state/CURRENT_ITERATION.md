# Iteración actual — NEXUS-TRUTH-001

**Modo**: auditoría del repositorio, producto, clínica y seguridad.
**Restricción del dueño**: PR sí, despliegue no.

## Hecho

1. Infraestructura del programa (`CLAUDE.md`, `.claude/rules/`, `.claude/agents/`,
   `agent-state/`, carpetas de `docs/`).
2. **Primera medición real del corpus V3 de 6 000 frases** — el que el dueño
   reclamó, y con razón: existe en disco y nadie lo había corrido contra el
   pipeline.

## Lo que la medición encontró

`96.02 %` intactas · **cero términos clave perdidos** · `0.42 %` piden
confirmación.

Y un defecto concreto: **un balance hídrico negativo pide confirmación en cada
frase**. `dosisSinNumero` no reconoce el signo menos, así que lee «−1500 mL» y
cree que la cifra falta. Un balance negativo es lo normal en un paciente en
diuresis o en ultrafiltración: preguntar en todos es fatiga de alerta justo donde
la atención del médico es escasa.

## Siguiente

`VOICE-004` — reparar el signo, volver a medir y fijar el número con un golden.
