# AUSCULTA — último punto seguro

## Checkpoint · 29-ago-2026 — **tres P1 cerrados (P1-16, P1-18, P1-12)**

```
CURRENT_BRANCH=claude/ausculta-master-completion-4clx9v
CURRENT_HEAD=(este commit)
CURRENT_PR=#389
CURRENT_WORKSTREAM=WS-03 (consultorio grande) — cerrando el inventario de lecturas sin cota
LAST_COMPLETED_UNIT=P1-12 · REG-350 · el historial completo de un paciente ya no se baja en cada pantalla
CURRENT_PARTIAL_UNIT=(ninguna)
EXACT_NEXT_ACTION=WS-03 · `hooks/useAppointments.ts:94` — historia de citas de un paciente EN VIVO, sin cota; después `PaletteBusqueda.tsx:60` (Cmd-K descarga el consultorio para enseñar 6) y los documentos que crecen sin techo de `internamientos/{id}`
FILES_IN_SCOPE=src/hooks/useAppointments.ts · src/components/PaletteBusqueda.tsx
FILES_LOCKED=(ninguno — un solo writer)
TESTS_PASSED=10653
TESTS_FAILED=1
KNOWN_ENVIRONMENT_FAILURES=ops-timeout-y-punto-ciego.test.ts — exige que 10.255.255.1 trague paquetes; el proxy del contenedor rechaza al instante. NO tocar la aserción.
BUILD=compila con los placeholders NEXT_PUBLIC_FIREBASE_* del CI; sin ellos falla en «collect page data» (auth/invalid-api-key), que es del entorno
P0_OPEN=(ninguno interno)
P1_OPEN=P1-2 · P1-9 · P1-10 · P1-11 (nueve pantallas) · P1-13 · P1-15 · P1-17   → 7 internos
BLOCKED_EXTERNAL=P1-6 E0-06 alergias · P1-14 índice compuesto · iPhone/WebKit real · despliegue de firestore.rules · PITR/restore real · pentest · licencias de evidencia
DO_NOT_REGRESS=REG-323 · REG-337…REG-350
```

### Cerrado en esta tanda

| REG | Qué |
|---|---|
| 348 | El respaldo se llevaba las colecciones de nivel raíz y el importador las rechazaba todas |
| 349 | Esa restauración podía **quitarle la cuenta a otro consultorio**: miraba de quién era el documento fuera de transacción |
| 350 | El historial completo de un paciente se bajaba en cada pantalla — y con él caían dos amplificaciones peores y una salvaguarda que habría quedado colgando del techo |

### El saldo, escrito

`cerrado −1 (P1-16)` · `nuevo +1 (P1-18)` · `cerrado −1 (P1-18)` ·
`cerrado −1 (P1-12)` → **9 → 7 P1 internos**. Un P1 nuevo no borra uno cerrado;
se enseñan los dos movimientos.

### Dos herramientas nuevas que el resto del programa puede usar

1. **`_harness/firestore-admin-en-memoria.ts`** cubre ya `doc`, `getAll`,
   `batch` y `tx.getAll`, con un gancho de interceptación **en la lectura**. Una
   ruta de `/api` que escribe con el SDK admin **ya no tiene que probarse leyendo
   su fuente como texto**.
2. **`_harness/firestore-cliente-en-memoria.ts`** (extraído del golden de
   REG-341, no copiado) cuenta documentos leídos y ahora entiende
   `getCountFromServer` y `startAfter` **en la dirección del orden**.

Varias casillas `PARTIAL` del tablero descansan hoy sobre pruebas de substring
—WS-05 lo dice de las de scroll—; éstas son la vía para convertirlas en medición.

---

## Checkpoint anterior · REG-337–339


## Checkpoint anterior · 28-ago-2026 — A1: el tablero existe y está medido

Cinco auditorías read-only en paralelo con verificación directa del orquestador.
Detalle completo en `docs/product/AUSCULTA-MASTER-BOARD.md`.
