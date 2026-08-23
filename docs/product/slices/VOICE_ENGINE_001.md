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
   clinician-correction lineage. *(This last sentence is SUPERSEDED by the `f38907a0` repair record below: it
   stranded the ambiguity once the session was sealed. Everything else in this finding stands.)*
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

## P1 repair record — exact-SHA audit `4367b7c22618c608efd409d8005cf068f87129f1`
Canonical exact-head CI was green on this SHA. Independent read-only Codex run `32411275150` returned FAIL for
two blocking P1 findings. This directive supersedes the three-P1 directive above. Both are closed in
`src/lib/voice-engine/index.ts` with focused negative tests in
`src/__tests__/voice-engine-latencia-util-y-captura-imposible.test.ts`.

1. **Latency measures a useful partial and a stable transcript, not the arrival of an artifact.**
   - The minimum structural usefulness rule is not new policy: it is the first half of the existing
     `isFinalizableTranscriptText` gate, extracted as `isUsefulTranscriptText` so instrumentation and
     finalization share one rule. Text is useful when it carries content — non-blank and containing at least
     one letter or digit. It is deliberately *only* that: a partial legitimately ends mid-utterance, so the
     dangling-connector half of the finalization gate does not apply to a partial, and clinical usefulness
     stays with the clinician and with `needsReview`.
   - `timeToFirstPartialMs` can now only start from a structurally useful partial. A punctuation/noise partial
     (`"…"`, `","`, `"..."`) — streaming filler emitted before the engine has understood anything — no longer
     sets `firstPartialReceivedAt`. If the useful text first appears in a revision of a noise partial, the
     clock starts at that revision. Latency to displaying nothing is the easiest number in the corpus to win.
   - `timeToFinalMs` is latency to a **stable** transcript and belongs to the session, not to whichever segment
     finalized first. While any segment is still `partial`/revisable it is explicitly `undefined`; it was
     previously computed over the finalized subset, so a transcript that could still change published a
     final-latency number, and that number improved the longer the slow segments stayed unfinalized. The
     pre-existing test that asserted the finalized-subset behaviour is corrected in
     `src/__tests__/voice-engine-confianza-heredada-y-dimensiones-no-medidas.test.ts`.

2. **ClinicalInput capture provenance must be chronologically possible.** `voiceSessionToClinicalInput` now
   rejects a `capturedAt` earlier than `session.startedAt`, matching the fail-closed rule
   `appendTranscriptSegment` already applies to `receivedAt`. A pre-session capture timestamp would have
   entered Clinical Truth as provenance for an encounter that had not started. Arrival exactly at `startedAt`
   remains valid, and all prior impossible-chronology fail-closed behaviour (segment `receivedAt`, stale
   transitions, `measureVoiceSession`) is unchanged.

Nonblocking P2/P3 remain nonblocking and unrepaired, including: `timeToFirstPartialMs` follows append order
rather than the earliest supplied timestamp when partials arrive out of order.

All prior repair invariants are preserved: unresolved ambiguity cannot silently clear; replacement text does
not inherit another hypothesis's confidence; revision lineage retains prior metadata; partial segments cannot
carry final timestamps; impossible segment chronology fails closed; unmeasured benchmark dimensions stay
undefined; contextual-recovery and forced-repeat metrics remain explicit and deterministic.

Not covered: acceptance thresholds for useful-partial or stable-transcript latency (Evaluation Kernel),
whether a partial with content is clinically useful, validation of `capturedAt` against the end of dictation
or against wall-clock time, and ASR provider selection.

## P1 repair record — exact-SHA audit `75d86a20df4955a82d7157e8f2f8b1cc053292d1`
Canonical CI #1142 was SUCCESS on this exact SHA. Independent read-only Codex run `32421053031` returned FAIL for
two blocking P1 findings. This directive supersedes the two-P1 directive above. Both are closed in
`src/lib/voice-engine/index.ts` with focused negative tests in
`src/__tests__/voice-engine-sesion-sellada-y-revision-tardia.test.ts`.

1. **No stable/final latency until the capture session is explicitly sealed.** `measureVoiceSession` treated
   "every segment I currently know about is final" as a stable transcript while the session was still open and
   `appendTranscriptSegment` would happily accept the next utterance. From inside the session a streaming pause
   between two phrases of the same dictation is indistinguishable from the end of dictation, so the published
   number was measured over a silence. The session now carries an explicit terminal/sealed state, `endedAt`, set
   by `endVoiceSession`. Sealing is a positive act: it requires that no segment is still revisable and that
   `endedAt` is chronologically possible against `session.startedAt` and against every segment's lineage head.
   After sealing, `appendTranscriptSegment`, `reviseTranscriptSegment` and `finalizeTranscriptSegment` are
   refused; `resolveTranscriptReview` deliberately stays available, because clearing an unresolved review is a
   clinician act on already-captured transcript and on a final segment it may only confirm the current text.
   *(That last clause is SUPERSEDED by the `f38907a0` repair record below: on a sealed final segment a
   resolution may also select a hypothesis the provider already recorded.)*
   `timeToFinalMs` now requires **both** the sealed session and no remaining partial segment; otherwise it is
   explicitly `undefined`. A sealed session whose transcript finalized after the seal fails closed.

2. **A late provider revision cannot silently overwrite a clinician-resolved state.** After
   `resolveTranscriptReview` the segment was `needsReview: false` with its alternatives cleared, so a later
   `provider_revision` / `contextual_correction` could change the text and compute review from that `false`:
   with no alternatives left on the segment, `hasCompetingAlternatives` saw nothing in competition and the flag
   stayed down. The hypothesis the clinician had *discarded* could re-enter, be finalized, and cross into
   Clinical Truth as review-free truth — with a dose (`start vanco fifteen` → `start vanco fifty`) that is a
   more-than-threefold vancomycin change, signed. A provider/contextual revision that changes text a clinician
   already dispositioned now reopens review (`TranscriptRevision.reopenedResolvedReview`), and because
   `needsReview` is monotonic, finalization cannot lower it again. The clinician resolution provenance is never
   discarded: `reviewResolutions` keeps the resolver, the timestamp, the rationale and the hypotheses that were
   discarded, all the way through the Clinical Truth bridge. A `clinician_correction` is the clinician acting
   again and does not reopen.

All prior repair invariants are preserved: unresolved ambiguity cannot silently clear; replacement text does not
inherit another hypothesis's confidence; revision lineage retains prior metadata; partial segments cannot carry
final timestamps; impossible segment/session chronology fails closed; punctuation/noise cannot win
first-useful-partial latency; unmeasured benchmark dimensions stay undefined; contextual-recovery and
forced-repeat metrics remain explicit and deterministic.

Nonblocking P2/P3 remain nonblocking and unrepaired, including: `timeToFirstPartialMs` follows append order
rather than the earliest supplied timestamp when partials arrive out of order.

Not covered: whether the clinician's resolution or the late provider hypothesis was clinically correct (only that
the substitution cannot happen silently), acceptance thresholds for stable-transcript latency and any policy for
*when* a session should be sealed (Evaluation Kernel and the capture layer this slice does not build), validation
of `endedAt` against wall-clock time or against the end of audio, and ASR provider selection.

## P1 repair record — exact-SHA audit `f38907a07e9bd6b84b3086b234f1366c419b7c3b`
An independent read-only exact-SHA Codex audit returned FAIL for two blocking P1 findings. P1 #2 (canonical
active-slice contradiction plus the verifier gap that let it through) was already closed on this branch with
focused verifier coverage in `tests/product/context-verifier-active-slice.test.mjs`. The remaining P1 is closed
in `src/lib/voice-engine/index.ts` with focused tests in
`src/__tests__/voice-engine-ambiguedad-varada-tras-sellar.test.ts`.

1. **Sealing cannot strand clinically material ambiguity.** A `final` segment carrying `needsReview: true` and
   two recorded dose hypotheses (`start vanco fifteen` / `start vanco fifty`) had no route to the rival
   hypothesis once the session was sealed. `resolveTranscriptReview` — deliberately still available after
   `endVoiceSession` — refused any `resolvedText` other than the current text on a final segment and pointed at
   `reviseTranscriptSegment`'s clinician-correction lineage; that lineage is refused after sealing by
   `assertNotTerminal`. Both doors pointed at each other and both were shut, so the only hypothesis that could
   ever survive was whichever one the provider happened to leave on top, with the review flag stuck up forever
   as the only record. The root cause is conflating `final` ("the provider stopped revising this text") with
   "the clinician already chose between the recorded hypotheses".

   The guard is removed. `resolveTranscriptReview` may now select any hypothesis that was **actually recorded**
   on the segment — its current text or one of its `alternatives` — whether the segment is partial or final and
   whether the session is open or sealed. Nothing else is relaxed:
   - `resolvedText` outside the recorded hypotheses is still refused, so the clinician selects and never authors;
   - an identified resolver, a rationale, the structural text gate and the stale-transition check all still apply;
   - it is not a capture transition and relaxes none: after sealing, `appendTranscriptSegment`,
     `reviseTranscriptSegment` and `finalizeTranscriptSegment` remain refused, and a resolution never changes
     `status`, `finalizedAt`, `endedAt` or the stable-latency metric;
   - `TranscriptReviewResolution` keeps `previousText`, `previousConfidence`, `previousAlternatives`,
     `resolvedBy`, `resolvedAt` and `rationale`, and reaches `ClinicalInput` intact;
   - the selected alternative receives only the confidence recorded for **that** text and stays `undefined` when
     that alternative was never scored — it never inherits the discarded hypothesis's score.

   The pre-existing test that asserted the stranding behaviour is corrected in
   `src/__tests__/voice-engine-ambiguedad-linaje-y-cronologia.test.ts`; the "no new text" half of that case is
   kept and strengthened.

All prior repair invariants are preserved: unresolved ambiguity still cannot clear except through an attributed
resolution; a late provider/contextual revision over a clinician disposition still reopens review; replacement
text does not inherit another hypothesis's confidence; revision lineage retains prior metadata; partial segments
cannot carry final timestamps; impossible segment/session chronology fails closed; punctuation/noise cannot win
first-useful-partial latency; unmeasured benchmark dimensions stay undefined.

Nonblocking P2/P3 remain nonblocking and unrepaired, including: `timeToFirstPartialMs` follows append order
rather than the earliest supplied timestamp when partials arrive out of order.

Not covered: whether the hypothesis the clinician selected was the clinically correct one (only that selecting it
is possible, attributed and reconstructible); any route back to a hypothesis that no longer appears in
`alternatives` (for example one left only in `reviewResolutions` after a reopening) — resolution selects among
what the segment records; policy for when a session should be sealed; and ASR provider selection.

## P1 repair record — exact-SHA audit `58a6d3da6a4dde30427f7bc9321e644e977b782c`
Canonical CI #1179 was SUCCESS on this exact SHA. A corrected independent read-only Codex run `32614444497`
returned a FAIL verdict with exactly one blocking P1. It is closed in `src/lib/voice-engine/index.ts` with
focused tests in `src/__tests__/voice-engine-puente-exige-captura-sellada.test.ts`.

1. **The Clinical Truth bridge cannot emit an incomplete or unsealed transcript.** `voiceSessionToClinicalInput`
   *filtered* the session to its `final` segments and emitted `ClinicalInput` from whatever was left, even while
   the Voice session was still open. A session holding one final phrase plus a clinically material
   partial/ambiguous segment therefore produced a `ClinicalInput` that silently omitted the partial — and because
   the omitted segment was the only one carrying `needsReview`, the provenance published `needsReview: false`. A
   truncated transcript leaves no trace in the record: the note simply never mentions what was dropped, and
   nothing downstream can tell an incomplete transcript from a short dictation. The root cause is that the bridge
   treated "the final segments in front of me" as "the transcript", and treated "everything I know is final" as
   the end of dictation — the same mistake `measureVoiceSession` had already been taught to refuse through the
   seal.

   The bridge now requires two conditions, and infers neither from how the segments look:
   - the session is explicitly sealed (`endedAt`, set by `endVoiceSession`);
   - no segment is still non-final/revisable. `endVoiceSession` already enforces this before sealing, but the
     bridge revalidates it against the object it was actually handed, so a malformed or forged session carrying
     `endedAt` without having passed the seal transition fails closed here too — **naming** the segments it
     refuses to drop instead of filtering them away. An `endedAt` that is unparseable or precedes
     `session.startedAt` is likewise refused rather than trusted.

   `endVoiceSession` remains the one canonical seal transition and keeps its rule that every segment must be
   final before sealing. Sealed late clinician review resolution is unchanged: `resolveTranscriptReview` stays
   available after the seal, while provider append/revise/finalize stay refused.

Old core tests that bridged unsealed sessions now seal through `endVoiceSession` first. One pre-existing case in
`src/__tests__/voice-engine-estado-obsoleto-y-revision-incompleta.test.ts` asserted the silent-omission
behaviour itself (a stale partial dropped while a newer final segment crossed the bridge); it is corrected to
assert that the session can neither be sealed nor bridged while that partial survives.

All prior repair invariants are preserved: unresolved ambiguity cannot clear except through an attributed
resolution; sealing cannot strand a recorded hypothesis; a late provider/contextual revision over a clinician
disposition reopens review; replacement text does not inherit another hypothesis's confidence; revision lineage
retains prior metadata; partial segments cannot carry final timestamps; impossible segment/session chronology
fails closed; punctuation/noise cannot win first-useful-partial latency; unmeasured benchmark dimensions stay
undefined.

Nonblocking P2/P3 remain nonblocking and unrepaired, including: `timeToFirstPartialMs` follows append order
rather than the earliest supplied timestamp when partials arrive out of order.

Not covered: **when** a session should be sealed — that policy belongs to the capture layer this slice does not
build; the bridge only refuses to invent the end. Also not covered: validation of `endedAt` against wall-clock
time or the end of audio, `capturedAt` against `endedAt`, whether a sealed transcript is clinically sufficient
(that stays with the clinician and with `needsReview`), acceptance thresholds (Evaluation Kernel), and ASR
provider selection.

## Scope exclusions
Paid provider commitment, production secrets, live PHI, full ambient UI, EHR writeback, clinical reasoning, and final competitive superiority claims are out of scope here.

## Definition of done
- Voice session/transcript/revision contracts implemented.
- Safe bridge into the completed Clinical Truth boundary implemented.
- Deterministic latency/revision instrumentation implemented.
- Mandatory focused tests green and repository CI green on a frozen head.
- Board then advances to CLINICAL REASONING + EVIDENCE + SAFETY under NO-GOLD-PLATING.
