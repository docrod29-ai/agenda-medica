# AUSCULTA — último punto seguro

## Checkpoint · 28-ago-2026 — **REG-337, REG-338 y REG-339 cerradas**

| | |
|---|---|
| **Unidades cerradas** | **A1** (tablero) · **P0-1** (REG-337) · **P0-7** (REG-339) · **P1-1** (REG-338) |
| **SHA** | `7247e1f` sobre `claude/ausculta-consultorio-completion-hoahgw` |
| **Siguiente** | **A3** — portar PR #356 preservando REG-323 |

### Compuertas medidas en este SHA

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | **10 505 pasan · 1 falla · 1 omitido** (765 archivos) |
| `lint-trinquete` | **96**, igual que el techo |
| `npx tsc --noEmit` | **limpio** |
| navegador real | **no ejecutado** |

Baseline al empezar: 10 490. **+15 casos, cero regresiones.**

La única falla sigue siendo `ops-timeout-y-punto-ciego.test.ts`, del entorno:
exige que `10.255.255.1` trague paquetes y el proxy del contenedor rechaza al
instante. `BLOCKED_EXTERNAL`. Aflojar la aserción está prohibido por §32.

### Lo que se cerró, y lo que NO cerró con ello

**REG-337** — un resultado de laboratorio de consultorio ya abre su pendiente de
revisión. **Cierra «recibido → por revisar» y nada más**: `acted_on` y
`patient_notified` **no existen** en el modelo, y `progreso-resultado.ts` los
declara `sin_dato` en vez de fingirlos. La referencia y la interconsulta siguen
fuera del bucle.

**REG-338** — el secreto TOTP ya no sale del navegador, en las dos pantallas de
enrolamiento. **No cierra MFA**: el segundo factor **no se exige en el servidor
en ningún sitio**, y `security-controls.ts:75` aún lo declara `planned / BLOCKED`
cuando está implementado.

**REG-339** — el cuerpo de la nota ya no entra en `console.*`. El guardián es un
**cedazo por nombre de variable**, no una demostración; sólo recorre
`src/app/(dashboard)`.

### Una nota de método que conviene no perder

Un `vitest run` lanzado en segundo plano mientras se seguía editando midió un
árbol en movimiento y reportó fallos que no existían. Se descartó y se repitió
sobre árbol quieto. **Una suite que corre mientras cambia el código no mide nada.**

### El descubrimiento que sigue gobernando A3

**Existe implementación canónica y no está en esta rama.** PR **#356**
(`product/scale-hotpaths-342`) ya trae keyset pagination, búsqueda indexada y
golden de 701 líneas.

**No se puede fusionar a ciegas**: #356 es anterior a REG-323 y su
`updatePatient` **no tiene `vistoEn`**. Un merge directo regresaría la guardia de
concurrencia. Hay que **portar** conservando ambas.

### Los P0 que siguen abiertos

- **P0-2** `internamientos/{id}/registros` (bitácora NOM-004) no está en el respaldo
- **P0-3** `getPatients()` descarga la colección entera
- **P0-4** `findNotaByIdInClinic()` — todos los pacientes + un `getDoc` por paciente en serie
- **P0-5** `Promise.all` sobre todos los pacientes con un `getNotas` cada uno
- **P0-6** rebote de scroll en iPhone — causa raíz probable, **sin reproducir en dispositivo**

### Lo que este checkpoint NO afirma

- **Nada se ha visto en un navegador.** §38 no está satisfecha para el scroll.
- No se ha medido capacidad.
- El simulacro de restauración real sigue sin ejecutarse.
- `npm run build` no se ha corrido en esta sesión (sí `tsc --noEmit`).

### Qué hacer al reanudar

1. Leer `CLAUDE.md`, `AGENTS.md`, `.claude/rules/**`, el tablero y este archivo.
2. `git log` y `git status`. **No empezar de cero.**
3. Seguir por **A3**: portar #356 preservando REG-323, con golden probado al revés.
4. No reactivar Hospital/UCI. No priorizar Documents Zero-Friction.

---


## Checkpoint anterior · 28-ago-2026 — A1: el tablero existe y está medido

Cinco auditorías read-only en paralelo con verificación directa del orquestador.
Detalle completo en `docs/product/AUSCULTA-MASTER-BOARD.md`.
