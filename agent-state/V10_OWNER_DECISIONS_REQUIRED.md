# V10 — decisiones del dueño requeridas

> Archivo creado por la primera corrida programada del **V10 Autonomous Visual
> Excellence Engine** (9-ago-2026). Cada corrida futura de V10 lee este archivo
> antes de hacer nada.

## D-V10-1 · La directiva maestra de V10 NO EXISTE en el repositorio

**Qué pasa.** La tarea programada ordena, como primera acción obligatoria, leer
y obedecer:

```
docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md
```

y prohíbe expresamente sustituirla por un plan propio («Do not replace it with
your own plan»). Ese archivo **no está en el repositorio**:

- no está en el árbol de trabajo ni en `docs/ai/` (ahí sólo vive la V9);
- no está en ninguna rama (`main`, ramas remotas) tras `git fetch`;
- no aparece en toda la historia de git (`git log --all --diff-filter=A`,
  `git log --all --grep="V10"`: cero resultados);
- no hay ningún estado V10 previo en `agent-state/`.

Es decir: ésta es la **primera** corrida de V10 y la especificación autoritativa
nunca se subió. Probablemente vive sólo en la máquina del Dr. o quedó pendiente
de commit al crear la tarea programada.

**Qué se necesita del dueño** (una de dos):

1. **Subir la directiva** al repositorio en la ruta exacta de arriba
   (commit a `main` o a una rama que V10 pueda leer), o
2. **Corregir la tarea programada** si la ruta cambió o si V10 ya no procede.

**Qué harán las corridas de V10 mientras tanto.** Verificar en cada corrida si
la directiva ya apareció (working tree + `git fetch origin main`). Si no está:
salir limpiamente sin inventar trabajo V10, sin repetir esta nota y sin volver a
notificar. Si ya está: ejecutarla desde el principio (no hay estado previo que
retomar).

**Por qué no se hizo «otra tarea segura» en su lugar.** Todo el dominio que la
tarea programada describe (excelencia visual, anti-generic-AI, accesibilidad,
sistema de diseño) **ya lo posee el loop V9**, cuya unidad siguiente en cola es
`DESIGN-SYSTEM-001` (ver `agent-state/CURRENT_ITERATION.md`). La propia tarea
V10 ordena: «choose another V10 task if another routine owns the same files» —
y sin directiva no hay «another V10 task» que elegir. Tocar esas pantallas desde
V10 sin especificación sería (a) inventar el plan prohibido y (b) una edición
concurrente insegura sobre archivos de V9.

## D-V10-2 · Cómo conviven V9 y V10 (decidir junto con D-V10-1)

La auditoría de V9 ya midió que **no hay** estética genérica de IA (cero
degradados morados, una sola tarjeta `rounded-2xl`); el defecto real medido es
que *el sistema de diseño existe y la app no le obedece* (88,5 % de archivos con
estilo en línea, primitivos compartidos al 24 %). Al redactar (o subir) la
directiva V10 conviene que el dueño defina el deslinde con V9/`DESIGN-SYSTEM-001`
para que dos loops no repinten las mismas 78 pantallas en direcciones distintas.

---

*Estado de esta corrida: bloqueada por D-V10-1 · commit de esta nota empujado a
`claude/kind-brahmagupta-9xajvg` · dueño notificado (push + correo) el
9-ago-2026.*
