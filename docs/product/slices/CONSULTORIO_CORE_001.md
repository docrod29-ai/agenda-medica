# CONSULTORIO / AGENDA / RECETA / PAGOS / SECRETARÍA — SLICE 001

Parent board: GitHub issue #296.
Integrated base: Voice + Clinical Reasoning reconciliation `25af0c9545798167723f52a6ca5adaa052928012` from PR #364.
Integrated-base CI: run `32686792260` — SUCCESS (typecheck, Vitest/invariants, clinical-safety, tenant isolation, production build and public e2e).
Status: ACTIVE — canonical Consultorio launch slice.

## Development gate

Consultorio development no longer depends on an exact-SHA Codex PASS for Voice/Reasoning. Codex may be used as an optional adversarial auditor when useful, but it is not a single-point development blocker.

The technical gate for this slice is:

1. canonical CI green on the integrated Voice + Reasoning base;
2. focused positive/negative tests for every safety-critical change;
3. clinical-safety and tenant-isolation gates remain strict;
4. no weakening of medication, diagnosis, signing, provenance, authorization or recovery invariants;
5. no production merge/deploy without separate owner authorization.

## Product objective

Turn Ausculta's existing consultorio capabilities into one coherent physician-office workflow rather than separate screens. Reuse the existing appointment, patient, consultation, expediente, prescription, payments/cash-cut and role/secretary capabilities already present in the repository; do not build parallel substitutes.

## Canonical physician-office flow

1. Patient is identified or created within the correct clinic tenant.
2. Appointment is created/confirmed/rescheduled/cancelled with an auditable, idempotent state transition.
3. Check-in opens the correct patient/encounter context; no accidental cross-patient carryover.
4. Consultation accepts voice, typed text or mixed input and converges on the same Clinical Truth.
5. Clinical Truth / Documentation / Voice / Reasoning are consumed without creating competing truth models.
6. Prescription is produced only from clinician-confirmed medication intent and patient/encounter context; never autonomously signed.
7. Payment/cash status is linked to the visit without granting clinical-record access to billing/secretary roles.
8. Secretary/reception workflows expose only the minimum administrative data required for their role.
9. Closing the visit leaves a coherent audit trail and no dangling patient, appointment, note, prescription or payment state.

## Launch-blocking Golden Path

These are mandatory before the first controlled Consultorio launch:

1. **Long consultation continuity.** Recording/session must survive >10, 30 and 60 minutes without stopping, navigating away or discarding work.
2. **Autosave + recovery.** Refresh/crash/reconnect restores the same encounter without duplicate facts, medications, diagnoses or transcript segments.
3. **Stable scroll/focus.** Background transcript, autosave, validation and AI updates must not yank the physician's viewport on desktop or mobile.
4. **Material ambiguity only.** Escalate medication identity/dose/unit/route/frequency, allergy, negation, laterality and critical numeric ambiguity; harmless ASR noise must not interrupt the consult.
5. **Medication firewall.** A medication mentioned in history/current meds never enters plan or prescription by inference. Explicit clinician intent is mandatory.
6. **Diagnosis anti-inflation.** Suggestions/CIE-10 remain unconfirmed until explicit clinician disposition; deduplicate synonyms and overlapping diagnoses.
7. **Typed/voice parity.** Manual text, voice and mixed input reach the same Clinical Truth, reasoning and document invariants; no forced re-dictation.
8. **Graceful secondary failure.** AI/evidence/provider/UI failures may degrade capability but must not erase encounter work or unnecessarily block safe note completion/signing.
9. **Scheduling idempotency.** Confirmation/cancel/reschedule/start retries and double taps must not create duplicate appointments, encounters, charges or transitions.

## Existing capabilities to reconcile, not duplicate

At minimum reuse current modules around:

- `src/app/(dashboard)/calendario/**`
- `src/app/(dashboard)/citas/**`
- `src/app/(dashboard)/consulta/**`
- `src/app/(dashboard)/expediente/**`
- existing prescription/receta surfaces and supporting libraries/APIs
- `src/app/(dashboard)/corte-caja/**` and existing payments/billing primitives
- canonical Clinical Truth, Documentation, Voice and Reasoning modules
- clinic membership, role and permission enforcement in Firestore Rules/server APIs
- existing golden-flow emulator and tenant-isolation CI gates

## Mandatory safety properties

1. **One encounter context.** Appointment, patient, consultation, note, prescription and payment references resolve to the same clinic/patient/encounter identity.
2. **No cross-patient leakage.** Switching patients/appointments clears or rebinds encounter-scoped draft state before clinical actions continue.
3. **Role least privilege.** Secretary/reception may manage scheduling and administrative patient fields but cannot gain clinical-note access through UI, API or direct Firestore paths.
4. **Clinical Truth remains canonical.** Consultorio cannot silently fork a second truth model.
5. **Signed-document integrity.** Signed notes are immutable except through audited amendment lineage; patient release is a separate controlled action where applicable.
6. **Prescription requires clinician authority.** No autonomous prescription/signature; consequential medication output remains clinician-reviewed and auditable.
7. **Payment is administrative, not authorization.** Payment state cannot unlock clinical data beyond the caller's existing role.
8. **Idempotent transitions.** Repeated administrative requests cannot create duplicate appointments, encounters, prescriptions or charges.
9. **Auditability.** Material transitions retain actor, timestamp, clinic, patient/encounter linkage and before/after state where appropriate.
10. **Graceful failure.** Payment/provider/calendar/AI failures must not corrupt Clinical Truth or signed documents.

## Mandatory focused tests

Prove at minimum that:

- a synthetic 60-minute non-PHI consultation keeps capture/session alive and all checkpoints recoverable;
- refresh/crash/reconnect restores the same encounter without duplicate clinical facts;
- desktop/mobile background updates preserve scroll/focus;
- nonclinical low-confidence filler creates no physician interruption while material medication/dose/negation ambiguity creates one contextual review item;
- a reported/history medication cannot enter plan/prescription without explicit clinician action;
- redundant diagnostic synonyms collapse to a prioritized suggestion set and none becomes confirmed/CIE-coded without clinician disposition;
- typed-only and mixed-input encounters reach the same Clinical Truth/document invariants as voice;
- duplicate scheduling/payment/start retries are idempotent;
- appointment -> check-in -> consultation -> signed note -> prescription -> payment completes for one synthetic tenant;
- secretary cannot read clinical note content through tested API/rules paths;
- switching patient context cannot retain another patient's encounter-scoped draft;
- payment failure leaves the clinical encounter intact and does not duplicate charges;
- signed notes remain immutable through office workflow operations;
- cross-tenant reads/writes remain denied.

## Scope exclusions

- No WhatsApp automation in this slice.
- No broad unrelated UI redesign.
- No new production payment/provider commitment or billing spend.
- No production PHI fixtures.
- No clinical-policy change.
- No Hospital/UCI functionality.
- No production secret/rule deployment.
- No product merge to `main` or production deploy without explicit owner authorization.

## Definition of done

- Coherent Consultorio workflow integration exists on the product branch.
- Existing scheduling, consultation, expediente, prescription, payment and role primitives are reconciled rather than duplicated.
- Golden Path launch blockers above are implemented with focused positive/negative regression tests.
- Canonical CI is green on one frozen Consultorio head.
- Production remains separately gated; development may then advance to the next Consultorio-first slice under NO-GOLD-PLATING.
