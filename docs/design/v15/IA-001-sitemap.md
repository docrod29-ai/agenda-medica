# V15-IA-001 — sitemap, mapa de capacidades contextuales y plan de compatibilidad

**Fase:** 1 (IA RE-ARCHITECTURE) · **Cierra con:** V15-SHELL-GREYBOX-001 arrancado en la
misma corrida (`FlowRail`, `InstrumentStrip`, `/operaciones`).

**Insumo:** `docs/design/capturas/v15-baseline-before/BASELINE.md` — 23 destinos
primarios de médico (21 `NAV` + 2 «Sistema») medidos en `src/components/Sidebar.tsx`
contra el objetivo del routine de ≤5.

---

## 1. Los cinco contextos (fijados por el routine, no elegidos aquí)

```
TODAY            /dashboard
PATIENT          /pacientes
ENCOUNTER        contextual — /consulta/[id] si hay uno abierto, si no /pacientes
WORK/FOLLOW-UP   /pendientes
SEARCH/COMMAND   acción — abre la paleta ⌘K existente (PaletteBusqueda), no es ruta
```

Implementados en `src/components/FlowRail.tsx`.

### Por qué ENCOUNTER no es una ruta fija

No existe hoy un concepto de «encuentro activo» independiente de estar dentro de
`/consulta/[patientId]`. Inventarlo en esta fase sería tocar lógica de negocio
(qué hace a un encuentro «activo», dónde se guarda, quién lo cierra) — prohibido
por el congelamiento funcional de V15 (`§1`). Mientras tanto, ENCOUNTER se
resuelve **exactamente igual que hoy**: la antigua entrada «Consulta» del
`Sidebar` ya apuntaba a `/pacientes` (label engañoso: abría la lista, no una
consulta). El comportamiento es idéntico, la etiqueta ahora es honesta.
`V15-ENCOUNTER-MODE-001` (Fase 5) es quien construye el modo real y decide si
hace falta un estado de «encuentro activo» explícito.

## 2. Mapa de capacidades contextuales — dónde quedó cada uno de los 23

Ninguna ruta se movió, se renombró en el código ni se eliminó. Sólo cambió
**desde dónde se llega**. Compatibilidad total: cualquier marcador o enlace
existente sigue funcionando.

| Destino antiguo (Sidebar)     | Ruta                | Nuevo lugar                          |
|---|---|---|
| Dashboard                     | `/dashboard`        | **TODAY** (FlowRail)                 |
| Consulta (lista de pacientes) | `/pacientes`        | **PATIENT** (FlowRail)               |
| Pendientes                    | `/pendientes`       | **WORK/FOLLOW-UP** (FlowRail)        |
| Agendar rápido                | `/asistente`        | Operaciones → Agenda                 |
| Citas                         | `/citas`            | Operaciones → Agenda                 |
| Calendario                    | `/calendario`       | Operaciones → Agenda                 |
| Lista de espera               | `/lista-espera`     | Operaciones → Agenda                 |
| Hospitalización               | `/hospitalizacion`  | Operaciones → Clínico (ALPHA)        |
| UCI                           | `/uci`               | Operaciones → Clínico (ALPHA)        |
| Consultor IA                  | `/consultor`        | Operaciones → Clínico                |
| Antibiograma                  | `/antibiograma`     | Operaciones → Clínico                |
| CRM                           | `/crm`               | Operaciones → Negocio                |
| Reseñas                       | `/resenas`          | Operaciones → Negocio                |
| Reactivación                  | `/reactivacion`     | Operaciones → Negocio                |
| Farmacia                      | `/farmacia`         | Operaciones → Negocio                |
| Finanzas                      | `/finanzas`         | Operaciones → Negocio                |
| Membresías                    | `/membresias`       | Operaciones → Negocio                |
| Cumplimiento                  | `/cumplimiento`     | Operaciones → Cumplimiento y docs.   |
| Documentos legales            | `/legal`            | Operaciones → Cumplimiento y docs.   |
| Migración                     | `/migracion`        | Operaciones → Cumplimiento y docs.   |
| Chat                          | `/chat`              | Operaciones → Comunicación           |
| Guía de uso                   | `/guia`              | Operaciones → Sistema                |
| Configuración                 | `/configuracion`    | Operaciones → Sistema                |

Implementado en `src/app/(dashboard)/operaciones/page.tsx`, agrupado y filtrado
por `rutaPermitida` (mismo entitlement que ya regía el `Sidebar` — no se relaja
ni se endurece el acceso de ningún módulo).

## 3. Separación Operations

`/operaciones` es un **índice**, no un segundo dashboard: enlaces agrupados,
sin KPIs ni tarjetas de resumen. `FlowRail` lo enlaza al fondo, subordinado
tipográficamente (color `--text3`, mismo tamaño que el resto pero sin negrita
de estado activo por defecto) — no es un sexto ítem del mismo peso que los
cinco contextos clínicos, es exactamente lo que `§11` pide: administrativo,
disponible, no dominante.

## 4. Modelo de contexto de paciente

Para esta corrida, PATIENT sigue siendo la lista/búsqueda existente
(`/pacientes`) sin cambios estructurales — el **Patient Workspace** real
(ancla de identidad + columna vertebral clínica + lienzo activo) es
`V15-PATIENT-WORKSPACE-001`, Fase 4. Documentarlo aquí sin construirlo violaría
la regla de «no documentación sola»; se deja la ruta de entrada correcta
(PATIENT del FlowRail) y el resto para su propia fase.

## 5. Plan de compatibilidad de rutas

- **Ninguna ruta existente cambia de URL.** El `FlowRail` y `/operaciones` son
  capas de navegación nuevas sobre las mismas páginas.
- **Alcance: sólo médico.** `FlowRail` sustituye a `Sidebar` únicamente cuando
  `esMedicoReal && mode === 'medico'` (`src/app/(dashboard)/layout.tsx`). El
  modo Secretaria conserva `Sidebar` sin cambio — su IA no es objeto de esta
  fase y tocarla ahora sería alcance no pedido.
- **Guardas de acceso sin cambio.** `RUTAS_SOLO_MEDICO`, `rutaPermitida` y el
  bloqueo por módulo siguen operando igual sobre las mismas rutas; `FlowRail`
  y `/operaciones` no introducen una segunda fuente de verdad de permisos.
- **Móvil sin tocar en esta corrida.** `BottomNav` (4 destinos + acción
  central contextual) ya se acerca al modelo de ≤5 y su recomposición formal
  es `V15-MOBILE-001` (Fase 9, prioridad 13 del routine) — cambiarlo ahora
  sería adelantar una fase sin haber pasado antes por Encounter Mode y
  Patient Workspace, que es lo que le da forma real a esos destinos.

## 6. Qué NO se hizo en esta corrida (y por qué)

- **Today no se reconstruyó** (`/dashboard` sigue siendo el dashboard actual).
  Fase 3 (`V15-TODAY-001`) es dueña de esa reconstrucción; moverla aquí sería
  invertir el orden obligatorio de `§18` (IA → layout → … → tokens).
- **Instrument Strip sólo pinta consultorio + grabación activa.** Paciente
  actual / última novedad esperan a `V15-PATIENT-WORKSPACE-001` — ver el
  comentario en `src/components/InstrumentStrip.tsx`.
- **Color de marca deliberadamente ausente en `FlowRail`.** Ver
  `.nx-flow-rail` en `globals.css`: el estado activo usa `var(--text)`, no
  `var(--nexus)`. Es la Greybox Gate (`§12`) aplicada al código, no sólo a una
  revisión visual puntual.
