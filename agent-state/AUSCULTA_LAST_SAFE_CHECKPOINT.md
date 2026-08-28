# AUSCULTA — último punto seguro

## Checkpoint · 28-ago-2026 — **seis P1 más cerrados; E0-06 bloqueado con motivo**

```
CURRENT_BRANCH=claude/ausculta-consultorio-completion-hoahgw
CURRENT_HEAD=03dbefb
CURRENT_PR=(ninguno — no se ha pedido)
CURRENT_WORKSTREAM=P1 · WS-03 (recorte no declarado) y WS-13 (recuperación)
LAST_COMPLETED_UNIT=P1-5 · REG-346 · ninguna llamada a proveedor cuelga la función
CURRENT_PARTIAL_UNIT=(ninguna)
EXACT_NEXT_ACTION=P1-11 — /pacientes con paginación y búsqueda de servidor; después P1-16 (importador de colecciones raíz)
FILES_IN_SCOPE=src/app/(dashboard)/pacientes/page.tsx · src/app/api/clinic/importar/route.ts
FILES_LOCKED=(ninguno — un solo writer)
TESTS_PASSED=10587
TESTS_FAILED=1
KNOWN_ENVIRONMENT_FAILURES=ops-timeout-y-punto-ciego.test.ts — exige que 10.255.255.1 trague paquetes; el proxy del contenedor rechaza al instante. Pasa de forma intermitente. NO tocar la aserción.
P0_OPEN=(ninguno interno)
P1_OPEN=P1-9 sobre #314 en la ruta de consulta · P1-10 licencia PMC · P1-11 recorte no declarado en 11 pantallas · P1-12 getNotas sin cota · P1-13 otros escritores de scroll · P1-14 índice compuesto del worklist · P1-15 sin circuit breaker · P1-16 importador de colecciones raíz
BLOCKED_EXTERNAL=P1-6 E0-06 alergias (backfill destructivo + política clínica + reglas) · P1-14 índice compuesto (consola de Firestore) · iPhone/WebKit real (sólo Chromium) · despliegue de firestore.rules · PITR/restore real · pentest · licencias de evidencia
DO_NOT_REGRESS=REG-323 · REG-337 · REG-338 · REG-339 · REG-340 · REG-341 · REG-342 · REG-343 · REG-344 · REG-345 · REG-346
```

### Cerrado en esta tanda

| REG | Qué |
|---|---|
| 343 | `clinic_members` fuera del respaldo: se restauraba y nadie podía entrar |
| 344 | El worklist truncaba en silencio; las tareas de la firma se perdían calladas |
| 345 | La matriz prometía fuentes sin adaptador; los avisos no llegaban a la pantalla |
| 346 | Trece llamadas a proveedor sin tope, dos en la ruta de 800 s |

### Dos hallazgos de auditoría que resultaron FALSOS, y quedan escritos

- La llamada a Claude de `procesar` **ya** tenía señal derivada del presupuesto.
- El `.catch(() => [])` de `expediente/evidencia` **no esconde nada**: hay un
  `testigo` mutable que se marca antes de que el `catch` lo alcance, y la ruta
  distingue «no se pudo preguntar» de «no hay literatura» en un aviso que la
  pantalla pinta.

Se dejan anotados para que nadie los «arregle» dos veces.

### Por qué E0-06 (alergias) se para

No es falta de tiempo: **la migración no existe** —hay tipo, lista de campos y
una prueba de forma, pero ni splitter, ni script, ni un solo lector o escritor en
producción— y el beneficio de seguridad **sólo aparece cuando los campos se
borran de los documentos vivos**, que es destructivo sobre datos clínicos reales.
Construir la mitad reversible no cierra nada y crea riesgo de **doble verdad en
alergias**, el campo más crítico del producto.

---

## Checkpoint anterior · REG-337–339


## Checkpoint anterior · 28-ago-2026 — A1: el tablero existe y está medido

Cinco auditorías read-only en paralelo con verificación directa del orquestador.
Detalle completo en `docs/product/AUSCULTA-MASTER-BOARD.md`.
