# AUSCULTA — último punto seguro

## Checkpoint · 29-ago-2026 — **cuatro P1 cerrados (P1-16, P1-18, P1-12, P1-11)**

```
CURRENT_BRANCH=claude/ausculta-master-completion-4clx9v
CURRENT_HEAD=(este commit)
CURRENT_PR=#389
CURRENT_WORKSTREAM=WS-03 (consultorio grande) — queda el inventario de lecturas de CITAS
LAST_COMPLETED_UNIT=P1-11 · REG-351 · ninguna pantalla recibe ya una lista muda
CURRENT_PARTIAL_UNIT=(ninguna)
EXACT_NEXT_ACTION=WS-03 · las citas: `expediente/firestore.ts:216` (colección ENTERA de citas del consultorio en la baja de un paciente) y `hooks/useAppointments.ts:94` (`usePatientAppointments`, listener en vivo sin cota). Después P1-15 (sin circuit breaker) y P1-2 (colecciones sin declarar).
FILES_IN_SCOPE=src/lib/expediente/firestore.ts · src/hooks/useAppointments.ts
FILES_LOCKED=(ninguno — un solo writer)
TESTS_PASSED=10679
TESTS_FAILED=1
KNOWN_ENVIRONMENT_FAILURES=ops-timeout-y-punto-ciego.test.ts — exige que 10.255.255.1 trague paquetes; el proxy del contenedor rechaza al instante. NO tocar la aserción.
BUILD=compila con los placeholders NEXT_PUBLIC_FIREBASE_* del CI; sin ellos falla en «collect page data» (auth/invalid-api-key), que es del entorno
P0_OPEN=(ninguno interno)
P1_OPEN=P1-2 · P1-9 · P1-10 · P1-13 · P1-15 · P1-17   → 6 internos
BLOCKED_EXTERNAL=P1-6 E0-06 alergias · P1-14 índice compuesto · iPhone/WebKit real · despliegue de firestore.rules · PITR/restore real · pentest · licencias de evidencia
DO_NOT_REGRESS=REG-323 · REG-337…REG-351
```

### Cerrado en esta tanda

| REG | Qué |
|---|---|
| 348 | El respaldo se llevaba las colecciones de nivel raíz y el importador las rechazaba todas |
| 349 | Esa restauración podía **quitarle la cuenta a otro consultorio**: miraba de quién era el documento fuera de transacción |
| 350 | El historial completo de un paciente se bajaba en cada pantalla — y con él caían dos amplificaciones peores y una salvaguarda que habría quedado colgando del techo |
| 351 | Nueve pantallas trataban el recorte del directorio como el censo completo: typeahead que decía «no está», importador que duplicaba el consultorio, panel NOM-004 que afirmaba «al día», libro de controlados sin el nombre de a quién se le dio |

### El saldo, escrito

`cerrado −1 (P1-16)` · `nuevo +1 (P1-18)` · `cerrado −1 (P1-18)` ·
`cerrado −1 (P1-12)` · `cerrado −1 (P1-11)` → **9 → 6 P1 internos**.
Un P1 nuevo no borra uno cerrado; se enseñan los dos movimientos.

### Lo que el tablero decía y el código desmentía

- `PaletteBusqueda` figuraba como «descarga 50 000 pacientes para enseñar 6».
  **REG-341 ya lo había cerrado**; el tablero estaba atrasado y queda corregido.
- `pacientes/page.tsx:934` (segunda descarga sin caché para deduplicar) también
  estaba cerrado desde REG-347.

### Herramientas que el resto del programa puede usar

1. **`_harness/firestore-admin-en-memoria.ts`** — `doc`, `getAll`, `batch`,
   `tx.getAll` y un gancho de interceptación **en la lectura**.
2. **`_harness/firestore-cliente-en-memoria.ts`** — cuenta documentos leídos,
   entiende `getCountFromServer`, `startAfter` **en la dirección del orden**, y
   sabe simular una **lectura caída** (`fallos.lectura`), que es como se prueba
   que alguien distingue «no hay» de «no se pudo preguntar».
3. **`src/lib/pacientes/candidatos.ts`** + `useBusquedaDePacientes` +
   `usePacientesPorId` — la forma canónica de preguntar por un paciente.

Una ruta de `/api` o una pantalla **ya no tiene que probarse leyendo su fuente
como texto**. Varias casillas `PARTIAL` del tablero descansan todavía sobre
substrings; ésta es la vía para convertirlas en medición.

---

## Checkpoint anterior · REG-337–339


## Checkpoint anterior · 28-ago-2026 — A1: el tablero existe y está medido

Cinco auditorías read-only en paralelo con verificación directa del orquestador.
Detalle completo en `docs/product/AUSCULTA-MASTER-BOARD.md`.
