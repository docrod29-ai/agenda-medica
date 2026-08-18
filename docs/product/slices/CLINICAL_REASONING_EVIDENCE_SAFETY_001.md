# CLINICAL REASONING + EVIDENCE + SAFETY — SLICE 001

Parent board: GitHub issue #296.
Base checkpoint: Voice Engine completion SHA `06fee478f3070d77486df683d0ab4e485ed7f78f`.
Status: COMPLETE.

## Product objective

Connect Ausculta's existing reasoning, evidence, and safety capabilities to the canonical Clinical Truth boundary without creating a second clinical truth, a second safety system, or an opaque LLM-only decision path.

This slice is integration-first. Existing engines must be reused or consolidated before new parallel engines are created.

## Existing capabilities that must be reconciled, not duplicated

At minimum inspect and reuse the current repository capabilities around:

- `src/lib/clinical/safety-gate.ts`
- `src/lib/clinical/registry.ts`
- `src/lib/clinical/invariantes-clinicos.json`
- `src/lib/evidencia/**`
- current Copilot/reasoning modules and deterministic calculators already reachable from the physician workflow
- the completed `src/lib/clinical-truth/**` boundary

## Mandatory properties

1. **Clinical Truth is the input boundary.** Reasoning consumes canonical facts/provenance; it must not silently parse a second competing patient truth from prose when structured truth exists.
2. **NO INVENTAR remains absolute.** A clinical assertion must distinguish observed fact, deterministic derivation, model inference, uncertainty, conflict, and missing data.
3. **Provenance travels with reasoning.** Every material reasoning output must be traceable to source fact IDs and/or explicit evidence references.
4. **Evidence is not decoration.** Evidence-backed claims must identify source, retrieval/version date when available, and the claim actually supported. Retrieval failure or absent support must remain explicit.
5. **Deterministic before generative.** Calculations, dose limits, scores, contraindication rules, unit conversions, temporal logic, and other deterministic safety logic stay outside the LLM when a deterministic engine exists.
6. **Safety is a gate, not prose.** P0/P1 clinical hazards must be representable as structured findings with severity, trigger, provenance, and required clinician review before consequential output.
7. **Uncertainty is first-class.** The system must not convert `INCIERTO`, `CONFLICTIVO`, `NO_DOCUMENTADO`, or missing evidence into certainty through fluent language.
8. **Clinician remains final authority.** The system may propose; it must not autonomously sign, prescribe, close critical results, or mutate signed clinical truth.
9. **Corrections are auditable.** Physician acceptance/rejection/correction may feed preference learning, but cannot rewrite source provenance or historical signed truth.
10. **Graceful evidence/provider failure.** A failed evidence search, LLM outage, or incomplete context must degrade to an explicit limited mode rather than fabricate reassurance.

## First checkpoint

Build one provider-neutral reasoning envelope that can carry:

- patient/encounter identity reference
- source fact IDs
- problem/question under consideration
- deterministic findings
- model-generated hypotheses clearly labeled as such
- uncertainty/conflicts/missing-data list
- evidence references and evidence-support status
- safety findings and required-review state
- clinician disposition (pending/accepted/rejected/corrected)

The envelope must be able to represent "insufficient evidence" and "insufficient patient data" without inventing a recommendation.

## Mandatory deterministic tests

Prove at minimum that:

- a reasoning claim cannot be promoted to observed fact;
- conflicting source facts remain visible in the reasoning input/output;
- missing source fact IDs block provenance-dependent claims;
- evidence lookup failure is not represented as evidence support;
- an unsupported citation cannot satisfy a supported-claim state;
- deterministic safety findings survive LLM failure;
- high-severity safety findings require clinician review;
- clinician rejection/correction is retained as lineage rather than deleting the prior proposal;
- signed Clinical Truth is not mutated by reasoning;
- the integration does not introduce a second independent patient-truth parser.

## Scope exclusions

- No new medical policy or guideline recommendation changes in this slice.
- No production PHI fixtures.
- No paid evidence-provider commitment.
- No autonomous prescribing/signing.
- No EHR writeback.
- No broad UI redesign.
- No Control Plane hardening unless a real P0/P1 blocks this slice.

## Definition of done

- Canonical reasoning/evidence/safety envelope implemented.
- Existing safety/evidence engines mapped into that envelope without unnecessary duplication.
- Clinical Truth provenance preserved end to end.
- Deterministic safety behavior remains available during model/evidence-provider failure.
- Focused positive/negative tests green.
- Repository CI green on a frozen head.
- Board then advances to CONSULTORIO / AGENDA / RECETA / PAGOS / SECRETARÍA under NO-GOLD-PLATING.

## Completion evidence

- Frozen implementation candidate `50d5d5e4563fa4416d29ac97cf76e0ddd7be4ce8` passed CI #1105.
- The slice added a provider-neutral reasoning envelope, registered-engine adapters, evidence-source adapters, structured safety findings, explicit limited modes, clinician disposition lineage, and focused positive/negative tests.
- Independent Codex judge was triggered on the frozen candidate after the bounded read-only workflow landed on `main`; no Codex verdict is claimed here until its immutable artifact is inspected.
