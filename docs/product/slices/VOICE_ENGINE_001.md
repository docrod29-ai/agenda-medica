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

## Scope exclusions
Paid provider commitment, production secrets, live PHI, full ambient UI, EHR writeback, clinical reasoning, and final competitive superiority claims are out of scope here.

## Definition of done
- Voice session/transcript/revision contracts implemented.
- Safe bridge into the completed Clinical Truth boundary implemented.
- Deterministic latency/revision instrumentation implemented.
- Mandatory focused tests green and repository CI green on a frozen head.
- Board then advances to CLINICAL REASONING + EVIDENCE + SAFETY under NO-GOLD-PLATING.
