# AUSCULTA — último punto seguro

## Checkpoint · 28-ago-2026 — **A1 cerrada: el tablero existe y está medido**

| | |
|---|---|
| **Unidad cerrada** | **A1** — `docs/product/AUSCULTA-MASTER-BOARD.md` |
| **SHA base** | `ba9d7a2f410157011a73ad87ea24f0edfc05560c` |
| **Rama** | `claude/ausculta-consultorio-completion-hoahgw` |
| **Siguiente** | **A3** — portar PR #356 preservando REG-323 |

### Qué se hizo

Cinco auditorías **read-only** en paralelo (escala, scroll móvil, evidencia,
Patient State/ciclo cerrado, seguridad/DR) y **verificación directa del
orquestador** sobre cada hallazgo que entró al tablero. Los agentes auditan; el
orquestador comprueba y escribe.

### Compuertas medidas en este SHA

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | 10 490 pasan · 1 falla · 1 omitido (762 archivos) |
| `lint-trinquete` | 96, igual que el techo |
| `npm run build` | **no ejecutado todavía** |
| navegador real | **no ejecutado** |

La única falla es `ops-timeout-y-punto-ciego.test.ts`. **No se heredó la
etiqueta**: se reprodujo. Necesita que `10.255.255.1` trague paquetes; el proxy
de este contenedor rechaza al instante, así que sale un error de conexión antes
de que venza el temporizador. `BLOCKED_EXTERNAL (entorno)`. Aflojar la aserción
está prohibido por §32.

### Los siete P0 abiertos

1. Un resultado de laboratorio de **consultorio** no genera tarea de revisión — `expediente/laboratorio/firestore.ts:80`
2. `internamientos/{id}/registros` (bitácora NOM-004) **no está en el respaldo** — `respaldo.ts:98`
3. `getPatients()` descarga la colección entera — `firestore.ts:119`
4. `findNotaByIdInClinic()` lee todos los pacientes + un `getDoc` por paciente **en serie** — `expediente/firestore.ts:60`
5. `Promise.all` sobre todos los pacientes con un `getNotas` cada uno — `cumplimiento/retencion/page.tsx:29`
6. Rebote de scroll en iPhone — causa raíz probable en `ClinicalSpine.tsx:82`
7. La nota clínica completa va a la consola — `consulta/[patientId]/page.tsx:2210`

### El descubrimiento que cambia el plan de A3

**Existe implementación canónica y no está en esta rama.** PR **#356**
(`product/scale-hotpaths-342`, draft contra `main`) ya trae keyset pagination,
búsqueda indexada y golden de 701 líneas.

**No se puede fusionar a ciegas**: #356 es anterior a REG-323 y su
`updatePatient` **no tiene `vistoEn`**. Un merge directo regresaría la guardia de
concurrencia de esta rama. Hay que **portar** la API acotada sobre el archivo
nuevo conservando las dos cosas.

### Lo que este checkpoint NO afirma

- Nada se ha visto en un navegador. El rebote de iPhone tiene causa raíz
  **probable**, no reproducida en dispositivo. §38 no está satisfecha.
- No se ha medido capacidad. El validador de escala comprueba la **forma** del
  JSON, no que el producto aguante.
- El simulacro de restauración real sigue sin ejecutarse.

### Qué hacer al reanudar

1. Leer `CLAUDE.md`, `AGENTS.md`, `.claude/rules/**`, el tablero y este archivo.
2. `git log` y `git status` sobre esta rama. **No empezar de cero.**
3. Seguir por **A3**: portar #356 preservando REG-323, con golden probado al revés.
4. No reactivar Hospital/UCI. No priorizar Documents Zero-Friction.
