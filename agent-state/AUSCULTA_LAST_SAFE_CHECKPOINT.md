# AUSCULTA — último punto seguro

## Checkpoint · 28-ago-2026 — **los siete P0 del tablero, cerrados o acotados**

```
CURRENT_BRANCH=claude/ausculta-consultorio-completion-hoahgw
CURRENT_HEAD=148a415
CURRENT_PR=(ninguno — no se ha pedido)
CURRENT_WORKSTREAM=P1 · WS-11 (ciclo cerrado) y WS-13 (respaldo raíz)
LAST_COMPLETED_UNIT=P0-6 · REG-342 · rebote de scroll en iPhone (causa raíz)
CURRENT_PARTIAL_UNIT=(ninguna)
EXACT_NEXT_ACTION=P1-2 — respaldo de las colecciones de nivel raíz, empezando por clinic_members
FILES_IN_SCOPE=src/lib/clinica/respaldo.ts · src/app/api/clinic/exportar/route.ts
FILES_LOCKED=(ninguno — un solo writer)
TESTS_PASSED=10566
TESTS_FAILED=1
KNOWN_ENVIRONMENT_FAILURES=ops-timeout-y-punto-ciego.test.ts — exige que 10.255.255.1 trague paquetes; el proxy del contenedor rechaza al instante. NO tocar la aserción.
P0_OPEN=(ninguno interno)
P1_OPEN=P1-2 colecciones raíz sin respaldo · P1-3 tareas sin await · P1-4 tareasVivas sin orderBy · P1-5 7 llamadas sin abort · P1-6 alergias legibles por recepción · P1-7..P1-10 evidencia · P1-11 recorte no declarado en 11 pantallas · P1-12 getNotas sin cota · P1-13 otros escritores de scroll
BLOCKED_EXTERNAL=iPhone/WebKit real (sólo hay Chromium; prohibido descargar navegadores) · despliegue de firestore.rules (dueño) · PITR/restore real (gcloud) · pentest · licencias de evidencia
DO_NOT_REGRESS=REG-323 vistoEn · REG-337 tarea de laboratorio · REG-338 secreto TOTP local · REG-339 nota fuera de consola · REG-340 censo desde el código · REG-341 lecturas acotadas + recorte declarado · REG-342 el riel no mueve la página
```

### Lo cerrado en esta tanda

| REG | Qué |
|---|---|
| 337 | Un resultado de laboratorio de consultorio no generaba tarea de revisión |
| 338 | El secreto TOTP viajaba a un tercero en una URL |
| 339 | La nota clínica entera se escribía en la consola |
| 340 | Nueve colecciones sin declarar; el censo ahora sale del código |
| 341 | Lecturas del directorio acotadas (portado de #356 preservando REG-323) |
| 342 | El rebote de scroll en iPhone: causa raíz, dos mecanismos |

### Lo que NO se afirma

- **Nada se ha visto en un navegador.** El §38 sigue sin satisfacerse para el
  scroll: sólo hay Chromium instalado y no se permite descargar WebKit.
- **No se ha medido capacidad.** REG-341 acota las lecturas; no demuestra que el
  producto aguante 50 k pacientes.
- **Las reglas no se despliegan aquí**, así que `members` sigue roto en producción.
- El simulacro de restauración real sigue sin ejecutarse.

---

## Checkpoint anterior · REG-337–339


## Checkpoint anterior · 28-ago-2026 — A1: el tablero existe y está medido

Cinco auditorías read-only en paralelo con verificación directa del orquestador.
Detalle completo en `docs/product/AUSCULTA-MASTER-BOARD.md`.
