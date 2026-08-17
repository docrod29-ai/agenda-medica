# AUSCULTA PRODUCT BOARD

Canonical visible board: GitHub issue #296.
Baseline: V15 accepted `317c6c5695b69e1a543d99d65e897f638db563a8`.

| Order | Slice | Status |
|---:|---|---|
| 1 | CONTEXT-CANONICALIZATION | COMPLETE |
| 2 | DOCUMENTATION ENGINE / CLINICAL TRUTH | ACTIVE |
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

## Completed milestone — CONTEXT-CANONICALIZATION
Deliverables present:
- `docs/product/CONTEXT_CANONICAL.md`
- `docs/product/PRODUCT_BOARD.md`
- `docs/product/DECISION_REGISTER.md`
- `scripts/product/context-verifier.mjs`
- focused deterministic tests under `tests/product/`

CI for the frozen context checkpoint passed. Codex-specific transport was not discoverable from the repository workflow surface; this is not treated as PASS and does not block moving to the next slice because the independent judge is required when available/appropriate, not as a substitute for deterministic acceptance.

## Current milestone — DOCUMENTATION ENGINE / CLINICAL TRUTH
Mandatory direction:
- one clinical truth -> structured facts/encounter model -> multiple document renderers;
- absolute NO INVENTAR;
- explicit truth states: NEGADO / NO_INTERROGADO / NO_DOCUMENTADO / DESCONOCIDO / INFERIDO / INCIERTO / CONFLICTIVO;
- preserve provenance and encounter/time context;
- draft/signed lifecycle with auditable amendments rather than silent rewrite;
- physician corrections may shape ClinicianPreferenceProfile but never rewrite underlying clinical truth;
- accept dictation, free text, mixed voice+text, abbreviated/disorganized input, spelling errors, medical terminology, Spanish/English/Spanglish without requiring re-dictation;
- support the 15 canonical document outputs enumerated in `CONTEXT_CANONICAL.md`.

Next action: implement the smallest production-grade Clinical Truth core and focused deterministic tests on a dedicated product branch without broad UI or Voice Engine work.
