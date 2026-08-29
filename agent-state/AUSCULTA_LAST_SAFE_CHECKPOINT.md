# AUSCULTA — último punto seguro

## Checkpoint · 29-ago-2026 — **P1-16 cerrado; P1-18 hallado, reproducido y cerrado**

```
CURRENT_BRANCH=claude/ausculta-master-completion-4clx9v
CURRENT_HEAD=(este commit)
CURRENT_PR=#389
CURRENT_WORKSTREAM=WS-13 (recuperación) cerrando; siguiente WS-03/WS-02
LAST_COMPLETED_UNIT=P1-18 · REG-349 · restaurar no le quita la cuenta a otro consultorio
CURRENT_PARTIAL_UNIT=(ninguna)
EXACT_NEXT_ACTION=P1-12 — `getNotas` sin cota (la última amplificación de lectura sin techo), y con ella P1-11 en las nueve pantallas que reciben el recorte sin declararlo
FILES_IN_SCOPE=src/lib/expediente/firestore.ts
FILES_LOCKED=(ninguno — un solo writer)
TESTS_PASSED=10625
TESTS_FAILED=1
KNOWN_ENVIRONMENT_FAILURES=ops-timeout-y-punto-ciego.test.ts — exige que 10.255.255.1 trague paquetes; el proxy del contenedor rechaza al instante. NO tocar la aserción.
P0_OPEN=(ninguno interno)
P1_OPEN=P1-2 · P1-9 · P1-10 · P1-11 (nueve pantallas) · P1-12 · P1-13 · P1-15 · P1-17   → 8 internos
BLOCKED_EXTERNAL=P1-6 E0-06 alergias · P1-14 índice compuesto · iPhone/WebKit real · despliegue de firestore.rules · PITR/restore real · pentest · licencias de evidencia
DO_NOT_REGRESS=REG-323 · REG-337…REG-349
```

### Cerrado en esta tanda

| REG | Qué |
|---|---|
| 348 | El respaldo se llevaba las colecciones de nivel raíz y el importador las rechazaba todas |
| 349 | Esa restauración podía **quitarle la cuenta a otro consultorio**: miraba de quién era el documento fuera de transacción |

### El saldo, escrito

`cerrado −1 (P1-16)` · `nuevo +1 (P1-18)` · `cerrado −1 (P1-18)` → **9 → 8 P1
internos**. Un P1 nuevo no borra uno cerrado; se enseñan los dos.

### Cómo se encontró P1-18, y por qué importa el método

No lo encontró una prueba: lo encontró una **revisión independiente de la unidad
recién cerrada**, y se **reprodujo ejecutando la ruta** antes de tocar una línea.
Las pruebas de REG-348 estaban en verde y seguían estándolo con el defecto vivo,
porque comprobaban que el código **dijera** lo acordado —substrings sobre la
fuente— y no lo que la base hacía. Con el arnés en memoria, 3 casos caen.

**Lo que esto abre para el resto del programa**: el arnés
`_harness/firestore-admin-en-memoria.ts` ya cubre `doc`, `getAll`, `batch` y
`tx.getAll`. Las rutas de `/api` que escriben con el SDK admin se pueden probar
por comportamiento. Varias casillas `PARTIAL` del tablero descansan hoy sobre
substrings.

---

## Checkpoint anterior · REG-337–339


## Checkpoint anterior · 28-ago-2026 — A1: el tablero existe y está medido

Cinco auditorías read-only en paralelo con verificación directa del orquestador.
Detalle completo en `docs/product/AUSCULTA-MASTER-BOARD.md`.
