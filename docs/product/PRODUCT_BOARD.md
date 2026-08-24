# AUSCULTA PRODUCT BOARD

Canonical visible board: GitHub issue #296.
Baseline: V15 accepted `317c6c5695b69e1a543d99d65e897f638db563a8`.

| Order | Slice | Status |
|---:|---|---|
| 1 | CONTEXT-CANONICALIZATION | COMPLETE |
| 2 | DOCUMENTATION ENGINE / CLINICAL TRUTH | COMPLETE |
| 3 | VOICE ENGINE | ACTIVE |
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

Frozen context checkpoint `583dd1439ed01a91af3dd6bb35253f610fb9f08e` passed CI #1069. Codex-specific transport was not discoverable; this is not treated as PASS.

## Completed milestone — DOCUMENTATION ENGINE / CLINICAL TRUTH
Verified implementation head `6e7886ca3b1c8103ff0c20e126583582a2ee9525` passed CI #1082.

Mandatory core delivered:
- canonical `TruthState` model with explicit NEGADO / NO_INTERROGADO / NO_DOCUMENTADO / DESCONOCIDO / INFERIDO / INCIERTO / CONFLICTIVO states;
- required provenance, encounter/time context, uncertainty/confidence contracts, and correction lineage;
- `EncounterTruth` append semantics that preserve conflicting facts rather than overwrite them;
- NO INVENTAR renderer boundary through explicit source fact IDs;
- immutable signed-document history with auditable amendments;
- clinician preference corrections isolated from underlying clinical truth;
- input normalization contract for dictation/free text/mixed voice+text and Spanish/English/Spanglish without semantic invention;
- 15 canonical document output contracts and proof that multiple renderers consume the same structured truth without mutation;
- focused deterministic positive and negative invariant tests.

Under NO-GOLD-PLATING, provider/model integration, sophisticated prose generation, UI, and ambient capture move to their canonical later slices.

## Current milestone — VOICE ENGINE
Minimum accepted experience is comparable to Suki/Abridge/Nabla and must aim for the physician experience of fast, low-friction clinical dictation/ambient capture: clinically accurate terminology, Spanish/English/Spanglish, contextual correction, minimal repetition, explicit uncertainty rather than invented facts, and measurable latency/clinical transcription-error performance.

The slice contract is persisted at `docs/product/slices/VOICE_ENGINE_001.md`, and the provider-agnostic session/transcript/revision contracts, the hardened bridge into Clinical Truth, and the deterministic latency/revision instrumentation are implemented with focused positive and negative tests. No paid production ASR provider is chosen or bound.

Gate state: `REPAIRED_CI_GREEN_JUDGE_IN_FLIGHT`. The one owner-authorized paid independent Codex exact-SHA re-audit is already issued; its verdict is UNKNOWN until the immutable artifact is recovered, and no duplicate paid judge may be launched.

Next action: recover the immutable verdict. PASS — or only nonblocking P2/P3 — closes the Voice gate and advances the board to CLINICAL REASONING + EVIDENCE + SAFETY. A blocking P0/P1 reopens a bounded repair for that finding only; any further paid re-audit needs new explicit spending authorization.
