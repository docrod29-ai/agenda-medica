# DOCUMENTATION ENGINE / CLINICAL TRUTH — SLICE 001

Parent board: GitHub issue #296.
Base checkpoint: CONTEXT-CANONICALIZATION head `583dd1439ed01a91af3dd6bb35253f610fb9f08e`.
Status: COMPLETE.
Implementation head verified by CI before board advance: `6e7886ca3b1c8103ff0c20e126583582a2ee9525` (CI #1082 SUCCESS).
Judge: Codex independent read-only when transport is available/appropriate; absence of transport is not recorded as PASS.

## Goal
Implement the smallest production-grade Clinical Truth core that makes one structured clinical truth the immutable semantic source for multiple downstream medical documents and later clinical workflows.

## Mandatory properties
1. One clinical truth -> structured facts/encounter model -> multiple renderers.
2. Absolute NO INVENTAR.
3. Preserve truth states exactly: `NEGADO`, `NO_INTERROGADO`, `NO_DOCUMENTADO`, `DESCONOCIDO`, `INFERIDO`, `INCIERTO`, `CONFLICTIVO`.
4. Preserve provenance for clinically meaningful facts, including source modality/actor, encounter/time context, uncertainty/confidence where applicable, and correction lineage.
5. Preserve draft/signed document lifecycle. Signed content cannot be silently rewritten; amendments/new versions must be auditable.
6. Clinician corrections may feed `ClinicianPreferenceProfile` for presentation/style/workflow personalization but may never mutate underlying clinical truth.
7. Input-normalization contracts accept dictation, free text, mixed voice+text, abbreviations/disorganized notes, spelling errors, medical terminology, Spanish/English/Spanglish without requiring re-dictation. ASR/provider transport remains out of scope until VOICE ENGINE.
8. Renderer contract supports the 15 canonical document outputs enumerated in `docs/product/CONTEXT_CANONICAL.md` from the same truth model.

## Verified mandatory safety properties
Focused deterministic tests prove preservation/rejection for uncertainty promotion, undocumented/negated distinction, correction provenance, signed-document immutability, source-truth immutability across renderers, conflict preservation, preference isolation, mandatory provenance, and multi-renderer consumption of the same structured truth.

## Scope exclusions retained
Broad UI, ambient audio capture, ASR-provider integration, Evidence/Reasoning, hospital workflows, and optional refactors remain for their canonical slices.

## Completion decision
The implementation satisfies the mandatory contract and relevant repository CI is green on the verified implementation head. Under NO-GOLD-PLATING, optional renderer prose sophistication and model/provider integration are intentionally deferred to later product slices rather than extending this core indefinitely.
