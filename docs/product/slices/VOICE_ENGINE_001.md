# VOICE ENGINE — SLICE 001

Parent board: GitHub issue #296.
Base checkpoint: Documentation Engine / Clinical Truth completion branch.
Status: ACTIVE.

## Product bar
The minimum accepted physician experience is competitive with current Suki/Abridge/Nabla-class ambient and dictation products: fast capture, low friction, clinically strong terminology, multilingual support, contextual correction, and minimal forced repetition. This is a product floor, not a claim that Ausculta already equals those products.

Current official product evidence reviewed in August 2026 confirms that leading systems support ambient clinical documentation, streaming/dictation workflows, multilingual operation, and structured note generation. Ausculta therefore cannot treat basic transcription alone as completion.

## Mandatory properties
1. Provider-agnostic streaming transcript contract; do not bind core clinical truth to one ASR vendor.
2. Preserve provisional vs final transcript state. Interim hypotheses may be revised; finalized text must retain revision provenance rather than being silently overwritten.
3. Preserve timestamps, speaker when available, confidence when supplied, and provider/session identifiers without making them mandatory clinical facts.
4. Spanish, English, and Spanglish are first-class language modes; medical terminology and abbreviations must not be normalized through a generic-language-only assumption.
5. Contextual correction is allowed at transcript level, but ambiguity must be explicit. Low-confidence/competing hypotheses may not be promoted into clinical truth as certain facts.
6. The bridge into Clinical Truth produces `ClinicalInput`/normalized input only. Voice Engine itself must not invent diagnoses, medications, doses, negations, or other semantic facts.
7. Deterministic instrumentation must expose latency and correction signals at minimum: time-to-first-partial, time-to-final, revision count, and unresolved-review count. Provider comparisons later use the same metric contract.
8. Audio/transcript handling interfaces must permit later ambient multi-speaker capture and dictation without requiring a Clinical Truth rewrite.
9. No PHI fixtures in repository tests. Synthetic clinical utterances only.

## Mandatory deterministic safety tests
Prove that:
- provisional transcript revisions do not create duplicate clinical inputs;
- a finalized segment cannot be silently replaced; revision lineage is retained;
- unresolved ambiguity remains marked for review;
- missing confidence does not become fake certainty;
- Spanish/English/Spanglish labels survive the bridge;
- transcript text reaches Clinical Truth input without semantic invention;
- metrics are deterministic from supplied timestamps;
- multiple transcript segments preserve order.

## Benchmark strategy
Do not pick a paid production ASR provider in this slice. First establish the provider-neutral contract and synthetic benchmark harness. Later provider bake-off should compare at least clinical term error, medication/dose error, negation error, speaker attribution where applicable, time-to-first-partial, time-to-final, correction burden, and forced-repeat rate on a consented/non-PHI or explicitly approved evaluation corpus.

## P1 repair record — exact-SHA audit `4b5f66d9565cb15aa06350f7b544d39226c8434d`
Independent Codex run `32200858183` returned FAIL for two blocking P1 findings. Both are closed in
`src/lib/voice-engine/index.ts` with focused negative tests in
`src/__tests__/voice-engine-estado-obsoleto-y-revision-incompleta.test.ts`.

The audit names the transition gates `advanceVoiceSession` / `applyVoiceRevision`; in this repository those
transitions are `appendTranscriptSegment` / `finalizeTranscriptSegment` and `reviseTranscriptSegment`.

1. **Stale state transitions rejected.** Every transition is now validated against the target segment's own
   lineage head — the newest of `receivedAt`, all recorded `revisedAt`, and `finalizedAt`. A transition dated
   before that head is refused, so an older artifact cannot be promoted, finalized, or replayed over a newer
   transcript, and the deterministic latency metrics can no longer be masked by clamping.
   Finalization order *between* segments is deliberately not constrained: a streaming provider may legitimately
   finalize a later segment first.
2. **Revised final text revalidated.** Being final before a revision no longer makes the revised text safe to
   keep final. Text bound for `final` must pass the structural gate `isFinalizableTranscriptText`: a revision
   that leaves a final segment structurally incomplete is rejected and the previous final text stays intact; the
   same text on a partial segment forces `needsReview` and cannot be promoted to final, so it never enters
   `ClinicalInput` as finalized truth. The gate is structural only — it never judges clinical completeness,
   which stays with the clinician and with `needsReview`.

## P1 repair record — exact-SHA audit `4aba2a9cb2dfdd05bcd87205d22a8bab7fec8b41`
Independent read-only Codex run `32335436023` returned FAIL for four blocking P1 findings. This directive
supersedes the two-P1 directive above. All four are closed in `src/lib/voice-engine/index.ts` with focused
negative tests in `src/__tests__/voice-engine-ambiguedad-linaje-y-cronologia.test.ts`.

1. **Unresolved ambiguity cannot be silently cleared.** Competing alternatives — more than one distinct
   hypothesis recorded for the same audio — now force `needsReview`, and `needsReview` is monotonic across
   every transition: `appendTranscriptSegment`, `reviseTranscriptSegment` and `finalizeTranscriptSegment` may
   raise it and can never lower it. Passing `needsReview: false` over an existing `true` is refused with a
   message naming the resolution path, so an ambiguous dictation cannot become review-free by being finalized.
   The single auditable exit is `resolveTranscriptReview`, which requires an identified resolver, a rationale,
   and a `resolvedText` that was **actually heard** (the current text or a recorded alternative) — resolving
   ambiguity selects among hypotheses and never authors a new one. On an already-final segment a resolution
   may only confirm the current text; switching a final transcript to a rival hypothesis stays with
   clinician-correction lineage.
2. **Revision lineage retains supplied confidence and alternatives.** `TranscriptRevision` and
   `TranscriptReviewResolution` both carry `previousText`, `previousConfidence` and `previousAlternatives`, so
   what a revision replaced stays recoverable through the Clinical Truth bridge across any number of
   revisions. Absent confidence stays absent — nothing is back-filled.
3. **Impossible session chronology fails closed.** `receivedAt` earlier than `session.startedAt` is rejected
   at append, and `measureVoiceSession` throws instead of clamping. The former `Math.max(0, …)` reported a
   segment predating its own session as a flawless 0 ms — the best latency in the corpus produced by a broken
   clock. Arrival exactly at `startedAt` remains a legitimate 0 ms.
4. **Benchmark dimensions completed.** `contextualRecoveryRate`
   (`contextualRecoveredCount / contextualRecoveryOpportunityCount`) measures contextual-correction/recovery
   quality, and `forcedRepeatRate` (`forcedRepeatCount / physicianUtteranceCount`) gives forced repeats a
   valid denominator; both are aggregated by `summarizeVoiceBenchmark`. Existing counts, latency and clinical
   error metrics are unchanged. Without a denominator the rate stays explicitly `undefined`, never 0, and
   impossible denominators (recovered above opportunities, repeats above utterances) are refused rather than
   rescaled.

Not covered: whether a clinician's resolution was clinically correct (only that it is auditable, attributed
and chosen among what was heard), acceptance thresholds for latency/WER/repeat rate (Evaluation Kernel), and
ASR provider selection.

## P1 repair record — exact-SHA audit `ce11fae427ae2ed957d9b1deb063c8de3d744547`
Canonical CI #1135 was SUCCESS on this exact SHA. Independent read-only Codex run `32382463886` returned FAIL
for three blocking P1 findings and one nonblocking P2. This directive supersedes the four-P1 directive above.
All three P1s are closed in `src/lib/voice-engine/index.ts` with focused negative tests in
`src/__tests__/voice-engine-confianza-heredada-y-dimensiones-no-medidas.test.ts`.

1. **Replacement text does not inherit another hypothesis's confidence.** Confidence belongs to the text that
   was scored, not to the segment slot that holds it. `reviseTranscriptSegment` no longer falls back to the
   previous segment confidence when the text changes: unless the caller supplies confidence for the new text,
   it stays absent/unknown. `resolveTranscriptReview` takes the confidence recorded for the *selected*
   alternative — never the discarded hypothesis's score — and leaves it undefined when that alternative was
   never scored. Confirming the current text keeps its own confidence. Lineage is preserved either way: the
   replaced score stays on `TranscriptRevision.previousConfidence` /
   `TranscriptReviewResolution.previousConfidence`.
2. **A partial segment cannot produce final-latency metrics.** `finalizedAt` may only exist after a valid
   transition to `final`. `appendTranscriptSegment` refuses a `partial` segment carrying `finalizedAt`, and
   `measureVoiceSession` fails closed on that state instead of measuring it; `timeToFinalMs` is now derived
   from `status === 'final'` segments only, so a still-revisable hypothesis can never report time-to-final.
3. **Unmeasured benchmark dimensions stay undefined, never perfect.** `criticalTermErrorRate`,
   `medicationErrorRate`, `doseErrorRate` and `negationErrorRate` are `undefined` when their denominator is
   absent or empty — the former `Math.max(1, …)` / `?? 0` turned "this corpus never tested medications" into
   "this engine never missed a medication". `summarizeVoiceBenchmark` excludes absent dimensions rather than
   averaging in a zero nobody measured, so an empty/unmeasured corpus cannot appear clinically perfect.

Nonblocking P2, recorded and not repaired in this directive: `timeToFirstPartialMs` follows append order rather
than the earliest supplied timestamp when partials arrive out of order. P2/P3 do not block this slice.

All prior repair invariants are preserved: unresolved ambiguity cannot silently clear, revision lineage retains
prior metadata, impossible chronology fails closed, and contextual-recovery / forced-repeat rates remain
explicit and deterministic.

Not covered: whether a provider-supplied confidence is itself correct (only which text it belongs to),
acceptance thresholds for latency/WER/clinical error rate (Evaluation Kernel), and ASR provider selection.

## Scope exclusions
Paid provider commitment, production secrets, live PHI, full ambient UI, EHR writeback, clinical reasoning, and final competitive superiority claims are out of scope here.

## Definition of done
- Voice session/transcript/revision contracts implemented.
- Safe bridge into the completed Clinical Truth boundary implemented.
- Deterministic latency/revision instrumentation implemented.
- Mandatory focused tests green and repository CI green on a frozen head.
- Board then advances to CLINICAL REASONING + EVIDENCE + SAFETY under NO-GOLD-PLATING.
