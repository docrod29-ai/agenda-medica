# V10 — Registro de decisiones

| Fecha | Decisión | Quién | Por qué |
|---|---|---|---|
| 2026-08-09 | El V10 Master Loop entregado por el dueño se instala **íntegro y sin editar** en `docs/ai/` (sha256 `885ea176…`, 828 líneas) | Dueño | Orden explícita: no resumir, no reescribir, no sustituir |
| 2026-08-09 | Rama persistente V10: `claude/nexus-visual-excellence-v10` | Dueño | Orden explícita en la instalación |
| 2026-08-09 | V10 **no re-audita** lo que V9 midió con método y guardián (inventario de pantallas, cara-de-IA, navegación); TRUTH-001 reconcilia y completa | Agente (V10 §2: «do not re-audit the entire repository every run») | La auditoría V9 es del 8-ago-2026, tiene conteos reproducibles y guardián en CI |
| 2026-08-09 | Las unidades V10 que tocan sistema de diseño / navegación / compañero esperan la fusión de la rama V9 o se rebasan sobre ella | Agente (V10 §41) | 8 commits V9 validados sin fusionar; duplicarlos o pisarlos está prohibido |
| 2026-08-09 | Los documentos `docs/design/*` nuevos **apuntan** a la fuente validada cuando ya existe (p. ej. `docs/DESIGN_SYSTEM.md`) en lugar de copiarla | Agente (invariante: nunca duplicar la fuente de verdad) | Dos copias divergen; el guardián de V9 vigila la original |
