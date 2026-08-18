# CONSULTORIO / AGENDA / RECETA / PAGOS / SECRETARÍA — SLICE 001

Parent board: GitHub issue #296.
Base checkpoint: Clinical Reasoning + Evidence + Safety SHA `50d5d5e4563fa4416d29ac97cf76e0ddd7be4ce8` with CI #1105 SUCCESS.
Status: ACTIVE.

## Product objective

Turn the completed Clinical Truth, Documentation, Voice, and Reasoning cores into one coherent outpatient physician workflow without creating parallel patient, appointment, prescription, payment, or staff authorization truths.

The mandatory path is physician-first and closed-loop: patient -> appointment -> encounter -> capture/dictation -> Clinical Truth -> documentation/reasoning -> prescription when appropriate -> payment/administrative closure -> follow-up, with explicit role boundaries for secretary/reception staff.

## Integration-first rule

Reuse and reconcile existing repository capabilities for patients, appointments/calendar, expediente/notes, prescriptions, billing/payments, clinic configuration, audit logging, and role/mode authorization before adding new abstractions. Existing production-facing routes and Firestore rules are authoritative until a tested migration says otherwise.

## Mandatory properties

1. **One patient/encounter identity.** Agenda, expediente, documentation, reasoning, prescription and payment reference the same patient/encounter identifiers; no duplicate shadow patient model.
2. **Appointment -> encounter continuity.** Starting a consultation from an appointment preserves provenance and does not silently duplicate the patient or appointment.
3. **Clinical Truth remains clinical authority.** Administrative edits cannot overwrite signed or canonical clinical facts.
4. **Prescription safety boundary.** Draft prescriptions may be proposed, but signing/issuing remains an explicit clinician action; no autonomous prescribing or silent medication changes.
5. **Secretary least privilege.** Secretary/reception workflows may manage allowed scheduling/admin demographics but cannot read or mutate protected clinical note/reasoning content unless an explicit existing policy permits it.
6. **Payment is administrative state.** Payment success/failure/refund must never alter clinical truth, erase care, or unlock unsafe clinical actions.
7. **Auditability.** Material transitions (appointment changes, encounter start, prescription issue, payment state changes, staff edits) retain actor/time/context where the existing audit system supports it.
8. **Failure-safe continuity.** Payment/provider/calendar failures degrade explicitly and preserve clinical work; external provider failure must not fabricate success.
9. **No PHI in synthetic tests.** All new fixtures are synthetic/non-identifying.
10. **Mobile-first path remains viable.** The core physician path must not require desktop-only interactions, while broad UI redesign remains out of scope.

## First checkpoint

Implement a provider-neutral outpatient workflow envelope/state machine that can represent:

- patientId / appointmentId / encounterId linkage
- appointment lifecycle and encounter-start state
- Clinical Truth/document/reasoning references
- prescription draft/issued state with clinician-authority boundary
- payment administrative status without clinical coupling
- staff actor/role and authorization outcome
- explicit external-provider failure state
- auditable transition lineage

Prefer adapters to existing modules over rewrites.

## Mandatory deterministic tests

Prove at minimum that:

- an appointment can start exactly one linked encounter without duplicating the patient;
- mismatched patient/appointment/encounter identifiers are rejected;
- secretary/reception cannot obtain protected clinical note/reasoning content through the workflow envelope;
- administrative demographic or payment changes cannot mutate signed Clinical Truth;
- prescription issue requires an explicit clinician-authority transition;
- failed payment does not delete/block already-recorded clinical care;
- external calendar/payment failure is represented as failure, not success;
- audit lineage retains prior states rather than overwriting history;
- synthetic golden flow patient -> appointment -> encounter -> note/reasoning -> prescription -> payment can complete under authorized roles;
- existing cross-tenant isolation and clinical-safety gates remain green.

## Scope exclusions

- No production deploy or merge of product work to `main`.
- No production PHI.
- No new billing spend/provider commitment.
- No new clinical prescribing policy or autonomous prescription signing.
- No WhatsApp/patient-experience expansion yet; that is the next canonical slice.
- No broad brand/UI redesign.
- No Control Plane P2/P3 hardening.

## Definition of done

- Canonical outpatient workflow contract implemented on top of existing modules.
- Physician and secretary/reception role boundaries proven with negative tests.
- Appointment/encounter/clinical/prescription/payment identifiers remain consistent end to end.
- Failure modes are explicit and preserve clinical work.
- Focused positive/negative tests and repository CI green on a frozen head.
- Board advances to WHATSAPP + PATIENT EXPERIENCE under NO-GOLD-PLATING.
