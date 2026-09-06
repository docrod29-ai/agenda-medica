# AUSCULTA — Master Completion Loop · estado del programa

> **El contrato del loop vive en
> [`AUSCULTA_MASTER_LOOP_DIRECTIVO.md`](AUSCULTA_MASTER_LOOP_DIRECTIVO.md)** — los 26
> apartados íntegros del dueño. Este archivo es sólo el estado operativo; si los dos
> se contradicen, gana el directivo.

Fuente operativa: [`docs/product/AUSCULTA-MASTER-BOARD.md`](../docs/product/AUSCULTA-MASTER-BOARD.md).
Los tres programas en vuelo: [`docs/product/PROGRAMAS-EN-VUELO.md`](../docs/product/PROGRAMAS-EN-VUELO.md).
Punto de reanudación: [`AUSCULTA_LAST_SAFE_CHECKPOINT.md`](AUSCULTA_LAST_SAFE_CHECKPOINT.md).

## Rama y candados de escritura

| | |
|---|---|
| **Rama** | `claude/ausculta-master-completion-4clx9v` |
| **Writer** | una sola sesión (Claude). Las 5 auditorías fueron **read-only** y ya terminaron |
| **Candados vivos** | ninguno en este momento |

## Superficies con candado cuando se trabajen

`src/lib/firestore.ts` · `src/lib/expediente/firestore.ts` · `firestore.rules` ·
`src/lib/authz/matriz-acceso.ts` · `src/lib/clinica/respaldo.ts` ·
`src/lib/clinical-truth/` · tipos clínicos compartidos ·
`src/lib/evidence-integrations/contrato.ts` · `layout.tsx` del dashboard.

## Orden de ejecución acordado (§29)

- **FASE A** — A1 tablero ✅ · A2 scroll iPhone · A3 escala · A4 evidencia ✅ · A5 seguridad ✅
- **FASE B** — paginación, Patient State, ciclo cerrado, resiliencia
- **FASE C** — evidencia en runtime, guías, aplicabilidad, evaluación, router
- **FASE D** — infectología, medicina interna, móvil/accesibilidad
- **FASE E** — carga, inyección de fallos, observabilidad, restauración, evaluación, equipo rojo

## Lo que este programa NO hará sin nueva autorización

Fusionar a `main` · desplegar · borrar producción · rotar secretos · comprar
servicios · aceptar términos · mandar mensajes reales · emitir receta real ·
usar PHI · reactivar Hospital/UCI · priorizar Documents Zero-Friction.
