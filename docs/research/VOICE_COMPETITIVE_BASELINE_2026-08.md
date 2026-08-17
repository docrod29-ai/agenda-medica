# Voice Competitive Baseline — 2026-08

Purpose: prepare the queued Voice Engine slice without mutating the active Documentation Engine implementation. This is a research baseline, not a superiority claim.

## Owner bar
Ausculta Voice Engine must feel at least comparable to Suki, Abridge, and Nabla for clinical use: rapid capture, clinically accurate understanding, Spanish/English/Spanglish tolerance, contextual correction, minimal repetition, explicit uncertainty when audio cannot be resolved safely, and measurable latency/clinical error rates.

## Current official-source observations

### Suki
Official 2026 documentation describes ambient documentation that captures patient-provider conversations and turns them into structured clinical documentation. Suki documents multilingual support for ambient sessions and clinical documentation, and its solutions page currently advertises support for 80 languages. Suki also exposes dictation through REST/WebSocket and web SDK pathways, indicating streaming dictation as a first-class workflow.

Sources:
- https://developer.suki.ai/documentation/ambient-documentation
- https://developer.suki.ai/api-reference/capabilities/multilingual
- https://developer.suki.ai/documentation/dictation-overview
- https://www.suki.ai/solutions/

### Abridge
Abridge's current clinician platform describes ambient documentation and real-time intelligence during the visit, grounded in the conversation. Its 2026/official materials describe enterprise deployments and real-time capture; official 2025-2026 material states support across outpatient, inpatient, and emergency settings and dozens of specialties/languages.

Sources:
- https://www.abridge.com/platform/clinicians
- https://www.abridge.com/press-release/uchealth-scales-abridge
- https://www.abridge.com/press-release/hss-abridge

### Nabla
Nabla's current product/help pages describe ambient note generation in seconds, multi-specialty/multilingual operation, and a dedicated clinical-grade dictation workflow integrated into EHR use. Nabla Connect currently advertises 35+ languages and multi-speaker capabilities; the main help article states support for over 30 languages.

Sources:
- https://help.nabla.com/en/articles/781954
- https://www.nabla.com/
- https://www.nabla.com/connect
- https://www.nabla.com/dictation

## Implications for Ausculta acceptance tests
The competitor feature descriptions are inputs, not proof of quality. Ausculta must be tested on its own clinical corpus. The Voice Engine slice should define at minimum:

1. Streaming latency: time to first stable partial, stable transcript lag, correction lag, and note-ready lag.
2. Clinical token accuracy: medications, doses, units, routes, frequencies, diagnoses, anatomy, procedure names, lab values, ventilator terms, organisms, antimicrobials, and specialty vocabulary.
3. Meaning preservation: negation, temporality, laterality, uncertainty, speaker attribution, self-corrections, and numeric fidelity.
4. Language robustness: Mexican Spanish, English, code-switching/Spanglish, accents, abbreviations, colloquial clinical speech, and mixed terminology.
5. Acoustic robustness: office noise, hospital/ICU noise, distance from microphone, interruptions, overlapping speech, and low-quality mobile audio.
6. Contextual repair: AI may repair probable ASR errors using encounter context, but the raw transcript/provenance must remain recoverable and unresolved ambiguity must become explicit uncertainty instead of fabricated certainty.
7. Repetition burden: track how often a clinician must repeat/correct speech and total correction time per encounter.
8. Safety-weighted error rate: clinically consequential substitutions/omissions must be weighted more heavily than ordinary word error rate.
9. Multi-speaker behavior: distinguish clinician/patient/other speaker where workflow requires it and avoid cross-attributing clinically material statements.
10. Workflow completion: measure time from speech to usable structured fact/document, not only ASR WER.

## Benchmark stance
No fixed superiority claim is accepted from marketing metrics. During EVALUATION KERNEL, Ausculta must compare blinded, repeatable scenarios and clinician-rated outputs against accessible competitor baselines or equivalent reference workflows. Claims such as “better than Suki/Abridge/Nabla” remain UNPROVEN until those evaluations exist.
