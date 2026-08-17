# AUSCULTA PRODUCT BOARD

Canonical visible board: GitHub issue #296.
Baseline: V15 accepted `317c6c5695b69e1a543d99d65e897f638db563a8`.

| Order | Slice | Status |
|---:|---|---|
| 1 | CONTEXT-CANONICALIZATION | ACTIVE |
| 2 | DOCUMENTATION ENGINE / CLINICAL TRUTH | QUEUED |
| 3 | VOICE ENGINE | QUEUED |
| 4 | CLINICAL REASONING + EVIDENCE + SAFETY | QUEUED |
| 5 | CONSULTORIO / AGENDA / RECETA / PAGOS / SECRETARIA | QUEUED |
| 6 | WHATSAPP / PATIENT EXPERIENCE | QUEUED |
| 7 | HOSPITAL / UCI | QUEUED |
| 8 | SPECIALTY PACKAGES | QUEUED |
| 9 | MOBILE FIRST + BRAND / UI | QUEUED |
| 10 | RELIABILITY / SCALE / OBSERVABILITY / DR / SECURITY / PRODUCTION READINESS | QUEUED |
| 11 | EVALUATION KERNEL / competitive benchmark | QUEUED |

## Execution rules
- Exactly one ACTIVE product slice.
- Mandatory criteria first; no gold plating.
- Small persisted checkpoints plus relevant tests.
- Parallel work is allowed only when independent and non-overlapping with the active writer.
- Control Plane P2/P3: DEFERRED. Only blocking P0/P1 can interrupt product execution.
- Product merge/deploy and other owner-gated actions require explicit owner approval.

## Current milestone
CONTEXT-CANONICALIZATION deliverables:
- `docs/product/CONTEXT_CANONICAL.md`
- `docs/product/PRODUCT_BOARD.md`
- `docs/product/DECISION_REGISTER.md`
- `scripts/product/context-verifier.mjs`
- focused deterministic tests under `tests/product/`

On completion, move ACTIVE status to DOCUMENTATION ENGINE / CLINICAL TRUTH; do not run both slices as ACTIVE simultaneously.
