# V14 — bloqueador que sólo el dueño puede resolver

Escrito el 11-ago-2026 por la corrida programada V14. **No se tocó código de
identidad ni de shell en esta corrida** — se investigó, se confirmó el
conflicto con evidencia de commit, y se paró antes de adivinar cuál de las
dos identidades ya decididas por escrito debe ceder.

## OD-5 · Dos identidades visuales del producto, decididas por separado, mutuamente excluyentes

**Línea A — `claude/nexus-master-loop-v14`** (rama canónica del programa V14,
nace el 10-ago-2026 de la línea V10 reconciliada):

- El dueño resolvió **OD-2 por escrito** (`V14_DECISION_LOG.md` D-5,
  10-ago-2026): **Cantera + Instrumento** gana — lienzo alabastro cálido
  `#FAF7F2`, acento **jamaica profundo** `#8E2A47`, tipografía Instrument
  Sans/Bricolage Grotesque/Spline Sans Mono, identidad única (sin tema
  oscuro), sidebar rearquitecturado (no recoloreado).
- Ejecutado: `V14-IDENTITY-001` + `V14-SHELL-001` — token migration completa
  de `:root`, `ThemeToggle` retirado, `ThemeToggle.tsx` **borrado**, sidebar
  reagrupado en AHORA/PACIENTE/CLÍNICA/Consultorio (plegado)/SISTEMA.
  Commits `4bdc7fda`…`b9652028`. Verificado con navegador real (28 capturas,
  axe 0 critical, 583/584 archivos vitest).
- **Nunca se abrió PR a `main`.** `OD-1` (en la misma bitácora) ya
  recomendaba abrirlo «cuando V14-IDENTITY-001 cierre» — cerró el 10-ago y
  el PR nunca se abrió.

**Línea B — `main`** (evolucionó en paralelo, sin ver la rama V14):

- Commit `4656e51` (v1171, PR #290, fusionado el 9/10-ago): el acento sale
  del **índigo de IA** `#6E84FE` hacia **cian-petróleo** (`#2AA5B5` /
  `#12626E`), decidido por eliminación medida contra el semáforo clínico —
  **sin mención del Identity Lock ni de Cantera+Instrumento** en el commit.
- Antes, commit `2ee0ba9d`: el producto se **renombró a Ausculta**
  (`ausculta.mx` libre; `nexusmed.mx` ocupado por otro médico), con
  `<MarcaAusculta/>` nueva y 245 menciones renombradas — la rama V14 sigue
  llamando al producto NexusMED y no conoce `MarcaAusculta`.
- `main` ya pasó por una consolidación propia (`9f040b81`,
  "dos líneas paralelas vuelven a ser una") que **tampoco absorbió** la rama
  V14 — esa consolidación fue de ramas de sesión distintas.

**Choque directo, verificado con `git diff` entre la base común
(`b6a8c343`) y cada línea:**

| Archivo | Línea A (V14) | Línea B (main) |
|---|---|---|
| `src/app/globals.css` | 310 líneas reescritas — tokens Cantera+Instrumento | tokens cian-petróleo sobre identidad previa |
| `src/app/layout.tsx` | 58 líneas — fuentes nuevas, sin ThemeToggle | fuentes/tema de la línea cobalto→petróleo |
| `src/components/Sidebar.tsx` | 276 líneas — rearquitectura AHORA/PACIENTE/CLÍNICA | estructura de 20+ destinos, recoloreada |
| `src/components/ThemeToggle.tsx` | **borrado** (identidad única, D-6) | modificado (sigue vivo) |
| `src/app/login/page.tsx`, `registro/page.tsx` | `MarcaAusculta` no existe; usa marca jamaica del Lock | `MarcaAusculta` (Ausculta) |
| `src/app/opengraph-image.tsx`, `NerPanel.tsx` | identidad Cantera | identidad Ausculta/petróleo |

Un merge automático de cualquiera de las dos direcciones **sobreescribe una
decisión del dueño ya tomada y ya verificada en navegador**. No hay forma de
"tomar lo mejor de las dos" sin decidir cuál acento y cuál marca son los
reales — eso es exactamente lo que D-5 y el commit `4656e51` decidieron cada
uno por su cuenta, sin verse.

### Lo que NO se hizo en esta corrida (a propósito)

- No se fusionó `claude/nexus-master-loop-v14` a esta rama ni a `main`.
- No se sobreescribió el trabajo de ninguna de las dos líneas.
- No se abrió PR.
- No se leyó la directiva V14 completa como trabajo de implementación — se
  leyó lo suficiente de su estado (`V14_CURRENT_ITERATION.md`,
  `V14_DECISION_LOG.md`, `V14_MASTER_STATE.json`, backlog) para confirmar que
  **todo el backlog pendiente de V14 depende del Identity Lock o del shell**
  (IDENTITY-002, SHELL siguiente, TODAY, ENCOUNTER, TIMELINE, INSIGHT,
  CLOSURE, WORKFLOWS, MOBILE, COMMAND, STYLE) — construir sobre cualquiera de
  las dos bases sin resolver el choque repite el patrón de fragmentación ya
  documentado tres veces en `V10_CURRENT_ITERATION.md` (ocho corridas V10 en
  paralelo, dos reconciliaciones completas).

### Default recomendado (no ejecutado — espera al dueño)

La decisión D-5 es la más explícita y la más reciente **sobre identidad
visual específicamente**, con verificación en navegador real y con el propio
dueño citado por escrito. El cambio de `main` (`4656e51`) es criterio de
agente sin mención de haber visto esa decisión. Si el dueño no tiene
preferencia nueva, la recomendación es: **Cantera+Instrumento (línea A)
gana como base**, y el nombre **Ausculta** (línea B, con su propia
verificación de disponibilidad de marca/dominio) se **porta sobre** esa
base — son decisiones en dominios distintos (paleta vs. nombre) y no se
excluyen entre sí. Pero es una recomendación, no una ejecución: requiere
reconciliar 4+ archivos núcleo con criterio de diseño, y esa reconciliación
es exactamente el tipo de trabajo que no se hace a ciegas en una corrida
desatendida.

### Además, sin relación con el choque de identidad

El sprawl de ramas que `V7-ITERACION.md`/PR #283/#286 ya avisó sigue
empeorando: 100+ ramas `claude/*` y `agent/*`, más de 20 PRs abiertos sin
fusionar (algunos desde el 7-ago). Ninguno de los abiertos toca V14. Se deja
constancia aquí porque agrava el mismo problema: cuanto más tiempo vive la
verdad en ramas de sesión sin fusionar, más cara es cada reconciliación.

## Qué se necesita del dueño

1. Confirmar cuál acento/paleta es el vigente — Cantera+Instrumento
   (jamaica/alabastro) o cian-petróleo — o autorizar la fusión de ambos
   dominios (paleta de línea A + nombre Ausculta de línea B) tal como se
   recomienda arriba.
2. Autorizar (o no) abrir el PR de `claude/nexus-master-loop-v14` pendiente
   desde `OD-1`, ahora con este choque resuelto primero.
3. Hasta entonces, las corridas V14 programadas deberían tratar este archivo
   como bloqueador de todo trabajo visual/shell y buscar trabajo seguro que
   no dependa de la paleta (p. ej. evals de conversación/ASR si existen sin
   tocar la capa visual) — el backlog actual de V14 no tiene ninguna unidad
   así declarada.
