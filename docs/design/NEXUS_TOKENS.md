# Nexus Tokens — estado real vs. norma

**Norma**: `NEXUS_IDENTITY_LOCK_V1.md` (autoritativo, V14 §8).

**Implementación actual** (`src/app/globals.css`, `@theme` con prefijo `nx-`):
sigue en la piel anterior. La mecánica de tokens `nx-*` existe desde
DESIGN-SYSTEM-001 (REG-298/299, ~35 tokens, respaldos de color a 0, con
guardián); lo que falta es migrar los **valores** a la paleta
Cantera+Instrumento y añadir las familias tipográficas del Lock.

Migración = `V14-IDENTITY-001`. Regla de la migración:

- ningún hex fuera de la tabla del Lock;
- cada par texto/fondo pasa 4.5:1 (verificar, no suponer — el trinquete de
  diseño y axe lo cazan);
- el trinquete de diseño (hex/tamaños/radios sueltos) sólo puede BAJAR.
