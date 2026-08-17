# DOCUMENTATION ENGINE / CLINICAL TRUTH — SLICE 001

Parent board: GitHub issue #296.
Base checkpoint: CONTEXT-CANONICALIZATION head `583dd1439ed01a91af3dd6bb35253f610fb9f08e`.
Status: READY_FOR_WRITER.
Writer: exactly one Claude/Opus writer when approved transport is available.
Judge: Codex independent read-only after a frozen completed slice when transport is available/appropriate.

## Goal
Implement the smallest production-grade Clinical Truth core that makes one structured clinical truth the immutable semantic source for multiple downstream medical documents and later clinical workflows.

## Mandatory properties
1. One clinical truth -> structured facts/encounter model -> multiple renderers.
2. Absolute NO INVENTAR.
3. Preserve truth states exactly: `NEGADO`, `NO_INTERROGADO`, `NO_DOCUMENTADO`, `DESCONOCIDO`, `INFERIDO`, `INCIERTO`, `CONFLICTIVO`.
4. Preserve provenance for clinically meaningful facts, including source modality/actor, encounter/time context, uncertainty/confidence where applicable, and correction lineage.
5. Preserve draft/signed document lifecycle. Signed content cannot be silently rewritten; amendments/new versions must be auditable.
6. Clinician corrections may feed `ClinicianPreferenceProfile` for presentation/style/workflow personalization but may never mutate underlying clinical truth.
7. Input-normalization contracts must accept dictation, free text, mixed voice+text, abbreviations/disorganized notes, spelling errors, medical terminology, Spanish/English/Spanglish without requiring re-dictation. ASR/provider transport itself is out of scope until VOICE ENGINE.
8. A renderer contract must support the 15 canonical document outputs enumerated in `docs/product/CONTEXT_CANONICAL.md` from the same truth model.

## Mandatory deterministic safety tests
Prove the implementation rejects or safely preserves:
- inferred/uncertain/conflicting data being promoted silently to asserted fact;
- collapse of `NEGADO` into `NO_DOCUMENTADO` or `NO_INTERROGADO`;
- provenance loss during correction/update;
- mutation of signed clinical document content;
- renderer-specific mutation of source clinical truth;
- conflict overwrite without explicit resolution;
- preference learning changing a clinical fact rather than presentation/style;
- missing mandatory provenance on clinically meaningful asserted/inferred facts.

Also prove at least two renderers consume the same structured truth without mutating it.

## Scope exclusions
Do not build broad UI, ambient audio capture, ASR-provider integration, Evidence/Reasoning, hospital workflows, or optional refactors in this slice. Interfaces for later slices are allowed only when load-bearing for the Clinical Truth contract.

## Definition of done
- Core production model/contracts and safe update/version semantics are implemented.
- Mandatory focused deterministic safety tests pass.
- Relevant repository CI passes on the frozen head.
- Canonical board is updated to the next slice only after verified completion.
- No merge to `main`, production deploy, PHI, production-secret rotation, destructive action, clinical-policy change, weakened safety/security gate, or unapproved new spending.
