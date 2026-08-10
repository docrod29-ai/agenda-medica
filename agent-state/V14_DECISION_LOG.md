# V14 — Bitácora de decisiones

## D-1 · 10-ago-2026 — Base de la rama canónica

`claude/nexus-master-loop-v14` nace de `kind-brahmagupta-ajtolc`, la línea V10
**reconciliada** (contiene main `56d9fc7a`, la canónica V10, y todas las
corridas con trabajo sustantivo). Alternativa descartada: nacer de main, que
perdería TRUTH-001, HOME-001, AGENDA-IDENTITY-001, los arneses y las líneas
base axe — exactamente el trabajo que V14 §3 ordena preservar.

Las ramas no absorbidas (`bttia7`, `ake878`, `dwmunz`, `4tkrhu`, `397pqw`,
`i2uo2j`, `gu7h9g`) están declaradas **superadas** en
`V10_MASTER_STATE.json → ramasSuperadas`: su contenido fue portado (p. ej. la
reparación de hidratación) o duplicaba corridas ciegas entre sí. No se fusionan.

## D-2 · 10-ago-2026 — Conflicto de identidad: cobalto vs Cantera+Instrumento

**Conflicto real.** `docs/design/NEXUSMED_VISUAL_DNA.md` y
`docs/ai/NEXUSMED_ORIGINAL_PRODUCT_IDENTITY_DIRECTIVE.md` (instalados el
10-ago en la línea V10) definen lienzo oscuro neutro `#0B0C0E` + cobalto
semántico, y AGENDA-IDENTITY-001 se construyó bajo esa identidad.

El Identity Lock de V14 §8 (canvas `#FAF7F2`, brand `#8E2A47`,
Cantera+Instrumento) dice de sí mismo: «authoritative until the owner
explicitly changes it», y V14 declara que **unifica y supersede** el Identity
Lock previo. V14 es el documento del dueño más nuevo → **gana V14**.

Consecuencias:

- `docs/design/NEXUS_IDENTITY_LOCK_V1.md` es la única fuente de color/tipo/forma.
- `NEXUSMED_VISUAL_DNA.md` queda como registro histórico (los 20 defectos de
  identidad que cataloga siguen siendo válidos como anti-patrones).
- AGENDA-IDENTITY-001 conserva su **gramática** (riel del día, una acción por
  entrada, estado tipográfico) — eso no depende de la paleta — y migra de piel
  en `V14-IDENTITY-001`.

## D-3 · 10-ago-2026 — Rutinas activas y solapamiento

- **Rutina V10 programada**: superseded — CLAUDE.md ya enruta el trabajo
  visual/flujo/evidencia a V14. Si una corrida V10 vieja despierta, la
  directiva V10 sigue en su ruta y no contradice: el trabajo aterriza igual.
- **V7 (`agent/v7/master-loop`)**: dominio distinto (motores clínicos, REG).
  Sin conflicto; comparte main.
- **V9**: fusionado a main (PR #279). Sus unidades visuales abiertas
  (VISUAL-EXCELLENCE-001) quedan absorbidas por la secuencia V14.
- **V12/V13**: no existen en el repositorio; nada que preservar.

## D-4 · 10-ago-2026 — Nada de evidencia fabricada en la instalación

Todos los archivos de evals/PARITY+/DD nacen con estado `NOT RUN` / `UNKNOWN`.
Los únicos números citados provienen de corridas verificables en la historia
Git de esta rama (conteos de pruebas, axe, trinquetes), con su commit.

## D-5 · 10-ago-2026 — OD-2 RESUELTA por el dueño: Cantera+Instrumento

Texto del dueño (esencial): el Identity Lock V14 es autoritativo y supersede
la identidad cobalto de V10. Proceder con Cantera+Instrumento tal cual:
lienzo alabastro cálido, acento jamaica profundo, tipografía café-tinta,
Instrument Strip, Bricolage Grotesque (identidad/display, con freno),
Instrument Sans (cuerpo/UI), Spline Sans Mono (numéricos clínicos). Prohibido:
identidad azul/teal/morado médico genérico, identidad "AI sparkle", tablero de
rejilla de tarjetas, y almacén de menú de funciones como arquitectura primaria.

Orden ejecutiva inmediata: V14-IDENTITY-001 → V14-SHELL-001, con el P0 de
reemplazar el sidebar de 20+ destinos por la arquitectura de información
clínica de V14 (NOW / PATIENT / ENCOUNTER / CLINICAL STATE / WHAT CHANGED /
WHAT NEEDS ATTENTION / NEXT SAFE ACTION / WHAT REMAINS OPEN / CONTINUITY /
CLOSURE). No recolorear ni renombrar el sidebar existente: rearquitecturar.

## D-6 · 10-ago-2026 — Identidad única (sin tema oscuro) hasta OD-4

El Lock define UNA identidad (alabastro cálido) y prohíbe color de producto
fuera de su tabla sin decisión del dueño. Un «modo oscuro Cantera» exigiría
inventar ~20 tokens — exactamente lo prohibido. Decisión: identidad única;
`data-theme` se limpia al arrancar; ThemeToggle retirado (estaba a punto de
quedar «escrito y sin conectar»). OD-4 registra la pregunta al dueño; si la
respuesta es sí, la paleta nocturna nace como documento del Lock, no como
deriva de una corrida.
