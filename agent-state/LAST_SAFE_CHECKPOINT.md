# Último punto seguro de reanudación

> **Para qué sirve**: que la siguiente sesión sepa, sin leerse todo, qué está
> cerrado y qué es lo siguiente. Se actualiza **tras cada unidad cerrada**, con
> su SHA. Sin SHA, una unidad no está cerrada.

---

## Checkpoint · 8-ago-2026

| | |
|---|---|
| **Rama** | `claude/nexus-patient-ux-v9` |
| **SHA base de esta sesión** | `0abcba2` (`chore(deploy): v1146 — REG-264`) |
| **Unidad cerrada** | **`PATIENT-UX-TRUTH-001`** (iteración 0 de V9) |
| **Siguiente unidad** | ver «Qué hacer al reanudar» |

### Qué quedó hecho

**Los siete documentos de la unidad**, todos con sección «qué NO cubre»:

- `docs/design/CURRENT_PRODUCT_DESIGN_AUDIT.md` — cabecera
- `docs/design/SCREEN_INVENTORY.md` — **generado**, 78 pantallas
- `docs/design/NAVIGATION_STATE_AUDIT.md`
- `docs/design/GENERIC_AI_AESTHETIC_AUDIT.md`
- `docs/patient/PATIENT_COMPANION_BASELINE.md`
- `docs/competitive/PATIENT_EXPERIENCE_MATRIX.md`
- `docs/competitive/UX_UI_MATRIX.md`

**Backlog**: 14 elementos V9 en `agent-state/BACKLOG.json` con `prioridadV9` y
`unidad` (4 P0 · 7 P1 · 3 P2).

**Dos defectos reparados y sellados**, con prueba que falla al revés:

- **REG-265** — el enlace de la videoconsulta del paciente no llevaba token:
  404 «Cita no encontrada» desde su propio portal.
- **REG-266** — `@keyframes spin` no existía en ningún sitio global; 90
  referencias, incluidos los dos primitivos compartidos.

**Un instrumento**: `scripts/design/inventario-de-pantallas.mjs` +
`el-inventario-de-pantallas-no-miente.test.ts`, para que el inventario no se
pudra.

### Compuertas en este checkpoint

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | 8 083 casos · **1 fallo preexistente y de entorno** (`ops-timeout-y-punto-ciego`: abre una conexión a una IP no enrutable esperando que expire; tras el proxy de este contenedor falla rápido). Comprobado en `HEAD` limpio con los cambios guardados aparte: falla igual |
| `lint-trinquete` | **96, igual que el techo.** Sin deuda nueva |
| `npx tsc --noEmit` | **limpio** |
| `npm run build` | **compila** («Compiled successfully in 41s») y luego falla al recolectar datos de página con `auth/invalid-api-key`: **este contenedor no tiene las variables de Firebase**. Entorno, no código |
| navegador / móvil / a11y | **no ejecutadas** |

---

## Qué hacer al reanudar

**1. Comprobar** que `git log --oneline -3` incluye el commit de
`PATIENT-UX-TRUTH-001` y correr `node scripts/agent-state/actualizar.mjs`.

**2. NO rehacer la auditoría.** Está cerrada. Su producto es el backlog.

**3. Empezar por los tres P0 de audio**, aunque su ficha diga `NAVIGATION-001`.
Son pérdida **irreversible** de una consulta ya grabada, y un P0 de integridad
manda sobre el orden de las iteraciones:

- `PATIENT-AUDIO-001` — volver a grabar borra el audio anterior. Es el más caro y
  el arreglo es el más pequeño: limitar el borrado al rango de esta sesión.
- `PATIENT-AUDIO-002` — navegar termina la grabación en silencio.
- `PATIENT-AUDIO-003` — el cierre por inactividad no oye dictar y borra la
  recuperación.

Los tres, con su plan de arreglo escrito, en `agent-state/BACKLOG.json`.

**4. Luego `DESIGN-SYSTEM-001`**, empezando por `@theme inline`
(`globals.css:126-131`) — **no por colores**, que lo prohíbe §13 de la directiva
y además no es el problema.

**5. Cuando haya entorno con credenciales de Firebase**: las seis comprobaciones
de navegador de `NAV-NAVEGADOR-001`. **Dos de ellas pueden convertir un P2 en
P0.**

## Lo que este checkpoint NO garantiza

Que la interfaz esté bien. **Nadie ha abierto una pantalla.** Ninguna pantalla
está aprobada y la auditoría no aprueba ninguna: prioriza el barrido.
