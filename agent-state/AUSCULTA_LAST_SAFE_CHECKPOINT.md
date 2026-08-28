# AUSCULTA — último punto seguro

## Checkpoint · 28-ago-2026 — **REG-340 cerrada** (censo de colecciones)

```
CURRENT_BRANCH=claude/ausculta-consultorio-completion-hoahgw
CURRENT_HEAD=9f14d14
CURRENT_PR=(ninguno — no se ha pedido)
CURRENT_WORKSTREAM=WS-03 (escala / consultorio grande)
LAST_COMPLETED_UNIT=P0-2 · REG-340 · censo de colecciones derivado del código
CURRENT_PARTIAL_UNIT=(ninguna)
EXACT_NEXT_ACTION=A3 — portar PR #356 (product/scale-hotpaths-342) sobre esta rama PRESERVANDO REG-323
FILES_IN_SCOPE=src/lib/firestore.ts · src/lib/expediente/firestore.ts · pacientes/page.tsx · PaletteBusqueda.tsx · cumplimiento/retencion/page.tsx
FILES_LOCKED=(ninguno — un solo writer)
TESTS_PASSED=10511
TESTS_FAILED=1
KNOWN_ENVIRONMENT_FAILURES=ops-timeout-y-punto-ciego.test.ts — exige que 10.255.255.1 trague paquetes; el proxy del contenedor rechaza al instante. NO tocar la aserción.
P0_OPEN=P0-3 getPatients ilimitado · P0-4 findNotaByIdInClinic N+1 en serie · P0-5 Promise.all sobre todos los pacientes · P0-6 rebote de scroll en iPhone
P1_OPEN=P1-2 21 colecciones raíz (clinic_members sin respaldo) · P1-3..P1-10 en el tablero
BLOCKED_EXTERNAL=despliegue de firestore.rules (dueño) · PITR/restore real (gcloud) · pentest · licencias de evidencia
DO_NOT_REGRESS=REG-323 (vistoEn en updatePatient) · REG-337 (tarea de revisión de laboratorio) · REG-338 (secreto TOTP local) · REG-339 (nota fuera de consola) · REG-340 (censo desde el código)
```

### Lo que cerró REG-340 y lo que NO

Nueve colecciones de consultorio se escribían y no estaban en ninguno de los tres
sitios de declaración. La causa era de forma: los dos guardianes parsean
`firestore.rules` y lo toman por el censo. El guardián nuevo deriva el censo del
**código**.

**No cierra**: las reglas se publican aparte y eso es del dueño, así que
`members` **sigue roto en producción** hasta que se desplieguen. Y quedan 21
colecciones de nivel raíz con declaración incompleta —`clinic_members` sin
respaldo es el que importa—.

---

## Checkpoint anterior · REG-337–339


## Checkpoint anterior · 28-ago-2026 — A1: el tablero existe y está medido

Cinco auditorías read-only en paralelo con verificación directa del orquestador.
Detalle completo en `docs/product/AUSCULTA-MASTER-BOARD.md`.
