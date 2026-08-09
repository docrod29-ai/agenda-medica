# V10 — decisiones que sólo el dueño puede tomar

## BLOQUEADOR ÚNICO (2026-08-09): la especificación V10 no existe en el repositorio

La tarea programada «NEXUSMED V10 — AUTONOMOUS VISUAL EXCELLENCE ENGINE» ordena
como **primera acción obligatoria** leer y obedecer:

```
docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md
```

y prohíbe explícitamente sustituirla por un plan propio del agente.

**Ese archivo no existe.** Se verificó el 2026-08-09, en `origin/main`
(`0144257`):

- `docs/ai/` sólo contiene `NEXUSMED_PATIENT_EXPERIENCE_AND_DESIGN_MASTER_LOOP_V9.md`;
- ninguna rama remota ni el historial completo de git (`git log --all`)
  contiene un archivo `*V10*`;
- no existe estado persistente V10 en `agent-state/` (ni `V10_COMPLETE.md`,
  ni iteraciones previas);
- la rama designada del loop (`claude/kind-brahmagupta-mlhxd5`) no existía en
  `origin` antes de esta corrida — ésta es la **primera** corrida V10.

### Por qué es bloqueador y no se improvisó

La directiva dice, literalmente: «This file is the authoritative NexusMED V10
specification. Do not replace it with your own plan.» Inventar unidades V10 sin
la especificación violaría esa orden, y además arriesgaría pisar el trabajo de
V7/V9, que sí tienen directiva escrita y estado propio (la siguiente unidad de
V9 es `DESIGN-SYSTEM-001` y pertenece a ese loop, no a éste).

### Qué necesita hacer el dueño (una sola cosa)

Colocar la especificación en
`docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md`
y fusionarla a `main` (o a esta rama). En la siguiente corrida programada, el
loop la leerá y arrancará la primera iteración sin más intervención.

Si la intención era que V10 corriera **sobre la directiva V9 existente**
(las unidades `DESIGN-SYSTEM-001` → `VISUAL-EXCELLENCE-001`), basta decirlo en
ese archivo o ajustar el prompt de la tarea programada.

### Estado del repositorio verificado en esta corrida

Para que la siguiente corrida no parta a ciegas:

- `node scripts/lint-trinquete.mjs` → **96 errores, techo 98. Sin deuda nueva.**
- `npx vitest run` → **8459 pruebas en verde, 1 saltada (566 archivos)**, 160 s.
- Rama `claude/kind-brahmagupta-mlhxd5` creada desde `origin/main` `0144257`
  sin tocar código de producto: esta corrida sólo añade este acta.

### Próxima acción exacta

`RE-INTENTAR V10-ITER-000`: leer la especificación V10 (cuando exista),
inspeccionar el producto real en navegador y seleccionar la primera unidad.
Mientras el archivo no exista, cada corrida debe salir limpia sin inventar
trabajo, sin churn y sin repetir esta notificación al dueño.
