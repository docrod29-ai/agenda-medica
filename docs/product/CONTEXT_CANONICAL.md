# AUSCULTA — CONTEXTO CANÓNICO

Status: ACCEPTED product source of truth for Product Board #296.
Baseline: accepted V15 `317c6c5695b69e1a543d99d65e897f638db563a8`.
Active slice: VOICE ENGINE.

## 1. Product mission
Ausculta is a clinical AI operating system spanning ambulatory practice through hospital/ICU workflows. The product must reduce physician clerical burden while preserving clinical truth, provenance, safety, and physician control.

## 2. Non-negotiable clinical architecture
One clinical truth -> structured facts/encounter model -> multiple document renderers and downstream clinical workflows.

Generated prose is never the source of truth. Renderers consume the structured clinical truth; they do not independently reinterpret the encounter.

## 3. NO INVENTAR
Ausculta must never convert absent, ambiguous, inferred, or conflicting information into a documented fact. Every clinically meaningful datum must preserve an explicit truth state where applicable:
- NEGADO
- NO_INTERROGADO
- NO_DOCUMENTADO
- DESCONOCIDO
- INFERIDO
- INCIERTO
- CONFLICTIVO

Inference must remain visibly distinct from clinician/patient-supplied fact. Conflicts must be preserved until resolved; they must not be silently overwritten.

## 4. Provenance and lifecycle
Clinical facts must preserve provenance sufficient to identify their source (dictation, typed text, imported result, device/system, clinician correction, or other supported source), encounter/time context, and relevant confidence/uncertainty.

Documents preserve draft/signed lifecycle. A signed document must not be silently rewritten. Corrections may create auditable amendments/new versions according to later implementation policy.

Physician corrections may feed a ClinicianPreferenceProfile for style/workflow personalization, but preference learning must never rewrite underlying clinical truth.

## 5. Documentation input contract
The physician may provide the same underlying clinical truth through:
- live or recorded dictation,
- free text,
- mixed voice + text,
- abbreviated or disorganized notes,
- spelling/typing errors,
- medical terminology,
- Spanish, English, or Spanglish.

Ausculta must normalize these inputs without requiring re-dictation and without inventing missing facts.

## 6. Minimum documentation outputs
From the same clinical truth, Ausculta must support at minimum:
1. Nota de primera vez
2. Nota de evolución
3. Historia clínica completa
4. Nota de interconsulta
5. Nota hospitalaria
6. Nota UCI
7. Nota de egreso
8. Resumen médico
9. Resumen cronológico
10. Informe para aseguradora
11. Justificación médica de medicamento/procedimiento/hospitalización
12. Referencia
13. Contrarreferencia
14. Instrucciones al paciente
15. Resumen para otro especialista

## 7. Product work order
Mandatory order unless the owner explicitly changes it:
1. CONTEXT-CANONICALIZATION
2. DOCUMENTATION ENGINE / CLINICAL TRUTH
3. VOICE ENGINE
4. CLINICAL REASONING + EVIDENCE + SAFETY
5. CONSULTORIO / AGENDA / RECETA / PAGOS / SECRETARIA
6. WHATSAPP / PATIENT EXPERIENCE
7. HOSPITAL / UCI
8. SPECIALTY PACKAGES
9. MOBILE FIRST + BRAND / UI
10. RELIABILITY / SCALE / OBSERVABILITY / DR / SECURITY / PRODUCTION READINESS
11. EVALUATION KERNEL / competitive benchmark

## 8. Execution model
- Issue #296 is the visible product board.
- One writer at a time for an active slice/overlapping files.
- Claude/Opus is the preferred product writer when transport is available; lack of transport must not stop independent safe work.
- Codex is an independent read-only judge for completed/frozen slices where audit is useful.
- Independent research, evaluation design, and future-slice preparation may proceed in parallel when they do not mutate the active writer's files.
- Persist small checkpoints and run relevant deterministic tests.
- NO-GOLD-PLATING: close mandatory acceptance criteria and move forward; optional refactors/cosmetic infrastructure are deferred.

## 9. Safety and owner gates
Without explicit owner approval, do not:
- merge product work to `main`,
- deploy production,
- expose/use PHI in development or evaluation,
- rotate production secrets,
- change clinical policy,
- weaken safety/security gates,
- make destructive or irreversible changes,
- alter billing/spending outside existing limits.

Non-blocking Control Plane P2/P3 defects are DEFERRED. Re-enter Control Plane hardening only for a blocking P0/P1 that makes product work unsafe or impossible.

## 10. Major product domains already accepted
Ausculta's target product surface includes ambulatory practice, longitudinal patient context, documentation, voice, clinical reasoning, evidence, safety, agenda, prescription, payments/administrative workflows, secretary permissions, WhatsApp/patient experience, hospital, ICU, specialty packages, mobile-first UX, reliability/scale/security, and competitive evaluation.

Hospital/ICU direction includes encounter/ADT/bed/transfer continuity, ICU stay/record, voice terminology, infusion workflows, closed-loop tasks/medications/results, ventilation/hemodynamics, and later advanced device/workflow integrations where explicitly specified and validated.

## 11. Decision vocabulary
Every unresolved product assertion must be classified rather than guessed:
- ACCEPTED — explicitly established product truth.
- DEFERRED — valid work intentionally postponed.
- UNKNOWN — insufficient evidence/context; do not invent.
- OWNER_APPROVAL_REQUIRED — cannot proceed safely under standing authority.

## 12. Voice and realtime intelligence quality floor
Voice is not an optional convenience. It is a core clinical interface.

Minimum acceptable behavior:
- overall physician experience must be at least competitive with leading ambient-clinical products such as Suki, Abridge, and Nabla;
- speech capture and understanding must feel conversational and near-immediate, with low enough latency that the physician does not have to slow down or adapt normal speech;
- robust understanding of Spanish, English, Spanglish, accents, abbreviations, drug names, doses, labs, procedures, specialty terminology, ICU/ventilator terminology, names, and common real-world dictation errors;
- tolerate incomplete phrases, self-corrections, reordered thoughts, interruptions, background noise, and disorganized clinical speech;
- use AI context rapidly to recover likely intended medical terms when acoustic recognition is uncertain, but never silently promote an uncertain reconstruction to fact;
- when ambiguity remains clinically meaningful, preserve uncertainty/conflict and ask for confirmation only when necessary for safety rather than forcing routine repetition;
- support realtime or streaming partial results with rapid correction as more context arrives;
- transcription quality alone is insufficient: the system must understand clinical meaning, structure it correctly, preserve provenance, and feed the same Clinical Truth model;
- physician-perceived speed, precision, and understanding are release criteria, not cosmetic metrics.

Target reference experience: the physician should be able to speak naturally, quickly, and imperfectly and still feel that the system understood the intended clinical content on the first pass. A product that routinely mishears medical words, requires repetition, or produces slow corrections does not meet the Ausculta quality floor.

## 13. Evaluation implications for Voice Engine
The Voice Engine slice must define and test at minimum:
- medical word error rate and concept error rate,
- medication/drug-name accuracy,
- dose/unit accuracy,
- numeric/lab accuracy,
- specialty terminology accuracy,
- code-switching Spanish/English/Spanglish accuracy,
- latency to useful partial transcript and latency to stable transcript,
- correction/recovery quality from context,
- rate of unnecessary physician repetitions,
- clinically significant omission/substitution rate,
- hallucinated-content rate after AI repair,
- physician edit time and physician satisfaction.

Competitive claims remain unproven until Evaluation Kernel benchmarking, but the release floor is explicit: Ausculta must not be knowingly shipped below the best-in-class clinical voice/documentation experience targeted by the owner.

## 14. Definition of done for this slice
CONTEXT-CANONICALIZATION is complete only when the canonical context, product board, decision register, deterministic verifier, and focused tests agree on the same work order and non-negotiable product rules, with exactly one active slice and no contradictory canonical assertions.
